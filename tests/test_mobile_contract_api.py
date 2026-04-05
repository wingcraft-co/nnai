import os
import sys
import types
import uuid

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from utils.db import init_db

TEST_DB_URL = os.environ.get("TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not TEST_DB_URL,
    reason="TEST_DATABASE_URL 환경변수가 없으면 스킵",
)


def _auth_headers(uid: str) -> dict[str, str]:
    import utils.mobile_auth as mobile_auth

    mobile_auth.JWT_SECRET = "test-mobile-secret"
    token = mobile_auth.create_jwt(uid)
    return {"Authorization": f"Bearer {token}"}


def _make_app(uid: str) -> FastAPI:
    from api.mobile_discover import router as discover_router
    from api.mobile_feed import router as feed_router
    from api.mobile_plans import router as plans_router
    from api.mobile_profile import router as profile_router
    from api.mobile_recommend import router as recommend_router
    from api.mobile_type_actions import router as type_actions_router
    from api.mobile_uploads import router as uploads_router

    import utils.db as db_mod

    app = FastAPI()
    app.include_router(feed_router)
    app.include_router(discover_router)
    app.include_router(plans_router)
    app.include_router(profile_router)
    app.include_router(recommend_router)
    app.include_router(type_actions_router)
    app.include_router(uploads_router)

    db_mod._conn = init_db(TEST_DB_URL)
    with db_mod._conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO users (id, email, name, picture, created_at)
            VALUES (%s, %s, %s, %s, NOW()::text)
            ON CONFLICT (id) DO UPDATE
              SET email = EXCLUDED.email,
                  name = EXCLUDED.name,
                  picture = EXCLUDED.picture
            """,
            (uid, f"{uid}@example.com", "Mobile Tester", "https://example.com/p.png"),
        )
    db_mod._conn.commit()
    return app


def test_profile_includes_required_persona_type_field():
    uid = f"u_{uuid.uuid4().hex}"
    client = TestClient(_make_app(uid))

    r = client.get("/api/mobile/profile", headers=_auth_headers(uid))

    assert r.status_code == 200
    body = r.json()
    assert body["uid"] == uid
    assert "persona_type" in body
    assert body["persona_type"] is None
    assert body["character"] == "rocky"
    assert "stats" in body and {"pins", "posts", "circles"}.issubset(set(body["stats"].keys()))


def test_mobile_recommend_persists_persona_type_for_user():
    uid = f"u_{uuid.uuid4().hex}"
    client = TestClient(_make_app(uid))
    headers = _auth_headers(uid)

    fake_app = types.SimpleNamespace()
    fake_app.nomad_advisor = lambda **kwargs: ("md", [], {"_user_profile": kwargs})
    fake_app.show_city_detail_with_nationality = lambda **kwargs: "detail"
    original_app = sys.modules.get("app")
    sys.modules["app"] = fake_app

    try:
        payload = {
            "nationality": "Korean",
            "income_krw": 500,
            "immigration_purpose": "원격 근무",
            "lifestyle": ["저물가"],
            "languages": ["영어 업무 수준"],
            "timeline": "1년 장기 체류",
            "persona_type": "local",
        }

        r = client.post("/api/mobile/recommend", json=payload, headers=headers)
        assert r.status_code == 200

        profile = client.get("/api/mobile/profile", headers=headers)
        assert profile.status_code == 200
        assert profile.json()["persona_type"] == "local"
        assert profile.json()["character"] == "local"
    finally:
        if original_app is None:
            sys.modules.pop("app", None)
        else:
            sys.modules["app"] = original_app


def test_city_stays_contract_lifecycle():
    uid = f"u_{uuid.uuid4().hex}"
    client = TestClient(_make_app(uid))
    headers = _auth_headers(uid)

    create_payload = {
        "city": "Lisbon",
        "country": "Portugal",
        "arrived_at": "2026-04-01",
        "visa_expires_at": "2026-09-01",
        "budget_total": 2500,
        "budget_remaining": 2000,
    }
    created = client.post("/api/mobile/city-stays", json=create_payload, headers=headers)
    assert created.status_code == 201
    c = created.json()

    required_fields = {
        "id",
        "city",
        "country",
        "arrived_at",
        "left_at",
        "visa_expires_at",
        "budget_total",
        "budget_remaining",
        "created_at",
        "updated_at",
    }
    assert required_fields.issubset(set(c.keys()))

    fetched = client.get("/api/mobile/city-stays", headers=headers)
    assert fetched.status_code == 200
    assert any(row["id"] == c["id"] for row in fetched.json())

    patched = client.patch(
        f"/api/mobile/city-stays/{c['id']}",
        json={"budget_remaining": 1750, "left_at": "2026-05-01"},
        headers=headers,
    )
    assert patched.status_code == 200
    p = patched.json()
    assert p["budget_remaining"] == 1750
    assert p["left_at"] == "2026-05-01"

    left = client.post(f"/api/mobile/city-stays/{c['id']}/leave", headers=headers)
    assert left.status_code == 200
    assert left.json()["left_at"] is not None


def test_wanderer_hops_contract_and_status_constraints():
    uid = f"u_{uuid.uuid4().hex}"
    client = TestClient(_make_app(uid))
    headers = _auth_headers(uid)

    created = client.post(
        "/api/mobile/type-actions/wanderer/hops",
        json={
            "from_city": "Seoul",
            "to_city": "Tokyo",
            "status": "planned",
            "conditions": [{"id": "visa", "label": "Visa ready", "is_done": False}],
            "is_focus": False,
        },
        headers=headers,
    )
    assert created.status_code == 201
    c = created.json()
    assert c["status"] == "planned"
    assert isinstance(c["conditions"], list)
    assert isinstance(c["is_focus"], bool)

    patched = client.patch(
        f"/api/mobile/type-actions/wanderer/hops/{c['id']}",
        json={"status": "booked", "is_focus": True},
        headers=headers,
    )
    assert patched.status_code == 200
    assert patched.json()["status"] == "booked"
    assert patched.json()["is_focus"] is True

    listed = client.get("/api/mobile/type-actions/wanderer/hops", headers=headers)
    assert listed.status_code == 200
    for row in listed.json():
        assert row["status"] in {"planned", "booked"}
        assert isinstance(row["conditions"], list)
        assert isinstance(row["is_focus"], bool)

    invalid = client.post(
        "/api/mobile/type-actions/wanderer/hops",
        json={"from_city": "A", "to_city": "B", "status": "visited"},
        headers=headers,
    )
    assert invalid.status_code == 422


def test_type_actions_and_upload_smoke():
    uid = f"u_{uuid.uuid4().hex}"
    client = TestClient(_make_app(uid))
    headers = _auth_headers(uid)

    board = client.post(
        "/api/mobile/type-actions/planner/boards",
        json={"country": "PT", "city": "Lisbon", "title": "Q2 Move"},
        headers=headers,
    )
    assert board.status_code == 201
    board_id = board.json()["id"]

    task = client.post(
        f"/api/mobile/type-actions/planner/boards/{board_id}/tasks",
        json={"text": "Book flight", "due_date": "2026-06-01", "sort_order": 1},
        headers=headers,
    )
    assert task.status_code == 201
    task_id = task.json()["id"]
    assert task.json()["text"] == "Book flight"

    patched_task = client.patch(
        f"/api/mobile/type-actions/planner/tasks/{task_id}",
        json={"is_done": True},
        headers=headers,
    )
    assert patched_task.status_code == 200
    assert patched_task.json()["is_done"] is True

    spin = client.post(
        "/api/mobile/type-actions/free-spirit/spins",
        json={"lat": 37.56, "lng": 126.97},
        headers=headers,
    )
    assert spin.status_code == 201
    assert "spin_id" in spin.json()
    assert "selected" in spin.json()

    local_saved = client.get("/api/mobile/type-actions/local/events/saved", headers=headers)
    assert local_saved.status_code == 200

    saved = client.post(
        "/api/mobile/type-actions/local/events/save",
        json={
            "source": "google_places",
            "source_event_id": "evt-1",
            "title": "Nomad meetup",
            "venue_name": "Cowork Hub",
            "radius_m": 2000,
        },
        headers=headers,
    )
    assert saved.status_code == 201
    event_id = saved.json()["id"]

    local_patch = client.patch(
        f"/api/mobile/type-actions/local/events/{event_id}",
        json={"status": "saved"},
        headers=headers,
    )
    assert local_patch.status_code == 200

    milestones = client.get("/api/mobile/type-actions/pioneer/milestones", headers=headers)
    assert milestones.status_code == 200
    assert len(milestones.json()) >= 1

    milestone_id = milestones.json()[0]["id"]
    milestone_patch = client.patch(
        f"/api/mobile/type-actions/pioneer/milestones/{milestone_id}",
        json={"status": "done"},
        headers=headers,
    )
    assert milestone_patch.status_code == 200


def test_mobile_posts_persists_uploaded_image_url():
    uid = f"u_{uuid.uuid4().hex}"
    client = TestClient(_make_app(uid))
    headers = _auth_headers(uid)

    create_payload = {
        "title": "Photo update",
        "body": "Testing uploaded photo field",
        "tags": ["test"],
        "city": "Seoul",
        "image_url": "https://cdn.example.com/uploads/post-1.jpg",
    }
    created = client.post("/api/mobile/posts", json=create_payload, headers=headers)
    assert created.status_code == 201
    created_body = created.json()
    assert created_body["picture"] == create_payload["image_url"]

    listed = client.get("/api/mobile/posts", headers=headers)
    assert listed.status_code == 200
    rows = listed.json()
    assert len(rows) >= 1
    assert rows[0]["id"] == created_body["id"]
    assert rows[0]["picture"] == create_payload["image_url"]

    upload = client.post(
        "/api/mobile/uploads/image",
        files={"file": ("test.png", b"png-bytes", "image/png")},
        headers=headers,
    )
    assert upload.status_code == 200
    payload = upload.json()
    assert "url" in payload or "image_url" in payload
