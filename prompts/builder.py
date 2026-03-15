# prompts/builder.py
from prompts.system       import SYSTEM_PROMPT
from prompts.system_en    import SYSTEM_PROMPT_EN
from prompts.few_shots    import FEW_SHOT_EXAMPLES
from prompts.data_context import DATA_CONTEXT


def build_prompt(user_profile: dict) -> list[dict]:
    """Step 1 프롬프트 생성: 사용자 프로필 + RAG 컨텍스트 → messages list"""
    language      = user_profile.get("language", "한국어")
    nationality   = user_profile.get("nationality", "Korean")
    income_usd    = user_profile.get("income_usd", 3000)
    income_krw    = user_profile.get("income_krw", 420)
    purpose       = user_profile.get("purpose", "디지털 노마드")
    lifestyle     = user_profile.get("lifestyle", [])
    languages     = user_profile.get("languages", [])
    timeline      = user_profile.get("timeline", "1년 단기 체험")
    stay_duration = user_profile.get("stay_duration", "")

    preferred_countries = user_profile.get("preferred_countries", [])

    CONTINENT_TO_HINT = {
        "아시아": "동남아시아·동아시아 도시 (치앙마이, 발리, 쿠알라룸푸르, 다낭, 도쿄 등)",
        "유럽": "유럽 도시 (리스본, 바르셀로나, 탈린, 베를린, 아테네 등)",
        "중남미": "중남미 도시 (멕시코시티, 메데진, 부에노스아이레스 등)",
        "중동/아프리카": "중동·아프리카 도시 (두바이, 마라케시 등)",
        "북미": "북미 도시 (마이애미, 캐나다 등)",
    }

    preferred_hint = ""
    if preferred_countries:
        hints = [CONTINENT_TO_HINT[c] for c in preferred_countries if c in CONTINENT_TO_HINT]
        if hints:
            preferred_hint = (
                f"※ 우선 고려 대륙: {', '.join(preferred_countries)}. "
                f"해당 대륙 도시({'; '.join(hints)})를 TOP 3 추천에 우선 반영할 것.\n\n"
            )

    persona_type = user_profile.get("persona_type", "")
    persona_hint = ""
    if persona_type:
        from utils.persona import get_persona_hint
        persona_hint = get_persona_hint(persona_type)
        if persona_hint:
            persona_hint = persona_hint + "\n\n"

    slowmad_hint_en = ""
    slowmad_hint_kr = ""
    if stay_duration:
        if stay_duration == "slowmad":
            slowmad_hint_en = "※ User prefers slowmad style (3-6 months per city) — prioritize cities with mid-term rental options and flexible visa renewals.\n\n"
            slowmad_hint_kr = "※ 슬로마드 스타일 (도시당 3~6개월 체류) — 중기 임대 가능 도시 및 비자 갱신 유연성 우선 고려.\n\n"
        elif stay_duration == "nomad":
            slowmad_hint_en = "※ User prefers frequent moves (1-2 months per city) — prioritize cities with tourist visa or easy short-stay options.\n\n"
            slowmad_hint_kr = "※ 잦은 이동 선호 (도시당 1~2개월) — 관광 비자 또는 단기 체류가 용이한 도시 우선 고려.\n\n"

    income_type = user_profile.get("income_type", "")
    income_type_hint = ""
    if income_type == "프리랜서 (계약서·해외 송금 내역)":
        income_type_hint = "※ 소득 증빙: 프리랜서 — 포르투갈 D8, 독일 프리랜서 비자 서류 거절 리스크 주의. 계약서 및 해외 송금 내역 3개월치 필수.\n\n"
    elif income_type == "해외 법인 재직":
        income_type_hint = "※ 소득 증빙: 해외 법인 재직 — 고용계약서(영문) 및 급여명세서 필수. 스페인·포르투갈 디지털 노마드 비자 우선 고려.\n\n"
    elif income_type == "무소득 / 은퇴":
        income_type_hint = "※ 소득 없음 / 은퇴 — 배우자 동반 비자, 은퇴자 비자(은퇴 후 장기 거주), 자산 증명 기반 비자 가능 국가를 우선 추천하세요.\n\n"

    dual_nationality = user_profile.get("dual_nationality", False)
    dual_nat_hint = ""
    if dual_nationality:
        dual_nat_hint = "※ 복수국적 보유 — 쉥겐 90일은 한국 여권 기준이며, 보조 여권으로 체류 가능 여부를 포함하여 안내하세요.\n\n"

    TRAVEL_TYPE_HINTS = {
        "혼자 (솔로)": "코워킹 인프라, 노마드 커뮤니티 규모, 1인 생활비를 우선 고려.",
        "배우자·파트너 동반": "배우자 동반 비자 가능 여부, 합산 소득 기준 비자 필터링, 배우자 취업 허용 여부 포함.",
        "자녀 동반 (배우자 없이)": "국제학교 유무, 의료 인프라, 안전 지수를 1순위로 고려. 싱글 부모 비자 가능 여부 포함.",
        "가족 전체 동반 (배우자 + 자녀)": "국제학교, 의료, 안전 + 주거 면적, 가족 생활비 배수, 배우자 취업 허용 여부 포함.",
    }
    travel_type_val = user_profile.get("travel_type", "혼자 (솔로)")
    children_ages_val = user_profile.get("children_ages", [])
    travel_hint = ""
    if travel_type_val in ["자녀 동반 (배우자 없이)", "가족 전체 동반 (배우자 + 자녀)"]:
        ages_str = ", ".join(children_ages_val) if children_ages_val else "미지정"
        base_hint = TRAVEL_TYPE_HINTS.get(travel_type_val, "")
        travel_hint = f"※ {travel_type_val}: 자녀 연령 {ages_str} — {base_hint}\n\n"
    elif travel_type_val in TRAVEL_TYPE_HINTS:
        travel_hint = f"※ {TRAVEL_TYPE_HINTS[travel_type_val]}\n\n"

    timeline_hint = ""
    if timeline == "90일 이하 (비자 없이 탐색)":
        timeline_hint = "※ 90일 이하 단기 탐색 — 비자 체크리스트보다 무비자 체류 가능 국가와 첫 30일 루트 중심으로 안내하세요.\n\n"

    readiness_stage = user_profile.get("readiness_stage", "")
    readiness_hint = ""
    if readiness_stage == "막연하게 고민 중 (6개월+ 후 실행 예상)":
        readiness_hint = "※ 초기 탐색 단계. 비용·비자 개요 중심으로 추천. 세부 체크리스트보다 도시 비교에 집중.\n\n"
    elif readiness_stage == "이미 출국했거나 출국 임박":
        readiness_hint = "※ 출국 임박. first_steps에서 기한이 있는 항목(건보 임의계속가입 등)을 최우선으로 배치.\n\n"

    income_usd = user_profile.get("income_usd", 0)
    has_spouse_income = user_profile.get("has_spouse_income", "없음")
    spouse_income_krw_val = user_profile.get("spouse_income_krw", 0)
    spouse_hint = ""
    if has_spouse_income == "있음" and spouse_income_krw_val:
        try:
            import utils.currency
            rates = utils.currency.get_exchange_rates()
            usd_rate = rates.get("USD", 0.000714)
        except Exception:
            usd_rate = 0.000714
        spouse_usd = round(spouse_income_krw_val * 10000 * usd_rate)
        total_usd = income_usd + spouse_usd
        spouse_hint = (
            f"※ 가족 합산 소득 기준 적용. 주 신청인 ${income_usd:.0f} + 배우자 ${spouse_usd:.0f}, "
            f"합산 ${total_usd:.0f}/월. 스페인·그리스 등 합산 소득 인정 비자 우선 고려.\n\n"
        )

    if language == "English":
        user_message = (
            f"Nationality: {nationality} | Monthly income: ${income_usd:,.0f} USD | "
            f"Stay purpose: {purpose} | "
            f"Languages: {', '.join(languages) if languages else 'not specified'} | "
            f"Target stay duration: {timeline}\n"
            f"Lifestyle preferences: {', '.join(lifestyle) if lifestyle else 'no specific preference'}\n\n"
            f"{DATA_CONTEXT}\n\n"
            f"{persona_hint}"
            f"{income_type_hint}"
            f"{slowmad_hint_en}"
            f"{preferred_hint}"
            f"{dual_nat_hint}"
            f"{travel_hint}"
            f"{timeline_hint}"
            f"{readiness_hint}"
            f"{spouse_hint}"
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
            f"{DATA_CONTEXT}\n\n"
            f"{persona_hint}"
            f"{income_type_hint}"
            f"{slowmad_hint_kr}"
            f"{preferred_hint}"
            f"{dual_nat_hint}"
            f"{travel_hint}"
            f"{timeline_hint}"
            f"{readiness_hint}"
            f"{spouse_hint}"
            "위 프로필 기반으로 최적 거주 도시 TOP 3를 추천하세요. "
            "현실적 어려움과 위험 요소를 반드시 포함하세요. "
            "반드시 순수 JSON만 출력하세요."
        )
        system_prompt = SYSTEM_PROMPT

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(FEW_SHOT_EXAMPLES)
    messages.append({"role": "user", "content": user_message})
    return messages


