"""모바일 앱 전용 Discover 라우터."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from utils.data_paths import resolve_data_path
from utils.db import get_conn
from utils.mobile_auth import require_mobile_auth

router = APIRouter(prefix="/api/mobile", tags=["mobile-discover"])

_city_rows_cache: list[dict] | None = None


def _load_city_rows() -> list[dict]:
    global _city_rows_cache
    if _city_rows_cache is None:
        path = resolve_data_path("city_scores.json")
        with open(path, encoding="utf-8") as f:
            _city_rows_cache = json.load(f).get("cities", [])
    return _city_rows_cache


class CityStayCreate(BaseModel):
    city: str
    country: str | None = None
    arrived_at: str | None = None
    left_at: str | None = None
    visa_expires_at: str | None = None
    budget_total: float | None = None
    budget_remaining: float | None = None


class CityStayPatch(BaseModel):
    city: str | None = None
    country: str | None = None
    arrived_at: str | None = None
    left_at: str | None = None
    visa_expires_at: str | None = None
    budget_total: float | None = None
    budget_remaining: float | None = None


def _serialize_city_stay(row: tuple) -> dict:
    return {
        "id": row[0],
        "city": row[1],
        "country": row[2],
        "arrived_at": row[3],
        "left_at": row[4],
        "visa_expires_at": row[5],
        "budget_total": row[6],
        "budget_remaining": row[7],
        "created_at": str(row[8]),
        "updated_at": str(row[9]),
    }


@router.get("/cities")
def get_cities(user_id: str = Depends(require_mobile_auth)):
    del user_id  # 인증 목적만 사용
    rows = sorted(
        _load_city_rows(),
        key=lambda c: (c.get("nomad_score") or 0),
        reverse=True,
    )[:50]

    return [
        {
            "city_id": r.get("id"),
            "city": r.get("city"),
            "city_kr": r.get("city_kr"),
            "country": r.get("country"),
            "country_id": r.get("country_id"),
            "monthly_cost_usd": r.get("monthly_cost_usd"),
            "internet_mbps": r.get("internet_mbps"),
            "safety_score": r.get("safety_score"),
            "english_score": r.get("english_score"),
            "nomad_score": r.get("nomad_score"),
        }
        for r in rows
    ]


@router.get("/cities/{city_id}")
def get_city(city_id: str, user_id: str = Depends(require_mobile_auth)):
    del user_id  # 인증 목적만 사용
    row = next((c for c in _load_city_rows() if str(c.get("id", "")).upper() == city_id.upper()), None)

    if not row:
        raise HTTPException(status_code=404, detail="City not found")

    return {
        "city_id": row.get("id"),
        "city": row.get("city"),
        "city_kr": row.get("city_kr"),
        "country": row.get("country"),
        "country_id": row.get("country_id"),
        "monthly_cost_usd": row.get("monthly_cost_usd"),
        "internet_mbps": row.get("internet_mbps"),
        "safety_score": row.get("safety_score"),
        "english_score": row.get("english_score"),
        "nomad_score": row.get("nomad_score"),
        "tax_residency_days": row.get("tax_residency_days"),
        "data_verified_date": row.get("data_verified_date"),
    }


@router.get("/circles")
def get_circles(user_id: str = Depends(require_mobile_auth)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT c.id, c.name, c.description, c.member_count,
                   EXISTS(
                       SELECT 1 FROM circle_members
                       WHERE circle_id = c.id AND user_id = %s
                   ) AS joined
            FROM circles c
            ORDER BY c.member_count DESC
            """,
            (user_id,),
        )
        rows = cur.fetchall()

    return [
        {
            "id": r[0],
            "name": r[1],
            "description": r[2],
            "member_count": r[3],
            "joined": r[4],
        }
        for r in rows
    ]


@router.post("/circles/{circle_id}/join")
def toggle_circle(circle_id: int, user_id: str = Depends(require_mobile_auth)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM circles WHERE id = %s", (circle_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Circle not found")

        cur.execute(
            "SELECT 1 FROM circle_members WHERE circle_id = %s AND user_id = %s",
            (circle_id, user_id),
        )
        is_member = cur.fetchone() is not None

        if is_member:
            cur.execute(
                "DELETE FROM circle_members WHERE circle_id = %s AND user_id = %s",
                (circle_id, user_id),
            )
            cur.execute(
                "UPDATE circles SET member_count = GREATEST(0, member_count - 1) WHERE id = %s",
                (circle_id,),
            )
        else:
            cur.execute(
                "INSERT INTO circle_members (circle_id, user_id) VALUES (%s, %s)",
                (circle_id, user_id),
            )
            cur.execute(
                "UPDATE circles SET member_count = member_count + 1 WHERE id = %s",
                (circle_id,),
            )
    conn.commit()

    return {"joined": not is_member}


@router.get("/city-stays")
def get_city_stays(user_id: str = Depends(require_mobile_auth)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, city, country, arrived_at, left_at, visa_expires_at,
                   budget_total, budget_remaining, created_at, updated_at
            FROM city_stays
            WHERE user_id = %s
            ORDER BY created_at DESC
            """,
            (user_id,),
        )
        rows = cur.fetchall()
    return [_serialize_city_stay(r) for r in rows]


@router.post("/city-stays", status_code=201)
def create_city_stay(body: CityStayCreate, user_id: str = Depends(require_mobile_auth)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO city_stays
                (user_id, city, country, arrived_at, left_at, visa_expires_at, budget_total, budget_remaining)
            VALUES
                (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, city, country, arrived_at, left_at, visa_expires_at,
                      budget_total, budget_remaining, created_at, updated_at
            """,
            (
                user_id,
                body.city,
                body.country,
                body.arrived_at,
                body.left_at,
                body.visa_expires_at,
                body.budget_total,
                body.budget_remaining,
            ),
        )
        row = cur.fetchone()
    conn.commit()
    return _serialize_city_stay(row)


@router.patch("/city-stays/{stay_id}")
def patch_city_stay(stay_id: int, body: CityStayPatch, user_id: str = Depends(require_mobile_auth)):
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="At least one field is required")

    assignments = ", ".join(f"{k} = %s" for k in updates.keys())
    values = list(updates.values())
    values.extend([user_id, stay_id])

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            f"""
            UPDATE city_stays
            SET {assignments},
                updated_at = NOW()
            WHERE user_id = %s AND id = %s
            RETURNING id, city, country, arrived_at, left_at, visa_expires_at,
                      budget_total, budget_remaining, created_at, updated_at
            """,
            tuple(values),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="City stay not found")
    conn.commit()
    return _serialize_city_stay(row)


@router.post("/city-stays/{stay_id}/leave")
def leave_city_stay(stay_id: int, user_id: str = Depends(require_mobile_auth)):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE city_stays
            SET left_at = COALESCE(left_at, NOW()::date::text),
                updated_at = NOW()
            WHERE user_id = %s AND id = %s
            RETURNING id, city, country, arrived_at, left_at, visa_expires_at,
                      budget_total, budget_remaining, created_at, updated_at
            """,
            (user_id, stay_id),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="City stay not found")
    conn.commit()
    return _serialize_city_stay(row)
