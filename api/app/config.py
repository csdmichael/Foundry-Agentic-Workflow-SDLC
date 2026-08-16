"""Central configuration loader (API tier), mirroring api/src/config/index.ts.

Reads the same non-secret JSON config files (single source of truth) and
overlays secrets/flags from environment variables. Business logic imports from
here instead of hardcoding endpoints, keys, tenant IDs, or routes.
"""
import json
import os
from pathlib import Path

API_DIR = Path(__file__).resolve().parents[1]
SRC = API_DIR / "src"


def _read_json(path: Path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def env(name: str, fallback: str = "") -> str:
    raw = (os.getenv(name) or "").strip()
    return raw if raw else fallback


def env_flag(name: str) -> bool:
    return env(name) == "1"


api_config = _read_json(SRC / "config" / "api.config.json")
apim_config = _read_json(SRC / "config" / "apim.config.json")
integrations_config = _read_json(SRC / "config" / "integrations.config.json")
guardrails_config = _read_json(SRC / "config" / "guardrails.config.json")
persistence_config = _read_json(SRC / "persistence" / "config" / "persistence.config.json")
agents_config = _read_json(SRC / "agents" / "config" / "agents.config.json")
seed_users = _read_json(SRC / "config" / "seed-users.json")["seedUsers"]

# Allow deployments/tests to redirect the local file store.
persistence_config["file"]["dataRoot"] = env(
    "PERSIST_FILE_DATA_ROOT", persistence_config["file"]["dataRoot"]
)

CONFIG = {
    "api": api_config,
    "apim": apim_config,
    "integrations": integrations_config,
    "guardrails": guardrails_config,
    "persistence": persistence_config,
    "agents": agents_config,
    "seedUsers": seed_users,
    "secrets": {
        "entraTenantId": env("AUTH_ENTRA_TENANT_ID"),
        "entraUiClientId": env("AUTH_ENTRA_UI_CLIENT_ID"),
        "entraApiClientId": env("AUTH_ENTRA_API_CLIENT_ID"),
        "entraApiAppIdUri": env("AUTH_ENTRA_API_APP_ID_URI"),
        "jwtSigningKey": env("AUTH_JWT_SIGNING_KEY", "dev-insecure-signing-key-change-me"),
        "acsConnectionString": env("AUTH_ACS_CONNECTION_STRING"),
        "acsSenderAddress": env("AUTH_ACS_SENDER_ADDRESS"),
        "apimSubscriptionKey": env("APIM_SUBSCRIPTION_KEY"),
        "adoPat": env("ADO_PAT"),
        "gitHubPat": env("GITHUB_PAT"),
        "cosmosConnectionString": env("PERSIST_COSMOS_CONNECTION_STRING"),
        "cosmosEndpoint": env("PERSIST_COSMOS_ENDPOINT"),
        "cosmosDatabase": env("PERSIST_COSMOS_DATABASE"),
    },
    "flags": {
        "otpDevBypass": env_flag("AUTH_OTP_DEV_BYPASS"),
        "allowAnonymous": env_flag("AUTH_ALLOW_ANONYMOUS"),
        "foundryAllowDirect": env_flag("FOUNDRY_ALLOW_DIRECT"),
        "nodeEnv": env("NODE_ENV", "development"),
    },
}


def entra_authority() -> str:
    tid = CONFIG["secrets"]["entraTenantId"]
    if not tid:
        return ""
    return f'{CONFIG["api"]["auth"]["internal"]["authorityBase"]}/{tid}'


def entra_jwks_uri() -> str:
    tid = CONFIG["secrets"]["entraTenantId"]
    if not tid:
        return ""
    return f'{CONFIG["api"]["auth"]["internal"]["authorityBase"]}/{tid}/discovery/v2.0/keys'
