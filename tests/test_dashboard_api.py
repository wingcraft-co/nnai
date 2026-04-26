from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.dashboard import DEFAULT_WIDGET_IDS, router as dashboard_router


def _build_client(monkeypatch, *, user_id: str | None = None, entitlement: dict | None = None) -> TestClient:
    app = FastAPI()

    @app.middleware("http")
    async def inject_user_id(request, call_next):
        request.state.user_id = user_id
        return await call_next(request)

    monkeypatch.setattr("api.dashboard.get_billing_entitlement", lambda uid: entitlement)
    app.include_router(dashboard_router)
    return TestClient(app)


def _city_payload() -> dict:
    return {
        "id": "BKK",
        "city": "Bangkok",
        "city_kr": "방콕",
        "country": "Thailand",
        "country_id": "TH",
        "visa_type": "DTV",
        "visa_url": "https://www.thaievisa.go.th/",
        "visa_free_days": 90,
        "monthly_cost_usd": 1800,
        "cowork_usd_month": 120,
        "tax_residency_days": 180,
    }


def test_dashboard_confirm_requires_login(monkeypatch):
    client = _build_client(monkeypatch, user_id=None)

    response = client.post("/api/dashboard/confirm", json={"city": _city_payload()})

    assert response.status_code == 401


def test_dashboard_confirm_requires_active_pro(monkeypatch):
    client = _build_client(
        monkeypatch,
        user_id="user-1",
        entitlement={"plan_tier": "free", "status": "active", "payg_enabled": False},
    )

    response = client.post("/api/dashboard/confirm", json={"city": _city_payload()})

    assert response.status_code == 403
    assert response.json()["detail"] == "Pro plan required."


def test_dashboard_confirm_returns_plan_with_default_widgets(monkeypatch):
    captured: dict[str, object] = {}

    def fake_confirm_user_city_plan(**kwargs):
        captured.update(kwargs)
        return {
            "id": 7,
            "city": "Bangkok",
            "city_kr": "방콕",
            "country": "Thailand",
            "country_id": "TH",
            "city_payload": kwargs["city_payload"],
            "user_profile": kwargs["user_profile"],
            "arrived_at": kwargs["arrived_at"],
            "visa_type": "관광비자",
            "visa_expires_at": None,
            "coworking_space": {},
            "tax_profile": {},
            "status": "active",
            "created_at": "2026-04-26 00:00:00+00:00",
            "updated_at": "2026-04-26 00:00:00+00:00",
        }

    monkeypatch.setattr("api.dashboard.confirm_user_city_plan", fake_confirm_user_city_plan)
    monkeypatch.setattr(
        "api.dashboard.get_or_create_dashboard_widget_settings",
        lambda user_id: {
            "enabled_widgets": DEFAULT_WIDGET_IDS,
            "widget_order": DEFAULT_WIDGET_IDS,
            "widget_settings": {},
            "updated_at": "2026-04-26 00:00:00+00:00",
        },
    )
    client = _build_client(
        monkeypatch,
        user_id="user-1",
        entitlement={"plan_tier": "pro", "status": "active", "payg_enabled": False},
    )

    response = client.post(
        "/api/dashboard/confirm",
        json={
            "city": _city_payload(),
            "user_profile": {"nationality": "Korean"},
            "arrived_at": "2026-04-10",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["plan"]["city"] == "Bangkok"
    assert body["widgets"]["enabled_widgets"] == DEFAULT_WIDGET_IDS
    assert {w["id"] for w in body["catalog"]}.issuperset(set(DEFAULT_WIDGET_IDS))
    assert captured["user_id"] == "user-1"
    assert captured["city_payload"]["country_id"] == "TH"
    assert captured["user_profile"] == {"nationality": "Korean"}


def test_dashboard_widget_settings_keep_locked_widgets_enabled(monkeypatch):
    saved: dict[str, object] = {}

    monkeypatch.setattr(
        "api.dashboard.update_dashboard_widget_settings",
        lambda **kwargs: saved.setdefault("settings", kwargs),
    )
    client = _build_client(
        monkeypatch,
        user_id="user-1",
        entitlement={"plan_tier": "pro", "status": "active", "payg_enabled": False},
    )

    response = client.patch(
        "/api/dashboard/widgets",
        json={
            "enabled_widgets": ["tax", "budget"],
            "widget_order": ["budget", "tax"],
            "widget_settings": {"budget": {"monthlyTarget": 2200}},
        },
    )

    assert response.status_code == 200
    widgets = response.json()["widgets"]
    assert "weather" in widgets["enabled_widgets"]
    assert "visa" in widgets["enabled_widgets"]
    assert widgets["widget_order"][:4] == ["weather", "exchange", "stay", "visa"]
    assert saved["settings"]["user_id"] == "user-1"
