"""Polar billing integration endpoints."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from api.auth import normalize_return_to
from utils.db import (
    get_billing_entitlement,
    get_user_identity,
    mark_checkout_session_status,
    persist_billing_checkout_session,
    record_billing_provider_event,
    upsert_billing_entitlement,
)
from utils.rate_limit import normalize_entitlement
from utils.security_events import log_security_event

router = APIRouter(prefix="/api/billing", tags=["billing"])

_POLAR_PROVIDER = "polar"
_DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300


class CheckoutRequest(BaseModel):
    plan_code: str = Field(default="pro_monthly", max_length=100)
    locale: str | None = Field(default=None, max_length=10)
    return_path: str | None = Field(default=None, max_length=500)


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


def _polar_access_token() -> str:
    token = _env("POLAR_ACCESS_TOKEN")
    if not token:
        raise HTTPException(status_code=503, detail="Polar billing is not configured.")
    return token


def _polar_webhook_secret() -> str:
    secret = _env("POLAR_WEBHOOK_SECRET")
    if not secret:
        raise HTTPException(status_code=503, detail="Polar webhook is not configured.")
    return secret


def _polar_api_base_url() -> str:
    return _env("POLAR_SERVER_BASE_URL", "https://api.polar.sh").rstrip("/")


def _polar_product_id(plan_code: str) -> str:
    mapping = {
        "pro_monthly": _env("POLAR_PRODUCT_PRO_MONTHLY"),
    }
    product_id = mapping.get(plan_code)
    if not product_id:
        raise HTTPException(status_code=400, detail="Unsupported billing plan.")
    return product_id


def _require_user_id(request: Request) -> str:
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Login required.")
    return user_id


def _resolve_checkout_return_url(locale: str | None, return_path: str | None) -> str:
    if return_path:
        return normalize_return_to(return_path)

    resolved_locale = locale or "ko"
    return normalize_return_to(f"/{resolved_locale}/pricing?checkout=return")


async def create_polar_checkout_session(**payload) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            f"{_polar_api_base_url()}/v1/checkouts",
            json=payload,
            headers={
                "Authorization": f"Bearer {_polar_access_token()}",
                "Content-Type": "application/json",
            },
        )

    if response.status_code >= 400:
        log_security_event(
            "billing_checkout_create_failed",
            provider=_POLAR_PROVIDER,
            status_code=response.status_code,
        )
        raise HTTPException(status_code=502, detail="Could not create Polar checkout session.")

    return response.json()


async def fetch_polar_customer_state(external_customer_id: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            f"{_polar_api_base_url()}/v1/customers/external/{external_customer_id}/state",
            headers={
                "Authorization": f"Bearer {_polar_access_token()}",
            },
        )

    if response.status_code == 404:
        return {}
    if response.status_code >= 400:
        log_security_event(
            "billing_customer_state_fetch_failed",
            provider=_POLAR_PROVIDER,
            status_code=response.status_code,
        )
        raise HTTPException(status_code=502, detail="Could not verify Polar billing state.")

    return response.json()


def _safe_decode_json(raw_payload: bytes) -> dict:
    try:
        return json.loads(raw_payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid webhook payload.") from exc


def _extract_signatures(header_value: str) -> list[str]:
    signatures: list[str] = []
    for part in header_value.split():
        try:
            version, signature = part.split(",", 1)
        except ValueError:
            continue
        if version == "v1" and signature:
            signatures.append(signature)
    return signatures


def verify_polar_webhook(raw_payload: bytes, headers) -> dict:
    secret = _polar_webhook_secret()
    msg_id = headers.get("webhook-id")
    timestamp = headers.get("webhook-timestamp")
    signature_header = headers.get("webhook-signature", "")
    if not msg_id or not timestamp or not signature_header:
        raise HTTPException(status_code=403, detail="Invalid webhook signature.")

    try:
        timestamp_value = int(timestamp)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail="Invalid webhook signature.") from exc

    now = int(time.time())
    if abs(now - timestamp_value) > _DEFAULT_WEBHOOK_TOLERANCE_SECONDS:
        raise HTTPException(status_code=403, detail="Invalid webhook signature.")

    try:
        decoded_secret = base64.b64decode(secret)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail="Polar webhook secret is invalid.") from exc

    signed_content = msg_id.encode("utf-8") + b"." + timestamp.encode("utf-8") + b"." + raw_payload
    expected = base64.b64encode(hmac.new(decoded_secret, signed_content, hashlib.sha256).digest()).decode("utf-8")
    provided = _extract_signatures(signature_header)
    if not any(hmac.compare_digest(candidate, expected) for candidate in provided):
        raise HTTPException(status_code=403, detail="Invalid webhook signature.")

    return _safe_decode_json(raw_payload)


def _payload_digest(raw_payload: bytes) -> str:
    return hashlib.sha256(raw_payload).hexdigest()


def _iso_to_datetime(value: str | None):
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    return datetime.fromisoformat(normalized)


def _deep_get(payload: dict | None, *path: str):
    current = payload
    for segment in path:
        if not isinstance(current, dict):
            return None
        current = current.get(segment)
    return current


def _event_user_id(data: dict) -> str | None:
    for candidate in (
        data.get("external_customer_id"),
        data.get("customer_external_id"),
        _deep_get(data, "customer", "external_id"),
        _deep_get(data, "customer", "external_customer_id"),
        _deep_get(data, "metadata", "user_id"),
    ):
        if isinstance(candidate, str) and candidate:
            return candidate
    return None


def _event_plan_code(data: dict) -> str:
    for candidate in (
        _deep_get(data, "metadata", "plan_code"),
        data.get("plan_code"),
    ):
        if isinstance(candidate, str) and candidate:
            return candidate
    return "pro_monthly"


def reconcile_entitlement_from_customer_state(user_id: str, customer_state: dict) -> bool:
    subscriptions = customer_state.get("active_subscriptions")
    if not isinstance(subscriptions, list) or not subscriptions:
        return False

    subscription = subscriptions[0]
    if not isinstance(subscription, dict):
        return False

    upsert_billing_entitlement(
        user_id=user_id,
        provider=_POLAR_PROVIDER,
        plan_tier="pro",
        plan_code=_event_plan_code(subscription),
        status="active",
        provider_customer_id=customer_state.get("id"),
        provider_subscription_id=subscription.get("id"),
        current_period_start=_iso_to_datetime(subscription.get("current_period_start")),
        current_period_end=_iso_to_datetime(subscription.get("current_period_end")),
        cancel_at_period_end=bool(subscription.get("cancel_at_period_end", False)),
        grace_until=None,
    )
    return True


def _apply_webhook_entitlement(event_type: str, data: dict) -> None:
    user_id = _event_user_id(data)
    if not user_id:
        log_security_event("billing_webhook_missing_user", provider=_POLAR_PROVIDER, event_type=event_type)
        return

    provider_customer_id = data.get("customer_id")
    provider_subscription_id = data.get("subscription_id") or data.get("id")
    plan_code = _event_plan_code(data)
    current_period_start = _iso_to_datetime(data.get("current_period_start"))
    current_period_end = _iso_to_datetime(data.get("current_period_end"))
    cancel_at_period_end = bool(data.get("cancel_at_period_end", False))
    grace_until = None
    plan_tier = "pro"
    status = "active"

    if event_type == "subscription.past_due":
        status = "grace"
        grace_until = datetime.now(timezone.utc) + timedelta(days=3)
    elif event_type in {"subscription.revoked", "subscription.canceled"}:
        status = "canceled"
    elif event_type == "checkout.expired":
        mark_checkout_session_status(data.get("id"), "expired")
        return
    elif event_type not in {
        "subscription.active",
        "subscription.created",
        "subscription.updated",
        "subscription.uncanceled",
        "order.paid",
        "checkout.updated",
        "checkout.created",
    }:
        return

    if event_type in {"checkout.updated", "checkout.created"}:
        provider_subscription_id = data.get("subscription_id")
        provider_customer_id = data.get("customer_id")
        if data.get("status") == "succeeded":
            mark_checkout_session_status(data.get("id"), "completed")
        return

    if event_type == "order.paid":
        provider_subscription_id = data.get("subscription_id")
        provider_customer_id = data.get("customer_id")

    upsert_billing_entitlement(
        user_id=user_id,
        provider=_POLAR_PROVIDER,
        plan_tier=plan_tier,
        plan_code=plan_code,
        status=status,
        provider_customer_id=provider_customer_id,
        provider_subscription_id=provider_subscription_id,
        current_period_start=current_period_start,
        current_period_end=current_period_end,
        cancel_at_period_end=cancel_at_period_end,
        grace_until=grace_until,
    )

    if event_type in {"subscription.active", "order.paid"}:
        mark_checkout_session_status(data.get("checkout_id"), "completed")


@router.post("/checkout")
async def create_checkout(req: CheckoutRequest, request: Request):
    user_id = _require_user_id(request)
    identity = get_user_identity(user_id)
    if not identity:
        raise HTTPException(status_code=404, detail="User not found.")

    return_url = _resolve_checkout_return_url(req.locale, req.return_path)
    session = await create_polar_checkout_session(
        products=[_polar_product_id(req.plan_code)],
        success_url=return_url,
        return_url=return_url,
        external_customer_id=user_id,
        customer_email=identity["email"],
        customer_name=identity["name"],
        metadata={"user_id": user_id, "plan_code": req.plan_code},
        locale=req.locale,
    )

    persist_billing_checkout_session(
        user_id=user_id,
        provider_checkout_id=session.get("id"),
        plan_code=req.plan_code,
        return_path=req.return_path,
        status="created",
    )
    return {"checkout_url": session["url"]}


@router.get("/status")
def billing_status(request: Request):
    user_id = _require_user_id(request)
    entitlement = normalize_entitlement(get_billing_entitlement(user_id))
    return {"entitlement": entitlement}


@router.post("/restore")
async def restore_billing(request: Request):
    user_id = _require_user_id(request)
    customer_state = await fetch_polar_customer_state(user_id)
    restored = reconcile_entitlement_from_customer_state(user_id, customer_state)
    entitlement = normalize_entitlement(get_billing_entitlement(user_id))
    return {"ok": True, "restored": restored, "entitlement": entitlement}


@router.post("/webhook")
async def polar_webhook(request: Request):
    raw_payload = await request.body()
    try:
        payload = verify_polar_webhook(raw_payload, request.headers)
    except HTTPException as exc:
        if exc.status_code == 403:
            log_security_event(
                "billing_webhook_bad_signature",
                provider=_POLAR_PROVIDER,
                client_ip=request.client.host if request.client else "unknown",
            )
        raise

    event_id = payload.get("id")
    event_type = payload.get("type")
    if not isinstance(event_id, str) or not event_id or not isinstance(event_type, str) or not event_type:
        raise HTTPException(status_code=400, detail="Webhook event is missing required fields.")

    if not record_billing_provider_event(
        provider=_POLAR_PROVIDER,
        event_id=event_id,
        payload_digest=_payload_digest(raw_payload),
    ):
        return JSONResponse(status_code=202, content={"ok": True, "duplicate": True})

    data = payload.get("data")
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Webhook event data is invalid.")

    _apply_webhook_entitlement(event_type, data)
    return JSONResponse(status_code=202, content={"ok": True})
