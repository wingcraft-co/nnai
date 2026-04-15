from __future__ import annotations

from starlette.requests import Request

from utils.rate_limit import (
    RateLimitPolicy,
    RequestAccessMode,
    normalize_entitlement,
    resolve_request_access_mode,
)


def _make_request(client_host: str = "127.0.0.1", headers: list[tuple[bytes, bytes]] | None = None) -> Request:
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/recommend",
        "headers": headers or [],
        "client": (client_host, 12345),
        "server": ("testserver", 80),
        "scheme": "http",
    }
    return Request(scope)


def test_normalize_entitlement_defaults_missing_row_to_free():
    normalized = normalize_entitlement(None)

    assert normalized["plan_tier"] == "free"
    assert normalized["status"] == "active"
    assert normalized["payg_enabled"] is False
    assert normalized["payg_monthly_cap_usd"] == 50.0


def test_resolve_request_access_mode_defaults_to_free_for_logged_in_user_without_entitlement():
    mode = resolve_request_access_mode(user_id="user-1", entitlement=None)
    assert mode == RequestAccessMode.FREE


def test_resolve_request_access_mode_returns_pro_payg_for_active_payg_entitlement():
    entitlement = {
        "plan_tier": "pro",
        "status": "active",
        "payg_enabled": True,
        "payg_monthly_cap_usd": 50.0,
    }

    mode = resolve_request_access_mode(user_id="user-1", entitlement=entitlement)
    assert mode == RequestAccessMode.PRO_PAYG


def test_resolve_request_access_mode_degrades_inactive_pro_to_free():
    entitlement = {
        "plan_tier": "pro",
        "status": "past_due",
        "payg_enabled": True,
    }

    mode = resolve_request_access_mode(user_id="user-1", entitlement=entitlement)
    assert mode == RequestAccessMode.FREE


def test_rate_limit_policy_uses_endpoint_specific_minute_limits():
    policy = RateLimitPolicy()

    assert policy.minute_limit(RequestAccessMode.ANONYMOUS, "recommend") == 5
    assert policy.minute_limit(RequestAccessMode.ANONYMOUS, "detail") == 10
    assert policy.minute_limit(RequestAccessMode.FREE, "recommend") == 10
    assert policy.minute_limit(RequestAccessMode.FREE, "detail") == 20
    assert policy.minute_limit(RequestAccessMode.PRO, "recommend") == 30
    assert policy.minute_limit(RequestAccessMode.PRO, "detail") == 60
    assert policy.minute_limit(RequestAccessMode.PRO_PAYG, "recommend") is None


def test_rate_limit_policy_enables_burst_guard_only_for_pro_payg():
    policy = RateLimitPolicy()

    assert policy.burst_limit(RequestAccessMode.PRO_PAYG, "recommend") == 3
    assert policy.burst_limit(RequestAccessMode.PRO_PAYG, "detail") == 5
    assert policy.burst_limit(RequestAccessMode.PRO, "recommend") is None


def test_client_identifier_ignores_x_forwarded_for_header():
    policy = RateLimitPolicy()
    request = _make_request(
        client_host="10.0.0.7",
        headers=[(b"x-forwarded-for", b"1.2.3.4, 5.6.7.8")],
    )

    assert policy.client_identifier(request) == "10.0.0.7"
