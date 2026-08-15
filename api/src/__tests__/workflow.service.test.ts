import {
  canTransition,
  assertTransition,
  nextStage,
  WorkflowTransitionError,
  LIFECYCLE_ORDER,
  APPROVAL_GATES,
} from '../services/workflow.service';

describe('workflow state machine', () => {
  it('allows Draft -> Submitted', () => {
    expect(canTransition('Draft', 'Submitted')).toBe(true);
  });

  it('rejects Draft -> Approved', () => {
    expect(canTransition('Draft', 'Approved')).toBe(false);
  });

  it('allows AwaitingApproval -> Approved / Rejected / ChangesRequested', () => {
    expect(canTransition('AwaitingApproval', 'Approved')).toBe(true);
    expect(canTransition('AwaitingApproval', 'Rejected')).toBe(true);
    expect(canTransition('AwaitingApproval', 'ChangesRequested')).toBe(true);
  });

  it('treats Archived as terminal', () => {
    expect(canTransition('Archived', 'Draft')).toBe(false);
  });

  it('assertTransition throws WorkflowTransitionError on illegal move', () => {
    expect(() => assertTransition('Completed', 'Running')).toThrow(WorkflowTransitionError);
  });

  it('nextStage walks the lifecycle in order and stops at the end', () => {
    expect(nextStage('plan')).toBe('design');
    expect(nextStage(LIFECYCLE_ORDER[LIFECYCLE_ORDER.length - 1])).toBeUndefined();
  });

  it('defines the nine required approval gates', () => {
    expect(APPROVAL_GATES).toHaveLength(9);
    expect(APPROVAL_GATES.map((g) => g.key)).toContain('release-deployment');
  });
});
