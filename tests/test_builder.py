from prompts.builder import build_prompt, build_detail_prompt

SAMPLE_PROFILE = {
    "nationality": "Korean",
    "income": 3000,
    "lifestyle": ["해변", "저물가"],
    "timeline": "1년 단기 체험",
}


def test_build_prompt_returns_list():
    result = build_prompt(SAMPLE_PROFILE)
    assert isinstance(result, list)


def test_build_prompt_starts_with_system():
    result = build_prompt(SAMPLE_PROFILE)
    assert result[0]["role"] == "system"


def test_build_prompt_ends_with_user():
    result = build_prompt(SAMPLE_PROFILE)
    assert result[-1]["role"] == "user"


def test_build_prompt_includes_data_context():
    result = build_prompt(SAMPLE_PROFILE)
    last_user = result[-1]["content"]
    assert "비자·도시 데이터베이스" in last_user


def test_build_prompt_includes_user_profile():
    result = build_prompt(SAMPLE_PROFILE)
    last_user = result[-1]["content"]
    assert "Korean" in last_user
    assert "해변" in last_user


def test_build_detail_prompt_returns_list():
    """build_detail_prompt() 는 메시지 리스트를 반환해야 함"""
    selected_city = {
        "city": "Kuala Lumpur",
        "country_id": "MY",
        "visa_type": "DE Nomad Visa",
        "monthly_cost_usd": 1500,
    }
    user_profile = {
        "nationality": "Korean",
        "income_usd": 3570,
        "purpose": "디지털 노마드",
        "languages": ["한국어"],
        "timeline": "1년 단기 체험",
    }
    result = build_detail_prompt(selected_city, user_profile)

    assert isinstance(result, list)
    assert len(result) >= 2
    assert result[0]["role"] == "system"
    assert result[-1]["role"] == "user"


def test_build_detail_prompt_includes_city_info():
    """build_detail_prompt() 의 user 메시지에 도시 정보가 포함되어야 함"""
    selected_city = {
        "city": "Lisbon",
        "country_id": "PT",
        "visa_type": "D8 Digital Nomad Visa",
        "monthly_cost_usd": 2600,
    }
    user_profile = {
        "nationality": "Korean",
        "income_usd": 6000,
        "purpose": "자녀 교육 동반 장기 체류",
        "languages": ["영어"],
        "timeline": "5년 이상 초장기 체류",
    }
    result = build_detail_prompt(selected_city, user_profile)

    last_user = result[-1]["content"]
    assert "Lisbon" in last_user or "PT" in last_user
    assert "자녀 교육 동반 장기 체류" in last_user


def test_build_prompt_includes_preferred_countries_hint():
    """preferred_countries에 대륙명이 있으면 프롬프트에 우선 고려 대륙 힌트가 포함되어야 함"""
    profile = {
        **SAMPLE_PROFILE,
        "preferred_countries": ["아시아", "유럽"],
    }
    result = build_prompt(profile)
    last_user = result[-1]["content"]
    assert "아시아" in last_user
    assert "유럽" in last_user
    assert "우선 고려 대륙" in last_user


def test_build_prompt_no_hint_when_empty_preferred_countries():
    """preferred_countries가 빈 리스트이면 프롬프트에 힌트 줄이 없어야 함"""
    profile = {
        **SAMPLE_PROFILE,
        "preferred_countries": [],
    }
    result = build_prompt(profile)
    last_user = result[-1]["content"]
    assert "우선 고려 대륙" not in last_user


def test_build_prompt_english_uses_english_system_prompt():
    """language='English' 프로필이면 messages[0]['content']가 SYSTEM_PROMPT_EN과 일치해야 함"""
    profile = {
        **SAMPLE_PROFILE,
        "language": "English",
    }
    from prompts.system_en import SYSTEM_PROMPT_EN
    result = build_prompt(profile)
    assert result[0]["content"] == SYSTEM_PROMPT_EN


def test_build_prompt_korean_uses_korean_system_prompt():
    """language 미지정(기본값 한국어)이면 messages[0]['content']가 SYSTEM_PROMPT와 일치해야 함"""
    from prompts.system import SYSTEM_PROMPT
    result = build_prompt(SAMPLE_PROFILE)
    assert result[0]["content"] == SYSTEM_PROMPT


def test_build_detail_prompt_english_returns_english_user_message():
    """language='English' 프로필이면 user 메시지에 'Selected city:'가 포함되고 '선택 도시:'는 없어야 함"""
    selected_city = {
        "city": "Chiang Mai",
        "country_id": "TH",
        "visa_type": "Thailand LTR Visa",
        "monthly_cost_usd": 1200,
    }
    user_profile = {
        "nationality": "Korean",
        "income_usd": 3000,
        "purpose": "Digital Nomad",
        "languages": ["English"],
        "timeline": "1 year",
        "language": "English",
    }
    result = build_detail_prompt(selected_city, user_profile)
    last_user = result[-1]["content"]
    assert "Selected city:" in last_user
    assert "선택 도시:" not in last_user


# ── VISA_CHECKLIST_INSTRUCTION 반영 테스트 ──────────────────────────────────

def _get_step2_system_prompt(language: str = "한국어") -> str:
    """build_detail_prompt()의 system 메시지 내용을 반환."""
    selected_city = {"city": "Kuala Lumpur", "country_id": "MY",
                     "visa_type": "무비자", "monthly_cost_usd": 1500}
    user_profile = {"nationality": "Korean", "income_usd": 3000,
                    "purpose": "디지털 노마드", "languages": ["한국어"],
                    "timeline": "1년 단기 체험", "language": language}
    msgs = build_detail_prompt(selected_city, user_profile)
    return msgs[0]["content"]


