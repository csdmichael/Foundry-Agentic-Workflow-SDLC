"""Workflow state machine (mirror of workflow.service.ts)."""
from typing import Dict, List, Optional

from .errors import ApiError

LIFECYCLE_ORDER = ["plan", "design", "build", "test", "deploy", "security", "operate", "improve"]

APPROVAL_GATES: List[Dict[str, str]] = [
    {"key": "plan-scope", "name": "Plan and Scope Approval", "lifecycleStage": "plan"},
    {"key": "architecture-design", "name": "Architecture and Design Approval", "lifecycleStage": "design"},
    {"key": "backlog-generation", "name": "Backlog Generation Approval", "lifecycleStage": "plan"},
    {"key": "code-generation", "name": "Code Generation Approval", "lifecycleStage": "build"},
    {"key": "pull-request", "name": "Pull Request Review Approval", "lifecycleStage": "build"},
    {"key": "security-review", "name": "Security Review Approval", "lifecycleStage": "security"},
    {"key": "test-acceptance", "name": "Test Acceptance Approval", "lifecycleStage": "test"},
    {"key": "release-deployment", "name": "Release and Deployment Approval", "lifecycleStage": "deploy"},
    {"key": "operate-improve", "name": "Operate and Improve Approval", "lifecycleStage": "improve"},
]

TRANSITIONS: Dict[str, List[str]] = {
    "Draft": ["Submitted", "Archived"],
    "Submitted": ["AwaitingApproval", "Running", "Archived"],
    "AwaitingApproval": ["Approved", "Rejected", "ChangesRequested", "Blocked"],
    "Approved": ["Running", "Completed", "Archived"],
    "Rejected": ["Draft", "Archived"],
    "ChangesRequested": ["Draft", "Submitted", "Archived"],
    "Running": ["Completed", "Failed", "Blocked", "AwaitingApproval"],
    "Completed": ["Archived", "Submitted"],
    "Failed": ["Draft", "Submitted", "Archived"],
    "Blocked": ["AwaitingApproval", "Draft", "Archived"],
    "Archived": [],
}


def can_transition(frm: str, to: str) -> bool:
    return to in TRANSITIONS.get(frm, [])


def assert_transition(frm: str, to: str) -> None:
    if not can_transition(frm, to):
        raise ApiError(409, f"Illegal workflow transition: {frm} -> {to}")


def next_stage(current: str) -> Optional[str]:
    try:
        idx = LIFECYCLE_ORDER.index(current)
    except ValueError:
        return None
    if idx == len(LIFECYCLE_ORDER) - 1:
        return None
    return LIFECYCLE_ORDER[idx + 1]
