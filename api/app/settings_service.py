"""System of Record settings — global defaults with per-project overrides.

Three layers, resolved in order:
1. ``systems-of-record.config.json`` defaults (config tier, non-secret).
2. The admin-maintained global override, persisted under the ``settings``
   collection (id ``global``).
3. The project-level override stored on the project record.

Every write is validated against the config catalog so a caller cannot inject
unknown keys, unsupported providers, or non-HTTPS URLs.
"""
from typing import Dict, List, Optional
from urllib.parse import urlparse

from . import audit_service
from .config import CONFIG
from .errors import ApiError
from .persistence import get_repository
from .util import now_iso

GLOBAL_SETTINGS_ID = "global"
_MAX_URL_LENGTH = 2048
_MAX_PROJECT_LENGTH = 200


def _repo():
    return get_repository("settings")


def catalog() -> List[Dict]:
    return CONFIG["systemsOfRecord"]["catalog"]


def _catalog_by_key() -> Dict[str, Dict]:
    return {entry["key"]: entry for entry in catalog()}


def config_defaults() -> Dict[str, Dict]:
    defaults = CONFIG["systemsOfRecord"]["defaults"]
    return {key: dict(defaults.get(key, {})) for key in _catalog_by_key()}


def _validate_entry(key: str, entry: Dict, catalog_entry: Dict) -> Dict:
    if not isinstance(entry, dict):
        raise ApiError(400, f"System of record '{key}' must be an object")

    provider = str(entry.get("provider", "")).strip()
    if provider not in catalog_entry["allowedProviders"]:
        allowed = ", ".join(catalog_entry["allowedProviders"])
        raise ApiError(400, f"System of record '{key}' provider must be one of: {allowed}")

    url = str(entry.get("url", "")).strip()
    if len(url) > _MAX_URL_LENGTH:
        raise ApiError(400, f"System of record '{key}' URL is too long")
    if url:
        parsed = urlparse(url)
        # HTTPS-only: these values are rendered as links and used to build connector calls.
        if parsed.scheme != "https" or not parsed.netloc:
            raise ApiError(400, f"System of record '{key}' URL must be an absolute https:// URL")

    project = str(entry.get("project", "")).strip()
    if len(project) > _MAX_PROJECT_LENGTH:
        raise ApiError(400, f"System of record '{key}' project name is too long")
    if any(ord(char) < 32 for char in project):
        raise ApiError(400, f"System of record '{key}' project name contains invalid characters")

    return {"provider": provider, "url": url, "project": project}


def normalize(raw: Optional[Dict], *, partial: bool) -> Dict[str, Dict]:
    """Validate a settings map. ``partial=True`` allows a subset of keys (project overrides)."""
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        raise ApiError(400, "systemsOfRecord must be an object")

    by_key = _catalog_by_key()
    unknown = set(raw) - set(by_key)
    if unknown:
        raise ApiError(400, f"Unknown system of record key(s): {', '.join(sorted(unknown))}")
    if not partial:
        missing = set(by_key) - set(raw)
        if missing:
            raise ApiError(400, f"Missing system of record key(s): {', '.join(sorted(missing))}")

    return {key: _validate_entry(key, raw[key], by_key[key]) for key in raw}


def _stored_global() -> Dict[str, Dict]:
    record = _repo().get_by_id(GLOBAL_SETTINGS_ID)
    stored = record.get("systemsOfRecord") if record else None
    return stored if isinstance(stored, dict) else {}


def global_settings() -> Dict[str, Dict]:
    """Config defaults overlaid with the admin-saved global override."""
    resolved = config_defaults()
    for key, entry in _stored_global().items():
        if key in resolved and isinstance(entry, dict):
            resolved[key] = {**resolved[key], **entry}
    return resolved


def update_global(raw: Optional[Dict], user: Dict, correlation_id: str) -> Dict[str, Dict]:
    settings = normalize(raw, partial=False)
    _repo().upsert(
        {
            "id": GLOBAL_SETTINGS_ID,
            "systemsOfRecord": settings,
            "updatedBy": user["email"],
            "updatedAt": now_iso(),
        }
    )
    audit_service.record(
        actor_type="user",
        actor=user["email"],
        action="settings.systems-of-record.update",
        target_type="settings",
        target_id=GLOBAL_SETTINGS_ID,
        correlation_id=correlation_id,
        details={"keys": sorted(settings)},
    )
    return global_settings()


def effective_for_project(project: Optional[Dict]) -> Dict[str, Dict]:
    """Global settings overlaid with this project's overrides."""
    resolved = global_settings()
    overrides = (project or {}).get("systemsOfRecord")
    if isinstance(overrides, dict):
        for key, entry in overrides.items():
            if key in resolved and isinstance(entry, dict):
                resolved[key] = {**resolved[key], **entry}
    return resolved


def overridden_keys(project: Optional[Dict]) -> List[str]:
    overrides = (project or {}).get("systemsOfRecord")
    return sorted(overrides) if isinstance(overrides, dict) else []
