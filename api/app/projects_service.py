"""Projects service (mirror of projects.service.ts)."""
from typing import Dict, List, Optional

from . import approvals, audit_service, settings_service
from .errors import ApiError
from .persistence import get_repository
from .util import new_id, now_iso
from .workflow import LIFECYCLE_ORDER, assert_transition


def _project_repo():
    return get_repository("projects")


def _run_repo():
    return get_repository("workflowRuns")


def create(body: Dict, user: Dict, correlation_id: str) -> Dict:
    now = now_iso()
    overrides = settings_service.normalize(body.get("systemsOfRecord"), partial=True)
    project = {
        "id": new_id(),
        "name": body.get("name", ""),
        "description": body.get("description", ""),
        "businessOwner": body.get("businessOwner", ""),
        "itOwner": body.get("itOwner", ""),
        "sources": body.get("sources", []),
        "adoOrganization": body.get("adoOrganization", ""),
        "adoProject": body.get("adoProject", ""),
        "gitHubRepo": body.get("gitHubRepo", ""),
        "targetEnvironment": body.get("targetEnvironment", "Dev"),
        "selectedAgentIds": body.get("selectedAgentIds", []),
        "systemsOfRecord": overrides,
        "currentStage": "plan",
        "state": "Draft",
        "createdBy": user["email"],
        "createdAt": now,
        "updatedAt": now,
    }
    _project_repo().upsert(project)
    audit_service.record(
        actor_type="user",
        actor=user["email"],
        action="project.create",
        target_type="project",
        target_id=project["id"],
        correlation_id=correlation_id,
        details={"name": project["name"], "systemsOfRecordOverrides": sorted(overrides)},
    )
    return project


def update_systems_of_record(project_id: str, raw: Optional[Dict], user: Dict, correlation_id: str) -> Dict:
    project = get_by_id(project_id)
    if not project:
        raise ApiError(404, "Project not found")
    overrides = settings_service.normalize(raw, partial=True)
    project["systemsOfRecord"] = overrides
    project["updatedAt"] = now_iso()
    _project_repo().upsert(project)
    audit_service.record(
        actor_type="user",
        actor=user["email"],
        action="project.systems-of-record.update",
        target_type="project",
        target_id=project_id,
        correlation_id=correlation_id,
        details={"overriddenKeys": sorted(overrides)},
    )
    return project


def list_projects() -> List[Dict]:
    return sorted(_project_repo().get_all(), key=lambda p: p.get("createdAt", ""), reverse=True)


def get_by_id(project_id: str) -> Optional[Dict]:
    return _project_repo().get_by_id(project_id)


def submit(project_id: str, user: Dict, correlation_id: str) -> Dict:
    project = get_by_id(project_id)
    if not project:
        raise ApiError(404, "Project not found")
    assert_transition(project["state"], "Submitted")
    project["state"] = "AwaitingApproval"
    project["updatedAt"] = now_iso()
    _project_repo().upsert(project)

    stages = [
        {"stage": stage, "state": "AwaitingApproval" if stage == "plan" else "Draft"}
        for stage in LIFECYCLE_ORDER
    ]
    now = now_iso()
    run = {
        "id": new_id(),
        "projectId": project_id,
        "stages": stages,
        "currentStage": "plan",
        "state": "AwaitingApproval",
        "createdAt": now,
        "updatedAt": now,
    }
    _run_repo().upsert(run)
    approvals.create_gates_for_run(run["id"], project_id)

    audit_service.record(
        actor_type="user",
        actor=user["email"],
        action="project.submit",
        target_type="project",
        target_id=project_id,
        correlation_id=correlation_id,
        workflow_run_id=run["id"],
    )
    return run


def get_run(run_id: str) -> Optional[Dict]:
    return _run_repo().get_by_id(run_id)


def get_run_for_project(project_id: str) -> Optional[Dict]:
    runs = _run_repo().find(lambda r: r.get("projectId") == project_id)
    runs.sort(key=lambda r: r.get("createdAt", ""), reverse=True)
    return runs[0] if runs else None


def list_runs() -> List[Dict]:
    return sorted(_run_repo().get_all(), key=lambda r: r.get("createdAt", ""), reverse=True)


def archive(project_id: str, user: Dict, correlation_id: str) -> Dict:
    project = get_by_id(project_id)
    if not project:
        raise ApiError(404, "Project not found")
    assert_transition(project["state"], "Archived")
    project["state"] = "Archived"
    project["updatedAt"] = now_iso()
    _project_repo().upsert(project)
    audit_service.record(
        actor_type="user",
        actor=user["email"],
        action="project.archive",
        target_type="project",
        target_id=project_id,
        correlation_id=correlation_id,
    )
    return project
