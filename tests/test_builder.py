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
    """preferred_countries가 있으면 프롬프트에 우선 고려 국가 힌트가 포함되어야 함"""
    profile = {
        **SAMPLE_PROFILE,
        "preferred_countries": ["🇲🇾 말레이시아", "🇹🇭 태국"],
    }
    result = build_prompt(profile)
    last_user = result[-1]["content"]
    assert "말레이시아" in last_user
    assert "태국" in last_user
    assert "우선 고려" in last_user


def test_build_prompt_no_hint_when_empty_preferred_countries():
    """preferred_countries가 빈 리스트이면 프롬프트에 힌트 줄이 없어야 함"""
    profile = {
        **SAMPLE_PROFILE,
        "preferred_countries": [],
    }
    result = build_prompt(profile)
    last_user = result[-1]["content"]
    assert "우선 고려 국가" not in last_user


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
