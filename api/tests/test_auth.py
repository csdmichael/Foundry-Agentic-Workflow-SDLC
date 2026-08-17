"""End-to-end auth, RBAC, and approval-gate enforcement tests."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _login(email: str) -> dict:
    client.post("/api/auth/otp/request", json={"email": email})
    res = client.post("/api/auth/otp/verify", json={"email": email, "code": "000000"})
    assert res.status_code == 200, res.text
    body = res.json()
    return {"token": body["accessToken"], "user": body["user"]}


def test_auth_meta_exposes_dev_bypass():
    res = client.get("/api/auth/meta")
    assert res.status_code == 200
    assert res.json()["otpDevBypass"] is True


def test_otp_login_me_and_capabilities():
    session = _login("myaacoub@microsoft.com")
    assert session["user"]["role"] == "app_owner"
    headers = {"Authorization": f"Bearer {session['token']}"}

    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["user"]["email"] == "myaacoub@microsoft.com"

    caps = client.get("/api/config/capabilities", headers=headers)
    assert "users.manage" in caps.json()["capabilities"]

    agents = client.get("/api/agents", headers=headers)
    assert agents.status_code == 200
    assert len(agents.json()) >= 7


def test_unauthenticated_is_rejected():
    assert client.get("/api/projects").status_code == 401


def test_project_submit_blocks_agent_until_gate_approved():
    session = _login("myaacoub@microsoft.com")
    headers = {"Authorization": f"Bearer {session['token']}"}

    project = client.post("/api/projects", json={"name": "Test Project", "selectedAgentIds": []}, headers=headers).json()
    run = client.post(f"/api/projects/{project['id']}/submit", headers=headers).json()

    blocked = client.post(f"/api/projects/{project['id']}/agents/requirements-agent/run", headers=headers)
    assert blocked.status_code == 403

    gates = client.get(f"/api/approvals/run/{run['id']}", headers=headers).json()
    plan_gate = next(g for g in gates if g["name"] == "Plan and Scope Approval")
    decision = client.post(f"/api/approvals/{plan_gate['id']}/decision", json={"decision": "approve"}, headers=headers)
    assert decision.status_code == 200
    assert decision.json()["state"] == "Approved"

    allowed = client.post(f"/api/projects/{project['id']}/agents/requirements-agent/run", headers=headers)
    assert allowed.status_code == 201
    assert allowed.json()["state"] == "Completed"
    sharepoint_call = allowed.json()["toolCalls"][0]
    assert sharepoint_call["type"] == "sharepoint-asset"
    assert "Test%20Project/requirements-analysis.md" in sharepoint_call["assetUrl"]


def test_planning_agent_requires_backlog_gate_and_creates_ado_hierarchy():
    session = _login("myaacoub@microsoft.com")
    headers = {"Authorization": f"Bearer {session['token']}"}
    project = client.post(
        "/api/projects",
        json={"name": "Mobility Platform", "adoProject": "Mobility-Platform"},
        headers=headers,
    ).json()
    run = client.post(f"/api/projects/{project['id']}/submit", headers=headers).json()
    gates = client.get(f"/api/approvals/run/{run['id']}", headers=headers).json()

    plan_gate = next(g for g in gates if g["name"] == "Plan and Scope Approval")
    client.post(f"/api/approvals/{plan_gate['id']}/decision", json={"decision": "approve"}, headers=headers)
    blocked = client.post(f"/api/projects/{project['id']}/agents/planning-agent/run", headers=headers)
    assert blocked.status_code == 403

    backlog_gate = next(g for g in gates if g["name"] == "Backlog Generation Approval")
    client.post(f"/api/approvals/{backlog_gate['id']}/decision", json={"decision": "approve"}, headers=headers)
    allowed = client.post(f"/api/projects/{project['id']}/agents/planning-agent/run", headers=headers)
    assert allowed.status_code == 201
    backlog = allowed.json()["toolCalls"][0]
    assert backlog["type"] == "ado-backlog"
    assert backlog["projectUrl"].endswith("/Mobility-Platform")
    assert [item["type"] for item in backlog["workItems"]] == ["Epic", "Feature", "User Story", "Task"]
    assert backlog["workItems"][1]["parentExternalId"] == backlog["workItems"][0]["externalId"]


def test_code_and_test_agents_create_governed_external_actions():
    session = _login("myaacoub@microsoft.com")
    headers = {"Authorization": f"Bearer {session['token']}"}
    project = client.post(
        "/api/projects",
        json={"name": "Factory App", "adoProject": "Factory-App", "gitHubRepo": "factory-app"},
        headers=headers,
    ).json()
    run = client.post(f"/api/projects/{project['id']}/submit", headers=headers).json()
    gates = client.get(f"/api/approvals/run/{run['id']}", headers=headers).json()

    for gate_name in ("Code Generation Approval", "Test Acceptance Approval"):
        gate = next(g for g in gates if g["name"] == gate_name)
        decision = client.post(
            f"/api/approvals/{gate['id']}/decision",
            json={"decision": "approve"},
            headers=headers,
        )
        assert decision.status_code == 200

    code_run = client.post(f"/api/projects/{project['id']}/agents/code-generation-agent/run", headers=headers)
    assert code_run.status_code == 201
    repository = code_run.json()["toolCalls"][0]
    assert repository["repositoryUrl"] == "https://github.com/csdmichael/factory-app"
    assert repository["merged"] is False

    plan_run = client.post(f"/api/projects/{project['id']}/agents/test-planning-agent/run", headers=headers)
    assert plan_run.status_code == 201
    assert plan_run.json()["toolCalls"][0]["type"] == "ado-test-plan"

    test_run = client.post(f"/api/projects/{project['id']}/agents/testing-agent/run", headers=headers)
    assert test_run.status_code == 201
    automation = test_run.json()["toolCalls"][0]
    assert automation["type"] == "test-automation-run"
    assert automation["runner"] in ("azure-pipelines", "github-actions")
    assert automation["status"] == "queued"


def test_guest_login_is_read_only():
    res = client.post("/api/auth/guest")
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["role"] == "guest"
    headers = {"Authorization": f"Bearer {body['accessToken']}"}
    # Guests can read
    assert client.get("/api/agents", headers=headers).status_code == 200
    # Guests cannot create
    assert client.post("/api/projects", json={"name": "Nope"}, headers=headers).status_code == 403


def test_project_defaults_expose_configured_org():
    session = _login("myaacoub@microsoft.com")
    headers = {"Authorization": f"Bearer {session['token']}"}
    res = client.get("/api/config/project-defaults", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["adoOrganization"] == "https://dev.azure.com/csdmichael"
    assert data["gitHubOrg"] == "csdmichael"


def test_internal_domain_rejects_otp():
    # Internal domain must use Entra ID SSO, not OTP.
    req = client.post("/api/auth/otp/request", json={"email": "admin@MngEnvMCAP829495.onmicrosoft.com"})
    assert req.status_code == 400
    ver = client.post("/api/auth/otp/verify", json={"email": "admin@MngEnvMCAP829495.onmicrosoft.com", "code": "000000"})
    assert ver.status_code == 400


def test_auth_meta_reports_entra_flag():
    meta = client.get("/api/auth/meta").json()
    assert "entraEnabled" in meta
    assert meta["internalDomains"] == ["MngEnvMCAP829495.onmicrosoft.com"]
