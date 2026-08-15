/**
 * Verifies the core human-in-the-loop guarantee: an agent that requires
 * approval cannot run until its stage gate is approved, and a mock Foundry run
 * completes once approval is granted. Uses an isolated temp file store.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AuthUser } from '../models';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-sdlc-'));
process.env.PERSIST_FILE_DATA_ROOT = tmpRoot;
process.env.AUTH_ALLOW_ANONYMOUS = '0';

// Import after env is set so the config module picks up the temp data root.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const projects = require('../services/projects.service');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const approvals = require('../services/approval.service');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const orchestrator = require('../services/agentOrchestrator.service');

const owner: AuthUser = {
  sub: 'u1',
  email: 'owner@example.com',
  name: 'Owner',
  provider: 'email-otp',
  isInternal: false,
  role: 'app_owner',
};

const businessUser: AuthUser = {
  sub: 'u2',
  email: 'biz@example.com',
  name: 'Biz',
  provider: 'email-otp',
  isInternal: false,
  role: 'business_user',
};

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('approval gate enforcement', () => {
  it('blocks a requires-approval agent until its stage gate is approved', async () => {
    const project = await projects.create(
      {
        name: 'Test Project',
        description: 'd',
        businessOwner: 'a',
        itOwner: 'b',
        sources: [],
        adoOrganization: 'org',
        adoProject: 'proj',
        gitHubRepo: 'repo',
        targetEnvironment: 'Dev',
        selectedAgentIds: ['requirements-agent'],
      },
      owner,
      'corr-1',
    );

    const run = await projects.submit(project.id, owner, 'corr-1');

    // Requirements agent requires approval; the plan gate is AwaitingApproval.
    await expect(
      orchestrator.runAgent(
        { workflowRunId: run.id, projectId: project.id, agentId: 'requirements-agent', prompt: 'go' },
        owner,
        'corr-1',
      ),
    ).rejects.toThrow(/approval required/i);

    // A business user approves the Plan and Scope gate.
    const gates = await approvals.listForRun(run.id);
    const planGate = gates.find((g: any) => g.lifecycleStage === 'plan' && g.name.includes('Plan'));
    await approvals.decide(planGate.id, { decision: 'approve' }, businessUser, 'corr-1');

    // Now the agent runs and completes (mock Foundry response).
    const agentRun = await orchestrator.runAgent(
      { workflowRunId: run.id, projectId: project.id, agentId: 'requirements-agent', prompt: 'go' },
      owner,
      'corr-1',
    );
    expect(agentRun.state).toBe('Completed');
    expect(agentRun.outputArtifactIds.length).toBe(1);
  });

  it('prevents an unauthorized role from approving a technical gate', async () => {
    const project = await projects.create(
      {
        name: 'Test Project 2',
        description: 'd',
        businessOwner: 'a',
        itOwner: 'b',
        sources: [],
        adoOrganization: 'org',
        adoProject: 'proj',
        gitHubRepo: 'repo',
        targetEnvironment: 'Dev',
        selectedAgentIds: [],
      },
      owner,
      'corr-2',
    );
    const run = await projects.submit(project.id, owner, 'corr-2');
    const gates = await approvals.listForRun(run.id);
    const designGate = gates.find((g: any) => g.lifecycleStage === 'design');

    await expect(
      approvals.decide(designGate.id, { decision: 'approve' }, businessUser, 'corr-2'),
    ).rejects.toThrow(/cannot act on a gate/i);
  });
});
