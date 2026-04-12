# prompts/builder.py
from prompts.system       import SYSTEM_PROMPT
from prompts.system_en    import SYSTEM_PROMPT_EN
from prompts.few_shots    import FEW_SHOT_EXAMPLES
from prompts.data_context import DATA_CONTEXT


def build_prompt(user_profile: dict) -> list[dict]:
    """Step 1 프롬프트 생성: 사용자 프로필 + 데이터 컨텍스트 → messages list"""
    # 사전 검증 — hard_block 시 ValueError 발생, LLM 호출 차단
    validation = validate_user_profile(user_profile)
    if validation["hard_block"]:
        raise ValueError(f"입력 조건 불충족: {'; '.join(validation['warnings'])}")

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


_INCOME_TYPE_GUIDE_HINTS = {
    "한국 법인 재직 (재직증명서 + 급여명세서)": (
        "비자 서류 준비: 재직증명서 영문 발급 + 최근 3개월 급여명세서 영문 발급. "
        "DE Rantau(말레이시아) 신청 시 고용주 해외 법인 여부 확인 필요. "
        "회사 원격근무 허가서(HR 공문) 추가 제출 요구 사례 있음."
    ),
    "해외 법인 재직": (
        "비자 서류 준비: 고용계약서 영문 + 최근 3개월 급여명세서. "
        "고용주 해외 법인 등록증 사본 요구 가능. "
        "원천징수 방식에 따라 한국 세금 신고 의무 별도 확인 필요."
    ),
    "프리랜서 (계약서·해외 송금 내역)": (
        "비자 서류 준비: 해외 송금 내역 6개월치. "
        "단일 클라이언트 의존 시 포르투갈 D8 거절 사례 있음 — 계약서 다양화 권장. "
        "Wise/Revolut 등 핀테크 송금 내역도 인정되는 국가 대부분."
    ),
    "1인 사업자 (종합소득세 신고 기반)": (
        "비자 서류 준비: 종합소득세 신고서 영문 번역 공증 + 사업자등록증 영문 번역. "
        "매출 불규칙 시 평균 산정 방식 사전 확인. "
        "부가가치세 신고서 추가 요구 국가 있음."
    ),
    "무소득 / 은퇴": (
        "소득 기준 비자 대신 자산 증명 방식으로 전환. "
        "말레이시아 MM2H(예치금 기반) 또는 태국 LTR Wealthy Pensioner 카테고리 우선 검토. "
        "배우자 소득 합산 인정 여부 사전 확인."
    ),
}

_INCOME_TYPE_GUIDE_HINTS_EN = {
    "한국 법인 재직 (재직증명서 + 급여명세서)": (
        "Visa documents: Employment certificate (English) + last 3 months payslips (English). "
        "For DE Rantau (Malaysia): confirm employer is a foreign-registered entity. "
        "Some cases require employer remote-work authorization letter (HR memo)."
    ),
    "해외 법인 재직": (
        "Visa documents: Employment contract (English) + last 3 months payslips. "
        "Employer's foreign business registration copy may be required. "
        "Confirm Korean tax filing obligations depending on withholding method."
    ),
    "프리랜서 (계약서·해외 송금 내역)": (
        "Visa documents: 6 months of overseas remittance/transfer records. "
        "Single-client dependency may cause Portugal D8 rejection — diversify contracts. "
        "Fintech transfer history (Wise/Revolut) accepted in most countries."
    ),
    "1인 사업자 (종합소득세 신고 기반)": (
        "Visa documents: Notarized English translation of income tax return + business registration. "
        "Pre-confirm income averaging method if revenue is irregular. "
        "Some countries require VAT filing records as well."
    ),
    "무소득 / 은퇴": (
        "Switch from income-based to asset-based visa route. "
        "Consider Malaysia MM2H (deposit-based) or Thailand LTR Wealthy Pensioner category. "
        "Confirm whether spouse income can be combined for threshold."
    ),
}

