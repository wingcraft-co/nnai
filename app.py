# app.py
import os
import logging
from dotenv import load_dotenv
load_dotenv()

import utils.currency
from api.hf_client      import query_model
from api.parser         import parse_response, format_step1_markdown, format_step2_markdown, _inject_visa_urls
from recommender        import recommend_from_db
from prompts.builder    import build_detail_prompt, validate_user_profile
from ui.layout          import create_layout
from utils.data_paths   import resolve_data_path

logger = logging.getLogger(__name__)

_VISA_DB_CACHE: dict | None = None


def _is_debug_mode_enabled() -> bool:
    return os.getenv("DEBUG_MODE", "").strip().lower() in {"1", "true", "yes", "on"}


def _lookup_visa_data(country_id: str) -> dict | None:
    """visa_db.json에서 country_id에 해당하는 항목 반환. 없으면 None."""
    global _VISA_DB_CACHE
    if _VISA_DB_CACHE is None:
        import json
        path = resolve_data_path("visa_db.json")
        try:
            with open(path, encoding="utf-8") as f:
                _VISA_DB_CACHE = {c["id"]: c for c in json.load(f)["countries"]}
        except Exception:
            _VISA_DB_CACHE = {}
    return _VISA_DB_CACHE.get(country_id)


def nomad_advisor(
    nationality: str,
    income_krw: int,
    immigration_purpose: str,
    lifestyle: list,
    languages: list,
    timeline: str,
    preferred_countries=None,   # 신규 — None을 기본값으로, 내부에서 [] 처리
    preferred_language: str = "한국어",
    persona_type: str = "",
    income_type: str = "",
    travel_type: str = "혼자 (솔로)",
    children_ages: list | None = None,
    dual_nationality: bool = False,
    readiness_stage: str = "",
    has_spouse_income: str = "없음",
    spouse_income_krw: int = 0,
    stay_style: str | None = None,
    tax_sensitivity: str | None = None,
    total_budget_krw: int | None = None,
    persona_vector: dict | None = None,
) -> tuple[str, list, dict]:
    """
    Step 1 파이프라인: RAG → 프롬프트 → LLM → 파싱 → 마크다운 + 도시 리스트

    Returns:
        (markdown_str, top_cities_list, parsed_dict)
    """
    if preferred_countries is None:
        preferred_countries = []

    # 환율 조회 및 KRW → USD 변환 (income_krw 단위: 만원)
    try:
        rates = utils.currency.get_exchange_rates()
        usd_rate = rates.get("USD", 0.000714)
    except Exception:
        usd_rate = 0.000714

    # 단기 체류 + total_budget_krw가 있으면 월 환산 예산으로 대체
    resolved_tl = {"1~3개월 단기 체류": "90일 단기 체험"}.get(timeline, timeline)
    if resolved_tl == "90일 단기 체험" and total_budget_krw and total_budget_krw > 0:
        monthly_budget_krw = total_budget_krw / 2  # 1~3개월 중간값
        income_usd = round(monthly_budget_krw * 10000 * usd_rate)
    else:
        income_usd = round(income_krw * 10000 * usd_rate)
    spouse_income_usd = 0
    if has_spouse_income == "있음" and spouse_income_krw > 0:
        spouse_income_usd = round(spouse_income_krw * 10000 * usd_rate)
    effective_income_usd = income_usd + spouse_income_usd

    user_profile = {
        "nationality":        nationality,
        "income_usd":         income_usd,
        "spouse_income_usd":  spouse_income_usd,
        "effective_income_usd": effective_income_usd,
        "income_krw":         income_krw,  # 만원 단위
        "purpose":            immigration_purpose,
        "lifestyle":          lifestyle if isinstance(lifestyle, list) else [lifestyle],
        "languages":          languages if isinstance(languages, list) else [languages],
        "timeline":           timeline,
        "preferred_countries": preferred_countries,
        "language":           preferred_language,
        "persona_type":       persona_type,
        "income_type":        income_type,
        "travel_type":        travel_type,
        "children_ages":      children_ages if isinstance(children_ages, list) else [],
        "dual_nationality":   dual_nationality,
        "readiness_stage":    readiness_stage,
        "has_spouse_income":  has_spouse_income,
        "spouse_income_krw":  spouse_income_krw,
        "stay_style":         stay_style,
        "tax_sensitivity":    tax_sensitivity,
        "persona_vector":     persona_vector,
    }

    # 사전 검증 — hard_block 시 LLM 호출 없이 즉시 안내 메시지 반환
    validation = validate_user_profile(user_profile)
    if validation["hard_block"]:
        block_msg = validation["warnings"][0] if validation["warnings"] else "입력 조건 불충족"
        if preferred_language == "English":
            return (
                f"🚫 {block_msg}\n\nIncrease income, or adjust your target duration/continent.",
                [],
                {},
            )
        return (
            f"🚫 {block_msg}\n\n소득을 높이거나 체류 기간 또는 대륙을 변경해주세요.",
            [],
            {},
        )

    # Step 1 TOP3는 항상 규칙 기반 DB 추천 엔진으로 계산 (LLM 미개입).
    parsed = recommend_from_db(user_profile, debug_mode=_is_debug_mode_enabled())
    _inject_visa_urls(parsed)

    # _user_profile 주입
    parsed["_user_profile"] = user_profile

    markdown = format_step1_markdown(parsed)
    cities   = parsed.get("top_cities", [])

    return markdown, cities, parsed


