from fastapi import APIRouter, Depends

from .. import approvals
from ..models import ApprovalDecisionBody
from ..security import correlation_id, get_current_user, require

router = APIRouter(prefix="/api/approvals", tags=["approvals"])


@router.get("/pending")
def pending(user: dict = Depends(require("projects.read"))):
    return approvals.list_pending()


@router.get("/run/{run_id}")
def for_run(run_id: str, user: dict = Depends(require("projects.read"))):
    return approvals.list_for_run(run_id)


@router.post("/{gate_id}/decision")
def decide(gate_id: str, body: ApprovalDecisionBody, user: dict = Depends(get_current_user), corr: str = Depends(correlation_id)):
    return approvals.decide(gate_id, body.model_dump(), user, corr)
