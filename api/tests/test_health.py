from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_contract_and_correlation_id() -> None:
    response = client.get("/api/health", headers={"X-Correlation-ID": "test-correlation"})

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "agentic-sdlc-api"}
    assert response.headers["X-Correlation-ID"] == "test-correlation"