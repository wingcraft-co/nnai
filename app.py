# app.py
import os
from dotenv import load_dotenv
load_dotenv()

import utils.currency
from api.hf_client        import query_model
from api.parser           import parse_response, format_result_markdown, format_step1_markdown, format_step2_markdown
from report.pdf_generator import generate_report
from rag.vector_store     import build_index
from prompts.builder      import build_prompt, build_detail_prompt
from ui.layout            import create_layout

# 앱 시작 시 RAG 인덱스 자동 초기화 (테스트 시 SKIP_RAG_INIT 환경변수로 건너뜀)
if not os.getenv("SKIP_RAG_INIT"):
    print("🔧 RAG 인덱스 초기화...")
    build_index(force=False)
    print("✅ RAG 준비 완료")


def nomad_advisor(
    nationality: str,
    income_krw: int,
    immigration_purpose: str,
    lifestyle: list,
    languages: list,
    timeline: str,
) -> tuple[str, list, dict]:
    """
    Step 1 파이프라인: RAG → 프롬프트 → LLM → 파싱 → 마크다운 + 도시 리스트

    Returns:
        (markdown_str, top_cities_list, parsed_dict)
    """
    # 환율 조회 및 KRW → USD 변환 (income_krw 단위: 만원)
    try:
        rates = utils.currency.get_exchange_rates()
        usd_rate = rates.get("USD", 0.000714)
    except Exception:
        usd_rate = 0.000714

    income_usd = round(income_krw * 10000 * usd_rate)

    user_profile = {
        "nationality": nationality,
        "income_usd":  income_usd,
        "income_krw":  income_krw,  # 만원 단위
        "purpose":     immigration_purpose,
        "lifestyle":   lifestyle if isinstance(lifestyle, list) else [lifestyle],
        "languages":   languages if isinstance(languages, list) else [languages],
        "timeline":    timeline,
    }

    messages = build_prompt(user_profile)
    raw      = query_model(messages, max_tokens=2048)

    if raw.startswith("ERROR"):
        return f"⚠️ API 오류: {raw}", [], {}

    parsed = parse_response(raw)

    # user_profile 주입 (Step 2에서 참조)
    parsed["_user_profile"] = user_profile

    markdown = format_step1_markdown(parsed)
    cities   = parsed.get("top_cities", [])

    return markdown, cities, parsed


def show_city_detail(
    parsed_data: dict,
    city_index: int = 0,
) -> tuple[str, str | None]:
    """
    Step 2 파이프라인: 선택된 도시 → LLM → 상세 가이드 마크다운 + PDF

    Returns:
        (markdown_str, pdf_path_or_None)
    """
    top_cities = parsed_data.get("top_cities", [])
    if not top_cities or city_index >= len(top_cities):
        return "선택한 도시를 찾을 수 없습니다.", None

    selected_city = top_cities[city_index]
    user_profile  = parsed_data.get("_user_profile", {})

    step2_messages = build_detail_prompt(
        selected_city,
        user_profile,   # _user_profile 키 사용
    )

    raw = query_model(step2_messages, max_tokens=2048)

    if raw.startswith("ERROR"):
        return f"⚠️ API 오류: {raw}", None

    detail_parsed = parse_response(raw)
    markdown      = format_step2_markdown(detail_parsed)

    # PDF 생성 (Step 2 데이터 + 선택된 도시 정보)
    pdf_data = {
        **detail_parsed,
        "_user_profile":  user_profile,
        "selected_city":  selected_city,
    }
    pdf_path = generate_report(pdf_data, user_profile)

    return markdown, pdf_path


if __name__ == "__main__":
    demo = create_layout(nomad_advisor, show_city_detail)
    demo.launch()
