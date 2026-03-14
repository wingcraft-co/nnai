# prompts/builder.py
from prompts.system    import SYSTEM_PROMPT
from prompts.few_shots import FEW_SHOT_EXAMPLES
from rag.retriever     import retrieve_as_context


def build_prompt(user_profile: dict) -> list[dict]:
    """Step 1 프롬프트 생성: 사용자 프로필 + RAG 컨텍스트 → messages list"""
    nationality = user_profile.get("nationality", "Korean")
    income_usd  = user_profile.get("income_usd", 3000)
    income_krw  = user_profile.get("income_krw", 420)
    purpose     = user_profile.get("purpose", "디지털 노마드")
    lifestyle   = user_profile.get("lifestyle", [])
    languages   = user_profile.get("languages", [])
    timeline    = user_profile.get("timeline", "1년 단기 체험")

    preferred_countries = user_profile.get("preferred_countries", [])
    # flag emoji 제거: "🇲🇾 말레이시아" → "말레이시아"
    country_names = [c.split(" ", 1)[-1] for c in preferred_countries if c.strip()]

    preferred_hint = ""
    if country_names:
        preferred_hint = (
            f"※ 우선 고려 국가: {', '.join(country_names)} "
            f"(단, 프로필에 더 적합한 다른 도시가 있다면 포함 가능)\n\n"
        )

    rag_query = (
        f"{nationality} {purpose} 월 소득 ${income_usd:.0f} "
        f"라이프스타일 {' '.join(lifestyle)} {timeline} 비자 도시 추천"
    )
    rag_context = retrieve_as_context(rag_query, top_k=6)

    user_message = (
        f"국적: {nationality} | 월 수입: {income_krw * 100:,.0f}만원 "
        f"(약 ${income_usd:,.0f} USD) | "
        f"장기 체류 목적: {purpose} | "
        f"사용 가능 언어: {', '.join(languages) if languages else '미응답'} | "
        f"목표 체류 기간: {timeline}\n"
        f"라이프스타일 선호: {', '.join(lifestyle) if lifestyle else '특별한 선호 없음'}\n\n"
        f"{rag_context}\n\n"
        f"{preferred_hint}"
        "위 프로필 기반으로 최적 거주 도시 TOP 3를 추천하세요. "
        "현실적 어려움과 위험 요소를 반드시 포함하세요. "
        "반드시 순수 JSON만 출력하세요."
    )

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(FEW_SHOT_EXAMPLES)
    messages.append({"role": "user", "content": user_message})
    return messages


_STEP2_SYSTEM_PROMPT = """당신은 특정 도시의 장기 체류 정착 가이드 전문가입니다.
선택된 도시와 사용자 프로필을 바탕으로 단계별 장기 체류 준비 가이드를 JSON으로 작성하세요.

[출력 규칙]
1. 순수 JSON만 출력하세요. 코드 블록이나 설명 텍스트 없이.
2. 모든 한국어 필드는 반드시 한국어로 작성하세요.
3. visa_checklist와 first_steps는 반드시 문자열 배열(list[str])로 출력하세요. dict나 중첩 객체를 사용하지 마세요.
4. 모든 배열 필드(visa_checklist, first_steps, sections[].items)는 빈 배열이 아닌 최소 3개 이상의 항목을 포함해야 합니다.
5. JSON이 잘리지 않도록 반드시 완전한 JSON을 출력하세요.

[출력 스키마 — 정확히 따를 것]
{
  "city": "도시명",
  "country_id": "ISO 코드",
  "immigration_guide": {
    "title": "가이드 제목",
    "sections": [
      {
        "step": 1,
        "title": "섹션 제목",
        "items": ["실행 항목 1", "실행 항목 2"]
      }
    ]
  },
  "visa_checklist": ["여권 사본 (유효기간 6개월 이상)", "소득 증빙 서류 (최근 3개월 은행 내역)", "여권 사진 2장"],
  "budget_breakdown": {"rent": 숫자, "food": 숫자, "cowork": 숫자, "misc": 숫자},
  "first_steps": ["비자 신청 서류 준비 시작", "항공권 및 숙소 예약", "현지 한인 커뮤니티 채널 가입"]
}

[중요] visa_checklist 예시 (올바른 형식):
["여권 사본", "소득 증빙 서류", "거주지 증명서", "건강보험 가입 증명서"]

[중요] first_steps 예시 (올바른 형식):
["비자 신청서 작성 및 제출", "현지 은행 계좌 개설 예약", "코워킹 스페이스 단기 멤버십 신청"]"""


def build_detail_prompt(selected_city: dict, user_profile: dict) -> list[dict]:
    """Step 2 프롬프트 생성: 선택된 도시 + 사용자 프로필 → 상세 가이드 messages list"""
    city        = selected_city.get("city", "")
    country_id  = selected_city.get("country_id", "")
    visa_type   = selected_city.get("visa_type", "")
    cost        = selected_city.get("monthly_cost_usd", 0)

    nationality = user_profile.get("nationality", "Korean")
    purpose     = user_profile.get("purpose", "디지털 노마드")
    languages   = user_profile.get("languages", [])
    timeline    = user_profile.get("timeline", "")
    income_usd  = user_profile.get("income_usd", 0)

    user_message = (
        f"선택 도시: {city} ({country_id}) | 비자 유형: {visa_type} | "
        f"월 예상 비용: ${cost:,}\n"
        f"사용자 프로필: 국적={nationality}, 목적={purpose}, "
        f"월소득=${income_usd:,.0f}, "
        f"언어={', '.join(languages) if languages else '미응답'}, "
        f"기간={timeline}\n\n"
        "위 정보를 바탕으로 장기 체류 준비 단계별 가이드를 반드시 순수 JSON으로 작성하세요."
    )

    return [
        {"role": "system", "content": _STEP2_SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]
