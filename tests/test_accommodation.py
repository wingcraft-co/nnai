"""tests/test_accommodation.py — 숙소 딥링크 조회 테스트"""
from utils.accommodation import get_accommodation_links


def test_known_city_returns_flatio_url():
    result = get_accommodation_links("Chiang Mai")
    assert result["flatio_url"].startswith("https://www.flatio.com/")


def test_known_city_returns_anyplace_url():
    result = get_accommodation_links("Chiang Mai")
    assert result["anyplace_url"].startswith("https://anyplace.com/")


def test_case_insensitive_lookup():
    result1 = get_accommodation_links("Bangkok")
    result2 = get_accommodation_links("bangkok")
    assert result1["flatio_url"] == result2["flatio_url"]


def test_unknown_city_returns_empty_strings():
    result = get_accommodation_links("Nonexistent City XYZ")
    assert result["flatio_url"] == ""
    assert result["anyplace_url"] == ""
    assert result["nomad_meetup_url"] == ""
    assert result["mid_term_rent_usd"] == 0


def test_mid_term_rent_is_positive_for_known_city():
    result = get_accommodation_links("Lisbon")
    assert result["mid_term_rent_usd"] > 0


def test_format_step2_includes_accommodation_section():
    """format_step2_markdown에 숙소 섹션이 포함됨."""
    from api.parser import format_step2_markdown
    parsed = {
        "city": "Chiang Mai",
        "country_id": "TH",
        "immigration_guide": {
            "title": "Test Guide",
            "sections": [{"step": 1, "title": "준비", "items": ["서류 준비"]}]
        },
        "visa_checklist": ["여권"],
        "budget_breakdown": {"rent": 400, "food": 200, "cowork": 80, "misc": 100},
        "first_steps": ["비자 신청"],
    }
    result = format_step2_markdown(parsed)
    assert "Flatio" in result or "flatio" in result.lower()
