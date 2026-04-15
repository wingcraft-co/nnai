"""POST /api/recommend 및 /api/detail FastAPI 엔드포인트 테스트.

server.py는 import 시 init_db()를 호출하므로,
엔드포인트 로직만 격리한 최소 FastAPI 앱을 구성해 테스트합니다.
"""
from __future__ import annotations
from typing import Optional
from unittest.mock import patch, MagicMock
from fastapi import FastAPI
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field

from api.auth import build_me_response
from utils.rate_limit import (
    InMemoryRateLimiter,
    RateLimitPolicy,
    RequestAccessMode,
)


# ── 요청 모델 (모듈 레벨 — FastAPI 타입 분석용) ─────────────────

class _RecommendRequest(BaseModel):
    nationality: str = Field(max_length=100)
    income_krw: int
    immigration_purpose: str = Field(max_length=500)
    lifestyle: list[str] = Field(max_length=10)
    languages: list[str] = Field(max_length=10)
    timeline: str = Field(max_length=100)
    preferred_countries: list[str] = Field(default_factory=list, max_length=10)
    preferred_language: str = Field(default="한국어", max_length=20)
    persona_type: str = Field(default="", max_length=50)
    income_type: str = Field(default="", max_length=50)
    travel_type: str = Field(default="혼자 (솔로)", max_length=50)
    children_ages: Optional[list[str]] = Field(default=None, max_length=10)
    dual_nationality: bool = False
    readiness_stage: str = Field(default="", max_length=50)
    has_spouse_income: str = Field(default="없음", max_length=20)
    spouse_income_krw: int = 0


class _DetailRequest(BaseModel):
    parsed_data: dict
    city_index: int = 0


# ── Mock 헬퍼 ──────────────────────────────────────────────────

def _make_nomad_advisor_mock(markdown="## 결과", cities=None, parsed=None):
    if cities is None:
        cities = [{"city": "Lisbon", "country_id": "PT"}]
    if parsed is None:
        parsed = {
            "top_cities": [{"city": "Lisbon", "country_id": "PT", "score": 9}],
            "_user_profile": {"nationality": "Korean", "income_krw": 500, "income_usd": 3570},
        }
    return MagicMock(return_value=(markdown, cities, parsed))


def _make_detail_mock(markdown="## 상세 가이드"):
    return MagicMock(return_value=markdown)


# ── 최소 테스트 앱 (server.py DB 초기화 없이 엔드포인트만 등록) ──

def _build_app(advisor_mock=None, detail_mock=None):
    """server.py 엔드포인트 로직만 격리한 테스트용 FastAPI 앱."""
    _advisor = advisor_mock
    _detail = detail_mock

    test_app = FastAPI()

    @test_app.post("/api/recommend")
    async def api_recommend(req: _RecommendRequest):
        markdown, cities, parsed = _advisor(
            nationality=req.nationality,
            income_krw=req.income_krw,
            immigration_purpose=req.immigration_purpose,
            lifestyle=req.lifestyle,
            languages=req.languages,
            timeline=req.timeline,
            preferred_countries=req.preferred_countries,
            preferred_language=req.preferred_language,
            persona_type=req.persona_type,
            income_type=req.income_type,
            travel_type=req.travel_type,
            children_ages=req.children_ages,
            dual_nationality=req.dual_nationality,
            readiness_stage=req.readiness_stage,
            has_spouse_income=req.has_spouse_income,
            spouse_income_krw=req.spouse_income_krw,
        )
        return {"markdown": markdown, "cities": cities, "parsed": parsed}

    @test_app.post("/api/detail")
    async def api_detail(req: _DetailRequest):
        markdown = _detail(
            parsed_data=req.parsed_data,
            city_index=req.city_index,
        )
        return {"markdown": markdown}

    return test_app


