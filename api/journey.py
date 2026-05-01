"""Nomad journey stop API."""
from __future__ import annotations

from datetime import datetime, timezone
import json
import math
import time

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field, model_validator

from utils.db import get_conn
from utils.geocoding import (
    geocode_city_candidates,
    finite_coordinate,
    get_cached_geocode_result,
    supported_city_by_id,
    supported_city_coordinate,
)

router = APIRouter()
SESSION_KEY = "user_id"
GEOCODE_RATE_LIMIT = 12
GEOCODE_RATE_WINDOW_SECONDS = 60
_GEOCODE_RATE_LIMIT: dict[str, list[float]] = {}


class JourneyStopIn(BaseModel):
    city: str | None = Field(default=None, min_length=1, max_length=100)
    country: str | None = Field(default=None, min_length=1, max_length=100)
    country_code: str | None = Field(default=None, max_length=2)
    lat: float | None = None
    lng: float | None = None
    note: str = Field(default="", max_length=10)
    city_id: str | None = Field(default=None, max_length=20)
    geocode_result_id: str | None = Field(default=None, max_length=1200)

    @model_validator(mode="after")
    def validate_shape(self):
        if self.city_id and self.geocode_result_id:
            raise ValueError("city_id and geocode_result_id are mutually exclusive")
        if self.city_id or self.geocode_result_id:
            return self
        if not self.city or not self.country or self.lat is None or self.lng is None:
            raise ValueError("legacy saves require city, country, lat, and lng")
        if not math.isfinite(float(self.lat)) or not -90 <= float(self.lat) <= 90:
            raise ValueError("lat must be between -90 and 90")
        if not math.isfinite(float(self.lng)) or not -180 <= float(self.lng) <= 180:
            raise ValueError("lng must be between -180 and 180")
        return self


class JourneyGeocodeIn(BaseModel):
    query: str = Field(min_length=2, max_length=80)
    country_code: str = Field(min_length=2, max_length=2)


def _user_id(request: Request) -> str | None:
    return getattr(request.state, SESSION_KEY, None)


def _row_to_stop(cols: list[str], row: tuple) -> dict:
    data = dict(zip(cols, row))
    if data.get("created_at") is not None:
        data["created_at"] = data["created_at"].isoformat()
    if data.get("geocoded_at") is not None:
        data["geocoded_at"] = data["geocoded_at"].isoformat()
    return data


