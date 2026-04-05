"""모바일 앱 전용 Recommend/Detail 라우터."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from utils.mobile_auth import require_mobile_auth
from utils.persona import persist_user_persona_type

router = APIRouter(prefix="/api/mobile", tags=["mobile-recommend"])


class RecommendRequest(BaseModel):
    nationality: str
    income_krw: int
    immigration_purpose: str
    lifestyle: list[str]
    languages: list[str]
    timeline: str
    preferred_countries: list[str] = Field(default_factory=list)
    preferred_language: str = "한국어"
    persona_type: str | None = None
    income_type: str = ""
    travel_type: str = "혼자 (솔로)"
    children_ages: list[str] | None = None
    dual_nationality: bool = False
    readiness_stage: str = ""
    has_spouse_income: str = "없음"
    spouse_income_krw: int = 0


class DetailRequest(BaseModel):
    parsed_data: dict
    city_index: int = 0


@router.post("/recommend")
async def mobile_recommend(req: RecommendRequest, user_id: str = Depends(require_mobile_auth)):
    persist_user_persona_type(user_id, req.persona_type)
    from app import nomad_advisor
    markdown, cities, parsed = nomad_advisor(
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


@router.post("/detail")
async def mobile_detail(req: DetailRequest, user_id: str = Depends(require_mobile_auth)):
    del user_id  # 인증 목적만 사용
    from app import show_city_detail_with_nationality
    markdown = show_city_detail_with_nationality(
        parsed_data=req.parsed_data,
        city_index=req.city_index,
    )
    return {"markdown": markdown}
