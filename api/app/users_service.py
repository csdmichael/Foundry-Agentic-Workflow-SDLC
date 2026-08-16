"""User directory service (mirror of users.service.ts)."""
from typing import Dict, List, Optional

from .config import CONFIG
from .persistence import get_repository
from .rbac import ALL_ROLES
from .util import new_id, now_iso


def _repo():
    return get_repository("users")


def _method_for(provider: str) -> str:
    return "OTP" if provider == "email-otp" else "Entra ID"


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def ensure_seed_users() -> None:
    for seed in CONFIG["seedUsers"]:
        email = _normalize_email(seed["email"])
        if get_by_email(email):
            continue
        now = now_iso()
        _repo().upsert(
            {
                "id": new_id(),
                "email": email,
                "name": seed["name"],
                "role": seed["role"],
                "provider": seed["provider"],
                "authenticationMethod": _method_for(seed["provider"]),
                "createdAt": now,
                "updatedAt": now,
            }
        )


def get_by_email(email: str) -> Optional[Dict]:
    target = _normalize_email(email)
    rows = _repo().find(lambda u: u.get("email") == target)
    return rows[0] if rows else None


def get_by_id(user_id: str) -> Optional[Dict]:
    return _repo().get_by_id(user_id)


def list_users() -> List[Dict]:
    return sorted(_repo().get_all(), key=lambda u: u.get("email", ""))


def create_or_update(
    *, email: str, name: str, role: str, provider: str, disabled: Optional[bool] = None
) -> Dict:
    if role not in ALL_ROLES:
        from .errors import ApiError

        raise ApiError(400, f"Invalid role: {role}")
    norm = _normalize_email(email)
    existing = get_by_email(norm)
    now = now_iso()
    user = {
        "id": existing["id"] if existing else new_id(),
        "email": norm,
        "name": name,
        "role": role,
        "provider": provider,
        "authenticationMethod": _method_for(provider),
        "disabled": disabled if disabled is not None else (existing.get("disabled") if existing else False),
        "createdAt": existing["createdAt"] if existing else now,
        "updatedAt": now,
    }
    return _repo().upsert(user)


def remove(user_id: str) -> bool:
    return _repo().delete(user_id)


def resolve_for_login(email: str, name: str, provider: str) -> Dict:
    existing = get_by_email(email)
    if existing:
        return existing
    return create_or_update(email=email, name=name, role="business_user", provider=provider)