def _current_persona_type(user_id: str) -> str | None:
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("SELECT persona_type FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()
    return row[0] if row else None


def _geocode_rate_subject(request: Request) -> str:
    user_id = _user_id(request)
    if user_id:
        return f"user:{user_id}"
    client = request.client.host if request.client else "unknown"
    return f"ip:{client}"


def _enforce_geocode_rate_limit(request: Request) -> None:
    now = time.monotonic()
    subject = _geocode_rate_subject(request)
    window_start = now - GEOCODE_RATE_WINDOW_SECONDS
    hits = [hit for hit in _GEOCODE_RATE_LIMIT.get(subject, []) if hit >= window_start]
    if len(hits) >= GEOCODE_RATE_LIMIT:
        _GEOCODE_RATE_LIMIT[subject] = hits
        raise HTTPException(429, "geocode rate limit exceeded")
    hits.append(now)
    _GEOCODE_RATE_LIMIT[subject] = hits


def _payload_from_stop(stop: JourneyStopIn) -> dict:
    if stop.city_id:
        city = supported_city_by_id(stop.city_id)
        if not city:
            raise HTTPException(422, "지원 도시를 찾을 수 없습니다")
        coordinate = supported_city_coordinate(str(city["id"]))
        if not coordinate:
            raise HTTPException(422, "지원 도시 좌표를 찾을 수 없습니다")
        lat, lng = coordinate
        return {
            "city": city["city"],
            "country": city["country"],
            "country_code": city["country_id"],
            "lat": lat,
            "lng": lng,
            "verified_method": "nnai_supported_city_selected",
            "supported_city_id": city["id"],
            "is_supported_city": True,
            "location_source": "nnai_supported",
            "line_style": "solid",
            "geocode_place_id": None,
            "geocode_confidence": None,
            "geocoded_at": None,
        }

    if stop.geocode_result_id:
        result = get_cached_geocode_result(stop.geocode_result_id)
        if not result:
            raise HTTPException(422, "검증된 도시 검색 결과가 만료되었습니다")
        return {
            "city": result["city"],
            "country": result["country"],
            "country_code": result["country_code"],
            "lat": finite_coordinate(result["lat"], -90, 90),
            "lng": finite_coordinate(result["lng"], -180, 180),
            "verified_method": "backend_geocoded_unsupported",
            "supported_city_id": None,
            "is_supported_city": False,
            "location_source": result["location_source"],
            "line_style": "dashed",
            "geocode_place_id": result.get("geocode_place_id"),
            "geocode_confidence": result.get("geocode_confidence"),
            "geocoded_at": datetime.now(timezone.utc),
        }

    return {
        "city": stop.city,
        "country": stop.country,
        "country_code": stop.country_code,
        "lat": finite_coordinate(stop.lat, -90, 90),
        "lng": finite_coordinate(stop.lng, -180, 180),
        "verified_method": "gps_city_confirmed",
        "supported_city_id": None,
        "is_supported_city": False,
        "location_source": "legacy",
        "line_style": "solid",
        "geocode_place_id": None,
        "geocode_confidence": None,
        "geocoded_at": None,
    }


@router.post("/journey/geocode")
def geocode_journey_city(body: JourneyGeocodeIn, request: Request):
    _enforce_geocode_rate_limit(request)
    try:
        return geocode_city_candidates(body.query, body.country_code)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except (OSError, TimeoutError, json.JSONDecodeError) as exc:
        raise HTTPException(503, "geocoder_unavailable") from exc


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
                   persona_type, verified_method, supported_city_id,
                   is_supported_city, location_source, line_style,
                   geocode_place_id, geocode_confidence, geocoded_at,
                   created_at
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
    payload = _payload_from_stop(stop)
    now = datetime.now(timezone.utc)
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO nomad_journey_stops (
                user_id, city, country, country_code, lat, lng, note,
                persona_type, verified_method, supported_city_id,
                is_supported_city, location_source, line_style,
                geocode_place_id, geocode_confidence, geocoded_at,
                created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, city, country, country_code, lat, lng, note,
                      persona_type, verified_method, supported_city_id,
                      is_supported_city, location_source, line_style,
                      geocode_place_id, geocode_confidence, geocoded_at,
                      created_at
            """,
            (
                uid,
                payload["city"],
                payload["country"],
                payload["country_code"],
                payload["lat"],
                payload["lng"],
                stop.note,
                persona_type,
                payload["verified_method"],
                payload["supported_city_id"],
                payload["is_supported_city"],
                payload["location_source"],
                payload["line_style"],
                payload["geocode_place_id"],
                payload["geocode_confidence"],
                payload["geocoded_at"],
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
    where_parts = ["location_source <> 'legacy'"]
    if persona_type:
        where_parts.append("persona_type = %s")
        params = (persona_type,)
    where = "WHERE " + " AND ".join(where_parts)

    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT city, country, MIN(country_code) AS country_code,
                   ROUND(AVG(lat)::numeric, 4)::float AS lat,
                   ROUND(AVG(lng)::numeric, 4)::float AS lng,
                   COUNT(DISTINCT user_id)::int AS cnt,
                   MIN(supported_city_id) AS supported_city_id,
                   CASE WHEN BOOL_OR(is_supported_city) THEN 'solid' ELSE 'dashed' END AS line_style
            FROM nomad_journey_stops
            {where}
            GROUP BY city, country
            HAVING COUNT(DISTINCT user_id) >= 3
            ORDER BY cnt DESC, city ASC
            LIMIT 100
            """,
            params,
        )
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in rows]
