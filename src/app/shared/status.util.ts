import { WorkflowState } from '../models/models';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'running';

const TONES: Record<string, StatusTone> = {
  Approved: 'success',
  Completed: 'success',
  Rejected: 'danger',
  Failed: 'danger',
  Blocked: 'danger',
  AwaitingApproval: 'warning',
  ChangesRequested: 'warning',
  Running: 'running',
  Submitted: 'info',
  Draft: 'neutral',
  Archived: 'neutral',
};

/** Maps a workflow state to a `.pill--*` tone. Shared so every screen reads alike. */
export function statusTone(state: WorkflowState | string): StatusTone {
  return TONES[state] ?? 'neutral';
}

export function statusClass(state: WorkflowState | string): string {
  return `pill pill--${statusTone(state)}`;
}

/** Splits a PascalCase workflow state into readable words: AwaitingApproval -> Awaiting Approval. */
export function statusLabel(state: WorkflowState | string): string {
  return String(state).replace(/([a-z])([A-Z])/g, '$1 $2');
}
