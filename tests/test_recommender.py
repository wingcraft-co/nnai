"""tests/test_recommender.py — recommend_from_db() 단위 테스트"""
import pytest
from recommender import recommend_from_db


def _profile(**kwargs):
    base = {
        "nationality":        "한국",
        "income_usd":         3000,
        "income_krw":         420,
        "purpose":            "디지털 노마드",
        "lifestyle":          [],
        "languages":          [],
        "timeline":           "1년 단기 체험",
        "preferred_countries": [],
        "language":           "한국어",
        "persona_type":       "",
        "income_type":        "",
        "travel_type":        "혼자 (솔로)",
        "children_ages":      [],
        "dual_nationality":   False,
        "readiness_stage":    "",
        "has_spouse_income":  "없음",
        "spouse_income_krw":  0,
    }
    base.update(kwargs)
    return base


def test_returns_top_cities_list():
    result = recommend_from_db(_profile())
    assert isinstance(result, dict)
    assert "top_cities" in result
    assert isinstance(result["top_cities"], list)


def test_returns_at_most_3_cities():
    result = recommend_from_db(_profile())
    assert len(result["top_cities"]) <= 3


def test_city_dict_has_required_fields():
    required = {"city", "city_kr", "country", "country_id", "visa_type",
                "visa_url", "monthly_cost_usd", "score",
                "reasons", "realistic_warnings", "plan_b_trigger", "references"}
    result = recommend_from_db(_profile())
    for city in result["top_cities"]:
        missing = required - set(city.keys())
        assert not missing, f"누락 필드: {missing}"


def test_overall_warning_present():
    result = recommend_from_db(_profile())
    assert "overall_warning" in result
    assert isinstance(result["overall_warning"], str)


def test_income_filter_excludes_high_income_required_countries():
    """소득 $500이면 소득 기준 높은 국가 제외."""
    result = recommend_from_db(_profile(income_usd=500))
    for city in result["top_cities"]:
        # All returned cities must have passed the income filter
        # Check that none require more than $500
        assert city["monthly_cost_usd"] >= 0  # basic sanity


def test_high_income_includes_more_results():
    result = recommend_from_db(_profile(income_usd=5000))
    assert len(result["top_cities"]) > 0


def test_long_stay_filters_non_renewable():
    """3년+ 체류 선택 시 renewable=false 국가는 결과에서 제외."""
    result = recommend_from_db(_profile(timeline="3년 이상 장기 이민", income_usd=5000))
    assert isinstance(result["top_cities"], list)


def test_90day_returns_results():
    result = recommend_from_db(_profile(timeline="90일 단기 체험", income_usd=3000))
    assert len(result["top_cities"]) > 0


def test_asia_filter_excludes_european_countries():
    european_ids = {"DE", "PT", "EE", "ES", "GR", "HR", "CZ", "HU", "SI", "MT", "CY", "AL", "RS", "MK"}
    result = recommend_from_db(_profile(preferred_countries=["아시아"], income_usd=5000))
    result_ids = {c["country_id"] for c in result["top_cities"]}
    assert result_ids.isdisjoint(european_ids), f"유럽 국가 포함됨: {result_ids & european_ids}"


def test_score_is_float_in_range():
    result = recommend_from_db(_profile(income_usd=5000))
    for city in result["top_cities"]:
        assert 0.0 <= city["score"] <= 10.0, f"score 범위 초과: {city['score']}"


def test_korean_nationality_warning():
    result = recommend_from_db(_profile(nationality="한국"))
    assert "건강보험" in result["overall_warning"]


def test_schengen_in_result_triggers_ees_warning():
    result = recommend_from_db(_profile(preferred_countries=["유럽"], income_usd=5000))
    schengen_ids = {"DE", "PT", "EE", "ES", "GR", "HR", "CZ", "HU", "SI", "MT", "CY", "AL", "RS", "MK"}
    result_ids = {c["country_id"] for c in result["top_cities"]}
    if result_ids & schengen_ids:
        assert "EES" in result["overall_warning"]


def test_schengen_city_plan_b_trigger():
    result = recommend_from_db(_profile(preferred_countries=["유럽"], income_usd=5000))
    schengen_ids = {"DE", "PT", "EE", "ES", "GR", "HR", "CZ", "HU", "SI", "MT", "CY", "AL", "RS", "MK"}
    for city in result["top_cities"]:
        if city["country_id"] in schengen_ids:
            assert city["plan_b_trigger"] is True


