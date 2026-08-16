from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from .. import approvals, orchestrator, projects_service
from ..errors import ApiError
from ..models import AgentRunBody, ProjectCreateBody
from ..security import correlation_id, require

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("")
def list_projects(user: dict = Depends(require("projects.read"))):
    return projects_service.list_projects()


@router.get("/{project_id}")
def get_project(project_id: str, user: dict = Depends(require("projects.read"))):
    project = projects_service.get_by_id(project_id)
    if not project:
        raise ApiError(404, "Project not found")
    run = projects_service.get_run_for_project(project["id"])
    artifacts = orchestrator.list_artifacts(project["id"])
    gates = approvals.list_for_run(run["id"]) if run else []
    agent_runs = orchestrator.list_runs(run["id"]) if run else []
    return {"project": project, "run": run, "gates": gates, "artifacts": artifacts, "agentRuns": agent_runs}


@router.post("")
def create_project(body: ProjectCreateBody, user: dict = Depends(require("projects.create")), corr: str = Depends(correlation_id)):
    project = projects_service.create(body.model_dump(), user, corr)
    return JSONResponse(status_code=201, content=project)


@router.post("/{project_id}/submit")
def submit_project(project_id: str, user: dict = Depends(require("projects.create")), corr: str = Depends(correlation_id)):
    run = projects_service.submit(project_id, user, corr)
    return JSONResponse(status_code=201, content=run)


@router.post("/{project_id}/archive")
def archive_project(project_id: str, user: dict = Depends(require("projects.manage")), corr: str = Depends(correlation_id)):
    return projects_service.archive(project_id, user, corr)


@router.post("/{project_id}/agents/{agent_id}/run")
def run_agent(project_id: str, agent_id: str, body: Optional[AgentRunBody] = None, user: dict = Depends(require("agents.run")), corr: str = Depends(correlation_id)):
    run = projects_service.get_run_for_project(project_id)
    if not run:
        raise ApiError(409, "Project has no workflow run. Submit it first.")
    prompt = (body.prompt if body else None) or "Generate outputs for this lifecycle stage."
    agent_run = orchestrator.run_agent(
        {
            "workflowRunId": run["id"],
            "projectId": project_id,
            "agentId": agent_id,
            "prompt": prompt,
        },
        user,
        corr,
    )
    return JSONResponse(status_code=201, content=agent_run)
