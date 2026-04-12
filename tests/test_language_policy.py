from unittest.mock import patch

from prompts.builder import validate_user_profile
from recommender import recommend_from_db
from api.parser import format_step1_markdown, format_step2_markdown


def _profile(**kwargs):
    base = {
        "nationality": "한국",
        "income_usd": 3200,
        "income_krw": 450,
        "purpose": "디지털 노마드",
        "lifestyle": [],
        "languages": [],
        "timeline": "1년 단기 체험",
        "preferred_countries": [],
        "language": "한국어",
        "persona_type": "",
        "income_type": "",
        "travel_type": "혼자 (솔로)",
        "children_ages": [],
        "dual_nationality": False,
        "readiness_stage": "",
        "has_spouse_income": "없음",
        "spouse_income_krw": 0,
    }
    base.update(kwargs)
    return base


def test_timeline_alias_is_normalized_in_recommender():
    """구 타임라인 문자열도 신 문자열과 동일하게 동작해야 한다."""
    old_timeline = recommend_from_db(_profile(timeline="3년 이상 장기 이민", income_usd=5000), top_n=8)
    new_timeline = recommend_from_db(_profile(timeline="3년 장기 체류", income_usd=5000), top_n=8)
    assert [c["country_id"] for c in old_timeline["top_cities"]] == [
        c["country_id"] for c in new_timeline["top_cities"]
    ]


def test_validate_user_profile_hard_block_message_is_english_when_language_english():
    result = validate_user_profile({
        "income_usd": 900,
        "preferred_countries": ["유럽"],
        "travel_type": "혼자 (솔로)",
        "timeline": "3년 장기 체류",
        "language": "English",
    })
    assert result["hard_block"] is True
    assert any("No eligible city" in w for w in result["warnings"])


def test_step1_markdown_uses_english_labels_when_language_english():
    sample = {
        "top_cities": [{
            "city": "Chiang Mai",
            "city_kr": "치앙마이",
            "country": "Thailand",
            "country_id": "TH",
            "visa_type": "Tourist Visa",
            "visa_url": "https://example.com/visa",
            "monthly_cost_usd": 1100,
            "score": 9.1,
            "reasons": [],
            "realistic_warnings": [],
            "references": [],
        }],
        "_user_profile": {"language": "English", "timeline": "1년 단기 체험"},
    }
    md = format_step1_markdown(sample)
    assert "Visa Type" in md
    assert "비자 유형" not in md
    assert "#1. Chiang Mai, Thailand" in md
    assert "치앙마이 (" not in md


def test_step2_markdown_uses_english_labels_when_language_english():
    sample = {
        "city": "Chiang Mai",
        "country_id": "TH",
        "_user_profile": {"language": "English"},
        "immigration_guide": {
            "title": "Chiang Mai relocation guide",
            "sections": [{"step": 1, "title": "Before departure", "items": ["Prepare documents"]}],
        },
        "visa_checklist": ["Passport copy", "Income proof", "Insurance"],
        "budget_breakdown": {"rent": 500, "food": 300, "cowork": 100, "insurance": 60, "misc": 140},
        "first_steps": ["Submit visa docs", "Book housing", "Open account"],
    }
    md = format_step2_markdown(sample)
    assert "Visa Checklist" in md
    assert "Estimated Monthly Budget" in md
    assert "비자 준비 체크리스트" not in md


def test_step2_uses_selected_ui_language_not_nationality_fallback():
    parsed_data = {
        "top_cities": [{
            "city": "Chiang Mai",
            "country_id": "TH",
            "visa_type": "Tourist Visa",
            "monthly_cost_usd": 1100,
        }],
        "_user_profile": {
            "nationality": "Korean",
            "language": "English",
            "purpose": "Digital Nomad",
        },
    }

    with patch("app.build_detail_prompt", return_value=[{"role": "user", "content": "x"}]) as mock_build, \
         patch("app.query_model", return_value="{}"), \
         patch("app.parse_response", return_value={"city": "Chiang Mai"}), \
         patch("app.format_step2_markdown", return_value="ok"):
        from app import show_city_detail_with_nationality
        show_city_detail_with_nationality(parsed_data, city_index=0)

    args, _ = mock_build.call_args
    user_profile_arg = args[1]
    assert user_profile_arg["language"] == "English"


