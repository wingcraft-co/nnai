# prompts/builder.py
from prompts.system    import SYSTEM_PROMPT
from prompts.system_en import SYSTEM_PROMPT_EN
from prompts.few_shots import FEW_SHOT_EXAMPLES
from rag.retriever     import retrieve_as_context


def build_prompt(user_profile: dict) -> list[dict]:
    """Step 1 프롬프트 생성: 사용자 프로필 + RAG 컨텍스트 → messages list"""
    language    = user_profile.get("language", "한국어")
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

    persona_type = user_profile.get("persona_type", "")
    persona_hint = ""
    if persona_type:
        from utils.persona import get_persona_hint
        persona_hint = get_persona_hint(persona_type)
        if persona_hint:
            persona_hint = persona_hint + "\n\n"

    rag_query = (
        f"{nationality} {purpose} 월 소득 ${income_usd:.0f} "
        f"라이프스타일 {' '.join(lifestyle)} {timeline} 비자 도시 추천"
    )
    rag_context = retrieve_as_context(rag_query, top_k=6)

    if language == "English":
        user_message = (
            f"Nationality: {nationality} | Monthly income: ${income_usd:,.0f} USD | "
            f"Stay purpose: {purpose} | "
            f"Languages: {', '.join(languages) if languages else 'not specified'} | "
            f"Target stay duration: {timeline}\n"
            f"Lifestyle preferences: {', '.join(lifestyle) if lifestyle else 'no specific preference'}\n\n"
            f"{rag_context}\n\n"
            f"{persona_hint}"
            f"{preferred_hint}"
            "Based on the above profile, recommend the top 3 best cities for long-term digital nomad living. "
            "Include realistic challenges and risks. "
            "Output pure JSON only."
        )
        system_prompt = SYSTEM_PROMPT_EN
    else:
        user_message = (
            f"국적: {nationality} | 월 수입: {income_krw * 100:,.0f}만원 "
            f"(약 ${income_usd:,.0f} USD) | "
            f"장기 체류 목적: {purpose} | "
            f"사용 가능 언어: {', '.join(languages) if languages else '미응답'} | "
            f"목표 체류 기간: {timeline}\n"
            f"라이프스타일 선호: {', '.join(lifestyle) if lifestyle else '특별한 선호 없음'}\n\n"
            f"{rag_context}\n\n"
            f"{persona_hint}"
            f"{preferred_hint}"
            "위 프로필 기반으로 최적 거주 도시 TOP 3를 추천하세요. "
            "현실적 어려움과 위험 요소를 반드시 포함하세요. "
            "반드시 순수 JSON만 출력하세요."
        )
        system_prompt = SYSTEM_PROMPT

    messages = [{"role": "system", "content": system_prompt}]
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
  "budget_breakdown": {
    "rent": 600,
    "food": 300,
    "cowork": 100,
    "misc": 150
  },
  "budget_source": "https://www.numbeo.com/cost-of-living/in/Chiang-Mai",
  "first_steps": ["비자 신청 서류 준비 시작", "항공권 및 숙소 예약", "현지 한인 커뮤니티 채널 가입"]
}

[budget_breakdown 작성 지침]
budget_breakdown의 각 항목은 Numbeo(https://www.numbeo.com/cost-of-living/)의
해당 도시 생활비 데이터를 기준으로 작성하라.
budget_source 필드에 해당 도시의 Numbeo URL을 포함하라.
예: "budget_source": "https://www.numbeo.com/cost-of-living/in/Chiang-Mai"
(도시명은 영문 하이픈 형식으로 변환, 예: "Kuala Lumpur" → "Kuala-Lumpur")

[중요] visa_checklist 예시 (올바른 형식):
["여권 사본", "소득 증빙 서류", "거주지 증명서", "건강보험 가입 증명서"]

[중요] first_steps 예시 (올바른 형식):
["비자 신청서 작성 및 제출", "현지 은행 계좌 개설 예약", "코워킹 스페이스 단기 멤버십 신청"]"""


_STEP2_SYSTEM_PROMPT_EN = """You are an expert long-term stay advisor for digital nomads.
Based on the selected city and user profile, write a step-by-step relocation preparation guide in JSON.

[OUTPUT RULES]
1. Output ONLY pure JSON — no code blocks, no text.
2. All text fields must be in English.
3. visa_checklist and first_steps must be arrays of strings (list[str]). No dicts or nested objects.
4. All array fields must contain at least 3 items.
5. Output complete, valid JSON — do not truncate.

[OUTPUT SCHEMA]
{
  "city": "City Name",
  "country_id": "ISO code",
  "immigration_guide": {
    "title": "Guide title",
    "sections": [
      {"step": 1, "title": "Section title", "items": ["Action item 1", "Action item 2"]}
    ]
  },
  "visa_checklist": ["Passport copy (valid 6+ months)", "Proof of income (last 3 months bank statements)", "Passport photos x2"],
  "budget_breakdown": {"rent": 600, "food": 300, "cowork": 100, "misc": 150},
  "budget_source": "https://www.numbeo.com/cost-of-living/in/Chiang-Mai",
  "first_steps": ["Start gathering visa application documents", "Book flights and accommodation", "Join local expat/nomad community groups"]
}

[budget_breakdown guidelines]
Base each item on Numbeo (https://www.numbeo.com/cost-of-living/) data for the city.
Include budget_source with the Numbeo URL for that city.
Example: "budget_source": "https://www.numbeo.com/cost-of-living/in/Chiang-Mai"
(Convert city name to hyphenated English format, e.g. "Kuala Lumpur" → "Kuala-Lumpur")"""


def build_detail_prompt(selected_city: dict, user_profile: dict) -> list[dict]:
    """Step 2 프롬프트 생성: 선택된 도시 + 사용자 프로필 → 상세 가이드 messages list"""
    language    = user_profile.get("language", "한국어")
    city        = selected_city.get("city", "")
    country_id  = selected_city.get("country_id", "")
    visa_type   = selected_city.get("visa_type", "")
    cost        = selected_city.get("monthly_cost_usd", 0)

    nationality = user_profile.get("nationality", "Korean")
    purpose     = user_profile.get("purpose", "디지털 노마드")
    languages   = user_profile.get("languages", [])
    timeline    = user_profile.get("timeline", "")
    income_usd  = user_profile.get("income_usd", 0)

    if language == "English":
        user_message = (
            f"Selected city: {city} ({country_id}) | Visa type: {visa_type} | "
            f"Monthly cost estimate: ${cost:,}\n"
            f"User profile: nationality={nationality}, purpose={purpose}, "
            f"monthly income=${income_usd:,.0f}, "
            f"languages={', '.join(languages) if languages else 'not specified'}, "
            f"duration={timeline}\n\n"
            "Based on the above, write a step-by-step long-term stay preparation guide in pure JSON."
        )
        step2_system = _STEP2_SYSTEM_PROMPT_EN
    else:
        user_message = (
            f"선택 도시: {city} ({country_id}) | 비자 유형: {visa_type} | "
            f"월 예상 비용: ${cost:,}\n"
            f"사용자 프로필: 국적={nationality}, 목적={purpose}, "
            f"월소득=${income_usd:,.0f}, "
            f"언어={', '.join(languages) if languages else '미응답'}, "
            f"기간={timeline}\n\n"
            "위 정보를 바탕으로 장기 체류 준비 단계별 가이드를 반드시 순수 JSON으로 작성하세요."
        )
        step2_system = _STEP2_SYSTEM_PROMPT

    return [
        {"role": "system", "content": step2_system},
        {"role": "user", "content": user_message},
    ]
