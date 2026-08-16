"""Audit service — append-only event log (mirror of audit.service.ts)."""
from typing import Dict, List, Optional

from .persistence import get_repository
from .util import new_id, now_iso


def _repo():
    return get_repository("auditLogs")


def record(
    *,
    actor_type: str,
    actor: str,
    action: str,
    target_type: str,
    target_id: str,
    correlation_id: Optional[str] = None,
    workflow_run_id: Optional[str] = None,
    approval_gate_id: Optional[str] = None,
    details: Optional[Dict] = None,
) -> Dict:
    now = now_iso()
    entry = {
        "id": new_id(),
        "day": now[:10],
        "timestamp": now,
        "actorType": actor_type,
        "actor": actor,
        "action": action,
        "targetType": target_type,
        "targetId": target_id,
        "correlationId": correlation_id,
        "workflowRunId": workflow_run_id,
        "approvalGateId": approval_gate_id,
        "details": details,
    }
    return _repo().upsert(entry)


def list_recent(limit: int = 200) -> List[Dict]:
    rows = sorted(_repo().get_all(), key=lambda r: r.get("timestamp", ""), reverse=True)
    return rows[:limit]


def list_for_workflow_run(workflow_run_id: str) -> List[Dict]:
    rows = _repo().find(lambda r: r.get("workflowRunId") == workflow_run_id)
    return sorted(rows, key=lambda r: r.get("timestamp", ""), reverse=True)
