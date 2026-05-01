"""Nomad journey stop API."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from utils.db import get_conn

router = APIRouter()
SESSION_KEY = "user_id"


class JourneyStopIn(BaseModel):
    city: str = Field(min_length=1, max_length=100)
    country: str = Field(min_length=1, max_length=100)
    country_code: str | None = Field(default=None, max_length=2)
    lat: float
    lng: float
    note: str = Field(max_length=10)


def _user_id(request: Request) -> str | None:
    return getattr(request.state, SESSION_KEY, None)


def _row_to_stop(cols: list[str], row: tuple) -> dict:
    data = dict(zip(cols, row))
    if data.get("created_at") is not None:
        data["created_at"] = data["created_at"].isoformat()
    return data


def _current_persona_type(user_id: str) -> str | None:
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("SELECT persona_type FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()
    return row[0] if row else None


@router.get("/journey/me")
def list_my_journey(request: Request):
    uid = _user_id(request)
    if not uid:
        raise HTTPException(401, "로그인이 필요합니다")

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, city, country, country_code, lat, lng, note,
                   persona_type, verified_method, created_at
            FROM nomad_journey_stops
            WHERE user_id = %s
            ORDER BY created_at ASC, id ASC
            """,
            (uid,),
        )
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
    return [_row_to_stop(cols, row) for row in rows]


@router.post("/journey/stops")
def create_journey_stop(request: Request, stop: JourneyStopIn):
    uid = _user_id(request)
    if not uid:
        raise HTTPException(401, "로그인이 필요합니다")

    persona_type = _current_persona_type(uid)
    now = datetime.now(timezone.utc)
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO nomad_journey_stops (
                user_id, city, country, country_code, lat, lng, note,
                persona_type, verified_method, created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'gps_city_confirmed', %s)
            RETURNING id, city, country, country_code, lat, lng, note,
                      persona_type, verified_method, created_at
            """,
            (
                uid,
                stop.city,
                stop.country,
                stop.country_code,
                stop.lat,
                stop.lng,
                stop.note,
                persona_type,
                now,
            ),
        )
        row = cur.fetchone()
        cols = [d[0] for d in cur.description]
    conn.commit()
    return _row_to_stop(cols, row)


@router.get("/journey/community")
def community_journey(
    persona_type: str | None = Query(default=None, max_length=50),
):
    conn = get_conn()
    params: tuple = ()
    where = ""
    if persona_type:
        where = "WHERE persona_type = %s"
        params = (persona_type,)

    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT city, country, MIN(country_code) AS country_code,
                   ROUND(AVG(lat)::numeric, 4)::float AS lat,
                   ROUND(AVG(lng)::numeric, 4)::float AS lng,
                   COUNT(*)::int AS cnt
            FROM nomad_journey_stops
            {where}
            GROUP BY city, country
            ORDER BY cnt DESC, city ASC
            LIMIT 100
            """,
            params,
        )
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in rows]