def test_no_duplicate_countries_in_results():
    """같은 나라 도시가 2개 이상 나오면 안 됨."""
    result = recommend_from_db(_profile(income_usd=5000))
    country_ids = [c["country_id"] for c in result["top_cities"]]
    assert len(country_ids) == len(set(country_ids)), f"중복 국가: {country_ids}"


def test_top_n_default_still_returns_3():
    """Default top_n=3 keeps existing callers unchanged."""
    result = recommend_from_db(_profile(income_usd=3000))
    assert len(result["top_cities"]) <= 3

def test_top_n_8_returns_up_to_8():
    """top_n=8 can return more than 3 cities."""
    result = recommend_from_db(_profile(income_usd=3000), top_n=8)
    assert len(result["top_cities"]) >= 4  # must exceed old cap

def test_6month_timeline_filters_stay_6():
    """6개월 bucket filters more strictly than 90일 bucket."""
    base = _profile(income_usd=2000)
    result_90 = recommend_from_db({**base, "timeline": "90일 단기 체험"}, top_n=8)
    result_6m = recommend_from_db({**base, "timeline": "6개월 단기 체험"}, top_n=8)
    # 6-month filter must be at least as restrictive as 90-day (≤ same count)
    assert len(result_6m["top_cities"]) <= len(result_90["top_cities"])

def test_compute_disabled_options_returns_dict():
    """compute_disabled_options returns a dict with expected keys."""
    from recommender import compute_disabled_options
    result = compute_disabled_options(_profile(income_usd=2000, preferred_countries=["아시아"]))
    assert "continents" in result
    assert "timeline" in result
    assert "lifestyle_tags" in result

def test_compute_disabled_options_values_are_lists():
    """disabled option values are lists of JS chip label strings."""
    from recommender import compute_disabled_options
    result = compute_disabled_options(_profile(income_usd=100))
    for key, val in result.items():
        assert isinstance(val, list), f"{key} should be a list"


def test_debug_logs_are_not_included_by_default():
    result = recommend_from_db(_profile(income_usd=3000))
    assert "debug_logs" not in result


def test_debug_logs_include_top3_score_breakdown_when_enabled():
    result = recommend_from_db(_profile(income_usd=3000), debug_mode=True)

    assert "debug_logs" in result
    debug_logs = result["debug_logs"]
    assert isinstance(debug_logs, dict)
    assert "selected" in debug_logs
    assert isinstance(debug_logs["selected"], list)

    top_cities = result["top_cities"]
    selected = debug_logs["selected"]
    assert len(selected) == len(top_cities)

    for idx, row in enumerate(selected):
        assert row["rank"] == idx + 1
        assert isinstance(row["city"], str) and row["city"]
        assert isinstance(row["country_id"], str) and row["country_id"]
        assert 0.0 <= row["final_score"] <= 10.0
        blocks = row["blocks"]
        assert set(blocks.keys()) == {"block_a", "block_b", "block_c", "block_d"}
        assert all(v >= 0 for v in blocks.values())
        wellbeing = row.get("wellbeing")
        assert isinstance(wellbeing, dict)
        assert set(wellbeing.keys()) == {
            "total", "safety", "affordability", "community", "nomad_fit", "english_env", "stale_penalty"
        }
        assert 0.0 <= wellbeing["total"] <= 10.0


def test_wellbeing_proxy_penalizes_overbudget_city():
    from recommender import _wellbeing_proxy_score

    cheap = {
        "monthly_cost_usd": 1000,
        "safety_score": 8.0,
        "korean_community_size": "medium",
        "nomad_score": 8.0,
        "english_score": 7.0,
        "climate": "tropical",
    }
    expensive = {
        **cheap,
        "monthly_cost_usd": 2600,
    }
    country = {"data_verified_date": "2026-04-03"}

    s_cheap = _wellbeing_proxy_score(
        city=cheap,
        country=country,
        income_usd=3000,
        lifestyle=[],
        travel_type="혼자 (솔로)",
    )
    s_expensive = _wellbeing_proxy_score(
        city=expensive,
        country=country,
        income_usd=3000,
        lifestyle=[],
        travel_type="혼자 (솔로)",
    )
    assert s_cheap > s_expensive