def build_step1_user_message(user_profile: dict) -> str:
    """Step 1 사용자 메시지를 DATA_CONTEXT 없이 반환 — 캐시 모드 전용.

    Gemini 서버 캐시에 이미 포함된 내용:
      - SYSTEM_PROMPT (system_instruction)
      - DATA_CONTEXT  (system_instruction에 합산)
      - FEW_SHOT_EXAMPLES (cache contents)

    이 함수는 캐시에 없는 동적 부분(사용자 프로필 + 지시)만 반환.
    """
    language      = user_profile.get("language", "한국어")
    nationality   = user_profile.get("nationality", "Korean")
    income_usd    = user_profile.get("income_usd", 3000)
    income_krw    = user_profile.get("income_krw", 420)
    purpose       = user_profile.get("purpose", "디지털 노마드")
    lifestyle     = user_profile.get("lifestyle", [])
    languages     = user_profile.get("languages", [])
    timeline      = user_profile.get("timeline", "1년 단기 체험")
    stay_duration = user_profile.get("stay_duration", "")

    preferred_countries = user_profile.get("preferred_countries", [])

    _CONTINENT_TO_HINT = {
        "아시아": "동남아시아·동아시아 도시 (치앙마이, 발리, 쿠알라룸푸르, 다낭, 도쿄 등)",
        "유럽": "유럽 도시 (리스본, 바르셀로나, 탈린, 베를린, 아테네 등)",
        "중남미": "중남미 도시 (멕시코시티, 메데진, 부에노스아이레스 등)",
        "중동/아프리카": "중동·아프리카 도시 (두바이, 마라케시 등)",
        "북미": "북미 도시 (마이애미, 캐나다 등)",
    }

    preferred_hint = ""
    if preferred_countries:
        hints = [_CONTINENT_TO_HINT[c] for c in preferred_countries if c in _CONTINENT_TO_HINT]
        if hints:
            if language == "English":
                preferred_hint = (
                    f"※ Preferred continents: {', '.join(preferred_countries)}. "
                    f"Prioritize cities in these continents ({'; '.join(hints)}) in TOP 3.\n\n"
                )
            else:
                preferred_hint = (
                    f"※ 우선 고려 대륙: {', '.join(preferred_countries)}. "
                    f"해당 대륙 도시({'; '.join(hints)})를 TOP 3 추천에 우선 반영할 것.\n\n"
                )

    persona_type = user_profile.get("persona_type", "")
    persona_hint = ""
    if persona_type:
        from utils.persona import get_persona_hint
        hint = get_persona_hint(persona_type)
        if hint:
            persona_hint = hint + "\n\n"

    if stay_duration == "slowmad":
        slowmad_hint = (
            "※ User prefers slowmad style (3-6 months per city) — prioritize cities with mid-term rental options and flexible visa renewals.\n\n"
            if language == "English" else
            "※ 슬로마드 스타일 (도시당 3~6개월 체류) — 중기 임대 가능 도시 및 비자 갱신 유연성 우선 고려.\n\n"
        )
    elif stay_duration == "nomad":
        slowmad_hint = (
            "※ User prefers frequent moves (1-2 months per city) — prioritize cities with tourist visa or easy short-stay options.\n\n"
            if language == "English" else
            "※ 잦은 이동 선호 (도시당 1~2개월) — 관광 비자 또는 단기 체류가 용이한 도시 우선 고려.\n\n"
        )
    else:
        slowmad_hint = ""

    if language == "English":
        return (
            f"Nationality: {nationality} | Monthly income: ${income_usd:,.0f} USD | "
            f"Stay purpose: {purpose} | "
            f"Languages: {', '.join(languages) if languages else 'not specified'} | "
            f"Target stay duration: {timeline}\n"
            f"Lifestyle preferences: {', '.join(lifestyle) if lifestyle else 'no specific preference'}\n\n"
            f"{persona_hint}"
            f"{slowmad_hint}"
            f"{preferred_hint}"
            "Based on the above profile, recommend the top 3 best cities for long-term digital nomad living. "
            "Include realistic challenges and risks. "
            "Output pure JSON only."
        )
    else:
        return (
            f"국적: {nationality} | 월 수입: {income_krw * 100:,.0f}만원 "
            f"(약 ${income_usd:,.0f} USD) | "
            f"장기 체류 목적: {purpose} | "
            f"사용 가능 언어: {', '.join(languages) if languages else '미응답'} | "
            f"목표 체류 기간: {timeline}\n"
            f"라이프스타일 선호: {', '.join(lifestyle) if lifestyle else '특별한 선호 없음'}\n\n"
            f"{persona_hint}"
            f"{slowmad_hint}"
            f"{preferred_hint}"
            "위 프로필 기반으로 최적 거주 도시 TOP 3를 추천하세요. "
            "현실적 어려움과 위험 요소를 반드시 포함하세요. "
            "반드시 순수 JSON만 출력하세요."
        )


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
    "insurance": 60,
    "misc": 150
  },
  "budget_source": "https://www.numbeo.com/cost-of-living/in/Chiang-Mai",
  "first_steps": ["비자 신청 서류 준비 시작", "Wise 또는 Revolut 국제 계좌 개설 (환전 수수료 절감)", "항공권 및 숙소 예약", "현지 한인 커뮤니티 채널 가입"]
}

