# api/auth.py
"""Google OAuth 2.0 FastAPI 라우터."""
import os
import secrets
from datetime import datetime, timezone
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse
from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse, JSONResponse
from authlib.integrations.httpx_client import AsyncOAuth2Client
from itsdangerous import URLSafeTimedSerializer, BadSignature
from utils.db import (
    create_auth_session,
    get_auth_session_identity,
    get_billing_entitlement,
    revoke_auth_session,
    upsert_user_identity,
)
from utils.rate_limit import normalize_entitlement
from utils.security_events import log_security_event

router = APIRouter()

_CLIENT_ID     = os.environ.get("GOOGLE_CLIENT_ID", "")
_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
_REDIRECT_URI  = os.environ.get(
    "OAUTH_REDIRECT_URI",
    "http://localhost:7860/auth/google/callback"
)
_SECRET_KEY    = os.environ["SECRET_KEY"]
_FRONTEND_URL  = os.environ.get("FRONTEND_URL", "http://localhost:3000")
_SIGNER        = URLSafeTimedSerializer(_SECRET_KEY)
_COOKIE_NAME   = "nnai_session"
_OAUTH_STATE_COOKIE = "oauth_state"
_OAUTH_RETURN_COOKIE = "oauth_return_to"
_SCOPES        = "openid email profile"

GOOGLE_AUTH_URL  = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USER_URL  = "https://www.googleapis.com/oauth2/v3/userinfo"


def _should_use_secure_cookie() -> bool:
    return not _REDIRECT_URI.startswith("http://localhost")


def issue_session_token(session_id: str) -> str:
    return _SIGNER.dumps({"sid": session_id})


def read_session_token(raw: str) -> dict:
    payload = _SIGNER.loads(raw, max_age=86400)
    sid = payload.get("sid")
    if not isinstance(sid, str) or not sid:
        raise BadSignature("missing opaque session id")
    return {"sid": sid}


def _allowed_return_origins() -> list[str]:
    configured = [
        origin.strip()
        for origin in os.environ.get("AUTH_ALLOWED_RETURN_ORIGINS", "").split(",")
        if origin.strip()
    ]
    defaults = [
        _FRONTEND_URL,
        "https://nnai.app",
        "https://www.nnai.app",
        "https://dev.nnai.app",
        "http://localhost:3000",
    ]
    unique: list[str] = []
    for origin in [*configured, *defaults]:
        if origin not in unique:
            unique.append(origin)
    return unique


def normalize_return_to(return_to: str | None) -> str:
    if not return_to:
        return _FRONTEND_URL

    parsed = urlparse(return_to)
    if not parsed.scheme and not parsed.netloc:
        if not return_to.startswith("/") or return_to.startswith("//"):
            return _FRONTEND_URL
        return urljoin(_FRONTEND_URL.rstrip("/") + "/", return_to.lstrip("/"))

    origin = f"{parsed.scheme}://{parsed.netloc}"
    if parsed.scheme not in {"http", "https"}:
        return _FRONTEND_URL
    if origin not in _allowed_return_origins():
        return _FRONTEND_URL

    return urlunparse((parsed.scheme, parsed.netloc, parsed.path or "/", "", parsed.query, ""))


def _signed_return_to_cookie_value(return_to: str | None) -> str:
    return _SIGNER.dumps({"return_to": normalize_return_to(return_to)})


def _resolve_signed_return_to(request: Request) -> str | None:
    raw = request.cookies.get(_OAUTH_RETURN_COOKIE)
    if not raw:
        return None
    try:
        payload = _SIGNER.loads(raw, max_age=600)
    except BadSignature:
        log_security_event(
            "oauth_return_to_bad_signature",
            client_ip=request.client.host if request.client else "unknown",
        )
        return None
    return normalize_return_to(payload.get("return_to"))


def _append_auth_error(url: str, code: str) -> str:
    parsed = urlparse(url)
    query = parse_qsl(parsed.query, keep_blank_values=True)
    query.append(("auth_error", code))
    return urlunparse(parsed._replace(query=urlencode(query)))


def _error_redirect(request: Request, code: str) -> RedirectResponse:
    destination = _resolve_signed_return_to(request)
    if destination:
        return RedirectResponse(_append_auth_error(destination, code))
    return RedirectResponse(f"/?auth_error={code}")


def build_me_response(session_data: dict, entitlement: dict | None) -> dict:
    normalized = normalize_entitlement(entitlement)
    return {
        "logged_in": True,
        "name": session_data["name"],
        "picture": session_data.get("picture"),
        "uid": session_data["uid"],
        "entitlement": {
            "plan_tier": normalized["plan_tier"],
            "status": normalized["status"],
            "payg_enabled": normalized["payg_enabled"],
            "payg_monthly_cap_usd": normalized["payg_monthly_cap_usd"],
        },
    }