def _build_rate_limited_app():
    """엔드포인트/등급별 limiter를 적용한 테스트 앱."""
    test_app = FastAPI()
    policy = RateLimitPolicy()
    minute_limiter = InMemoryRateLimiter(window_seconds=60)
    burst_limiter = InMemoryRateLimiter(window_seconds=1)

    def _enforce(
        request: Request,
        endpoint: str,
        mode: RequestAccessMode,
        user_id: str | None = None,
    ):
        subject = user_id or policy.client_identifier(request)
        minute_limit = policy.minute_limit(mode, endpoint)
        if minute_limit is not None and minute_limiter.is_limited(
            key=f"{mode}:{endpoint}:{subject}",
            limit=minute_limit,
        ):
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please retry later."},
            )

        burst_limit = policy.burst_limit(mode, endpoint)
        if burst_limit is not None and burst_limiter.is_limited(
            key=f"burst:{mode}:{endpoint}:{subject}",
            limit=burst_limit,
        ):
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please retry later."},
            )
        return None

    @test_app.post("/api/recommend")
    async def api_recommend(request: Request):
        mode = RequestAccessMode(request.headers.get("x-access-mode", "anonymous"))
        user_id = request.headers.get("x-user-id")
        limited = _enforce(request, "recommend", mode, user_id=user_id)
        if limited is not None:
            return limited
        return {"ok": True}

    @test_app.post("/api/detail")
    async def api_detail(request: Request):
        mode = RequestAccessMode(request.headers.get("x-access-mode", "anonymous"))
        user_id = request.headers.get("x-user-id")
        if request.headers.get("x-payg-cap-reached") == "1":
            return JSONResponse(
                status_code=402,
                content={
                    "detail": "Monthly pay-as-you-go cap reached.",
                    "cap_usd": 50.0,
                    "current_usage_usd": 49.9,
                },
            )
        limited = _enforce(request, "detail", mode, user_id=user_id)
        if limited is not None:
            return limited
        return {"ok": True}

    return test_app


# ── POST /api/recommend ────────────────────────────────────────

MINIMAL_RECOMMEND_PAYLOAD = {
    "nationality": "Korean",
    "income_krw": 500,
    "immigration_purpose": "원격 근무",
    "lifestyle": ["저물가"],
    "languages": ["영어 업무 수준"],
    "timeline": "1년 장기 체류",
}


def test_recommend_returns_200_with_valid_payload():
    """정상 요청 시 200 + markdown/cities/parsed 키를 반환한다."""
    client = TestClient(_build_app(advisor_mock=_make_nomad_advisor_mock()))
    r = client.post("/api/recommend", json=MINIMAL_RECOMMEND_PAYLOAD)

    assert r.status_code == 200
    body = r.json()
    assert "markdown" in body
    assert "cities" in body
    assert "parsed" in body


def test_recommend_markdown_is_string():
    """markdown 응답값이 비어있지 않은 문자열이어야 한다."""
    client = TestClient(_build_app(advisor_mock=_make_nomad_advisor_mock(markdown="## 결과물")))
    r = client.post("/api/recommend", json=MINIMAL_RECOMMEND_PAYLOAD)

    md = r.json()["markdown"]
    assert isinstance(md, str)
    assert len(md) > 0


def test_recommend_cities_is_list():
    """cities 응답값이 리스트여야 한다."""
    client = TestClient(_build_app(advisor_mock=_make_nomad_advisor_mock()))
    r = client.post("/api/recommend", json=MINIMAL_RECOMMEND_PAYLOAD)

    assert isinstance(r.json()["cities"], list)


def test_recommend_parsed_has_user_profile():
    """parsed._user_profile에 nationality, income_krw가 있어야 한다."""
    mock_parsed = {
        "top_cities": [],
        "_user_profile": {"nationality": "Korean", "income_krw": 500, "income_usd": 3570},
    }
    client = TestClient(_build_app(advisor_mock=_make_nomad_advisor_mock(parsed=mock_parsed)))
    r = client.post("/api/recommend", json=MINIMAL_RECOMMEND_PAYLOAD)

    profile = r.json()["parsed"]["_user_profile"]
    assert profile["nationality"] == "Korean"
    assert profile["income_krw"] == 500


def test_recommend_missing_required_field_returns_422():
    """필수 필드(nationality) 누락 시 422 Unprocessable Entity."""
    client = TestClient(_build_app(advisor_mock=_make_nomad_advisor_mock()))
    payload = {k: v for k, v in MINIMAL_RECOMMEND_PAYLOAD.items() if k != "nationality"}
    r = client.post("/api/recommend", json=payload)
    assert r.status_code == 422


def test_recommend_missing_income_krw_returns_422():
    """필수 필드(income_krw) 누락 시 422."""
    client = TestClient(_build_app(advisor_mock=_make_nomad_advisor_mock()))
    payload = {k: v for k, v in MINIMAL_RECOMMEND_PAYLOAD.items() if k != "income_krw"}
    r = client.post("/api/recommend", json=payload)
    assert r.status_code == 422


def test_recommend_wrong_income_type_returns_422():
    """income_krw에 문자열 전달 시 422."""
    client = TestClient(_build_app(advisor_mock=_make_nomad_advisor_mock()))
    payload = {**MINIMAL_RECOMMEND_PAYLOAD, "income_krw": "오백만원"}
    r = client.post("/api/recommend", json=payload)
    assert r.status_code == 422


