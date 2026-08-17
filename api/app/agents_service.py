"""Agent definitions service (mirror of agents.service.ts)."""
from typing import Dict, List, Optional

from .config import CONFIG
from .errors import ApiError


def _with_defaults(raw: Dict) -> Dict:
    d = CONFIG["agents"].get("defaults", {})
    return {
        "agentId": raw["agentId"],
        "displayName": raw["displayName"],
        "lifecycleStage": raw["lifecycleStage"],
        "modelDeploymentName": raw["modelDeploymentName"],
        "modelProvider": raw.get("modelProvider", d.get("modelProvider")),
        "apimRoute": raw["apimRoute"],
        "toolsAllowed": raw.get("toolsAllowed", []),
        "mcpServersAllowed": raw.get("mcpServersAllowed", []),
        "maxInputTokens": raw.get("maxInputTokens", d.get("maxInputTokens")),
        "maxOutputTokens": raw.get("maxOutputTokens", d.get("maxOutputTokens")),
        "temperature": raw.get("temperature", d.get("temperature")),
        "requiresHumanApproval": raw.get("requiresHumanApproval", True),
        "approvalGateName": raw.get("approvalGateName"),
        "approvalRole": raw.get("approvalRole", "admin"),
        "guardrails": raw.get("guardrails", []),
        "enabled": raw.get("enabled", True),
    }


# In-memory overrides layered over file config (persisted separately in prod).
_overrides: Dict[str, Dict] = {}


def list_agents() -> List[Dict]:
    return [_overrides.get(a["agentId"], _with_defaults(a)) for a in CONFIG["agents"]["agents"]]


def get(agent_id: str) -> Optional[Dict]:
    return next((a for a in list_agents() if a["agentId"] == agent_id), None)


def update(agent_id: str, patch: Dict) -> Dict:
    current = get(agent_id)
    if not current:
        raise ApiError(404, f"Unknown agent: {agent_id}")
    nxt = {**current, **patch, "agentId": agent_id}
    _overrides[agent_id] = nxt
    return nxt
