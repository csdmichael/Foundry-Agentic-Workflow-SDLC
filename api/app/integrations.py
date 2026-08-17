"""Approval-gated SDLC integration actions.

The orchestrator calls these connectors only after the workflow approval check.
Mock mode produces stable external references without making cloud changes; live
implementations remain behind the same configuration contract.
"""
import base64
import json
from typing import Dict, List
from urllib.parse import quote

import httpx

from .config import CONFIG
from .errors import ApiError
from .util import new_id, now_iso


def _slug(value: str) -> str:
    cleaned = "-".join(value.strip().lower().split())
    return "".join(char for char in cleaned if char.isalnum() or char in "-_") or "project"


def _require_enabled(connector: str, config: Dict) -> None:
    if not config.get("enabled", False):
        raise ApiError(409, f"{connector} integration is disabled")


def _request(method: str, url: str, *, headers: Dict[str, str], body=None, content=None) -> Dict:
    response = httpx.request(method, url, headers=headers, json=body, content=content, timeout=60)
    if response.status_code >= 400:
        raise ApiError(502, f"External integration request failed: {response.status_code} {url}")
    return response.json() if response.content else {}


def _get_optional(url: str, *, headers: Dict[str, str]):
    response = httpx.get(url, headers=headers, timeout=60)
    if response.status_code == 404:
        return None
    if response.status_code >= 400:
        raise ApiError(502, f"External integration request failed: {response.status_code} {url}")
    return response.json()


def _ado_headers(content_type: str = "application/json") -> Dict[str, str]:
    pat = CONFIG["secrets"]["adoPat"]
    if not pat:
        raise ApiError(503, "ADO_PAT is required when Azure DevOps mock mode is disabled")
    credential = base64.b64encode(f":{pat}".encode()).decode()
    return {"Authorization": f"Basic {credential}", "Content-Type": content_type}


def _github_headers() -> Dict[str, str]:
    token = CONFIG["secrets"]["gitHubPat"]
    if not token:
        raise ApiError(503, "GITHUB_PAT is required when GitHub mock mode is disabled")
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _graph_headers() -> Dict[str, str]:
    token = CONFIG["secrets"]["graphAccessToken"]
    if not token:
        try:
            from azure.identity import DefaultAzureCredential

            token = DefaultAzureCredential().get_token("https://graph.microsoft.com/.default").token
        except Exception as exc:
            raise ApiError(503, "Microsoft Graph managed identity authentication failed") from exc
    return {"Authorization": f"Bearer {token}"}


def publish_requirements(project: Dict, artifact: Dict) -> Dict:
    sharepoint = CONFIG["integrations"]["sharePoint"]
    _require_enabled("SharePoint", sharepoint)
    folder = quote(project["name"].strip(), safe="")
    file_name = quote("requirements-analysis.md", safe="")
    base_url = sharepoint["projectsFolderUrl"].rstrip("/")
    project_folder_url = f"{base_url}/{folder}"
    asset_url = f"{project_folder_url}/{file_name}"
    if not sharepoint.get("useMock", True):
        headers = _graph_headers()
        graph = "https://graph.microsoft.com/v1.0"
        site = _request("GET", f"{graph}/sites/microsoft.sharepoint.com:/teams/ManufacturingMobility199", headers=headers)
        drives = _request("GET", f'{graph}/sites/{site["id"]}/drives', headers=headers).get("value", [])
        drive = next((item for item in drives if item.get("name") in (sharepoint["designLibrary"], "Documents")), None)
        if not drive:
            raise ApiError(502, f'SharePoint library not found: {sharepoint["designLibrary"]}')
        parent_path = "/".join(quote(part, safe="") for part in sharepoint["projectsFolderPath"].split("/"))
        project_path = f"{parent_path}/{folder}"
        existing_folder = _get_optional(
            f'{graph}/drives/{drive["id"]}/root:/{project_path}',
            headers=headers,
        )
        if not existing_folder:
            _request(
                "POST",
                f'{graph}/drives/{drive["id"]}/root:/{parent_path}:/children',
                headers={**headers, "Content-Type": "application/json"},
                body={"name": project["name"], "folder": {}, "@microsoft.graph.conflictBehavior": "fail"},
            )
        asset_path = f"{parent_path}/{folder}/{file_name}"
        uploaded = _request(
            "PUT",
            f'{graph}/drives/{drive["id"]}/root:/{asset_path}:/content',
            headers={**headers, "Content-Type": "text/markdown"},
            content=artifact["content"].encode(),
        )
        asset_url = uploaded.get("webUrl", asset_url)
        project_folder_url = asset_url.rsplit("/", 1)[0]
    return {
        "id": new_id(),
        "type": "sharepoint-asset",
        "projectId": project["id"],
        "projectFolderUrl": project_folder_url,
        "assetUrl": asset_url,
        "artifactId": artifact["id"],
        "mocked": sharepoint.get("useMock", True),
        "createdAt": now_iso(),
    }


