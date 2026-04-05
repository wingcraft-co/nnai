import pytest
from fastapi import HTTPException

import api.mobile_auth as mobile_auth
from api.mobile_auth import TokenRequest


def test_build_google_token_payload_keeps_default_server_flow(monkeypatch):
    monkeypatch.setattr(mobile_auth, "GOOGLE_CLIENT_ID", "server-web-client")
    monkeypatch.setattr(mobile_auth, "GOOGLE_CLIENT_SECRET", "server-secret")

    body = TokenRequest(code="abc", redirect_uri="https://nnai.app/auth/callback")
    payload = mobile_auth._build_google_token_payload(body)

    assert payload["client_id"] == "server-web-client"
    assert payload["client_secret"] == "server-secret"
    assert payload["code"] == "abc"
    assert payload["redirect_uri"] == "https://nnai.app/auth/callback"
    assert payload["grant_type"] == "authorization_code"


def test_build_google_token_payload_uses_mobile_client_id_when_present(monkeypatch):
    monkeypatch.setattr(mobile_auth, "GOOGLE_CLIENT_ID", "server-web-client")
    monkeypatch.setattr(mobile_auth, "GOOGLE_CLIENT_SECRET", "server-secret")

    body = TokenRequest(
        code="abc",
        redirect_uri="com.example.app:/oauthredirect",
        client_id="ios-mobile-client",
        platform="ios",
    )
    payload = mobile_auth._build_google_token_payload(body)

    assert payload["client_id"] == "ios-mobile-client"
    assert "client_secret" not in payload
    assert payload["code"] == "abc"
    assert payload["redirect_uri"] == "com.example.app:/oauthredirect"
    assert payload["grant_type"] == "authorization_code"


def test_build_google_token_payload_raises_when_server_oauth_not_configured(monkeypatch):
    monkeypatch.setattr(mobile_auth, "GOOGLE_CLIENT_ID", "")
    monkeypatch.setattr(mobile_auth, "GOOGLE_CLIENT_SECRET", "")

    body = TokenRequest(code="abc", redirect_uri="https://nnai.app/auth/callback")

    with pytest.raises(HTTPException) as exc_info:
        mobile_auth._build_google_token_payload(body)

    assert exc_info.value.status_code == 500
    assert "Google OAuth is not configured" in str(exc_info.value.detail)