def show_city_detail(
    parsed_data: dict,
    city_index: int = 0,
) -> str:
    """
    Step 2 파이프라인: 선택된 도시 → LLM → 상세 가이드 마크다운
    """
    top_cities = parsed_data.get("top_cities", [])
    language = parsed_data.get("_user_profile", {}).get("language", "한국어")
    if not top_cities or city_index >= len(top_cities):
        return "Selected city was not found." if language == "English" else "선택한 도시를 찾을 수 없습니다."

    selected_city = top_cities[city_index]
    user_profile  = parsed_data.get("_user_profile", {})

    step2_messages = build_detail_prompt(
        selected_city,
        user_profile,   # _user_profile 키 사용
    )

    raw = query_model(step2_messages, max_tokens=6144)

    if raw.startswith("ERROR"):
        return f"⚠️ API error: {raw}" if language == "English" else f"⚠️ API 오류: {raw}"

    detail_parsed = parse_response(raw)
    detail_parsed["_user_profile"] = user_profile

    # visa_db에서 출처·기준일 조회
    visa_data = _lookup_visa_data(selected_city.get("country_id", ""))
    markdown = format_step2_markdown(detail_parsed, visa_data=visa_data)

    return markdown


def _get_language_by_nationality(nationality: str) -> str:
    """국적(여권발급국가)에 따라 답변 언어 결정."""
    nationality_to_lang = {
        "Korean": "한국어",
        "Japanese": "日本語",
        "Chinese": "中文",
        "German": "Deutsch",
        "French": "Français",
        "Spanish": "Español",
        "Italian": "Italiano",
        "American": "English",
        "British": "English",
        "Australian": "English",
        "Other": "English",
    }
    return nationality_to_lang.get(nationality, "English")


# Step 2 함수 래퍼: Step 1에서 확정된 UI 언어를 그대로 사용
def show_city_detail_with_nationality(
    parsed_data: dict,
    city_index: int = 0,
) -> str:
    """Step 2: Step 1에서 선택된 UI 언어로 상세 가이드 제공."""
    top_cities = parsed_data.get("top_cities", [])
    language = parsed_data.get("_user_profile", {}).get("language", "한국어")
    if not top_cities or city_index >= len(top_cities):
        return "Selected city was not found." if language == "English" else "선택한 도시를 찾을 수 없습니다."

    selected_city = top_cities[city_index]
    user_profile  = parsed_data.get("_user_profile", {})

    # Step 1에서 저장된 언어를 우선 사용. 없으면 국적 기반으로 폴백.
    selected_language = user_profile.get("language")
    nationality = user_profile.get("nationality", "Other")
    user_profile_for_step2 = user_profile.copy()
    user_profile_for_step2["language"] = selected_language or _get_language_by_nationality(nationality)

    step2_messages = build_detail_prompt(
        selected_city,
        user_profile_for_step2,
    )

    raw = query_model(step2_messages, max_tokens=6144)

    if raw.startswith("ERROR"):
        lang = user_profile_for_step2.get("language", language)
        return f"⚠️ API error: {raw}" if lang == "English" else f"⚠️ API 오류: {raw}"

    detail_parsed = parse_response(raw)
    detail_parsed["_user_profile"] = user_profile_for_step2

    # visa_db에서 출처·기준일 조회
    visa_data = _lookup_visa_data(selected_city.get("country_id", ""))
    markdown = format_step2_markdown(detail_parsed, visa_data=visa_data)

    return markdown


from ui.layout import _APP_CSS
from ui.theme import create_theme

demo = create_layout(nomad_advisor, show_city_detail_with_nationality)

_is_hf = bool(os.getenv("SPACE_ID"))
_is_railway = bool(os.getenv("RAILWAY_ENVIRONMENT"))
_is_cloud = _is_hf or _is_railway

if __name__ == "__main__" or _is_hf:
    import uvicorn
    from fastapi import FastAPI as _FastAPI, Request as _Request
    from fastapi.responses import PlainTextResponse as _PlainText, HTMLResponse as _HTML
    from starlette.middleware.base import BaseHTTPMiddleware as _Middleware
    from api.auth import router as _auth_router, extract_user_id as _extract_uid
    from api.pins import router as _pins_router
    from utils.db import init_db as _init_db

    _init_db()

    _ads_txt = "google.com, pub-8452594011595682, DIRECT, f08c47fec0942fa0"
    _privacy_html = open(os.path.join(os.path.dirname(__file__), "docs", "privacy.html"), encoding="utf-8").read() if os.path.exists(os.path.join(os.path.dirname(__file__), "docs", "privacy.html")) else "<h1>Privacy Policy</h1><p>See nnai.app/privacy</p>"

    _fapp = _FastAPI(title="NomadNavigator API")

    class _AuthMiddleware(_Middleware):
        async def dispatch(self, request: _Request, call_next):
            if request.url.path == "/ads.txt":
                return _PlainText(_ads_txt)
            if request.url.path in ("/privacy", "/privacy-policy"):
                return _HTML(_privacy_html)
            request.state.user_id = _extract_uid(request)
            return await call_next(request)

    _fapp.add_middleware(_AuthMiddleware)
    _fapp.include_router(_auth_router)
    _fapp.include_router(_pins_router, prefix="/api")

    import gradio as _gr
    _gr.mount_gradio_app(_fapp, demo, path="/")

    uvicorn.run(
        _fapp,
        host="0.0.0.0" if _is_cloud else "127.0.0.1",
        port=int(os.getenv("PORT", 7860)),
    )
