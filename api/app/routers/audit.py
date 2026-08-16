from fastapi import APIRouter, Depends

from .. import audit_service
from ..security import require

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("")
def list_audit(limit: int = 200, user: dict = Depends(require("audit.read"))):
    return audit_service.list_recent(limit)


@router.get("/run/{run_id}")
def audit_for_run(run_id: str, user: dict = Depends(require("audit.read"))):
    return audit_service.list_for_workflow_run(run_id)