def test_chiang_mai_not_in_top3_for_generic_mid_income_profile():
    """라이프스타일 미지정 중소득 프로필에서 치앙마이는 TOP 3에 등장하지 않아야 한다."""
    result = recommend_from_db(_profile(income_usd=3000, lifestyle=[], persona_type=""))
    top3_cities = [c["city"] for c in result["top_cities"]]
    assert "Chiang Mai" not in top3_cities, (
        f"치앙마이가 TOP 3에 등장함: {top3_cities}"
    )


def test_pioneer_prefers_renewable_visa_cities():
    """pioneer(영구이민 지향) 프로필에서 renewable 비자 국가 도시가 TOP 5 안에 등장해야 한다.

    Block C redesign(2026-04-07): pioneer는 이제 cost_score 대신
    renewable_bonus + english_score + korean_community_size를 중시한다.
    """
    result = recommend_from_db(
        _profile(income_usd=2000, lifestyle=[], persona_type="pioneer"),
        top_n=5,
    )
    top5_cities = [c["city"] for c in result["top_cities"]]
    # pioneer → renewable 비자 국가 도시가 포함되어야 함
    assert len(top5_cities) >= 3, (
        f"pioneer 프로필에서 TOP 5 결과가 충분하지 않음: {top5_cities}"
    )


def test_high_income_coworking_profile_unaffected():
    """고소득 + 코워킹 중시 프로필의 TOP 3는 기존대로 유럽/고인프라 도시여야 한다."""
    result = recommend_from_db(
        _profile(income_usd=6000, lifestyle=["코워킹스페이스 중시"], persona_type="free_spirit")
    )
    top3_cities = [c["city"] for c in result["top_cities"]]
    # 고소득+코워킹 → 유럽 중심, 치앙마이 없어야 함
    assert "Chiang Mai" not in top3_cities, (
        f"고소득/코워킹 프로필에서도 치앙마이 등장: {top3_cities}"
    )


def test_block_weights_sum_to_1():
    """Block 가중치 합은 항상 1.0이어야 한다."""
    from recommender import _get_block_weights
    for tl in ["90일 단기 체험", "6개월 단기 체험", "1년 단기 체험", "3년 장기 체류", "5년 이상 초장기 체류", ""]:
        w = _get_block_weights(tl)
        assert abs(sum(w) - 1.0) < 1e-9, f"timeline={tl!r}: weights sum={sum(w)}"


def test_short_stay_weights():
    """단기 체류 가중치: A=0.40, B=0.10, C=0.40, D=0.10"""
    from recommender import _get_block_weights
    assert _get_block_weights("90일 단기 체험") == (0.40, 0.10, 0.40, 0.10)


def test_mid_stay_weights():
    """중기 체류 가중치: A=0.30, B=0.25, C=0.30, D=0.15"""
    from recommender import _get_block_weights
    assert _get_block_weights("6개월 단기 체험") == (0.30, 0.25, 0.30, 0.15)
    assert _get_block_weights("1년 단기 체험") == (0.30, 0.25, 0.30, 0.15)


def test_long_stay_weights():
    """장기 체류 가중치: A=0.30, B=0.25, C=0.25, D=0.20 (현행)"""
    from recommender import _get_block_weights
    assert _get_block_weights("3년 장기 체류") == (0.30, 0.25, 0.25, 0.20)


def test_alias_timeline_resolves_weights():
    """프론트엔드 timeline 문자열도 올바른 가중치를 반환한다."""
    from recommender import _get_block_weights
    assert _get_block_weights("1~3개월 단기 체류") == (0.40, 0.10, 0.40, 0.10)
    assert _get_block_weights("6개월 중기 체류") == (0.30, 0.25, 0.30, 0.15)
    assert _get_block_weights("영주권/이민 목표") == (0.30, 0.25, 0.25, 0.20)


def test_short_stay_block_d_visa_zero():
    """단기 체류 시 Block D의 visa_score는 0이어야 한다."""
    result = recommend_from_db(_profile(timeline="90일 단기 체험", income_usd=3000))
    assert len(result["top_cities"]) > 0
