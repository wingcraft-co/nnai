"""Entitlement-aware in-memory rate limiting primitives."""
from __future__ import annotations

from collections import defaultdict, deque
from enum import StrEnum
from threading import Lock
from time import monotonic

from fastapi import HTTPException, Request


class RequestAccessMode(StrEnum):
    ANONYMOUS = "anonymous"
    FREE = "free"
    PRO = "pro"
    PRO_PAYG = "pro_payg"


def normalize_entitlement(entitlement: dict | None) -> dict:
    if not entitlement:
        return {
            "plan_tier": "free",
            "status": "active",
            "payg_enabled": False,
            "payg_monthly_cap_usd": 50.0,
            "current_period_start": None,
            "current_period_end": None,
        }

    return {
        "plan_tier": entitlement.get("plan_tier", "free"),
        "status": entitlement.get("status", "active"),
        "payg_enabled": bool(entitlement.get("payg_enabled", False)),
        "payg_monthly_cap_usd": float(entitlement.get("payg_monthly_cap_usd", 50.0)),
        "current_period_start": entitlement.get("current_period_start"),
        "current_period_end": entitlement.get("current_period_end"),
    }


def resolve_request_access_mode(user_id: str | None, entitlement: dict | None) -> RequestAccessMode:
    if not user_id:
        return RequestAccessMode.ANONYMOUS

    normalized = normalize_entitlement(entitlement)
    if normalized["plan_tier"] != "pro":
        return RequestAccessMode.FREE
    if normalized["status"] != "active":
        return RequestAccessMode.FREE
    if normalized["payg_enabled"]:
        return RequestAccessMode.PRO_PAYG
    return RequestAccessMode.PRO


class RateLimitPolicy:
    def minute_limit(self, mode: RequestAccessMode, endpoint: str) -> int | None:
        limits = {
            RequestAccessMode.ANONYMOUS: {"recommend": 5, "detail": 10},
            RequestAccessMode.FREE: {"recommend": 10, "detail": 20},
            RequestAccessMode.PRO: {"recommend": 30, "detail": 60},
            RequestAccessMode.PRO_PAYG: {"recommend": None, "detail": None},
        }
        return limits[mode][endpoint]

    def burst_limit(self, mode: RequestAccessMode, endpoint: str) -> int | None:
        if mode != RequestAccessMode.PRO_PAYG:
            return None
        return {"recommend": 3, "detail": 5}[endpoint]

    def client_identifier(self, request: Request) -> str:
        if request.client and request.client.host:
            return request.client.host
        return "unknown"


class InMemoryRateLimiter:
    """Simple process-local sliding-window limiter keyed by explicit identifiers."""

    def __init__(self, window_seconds: int):
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def is_limited(self, key: str, limit: int) -> bool:
        now = monotonic()
        with self._lock:
            bucket = self._hits[key]
            window_start = now - self.window_seconds

            while bucket and bucket[0] <= window_start:
                bucket.popleft()

            if len(bucket) >= limit:
                return True

            bucket.append(now)
            return False


def raise_rate_limit_exceeded() -> None:
    raise HTTPException(
        status_code=429,
        detail="Too many requests. Please retry later.",
    )
