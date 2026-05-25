"""Provider-neutral billing endpoints."""
from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from api.billing_providers.base import CheckoutInput
from api.billing_providers.polar import PolarBillingProvider
from api.billing_providers.portone import PortOneBillingProvider
from utils.db import (
    get_billing_entitlement,
    get_user_identity,
    persist_billing_checkout_session,
)
from utils.rate_limit import normalize_entitlement

router = APIRouter(prefix="/api/billing", tags=["billing"])


class CheckoutRequest(BaseModel):
    city_id: str | None = Field(default=None, max_length=100)
    plan_code: str = Field(default="city_report", max_length=100)
    locale: str | None = Field(default=None, max_length=10)
    return_path: str | None = Field(default=None, max_length=500)


class CompletePaymentRequest(BaseModel):
    payment_id: str = Field(max_length=150)


def _require_user_id(request: Request) -> str:
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Login required.")
    return user_id


def _billing_provider_name() -> str:
    return os.environ.get("BILLING_PROVIDER", "portone").strip().lower() or "portone"


def _billing_provider():
    provider = _billing_provider_name()
    if provider == "portone":
        return PortOneBillingProvider()
    if provider == "polar":
        return PolarBillingProvider()
    raise HTTPException(status_code=503, detail="Unsupported billing provider.")


@router.post("/checkout")
async def create_checkout(req: CheckoutRequest, request: Request):
    user_id = _require_user_id(request)
    identity = get_user_identity(user_id)
    if not identity:
        raise HTTPException(status_code=404, detail="User not found.")

    provider = _billing_provider()
    result = await provider.create_checkout(
        CheckoutInput(
            user_id=user_id,
            identity=identity,
            city_id=req.city_id,
            locale=req.locale,
            return_path=req.return_path,
            plan_code=req.plan_code,
        )
    )

    persist_billing_checkout_session(
        user_id=user_id,
        provider=result.provider,
        provider_checkout_id=result.provider_checkout_id,
        plan_code=result.plan_code,
        city_id=result.client_payload.get("customData", {}).get("city_id"),
        amount_krw=result.client_payload.get("totalAmount"),
        return_path=req.return_path,
        status="created",
    )
    return result.to_response()


@router.post("/complete")
async def complete_payment(req: CompletePaymentRequest, request: Request):
    user_id = _require_user_id(request)
    provider = _billing_provider()
    return await provider.complete_payment(user_id, req.payment_id)


@router.get("/status")
def billing_status(request: Request):
    user_id = _require_user_id(request)
    entitlement = normalize_entitlement(get_billing_entitlement(user_id))
    return {"provider": _billing_provider_name(), "entitlement": entitlement}


@router.post("/restore")
async def restore_billing(request: Request):
    user_id = _require_user_id(request)
    provider = _billing_provider()
    payload = await provider.restore(user_id)
    payload["entitlement"] = normalize_entitlement(get_billing_entitlement(user_id))
    return payload


@router.post("/webhook")
async def billing_webhook(request: Request):
    provider = _billing_provider()
    return await provider.handle_webhook(request)
