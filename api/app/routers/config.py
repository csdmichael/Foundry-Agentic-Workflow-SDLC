from fastapi import APIRouter, Depends

from .. import projects_service
from ..config import CONFIG
from ..rbac import capabilities_for
from ..security import get_current_user, require

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("")
def get_config(user: dict = Depends(require("config.manage"))):
    return {
        "apim": CONFIG["apim"],
        "integrations": CONFIG["integrations"],
        "guardrails": CONFIG["guardrails"],
        "persistence": {"provider": CONFIG["persistence"]["provider"]},
        "agentsDefaults": CONFIG["agents"].get("defaults"),
    }


@router.get("/capabilities")
def capabilities(user: dict = Depends(get_current_user)):
    return {"role": user["role"], "capabilities": capabilities_for(user["role"])}


@router.get("/workflow-runs")
def workflow_runs(user: dict = Depends(require("projects.read"))):
    return projects_service.list_runs()
