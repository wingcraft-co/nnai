from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.billing import router as billing_router


def _build_client(monkeypatch) -> TestClient:
    app = FastAPI()
    app.include_router(billing_router)
    return TestClient(app)


def _sign_payload(payload: bytes, secret: str, *, msg_id: str = "msg_123", timestamp: str | None = None) -> dict[str, str]:
    resolved_timestamp = timestamp or str(int(time.time()))
    decoded_secret = base64.b64decode(secret)
    signed_content = msg_id.encode("utf-8") + b"." + resolved_timestamp.encode("utf-8") + b"." + payload
    signature = base64.b64encode(hmac.new(decoded_secret, signed_content, hashlib.sha256).digest()).decode("utf-8")
    return {
        "webhook-id": msg_id,
        "webhook-timestamp": resolved_timestamp,
        "webhook-signature": f"v1,{signature}",
    }


def test_webhook_rejects_invalid_signature(monkeypatch):
    monkeypatch.setenv("POLAR_WEBHOOK_SECRET", base64.b64encode(b"super-secret").decode("utf-8"))
    client = _build_client(monkeypatch)

    response = client.post(
        "/api/billing/webhook",
        content=b"{}",
        headers={
            "webhook-id": "msg_123",
            "webhook-timestamp": "1713222000",
            "webhook-signature": "v1,invalid",
        },
    )

    assert response.status_code == 403


def test_webhook_is_idempotent(monkeypatch):
    secret = base64.b64encode(b"super-secret").decode("utf-8")
    payload = {
        "id": "evt_123",
        "type": "subscription.active",
        "data": {
            "id": "sub_123",
            "customer_id": "cust_123",
            "customer": {"external_id": "user-1"},
            "status": "active",
            "current_period_start": "2026-04-17T00:00:00Z",
            "current_period_end": "2026-05-17T00:00:00Z",
            "cancel_at_period_end": False,
            "metadata": {"plan_code": "pro_monthly"},
        },
    }
    raw_payload = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    headers = _sign_payload(raw_payload, secret)

    calls: list[dict[str, object]] = []
    inserts = iter([True, False])
    monkeypatch.setenv("POLAR_WEBHOOK_SECRET", secret)
    monkeypatch.setattr("api.billing.record_billing_provider_event", lambda **kwargs: next(inserts))
    monkeypatch.setattr("api.billing.mark_checkout_session_status", lambda *args, **kwargs: None)
    monkeypatch.setattr("api.billing.upsert_billing_entitlement", lambda **kwargs: calls.append(kwargs))
    client = _build_client(monkeypatch)

    first = client.post("/api/billing/webhook", content=raw_payload, headers=headers)
    second = client.post("/api/billing/webhook", content=raw_payload, headers=headers)

    assert first.status_code == 202
    assert first.json() == {"ok": True}
    assert second.status_code == 202
    assert second.json() == {"ok": True, "duplicate": True}
    assert len(calls) == 1
    assert calls[0]["user_id"] == "user-1"
    assert calls[0]["provider_customer_id"] == "cust_123"
    assert calls[0]["provider_subscription_id"] == "sub_123"