_STAY_DURATION_GUIDE_HINTS = {
    "90일 이하 (비자 없이 탐색)": (
        "무비자 체류 최적화: 입국 시 왕복 항공권 필수 소지. "
        "온라인 근무 사실을 입국심사관에게 발설 금지 (취업 비자 필요로 오해 리스크). "
        "장기 비자 체크리스트 생략, 첫 30일 루트 중심으로 안내."
    ),
    "1년 단기 체험": (
        "장기 비자 신청 시기 역산: 최소 6~8주 전 신청 시작. "
        "비자 승인 후 현지 기관 방문 스티커 발급 절차 별도 안내. "
        "세금 거주자 전환 시점(183일) 전 전략 수립 권장."
    ),
    "3년 장기 체류": (
        "장기거주 전환 루트 검토: PR 또는 영주권 경로 존재 여부 명시. "
        "세금 거주자 전환 시점(183일) 반드시 안내 + 한국 비거주자 처리 의무. "
        "현지 은행 계좌 개설 조건 상세 안내. "
        "장기 임대 계약 협상 팁 포함. "
        "first_steps 순서 규칙: ① 건강보험 임의계속가입(기한 엄수) ② 국민연금 납부예외 "
        "③ 한국 비거주자 전환 신고 계획 수립 (183일 전 세무사 상담 권장) — 반드시 3번 이내에 배치."
    ),
    "5년 이상 초장기 체류": (
        "영주권 또는 시민권 취득 경로 명시. "
        "한국 국적 유지 조건 확인. "
        "이중과세 방지 조약 상세 활용 방법 포함."
    ),
}

_STAY_DURATION_GUIDE_HINTS_EN = {
    "90일 이하 (비자 없이 탐색)": (
        "Visa-free optimization: bring round-trip ticket at entry. "
        "Do not disclose remote work to immigration officers (risk of being turned away). "
        "Skip long-term visa checklist — focus on first 30-day route."
    ),
    "1년 단기 체험": (
        "Count back visa application timeline: start at least 6–8 weeks before intended entry. "
        "After approval, note in-country sticker issuance steps at local immigration office. "
        "Plan tax residency strategy before hitting 183 days."
    ),
    "3년 장기 체류": (
        "Explore long-term residency routes: check if PR or permanent residency path exists. "
        "Tax residency trigger (183 days) must be addressed + Korean non-resident filing obligations. "
        "Detail local bank account opening requirements. "
        "Include long-term lease negotiation tips."
    ),
    "5년 이상 초장기 체류": (
        "Specify permanent residency or citizenship acquisition path. "
        "Confirm conditions for retaining Korean nationality. "
        "Include detailed double-taxation treaty utilization strategies."
    ),
}

_TRAVEL_TYPE_GUIDE_HINTS = {
    "혼자 (솔로)": (
        "코워킹 스페이스 월 멤버십 기준 비용 포함. "
        "노마드 커뮤니티 밋업 정보 포함. "
        "1인 생활비 기준으로 예산 브레이크다운."
    ),
    "배우자·파트너 동반": (
        "배우자 동반 비자 가능 여부 명시. "
        "배우자 취업 가능 여부 경고 (불가한 경우 별도 취업 비자 필요). "
        "합산 소득 기준 비자 통과 여부 계산 결과 포함. "
        "예산 브레이크다운에 2인 기준 적용."
    ),
    "자녀 동반 (배우자 없이)": (
        "국제학교 평균 연학비 범위 ($5,000~$30,000/년) 명시. "
        "학기 시작 기준 입학 신청 시기 안내. "
        "의료 인프라 접근성 상세 안내. "
        "거주지 권장 지역 (학교·병원 접근성 기준)."
    ),
    "가족 전체 동반 (배우자 + 자녀)": (
        "국제학교 평균 연학비 범위 ($5,000~$30,000/년) 명시. "
        "주거 면적 권장 기준 (가족 구성원 수 기반). "
        "가족 생활비 = 1인 기준 × 1.6~2.0 배수로 계산. "
        "배우자 취업 가능 여부 + 자녀 교육 환경 종합 판단."
    ),
}

