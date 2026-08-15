/**
 * Approval gate service. Creates gates for a workflow run, records decisions
 * (approve / reject / request-changes / delegate), and enforces that no agent
 * stage advances when a required approval is missing. Every decision is audited
 * and recorded with previous/next state and artifact references.
 */
import { v4 as uuid } from 'uuid';
import { getRepository } from '../persistence/factory';
import {
  ApprovalDecision,
  ApprovalDecisionType,
  ApprovalGate,
  AuthUser,
  UserRole,
  WorkflowState,
} from '../models';
import { APPROVAL_GATES, assertTransition } from './workflow.service';
import { canApprove } from './rbac.service';
import * as audit from './audit.service';
import * as agents from './agents.service';

const repo = () => getRepository<ApprovalGate>('approvalGates');

/** Creates all approval gates for a workflow run, requiredRole from agent config. */
export async function createGatesForRun(
  workflowRunId: string,
  projectId: string,
): Promise<ApprovalGate[]> {
  const created: ApprovalGate[] = [];
  for (const g of APPROVAL_GATES) {
    const agent = agents.list().find((a) => a.lifecycleStage === g.lifecycleStage);
    const now = new Date().toISOString();
    const gate: ApprovalGate = {
      id: uuid(),
      workflowRunId,
      projectId,
      lifecycleStage: g.lifecycleStage,
      name: g.name,
      requiredRole: (agent?.approvalRole ?? 'admin') as UserRole,
      state: 'AwaitingApproval',
      requiresHumanApproval: agent?.requiresHumanApproval ?? true,
      decisions: [],
      artifactRefs: [],
      createdAt: now,
      updatedAt: now,
    };
    await repo().upsert(gate);
    created.push(gate);
  }
  return created;
}

export async function listForRun(workflowRunId: string): Promise<ApprovalGate[]> {
  return repo().find((g) => g.workflowRunId === workflowRunId);
}

export async function listPending(): Promise<ApprovalGate[]> {
  return (await repo().getAll()).filter((g) => g.state === 'AwaitingApproval' && g.requiresHumanApproval);
}

export async function getById(id: string): Promise<ApprovalGate | undefined> {
  return repo().getById(id);
}

/** Whether the stage's primary (entry) gate is approved.
 *  Some lifecycle stages have more than one gate (e.g. plan has Plan-and-Scope
 *  plus Backlog-Generation). An agent for a stage is gated by that stage's
 *  first gate in APPROVAL_GATES order; later gates guard downstream actions. */
export async function isStageApproved(
  workflowRunId: string,
  lifecycleStage: string,
): Promise<boolean> {
  const gates = await listForRun(workflowRunId);
  const primaryKey = APPROVAL_GATES.find((g) => g.lifecycleStage === lifecycleStage)?.name;
  const primary = gates.find((g) => g.lifecycleStage === lifecycleStage && g.name === primaryKey);
  if (!primary) return true;
  return !primary.requiresHumanApproval || primary.state === 'Approved';
}

export interface DecisionInput {
  decision: ApprovalDecisionType;
  comments?: string;
  delegatedTo?: string;
  artifactRefs?: string[];
}

const NEXT_STATE: Record<ApprovalDecisionType, WorkflowState> = {
  approve: 'Approved',
  reject: 'Rejected',
  'request-changes': 'ChangesRequested',
  delegate: 'AwaitingApproval',
};

export async function decide(
  gateId: string,
  input: DecisionInput,
  user: AuthUser,
  correlationId: string,
): Promise<ApprovalGate> {
  const gate = await repo().getById(gateId);
  if (!gate) throw Object.assign(new Error('Approval gate not found'), { status: 404 });

  // Server-side guardrail: only an authorized role may approve this gate.
  if (!canApprove(user.role, gate.requiredRole)) {
    throw Object.assign(
      new Error(`Role ${user.role} cannot act on a gate requiring ${gate.requiredRole}`),
      { status: 403 },
    );
  }

  const previousState = gate.state;
  const nextState = NEXT_STATE[input.decision];
  // delegate keeps the gate awaiting; others must be a legal transition.
  if (input.decision !== 'delegate') {
    assertTransition(previousState, nextState);
  }

  const decision: ApprovalDecision = {
    id: uuid(),
    approver: user.email,
    approverRole: user.role,
    decision: input.decision,
    comments: input.comments,
    delegatedTo: input.delegatedTo,
    timestamp: new Date().toISOString(),
    previousState,
    nextState,
    artifactRefs: input.artifactRefs ?? gate.artifactRefs,
  };

  gate.decisions.push(decision);
  gate.state = nextState;
  gate.updatedAt = decision.timestamp;
  if (input.artifactRefs) gate.artifactRefs = input.artifactRefs;
  await repo().upsert(gate);

  await audit.record({
    actorType: 'user',
    actor: user.email,
    action: `approval.${input.decision}`,
    targetType: 'approvalGate',
    targetId: gate.id,
    correlationId,
    workflowRunId: gate.workflowRunId,
    approvalGateId: gate.id,
    details: { previousState, nextState, comments: input.comments, delegatedTo: input.delegatedTo },
  });

  return gate;
}

/** Raised when an agent stage is attempted without the required approval. */
export class ApprovalRequiredError extends Error {
  status = 403;
  constructor(public lifecycleStage: string) {
    super(`Human approval required before stage "${lifecycleStage}" can run`);
    this.name = 'ApprovalRequiredError';
  }
}
