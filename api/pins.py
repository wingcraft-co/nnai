"""핀 CRUD FastAPI 라우터."""
from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from utils.db import get_conn

router = APIRouter()
SESSION_KEY = "user_id"   # request.state의 속성명 (AuthMiddleware가 설정)


class PinIn(BaseModel):
    city: str
    display: str
    note: str
    lat: float
    lng: float
    user_lat: float | None = None
    user_lng: float | None = None


def _user_id(request: Request) -> str | None:
    return getattr(request.state, SESSION_KEY, None)


@router.get("/pins")
def list_pins(request: Request):
    uid = _user_id(request)
    if not uid:
        return []
    rows = get_conn().execute(
        "SELECT city, display, note, lat, lng, created_at FROM pins "
        "WHERE user_id=? ORDER BY created_at ASC", (uid,)
    ).fetchall()
    return [dict(r) for r in rows]


@router.post("/pins")
def add_pin(request: Request, pin: PinIn):
    uid = _user_id(request)
    if not uid:
        raise HTTPException(401, "로그인이 필요합니다")
    now = datetime.now(timezone.utc).isoformat()
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO pins(user_id,city,display,note,lat,lng,user_lat,user_lng,created_at) "
        "VALUES (?,?,?,?,?,?,?,?,?)",
        (uid, pin.city, pin.display, pin.note,
         pin.lat, pin.lng, pin.user_lat, pin.user_lng, now)
    )
    conn.commit()
    return {"id": cur.lastrowid, "city": pin.city, "created_at": now}


@router.get("/pins/community")
def community_pins():
    """전체 사용자 핀을 도시별로 집계."""
    rows = get_conn().execute(
        "SELECT city, MIN(display) display, ROUND(AVG(lat),4) lat, ROUND(AVG(lng),4) lng, "
        "COUNT(*) cnt FROM pins GROUP BY city ORDER BY cnt DESC LIMIT 100"
    ).fetchall()
    return [dict(r) for r in rows]
