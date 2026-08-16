"""Test bootstrap: enable OTP dev bypass and an isolated file store before app import."""
import os
import tempfile

os.environ.setdefault("AUTH_OTP_DEV_BYPASS", "1")
os.environ.setdefault("PERSIST_FILE_DATA_ROOT", tempfile.mkdtemp(prefix="agentic-test-"))

import pytest


@pytest.fixture(scope="session", autouse=True)
def _seed_users():
    # Production seeds via FastAPI lifespan; TestClient without a context manager does not.
    from app.users_service import ensure_seed_users

    ensure_seed_users()