_TRAVEL_TYPE_GUIDE_HINTS_EN = {
    "혼자 (솔로)": (
        "Include coworking space monthly membership cost. "
        "Include nomad community meetup information. "
        "Budget breakdown based on single-person living costs."
    ),
    "배우자·파트너 동반": (
        "Specify whether spouse/partner dependent visa is available. "
        "Warn if spouse cannot work (separate work visa required). "
        "Include combined income visa eligibility calculation. "
        "Apply 2-person budget breakdown."
    ),
    "자녀 동반 (배우자 없이)": (
        "Specify international school annual tuition range ($5,000–$30,000/year). "
        "Guide on enrollment application timing relative to semester start. "
        "Detailed medical infrastructure accessibility. "
        "Recommended residential areas (school/hospital proximity)."
    ),
    "가족 전체 동반 (배우자 + 자녀)": (
        "Specify international school annual tuition range ($5,000–$30,000/year). "
        "Recommended housing size (based on family size). "
        "Family cost = single-person baseline × 1.6–2.0 multiplier. "
        "Combined assessment: spouse employment + children's education environment."
    ),
}


def validate_user_profile(user_profile: dict) -> dict:
    """
    LLM 호출 전 입력값 조합 유효성 검사. 규칙 기반, LLM 호출 없음.

    Args:
        user_profile: nomad_advisor()가 구성한 사용자 프로필 dict.

    Returns:
        {"valid": bool, "warnings": list[str], "hard_block": bool}
    """
    income_usd          = user_profile.get("effective_income_usd", user_profile.get("income_usd", 0))
    preferred_countries = user_profile.get("preferred_countries", []) or []
    travel_type         = user_profile.get("travel_type", "")
    timeline_raw        = user_profile.get("timeline", "")
    language            = user_profile.get("language", "한국어")
    timeline_aliases = {
        "3년 이상 장기 이민": "3년 장기 체류",
        "5년 이상 장기 이민": "5년 이상 초장기 체류",
    }
    timeline = timeline_aliases.get(timeline_raw, timeline_raw)

    warnings: list[str] = []
    hard_block = False

    # 유럽 극단 조합 — hard block (제출 차단)
    if (
        "유럽" in preferred_countries
        and income_usd < 1000
        and timeline in ["3년 장기 체류", "5년 이상 초장기 체류"]
    ):
        hard_block = True
        if language == "English":
            warnings.append(
                "Your income is significantly below common Europe long-stay visa thresholds "
                "($2,849+/month). No eligible city can be recommended."
            )
        else:
            warnings.append(
                "유럽 장기 비자 소득 기준($2,849~/월) 대비 현재 소득이 현저히 부족합니다. "
                "추천 가능한 도시가 없습니다."
            )

    # 가족 동반 소득 경고 (soft — hard_block 아님)
    if "가족 전체 동반" in travel_type and income_usd < 1500:
        warnings.append(
            "Family-visa income thresholds may not be met — recommendations will be limited, mostly in Asia."
            if language == "English" else
            "가족 동반 비자 소득 기준 미달 가능성 — 아시아 중심으로 추천이 제한됩니다."
        )

    return {
        "valid":      not hard_block,
        "warnings":   warnings,
        "hard_block": hard_block,
    }


