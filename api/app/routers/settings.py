from fastapi import APIRouter, Depends

from .. import settings_service
from ..models import SystemsOfRecordBody
from ..security import correlation_id, get_current_user, require

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/systems-of-record")
def get_systems_of_record(user: dict = Depends(get_current_user)):
    """Global settings every project inherits. Readable by any authenticated user so
    the New Project wizard can pre-populate its overrides."""
    return {
        "catalog": settings_service.catalog(),
        "settings": settings_service.global_settings(),
        "configDefaults": settings_service.config_defaults(),
    }


@router.put("/systems-of-record")
def update_systems_of_record(
    body: SystemsOfRecordBody,
    user: dict = Depends(require("config.manage")),
    corr: str = Depends(correlation_id),
):
    payload = {key: entry.model_dump() for key, entry in body.systemsOfRecord.items()}
    settings = settings_service.update_global(payload, user, corr)
    return {"catalog": settings_service.catalog(), "settings": settings}
