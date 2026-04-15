# api/auth.py
"""Google OAuth 2.0 FastAPI 라우터."""
import os
import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse, JSONResponse
from authlib.integrations.httpx_client import AsyncOAuth2Client
from itsdangerous import URLSafeTimedSerializer, BadSignature
from utils.db import get_billing_entitlement, get_conn
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
_SCOPES        = "openid email profile"

GOOGLE_AUTH_URL  = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USER_URL  = "https://www.googleapis.com/oauth2/v3/userinfo"


def _should_use_secure_cookie() -> bool:
    return not _REDIRECT_URI.startswith("http://localhost")


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
async def google_login():
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
    return response


@router.get("/auth/google/callback")
async def google_callback(request: Request, code: str = "", error: str = ""):
    if error or not code:
        log_security_event(
            "oauth_callback_rejected",
            reason="missing_code_or_error",
            has_error=bool(error),
        )
        return RedirectResponse("/?auth_error=1")
    expected_state = request.cookies.get(_OAUTH_STATE_COOKIE)
    actual_state = request.query_params.get("state")
    if not expected_state or actual_state != expected_state:
        log_security_event(
            "oauth_state_mismatch",
            client_ip=request.client.host if request.client else "unknown",
            has_expected_state=bool(expected_state),
        )
        response = RedirectResponse("/?auth_error=csrf")
        response.delete_cookie(
            _OAUTH_STATE_COOKIE,
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
        return RedirectResponse("/?auth_error=1")

    # upsert user
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO users(id,email,name,picture,created_at) VALUES(%s,%s,%s,%s,%s) "
            "ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email, name=EXCLUDED.name, picture=EXCLUDED.picture",
            (uid, info.get("email"), info.get("name"),
             info.get("picture"), datetime.now(timezone.utc).isoformat())
        )
    conn.commit()

    # 서명 쿠키 발급
    token_str = _SIGNER.dumps({"uid": uid, "name": info.get("name"), "picture": info.get("picture")})
    resp = RedirectResponse(_FRONTEND_URL)
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
    return resp


@router.get("/auth/me")
def me(request: Request):
    raw = request.cookies.get(_COOKIE_NAME)
    if not raw:
        return JSONResponse({"logged_in": False})
    try:
        data = _SIGNER.loads(raw, max_age=86400)
        entitlement = get_billing_entitlement(data["uid"])
        return JSONResponse(build_me_response(data, entitlement))
    except BadSignature:
        log_security_event(
            "session_bad_signature",
            client_ip=request.client.host if request.client else "unknown",
            route="/auth/me",
        )
        return JSONResponse({"logged_in": False})


@router.get("/auth/logout")
def logout():
    resp = RedirectResponse(_FRONTEND_URL)
    resp.delete_cookie(_COOKIE_NAME, path="/", samesite="none", secure=True)
    return resp


def extract_user_id(request: Request) -> str | None:
    """미들웨어용 — 쿠키에서 user_id 추출."""
    raw = request.cookies.get(_COOKIE_NAME)
    if not raw:
        return None
    try:
        return _SIGNER.loads(raw, max_age=86400)["uid"]
    except BadSignature:
        log_security_event(
            "session_bad_signature",
            client_ip=request.client.host if request.client else "unknown",
            route="middleware",
        )
        return None