_STEP2_SYSTEM_PROMPT = """당신은 타로 리더이자 디지털 노마드 정착 가이드 전문가입니다.
유저가 선택한 도시 카드를 해석하듯, 따뜻하고 개인적인 톤으로 도시를 소개하세요.
intro 필드의 도입부 1~2문장은 "이 카드가 당신을 선택했다"는 느낌으로 시작하세요.
예: "{도시} 카드가 당신을 선택했네요. 이 도시는..."
이후 비자, 예산, 세금, 생활 팁은 실용적이되, 조언하는 선배의 톤을 유지하세요.

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

[비자 체크리스트 생성 규칙 — 반드시 준수]
1. 한국 여권 기준으로 실제 필요한 서류만 포함한다.
   - 무비자 입국 국가(MY, TH, ID, VN, PH, PT 등)에서 은행 잔고 증명·충분한 체류 경비 증명은 불필요 — 포함하지 않는다.
   - 소득 증명 서류(재직증명서, 급여명세서 등)는 비자 신청(D8, DNV, DE Rantau 등)에서만 포함한다.
   - 한국 국적자에게 면제되는 항목은 명시적으로 제외한다.

2. 다음 항목은 해당 국가·비자 유형에 맞게 반드시 포함한다.
   - 왕복 항공권 소지 여부 (탑승 거부 사례 빈발 국가: MY, TH, ID)
   - 90일 초과 체류 시 비자런 옵션 (비용·리스크·주의사항)
   - 쉥겐 국가(유럽) 포함 모든 국가: 입국심사 시 원격근무 사실 발설 금지
     (취업 비자 없이 원격근무 발각 시 추방·입국 금지 리스크 — 비자 신청 케이스도 동일 적용)

3. 기한이 있는 항목은 기한을 명시한다.
   - 건강보험 임의계속가입: 퇴직 후 2개월 이내 (기한 초과 시 영구 불가)
   - 국민연금 납부예외: 출국 전 신청
   - 비자 서류 제출: 출국 6~8주 전 (비자별 처리 기간 역산)

[중요] visa_checklist 예시 (올바른 형식):
["여권 사본", "소득 증빙 서류", "거주지 증명서", "건강보험 가입 증명서 (SafetyWing 또는 Cigna Global 권장)"]

[중요] first_steps 예시 (올바른 형식):
["비자 신청서 작성 및 제출", "Wise 또는 Revolut 국제 계좌 개설 (환전 수수료 최소화)", "현지 은행 계좌 개설 예약", "코워킹 스페이스 단기 멤버십 신청"]

[first_steps 순서 규칙 — 반드시 준수]
1. 기한이 있는 항목을 무조건 최우선 배치한다.
   - 건강보험 임의계속가입 신청: 퇴직/출국 전 2개월 이내 (기한 소멸 시 영구 불가)
   - 국민연금 납부예외 신청: 출국 전
   - 비자 서류 준비: 신청 마감 역산 기준
2. 기한 없는 항목은 기한 있는 항목 이후에 배치한다.
   - Wise/Revolut 계좌 개설 (2주 후 개설해도 무방)
   - 항공권·숙소 예약
   - 현지 SIM 카드 준비
기한 항목이 후순위로 밀리는 것은 사용자에게 실질적 피해를 줄 수 있다."""


_STEP2_SYSTEM_PROMPT_EN = """You are a tarot reader and expert long-term stay advisor for digital nomads.
Interpret the selected city card in a warm, personal tone.
Start the intro field with 1-2 sentences like "The {city} card has chosen you..."
Then provide practical visa, budget, tax, and lifestyle guidance in an advisory tone.

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
(Convert city name to hyphenated English format, e.g. "Kuala Lumpur" → "Kuala-Lumpur")

[first_steps ordering rules — strictly follow]
1. Deadline-sensitive items MUST come first:
   - Korean health insurance continuation (within 2 months of resignation — permanent forfeiture if missed)
   - National pension exemption application (before departure)
   - Visa document preparation (counted back from application deadline)
2. Non-deadline items come after:
   - Wise/Revolut account opening (can be done 2 weeks later)
   - Flight and accommodation booking
   - Local SIM card preparation
Placing deadline items after convenience items can cause real harm to users."""


