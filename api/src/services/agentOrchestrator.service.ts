/**
 * Agent orchestrator. Runs a specialized agent for a lifecycle stage while
 * enforcing the human-in-the-loop contract:
 *
 *   1. If the agent requires human approval and the stage gate is not approved,
 *      the run is BLOCKED (ApprovalRequiredError) — this is the server-side
 *      guardrail that cannot be bypassed by calling the API directly.
 *   2. Pre-output guardrails screen the prompt; post-output guardrails screen
 *      the completion. Blocking findings fail the run.
 *   3. All Foundry calls go through the APIM gateway layer.
 *   4. The run, its tool calls, guardrail findings, and artifacts are persisted
 *      and every action is audited.
 */
import { v4 as uuid } from 'uuid';
import { getRepository } from '../persistence/factory';
import {
  AgentRun,
  Artifact,
  AuthUser,
  LifecycleStage,
} from '../models';
import * as agents from './agents.service';
import * as approvals from './approval.service';
import * as guardrails from './guardrails.service';
import * as audit from './audit.service';
import * as projects from './projects.service';
import { callFoundry } from './apimFoundry.service';

const runRepo = () => getRepository<AgentRun>('agentRuns');
const artifactRepo = () => getRepository<Artifact>('artifacts');

export interface RunAgentInput {
  workflowRunId: string;
  projectId: string;
  agentId: string;
  prompt: string;
}

export async function runAgent(
  input: RunAgentInput,
  user: AuthUser,
  correlationId: string,
): Promise<AgentRun> {
  const agent = agents.get(input.agentId);
  if (!agent) throw Object.assign(new Error(`Unknown agent: ${input.agentId}`), { status: 404 });
  if (!agent.enabled) throw Object.assign(new Error(`Agent disabled: ${input.agentId}`), { status: 409 });

  // (1) Human-in-the-loop enforcement — the hard gate.
  if (agent.requiresHumanApproval) {
    const approved = await approvals.isStageApproved(input.workflowRunId, agent.lifecycleStage);
    if (!approved) {
      await audit.record({
        actorType: 'system',
        actor: 'orchestrator',
        action: 'agent.blocked.approval-missing',
        targetType: 'agent',
        targetId: agent.agentId,
        correlationId,
        workflowRunId: input.workflowRunId,
        details: { lifecycleStage: agent.lifecycleStage },
      });
      throw new approvals.ApprovalRequiredError(agent.lifecycleStage);
    }
  }

  const now = new Date().toISOString();
  const run: AgentRun = {
    id: uuid(),
    workflowRunId: input.workflowRunId,
    projectId: input.projectId,
    agentId: agent.agentId,
    lifecycleStage: agent.lifecycleStage,
    modelName: agent.modelDeploymentName,
    apimRoute: agent.apimRoute,
    promptId: uuid(),
    tokenEstimate: 0,
    correlationId,
    state: 'Running',
    toolCalls: [],
    outputArtifactIds: [],
    guardrailFindings: [],
    startedAt: now,
    startedBy: user.email,
  };

  await audit.record({
    actorType: 'agent',
    actor: agent.agentId,
    action: 'agent.run.start',
    targetType: 'workflowRun',
    targetId: input.workflowRunId,
    correlationId,
    workflowRunId: input.workflowRunId,
    details: { modelName: agent.modelDeploymentName, apimRoute: agent.apimRoute },
  });

  // (2a) Pre-output guardrails.
  const preFindings = guardrails.evaluate(input.prompt, 'pre');
  if (guardrails.isBlocked(preFindings)) {
    return failRun(run, preFindings, 'Blocked by pre-output guardrails', correlationId, agent.agentId);
  }

  // (3) Foundry call via APIM.
  const result = await callFoundry(agent, input.prompt, {
    promptId: run.promptId,
    agentId: agent.agentId,
    modelName: agent.modelDeploymentName,
    projectId: input.projectId,
    userId: user.email,
    workflowRunId: input.workflowRunId,
    correlationId,
  });
  run.tokenEstimate = result.tokenEstimate;

  // (2b) Post-output guardrails.
  const postFindings = guardrails.evaluate(result.content, 'post');
  run.guardrailFindings = [...preFindings, ...postFindings];
  if (guardrails.isBlocked(postFindings)) {
    return failRun(run, run.guardrailFindings, 'Blocked by post-output guardrails', correlationId, agent.agentId);
  }

  const safeContent = guardrails.redact(result.content);
  run.summary = safeContent.slice(0, 400);

  // (4) Persist an artifact for the produced output.
  const artifact: Artifact = {
    id: uuid(),
    projectId: input.projectId,
    workflowRunId: input.workflowRunId,
    agentRunId: run.id,
    kind: artifactKindFor(agent.lifecycleStage),
    title: `${agent.displayName} output`,
    content: safeContent,
    createdAt: new Date().toISOString(),
  };
  await artifactRepo().upsert(artifact);
  run.outputArtifactIds.push(artifact.id);

  run.state = 'Completed';
  run.completedAt = new Date().toISOString();
  await runRepo().upsert(run);

  await audit.record({
    actorType: 'agent',
    actor: agent.agentId,
    action: 'agent.run.complete',
    targetType: 'agentRun',
    targetId: run.id,
    correlationId,
    workflowRunId: input.workflowRunId,
    details: { mocked: result.mocked, tokenEstimate: result.tokenEstimate, artifactId: artifact.id },
  });

  return run;
}

export async function listRuns(workflowRunId?: string): Promise<AgentRun[]> {
  const all = await runRepo().getAll();
  const filtered = workflowRunId ? all.filter((r) => r.workflowRunId === workflowRunId) : all;
  return filtered.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function listArtifacts(projectId: string): Promise<Artifact[]> {
  return artifactRepo().find((a) => a.projectId === projectId);
}

async function failRun(
  run: AgentRun,
  findings: AgentRun['guardrailFindings'],
  reason: string,
  correlationId: string,
  agentId: string,
): Promise<AgentRun> {
  run.state = 'Blocked';
  run.guardrailFindings = findings;
  run.summary = reason;
  run.completedAt = new Date().toISOString();
  await runRepo().upsert(run);
  await audit.record({
    actorType: 'agent',
    actor: agentId,
    action: 'agent.run.blocked',
    targetType: 'agentRun',
    targetId: run.id,
    correlationId,
    workflowRunId: run.workflowRunId,
    details: { reason, findings },
  });
  return run;
}

function artifactKindFor(stage: LifecycleStage): Artifact['kind'] {
  switch (stage) {
    case 'plan':
      return 'requirements-summary';
    case 'design':
      return 'architecture';
    case 'build':
      return 'code-pr';
    case 'test':
      return 'test-plan';
    case 'deploy':
      return 'pipeline';
    case 'security':
      return 'security-findings';
    default:
      return 'requirements-summary';
  }
}
