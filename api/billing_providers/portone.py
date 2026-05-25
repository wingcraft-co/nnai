"""PortOne billing provider for Korean one-time report purchases."""
from __future__ import annotations

import os
import re
import secrets
from urllib.parse import quote

import httpx
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

from api.auth import normalize_return_to
from api.billing_providers.base import CheckoutInput, CheckoutResult
from utils.db import (
    get_billing_checkout_session,
    mark_checkout_session_status,
    mark_report_purchased,
    record_report_purchase,
)


class PortOneBillingProvider:
    name = "portone"

    async def create_checkout(self, checkout: CheckoutInput) -> CheckoutResult:
        city_id = _normalize_city_id(checkout.city_id)
        if not city_id:
            raise HTTPException(status_code=400, detail="city_id is required for report checkout.")

        store_id = _required_env("PORTONE_STORE_ID")
        channel_key = _required_env("PORTONE_CHANNEL_KEY")
        amount_krw = _report_price_krw()
        payment_id = f"report_{city_id}_{secrets.token_urlsafe(10).replace('-', '').replace('_', '')}"
        return_url = normalize_return_to(checkout.return_path or f"/{checkout.locale or 'ko'}/guide/{city_id}?checkout=return")
        email = checkout.identity.get("email") or ""
        name = checkout.identity.get("name") or ""

        client_payload = {
            "storeId": store_id,
            "channelKey": channel_key,
            "paymentId": payment_id,
            "orderName": f"NomadNavigator AI 맞춤 보고서 - {city_id}",
            "totalAmount": amount_krw,
            "currency": "KRW",
            "payMethod": _portone_pay_method(),
            "customer": {
                "fullName": name,
                "email": email,
            },
            "customData": {
                "city_id": city_id,
                "user_id": checkout.user_id,
                "product": "city_report",
            },
            "redirectUrl": return_url,
        }
        return CheckoutResult(
            provider=self.name,
            provider_checkout_id=payment_id,
            checkout_url=return_url,
            plan_code="city_report",
            payment_id=payment_id,
            client_payload=client_payload,
        )

    async def complete_payment(self, user_id: str, payment_id: str) -> dict:
        session = get_billing_checkout_session(payment_id)
        if not session or session.get("provider") != self.name:
            raise HTTPException(status_code=404, detail="Checkout session not found.")
        if session.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Payment does not belong to this user.")

        city_id = _normalize_city_id(session.get("city_id"))
        if not city_id:
            raise HTTPException(status_code=400, detail="Checkout session is missing city_id.")

        expected_amount = int(session.get("amount_krw") or _report_price_krw())
        payment = await fetch_portone_payment(payment_id)
        if payment.get("status") != "PAID":
            raise HTTPException(status_code=400, detail="Payment is not paid.")

        amount = payment.get("amount") if isinstance(payment.get("amount"), dict) else {}
        paid_amount = amount.get("total")
        if int(paid_amount or 0) != expected_amount:
            raise HTTPException(status_code=400, detail="Payment amount mismatch.")

        custom_data = payment.get("customData") if isinstance(payment.get("customData"), dict) else {}
        if custom_data:
            if custom_data.get("city_id") and _normalize_city_id(custom_data.get("city_id")) != city_id:
                raise HTTPException(status_code=400, detail="Payment city mismatch.")
            if custom_data.get("user_id") and custom_data.get("user_id") != user_id:
                raise HTTPException(status_code=400, detail="Payment user mismatch.")

        record_report_purchase(
            user_id=user_id,
            city_id=city_id,
            provider=self.name,
            provider_payment_id=payment_id,
            amount_krw=expected_amount,
        )
        mark_report_purchased(user_id, city_id)
        mark_checkout_session_status(payment_id, "completed")
        return {
            "ok": True,
            "provider": self.name,
            "payment_id": payment_id,
            "city_id": city_id,
            "unlocked": True,
        }

    async def restore(self, user_id: str) -> dict:
        return {"ok": True, "restored": False, "provider": self.name}

    async def handle_webhook(self, request: Request) -> JSONResponse:
        return JSONResponse(
            status_code=501,
            content={"ok": False, "provider": self.name, "detail": "PortOne webhook handling is not implemented."},
        )


def _required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise HTTPException(status_code=503, detail=f"{name} is not configured.")
    return value


def _portone_api_secret() -> str:
    return _required_env("PORTONE_API_SECRET")


def _portone_api_base_url() -> str:
    return os.environ.get("PORTONE_API_BASE_URL", "https://api.portone.io").rstrip("/")


def _portone_pay_method() -> str:
    return os.environ.get("PORTONE_PAY_METHOD", "CARD").strip().upper() or "CARD"


async def fetch_portone_payment(payment_id: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(
            f"{_portone_api_base_url()}/payments/{quote(payment_id, safe='')}",
            headers={"Authorization": f"PortOne {_portone_api_secret()}"},
        )
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Payment not found.")
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Could not verify PortOne payment.")
    return response.json()


def _report_price_krw() -> int:
    raw = os.environ.get("PORTONE_REPORT_PRICE_KRW", "2900").strip()
    try:
        amount = int(raw)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail="PORTONE_REPORT_PRICE_KRW is invalid.") from exc
    if amount <= 0:
        raise HTTPException(status_code=503, detail="PORTONE_REPORT_PRICE_KRW is invalid.")
    return amount


def _normalize_city_id(value: str | None) -> str | None:
    if not value:
        return None
    normalized = re.sub(r"[^a-z0-9-]+", "-", value.strip().lower())
    normalized = re.sub(r"-+", "-", normalized).strip("-")
    return normalized or None
