"""Approval gate service (mirror of approval.service.ts)."""
from typing import Dict, List, Optional

from . import agents_service, audit_service
from .errors import ApiError
from .persistence import get_repository
from .rbac import can_approve
from .util import new_id, now_iso
from .workflow import APPROVAL_GATES, assert_transition

NEXT_STATE = {
    "approve": "Approved",
    "reject": "Rejected",
    "request-changes": "ChangesRequested",
    "delegate": "AwaitingApproval",
}


def _repo():
    return get_repository("approvalGates")


def create_gates_for_run(workflow_run_id: str, project_id: str) -> List[Dict]:
    created: List[Dict] = []
    for g in APPROVAL_GATES:
        agent = next((a for a in agents_service.list_agents() if a["lifecycleStage"] == g["lifecycleStage"]), None)
        now = now_iso()
        gate = {
            "id": new_id(),
            "workflowRunId": workflow_run_id,
            "projectId": project_id,
            "lifecycleStage": g["lifecycleStage"],
            "name": g["name"],
            "requiredRole": (agent or {}).get("approvalRole", "admin"),
            "state": "AwaitingApproval",
            "requiresHumanApproval": (agent or {}).get("requiresHumanApproval", True),
            "decisions": [],
            "artifactRefs": [],
            "createdAt": now,
            "updatedAt": now,
        }
        _repo().upsert(gate)
        created.append(gate)
    return created


def list_for_run(workflow_run_id: str) -> List[Dict]:
    return _repo().find(lambda g: g.get("workflowRunId") == workflow_run_id)


def list_pending() -> List[Dict]:
    return [g for g in _repo().get_all() if g.get("state") == "AwaitingApproval" and g.get("requiresHumanApproval")]


def get_by_id(gate_id: str) -> Optional[Dict]:
    return _repo().get_by_id(gate_id)


def is_stage_approved(workflow_run_id: str, lifecycle_stage: str) -> bool:
    gates = list_for_run(workflow_run_id)
    primary_name = next((g["name"] for g in APPROVAL_GATES if g["lifecycleStage"] == lifecycle_stage), None)
    primary = next(
        (g for g in gates if g.get("lifecycleStage") == lifecycle_stage and g.get("name") == primary_name),
        None,
    )
    if not primary:
        return True
    return (not primary.get("requiresHumanApproval")) or primary.get("state") == "Approved"


def is_agent_approved(workflow_run_id: str, agent: Dict) -> bool:
    gate_name = agent.get("approvalGateName")
    if not gate_name:
        return is_stage_approved(workflow_run_id, agent["lifecycleStage"])
    gate = next((item for item in list_for_run(workflow_run_id) if item.get("name") == gate_name), None)
    if not gate:
        return True
    return (not gate.get("requiresHumanApproval")) or gate.get("state") == "Approved"


def decide(gate_id: str, body: Dict, user: Dict, correlation_id: str) -> Dict:
    gate = _repo().get_by_id(gate_id)
    if not gate:
        raise ApiError(404, "Approval gate not found")

    if not can_approve(user["role"], gate["requiredRole"]):
        raise ApiError(403, f'Role {user["role"]} cannot act on a gate requiring {gate["requiredRole"]}')

    decision_type = body.get("decision")
    if decision_type not in NEXT_STATE:
        raise ApiError(400, f"Invalid decision: {decision_type}")

    previous_state = gate["state"]
    next_state = NEXT_STATE[decision_type]
    if decision_type != "delegate":
        assert_transition(previous_state, next_state)

    ts = now_iso()
    decision = {
        "id": new_id(),
        "approver": user["email"],
        "approverRole": user["role"],
        "decision": decision_type,
        "comments": body.get("comments"),
        "delegatedTo": body.get("delegatedTo"),
        "timestamp": ts,
        "previousState": previous_state,
        "nextState": next_state,
        "artifactRefs": body.get("artifactRefs") if body.get("artifactRefs") is not None else gate["artifactRefs"],
    }
    gate["decisions"].append(decision)
    gate["state"] = next_state
    gate["updatedAt"] = ts
    if body.get("artifactRefs") is not None:
        gate["artifactRefs"] = body["artifactRefs"]
    _repo().upsert(gate)

    audit_service.record(
        actor_type="user",
        actor=user["email"],
        action=f"approval.{decision_type}",
        target_type="approvalGate",
        target_id=gate["id"],
        correlation_id=correlation_id,
        workflow_run_id=gate["workflowRunId"],
        approval_gate_id=gate["id"],
        details={
            "previousState": previous_state,
            "nextState": next_state,
            "comments": body.get("comments"),
            "delegatedTo": body.get("delegatedTo"),
        },
    )
    return gate


class ApprovalRequiredError(ApiError):
    def __init__(self, lifecycle_stage: str) -> None:
        super().__init__(403, f'Human approval required before stage "{lifecycle_stage}" can run')
        self.lifecycle_stage = lifecycle_stage
