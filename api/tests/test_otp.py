"""OTP request/verify tests that exercise the REAL generated code, not the dev bypass.

The delivery regression these guard against: `azure-communication-email` was
missing from requirements.txt, so the EmailClient import raised ImportError that
a bare `except Exception` swallowed, and every code silently fell back to the
local dev log instead of being emailed.
"""
import sys
import time
import types

import pytest
from fastapi.testclient import TestClient

from app import email_service, security
from app.config import CONFIG
from app.main import app

client = TestClient(app)

EXTERNAL = "otp-tester@contoso.com"
INTERNAL = "admin@MngEnvMCAP829495.onmicrosoft.com"


@pytest.fixture(autouse=True)
def _isolate_otp_state():
    security._otp_store.clear()
    security._rate_buckets.clear()
    yield
    security._otp_store.clear()
    security._rate_buckets.clear()


@pytest.fixture
def sent_codes(monkeypatch):
    """Capture the real code the API generates, standing in for the inbox."""
    captured: list[tuple[str, str]] = []

    def _capture(email: str, code: str) -> bool:
        captured.append((email, code))
        return True

    monkeypatch.setattr(security, "send_otp_email", _capture)
    return captured


def _request(email: str):
    return client.post("/api/auth/otp/request", json={"email": email})


def _verify(email: str, code: str):
    return client.post("/api/auth/otp/verify", json={"email": email, "code": code})


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------

def test_real_code_round_trip_issues_a_usable_token(sent_codes):
    assert _request(EXTERNAL).json() == {"requested": True, "delivered": True}

    recipient, code = sent_codes[0]
    assert recipient == EXTERNAL
    assert len(code) == CONFIG["api"]["auth"]["external"]["otpLength"]
    assert code.isdigit()
    assert code != "000000"

    res = _verify(EXTERNAL, code)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["tokenType"] == "Bearer"
    assert body["user"]["email"] == EXTERNAL
    assert body["user"]["provider"] == "email-otp"
    assert body["user"]["isInternal"] is False

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['accessToken']}"})
    assert me.status_code == 200
    assert me.json()["user"]["email"] == EXTERNAL


def test_code_is_single_use(sent_codes):
    _request(EXTERNAL)
    _, code = sent_codes[0]
    assert _verify(EXTERNAL, code).status_code == 200
    assert _verify(EXTERNAL, code).status_code == 400


def test_email_is_case_insensitive(sent_codes):
    _request(EXTERNAL.upper())
    _, code = sent_codes[0]
    assert _verify(EXTERNAL.upper(), code).status_code == 200


# ---------------------------------------------------------------------------
# Rejection paths
# ---------------------------------------------------------------------------

def test_wrong_code_is_rejected(sent_codes):
    _request(EXTERNAL)
    _, code = sent_codes[0]
    wrong = "111111" if code != "111111" else "222222"
    assert _verify(EXTERNAL, wrong).status_code == 401


def test_verify_without_a_request_is_rejected():
    assert _verify("never-asked@contoso.com", "123456").status_code == 400


def test_expired_code_is_rejected(sent_codes):
    _request(EXTERNAL)
    _, code = sent_codes[0]
    security._otp_store[EXTERNAL]["expiresAt"] = time.time() - 1
    res = _verify(EXTERNAL, code)
    assert res.status_code == 400
    assert "expired" in res.json()["error"].lower()


def test_attempts_are_capped(sent_codes):
    _request(EXTERNAL)
    _, code = sent_codes[0]
    for _ in range(CONFIG["api"]["auth"]["external"]["maxAttemptsPerCode"]):
        _verify(EXTERNAL, "999999")
    assert _verify(EXTERNAL, code).status_code == 429


def test_requests_are_rate_limited(sent_codes):
    limit = CONFIG["api"]["auth"]["external"]["maxCodesPerEmailPerHour"]
    for _ in range(limit):
        assert _request(EXTERNAL).status_code == 200
    assert _request(EXTERNAL).status_code == 429


@pytest.mark.parametrize("call", [_request, lambda e: _verify(e, "000000")])
def test_internal_domain_must_use_entra_sso(call):
    res = call(INTERNAL)
    assert res.status_code == 400
    assert "Entra ID" in res.json()["error"]


def test_malformed_email_is_rejected():
    assert client.post("/api/auth/otp/request", json={"email": "not-an-email"}).status_code == 400


# ---------------------------------------------------------------------------
# Delivery — the actual regression
# ---------------------------------------------------------------------------

def test_acs_sdk_is_installed():
    """Guards the missing-dependency regression: the import must not raise."""
    from azure.communication.email import EmailClient  # noqa: F401


def test_send_otp_email_uses_acs_when_configured(monkeypatch):
    sent = []

    class _Poller:
        def result(self):
            return {"status": "Succeeded"}

    class _FakeEmailClient:
        @classmethod
        def from_connection_string(cls, conn):
            assert conn == "endpoint=https://fake.communication.azure.com/;accesskey=fake"
            return cls()

        def begin_send(self, message):
            sent.append(message)
            return _Poller()

    module = types.ModuleType("azure.communication.email")
    module.EmailClient = _FakeEmailClient
    monkeypatch.setitem(sys.modules, "azure.communication.email", module)
    monkeypatch.setitem(
        CONFIG["secrets"],
        "acsConnectionString",
        "endpoint=https://fake.communication.azure.com/;accesskey=fake",
    )
    monkeypatch.setitem(CONFIG["secrets"], "acsSenderAddress", "DoNotReply@fake.azurecomm.net")

    assert email_service.send_otp_email(EXTERNAL, "424242") is True
    assert sent[0]["senderAddress"] == "DoNotReply@fake.azurecomm.net"
    assert sent[0]["recipients"]["to"] == [{"address": EXTERNAL}]
    assert "424242" in sent[0]["content"]["plainText"]


def test_send_otp_email_reports_undelivered_when_acs_unconfigured(monkeypatch):
    monkeypatch.setitem(CONFIG["secrets"], "acsConnectionString", "")
    monkeypatch.setitem(CONFIG["secrets"], "acsSenderAddress", "")
    assert email_service.send_otp_email(EXTERNAL, "424242") is False


def test_send_otp_email_reports_undelivered_when_sdk_missing(monkeypatch):
    """The exact silent failure that shipped: connection configured, SDK absent."""
    monkeypatch.setitem(CONFIG["secrets"], "acsConnectionString", "endpoint=https://x;accesskey=y")
    monkeypatch.setitem(CONFIG["secrets"], "acsSenderAddress", "DoNotReply@fake.azurecomm.net")
    monkeypatch.setitem(sys.modules, "azure.communication.email", None)
    assert email_service.send_otp_email(EXTERNAL, "424242") is False


def test_plaintext_codes_are_not_persisted_without_dev_bypass(monkeypatch, tmp_path):
    monkeypatch.setitem(CONFIG["flags"], "otpDevBypass", False)
    monkeypatch.setattr(email_service, "_data_root", tmp_path)
    email_service.send_otp_email(EXTERNAL, "424242")
    assert not (tmp_path / "otp-log.json").exists()
