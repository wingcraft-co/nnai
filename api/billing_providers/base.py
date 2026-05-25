"""Provider-neutral billing contracts."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from fastapi import Request
from fastapi.responses import JSONResponse


@dataclass(frozen=True)
class CheckoutInput:
    user_id: str
    identity: dict
    city_id: str | None
    locale: str | None
    return_path: str | None
    plan_code: str


@dataclass(frozen=True)
class CheckoutResult:
    provider: str
    provider_checkout_id: str
    checkout_url: str
    plan_code: str
    payment_id: str | None = None
    client_payload: dict = field(default_factory=dict)

    def to_response(self) -> dict:
        payload = {
            "checkout_url": self.checkout_url,
            "provider": self.provider,
        }
        if self.payment_id:
            payload["payment_id"] = self.payment_id
        if self.client_payload:
            payload["client_payload"] = self.client_payload
        return payload


class BillingProvider(Protocol):
    name: str

    async def create_checkout(self, checkout: CheckoutInput) -> CheckoutResult:
        ...

    async def complete_payment(self, user_id: str, payment_id: str) -> dict:
        ...

    async def restore(self, user_id: str) -> dict:
        ...

    async def handle_webhook(self, request: Request) -> JSONResponse:
        ...
