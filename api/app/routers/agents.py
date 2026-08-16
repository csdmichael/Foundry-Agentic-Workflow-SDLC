from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Depends

from .. import agents_service, audit_service, orchestrator
from ..security import correlation_id, require

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("")
def list_agents(user: dict = Depends(require("agents.read"))):
    return agents_service.list_agents()


@router.get("/runs")
def list_runs(workflowRunId: Optional[str] = None, user: dict = Depends(require("agents.read"))):
    return orchestrator.list_runs(workflowRunId)


@router.patch("/{agent_id}")
def update_agent(agent_id: str, patch: Dict[str, Any] = Body(...), user: dict = Depends(require("agents.configure")), corr: str = Depends(correlation_id)):
    updated = agents_service.update(agent_id, patch)
    audit_service.record(
        actor_type="user",
        actor=user["email"],
        action="agent.configure",
        target_type="agent",
        target_id=agent_id,
        correlation_id=corr,
        details=patch,
    )
    return updated