def create_ado_project_and_backlog(project: Dict, artifact: Dict) -> Dict:
    ado = CONFIG["integrations"]["azureDevOps"]
    _require_enabled("Azure DevOps", ado)
    project_name = project.get("adoProject") or project["name"]
    project_url = f'{ado["organizationUrl"].rstrip("/")}/{quote(project_name, safe="")}'
    hierarchy = [
        {"type": "Epic", "title": f'{project["name"]} delivery'},
        {"type": "Feature", "title": "Requirements and architecture"},
        {"type": "User Story", "title": "Implement approved SDLC scope"},
        {"type": "Task", "title": "Deliver acceptance criteria"},
    ]
    for index, item in enumerate(hierarchy):
        item["externalId"] = f"MOCK-{1000 + index}"
        item["parentExternalId"] = hierarchy[index - 1]["externalId"] if index else None
    if not ado.get("useMock", True):
        headers = _ado_headers()
        organization_url = ado["organizationUrl"].rstrip("/")
        existing = httpx.get(
            f"{organization_url}/_apis/projects/{quote(project_name, safe='')}?api-version=7.1",
            headers=headers,
            timeout=60,
        )
        if existing.status_code == 404:
            _request(
                "POST",
                f"{organization_url}/_apis/projects?api-version=7.1",
                headers=headers,
                body={
                    "name": project_name,
                    "description": project.get("description", "Created by Agentic SDLC Planning Agent"),
                    "capabilities": {
                        "versioncontrol": {"sourceControlType": "Git"},
                        "processTemplate": {"templateTypeId": "adcc42ab-9882-485e-a3ed-7678f01f66bc"},
                    },
                },
            )
        elif existing.status_code >= 400:
            raise ApiError(502, f"Azure DevOps project lookup failed: {existing.status_code}")
        parent_url = None
        for item in hierarchy:
            patch = [{"op": "add", "path": "/fields/System.Title", "value": item["title"]}]
            if parent_url:
                patch.append({"op": "add", "path": "/relations/-", "value": {"rel": "System.LinkTypes.Hierarchy-Reverse", "url": parent_url}})
            created = _request(
                "POST",
                f"{project_url}/_apis/wit/workitems/${quote(item['type'], safe='')}?api-version=7.1",
                headers=_ado_headers("application/json-patch+json"),
                body=patch,
            )
            item["externalId"] = str(created["id"])
            item["parentExternalId"] = hierarchy[hierarchy.index(item) - 1]["externalId"] if parent_url else None
            parent_url = created["url"]
    return {
        "id": new_id(),
        "type": "ado-backlog",
        "projectId": project["id"],
        "adoProjectName": project_name,
        "projectUrl": project_url,
        "workItems": hierarchy,
        "sourceArtifactId": artifact["id"],
        "mocked": ado.get("useMock", True),
        "createdAt": now_iso(),
    }


def create_github_repository(project: Dict, artifact: Dict) -> Dict:
    github = CONFIG["integrations"]["github"]
    _require_enabled("GitHub", github)
    repo_name = project.get("gitHubRepo") or _slug(project["name"])
    repo_url = f'{github["repoBaseUrl"].rstrip("/")}/{quote(repo_name, safe="")}'
    if not github.get("useMock", True):
        headers = _github_headers()
        api = github["apiBaseUrl"].rstrip("/")
        response = httpx.post(
            f'{api}/orgs/{quote(github["org"], safe="")}/repos',
            headers=headers,
            json={"name": repo_name, "description": project.get("description", ""), "private": True, "auto_init": True},
            timeout=60,
        )
        if response.status_code == 422:
            repository = _request("GET", f'{api}/repos/{github["org"]}/{quote(repo_name, safe="")}', headers=headers)
        elif response.status_code >= 400:
            raise ApiError(502, f"GitHub repository creation failed: {response.status_code}")
        else:
            repository = response.json()
        repo_url = repository["html_url"]
        _request(
            "PUT",
            f'{api}/repos/{github["org"]}/{quote(repo_name, safe="")}/contents/AGENT_OUTPUT.md',
            headers=headers,
            body={
                "message": "Add approved coding agent output",
                "content": base64.b64encode(artifact["content"].encode()).decode(),
            },
        )
    return {
        "id": new_id(),
        "type": "github-repository",
        "projectId": project["id"],
        "repositoryName": repo_name,
        "repositoryUrl": repo_url,
        "branch": "feature/agent-generated",
        "pullRequestUrl": f"{repo_url}/pull/1",
        "merged": False,
        "sourceArtifactId": artifact["id"],
        "mocked": github.get("useMock", True),
        "createdAt": now_iso(),
    }


