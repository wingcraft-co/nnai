"""tests/test_persona.py — 페르소나 진단 로직 테스트"""
from utils.persona import diagnose_persona, get_persona_hint, PERSONA_LABELS


def test_europe_plan_triggers_schengen_loop():
    result = diagnose_persona("자유로운 삶 / 원격근무", "예 (유럽 루트 계획 있음)", "1~3개월", "프리랜서", "생활비 예산")
    assert result == "schengen_loop"


def test_burnout_motivation():
    result = diagnose_persona("번아웃 탈출 / 삶 리셋", "아니오", "1~3개월", "프리랜서", "외로움/커뮤니티")
    assert result == "burnout_escape"


def test_fire_motivation():
    result = diagnose_persona("비용 최적화 (FIRE / 저물가)", "아니오", "1~3개월", "프리랜서", "생활비 예산")
    assert result == "fire_optimizer"


def test_expat_freedom_motivation():
    result = diagnose_persona("사회 이탈 (탈조선)", "아니오", "6개월 이상", "직장인 (원격근무)", "세금/법적 문제")
    assert result == "expat_freedom"


def test_long_stay_duration_defaults_to_slow_nomad():
    result = diagnose_persona("자유로운 삶 / 원격근무", "아니오", "6개월 이상", "프리랜서", "숙소 구하기")
    assert result == "slow_nomad"


def test_all_persona_types_have_hints():
    for key in PERSONA_LABELS:
        hint = get_persona_hint(key)
        assert len(hint) > 0, f"{key} 힌트가 비어 있음"


def test_persona_hint_injected_in_build_prompt():
    """persona_type이 user_profile에 있으면 build_prompt 결과 user 메시지에 힌트 포함."""
    from prompts.builder import build_prompt

    profile = {
        "nationality": "Korean", "income_usd": 3000, "income_krw": 420,
        "purpose": "디지털 노마드", "lifestyle": [], "languages": [],
        "timeline": "1년 단기 체험", "persona_type": "fire_optimizer",
    }
    messages = build_prompt(profile)
    user_content = messages[-1]["content"]
    assert "FIRE" in user_content or "저물가" in user_content or "비용" in user_content


def test_unknown_persona_returns_empty_hint():
    hint = get_persona_hint("unknown_type")
    assert hint == ""