def build_detail_prompt(selected_city: dict, user_profile: dict) -> list[dict]:
    """Step 2 프롬프트 생성: 선택된 도시 + 사용자 프로필 → 상세 가이드 messages list"""
    language    = user_profile.get("language", "한국어")
    city        = selected_city.get("city", "")
    country_id  = selected_city.get("country_id", "")
    visa_type   = selected_city.get("visa_type", "")
    cost        = selected_city.get("monthly_cost_usd", 0)

    nationality  = user_profile.get("nationality", "Korean")
    purpose      = user_profile.get("purpose", "디지털 노마드")
    languages    = user_profile.get("languages", [])
    timeline     = user_profile.get("timeline", "")
    income_usd   = user_profile.get("income_usd", 0)
    income_type    = user_profile.get("income_type", "")
    travel_type    = user_profile.get("travel_type", "")
    readiness_stage = user_profile.get("readiness_stage", "")

    # 개인화 힌트 블록 조립
    if language == "English":
        hint_map_income  = _INCOME_TYPE_GUIDE_HINTS_EN
        hint_map_stay    = _STAY_DURATION_GUIDE_HINTS_EN
        hint_map_travel  = _TRAVEL_TYPE_GUIDE_HINTS_EN
        hint_label = lambda label, val: f"[{label}: {val}]\n"
    else:
        hint_map_income  = _INCOME_TYPE_GUIDE_HINTS
        hint_map_stay    = _STAY_DURATION_GUIDE_HINTS
        hint_map_travel  = _TRAVEL_TYPE_GUIDE_HINTS
        hint_label = lambda label, val: f"[{label}: {val}]\n"

    personalization_parts: list[str] = []
    if income_type in hint_map_income:
        personalization_parts.append(
            hint_label("소득 증빙 형태", income_type) + hint_map_income[income_type]
        )
    if timeline in hint_map_stay:
        personalization_parts.append(
            hint_label("체류 기간", timeline) + hint_map_stay[timeline]
        )
    if travel_type in hint_map_travel:
        personalization_parts.append(
            hint_label("동반 구성", travel_type) + hint_map_travel[travel_type]
        )

    # 출국 임박 단계: 건강보험 임의계속가입 기한 경고 + 초보 정보 제외
    if readiness_stage == "이미 출국했거나 출국 임박":
        if language == "English":
            personalization_parts.append(
                "[Urgent: Deadline-sensitive items]\n"
                "Korean health insurance continuation (임의계속가입): must apply within 2 months of resignation/departure — permanently forfeited if deadline missed. "
                "Place this as the FIRST item in first_steps regardless of other considerations.\n"
                "[Advanced nomad — exclude basic travel info]\n"
                "Do NOT include in first_steps or immigration_guide: SIM card purchase, public transit card, airport-to-city transport, local app installation (Grab etc.). "
                "Focus instead on: visa application timeline, tax residency strategy, local bank account, long-term accommodation tips."
            )
        else:
            personalization_parts.append(
                "[긴급: 기한 소멸 위험 항목]\n"
                "건강보험 임의계속가입 신청: 퇴직/출국 후 2개월 이내 — 기한 초과 시 영구 불가. "
                "준비 단계가 '이미 출국했거나 출국 임박'이더라도 아직 기한이 남아 있을 수 있음. "
                "반드시 first_steps[0] 또는 first_steps[1]에 포함할 것.\n"
                "[숙련 노마드 — 초보 여행 정보 제외]\n"
                "first_steps 및 immigration_guide에 다음 항목을 포함하지 않는다: "
                "SIM 카드 구매 방법, 대중교통 카드 구매, 공항에서 시내 이동 방법, 현지 앱(Grab 등) 설치 안내. "
                "대신 다음에 집중한다: 비자 신청 타임라인 및 서류, 세금 거주지 전략, 현지 은행 계좌 개설, 장기 숙소 계약 팁."
            )

    personalization_block = ("\n\n" + "\n\n".join(personalization_parts)) if personalization_parts else ""

    if language == "English":
        user_message = (
            f"Selected city: {city} ({country_id}) | Visa type: {visa_type} | "
            f"Monthly cost estimate: ${cost:,}\n"
            f"User profile: nationality={nationality}, purpose={purpose}, "
            f"monthly income=${income_usd:,.0f}, "
            f"languages={', '.join(languages) if languages else 'not specified'}, "
            f"duration={timeline}"
            f"{personalization_block}\n\n"
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
            f"기간={timeline}"
            f"{personalization_block}\n\n"
            "위 정보를 바탕으로 장기 체류 준비 단계별 가이드를 반드시 순수 JSON으로 작성하세요."
        )
        step2_system = _STEP2_SYSTEM_PROMPT

    return [
        {"role": "system", "content": step2_system},
        {"role": "user", "content": user_message},
    ]
