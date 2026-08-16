"""Agent orchestrator (mirror of agentOrchestrator.service.ts).

Enforces the human-in-the-loop contract: an agent that requires approval cannot
run until its stage gate is approved (server-side, non-bypassable). Pre/post
guardrails screen the prompt and completion; all Foundry calls go via APIM.
"""
from typing import Dict, List, Optional

from . import agents_service, approvals, audit_service, guardrails
from .errors import ApiError
from .foundry import call_foundry
from .persistence import get_repository
from .util import new_id, now_iso


def _run_repo():
    return get_repository("agentRuns")


def _artifact_repo():
    return get_repository("artifacts")


_ARTIFACT_KIND = {
    "plan": "requirements-summary",
    "design": "architecture",
    "build": "code-pr",
    "test": "test-plan",
    "deploy": "pipeline",
    "security": "security-findings",
}


def _artifact_kind_for(stage: str) -> str:
    return _ARTIFACT_KIND.get(stage, "requirements-summary")


def run_agent(inp: Dict, user: Dict, correlation_id: str) -> Dict:
    agent = agents_service.get(inp["agentId"])
    if not agent:
        raise ApiError(404, f'Unknown agent: {inp["agentId"]}')
    if not agent["enabled"]:
        raise ApiError(409, f'Agent disabled: {inp["agentId"]}')

    # (1) Human-in-the-loop enforcement — the hard gate.
    if agent["requiresHumanApproval"]:
        if not approvals.is_stage_approved(inp["workflowRunId"], agent["lifecycleStage"]):
            audit_service.record(
                actor_type="system",
                actor="orchestrator",
                action="agent.blocked.approval-missing",
                target_type="agent",
                target_id=agent["agentId"],
                correlation_id=correlation_id,
                workflow_run_id=inp["workflowRunId"],
                details={"lifecycleStage": agent["lifecycleStage"]},
            )
            raise approvals.ApprovalRequiredError(agent["lifecycleStage"])

    now = now_iso()
    run = {
        "id": new_id(),
        "workflowRunId": inp["workflowRunId"],
        "projectId": inp["projectId"],
        "agentId": agent["agentId"],
        "lifecycleStage": agent["lifecycleStage"],
        "modelName": agent["modelDeploymentName"],
        "apimRoute": agent["apimRoute"],
        "promptId": new_id(),
        "tokenEstimate": 0,
        "correlationId": correlation_id,
        "state": "Running",
        "toolCalls": [],
        "outputArtifactIds": [],
        "guardrailFindings": [],
        "startedAt": now,
        "startedBy": user["email"],
    }

    audit_service.record(
        actor_type="agent",
        actor=agent["agentId"],
        action="agent.run.start",
        target_type="workflowRun",
        target_id=inp["workflowRunId"],
        correlation_id=correlation_id,
        workflow_run_id=inp["workflowRunId"],
        details={"modelName": agent["modelDeploymentName"], "apimRoute": agent["apimRoute"]},
    )

    prompt = inp["prompt"]

    # (2a) Pre-output guardrails.
    pre = guardrails.evaluate(prompt, "pre")
    if guardrails.is_blocked(pre):
        return _fail_run(run, pre, "Blocked by pre-output guardrails", correlation_id, agent["agentId"])

    # (3) Foundry call via APIM.
    result = call_foundry(
        agent,
        prompt,
        {
            "promptId": run["promptId"],
            "agentId": agent["agentId"],
            "modelName": agent["modelDeploymentName"],
            "projectId": inp["projectId"],
            "userId": user["email"],
            "workflowRunId": inp["workflowRunId"],
            "correlationId": correlation_id,
        },
    )
    run["tokenEstimate"] = result["tokenEstimate"]

    # (2b) Post-output guardrails.
    post = guardrails.evaluate(result["content"], "post")
    run["guardrailFindings"] = pre + post
    if guardrails.is_blocked(post):
        return _fail_run(run, run["guardrailFindings"], "Blocked by post-output guardrails", correlation_id, agent["agentId"])

    safe_content = guardrails.redact(result["content"])
    run["summary"] = safe_content[:400]

    artifact = {
        "id": new_id(),
        "projectId": inp["projectId"],
        "workflowRunId": inp["workflowRunId"],
        "agentRunId": run["id"],
        "kind": _artifact_kind_for(agent["lifecycleStage"]),
        "title": f'{agent["displayName"]} output',
        "content": safe_content,
        "createdAt": now_iso(),
    }
    _artifact_repo().upsert(artifact)
    run["outputArtifactIds"].append(artifact["id"])

    run["state"] = "Completed"
    run["completedAt"] = now_iso()
    _run_repo().upsert(run)

    audit_service.record(
        actor_type="agent",
        actor=agent["agentId"],
        action="agent.run.complete",
        target_type="agentRun",
        target_id=run["id"],
        correlation_id=correlation_id,
        workflow_run_id=inp["workflowRunId"],
        details={"mocked": result["mocked"], "tokenEstimate": result["tokenEstimate"], "artifactId": artifact["id"]},
    )
    return run


def list_runs(workflow_run_id: Optional[str] = None) -> List[Dict]:
    allruns = _run_repo().get_all()
    filtered = [r for r in allruns if r.get("workflowRunId") == workflow_run_id] if workflow_run_id else allruns
    return sorted(filtered, key=lambda r: r.get("startedAt", ""), reverse=True)


def list_artifacts(project_id: str) -> List[Dict]:
    return _artifact_repo().find(lambda a: a.get("projectId") == project_id)


def _fail_run(run: Dict, findings: List[Dict], reason: str, correlation_id: str, agent_id: str) -> Dict:
    run["state"] = "Blocked"
    run["guardrailFindings"] = findings
    run["summary"] = reason
    run["completedAt"] = now_iso()
    _run_repo().upsert(run)
    audit_service.record(
        actor_type="agent",
        actor=agent_id,
        action="agent.run.blocked",
        target_type="agentRun",
        target_id=run["id"],
        correlation_id=correlation_id,
        workflow_run_id=run["workflowRunId"],
        details={"reason": reason, "findings": findings},
    )
    return run
