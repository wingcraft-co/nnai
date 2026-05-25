from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.billing import router as billing_router


def _build_client(monkeypatch, *, user_id: str | None = None, provider: str = "portone") -> TestClient:
    app = FastAPI()
    monkeypatch.setenv("BILLING_PROVIDER", provider)
    monkeypatch.setenv("PORTONE_STORE_ID", "store_123")
    monkeypatch.setenv("PORTONE_CHANNEL_KEY", "channel_123")
    monkeypatch.setenv("PORTONE_REPORT_PRICE_KRW", "2900")
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


def test_portone_checkout_requires_city_id(monkeypatch):
    client = _build_client(monkeypatch, user_id="user-1")

    response = client.post(
        "/api/billing/checkout",
        json={
            "locale": "ko",
            "return_path": "/ko/guide/lisbon?checkout=return",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "city_id is required for report checkout."


def test_portone_checkout_returns_provider_neutral_payload(monkeypatch):
    captured: dict[str, object] = {}
    monkeypatch.setattr(
        "api.billing.persist_billing_checkout_session",
        lambda **kwargs: captured.setdefault("persist", kwargs),
    )
    client = _build_client(monkeypatch, user_id="user-1")

    response = client.post(
        "/api/billing/checkout",
        json={
            "city_id": "lisbon",
            "locale": "ko",
            "return_path": "/ko/guide/lisbon?checkout=return",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["provider"] == "portone"
    assert payload["payment_id"].startswith("report_lisbon_")
    assert payload["client_payload"] == {
        "storeId": "store_123",
        "channelKey": "channel_123",
        "paymentId": payload["payment_id"],
        "orderName": "NomadNavigator AI 맞춤 보고서 - lisbon",
        "totalAmount": 2900,
        "currency": "KRW",
        "payMethod": "CARD",
        "customer": {
            "fullName": "User Example",
            "email": "user@example.com",
        },
        "customData": {
            "city_id": "lisbon",
            "user_id": "user-1",
            "product": "city_report",
        },
        "redirectUrl": "http://localhost:3000/ko/guide/lisbon?checkout=return",
    }
    assert captured["persist"] == {
        "user_id": "user-1",
        "provider": "portone",
        "provider_checkout_id": payload["payment_id"],
        "plan_code": "city_report",
        "city_id": "lisbon",
        "amount_krw": 2900,
        "return_path": "/ko/guide/lisbon?checkout=return",
        "status": "created",
    }


def test_polar_checkout_returns_checkout_url_for_logged_in_user(monkeypatch):
    captured: dict[str, object] = {}

    async def fake_create_checkout(**kwargs):
        captured.update(kwargs)
        return {"id": "chk_123", "url": "https://polar.sh/checkout/abc"}

    monkeypatch.setattr("api.billing_providers.polar.create_polar_checkout_session", fake_create_checkout)
    monkeypatch.setattr(
        "api.billing.persist_billing_checkout_session",
        lambda **kwargs: captured.setdefault("persist", kwargs),
    )
    client = _build_client(monkeypatch, user_id="user-1", provider="polar")

    response = client.post(
        "/api/billing/checkout",
        json={
            "city_id": "lisbon",
            "plan_code": "pro_monthly",
            "locale": "ko",
            "return_path": "/ko/pricing?checkout=return",
        },
    )

    assert response.status_code == 200
    assert response.json()["provider"] == "polar"
    assert response.json()["checkout_url"] == "https://polar.sh/checkout/abc"
    assert captured["external_customer_id"] == "user-1"
    assert captured["customer_email"] == "user@example.com"
    assert captured["metadata"] == {"user_id": "user-1", "plan_code": "pro_monthly", "city_id": "lisbon"}
    assert str(captured["success_url"]).endswith("/ko/pricing?checkout=return")
    assert captured["persist"] == {
        "user_id": "user-1",
        "provider": "polar",
        "provider_checkout_id": "chk_123",
        "plan_code": "pro_monthly",
        "city_id": None,
        "amount_krw": None,
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


def test_complete_portone_payment_records_city_purchase(monkeypatch):
    calls: dict[str, object] = {}

    async def fake_fetch_payment(payment_id: str):
        calls["fetched_payment_id"] = payment_id
        return {
            "status": "PAID",
            "paymentId": payment_id,
            "amount": {"total": 2900},
            "customData": {
                "city_id": "lisbon",
                "user_id": "user-1",
                "product": "city_report",
            },
        }

    monkeypatch.setattr("api.billing_providers.portone.fetch_portone_payment", fake_fetch_payment)
    monkeypatch.setattr(
        "api.billing_providers.portone.get_billing_checkout_session",
        lambda payment_id: {
            "user_id": "user-1",
            "provider": "portone",
            "provider_checkout_id": payment_id,
            "plan_code": "city_report",
            "status": "created",
            "city_id": "lisbon",
            "amount_krw": 2900,
        },
    )
    monkeypatch.setattr(
        "api.billing_providers.portone.record_report_purchase",
        lambda **kwargs: calls.setdefault("purchase", kwargs),
    )
    monkeypatch.setattr(
        "api.billing_providers.portone.mark_report_purchased",
        lambda user_id, city_id: calls.setdefault("mark_report_purchased", (user_id, city_id)),
    )
    monkeypatch.setattr(
        "api.billing_providers.portone.mark_checkout_session_status",
        lambda payment_id, status: calls.setdefault("checkout_status", (payment_id, status)),
    )
    client = _build_client(monkeypatch, user_id="user-1")

    response = client.post("/api/billing/complete", json={"payment_id": "report_lisbon_abc"})

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "provider": "portone",
        "payment_id": "report_lisbon_abc",
        "city_id": "lisbon",
        "unlocked": True,
    }
    assert calls["fetched_payment_id"] == "report_lisbon_abc"
    assert calls["purchase"] == {
        "user_id": "user-1",
        "city_id": "lisbon",
        "provider": "portone",
        "provider_payment_id": "report_lisbon_abc",
        "amount_krw": 2900,
    }
    assert calls["mark_report_purchased"] == ("user-1", "lisbon")
    assert calls["checkout_status"] == ("report_lisbon_abc", "completed")


def test_complete_portone_payment_rejects_amount_mismatch(monkeypatch):
    async def fake_fetch_payment(payment_id: str):
        return {"status": "PAID", "amount": {"total": 100}}

    monkeypatch.setattr("api.billing_providers.portone.fetch_portone_payment", fake_fetch_payment)
    monkeypatch.setattr(
        "api.billing_providers.portone.get_billing_checkout_session",
        lambda payment_id: {
            "user_id": "user-1",
            "provider": "portone",
            "provider_checkout_id": payment_id,
            "plan_code": "city_report",
            "status": "created",
            "city_id": "lisbon",
            "amount_krw": 2900,
        },
    )
    client = _build_client(monkeypatch, user_id="user-1")

    response = client.post("/api/billing/complete", json={"payment_id": "report_lisbon_abc"})

    assert response.status_code == 400
    assert response.json()["detail"] == "Payment amount mismatch."


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
        "api.billing_providers.polar.fetch_polar_customer_state",
        fake_fetch_customer_state,
    )
    monkeypatch.setattr("api.billing_providers.polar.upsert_billing_entitlement", lambda **kwargs: captured.append(kwargs))
    monkeypatch.setattr("api.billing.get_billing_entitlement", lambda user_id: entitlement_state)
    client = _build_client(monkeypatch, user_id="user-1", provider="polar")

    response = client.post("/api/billing/restore")

    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert response.json()["restored"] is True
    assert response.json()["entitlement"]["plan_tier"] == "pro"
    assert len(captured) == 1
    assert captured[0]["user_id"] == "user-1"
    assert captured[0]["provider_customer_id"] == "cust_123"
    assert captured[0]["provider_subscription_id"] == "sub_123"