@router.get("/auth/google")
async def google_login(return_to: str | None = None):
    state = secrets.token_urlsafe(32)
    async with AsyncOAuth2Client(
        client_id=_CLIENT_ID,
        redirect_uri=_REDIRECT_URI,
        scope=_SCOPES,
    ) as client:
        uri, _ = client.create_authorization_url(GOOGLE_AUTH_URL, state=state)
    response = RedirectResponse(uri)
    response.set_cookie(
        _OAUTH_STATE_COOKIE,
        state,
        path="/",
        httponly=True,
        samesite="lax",
        secure=_should_use_secure_cookie(),
        max_age=600,
    )
    response.set_cookie(
        _OAUTH_RETURN_COOKIE,
        _signed_return_to_cookie_value(return_to),
        path="/",
        httponly=True,
        samesite="lax",
        secure=_should_use_secure_cookie(),
        max_age=600,
    )
    return response


@router.get("/auth/google/callback")
async def google_callback(request: Request, code: str = "", error: str = ""):
    if error or not code:
        log_security_event(
            "oauth_callback_rejected",
            reason="missing_code_or_error",
            has_error=bool(error),
        )
        return _error_redirect(request, "1")
    expected_state = request.cookies.get(_OAUTH_STATE_COOKIE)
    actual_state = request.query_params.get("state")
    if not expected_state or actual_state != expected_state:
        log_security_event(
            "oauth_state_mismatch",
            client_ip=request.client.host if request.client else "unknown",
            has_expected_state=bool(expected_state),
        )
        response = _error_redirect(request, "csrf")
        response.delete_cookie(
            _OAUTH_STATE_COOKIE,
            path="/",
            samesite="lax",
            secure=_should_use_secure_cookie(),
        )
        response.delete_cookie(
            _OAUTH_RETURN_COOKIE,
            path="/",
            samesite="lax",
            secure=_should_use_secure_cookie(),
        )
        return response
    async with AsyncOAuth2Client(
        client_id=_CLIENT_ID,
        client_secret=_CLIENT_SECRET,
        redirect_uri=_REDIRECT_URI,
    ) as client:
        token = await client.fetch_token(GOOGLE_TOKEN_URL, code=code)
        resp  = await client.get(GOOGLE_USER_URL, headers={'Authorization': f'Bearer {token["access_token"]}'})
    info = resp.json()
    uid  = info.get("sub")
    if not uid:
        log_security_event("oauth_callback_rejected", reason="missing_sub")
        response = _error_redirect(request, "1")
        response.delete_cookie(
            _OAUTH_STATE_COOKIE,
            path="/",
            samesite="lax",
            secure=_should_use_secure_cookie(),
        )
        response.delete_cookie(
            _OAUTH_RETURN_COOKIE,
            path="/",
            samesite="lax",
            secure=_should_use_secure_cookie(),
        )
        return response

    # upsert user
    upsert_user_identity(
        uid,
        email=info.get("email"),
        name=info.get("name"),
        picture=info.get("picture"),
        created_at=datetime.now(timezone.utc).isoformat(),
    )

    # 서명 쿠키 발급
    session_id = create_auth_session(uid)
    token_str = issue_session_token(session_id)
    return_to = _resolve_signed_return_to(request) or _FRONTEND_URL
    resp = RedirectResponse(return_to)
    resp.set_cookie(
        _COOKIE_NAME, token_str,
        path="/", httponly=True, samesite="none", secure=True, max_age=86400,
    )
    resp.delete_cookie(
        _OAUTH_STATE_COOKIE,
        path="/",
        samesite="lax",
        secure=_should_use_secure_cookie(),
    )
    resp.delete_cookie(
        _OAUTH_RETURN_COOKIE,
        path="/",
        samesite="lax",
        secure=_should_use_secure_cookie(),
    )
    return resp


@router.get("/auth/me")
def me(request: Request):
    raw = request.cookies.get(_COOKIE_NAME)
    if not raw:
        return JSONResponse({"logged_in": False})
    try:
        session = read_session_token(raw)
        identity = get_auth_session_identity(session["sid"])
        if not identity:
            return JSONResponse({"logged_in": False})
        entitlement = get_billing_entitlement(identity["uid"])
        return JSONResponse(build_me_response(identity, entitlement))
    except BadSignature:
        log_security_event(
            "session_bad_signature",
            client_ip=request.client.host if request.client else "unknown",
            route="/auth/me",
        )
        return JSONResponse({"logged_in": False})


@router.get("/auth/logout")
def logout(request: Request, return_to: str | None = None):
    raw = request.cookies.get(_COOKIE_NAME)
    if raw:
        try:
            session = read_session_token(raw)
            revoke_auth_session(session["sid"])
        except BadSignature:
            log_security_event(
                "session_bad_signature",
                client_ip=request.client.host if request.client else "unknown",
                route="/auth/logout",
            )
    resp = RedirectResponse(normalize_return_to(return_to))
    resp.delete_cookie(_COOKIE_NAME, path="/", samesite="none", secure=True)
    return resp


def extract_user_id(request: Request) -> str | None:
    """미들웨어용 — 쿠키에서 user_id 추출."""
    raw = request.cookies.get(_COOKIE_NAME)
    if not raw:
        return None
    try:
        session = read_session_token(raw)
        identity = get_auth_session_identity(session["sid"])
        if not identity:
            return None
        return identity["uid"]
    except BadSignature:
        log_security_event(
            "session_bad_signature",
            client_ip=request.client.host if request.client else "unknown",
            route="middleware",
        )
        return None
