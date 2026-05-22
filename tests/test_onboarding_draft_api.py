from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.onboarding import router as onboarding_router


def _build_client(monkeypatch, *, user_id: str | None = "user-1") -> TestClient:
    app = FastAPI()

    @app.middleware("http")
    async def inject_user_id(request, call_next):
        request.state.user_id = user_id
        return await call_next(request)

    app.include_router(onboarding_router)
    return TestClient(app)


def test_onboarding_draft_requires_login(monkeypatch):
    client = _build_client(monkeypatch, user_id=None)

    response = client.get("/api/onboarding/draft")

    assert response.status_code == 401


def test_get_onboarding_draft_returns_saved_payload(monkeypatch):
    monkeypatch.setattr(
        "api.onboarding.get_onboarding_draft",
        lambda user_id: {
            "form_draft": {"currentStep": 4},
            "quiz_draft": {"currentIndex": 2},
            "updated_at": "2026-05-22 00:00:00+00:00",
        },
    )
    client = _build_client(monkeypatch)

    response = client.get("/api/onboarding/draft")

    assert response.status_code == 200
    assert response.json()["form_draft"] == {"currentStep": 4}
    assert response.json()["quiz_draft"] == {"currentIndex": 2}


def test_put_onboarding_draft_merges_omitted_sections(monkeypatch):
    saved: dict[str, object] = {}

    monkeypatch.setattr(
        "api.onboarding.get_onboarding_draft",
        lambda user_id: {
            "form_draft": {"currentStep": 2},
            "quiz_draft": {"currentIndex": 1},
            "updated_at": "2026-05-22 00:00:00+00:00",
        },
    )

    def fake_upsert_onboarding_draft(**kwargs):
        saved.update(kwargs)
        return {
            "form_draft": kwargs["form_draft"],
            "quiz_draft": kwargs["quiz_draft"],
            "updated_at": "2026-05-22 00:01:00+00:00",
        }

    monkeypatch.setattr("api.onboarding.upsert_onboarding_draft", fake_upsert_onboarding_draft)
    client = _build_client(monkeypatch)

    response = client.put("/api/onboarding/draft", json={"form_draft": {"currentStep": 5}})

    assert response.status_code == 200
    assert saved["user_id"] == "user-1"
    assert saved["form_draft"] == {"currentStep": 5}
    assert saved["quiz_draft"] == {"currentIndex": 1}


def test_put_onboarding_draft_can_clear_one_section(monkeypatch):
    saved: dict[str, object] = {}

    monkeypatch.setattr(
        "api.onboarding.get_onboarding_draft",
        lambda user_id: {
            "form_draft": {"currentStep": 2},
            "quiz_draft": {"currentIndex": 1},
            "updated_at": "2026-05-22 00:00:00+00:00",
        },
    )
    monkeypatch.setattr(
        "api.onboarding.upsert_onboarding_draft",
        lambda **kwargs: saved.update(kwargs)
        or {
            "form_draft": kwargs["form_draft"],
            "quiz_draft": kwargs["quiz_draft"],
            "updated_at": "2026-05-22 00:01:00+00:00",
        },
    )
    client = _build_client(monkeypatch)

    response = client.put("/api/onboarding/draft", json={"quiz_draft": None})

    assert response.status_code == 200
    assert saved["form_draft"] == {"currentStep": 2}
    assert saved["quiz_draft"] is None


def test_required_schema_includes_onboarding_drafts():
    from utils import db

    assert "onboarding_drafts" in db._REQUIRED_SCHEMA_TABLES
    assert {"user_id", "form_draft", "quiz_draft", "updated_at"}.issubset(
        db._REQUIRED_SCHEMA_COLUMNS["onboarding_drafts"]
    )