[budget_breakdown 작성 지침]
budget_breakdown의 각 항목은 Numbeo(https://www.numbeo.com/cost-of-living/)의
해당 도시 생활비 데이터를 기준으로 작성하라.
insurance 항목은 SafetyWing Nomad Insurance 기준 월 $45~80 범위로 추정하라.
budget_source 필드에 해당 도시의 Numbeo URL을 포함하라.
예: "budget_source": "https://www.numbeo.com/cost-of-living/in/Chiang-Mai"
(도시명은 영문 하이픈 형식으로 변환, 예: "Kuala Lumpur" → "Kuala-Lumpur")

[중요] visa_checklist 예시 (올바른 형식):
["여권 사본", "소득 증빙 서류", "거주지 증명서", "건강보험 가입 증명서 (SafetyWing 또는 Cigna Global 권장)"]

[중요] first_steps 예시 (올바른 형식):
["비자 신청서 작성 및 제출", "Wise 또는 Revolut 국제 계좌 개설 (환전 수수료 최소화)", "현지 은행 계좌 개설 예약", "코워킹 스페이스 단기 멤버십 신청"]"""


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
  "visa_checklist": ["Passport copy (valid 6+ months)", "Proof of income (last 3 months bank statements)", "Passport photos x2", "Health insurance certificate (SafetyWing or Cigna Global recommended)"],
  "budget_breakdown": {"rent": 600, "food": 300, "cowork": 100, "insurance": 60, "misc": 150},
  "budget_source": "https://www.numbeo.com/cost-of-living/in/Chiang-Mai",
  "first_steps": ["Start gathering visa application documents", "Open a Wise or Revolut account for low-fee international transfers", "Book flights and accommodation", "Join local expat/nomad community groups"]
}

[budget_breakdown guidelines]
Base each item on Numbeo (https://www.numbeo.com/cost-of-living/) data for the city.
The insurance item should estimate $45-80/month based on SafetyWing Nomad Insurance pricing.
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
