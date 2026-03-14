"""tests/test_planb.py — 플랜B 비쉥겐 버퍼 추천 테스트"""
from utils.planb import get_planb_suggestions


def test_returns_non_schengen_suggestions():
    """쉥겐 국가 입력 시 비쉥겐 버퍼 목록 반환."""
    result = get_planb_suggestions("ES")  # Spain is Schengen
    assert len(result) > 0
    assert len(result) <= 3


def test_excludes_current_country():
    """현재 체류 국가는 추천 목록에서 제외."""
    result = get_planb_suggestions("GE")  # Georgia is a buffer country
    ids = [r["id"] for r in result]
    assert "GE" not in ids


def test_georgia_is_top_priority():
    """조지아가 최우선 추천 (스페인 선택 시)."""
    result = get_planb_suggestions("ES")
    if result:
        assert result[0]["id"] == "GE"


def test_english_language_returns_english_reason():
    result = get_planb_suggestions("ES", language="English")
    if result:
        # Reasons should be in English (contain English words)
        assert any(c.isascii() for c in result[0]["reason"])


def test_max_suggestions_respected():
    result = get_planb_suggestions("PT", max_suggestions=2)
    assert len(result) <= 2


def test_all_suggestions_have_required_fields():
    result = get_planb_suggestions("DE")
    for s in result:
        assert "id" in s
        assert "name" in s
        assert "reason" in s
        assert "visa_type" in s


def test_format_step2_includes_planb_for_schengen_city():
    """쉥겐 도시 Step 2 결과에 플랜B 섹션 포함."""
    from api.parser import format_step2_markdown
    parsed = {
        "city": "Barcelona",
        "country_id": "ES",  # Schengen
        "immigration_guide": {
            "title": "Test",
            "sections": [{"step": 1, "title": "준비", "items": ["서류 준비"]}]
        },
        "visa_checklist": ["여권"],
        "budget_breakdown": {"rent": 1600, "food": 400, "cowork": 200, "misc": 200},
        "first_steps": ["비자 신청"],
    }
    result = format_step2_markdown(parsed)
    assert "플랜B" in result or "Plan B" in result


def test_format_step2_no_planb_for_non_schengen_city():
    """비쉥겐 도시 Step 2 결과에 플랜B 섹션 없음."""
    from api.parser import format_step2_markdown
    parsed = {
        "city": "Chiang Mai",
        "country_id": "TH",  # Non-Schengen
        "immigration_guide": {
            "title": "Test",
            "sections": [{"step": 1, "title": "준비", "items": ["서류 준비"]}]
        },
        "visa_checklist": ["여권"],
        "budget_breakdown": {"rent": 400, "food": 200, "cowork": 80, "misc": 100},
        "first_steps": ["비자 신청"],
    }
    result = format_step2_markdown(parsed)
    assert "플랜B" not in result and "Plan B" not in result