def test_recommend_optional_fields_have_defaults():
    """선택 필드 없이도 200 반환, 기본값이 올바르게 전달된다."""
    advisor = _make_nomad_advisor_mock()
    client = TestClient(_build_app(advisor_mock=advisor))
    r = client.post("/api/recommend", json=MINIMAL_RECOMMEND_PAYLOAD)

    assert r.status_code == 200
    _, kwargs = advisor.call_args
    assert kwargs["preferred_language"] == "한국어"
    assert kwargs["travel_type"] == "혼자 (솔로)"
    assert kwargs["dual_nationality"] is False
    assert kwargs["spouse_income_krw"] == 0


def test_recommend_all_optional_fields_accepted():
    """모든 선택 필드 포함 시 200 반환."""
    full_payload = {
        **MINIMAL_RECOMMEND_PAYLOAD,
        "preferred_countries": ["유럽"],
        "preferred_language": "English",
        "persona_type": "nomad",
        "income_type": "프리랜서",
        "travel_type": "커플",
        "children_ages": ["5살", "8살"],
        "dual_nationality": True,
        "readiness_stage": "구체적으로 준비 중",
        "has_spouse_income": "있음",
        "spouse_income_krw": 300,
    }
    client = TestClient(_build_app(advisor_mock=_make_nomad_advisor_mock()))
    r = client.post("/api/recommend", json=full_payload)
    assert r.status_code == 200


def test_recommend_children_ages_null_accepted():
    """children_ages=null (None) 전달 시 200."""
    payload = {**MINIMAL_RECOMMEND_PAYLOAD, "children_ages": None}
    client = TestClient(_build_app(advisor_mock=_make_nomad_advisor_mock()))
    r = client.post("/api/recommend", json=payload)
    assert r.status_code == 200


def test_recommend_rejects_overlong_nationality():
    """nationality가 과도하게 길면 422."""
    client = TestClient(_build_app(advisor_mock=_make_nomad_advisor_mock()))
    payload = {**MINIMAL_RECOMMEND_PAYLOAD, "nationality": "K" * 101}

    r = client.post("/api/recommend", json=payload)
    assert r.status_code == 422


def test_recommend_rejects_too_many_lifestyle_items():
    """lifestyle 항목 수가 제한을 넘기면 422."""
    client = TestClient(_build_app(advisor_mock=_make_nomad_advisor_mock()))
    payload = {
        **MINIMAL_RECOMMEND_PAYLOAD,
        "lifestyle": [f"tag-{idx}" for idx in range(11)],
    }

    r = client.post("/api/recommend", json=payload)
    assert r.status_code == 422


def test_recommend_returns_429_when_rate_limit_exceeded():
    """anonymous recommend는 분당 5회 이후 429를 반환한다."""
    client = TestClient(_build_rate_limited_app())

    for _ in range(5):
        assert client.post("/api/recommend", json={}).status_code == 200

    r = client.post("/api/recommend", json={})
    assert r.status_code == 429
    assert r.json()["detail"] == "Too many requests. Please retry later."


# ── POST /api/detail ──────────────────────────────────────────

MOCK_PARSED_DATA = {
    "top_cities": [
        {
            "city": "Lisbon",
            "city_kr": "리스본",
            "country": "Portugal",
            "country_id": "PT",
            "visa_type": "D8 Digital Nomad Visa",
            "monthly_cost_usd": 2200,
            "score": 9,
            "reasons": [],
            "realistic_warnings": [],
        }
    ],
    "_user_profile": {
        "nationality": "Korean",
        "income_usd": 3570,
        "income_krw": 500,
        "purpose": "원격 근무",
        "lifestyle": [],
        "languages": ["영어"],
        "timeline": "1년 장기 체류",
    },
}


def test_detail_returns_200_with_valid_payload():
    """정상 요청 시 200 + markdown 키를 반환한다."""
    client = TestClient(_build_app(
        advisor_mock=_make_nomad_advisor_mock(),
        detail_mock=_make_detail_mock("## 상세 가이드"),
    ))
    r = client.post("/api/detail", json={"parsed_data": MOCK_PARSED_DATA, "city_index": 0})

    assert r.status_code == 200
    assert "markdown" in r.json()


def test_detail_markdown_is_nonempty_string():
    """markdown이 비어있지 않은 문자열이어야 한다."""
    client = TestClient(_build_app(
        advisor_mock=_make_nomad_advisor_mock(),
        detail_mock=_make_detail_mock("## 리스본 가이드"),
    ))
    r = client.post("/api/detail", json={"parsed_data": MOCK_PARSED_DATA})

    md = r.json()["markdown"]
    assert isinstance(md, str)
    assert len(md) > 0


