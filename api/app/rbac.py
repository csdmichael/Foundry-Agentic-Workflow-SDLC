"""Role-based access control policy (mirror of api/src/services/rbac.service.ts)."""
from typing import Dict, List

ALL_ROLES = ["business_user", "it_user", "admin", "app_owner"]

ROLE_CAPABILITIES: Dict[str, List[str]] = {
    "business_user": [
        "projects.read",
        "projects.create",
        "approvals.business",
        "agents.read",
        "audit.read",
    ],
    "it_user": [
        "projects.read",
        "approvals.technical",
        "agents.read",
        "audit.read",
    ],
    "admin": [
        "projects.read",
        "projects.create",
        "projects.manage",
        "approvals.business",
        "approvals.technical",
        "approvals.admin",
        "agents.read",
        "agents.configure",
        "agents.run",
        "config.manage",
        "audit.read",
        "users.read",
    ],
    "app_owner": [
        "projects.read",
        "projects.create",
        "projects.manage",
        "approvals.business",
        "approvals.technical",
        "approvals.admin",
        "agents.read",
        "agents.configure",
        "agents.run",
        "config.manage",
        "audit.read",
        "users.read",
        "users.manage",
    ],
    # Guest is read-only and is NOT assignable via user management (not in ALL_ROLES).
    "guest": [
        "projects.read",
        "agents.read",
        "audit.read",
    ],
}


def has_capability(role: str, capability: str) -> bool:
    return capability in ROLE_CAPABILITIES.get(role, [])


def can_approve(role: str, required_role: str) -> bool:
    if role in ("app_owner", "admin"):
        return True
    return role == required_role


def capabilities_for(role: str) -> List[str]:
    return list(ROLE_CAPABILITIES.get(role, []))
