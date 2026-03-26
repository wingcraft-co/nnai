"""recommender.py — DB 기반 도시 필터링 및 랭킹 엔진."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from utils.data_paths import resolve_data_path

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_SCHENGEN_IDS: set[str] = {
    "DE", "PT", "EE", "ES", "GR", "HR", "CZ", "HU", "SI", "MT", "CY", "AL", "RS", "MK"
}

_CONTINENT_TO_IDS: dict[str, set[str]] = {
    "아시아":       {"TH", "MY", "ID", "VN", "PH", "JP"},
    "유럽":         {"DE", "PT", "EE", "ES", "GR", "HR", "CZ", "HU", "SI", "MT", "CY", "AL", "RS", "MK"},
    "중남미":       {"CR", "MX", "CO", "AR", "BR"},
    "중동/아프리카": {"AE", "MA"},
    "북미":         {"CA"},
}

# (min_stay_months, require_renewable)
_TIMELINE_FILTER: dict[str, tuple[int, bool]] = {
    "90일 단기 체험":     (1,  False),
    "6개월 단기 체험":    (6,  False),
    "1년 단기 체험":      (12, False),
    "3년 이상 장기 이민": (12, True),
    "5년 이상 장기 이민": (12, True),
}

_LONG_STAY_TIMELINES: set[str] = {"3년 이상 장기 이민", "5년 이상 장기 이민"}

# Schengen long-stay income threshold (USD/month)
_SCHENGEN_LONG_STAY_INCOME_THRESHOLD = 2849

_LIFESTYLE_MATCH: dict[str, Any] = {
    "코워킹스페이스 중시": lambda city, country: city.get("coworking_score", 0) >= 7,
    "한인 커뮤니티":       lambda city, country: city.get("korean_community_size") == "large",
    "저비용 생활":         lambda city, country: country.get("cost_tier") == "low",
    "안전 중시":           lambda city, country: city.get("safety_score", 0) >= 8,
    "영어권 선호":         lambda city, country: city.get("english_score", 0) >= 7,
}

# ---------------------------------------------------------------------------
# Module-level lazy cache
# ---------------------------------------------------------------------------

_visa_db: list[dict] | None = None
_city_db: list[dict] | None = None


def _load_data() -> tuple[list[dict], list[dict]]:
    """Load and cache visa_db and city_scores on first call."""
    global _visa_db, _city_db
    if _visa_db is None:
        path = resolve_data_path("visa_db.json")
        with open(path, encoding="utf-8") as f:
            _visa_db = json.load(f)["countries"]
    if _city_db is None:
        path = resolve_data_path("city_scores.json")
        with open(path, encoding="utf-8") as f:
            _city_db = json.load(f)["cities"]
    return _visa_db, _city_db


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def _cost_inverse_score(monthly_cost_usd: int, income_usd: float) -> float:
    """Invert cost relative to income — cheaper is better, capped 0–10."""
    if income_usd <= 0:
        return 5.0
    ratio = monthly_cost_usd / income_usd  # lower ratio = better
    # ratio 0.2 → 10, ratio 1.0 → 0, linear interpolation
    score = 10.0 * max(0.0, 1.0 - ratio / 1.0)
    return min(10.0, max(0.0, score))


def _lifestyle_score(city: dict, country: dict, lifestyle: list[str]) -> float:
    """Score 0–10 based on how many lifestyle preferences match."""
    if not lifestyle:
        return 5.0
    matched = sum(
        1
        for pref in lifestyle
        if pref in _LIFESTYLE_MATCH and _LIFESTYLE_MATCH[pref](city, country)
    )
    return round(matched / len(lifestyle) * 10, 1)


def _compute_score(
    city: dict,
    country: dict,
    income_usd: float,
    lifestyle: list[str],
) -> float:
    """Weighted composite score (0–10)."""
    nomad   = city.get("nomad_score", 5) / 10 * 10   # already 0–10
    safety  = city.get("safety_score", 5) / 10 * 10
    cost    = _cost_inverse_score(city.get("monthly_cost_usd", 1500), income_usd)
    life    = _lifestyle_score(city, country, lifestyle)
    english = city.get("english_score", 5) / 10 * 10

    composite = (
        nomad   * 0.30
        + safety  * 0.20
        + cost    * 0.20
        + life    * 0.20
        + english * 0.10
    )
    return round(min(10.0, max(0.0, composite)), 1)


# ---------------------------------------------------------------------------
# Hard filters
# ---------------------------------------------------------------------------

def _passes_income_filter(country: dict, income_usd: float) -> bool:
    min_inc = country.get("min_income_usd") or 0
    return income_usd >= min_inc


def _passes_timeline_filter(country: dict, timeline: str) -> bool:
    if timeline not in _TIMELINE_FILTER:
        return True
    _min_months, require_renewable = _TIMELINE_FILTER[timeline]
    if require_renewable and not country.get("renewable", True):
        return False
    stay_months = country.get("stay_months") or 0
    return stay_months >= _min_months


def _passes_continent_filter(country_id: str, preferred_countries: list[str]) -> bool:
    if not preferred_countries:
        return True
    allowed: set[str] = set()
    for region in preferred_countries:
        allowed |= _CONTINENT_TO_IDS.get(region, set())
    return country_id in allowed


def _passes_schengen_long_stay_filter(
    country: dict, timeline: str, income_usd: float
) -> bool:
    """Schengen + long-stay + income below threshold → exclude."""
    if timeline not in _LONG_STAY_TIMELINES:
        return True
    if not country.get("schengen", False):
        return True
    return income_usd >= _SCHENGEN_LONG_STAY_INCOME_THRESHOLD


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def recommend_from_db(user_profile: dict, top_n: int = 3) -> dict:
    """Filter and rank cities from DB; return top-N with warnings."""
    countries_list, cities_list = _load_data()

    income_usd = float(user_profile.get("income_usd") or 0)
    timeline   = user_profile.get("timeline", "")
    lifestyle  = user_profile.get("lifestyle") or []
    preferred  = user_profile.get("preferred_countries") or []
    nationality = user_profile.get("nationality", "")

    # Build country lookup
    country_map: dict[str, dict] = {c["id"]: c for c in countries_list}

    # Score and filter cities
    scored: list[tuple[float, dict, dict]] = []  # (score, city, country)

    seen_country_ids: set[str] = set()

    candidates: list[tuple[float, dict, dict]] = []

    for city in cities_list:
        cid = city.get("country_id", "")
        country = country_map.get(cid)
        if country is None:
            # City belongs to a country not in visa_db — skip
            continue

        # Hard filters
        if not _passes_income_filter(country, income_usd):
            continue
        if not _passes_timeline_filter(country, timeline):
            continue
        if not _passes_continent_filter(cid, preferred):
            continue
        if not _passes_schengen_long_stay_filter(country, timeline, income_usd):
            continue

        score = _compute_score(city, country, income_usd, lifestyle)
        candidates.append((score, city, country))

    # Sort descending by score
    candidates.sort(key=lambda x: x[0], reverse=True)

    # Deduplicate by country — keep only highest-scoring city per country
    top_cities_raw: list[tuple[float, dict, dict]] = []
    for score, city, country in candidates:
        cid = city.get("country_id", "")
        if cid in seen_country_ids:
            continue
        seen_country_ids.add(cid)
        top_cities_raw.append((score, city, country))
        if len(top_cities_raw) == top_n:
            break

    # Build output city dicts
    result_country_ids = {city.get("country_id", "") for _, city, _ in top_cities_raw}

    top_cities: list[dict] = []
    for score, city, country in top_cities_raw:
        cid = city.get("country_id", "")
        is_schengen = cid in _SCHENGEN_IDS
        top_cities.append({
            "city":               city.get("city", ""),
            "city_kr":            city.get("city_kr", ""),
            "country":            city.get("country", ""),
            "country_id":         cid,
            "visa_type":          country.get("visa_type", ""),
            "visa_url":           "",   # app.py will fill via _inject_visa_urls()
            "monthly_cost_usd":   city.get("monthly_cost_usd", 0),
            "score":              score,
            "reasons":            [],
            "realistic_warnings": [],
            "plan_b_trigger":     is_schengen,
            "references":         [],
        })

    # Build overall_warning
    warnings: list[str] = []

    if nationality == "한국":
        warnings.append(
            "한국 국민건강보험 유지 여부를 반드시 확인하세요. "
            "장기 해외 체류 시 건강보험 자격이 상실될 수 있습니다."
        )

    if result_country_ids & _SCHENGEN_IDS:
        warnings.append(
            "솅겐 지역 입국 시 EES(유럽입국관리시스템)가 2025년부터 시행됩니다. "
            "90/180일 규칙을 반드시 준수하세요."
        )

    if "GE" in result_country_ids:
        warnings.append(
            "조지아는 비자 없이 365일 체류 가능하나, "
            "세금 거주지 문제와 한국과의 이중과세협약 부재에 유의하세요."
        )

    overall_warning = " ".join(warnings)

    return {
        "top_cities":      top_cities,
        "overall_warning": overall_warning,
    }


# ---------------------------------------------------------------------------
# Faceted filter helpers
# ---------------------------------------------------------------------------

# JS chip label → _CONTINENT_TO_IDS key(s). "기타" maps to two keys.
_CHIP_TO_CONTINENTS: dict[str, list[str]] = {
    "아시아": ["아시아"],
    "유럽":   ["유럽"],
    "중남미": ["중남미"],
    "기타":   ["중동/아프리카", "북미"],
}

# JS chip label → _TIMELINE_FILTER key
_CHIP_TO_TIMELINE: dict[str, str] = {
    "90일":  "90일 단기 체험",
    "6개월": "6개월 단기 체험",
    "1년":   "1년 단기 체험",
    "3년+":  "3년 이상 장기 이민",
}

# JS chip label → _LIFESTYLE_MATCH key
_CHIP_TO_LIFESTYLE: dict[str, str] = {
    "저물가":     "저비용 생활",
    "코워킹":     "코워킹스페이스 중시",
    "안전":       "안전 중시",
    "한인커뮤니티": "한인 커뮤니티",
    "영어권":     "영어권 선호",
}


def _any_city_passes(profile: dict, countries_list: list, cities_list: list) -> bool:
    """Return True if any city passes all hard filters for the given profile."""
    income_usd = float(profile.get("income_usd") or 0)
    timeline   = profile.get("timeline", "")
    preferred  = profile.get("preferred_countries") or []
    country_map = {c["id"]: c for c in countries_list}
    for city in cities_list:
        cid = city.get("country_id", "")
        country = country_map.get(cid)
        if country is None:
            continue
        if not _passes_income_filter(country, income_usd):
            continue
        if not _passes_timeline_filter(country, timeline):
            continue
        if not _passes_continent_filter(cid, preferred):
            continue
        if not _passes_schengen_long_stay_filter(country, timeline, income_usd):
            continue
        return True
    return False


def compute_disabled_options(db_profile: dict) -> dict:
    """
    Return chip label lists that would yield zero results if added to db_profile.

    db_profile uses recommend_from_db() field names:
      income_usd, preferred_countries, lifestyle, timeline, nationality

    Returns dict with keys: continents, timeline, lifestyle_tags
    Each value is a list of JS chip label strings that are disabled.
    """
    countries_list, cities_list = _load_data()

    disabled: dict[str, list[str]] = {
        "continents": [],
        "timeline": [],
        "lifestyle_tags": [],
    }

    # Continents are tested in isolation (single-select semantics — tests "if only
    # this continent is selected, do any cities match?").  We override
    # preferred_countries with just the one continent key so the other active
    # filters remain in place while the continent varies independently.
    for chip_label, continent_keys in _CHIP_TO_CONTINENTS.items():
        test_profile = {**db_profile, "preferred_countries": continent_keys}
        if not _any_city_passes(test_profile, countries_list, cities_list):
            disabled["continents"].append(chip_label)

    # Test each timeline chip
    for chip_label, timeline_key in _CHIP_TO_TIMELINE.items():
        test_profile = {**db_profile, "timeline": timeline_key}
        if not _any_city_passes(test_profile, countries_list, cities_list):
            disabled["timeline"].append(chip_label)

    # Lifestyle is a soft filter (affects score only, never hard-excludes cities),
    # so _any_city_passes() will always return True regardless of the lifestyle
    # value — meaning lifestyle_tags will always be an empty list here.  The block
    # is retained for forward-compatibility: if hard lifestyle filters are added
    # later, the disabled-chip logic will work without further changes.
    current_lifestyle = list(db_profile.get("lifestyle") or [])
    for chip_label, lifestyle_key in _CHIP_TO_LIFESTYLE.items():
        if lifestyle_key in current_lifestyle:
            continue  # already selected, cannot be disabled
        test_lifestyle = current_lifestyle + [lifestyle_key]
        test_profile = {**db_profile, "lifestyle": test_lifestyle}
        if not _any_city_passes(test_profile, countries_list, cities_list):
            disabled["lifestyle_tags"].append(chip_label)

    return disabled