def create_test_plan(project: Dict, artifact: Dict) -> Dict:
    ado = CONFIG["integrations"]["azureDevOps"]
    automation = CONFIG["integrations"]["testAutomation"]
    _require_enabled("Azure DevOps", ado)
    _require_enabled("test automation", automation)
    ado_project = project.get("adoProject") or project["name"]
    project_url = f'{ado["organizationUrl"].rstrip("/")}/{quote(ado_project, safe="")}'
    result = {
        "id": new_id(),
        "type": "ado-test-plan",
        "projectId": project["id"],
        "testPlanName": f'{project["name"]} automated validation',
        "testPlanUrl": f"{project_url}/_testPlans/define?planId=MOCK-1",
        "testCases": [
            {"externalId": "MOCK-TC-1", "title": "Validate approved requirements"},
            {"externalId": "MOCK-TC-2", "title": "Validate generated implementation"},
        ],
        "sourceArtifactId": artifact["id"],
        "mocked": ado.get("useMock", True),
        "createdAt": now_iso(),
    }
    if not ado.get("useMock", True):
        created = _request(
            "POST",
            f"{project_url}/_apis/testplan/plans?api-version=7.1",
            headers=_ado_headers(),
            body={"name": result["testPlanName"], "areaPath": ado_project, "iteration": ado_project},
        )
        result["testPlanUrl"] = f'{project_url}/_testPlans/define?planId={created["id"]}'
        for test_case in result["testCases"]:
            work_item = _request(
                "POST",
                f"{project_url}/_apis/wit/workitems/$Test%20Case?api-version=7.1",
                headers=_ado_headers("application/json-patch+json"),
                body=[{"op": "add", "path": "/fields/System.Title", "value": test_case["title"]}],
            )
            test_case["externalId"] = str(work_item["id"])
    return result


def run_test_automation(project: Dict, artifact: Dict) -> Dict:
    ado = CONFIG["integrations"]["azureDevOps"]
    automation = CONFIG["integrations"]["testAutomation"]
    _require_enabled("Azure DevOps", ado)
    _require_enabled("test automation", automation)
    ado_project = project.get("adoProject") or project["name"]
    project_url = f'{ado["organizationUrl"].rstrip("/")}/{quote(ado_project, safe="")}'
    runner = automation.get("defaultRunner", "azure-pipelines")
    result = {
        "id": new_id(),
        "type": "test-automation-run",
        "projectId": project["id"],
        "runner": runner,
        "automationUrl": f"{project_url}/_build?definitionId=MOCK-1",
        "status": "queued",
        "sourceArtifactId": artifact["id"],
        "mocked": ado.get("useMock", True) if runner == "azure-pipelines" else CONFIG["integrations"]["github"].get("useMock", True),
        "createdAt": now_iso(),
    }
    if not result["mocked"] and runner == "azure-pipelines":
        pipeline_id = automation.get("azurePipelineId")
        if not pipeline_id:
            raise ApiError(409, "testAutomation.azurePipelineId must be configured")
        queued = _request(
            "POST",
            f"{project_url}/_apis/pipelines/{pipeline_id}/runs?api-version=7.1",
            headers=_ado_headers(),
            body={},
        )
        result["automationUrl"] = queued.get("_links", {}).get("web", {}).get("href", result["automationUrl"])
        result["externalRunId"] = str(queued["id"])
    elif not result["mocked"]:
        github = CONFIG["integrations"]["github"]
        repo_name = project.get("gitHubRepo") or _slug(project["name"])
        _request(
            "POST",
            f'{github["apiBaseUrl"].rstrip("/")}/repos/{github["org"]}/{quote(repo_name, safe="")}/actions/workflows/{quote(automation["githubWorkflow"], safe="")}/dispatches',
            headers=_github_headers(),
            body={"ref": automation.get("githubRef", "main")},
        )
        result["automationUrl"] = f'{github["repoBaseUrl"].rstrip("/")}/{quote(repo_name, safe="")}/actions'
    return result


def dispatch(agent_id: str, project: Dict, artifact: Dict) -> List[Dict]:
    actions = {
        "requirements-agent": [publish_requirements],
        "planning-agent": [create_ado_project_and_backlog],
        "code-generation-agent": [create_github_repository],
        "test-planning-agent": [create_test_plan],
        "testing-agent": [run_test_automation],
        "test-automation-agent": [create_test_plan, run_test_automation],
    }
    return [action(project, artifact) for action in actions.get(agent_id, [])]