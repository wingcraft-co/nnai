"""모바일 앱 전용 인증 라우터."""
from __future__ import annotations

import json
import os

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from utils.db import get_user_identity, upsert_user_identity
from utils.mobile_auth import create_jwt, require_mobile_auth
from utils.persona import resolve_character

router = APIRouter(prefix="/auth/mobile", tags=["mobile-auth"])

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")


class TokenRequest(BaseModel):
    code: str
    redirect_uri: str
    client_id: str | None = None
    platform: str | None = None


def _get_user(user_id: str) -> dict | None:
    return get_user_identity(user_id)


def _build_google_token_payload(body: TokenRequest) -> dict[str, str]:
    payload: dict[str, str] = {
        "code": body.code,
        "redirect_uri": body.redirect_uri,
        "grant_type": "authorization_code",
    }

    # 기본 동작 유지: client_id가 없으면 기존 서버 OAuth 설정(웹) 그대로 사용
    if not body.client_id:
        if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
            raise HTTPException(status_code=500, detail="Google OAuth is not configured")
        payload["client_id"] = GOOGLE_CLIENT_ID
        payload["client_secret"] = GOOGLE_CLIENT_SECRET
        return payload

    # 모바일 분기: 앱에서 전달한 client_id 기반 코드 교환
    payload["client_id"] = body.client_id
    return payload


def _extract_google_error_text(token_res: httpx.Response) -> str:
    raw = token_res.text.strip()
    if not raw:
        return f"status={token_res.status_code}"

    try:
        parsed = token_res.json()
    except json.JSONDecodeError:
        return raw

    if isinstance(parsed, dict):
        error = parsed.get("error")
        desc = parsed.get("error_description")
        if error and desc:
            return f"{error} - {desc}"
        if error:
            return str(error)
        if desc:
            return str(desc)
    return raw


@router.post("/token")
async def mobile_token(body: TokenRequest):
    token_payload = _build_google_token_payload(body)

    async with httpx.AsyncClient(timeout=15) as client:
        token_res = await client.post(
            GOOGLE_TOKEN_URL,
            data=token_payload,
        )

        if token_res.status_code != 200:
            detail = _extract_google_error_text(token_res)
            raise HTTPException(status_code=400, detail=f"Google OAuth failed: {detail}")

        access_token = token_res.json().get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="Google OAuth failed: missing access_token")

        userinfo_res = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if userinfo_res.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to fetch user info")

    info = userinfo_res.json()
    user_id = info.get("sub")
    if not user_id:
        raise HTTPException(status_code=400, detail="Failed to fetch user info")

    upsert_user_identity(
        user_id,
        email=info.get("email"),
        name=info.get("name"),
        picture=info.get("picture"),
    )

    return {
        "token": create_jwt(user_id),
        "user": {
            "uid": user_id,
            "name": info.get("name"),
            "picture": info.get("picture"),
            "email": info.get("email"),
            "persona_type": None,
            "character": resolve_character(None),
        },
    }


@router.get("/me")
def mobile_me(user_id: str = Depends(require_mobile_auth)):
    user = _get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "uid": user["id"],
        "name": user["name"],
        "picture": user["picture"],
        "email": user["email"],
        "persona_type": user["persona_type"],
        "character": resolve_character(user["persona_type"]),
    }
