"""recommender.py — DB 기반 도시 필터링 및 랭킹 엔진."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from utils.data_paths import resolve_data_path
from api.schengen_calculator import SCHENGEN_COUNTRIES

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_SCHENGEN_IDS: set[str] = set(SCHENGEN_COUNTRIES)

_CONTINENT_TO_IDS: dict[str, set[str]] = {
    "아시아":       {"TH", "MY", "ID", "VN", "PH", "JP", "TW"},
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
    "3년 장기 체류":      (12, True),
    "5년 이상 초장기 체류": (12, True),
}

_LONG_STAY_TIMELINES: set[str] = {"3년 장기 체류", "5년 이상 초장기 체류"}

_TIMELINE_ALIASES: dict[str, str] = {
    "3년 이상 장기 이민": "3년 장기 체류",
    "5년 이상 장기 이민": "5년 이상 초장기 체류",
    # Frontend form values → internal keys
    "1~3개월 단기 체류":  "90일 단기 체험",
    "6개월 중기 체류":    "6개월 단기 체험",
    "1년 장기 체류":      "1년 단기 체험",
    "영주권/이민 목표":   "3년 장기 체류",
}

# Schengen long-stay income threshold (USD/month)
_SCHENGEN_LONG_STAY_INCOME_THRESHOLD = 2849

# Frontend lifestyle label → internal key mapping
_LIFESTYLE_ALIASES: dict[str, str] = {
    # New labels (v2)
    "일하기 좋은 인프라":    "코워킹스페이스 중시",
    "한인 커뮤니티 활성화":  "한인 커뮤니티",
    "저렴한 물가와 생활비":  "저비용 생활",
    "영어로 생활 가능":     "영어권 선호",
    # Legacy labels (backward compat)
    "안전":            "안전 중시",
    "영어권":          "영어권 선호",
    "코워킹 스페이스":  "코워킹스페이스 중시",
    "저물가":          "저비용 생활",
    "한인커뮤니티":    "한인 커뮤니티",
}

_LIFESTYLE_MATCH: dict[str, Any] = {
    "코워킹스페이스 중시": lambda city, country: city.get("coworking_score", 0) >= 7,
    "한인 커뮤니티":       lambda city, country: city.get("korean_community_size") == "large",
    "저비용 생활":         lambda city, country: country.get("cost_tier") == "low",
    "안전 중시":           lambda city, country: city.get("safety_score", 0) >= 8,
    "영어권 선호":         lambda city, country: city.get("english_score", 0) >= 7,
}

# korean_community_size → numeric score
_COMMUNITY_SCORE: dict[str, float] = {"large": 10, "medium": 6, "small": 4}

# Beach-friendly climate keywords
_BEACH_CLIMATES: set[str] = {"tropical", "subtropical", "mediterranean"}

# Persona type → attribute weights for Block C scoring
_PERSONA_WEIGHTS: dict[str, dict[str, float]] = {
    "wanderer": {   # wanderer — 이동 자유 중시
        "nomad_score": 3.0, "korean_community_size": 0.3, "coworking_score": 2.0,
    },
    "local": {      # local — 현지 정착 중시
        "korean_community_size": 3.5, "english_score": 0.5, "safety_score": 2.0,
    },
    "planner": {  # planner — 안정·제도 중시
        "safety_score": 2.5, "tax_residency_days_inv": 2.0, "renewable_bonus": 3.0,
    },
    "free_spirit": {  # free_spirit — 작업 환경·커뮤니티 중시
        "coworking_score": 3.0, "nomad_score": 2.5, "korean_community_size": 0.2,
    },
    "pioneer": {   # pioneer — 비용 효율·개척 중시
        "cost_score": 3.5, "nomad_score": 0.5, "coworking_score": 1.5,
    },
}

# ---------------------------------------------------------------------------
# Module-level lazy cache
# ---------------------------------------------------------------------------

_visa_db: list[dict] | None = None
_city_db: list[dict] | None = None
_city_descriptions: dict[str, str] | None = None
_score_ranges: dict[str, tuple[float, float]] | None = None


def _load_data() -> tuple[list[dict], list[dict]]:
    """Load and cache visa_db and city_scores on first call."""
    global _visa_db, _city_db, _score_ranges
    if _visa_db is None:
        path = resolve_data_path("visa_db.json")
        with open(path, encoding="utf-8") as f:
            _visa_db = json.load(f)["countries"]
    if _city_db is None:
        path = resolve_data_path("city_scores.json")
        with open(path, encoding="utf-8") as f:
            _city_db = json.load(f)["cities"]
    if _score_ranges is None:
        # Calculate min/max for key scoring fields
        _fields = ["safety_score", "nomad_score", "coworking_score", "english_score", "internet_mbps"]
        _score_ranges = {}
        for field in _fields:
            vals = [c[field] for c in _city_db if field in c and c[field] is not None]
            _score_ranges[field] = (min(vals), max(vals)) if vals else (0.0, 10.0)
    return _visa_db, _city_db


def _load_city_descriptions() -> dict[str, str]:
    """Load and cache city_descriptions.json on first call."""
    global _city_descriptions
    if _city_descriptions is None:
        path = resolve_data_path("city_descriptions.json")
        try:
            with open(path, encoding="utf-8") as f:
                _city_descriptions = json.load(f)
        except Exception:
            _city_descriptions = {}
    return _city_descriptions


def _get_city_description(country_id: str, city_name: str) -> str | None:
    """Lookup city description by country_id + city slug."""
    descs = _load_city_descriptions()
    slug = city_name.upper().replace(" ", "_").replace("(", "").replace(")", "")
    key = f"{country_id}_{slug}"
    return descs.get(key)


# ---------------------------------------------------------------------------
# Scoring — 4-Block System
# ---------------------------------------------------------------------------

def _normalize(val: float, min_val: float, max_val: float) -> float:
    """Min-Max normalize val to 0–10 range."""
    if max_val == min_val:
        return 5.0
    return (val - min_val) / (max_val - min_val) * 10.0


def _normalize_lifestyle(lifestyle: list[str]) -> list[str]:
    """Frontend lifestyle labels → internal keys (pass-through if already internal)."""
    return [_LIFESTYLE_ALIASES.get(pref, pref) for pref in lifestyle]


def _cost_ratio(city: dict, income_usd: float) -> float:
    """monthly_cost / income — lower is better. 0 if income is 0."""
    if income_usd <= 0:
        return 1.0
    return city.get("monthly_cost_usd", 1500) / income_usd


def _cost_score(city: dict, income_usd: float) -> float:
    """0–10 — cheaper relative to income = higher."""
    return max(0.0, min(10.0, (1.0 - _cost_ratio(city, income_usd)) * 10))


# ── Block A: 기본 적합도 (30%) ──────────────────────────────────

def _block_a(city: dict, lifestyle: list[str]) -> float:
    """Base city fitness — nomad, safety, coworking, internet + lifestyle bonuses."""
    ranges = _score_ranges or {}
    nomad    = _normalize(city.get("nomad_score", 5),      *ranges.get("nomad_score",     (5, 9)))
    safety   = _normalize(city.get("safety_score", 5),     *ranges.get("safety_score",    (4, 9)))
    cowork   = _normalize(city.get("coworking_score", 5),  *ranges.get("coworking_score", (4, 9)))
    internet = _normalize(city.get("internet_mbps", 100),  *ranges.get("internet_mbps",  (50, 300)))

    # Lifestyle bonuses — multipliers
    safety_mul = 1.5 if "안전 중시" in lifestyle else 1.0
    cowork_mul = 1.5 if "코워킹스페이스 중시" in lifestyle else 1.0
    nomad_mul = 1.0
    climate_bonus = 0.0

    for pref in lifestyle:
        if pref == "해변":
            climate = (city.get("climate") or "").lower()
            if climate in _BEACH_CLIMATES:
                climate_bonus = 1.5
        elif pref in ("산/자연", "도시", "카페 문화"):
            nomad_mul += 0.15

    raw = (
        nomad  * nomad_mul * 0.40
        + safety * safety_mul * 0.25
        + cowork * cowork_mul * 0.20
        + internet * 0.15
        + climate_bonus
    )
    return min(10.0, raw) * 0.30


# ── Block B: 재정 적합도 (25%) ──────────────────────────────────

_TAX_SENSITIVITY_MUL: dict[str, float] = {
    "optimize": 1.5,
    "simple": 1.0,
    "unknown": 1.1,
}


def _block_b(city: dict, country: dict, income_usd: float, lifestyle: list[str],
             tax_sensitivity: str = "") -> float:
    """Financial fitness — cost efficiency + tax treaty bonus."""
    cost = _cost_score(city, income_usd)
    cost_mul = 1.3 if "저비용 생활" in lifestyle else 1.0
    # Cap cost score at 5.5 to prevent ultra-cheap cities from dominating
    cost_adjusted = min(5.5, cost * cost_mul)

    tax_mul = _TAX_SENSITIVITY_MUL.get(tax_sensitivity or "", 1.0)
    tax_bonus = 2.0 if country.get("double_tax_treaty_with_kr") else 0.0
    tax_adjusted = min(10.0, tax_bonus * tax_mul)

    # Reduce cost weight 0.7 → 0.5, increase tax weight 0.3 → 0.5
    raw = cost_adjusted * 0.5 + tax_adjusted * 0.5
    return raw * 0.25


# ── Block C: 페르소나 적합도 (25%) ──────────────────────────────

def _block_c(city: dict, country: dict, persona_type: str, income_usd: float) -> float:
    """Persona-driven scoring — different personas value different attributes."""
    ranges = _score_ranges or {}

    if not persona_type or persona_type not in _PERSONA_WEIGHTS:
        # No persona: uniform average of key attributes
        base = (
            _normalize(city.get("nomad_score", 5),     *ranges.get("nomad_score",     (5, 9)))
            + _normalize(city.get("safety_score", 5),    *ranges.get("safety_score",    (4, 9)))
            + _normalize(city.get("coworking_score", 5), *ranges.get("coworking_score", (4, 9)))
        ) / 3.0
        return base * 0.25

    weights = _PERSONA_WEIGHTS[persona_type]
    total_weight = sum(weights.values())
    score = 0.0

    for attr, w in weights.items():
        if attr == "nomad_score":
            score += _normalize(city.get("nomad_score", 5), *ranges.get("nomad_score", (5, 9))) * w
        elif attr == "safety_score":
            score += _normalize(city.get("safety_score", 5), *ranges.get("safety_score", (4, 9))) * w
        elif attr == "coworking_score":
            score += _normalize(city.get("coworking_score", 5), *ranges.get("coworking_score", (4, 9))) * w
        elif attr == "english_score":
            score += _normalize(city.get("english_score", 5), *ranges.get("english_score", (4, 10))) * w
        elif attr == "korean_community_size":
            ks = _COMMUNITY_SCORE.get(city.get("korean_community_size", ""), 0)
            score += ks * w
        elif attr == "tax_residency_days_inv":
            days = country.get("tax_residency_days") or 183
            score += min(10.0, days / 36.5) * w
        elif attr == "renewable_bonus":
            score += (10.0 if country.get("renewable", False) else 0.0) * w
        elif attr == "cost_score":
            score += _cost_score(city, income_usd) * w

    normalized = score / total_weight  # normalize to 0–10
    return min(10.0, normalized) * 0.25


# ── Block D: 실용 조건 적합도 (20%) ─────────────────────────────

def _block_d(
    city: dict, country: dict, income_usd: float,
    travel_type: str, lifestyle: list[str], stay_style: str = "",
    children_ages: list[str] | None = None,
) -> float:
    """Practical conditions — visa access, language, companion needs."""
    ranges = _score_ranges or {}

    # Visa accessibility (0–10)
    visa_type = country.get("visa_type", "")
    has_nomad_visa = bool(visa_type) and "없음" not in visa_type
    visa_score = 0.0
    if has_nomad_visa:
        visa_score += 4.0
    renewable = country.get("renewable", False)
    if renewable:
        visa_score += 3.0
    stay = country.get("stay_months") or 0
    visa_score += min(3.0, stay / 4.0)

    # stay_style adjustments
    if stay_style == "정착형" and renewable:
        visa_score = min(10.0, visa_score * 1.5)   # renewable 가중치 +50%
    elif stay_style == "이동형" and has_nomad_visa:
        visa_score = min(10.0, visa_score * 1.5)   # visa flexibility 가중치 +50%

    # Language environment (0–10)
    english = _normalize(city.get("english_score", 5), *ranges.get("english_score", (4, 10)))
    english_mul = 1.5 if "영어권 선호" in lifestyle else 1.0
    lang_score = min(10.0, english * english_mul)

    # Companion conditions (0–10)
    companion_score = 5.0  # solo default (neutral)
    ages = children_ages or []
    has_young = any(a in ("0~2", "3~6") for a in ages)       # 영아/미취학
    has_elementary = any(a == "7~12" for a in ages)           # 초등
    has_teen = any(a == "13~18" for a in ages)                # 중고등

    if "자녀" in travel_type or ("가족" in travel_type and ages):
        safety = city.get("safety_score", 5)
        cost_eff = max(0.0, (1.0 - _cost_ratio(city, income_usd)) * 10)
        english = _normalize(city.get("english_score", 5), *ranges.get("english_score", (4, 10)))
        community = _COMMUNITY_SCORE.get(city.get("korean_community_size", ""), 0)

        # 연령대별 가중치 합산
        w_safety = 0.6
        w_cost = 0.4
        w_english = 0.0
        w_community = 0.0

        if has_young:
            w_safety = 0.8
            w_cost = 0.2
        if has_elementary:
            w_english += 0.2
            w_safety = max(w_safety - 0.1, 0.3)
            w_cost = max(w_cost - 0.1, 0.1)
        if has_teen:
            w_english += 0.15
            w_community += 0.15
            w_safety = max(w_safety - 0.15, 0.2)
            w_cost = max(w_cost - 0.15, 0.05)

        # Normalize weights to sum to 1.0
        total_w = w_safety + w_cost + w_english + w_community
        companion_score = (
            safety * (w_safety / total_w)
            + cost_eff * (w_cost / total_w)
            + english * (w_english / total_w)
            + community * (w_community / total_w)
        )
    elif "배우자" in travel_type or "가족" in travel_type or "파트너" in travel_type:
        # Spouse/family (자녀 없음): prioritize renewable visa + safety
        renew = 5.0 if renewable else 0.0
        safety = city.get("safety_score", 5)
        companion_score = renew * 0.5 + safety * 0.5

    raw = visa_score * 0.4 + lang_score * 0.3 + companion_score * 0.3
    return raw * 0.20


# ── Final composite score ───────────────────────────────────────

def _compute_score(
    city: dict,
    country: dict,
    income_usd: float,
    lifestyle: list[str],
    persona_type: str = "",
    travel_type: str = "",
    stay_style: str = "",
    tax_sensitivity: str = "",
    children_ages: list[str] | None = None,
) -> float:
    """4-Block composite score (0–10)."""
    return _compute_score_breakdown(
        city=city,
        country=country,
        income_usd=income_usd,
        lifestyle=lifestyle,
        persona_type=persona_type,
        travel_type=travel_type,
        stay_style=stay_style,
        tax_sensitivity=tax_sensitivity,
        children_ages=children_ages,
    )["total"]


def _compute_score_breakdown(
    city: dict,
    country: dict,
    income_usd: float,
    lifestyle: list[str],
    persona_type: str = "",
    travel_type: str = "",
    stay_style: str = "",
    tax_sensitivity: str = "",
    children_ages: list[str] | None = None,
) -> dict[str, float]:
    """4-Block composite score breakdown (0–10)."""
    ls = _normalize_lifestyle(lifestyle)
    a = _block_a(city, ls)
    b = _block_b(city, country, income_usd, ls, tax_sensitivity)
    c = _block_c(city, country, persona_type, income_usd)
    d = _block_d(city, country, income_usd, travel_type, ls, stay_style, children_ages)
    total = round(min(10.0, max(0.0, a + b + c + d)), 1)
    return {
        "block_a": round(a, 3),
        "block_b": round(b, 3),
        "block_c": round(c, 3),
        "block_d": round(d, 3),
        "total": total,
    }


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

def recommend_from_db(user_profile: dict, top_n: int = 3, debug_mode: bool = False) -> dict:
    """Filter and rank cities from DB; return top-N with warnings."""
    countries_list, cities_list = _load_data()

    income_usd = float(user_profile.get("income_usd") or 0)
    timeline_raw = user_profile.get("timeline", "")
    timeline   = _TIMELINE_ALIASES.get(timeline_raw, timeline_raw)
    lifestyle  = user_profile.get("lifestyle") or []
    preferred  = user_profile.get("preferred_countries") or []
    nationality = user_profile.get("nationality", "")
    language = user_profile.get("language", "한국어")
    persona_type = user_profile.get("persona_type", "")
    travel_type = user_profile.get("travel_type", "")
    stay_style = user_profile.get("stay_style") or ""
    tax_sensitivity = user_profile.get("tax_sensitivity") or ""
    children_ages = user_profile.get("children_ages") or []

    # Build country lookup
    country_map: dict[str, dict] = {c["id"]: c for c in countries_list}

    # Score and filter cities
    seen_country_ids: set[str] = set()

    candidates: list[tuple[float, dict, dict, dict[str, float]]] = []

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

        breakdown = _compute_score_breakdown(
            city=city,
            country=country,
            income_usd=income_usd,
            lifestyle=lifestyle,
            persona_type=persona_type,
            travel_type=travel_type,
            stay_style=stay_style,
            tax_sensitivity=tax_sensitivity,
            children_ages=children_ages,
        )
        score = breakdown["total"]
        candidates.append((score, city, country, breakdown))

    # Sort descending by score
    candidates.sort(key=lambda x: x[0], reverse=True)

    # Deduplicate by country — keep only highest-scoring city per country
    top_cities_raw: list[tuple[float, dict, dict, dict[str, float]]] = []
    for score, city, country, breakdown in candidates:
        cid = city.get("country_id", "")
        if cid in seen_country_ids:
            continue
        seen_country_ids.add(cid)
        top_cities_raw.append((score, city, country, breakdown))
        if len(top_cities_raw) == top_n:
            break

    # Build output city dicts
    result_country_ids = {city.get("country_id", "") for _, city, _, _ in top_cities_raw}

    top_cities: list[dict] = []
    debug_selected: list[dict] = []
    for idx, (score, city, country, breakdown) in enumerate(top_cities_raw, start=1):
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
            # city_scores.json fields
            "internet_mbps":          city.get("internet_mbps"),
            "safety_score":           city.get("safety_score"),
            "english_score":          city.get("english_score"),
            "nomad_score":            city.get("nomad_score"),
            "cowork_usd_month":       city.get("cowork_usd_month"),
            "community_size":         city.get("community_size"),
            "korean_community_size":  city.get("korean_community_size"),
            "mid_term_rent_usd":      city.get("mid_term_rent_usd"),
            "flatio_search_url":      city.get("flatio_search_url"),
            "anyplace_search_url":    city.get("anyplace_search_url"),
            "nomad_meetup_url":       city.get("nomad_meetup_url"),
            "entry_tips":             city.get("entry_tips"),
            # visa_db.json fields
            "stay_months":                country.get("stay_months"),
            "renewable":                  country.get("renewable"),
            "key_docs":                   country.get("key_docs"),
            "visa_fee_usd":               country.get("visa_fee_usd"),
            "tax_note":                   country.get("tax_note"),
            "double_tax_treaty_with_kr":  country.get("double_tax_treaty_with_kr"),
            "visa_notes":                 country.get("visa_notes"),
            "city_description":           _get_city_description(cid, city.get("city", "")),
        })
        if debug_mode:
            debug_selected.append({
                "rank": idx,
                "city": city.get("city", ""),
                "city_kr": city.get("city_kr", ""),
                "country": city.get("country", ""),
                "country_id": cid,
                "final_score": score,
                "blocks": {
                    "block_a": breakdown["block_a"],
                    "block_b": breakdown["block_b"],
                    "block_c": breakdown["block_c"],
                    "block_d": breakdown["block_d"],
                },
            })

    # Build overall_warning
    warnings: list[str] = []

    if nationality == "한국":
        if language == "English":
            warnings.append(
                "Check Korean National Health Insurance continuity. "
                "Long-term overseas stays can affect your insurance eligibility."
            )
        else:
            warnings.append(
                "한국 국민건강보험 유지 여부를 반드시 확인하세요. "
                "장기 해외 체류 시 건강보험 자격이 상실될 수 있습니다."
            )

    if result_country_ids & _SCHENGEN_IDS:
        if language == "English":
            warnings.append(
                "EES (EU Entry/Exit System) applies in the Schengen area. "
                "Follow the 90/180-day rule strictly."
            )
        else:
            warnings.append(
                "솅겐 지역 입국 시 EES(유럽입국관리시스템)가 2025년부터 시행됩니다. "
                "90/180일 규칙을 반드시 준수하세요."
            )

    if "GE" in result_country_ids:
        if language == "English":
            warnings.append(
                "Georgia allows 365-day visa-free stay, but watch tax residency risks "
                "and the absence of a double-tax treaty with Korea."
            )
        else:
            warnings.append(
                "조지아는 비자 없이 365일 체류 가능하나, "
                "세금 거주지 문제와 한국과의 이중과세협약 부재에 유의하세요."
            )

    overall_warning = " ".join(warnings)

    result = {
        "top_cities":      top_cities,
        "overall_warning": overall_warning,
    }
    if debug_mode:
        result["debug_logs"] = {
            "score_model": "4-block",
            "selected": debug_selected,
            "inputs": {
                "income_usd": income_usd,
                "timeline": timeline,
                "persona_type": persona_type,
                "travel_type": travel_type,
                "stay_style": stay_style,
                "tax_sensitivity": tax_sensitivity,
                "lifestyle": _normalize_lifestyle(lifestyle),
                "preferred_countries": preferred,
            },
            "selection_rule": "국가 중복 제거 규칙으로 국가당 최고 점수 도시 1개만 선택",
        }
    return result


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
    "3년+":  "3년 장기 체류",
}

# JS chip label → internal lifestyle key
_CHIP_TO_LIFESTYLE: dict[str, str] = {
    "저물가":       "저비용 생활",
    "코워킹":       "코워킹스페이스 중시",
    "안전":         "안전 중시",
    "한인커뮤니티":  "한인 커뮤니티",
    "영어권":       "영어권 선호",
    "해변":         "해변",
    "산/자연":      "산/자연",
    "도시":         "도시",
    "카페 문화":    "카페 문화",
}


def _any_city_passes(profile: dict, countries_list: list, cities_list: list) -> bool:
    """Return True if any city passes all hard filters for the given profile."""
    income_usd = float(profile.get("income_usd") or 0)
    timeline_raw = profile.get("timeline", "")
    timeline   = _TIMELINE_ALIASES.get(timeline_raw, timeline_raw)
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
