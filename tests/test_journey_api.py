import os
import pytest

TEST_DB_URL = os.environ.get("TEST_DATABASE_URL")

requires_db = pytest.mark.skipif(
    not TEST_DB_URL,
    reason="TEST_DATABASE_URL 환경변수가 없으면 스킵",
)

from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.middleware.base import BaseHTTPMiddleware

from utils.db import init_db


def _make_app(user_id: str | None):
    from api.journey import router
    from utils import db as db_mod

    app = FastAPI()

    class FakeAuth(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            request.state.user_id = user_id
            return await call_next(request)

    app.add_middleware(FakeAuth)
    app.include_router(router, prefix="/api")

    db_mod._conn = init_db(TEST_DB_URL)
    import api.journey as journey_mod
    journey_mod.get_conn = lambda: db_mod._conn
    with db_mod._conn.cursor() as cur:
        cur.execute("DELETE FROM nomad_journey_stops")
        cur.execute("DELETE FROM users")
        cur.execute(
            """
            INSERT INTO users (id, email, name, picture, persona_type, created_at)
            VALUES (%s, %s, %s, %s, %s, NOW()::text)
            """,
            ("uid1", "uid1@example.com", "Tester 1", "", "planner"),
        )
        cur.execute(
            """
            INSERT INTO users (id, email, name, picture, persona_type, created_at)
            VALUES (%s, %s, %s, %s, %s, NOW()::text)
            """,
            ("uid2", "uid2@example.com", "Tester 2", "", "wanderer"),
        )
        cur.execute(
            """
            INSERT INTO users (id, email, name, picture, persona_type, created_at)
            VALUES (%s, %s, %s, %s, %s, NOW()::text)
            """,
            ("uid3", "uid3@example.com", "Tester 3", "", "planner"),
        )
    db_mod._conn.commit()
    return app


def _stop_payload(**overrides):
    payload = {
        "city": "Kuala Lumpur",
        "country": "Malaysia",
        "country_code": "MY",
        "lat": 3.139,
        "lng": 101.6869,
        "note": "KL좋아",
    }
    payload.update(overrides)
    return payload


def test_geocode_supported_city_match_uses_canonical_data():
    from utils.geocoding import geocode_city_candidates

    body = geocode_city_candidates("Lisbon", "PT", provider=lambda *_args, **_kwargs: [])

    assert body["country_code"] == "PT"
    assert body["results"][0]["supported"] is True
    assert body["results"][0]["supported_city_id"] == "LIS"
    assert body["results"][0]["location_source"] == "nnai_supported"
    assert body["results"][0]["geocode_result_id"] is None
    assert body["results"][0]["lat"] == 38.7223
    assert body["results"][0]["lng"] == -9.1393


def test_geocode_filters_provider_results_to_selected_country():
    from utils.geocoding import geocode_city_candidates

    def provider(query, country_code):
        return [
            {
                "city": "Granada",
                "country": "Spain",
                "country_code": "ES",
                "lat": 37.1773,
                "lng": -3.5986,
                "display_name": "Granada, Andalusia, Spain",
                "place_id": "es-granada",
                "confidence": 0.9,
            },
            {
                "city": "Granada",
                "country": "Nicaragua",
                "country_code": "NI",
                "lat": 11.9344,
                "lng": -85.956,
                "display_name": "Granada, Nicaragua",
                "place_id": "ni-granada",
                "confidence": 0.8,
            },
        ]

    body = geocode_city_candidates("Granada", "ES", provider=provider)

    assert [row["country_code"] for row in body["results"]] == ["ES"]
    assert body["results"][0]["supported"] is False
    assert body["results"][0]["geocode_result_id"].startswith("geo_")


def test_geocode_result_id_survives_process_local_cache_clear():
    from utils import geocoding

    def provider(_query, _country_code):
        return [{
            "city": "Granada",
            "country": "Spain",
            "country_code": "ES",
            "lat": 37.1773,
            "lng": -3.5986,
            "display_name": "Granada, Spain",
            "place_id": "es-granada",
            "confidence": 0.9,
        }]

    result_id = geocoding.geocode_city_candidates("Granada", "ES", provider=provider)["results"][0]["geocode_result_id"]
    geocoding._RESULT_CACHE.clear()

    assert geocoding.get_cached_geocode_result(result_id)["city"] == "Granada"


def test_geocode_query_cache_is_bounded():
    from utils import geocoding

    geocoding._QUERY_CACHE.clear()
    for i in range(geocoding.MAX_QUERY_CACHE_SIZE + 5):
        geocoding.geocode_city_candidates(f"City {i}", "ES", provider=lambda *_args: [])

    assert len(geocoding._QUERY_CACHE) <= geocoding.MAX_QUERY_CACHE_SIZE


def test_geocode_route_returns_503_for_provider_failure(monkeypatch):
    from api import journey

    app = FastAPI()
    app.include_router(journey.router, prefix="/api")
    monkeypatch.setattr(journey, "geocode_city_candidates", lambda *_args: (_ for _ in ()).throw(OSError("boom")))

    response = TestClient(app).post("/api/journey/geocode", json={"query": "Granada", "country_code": "ES"})

    assert response.status_code == 503


def test_geocode_route_rate_limits_repeated_public_requests(monkeypatch):
    from api import journey

    app = FastAPI()
    app.include_router(journey.router, prefix="/api")
    journey._GEOCODE_RATE_LIMIT.clear()
    monkeypatch.setattr(
        journey,
        "geocode_city_candidates",
        lambda query, country_code: {"query": query, "country_code": country_code, "results": [], "attribution": ""},
    )
    client = TestClient(app)

    responses = [
        client.post("/api/journey/geocode", json={"query": "Granada", "country_code": "ES"})
        for _ in range(journey.GEOCODE_RATE_LIMIT + 1)
    ]

    assert responses[-1].status_code == 429


def test_create_stop_rejects_invalid_coordinates_without_db():
    from pydantic import ValidationError
    from api.journey import JourneyStopIn

    with pytest.raises(ValidationError):
        JourneyStopIn(city="Bad", country="Nowhere", country_code="NO", lat=91, lng=0, note="")


def test_create_stop_rejects_ambiguous_new_save_body_without_db():
    from pydantic import ValidationError
    from api.journey import JourneyStopIn

    with pytest.raises(ValidationError):
        JourneyStopIn(city_id="LIS", geocode_result_id="geo_fake", note="")


def test_create_stop_rejects_unsupported_without_gps_without_db():
    from fastapi import HTTPException
    from api.journey import JourneyStopIn, _payload_from_stop
    from utils import geocoding

    result_id = geocoding._sign_result({
        "city": "Granada",
        "country": "Spain",
        "country_code": "ES",
        "lat": 37.1773,
        "lng": -3.5986,
        "supported": False,
        "supported_city_id": None,
        "location_source": "nominatim",
        "display_name": "Granada, Spain",
        "geocode_place_id": "es-granada",
        "geocode_confidence": 0.9,
    })

    with pytest.raises(HTTPException) as exc:
        _payload_from_stop(JourneyStopIn(geocode_result_id=result_id, gps_verified=False))

    assert exc.value.status_code == 422


def test_payload_from_supported_city_resolves_flag_color_without_db():
    from api.journey import JourneyStopIn, _payload_from_stop

    green = _payload_from_stop(JourneyStopIn(city_id="LIS", gps_verified=True))
    red = _payload_from_stop(JourneyStopIn(city_id="LIS", gps_verified=False))

    assert green["flag_color"] == "green"
    assert green["gps_verified"] is True
    assert red["flag_color"] == "red"
    assert red["gps_verified"] is False


def test_required_schema_includes_journey_metadata_columns():
    from utils import db

    required = db._REQUIRED_SCHEMA_COLUMNS["nomad_journey_stops"]

    assert {
        "supported_city_id",
        "is_supported_city",
        "location_source",
        "line_style",
        "geocode_place_id",
        "geocode_confidence",
        "geocoded_at",
    }.issubset(required)
    assert {
        "gps_verified",
        "flag_color",
        "github_issue_url",
        "github_issue_key",
        "github_issue_status",
    }.issubset(required)


@requires_db
def test_create_stop_requires_auth():
    client = TestClient(_make_app(None))

    response = client.post("/api/journey/stops", json=_stop_payload())

    assert response.status_code == 401


@requires_db
def test_create_stop_saves_persona_and_returns_stop():
    client = TestClient(_make_app("uid1"))

    response = client.post("/api/journey/stops", json=_stop_payload())

    assert response.status_code == 200
    body = response.json()
    assert body["city"] == "Kuala Lumpur"
    assert body["country"] == "Malaysia"
    assert body["note"] == "KL좋아"
    assert body["persona_type"] == "planner"
    assert body["verified_method"] == "gps_city_confirmed"
    assert "id" in body


@requires_db
def test_create_supported_city_id_stop_sets_solid_metadata():
    client = TestClient(_make_app("uid1"))

    response = client.post("/api/journey/stops", json={"city_id": "LIS", "gps_verified": True, "note": "리스본"})

    assert response.status_code == 200
    body = response.json()
    assert body["city"] == "Lisbon"
    assert body["country_code"] == "PT"
    assert body["supported_city_id"] == "LIS"
    assert body["is_supported_city"] is True
    assert body["location_source"] == "nnai_supported"
    assert body["line_style"] == "solid"
    assert body["gps_verified"] is True
    assert body["flag_color"] == "green"
    assert body["github_issue_status"] == "not_required"


@requires_db
def test_create_supported_city_without_gps_sets_red_flag():
    client = TestClient(_make_app("uid1"))

    response = client.post("/api/journey/stops", json={"city_id": "LIS", "gps_verified": False, "note": "리스본"})

    assert response.status_code == 200
    body = response.json()
    assert body["gps_verified"] is False
    assert body["flag_color"] == "red"


@requires_db
def test_create_unsupported_geocode_stop_sets_dashed_metadata():
    from utils.geocoding import geocode_city_candidates

    def provider(_query, _country_code):
        return [{
            "city": "Granada",
            "country": "Spain",
            "country_code": "ES",
            "lat": 37.1773,
            "lng": -3.5986,
            "display_name": "Granada, Spain",
            "place_id": "es-granada",
            "confidence": 0.9,
        }]

    result_id = geocode_city_candidates("Granada", "ES", provider=provider)["results"][0]["geocode_result_id"]
    client = TestClient(_make_app("uid1"))

    response = client.post("/api/journey/stops", json={"geocode_result_id": result_id, "gps_verified": True, "note": "그라나다"})

    assert response.status_code == 200
    body = response.json()
    assert body["city"] == "Granada"
    assert body["supported_city_id"] is None
    assert body["is_supported_city"] is False
    assert body["location_source"] == "nominatim"
    assert body["line_style"] == "dashed"
    assert body["gps_verified"] is True
    assert body["flag_color"] == "yellow"


@requires_db
def test_create_unsupported_geocode_stop_creates_github_issue(monkeypatch):
    from utils.geocoding import geocode_city_candidates
    import api.journey as journey_mod

    def provider(_query, _country_code):
        return [{
            "city": "Granada",
            "country": "Spain",
            "country_code": "ES",
            "lat": 37.1773,
            "lng": -3.5986,
            "display_name": "Granada, Spain",
            "place_id": "es-granada",
            "confidence": 0.9,
        }]

    result_id = geocode_city_candidates("Granada", "ES", provider=provider)["results"][0]["geocode_result_id"]
    calls = []
    monkeypatch.setattr(journey_mod, "ensure_city_request_issue", lambda payload: calls.append(payload) or {
        "github_issue_url": "https://github.com/wingcraft-co/nnai/issues/123",
        "github_issue_key": "city-request:ES:granada",
        "github_issue_status": "created",
    })
    client = TestClient(_make_app("uid1"))

    response = client.post("/api/journey/stops", json={"geocode_result_id": result_id, "gps_verified": True, "note": "추억"})

    assert response.status_code == 200
    body = response.json()
    assert body["flag_color"] == "yellow"
    assert body["github_issue_status"] == "created"
    assert body["github_issue_url"].endswith("/123")
    assert calls[0]["github_issue_key"] == "city-request:ES:granada"


@requires_db
def test_github_issue_failure_does_not_block_yellow_stop(monkeypatch):
    from utils.geocoding import geocode_city_candidates
    import api.journey as journey_mod

    def provider(_query, _country_code):
        return [{
            "city": "Granada",
            "country": "Spain",
            "country_code": "ES",
            "lat": 37.1773,
            "lng": -3.5986,
            "display_name": "Granada, Spain",
            "place_id": "es-granada",
            "confidence": 0.9,
        }]

    result_id = geocode_city_candidates("Granada", "ES", provider=provider)["results"][0]["geocode_result_id"]
    monkeypatch.setattr(journey_mod, "ensure_city_request_issue", lambda _payload: (_ for _ in ()).throw(OSError("github down")))
    client = TestClient(_make_app("uid1"))

    response = client.post("/api/journey/stops", json={"geocode_result_id": result_id, "gps_verified": True})

    assert response.status_code == 200
    body = response.json()
    assert body["flag_color"] == "yellow"
    assert body["github_issue_status"] == "failed"


@requires_db
def test_create_stop_rejects_note_over_ten_characters():
    client = TestClient(_make_app("uid1"))

    response = client.post("/api/journey/stops", json=_stop_payload(note="12345678901"))

    assert response.status_code == 422


@requires_db
def test_my_journey_returns_only_current_user_in_chronological_order():
    uid1 = TestClient(_make_app("uid1"))
    uid1.post("/api/journey/stops", json=_stop_payload(city="Kuala Lumpur", note="첫도시"))
    uid1.post(
        "/api/journey/stops",
        json=_stop_payload(city="Chiang Mai", country="Thailand", country_code="TH", lat=18.7883, lng=98.9853, note="두번째"),
    )

    uid2 = TestClient(_make_app("uid2"))
    uid2.post(
        "/api/journey/stops",
        json=_stop_payload(city="Lisbon", country="Portugal", country_code="PT", lat=38.7223, lng=-9.1393, note="숨김"),
    )

    response = uid1.get("/api/journey/me")

    assert response.status_code == 200
    cities = [row["city"] for row in response.json()]
    assert cities == ["Kuala Lumpur", "Chiang Mai"]


@requires_db
def test_community_excludes_legacy_rows_from_public_aggregate():
    client = TestClient(_make_app("uid1"))
    client.post("/api/journey/stops", json=_stop_payload(note="개인글"))
    client.post("/api/journey/stops", json=_stop_payload(note="또왔음"))

    response = client.get("/api/journey/community")

    assert response.status_code == 200
    assert response.json() == []


@requires_db
def test_community_supported_rows_require_three_distinct_users():
    app = _make_app("uid1")
    client = TestClient(app)
    from utils import db as db_mod

    with db_mod._conn.cursor() as cur:
        for uid in ["uid1", "uid2", "uid3"]:
            cur.execute(
                """
                INSERT INTO nomad_journey_stops(
                    user_id, city, country, country_code, note, lat, lng,
                    supported_city_id, is_supported_city, location_source, line_style
                )
                VALUES (%s, 'Lisbon', 'Portugal', 'PT', '', 38.7223, -9.1393,
                        'LIS', TRUE, 'nnai_supported', 'solid')
                """,
                (uid,),
            )
    db_mod._conn.commit()

    response = client.get("/api/journey/community")

    assert response.status_code == 200
    body = response.json()
    assert body[0]["city"] == "Lisbon"
    assert body[0]["cnt"] == 3
    assert body[0]["supported_city_id"] == "LIS"
    assert body[0]["line_style"] == "solid"
    assert "note" not in body[0]
    assert "user_id" not in body[0]


def test_legacy_pins_routes_are_not_mounted_on_server():
    import server

    paths = {route.path for route in server.app.routes}

    assert "/api/pins" not in paths
    assert "/api/pins/community" not in paths
