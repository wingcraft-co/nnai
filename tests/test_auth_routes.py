from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.auth import router as auth_router
from api.auth import normalize_return_to


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

    async def fetch_token(self, url: str, code: str):
        return {"access_token": "test-token"}

    async def get(self, url: str, headers: dict[str, str] | None = None):
        class _Response:
            def json(self):
                return {
                    "sub": "user-123",
                    "email": "user@example.com",
                    "name": "User Example",
                    "picture": "https://example.com/avatar.png",
                }

        return _Response()


class _CursorStub:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, query, params=None):
        self.query = query
        self.params = params


class _ConnStub:
    def cursor(self):
        return _CursorStub()

    def commit(self):
        return None


def _build_client(monkeypatch) -> TestClient:
    app = FastAPI()
    app.include_router(auth_router)
    monkeypatch.setattr("api.auth.AsyncOAuth2Client", _OAuthClientStub)
    monkeypatch.setattr("api.auth.upsert_user_identity", lambda *args, **kwargs: None)
    monkeypatch.setattr("api.auth.create_auth_session", lambda uid: "sess_test")
    monkeypatch.setattr(
        "api.auth.get_auth_session_identity",
        lambda session_id: {
            "uid": "user-123",
            "name": "User Example",
            "picture": "https://example.com/avatar.png",
        },
    )
    monkeypatch.setattr("api.auth.revoke_auth_session", lambda session_id: None)
    return TestClient(app)


def test_normalize_return_to_accepts_dev_login_origin():
    result = normalize_return_to("https://dev.nnai.app/ko/login?source=footer")

    assert result == "https://dev.nnai.app/ko/login?source=footer"


def test_normalize_return_to_rejects_unapproved_origin():
    result = normalize_return_to("https://evil.example/login")

    assert result == "http://localhost:3000"


def test_google_login_sets_oauth_state_cookie(monkeypatch):
    client = _build_client(monkeypatch)

    response = client.get("/auth/google", follow_redirects=False)

    assert response.status_code == 307
    assert "state=" in response.headers["location"]
    set_cookie = response.headers["set-cookie"]
    assert "oauth_state=" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "Path=/" in set_cookie


def test_google_login_sets_return_to_cookie_for_allowed_origin(monkeypatch):
    client = _build_client(monkeypatch)

    response = client.get(
        "/auth/google?return_to=https://dev.nnai.app/ko/login",
        follow_redirects=False,
    )

    assert response.status_code == 307
    set_cookie = response.headers["set-cookie"]
    assert "oauth_return_to=" in set_cookie


def test_google_callback_rejects_state_mismatch(monkeypatch):
    client = _build_client(monkeypatch)
    client.cookies.set("oauth_state", "expected-state")

    response = client.get(
        "/auth/google/callback?code=test-code&state=wrong-state",
        follow_redirects=False,
    )

    assert response.status_code == 307
    assert response.headers["location"] == "/?auth_error=csrf"


def test_google_callback_redirects_to_signed_return_to(monkeypatch):
    client = _build_client(monkeypatch)
    response = client.get(
        "/auth/google?return_to=https://dev.nnai.app/en/login",
        follow_redirects=False,
    )

    oauth_state = client.cookies.get("oauth_state")
    assert oauth_state

    callback = client.get(
        f"/auth/google/callback?code=test-code&state={oauth_state}",
        follow_redirects=False,
    )

    assert callback.status_code == 307
    assert callback.headers["location"] == "https://dev.nnai.app/en/login"


def test_logout_deletes_session_cookie_with_root_path(monkeypatch):
    client = _build_client(monkeypatch)

    response = client.get("/auth/logout", follow_redirects=False)

    assert response.status_code == 307
    assert "Path=/" in response.headers["set-cookie"]


def test_logout_redirects_to_allowed_return_to(monkeypatch):
    client = _build_client(monkeypatch)

    response = client.get(
        "/auth/logout?return_to=https://dev.nnai.app/ko/login",
        follow_redirects=False,
    )

    assert response.status_code == 307
    assert response.headers["location"] == "https://dev.nnai.app/ko/login"


def test_auth_module_requires_secret_key(monkeypatch):
    auth_path = Path(__file__).resolve().parents[1] / "api" / "auth.py"
    monkeypatch.delenv("SECRET_KEY", raising=False)

    spec = importlib.util.spec_from_file_location("auth_missing_secret_key", auth_path)
    module = importlib.util.module_from_spec(spec)

    with pytest.raises(KeyError):
        assert spec.loader is not None
        spec.loader.exec_module(module)
