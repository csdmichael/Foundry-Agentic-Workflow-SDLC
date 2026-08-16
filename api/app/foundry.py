"""APIM -> Foundry gateway client (mirror of apimFoundry.service.ts).

All Foundry calls route through APIM. Without an APIM subscription key a
deterministic mock completion is returned so the workflow runs end-to-end with
no cloud credentials.
"""
import json
import math
from typing import Dict

import httpx

from .config import CONFIG


def _estimate_tokens(text: str) -> int:
    return math.ceil(len(text) / 4)


def _mock_completion(agent: Dict, prompt: str) -> str:
    snippet = " ".join(prompt[:120].split())
    return (
        f'[MOCK {agent["displayName"]} @ {agent["modelDeploymentName"]}] '
        f'Processed request for stage "{agent["lifecycleStage"]}". Input summary: "{snippet}...". '
        f"This is a deterministic mock response (no APIM credentials configured)."
    )


def _log_call(ctx: Dict, token_estimate: int, route: str) -> None:
    record: Dict[str, object] = {}
    for field in CONFIG["apim"]["logging"]["capturedFields"]:
        record[field] = ctx.get(field, token_estimate if field == "tokenEstimate" else None)
    record["route"] = route
    print("[foundry-call]", json.dumps(record))


def call_foundry(agent: Dict, prompt: str, ctx: Dict) -> Dict:
    gateway = CONFIG["apim"]["gateway"]
    route = agent["apimRoute"]
    token_estimate = _estimate_tokens(prompt) + 200

    _log_call(ctx, token_estimate, route)

    has_apim_key = bool(CONFIG["secrets"]["apimSubscriptionKey"])
    direct_allowed = CONFIG["flags"]["foundryAllowDirect"] and CONFIG["apim"]["foundry"]["allowDirectInLocalDevOnly"]

    if not has_apim_key and not direct_allowed:
        return {
            "content": _mock_completion(agent, prompt),
            "tokenEstimate": token_estimate,
            "route": route,
            "viaApim": True,
            "mocked": True,
        }

    url = (
        f'{CONFIG["apim"]["foundry"]["projectEndpoint"]}/{route}'
        if direct_allowed and not has_apim_key
        else f'{gateway["baseUrl"]}/{route}'
    )
    headers = {"Content-Type": "application/json", gateway["correlationIdHeader"]: ctx["correlationId"]}
    if has_apim_key:
        headers[gateway["subscriptionKeyHeader"]] = CONFIG["secrets"]["apimSubscriptionKey"]

    body = {
        "model": agent["modelDeploymentName"],
        "temperature": agent["temperature"],
        "max_tokens": agent["maxOutputTokens"],
        "messages": [{"role": "user", "content": prompt}],
    }
    timeout = gateway["timeoutMs"] / 1000
    resp = httpx.post(url, headers=headers, content=json.dumps(body), timeout=timeout)
    if resp.status_code >= 400:
        from .errors import ApiError

        raise ApiError(502, f"Foundry call failed: {resp.status_code}")
    data = resp.json()
    content = (((data.get("choices") or [{}])[0].get("message") or {}).get("content")) or ""
    return {
        "content": content,
        "tokenEstimate": token_estimate,
        "route": route,
        "viaApim": (not direct_allowed) or has_apim_key,
        "mocked": False,
    }
