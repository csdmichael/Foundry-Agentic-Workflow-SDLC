from fastapi import APIRouter, Depends

from .. import audit_service, users_service
from ..models import UserUpsertBody
from ..security import correlation_id, require

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("")
def list_users(user: dict = Depends(require("users.read"))):
    return users_service.list_users()


@router.post("")
def upsert_user(body: UserUpsertBody, user: dict = Depends(require("users.manage")), corr: str = Depends(correlation_id)):
    created = users_service.create_or_update(
        email=body.email, name=body.name, role=body.role, provider=body.provider, disabled=bool(body.disabled)
    )
    audit_service.record(
        actor_type="user",
        actor=user["email"],
        action="user.upsert",
        target_type="user",
        target_id=created["id"],
        correlation_id=corr,
        details={"role": created["role"], "provider": created["provider"]},
    )
    return created


@router.delete("/{user_id}")
def delete_user(user_id: str, user: dict = Depends(require("users.manage")), corr: str = Depends(correlation_id)):
    removed = users_service.remove(user_id)
    audit_service.record(
        actor_type="user",
        actor=user["email"],
        action="user.delete",
        target_type="user",
        target_id=user_id,
        correlation_id=corr,
    )
    return {"removed": removed}
