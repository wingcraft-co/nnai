from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.auth import router as auth_router


class _OAuthClientStub:
    def __init__(self, *args, **kwargs):
        self.args = args
        self.kwargs = kwargs

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    def create_authorization_url(self, url: str, state: str | None = None):
        return f"{url}?state={state}", state


def _build_client(monkeypatch) -> TestClient:
    app = FastAPI()
    app.include_router(auth_router)
    monkeypatch.setattr("api.auth.AsyncOAuth2Client", _OAuthClientStub)
    return TestClient(app)


def test_google_login_sets_oauth_state_cookie(monkeypatch):
    client = _build_client(monkeypatch)

    response = client.get("/auth/google", follow_redirects=False)

    assert response.status_code == 307
    assert "state=" in response.headers["location"]
    set_cookie = response.headers["set-cookie"]
    assert "oauth_state=" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "Path=/" in set_cookie


def test_google_callback_rejects_state_mismatch(monkeypatch):
    client = _build_client(monkeypatch)
    client.cookies.set("oauth_state", "expected-state")

    response = client.get(
        "/auth/google/callback?code=test-code&state=wrong-state",
        follow_redirects=False,
    )

    assert response.status_code == 307
    assert response.headers["location"] == "/?auth_error=csrf"


def test_logout_deletes_session_cookie_with_root_path(monkeypatch):
    client = _build_client(monkeypatch)

    response = client.get("/auth/logout", follow_redirects=False)

    assert response.status_code == 307
    assert "Path=/" in response.headers["set-cookie"]


def test_auth_module_requires_secret_key(monkeypatch):
    auth_path = Path(__file__).resolve().parents[1] / "api" / "auth.py"
    monkeypatch.delenv("SECRET_KEY", raising=False)

    spec = importlib.util.spec_from_file_location("auth_missing_secret_key", auth_path)
    module = importlib.util.module_from_spec(spec)

    with pytest.raises(KeyError):
        assert spec.loader is not None
        spec.loader.exec_module(module)
