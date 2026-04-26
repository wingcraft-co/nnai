"""Pro city dashboard endpoints."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from utils.db import (
    confirm_user_city_plan,
    get_active_user_city_plan,
    get_billing_entitlement,
    get_or_create_dashboard_widget_settings,
    update_dashboard_widget_settings,
    update_user_city_plan,
)
from utils.rate_limit import normalize_entitlement

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

LOCKED_WIDGET_IDS = ["weather", "exchange", "stay", "visa"]
DEFAULT_WIDGET_IDS = [
    "weather",
    "exchange",
    "stay",
    "visa",
    "action_plan",
    "coworking",
    "tax",
    "disaster",
    "budget",
    "housing",
    "insurance",
    "local_events",
]

WIDGET_CATALOG = [
    {"id": "weather", "title": "날씨", "description": "확정 도시의 현재 날씨와 체감 리스크", "locked": True},
    {"id": "exchange", "title": "환율", "description": "현지 통화와 모국 통화 빠른 변환", "locked": True},
    {"id": "stay", "title": "체류 일자", "description": "입국 후 며칠차인지와 남은 체류 기간", "locked": True},
    {"id": "visa", "title": "비자 정보", "description": "관광비자 기본값, 노마드 비자와 공식 신청 링크", "locked": True},
    {"id": "action_plan", "title": "이번 주 실행 플랜", "description": "비자, 세금, 숙소 등 이번 주 체크리스트", "locked": False},
    {"id": "coworking", "title": "공유오피스", "description": "선택한 공유오피스 위치와 월 비용", "locked": False},
    {"id": "tax", "title": "세금 관리", "description": "현지/본국 세금 거주 리스크와 입력 소득 추적", "locked": False},
    {"id": "disaster", "title": "재난 현황", "description": "기상 특보, 지진, 도시 안전 알림", "locked": False},
    {"id": "budget", "title": "월 예산", "description": "월 생활비 목표와 현재 도시 예상 비용", "locked": False},
    {"id": "housing", "title": "숙소 갱신", "description": "중기 숙소 후보와 다음 갱신 일정", "locked": False},
    {"id": "insurance", "title": "보험/의료", "description": "해외 보험, 병원, 긴급 연락처 관리", "locked": False},
    {"id": "local_events", "title": "로컬 이벤트", "description": "노마드 밋업과 저장한 현지 일정", "locked": False},
]

_CATALOG_IDS = {widget["id"] for widget in WIDGET_CATALOG}


class ConfirmDashboardRequest(BaseModel):
    city: dict[str, Any]
    user_profile: dict[str, Any] = Field(default_factory=dict)
    arrived_at: str | None = Field(default=None, max_length=20)


class WidgetSettingsRequest(BaseModel):
    enabled_widgets: list[str] = Field(default_factory=list, max_length=30)
    widget_order: list[str] = Field(default_factory=list, max_length=30)
    widget_settings: dict[str, Any] = Field(default_factory=dict)


class DashboardPlanPatch(BaseModel):
    arrived_at: str | None = Field(default=None, max_length=20)
    visa_type: str | None = Field(default=None, max_length=100)
    visa_expires_at: str | None = Field(default=None, max_length=20)
    coworking_space: dict[str, Any] | None = None
    tax_profile: dict[str, Any] | None = None


def _require_user_id(request: Request) -> str:
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Login required.")
    return user_id


def _require_pro(user_id: str) -> None:
    entitlement = normalize_entitlement(get_billing_entitlement(user_id))
    if entitlement["plan_tier"] != "pro" or entitlement["status"] not in {"active", "grace"}:
        raise HTTPException(status_code=403, detail="Pro plan required.")


def _sanitize_widgets(body: WidgetSettingsRequest) -> dict[str, Any]:
    enabled = [widget_id for widget_id in body.enabled_widgets if widget_id in _CATALOG_IDS]
    order = [widget_id for widget_id in body.widget_order if widget_id in _CATALOG_IDS]

    for widget_id in reversed(LOCKED_WIDGET_IDS):
        if widget_id not in enabled:
            enabled.insert(0, widget_id)
        if widget_id not in order:
            order.insert(0, widget_id)

    enabled = list(dict.fromkeys(enabled))
    ordered = list(dict.fromkeys([*order, *enabled]))
    ordered = [widget_id for widget_id in ordered if widget_id in enabled]

    settings = {
        key: value
        for key, value in body.widget_settings.items()
        if key in _CATALOG_IDS and isinstance(value, dict)
    }
    return {
        "enabled_widgets": enabled,
        "widget_order": ordered,
        "widget_settings": settings,
    }


@router.get("/catalog")
def dashboard_catalog():
    return {"catalog": WIDGET_CATALOG, "default_widgets": DEFAULT_WIDGET_IDS}


@router.get("")
def get_dashboard(request: Request):
    user_id = _require_user_id(request)
    _require_pro(user_id)
    return {
        "plan": get_active_user_city_plan(user_id),
        "widgets": get_or_create_dashboard_widget_settings(user_id),
        "catalog": WIDGET_CATALOG,
    }


@router.post("/confirm")
def confirm_dashboard(body: ConfirmDashboardRequest, request: Request):
    user_id = _require_user_id(request)
    _require_pro(user_id)
    plan = confirm_user_city_plan(
        user_id=user_id,
        city_payload=body.city,
        user_profile=body.user_profile,
        arrived_at=body.arrived_at,
    )
    return {
        "plan": plan,
        "widgets": get_or_create_dashboard_widget_settings(user_id),
        "catalog": WIDGET_CATALOG,
    }


@router.patch("/widgets")
def patch_dashboard_widgets(body: WidgetSettingsRequest, request: Request):
    user_id = _require_user_id(request)
    _require_pro(user_id)
    sanitized = _sanitize_widgets(body)
    widgets = update_dashboard_widget_settings(user_id=user_id, **sanitized)
    return {"widgets": widgets, "catalog": WIDGET_CATALOG}


@router.patch("/plan")
def patch_dashboard_plan(body: DashboardPlanPatch, request: Request):
    user_id = _require_user_id(request)
    _require_pro(user_id)
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="At least one field is required.")
    plan = update_user_city_plan(user_id=user_id, **updates)
    if not plan:
        raise HTTPException(status_code=404, detail="Dashboard plan not found.")
    return {"plan": plan}