def test_step2_system_prompt_excludes_bank_balance_for_visa_free_countries():
    """무비자 입국 국가(MY, TH, ID, VN, PH)에서 은행 잔고 증명 제외 지시가 있어야 함."""
    prompt = _get_step2_system_prompt()
    assert "MY" in prompt or "무비자" in prompt
    assert "은행 잔고 증명" in prompt


def test_step2_system_prompt_requires_round_trip_ticket_warning():
    """왕복 항공권 소지 여부 지시가 system 프롬프트에 있어야 함."""
    prompt = _get_step2_system_prompt()
    assert "왕복 항공권" in prompt


def test_step2_system_prompt_requires_visa_run_option():
    """비자런 옵션 포함 지시가 system 프롬프트에 있어야 함."""
    prompt = _get_step2_system_prompt()
    assert "비자런" in prompt


def test_step2_system_prompt_requires_work_disclosure_warning():
    """원격근무 발설 주의 지시가 system 프롬프트에 있어야 함."""
    prompt = _get_step2_system_prompt()
    assert "원격근무" in prompt


# ── 상세가이드 개인화 테스트 ──────────────────────────────────────────────────

def _detail_user_msg(**overrides) -> str:
    """build_detail_prompt()의 user 메시지 반환 헬퍼."""
    selected_city = {"city": "Chiang Mai", "country_id": "TH",
                     "visa_type": "무비자", "monthly_cost_usd": 1100}
    profile = {"nationality": "Korean", "income_usd": 3000,
               "purpose": "디지털 노마드", "languages": ["한국어"],
               "timeline": "1년 단기 체험", "language": "한국어", **overrides}
    msgs = build_detail_prompt(selected_city, profile)
    return msgs[-1]["content"]


def test_detail_prompt_includes_income_type_hint_freelancer():
    """income_type=프리랜서이면 user 메시지에 해외 송금 내역 안내가 포함되어야 함."""
    msg = _detail_user_msg(income_type="프리랜서 (계약서·해외 송금 내역)")
    assert "해외 송금 내역" in msg


def test_detail_prompt_includes_income_type_hint_employee():
    """income_type=한국 법인 재직이면 재직증명서 안내가 포함되어야 함."""
    msg = _detail_user_msg(income_type="한국 법인 재직 (재직증명서 + 급여명세서)")
    assert "재직증명서" in msg


def test_detail_prompt_includes_stay_duration_hint_short():
    """timeline=90일 이하이면 왕복 항공권 필수 소지 안내가 포함되어야 함."""
    msg = _detail_user_msg(timeline="90일 이하 (비자 없이 탐색)")
    assert "왕복 항공권" in msg


def test_detail_prompt_includes_stay_duration_hint_long():
    """timeline=5년 이상이면 영주권 경로 안내가 포함되어야 함."""
    msg = _detail_user_msg(timeline="5년 이상 초장기 체류")
    assert "영주권" in msg


def test_detail_prompt_includes_travel_type_hint_solo():
    """travel_type=솔로이면 코워킹 스페이스 언급이 포함되어야 함."""
    msg = _detail_user_msg(travel_type="혼자 (솔로)")
    assert "코워킹" in msg


def test_detail_prompt_includes_travel_type_hint_family():
    """travel_type=가족 전체 동반이면 국제학교 언급이 포함되어야 함."""
    msg = _detail_user_msg(travel_type="가족 전체 동반 (배우자 + 자녀)")
    assert "국제학교" in msg


def test_detail_prompt_no_hint_when_income_type_missing():
    """income_type 미입력 시 소득 증빙 힌트 블록이 없어야 함."""
    msg = _detail_user_msg()
    assert "[소득 증빙 형태:" not in msg


def test_detail_prompt_english_income_type_hint():
    """language=English + income_type=프리랜서이면 영문 송금 내역 힌트가 포함되어야 함."""
    selected_city = {"city": "Chiang Mai", "country_id": "TH",
                     "visa_type": "Tourist Visa", "monthly_cost_usd": 1100}
    profile = {"nationality": "Korean", "income_usd": 3000,
               "purpose": "Digital Nomad", "languages": ["English"],
               "timeline": "1 year short-term", "language": "English",
               "income_type": "프리랜서 (계약서·해외 송금 내역)"}
    msgs = build_detail_prompt(selected_city, profile)
    msg = msgs[-1]["content"]
    assert "remittance" in msg.lower() or "transfer" in msg.lower() or "송금" in msg


# ── 수정 2: 건강보험 임의계속가입 — 출국 임박 단계 ────────────────────────────────

def test_build_detail_prompt_imminent_departure_includes_health_insurance():
    """readiness_stage=이미 출국했거나 출국 임박 → user_message에 건강보험 경고 포함."""
    selected_city = {"city": "Lisbon", "country_id": "PT", "visa_type": "D8", "monthly_cost_usd": 2600}
    profile = {
        "nationality": "한국", "income_usd": 3360, "income_krw": 500,
        "purpose": "원격 근무", "languages": ["한국어"], "timeline": "1년 단기 체험",
        "language": "한국어", "income_type": "", "travel_type": "혼자 (솔로)",
        "readiness_stage": "이미 출국했거나 출국 임박",
    }
    msgs = build_detail_prompt(selected_city, profile)
    user_msg = msgs[-1]["content"]
    assert "건강보험" in user_msg or "임의계속가입" in user_msg
