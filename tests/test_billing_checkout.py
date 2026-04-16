from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.billing import router as billing_router


def _build_client(monkeypatch, *, user_id: str | None = None) -> TestClient:
    app = FastAPI()
    monkeypatch.setenv("POLAR_PRODUCT_PRO_MONTHLY", "prod_123")

    @app.middleware("http")
    async def inject_user_id(request, call_next):
        request.state.user_id = user_id
        return await call_next(request)

    app.include_router(billing_router)
    monkeypatch.setattr(
        "api.billing.get_user_identity",
        lambda uid: {
            "id": uid,
            "email": "user@example.com",
            "name": "User Example",
            "picture": None,
            "persona_type": None,
        },
    )
    return TestClient(app)


def test_checkout_requires_login(monkeypatch):
    client = _build_client(monkeypatch, user_id=None)

    response = client.post("/api/billing/checkout", json={})

    assert response.status_code == 401


def test_checkout_returns_checkout_url_for_logged_in_user(monkeypatch):
    captured: dict[str, object] = {}

    async def fake_create_checkout(**kwargs):
        captured.update(kwargs)
        return {"id": "chk_123", "url": "https://polar.sh/checkout/abc"}

    monkeypatch.setattr("api.billing.create_polar_checkout_session", fake_create_checkout)
    monkeypatch.setattr(
        "api.billing.persist_billing_checkout_session",
        lambda **kwargs: captured.setdefault("persist", kwargs),
    )
    client = _build_client(monkeypatch, user_id="user-1")

    response = client.post(
        "/api/billing/checkout",
        json={
            "plan_code": "pro_monthly",
            "locale": "ko",
            "return_path": "/ko/pricing?checkout=return",
        },
    )

    assert response.status_code == 200
    assert response.json()["checkout_url"] == "https://polar.sh/checkout/abc"
    assert captured["external_customer_id"] == "user-1"
    assert captured["customer_email"] == "user@example.com"
    assert str(captured["success_url"]).endswith("/ko/pricing?checkout=return")
    assert captured["persist"] == {
        "user_id": "user-1",
        "provider_checkout_id": "chk_123",
        "plan_code": "pro_monthly",
        "return_path": "/ko/pricing?checkout=return",
        "status": "created",
    }


def test_billing_status_returns_normalized_entitlement(monkeypatch):
    monkeypatch.setattr(
        "api.billing.get_billing_entitlement",
        lambda user_id: {
            "plan_tier": "pro",
            "status": "active",
            "payg_enabled": True,
            "payg_monthly_cap_usd": 75.0,
        },
    )
    client = _build_client(monkeypatch, user_id="user-1")

    response = client.get("/api/billing/status")

    assert response.status_code == 200
    assert response.json()["entitlement"]["plan_tier"] == "pro"
    assert response.json()["entitlement"]["payg_enabled"] is True


def test_restore_requires_login(monkeypatch):
    client = _build_client(monkeypatch, user_id=None)

    response = client.post("/api/billing/restore")

    assert response.status_code == 401


def test_restore_refreshes_entitlement_from_provider_state(monkeypatch):
    captured: list[dict[str, object]] = []
    entitlement_state = {
        "plan_tier": "pro",
        "status": "active",
        "payg_enabled": False,
        "payg_monthly_cap_usd": 50.0,
    }
    async def fake_fetch_customer_state(external_customer_id: str):
        return {
            "id": "cust_123",
            "external_id": external_customer_id,
            "active_subscriptions": [
                {
                    "id": "sub_123",
                    "status": "active",
                    "current_period_start": "2026-04-17T00:00:00Z",
                    "current_period_end": "2026-05-17T00:00:00Z",
                    "cancel_at_period_end": False,
                    "metadata": {"plan_code": "pro_monthly"},
                }
            ],
        }

    monkeypatch.setattr(
        "api.billing.fetch_polar_customer_state",
        fake_fetch_customer_state,
    )
    monkeypatch.setattr("api.billing.upsert_billing_entitlement", lambda **kwargs: captured.append(kwargs))
    monkeypatch.setattr("api.billing.get_billing_entitlement", lambda user_id: entitlement_state)
    client = _build_client(monkeypatch, user_id="user-1")

    response = client.post("/api/billing/restore")

    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert response.json()["restored"] is True
    assert response.json()["entitlement"]["plan_tier"] == "pro"
    assert len(captured) == 1
    assert captured[0]["user_id"] == "user-1"
    assert captured[0]["provider_customer_id"] == "cust_123"
    assert captured[0]["provider_subscription_id"] == "sub_123"