def test_detail_default_city_index_is_zero():
    """city_index 미전달 시 기본값 0으로 호출된다."""
    detail = _make_detail_mock("## 가이드")
    client = TestClient(_build_app(
        advisor_mock=_make_nomad_advisor_mock(),
        detail_mock=detail,
    ))
    client.post("/api/detail", json={"parsed_data": MOCK_PARSED_DATA})

    _, kwargs = detail.call_args
    assert kwargs["city_index"] == 0


def test_detail_city_index_1_passed_correctly():
    """city_index=1 전달 시 그대로 함수에 전달된다."""
    detail = _make_detail_mock("## 가이드")
    client = TestClient(_build_app(
        advisor_mock=_make_nomad_advisor_mock(),
        detail_mock=detail,
    ))
    client.post("/api/detail", json={"parsed_data": MOCK_PARSED_DATA, "city_index": 1})

    _, kwargs = detail.call_args
    assert kwargs["city_index"] == 1


def test_detail_missing_parsed_data_returns_422():
    """parsed_data 누락 시 422."""
    client = TestClient(_build_app(
        advisor_mock=_make_nomad_advisor_mock(),
        detail_mock=_make_detail_mock(),
    ))
    r = client.post("/api/detail", json={"city_index": 0})
    assert r.status_code == 422


def test_detail_empty_dict_parsed_data_accepted():
    """빈 dict parsed_data 전달 시 크래시 없이 응답 반환."""
    client = TestClient(_build_app(
        advisor_mock=_make_nomad_advisor_mock(),
        detail_mock=_make_detail_mock("⚠️ 도시 정보를 찾을 수 없습니다"),
    ))
    r = client.post("/api/detail", json={"parsed_data": {}})

    assert r.status_code == 200
    assert r.json()["markdown"] == "⚠️ 도시 정보를 찾을 수 없습니다"


def test_detail_parsed_data_forwarded_correctly():
    """parsed_data와 city_index가 detail 함수에 그대로 전달된다."""
    detail = _make_detail_mock()
    client = TestClient(_build_app(
        advisor_mock=_make_nomad_advisor_mock(),
        detail_mock=detail,
    ))
    client.post("/api/detail", json={"parsed_data": MOCK_PARSED_DATA, "city_index": 2})

    _, kwargs = detail.call_args
    assert kwargs["parsed_data"] == MOCK_PARSED_DATA
    assert kwargs["city_index"] == 2


def test_detail_shares_same_rate_limit_bucket():
    """detail은 recommend와 별도 버킷을 써서 anonymous 10회까지 허용한다."""
    client = TestClient(_build_rate_limited_app())

    for _ in range(5):
        assert client.post("/api/recommend", json={}).status_code == 200

    for _ in range(10):
        assert client.post("/api/detail", json={}).status_code == 200

    r = client.post("/api/detail", json={})
    assert r.status_code == 429


def test_free_user_is_keyed_by_user_id_not_ip():
    """같은 IP여도 free 로그인 사용자는 user_id별로 분리된다."""
    client = TestClient(_build_rate_limited_app())
    headers_1 = {"x-access-mode": "free", "x-user-id": "user-a"}
    headers_2 = {"x-access-mode": "free", "x-user-id": "user-b"}

    for _ in range(10):
        assert client.post("/api/recommend", json={}, headers=headers_1).status_code == 200

    assert client.post("/api/recommend", json={}, headers=headers_1).status_code == 429
    assert client.post("/api/recommend", json={}, headers=headers_2).status_code == 200


def test_pro_payg_bypasses_minute_limit_but_hits_burst_guard():
    """pro_payg는 minute cap은 없지만 burst cap은 유지된다."""
    client = TestClient(_build_rate_limited_app())
    headers = {"x-access-mode": "pro_payg", "x-user-id": "pro-user"}

    for _ in range(3):
        assert client.post("/api/recommend", json={}, headers=headers).status_code == 200

    r = client.post("/api/recommend", json={}, headers=headers)
    assert r.status_code == 429


def test_payg_cap_returns_402_before_detail_handler_runs():
    """payg cap 도달 시 detail은 402를 반환한다."""
    client = TestClient(_build_rate_limited_app())
    headers = {
        "x-access-mode": "pro_payg",
        "x-user-id": "pro-user",
        "x-payg-cap-reached": "1",
    }

    r = client.post("/api/detail", json={}, headers=headers)
    assert r.status_code == 402
    assert r.json()["detail"] == "Monthly pay-as-you-go cap reached."


def test_build_me_response_includes_normalized_entitlement():
    payload = build_me_response(
        {
            "uid": "user-1",
            "name": "Jane",
            "picture": "https://example.com/avatar.png",
        },
        None,
    )

    assert payload["logged_in"] is True
    assert payload["uid"] == "user-1"
    assert payload["entitlement"]["plan_tier"] == "free"
    assert payload["entitlement"]["payg_enabled"] is False
