/**
 * Workflow state machine. Central authority for allowed state transitions and
 * the ordered lifecycle stages. Both the API and UI enforce these rules; the
 * API is the source of truth so bypassing the UI cannot bypass the machine.
 */
import { LifecycleStage, WorkflowState } from '../models';

export const LIFECYCLE_ORDER: LifecycleStage[] = [
  'plan',
  'design',
  'build',
  'test',
  'deploy',
  'security',
  'operate',
  'improve',
];

/** Human-in-the-loop approval gates, in workflow order. */
export const APPROVAL_GATES: {
  key: string;
  name: string;
  lifecycleStage: LifecycleStage;
}[] = [
  { key: 'plan-scope', name: 'Plan and Scope Approval', lifecycleStage: 'plan' },
  { key: 'architecture-design', name: 'Architecture and Design Approval', lifecycleStage: 'design' },
  { key: 'backlog-generation', name: 'Backlog Generation Approval', lifecycleStage: 'plan' },
  { key: 'code-generation', name: 'Code Generation Approval', lifecycleStage: 'build' },
  { key: 'pull-request', name: 'Pull Request Review Approval', lifecycleStage: 'build' },
  { key: 'security-review', name: 'Security Review Approval', lifecycleStage: 'security' },
  { key: 'test-acceptance', name: 'Test Acceptance Approval', lifecycleStage: 'test' },
  { key: 'release-deployment', name: 'Release and Deployment Approval', lifecycleStage: 'deploy' },
  { key: 'operate-improve', name: 'Operate and Improve Approval', lifecycleStage: 'improve' },
];

const TRANSITIONS: Record<WorkflowState, WorkflowState[]> = {
  Draft: ['Submitted', 'Archived'],
  Submitted: ['AwaitingApproval', 'Running', 'Archived'],
  AwaitingApproval: ['Approved', 'Rejected', 'ChangesRequested', 'Blocked'],
  Approved: ['Running', 'Completed', 'Archived'],
  Rejected: ['Draft', 'Archived'],
  ChangesRequested: ['Draft', 'Submitted', 'Archived'],
  Running: ['Completed', 'Failed', 'Blocked', 'AwaitingApproval'],
  Completed: ['Archived', 'Submitted'],
  Failed: ['Draft', 'Submitted', 'Archived'],
  Blocked: ['AwaitingApproval', 'Draft', 'Archived'],
  Archived: [],
};

export function canTransition(from: WorkflowState, to: WorkflowState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: WorkflowState, to: WorkflowState): void {
  if (!canTransition(from, to)) {
    throw new WorkflowTransitionError(from, to);
  }
}

export function nextStage(current: LifecycleStage): LifecycleStage | undefined {
  const idx = LIFECYCLE_ORDER.indexOf(current);
  if (idx < 0 || idx === LIFECYCLE_ORDER.length - 1) return undefined;
  return LIFECYCLE_ORDER[idx + 1];
}

export class WorkflowTransitionError extends Error {
  status = 409;
  constructor(public from: WorkflowState, public to: WorkflowState) {
    super(`Illegal workflow transition: ${from} -> ${to}`);
    this.name = 'WorkflowTransitionError';
  }
}
