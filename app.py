# app.py
import os
import logging
from dotenv import load_dotenv
load_dotenv()

import utils.currency
from api.hf_client      import query_model, query_model_cached
from api.cache_manager  import get_or_create_cache, invalidate
from api.parser         import parse_response, format_result_markdown, format_step1_markdown, format_step2_markdown, _inject_visa_urls
from recommender        import recommend_from_db
from prompts.builder    import build_prompt, build_detail_prompt, build_step1_user_message, validate_user_profile
from prompts.system     import SYSTEM_PROMPT
from prompts.system_en  import SYSTEM_PROMPT_EN
from prompts.data_context import DATA_CONTEXT
from prompts.few_shots  import FEW_SHOT_EXAMPLES
from ui.layout          import create_layout

# USE_NEW_UI=1 → custom faceted filter UI (requires USE_DB_RECOMMENDER=1)
# USE_NEW_UI=0 → original Gradio form (layout.py)
_USE_NEW_UI = os.getenv("USE_NEW_UI", "0") == "1"

if _USE_NEW_UI:
    from ui.layout_v2 import build_layout_v2

logger = logging.getLogger(__name__)

_VISA_DB_CACHE: dict | None = None


def _lookup_visa_data(country_id: str) -> dict | None:
    """visa_db.json에서 country_id에 해당하는 항목 반환. 없으면 None."""
    global _VISA_DB_CACHE
    if _VISA_DB_CACHE is None:
        import json, os
        path = os.path.join(os.path.dirname(__file__), "data", "visa_db.json")
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

    income_usd = round(income_krw * 10000 * usd_rate)

    user_profile = {
        "nationality":        nationality,
        "income_usd":         income_usd,
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
    }

    # 사전 검증 — hard_block 시 LLM 호출 없이 즉시 안내 메시지 반환
    validation = validate_user_profile(user_profile)
    if validation["hard_block"]:
        block_msg = validation["warnings"][0] if validation["warnings"] else "입력 조건 불충족"
        return (
            f"🚫 {block_msg}\n\n소득을 높이거나 체류 기간 또는 대륙을 변경해주세요.",
            [],
            {},
        )

    if os.getenv("USE_DB_RECOMMENDER", "1") == "1":
        # DB 기반 추천 경로 (LLM 호출 없음)
        parsed = recommend_from_db(user_profile)
        _inject_visa_urls(parsed)
    else:
        # 기존 LLM 경로 (롤백용, 삭제 금지)
        # --- 서버사이드 Context Caching 시도 ---
        # SYSTEM_PROMPT + DATA_CONTEXT + FEW_SHOTS를 Gemini 서버에 캐싱.
        # 캐시 히트 시 정적 컨텍스트(~7,500 tokens) 재전송 비용/지연 절감.
        # 캐시 실패(API키 없음·오류) 시 기존 OpenAI-compat 경로로 자동 폴백.
        cache_key     = f"step1_{'en' if preferred_language == 'English' else 'ko'}"
        system_prompt = SYSTEM_PROMPT_EN if preferred_language == "English" else SYSTEM_PROMPT

        cache = get_or_create_cache(
            system_prompt=system_prompt,
            data_context=DATA_CONTEXT,
            few_shot_messages=FEW_SHOT_EXAMPLES,
            cache_key=cache_key,
        )

        if cache:
            user_msg = build_step1_user_message(user_profile)
            raw = query_model_cached(user_msg, cache, max_tokens=8192)
            if raw.startswith("ERROR"):
                # 캐시 무효화 후 폴백
                logger.warning("[app] Cached query failed — invalidating cache, falling back")
                invalidate(cache_key)
                messages = build_prompt(user_profile)
                raw = query_model(messages, max_tokens=8192)
        else:
            messages = build_prompt(user_profile)
            raw      = query_model(messages, max_tokens=8192)

        if raw.startswith("ERROR"):
            return f"⚠️ API 오류: {raw}", [], {}

        parsed = parse_response(raw)

    # 두 경로 공통: _user_profile 주입
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
    if not top_cities or city_index >= len(top_cities):
        return "선택한 도시를 찾을 수 없습니다."

    selected_city = top_cities[city_index]
    user_profile  = parsed_data.get("_user_profile", {})

    step2_messages = build_detail_prompt(
        selected_city,
        user_profile,   # _user_profile 키 사용
    )

    raw = query_model(step2_messages, max_tokens=6144)

    if raw.startswith("ERROR"):
        return f"⚠️ API 오류: {raw}"

    detail_parsed = parse_response(raw)

    # visa_db에서 출처·기준일 조회
    visa_data = _lookup_visa_data(selected_city.get("country_id", ""))
    markdown = format_step2_markdown(detail_parsed, visa_data=visa_data)

    return markdown


from ui.layout import _APP_CSS
from ui.theme import create_theme

if _USE_NEW_UI:
    demo = build_layout_v2(nomad_advisor, show_city_detail)
else:
    demo = create_layout(nomad_advisor, show_city_detail)

if __name__ == "__main__":
    _is_hf = bool(os.getenv("SPACE_ID"))
    demo.launch(
        theme=create_theme(),
        css=_APP_CSS,
        server_name="0.0.0.0" if _is_hf else "127.0.0.1",
        server_port=7860,
        inbrowser=not _is_hf,
    )
