from app import integrations
from app.config import CONFIG


def test_live_sharepoint_publish_uses_graph_web_url(monkeypatch):
    sharepoint = CONFIG["integrations"]["sharePoint"]
    monkeypatch.setitem(sharepoint, "useMock", False)
    monkeypatch.setattr(integrations, "_graph_headers", lambda: {"Authorization": "Bearer test"})
    monkeypatch.setattr(integrations, "_get_optional", lambda *args, **kwargs: {"id": "folder-id"})

    def fake_request(method, url, **kwargs):
        if "/sites/microsoft.sharepoint.com:" in url:
            return {"id": "site-id"}
        if url.endswith("/drives"):
            return {"value": [{"id": "drive-id", "name": "Shared Documents"}]}
        if method == "PUT":
            return {
                "webUrl": "https://microsoft.sharepoint.com/teams/ManufacturingMobility199/Shared%20Documents/Projects/Factory%20App/requirements-analysis.md"
            }
        return {}

    monkeypatch.setattr(integrations, "_request", fake_request)
    result = integrations.publish_requirements(
        {"id": "project-id", "name": "Factory App"},
        {"id": "artifact-id", "content": "Approved requirements"},
    )

    assert result["assetUrl"].endswith("/Factory%20App/requirements-analysis.md")
    assert result["projectFolderUrl"].endswith("/Factory%20App")
    assert result["mocked"] is False