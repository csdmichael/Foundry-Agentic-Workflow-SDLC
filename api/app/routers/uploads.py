import os
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, Form, UploadFile

from .. import audit_service
from ..config import CONFIG
from ..errors import ApiError
from ..persistence import _data_root
from ..security import correlation_id, require
from ..util import new_id

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

_upload_dir = _data_root / "uploads"


@router.post("")
async def upload(
    files: List[UploadFile],
    projectId: Optional[str] = Form(default=None),
    user: dict = Depends(require("projects.create")),
    corr: str = Depends(correlation_id),
):
    if len(files) > 10:
        raise ApiError(400, "Too many files (max 10)")
    allowed = CONFIG["api"]["upload"]["allowedExtensions"]
    max_size = CONFIG["api"]["upload"]["maxFileSizeBytes"]
    _upload_dir.mkdir(parents=True, exist_ok=True)

    stored = []
    for f in files:
        ext = Path(f.filename or "").suffix.lower()
        if ext not in allowed:
            raise ApiError(400, f"File type not allowed: {ext}")
        data = await f.read()
        if len(data) > max_size:
            raise ApiError(400, f"File too large: {f.filename}")
        safe = "".join(c if c.isalnum() or c in "._-" else "_" for c in (f.filename or "file"))
        stored_name = f"{new_id()}-{safe}"
        with open(_upload_dir / stored_name, "wb") as out:
            out.write(data)
        stored.append({"name": f.filename, "storedAs": stored_name, "size": len(data)})

    audit_service.record(
        actor_type="user",
        actor=user["email"],
        action="upload.requirements",
        target_type="upload",
        target_id=projectId or "unassigned",
        correlation_id=corr,
        details={"count": len(stored)},
    )
    return {"uploaded": stored}
