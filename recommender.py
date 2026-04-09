"""recommender.py — DB 기반 도시 필터링 및 랭킹 엔진."""
from __future__ import annotations

import json
from pathlib import Path
from datetime import date, datetime
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
    "해변":               lambda city, country: (city.get("climate") or "").lower() in _BEACH_CLIMATES,
}

# If selected, these preferences are treated as must-have in first-pass ranking.
_MUST_HAVE_LIFESTYLES: set[str] = {"안전 중시", "영어권 선호", "코워킹스페이스 중시", "해변"}

# Penalty applied when selected preference is not met (soft scoring).
_LIFESTYLE_MISS_PENALTY: dict[str, float] = {
    "안전 중시": 1.0,
    "영어권 선호": 1.0,
    "코워킹스페이스 중시": 0.8,
    "해변": 0.9,
    "한인 커뮤니티": 0.5,
    "저비용 생활": 0.5,
}

# korean_community_size → numeric score
_COMMUNITY_SCORE: dict[str, float] = {"large": 10, "medium": 6, "small": 4}

# Climate type → score for free_spirit persona (Block C)
_CLIMATE_SCORE_MAP: dict[str, float] = {
    "mediterranean": 10.0, "subtropical": 10.0,
    "tropical": 8.0,
    "oceanic": 6.0, "temperate": 6.0,
    "continental": 4.0, "arid": 4.0,
}

# Beach-friendly climate keywords
_BEACH_CLIMATES: set[str] = {"tropical", "subtropical", "mediterranean"}

# Persona type → attribute weights for Block C scoring
_PERSONA_WEIGHTS: dict[str, dict[str, float]] = {
    "wanderer": {   # wanderer — 이동, 탐험, 자유
        "nomad_score": 3.5, "visa_freedom": 2.5, "coworking_score": 1.5,
    },
    "local": {      # local — 정착, 커뮤니티, 안전
        "korean_community_size": 3.5, "safety_score": 2.5, "long_stay_score": 1.5,
    },
    "planner": {    # planner — 실용, 비용효율, 세금
        "cost_score": 3.0, "tax_residency_days_inv": 2.5, "renewable_bonus": 2.0,
    },
    "free_spirit": {  # free_spirit — 번아웃 탈출, 힐링
        "safety_score": 3.0, "climate_score": 2.5, "cost_score": 2.0,
    },
    "pioneer": {    # pioneer — 영구이민, 영어, 제도
        "renewable_bonus": 3.5, "english_score": 2.5,
        "korean_community_size": 1.5,  # 정착 초기 네트워크 역할
    },
}

# Block C penalty scale per persona — lower = gentler penalty on cheap+high-nomad cities
# pioneer explicitly weights cost_score, so penalty is already partially baked in.
_BLOCK_C_PENALTY_SCALE: dict[str, float] = {
    "pioneer":     0.25,
    "local":       0.40,
    "planner":     0.40,
    "wanderer":    0.60,
    "free_spirit": 0.60,
}
_BLOCK_C_PENALTY_SCALE_DEFAULT = 1.5  # no persona: amplified to suppress generic dominance of cheap+high-nomad cities

# Timeline-based block weight sets
_SHORT_STAY_TIMELINES: set[str] = {"90일 단기 체험"}
_MID_STAY_TIMELINES: set[str] = {"6개월 단기 체험", "1년 단기 체험"}
# _LONG_STAY_TIMELINES already defined at line 35


def _get_block_weights(timeline: str) -> tuple[float, float, float, float]:
    """Return (w_a, w_b, w_c, w_d) based on resolved timeline."""
    resolved = _TIMELINE_ALIASES.get(timeline, timeline)
    if resolved in _SHORT_STAY_TIMELINES:
        return (0.40, 0.10, 0.40, 0.10)
    if resolved in _MID_STAY_TIMELINES:
        return (0.30, 0.25, 0.30, 0.15)
    return (0.30, 0.25, 0.25, 0.20)


# ---------------------------------------------------------------------------
# Module-level lazy cache
# ---------------------------------------------------------------------------

_visa_db: list[dict] | None = None
_city_db: list[dict] | None = None
_city_descriptions: dict[str, str] | None = None
_score_ranges: dict[str, tuple[float, float]] | None = None
_source_catalog: dict[str, dict] | None = None


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


def _load_source_catalog() -> dict[str, dict]:
    """Load source_catalog.json as {source_id: source_obj}."""
    global _source_catalog
    if _source_catalog is None:
        path = resolve_data_path("source_catalog.json")
        try:
            with open(path, encoding="utf-8") as f:
                rows = json.load(f).get("sources", [])
                _source_catalog = {str(r.get("id", "")): r for r in rows if r.get("id")}
        except Exception:
            _source_catalog = {}
    return _source_catalog


def _get_city_description(country_id: str, city_name: str) -> str | None:
    """Lookup city description by country_id + city slug."""
    descs = _load_city_descriptions()
    slug = city_name.upper().replace(" ", "_").replace("(", "").replace(")", "")
    key = f"{country_id}_{slug}"
    return descs.get(key)


def _parse_date_lenient(raw: str | None) -> date | None:
    if not raw or not isinstance(raw, str):
        return None
    raw = raw.strip()
    for fmt in ("%Y-%m-%d", "%Y-%m"):
        try:
            dt = datetime.strptime(raw, fmt)
            return date(dt.year, dt.month, 1) if fmt == "%Y-%m" else dt.date()
        except ValueError:
            continue
    return None


def _source_is_stale(raw: str | None, threshold_days: int = 180) -> bool:
    d = _parse_date_lenient(raw)
    if d is None:
        return True
    return (date.today() - d).days > threshold_days


def _country_income_floor_monthly_usd(country: dict) -> float:
    """Best-effort country-level monthly income floor extracted from visa metadata."""
    values: list[float] = []
    min_income_usd = country.get("min_income_usd")
    if isinstance(min_income_usd, (int, float)) and min_income_usd > 0:
        values.append(float(min_income_usd))

    for tier in country.get("income_tiers") or []:
        m = tier.get("min_income_monthly_usd")
        if isinstance(m, (int, float)) and m > 0:
            values.append(float(m))
        a = tier.get("min_income_annual_usd")
        if isinstance(a, (int, float)) and a > 0:
            values.append(float(a) / 12.0)

    if not values:
        return 0.0
    return min(values)


def _build_references(city: dict, country: dict) -> list[dict[str, str]]:
    refs: list[dict[str, str]] = []
    seen: set[str] = set()

    country_source = str(country.get("source") or "").strip()
    if country_source.startswith("http"):
        refs.append({"title": "Official visa source", "url": country_source})
        seen.add(country_source)

    source_catalog = _load_source_catalog()
    for rid in city.get("source_refs") or []:
        src = source_catalog.get(str(rid))
        if not src:
            continue
        url = str(src.get("url") or "").strip()
        if not url.startswith("http") or url in seen:
            continue
        refs.append({"title": str(src.get("name") or rid), "url": url})
        seen.add(url)
        if len(refs) >= 3:
            break

    return refs


def _build_reasons_and_warnings(
    city: dict,
    country: dict,
    breakdown: dict[str, float],
    income_usd: float,
    timeline: str,
    lifestyle: list[str],
) -> tuple[list[dict[str, str]], list[str]]:
    reasons: list[dict[str, str]] = []
    warnings: list[str] = []

    if breakdown.get("block_a", 0) >= 2.1:
        reasons.append({"point": "도시 인프라·안전·인터넷 기본 적합도가 높습니다."})
    if breakdown.get("block_b", 0) >= 1.8:
        reasons.append({"point": "예산 대비 생활비 효율이 양호합니다."})
    if country.get("renewable"):
        reasons.append({"point": "비자 갱신 가능 국가라 장기 체류 전략 수립이 수월합니다."})
    if "영어권 선호" in lifestyle and (city.get("english_score") or 0) >= 7:
        reasons.append({"point": "영어 사용 환경이 비교적 안정적입니다."})

    monthly_cost = float(city.get("monthly_cost_usd") or 0)
    if income_usd > 0 and monthly_cost > income_usd * 0.75:
        warnings.append("월 예상 생활비가 월소득의 75%를 초과할 수 있어 저축 여력이 낮아질 수 있습니다.")
    if timeline in _LONG_STAY_TIMELINES and not country.get("double_tax_treaty_with_kr"):
        warnings.append("한국과 이중과세협약 부재 가능성이 있어 세무 자문 사전 검토가 필요합니다.")
    if _source_is_stale(country.get("data_verified_date")):
        warnings.append("비자 데이터 검증일이 오래되어 최신 요건 재확인이 필요합니다.")

    if not reasons:
        reasons.append({"point": "현재 입력 조건에서 종합 점수가 상대적으로 가장 높습니다."})

    return reasons[:3], warnings[:3]


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


def _high_income_low_cost_penalty(city: dict, income_usd: float) -> float:
    """
    Penalize extreme budget mismatch:
    very high income profiles repeatedly selecting ultra-low-cost cities.
    """
    monthly_cost = float(city.get("monthly_cost_usd") or 0)
    if income_usd < 5000:
        return 0.0
    if monthly_cost <= 1200:
        return 1.3
    if monthly_cost <= 1500:
        return 0.8
    return 0.0


# ── Block A: 기본 적합도 (30%) ──────────────────────────────────

def _lifestyle_miss_penalty(city: dict, country: dict, lifestyle: list[str]) -> float:
    penalty = 0.0
    for pref in lifestyle:
        check = _LIFESTYLE_MATCH.get(pref)
        if check is None:
            continue
        if not check(city, country):
            penalty += _LIFESTYLE_MISS_PENALTY.get(pref, 0.0)
    return min(2.5, penalty)


def _passes_lifestyle_must_have(city: dict, country: dict, lifestyle: list[str]) -> bool:
    must_haves = [p for p in lifestyle if p in _MUST_HAVE_LIFESTYLES]
    if not must_haves:
        return True
    for pref in must_haves:
        check = _LIFESTYLE_MATCH.get(pref)
        if check is None:
            continue
        if not check(city, country):
            return False
    return True


def _city_dominance_penalty(city: dict, lifestyle: list[str], income_usd: float = 0.0) -> float:
    """
    Generic anti-dominance penalty.
    Applies to any city that is simultaneously very cheap and very high on nomad/work metrics.

    When lifestyle is empty (user hasn't specified preferences), we apply an extra boost
    to discourage niche/dominant cities and favor more balanced options.
    """
    monthly_cost = float(city.get("monthly_cost_usd") or 0)
    nomad = float(city.get("nomad_score") or 0)
    cowork = float(city.get("coworking_score") or 0)
    community = str(city.get("korean_community_size") or "")

    penalty = 0.0
    if monthly_cost <= 1200:
        penalty += 0.90
    elif monthly_cost <= 1500:
        penalty += 0.45

    if nomad >= 9:
        penalty += 0.55
    if cowork >= 9:
        penalty += 0.40
    if community == "large":
        penalty += 0.25

    # Synergy penalty for the "very cheap + very high nomad/work" cluster.
    if monthly_cost <= 1500 and nomad >= 8.5 and cowork >= 8.5:
        penalty += 0.90

    # If user explicitly wants low-cost/community, relax related components.
    if "저비용 생활" in lifestyle:
        penalty -= 0.35
    if "한인 커뮤니티" in lifestyle:
        penalty -= 0.10

    # Low-income users should not be over-penalized for affordable city preference.
    if income_usd > 0 and income_usd < 2200:
        penalty *= 0.70

    return max(0.0, min(2.5, penalty))


def _block_a(city: dict, country: dict, lifestyle: list[str], income_usd: float = 0.0) -> float:
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
    raw -= _lifestyle_miss_penalty(city, country, lifestyle)
    raw -= _city_dominance_penalty(city, lifestyle, income_usd)
    return min(10.0, max(0.0, raw))


# ── Block B: 재정 적합도 (25%) ──────────────────────────────────

_TAX_SENSITIVITY_MUL: dict[str, float] = {
    "optimize": 1.5,
    "simple": 1.0,
    "unknown": 1.1,
}


def _block_b(city: dict, country: dict, income_usd: float, lifestyle: list[str],
             tax_sensitivity: str = "", timeline: str = "") -> float:
    """Financial fitness — cost efficiency + tax treaty bonus."""
    cost = _cost_score(city, income_usd)
    cost_mul = 1.3 if "저비용 생활" in lifestyle else 1.0
    # Cap cost score at 5.5 to prevent ultra-cheap cities from dominating
    cost_adjusted = min(5.5, cost * cost_mul)

    # 90일 이하 단기 체류는 세금 거주지(183일)가 발생하지 않으므로 세금 보너스 미적용
    is_short_stay = timeline == "90일 단기 체험"
    tax_mul = _TAX_SENSITIVITY_MUL.get(tax_sensitivity or "", 1.0)
    tax_bonus = 0.0 if is_short_stay else (2.0 if country.get("double_tax_treaty_with_kr") else 0.0)
    tax_adjusted = min(10.0, tax_bonus * tax_mul)

    # Reduce cost weight 0.7 → 0.5, increase tax weight 0.3 → 0.5
    raw = cost_adjusted * 0.5 + tax_adjusted * 0.5
    raw -= _high_income_low_cost_penalty(city, income_usd)
    raw = max(0.0, raw)
    return min(10.0, raw)


# ── Block C: 페르소나 적합도 (25%) ──────────────────────────────

def _block_c(
    city: dict,
    country: dict,
    persona_type: str,
    income_usd: float,
    lifestyle: list[str] | None = None,
) -> float:
    """Persona-driven scoring — different personas value different attributes."""
    ranges = _score_ranges or {}
    # lifestyle is expected to be pre-normalized by caller (_normalize_lifestyle)
    ls = lifestyle if lifestyle is not None else []

    if not persona_type or persona_type not in _PERSONA_WEIGHTS:
        # No persona: w_c is set to 0.0 in _compute_score_breakdown — return early
        return 0.0

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
        elif attr == "visa_freedom":
            # wanderer 전용 — visa_db 파생
            vt = (country.get("visa_type") or "").lower()
            if any(k in vt for k in ("visa-free", "visa on arrival", "무비자")):
                vs = 10.0
            elif any(k in vt for k in ("digital nomad", "nomad pass", "nomad visa", "de rantau")):
                vs = 7.0
            elif country.get("renewable", False):
                vs = 5.0
            else:
                vs = 3.0
            score += vs * w
        elif attr == "climate_score":
            # free_spirit 전용 — city_scores.climate 텍스트 매핑
            climate_val = (city.get("climate") or "").lower()
            score += _CLIMATE_SCORE_MAP.get(climate_val, 5.0) * w
        elif attr == "long_stay_score":
            # local 전용 — visa_db 파생
            stay = country.get("stay_months") or 0
            renewable = country.get("renewable", False)
            if stay >= 12 and renewable:
                ls_val = 10.0
            elif stay >= 6:
                ls_val = 7.0
            else:
                ls_val = 3.0
            score += ls_val * w

    normalized = score / total_weight  # normalize to 0–10
    scale = _BLOCK_C_PENALTY_SCALE.get(persona_type, _BLOCK_C_PENALTY_SCALE_DEFAULT)
    penalty = _city_dominance_penalty(city, ls, income_usd)
    normalized = max(0.0, normalized - penalty * scale)
    return min(10.0, normalized)


# ── Block D: 실용 조건 적합도 (20%) ─────────────────────────────

def _block_d(
    city: dict, country: dict, income_usd: float,
    travel_type: str, lifestyle: list[str], stay_style: str = "",
    children_ages: list[str] | None = None,
    timeline: str = "",
) -> float:
    """Practical conditions — visa access, language, companion needs."""
    ranges = _score_ranges or {}

    is_short_stay = timeline == "90일 단기 체험"

    # Visa accessibility (0–10)
    visa_type = country.get("visa_type", "")
    has_nomad_visa = bool(visa_type) and "없음" not in visa_type
    renewable = country.get("renewable", False)
    stay = country.get("stay_months") or 0

    if is_short_stay:
        # 단기 체류: 비자 조건이 사실상 무의미 — Block 가중치(D=0.10)로 이미 억제됨
        visa_score = 0.0
    else:
        visa_score = 0.0
        if has_nomad_visa:
            visa_score += 4.0
        if renewable:
            visa_score += 3.0
        visa_score += min(3.0, stay / 4.0)

        # stay_style adjustments
        if stay_style == "정착형" and renewable:
            visa_score = min(10.0, visa_score * 1.5)
        elif stay_style == "이동형" and has_nomad_visa:
            visa_score = min(10.0, visa_score * 1.5)

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
        safety = city.get("safety_score", 5)
        if is_short_stay:
            # 90일 단기: 갱신 불필요 — 안전 중심
            companion_score = safety
        else:
            # 장기: renewable visa + safety
            renew = 5.0 if renewable else 0.0
            companion_score = renew * 0.5 + safety * 0.5

    wellbeing = _wellbeing_proxy_breakdown(
        city=city,
        country=country,
        income_usd=income_usd,
        lifestyle=lifestyle,
        travel_type=travel_type,
    )
    wellbeing_score = wellbeing["total"]

    # Add wellbeing proxy for "실제 생활 만족도" approximation while preserving total block weight.
    raw = (
        visa_score * 0.30
        + lang_score * 0.20
        + companion_score * 0.25
        + wellbeing_score * 0.25
    )
    return min(10.0, max(0.0, raw))


def _wellbeing_proxy_breakdown(
    city: dict,
    country: dict,
    income_usd: float,
    lifestyle: list[str],
    travel_type: str,
) -> dict[str, float]:
    """0–10 wellbeing proxy with component breakdown."""
    ranges = _score_ranges or {}

    safety = _normalize(city.get("safety_score", 5), *ranges.get("safety_score", (4, 9)))
    affordability = _cost_score(city, income_usd)
    community = _COMMUNITY_SCORE.get(city.get("korean_community_size", ""), 0)
    nomad = _normalize(city.get("nomad_score", 5), *ranges.get("nomad_score", (5, 9)))
    english = _normalize(city.get("english_score", 5), *ranges.get("english_score", (4, 10)))

    # Baseline (solo / general)
    w_safety = 0.30
    w_aff = 0.35
    w_comm = 0.10
    w_nomad = 0.25
    w_english = 0.0

    # Family-oriented wellbeing puts more emphasis on safety and support environment.
    if "자녀" in travel_type or "가족" in travel_type:
        w_safety = 0.45
        w_aff = 0.30
        w_comm = 0.15
        w_nomad = 0.0
        w_english = 0.10

    # If user explicitly prefers English environment, reflect acculturation stress reduction.
    if "영어권 선호" in lifestyle:
        w_english = max(w_english, 0.10)
        w_nomad = max(0.0, w_nomad - 0.10)

    total_w = w_safety + w_aff + w_comm + w_nomad + w_english
    if total_w <= 0:
        total_w = 1.0

    score = (
        safety * w_safety
        + affordability * w_aff
        + community * w_comm
        + nomad * w_nomad
        + english * w_english
    ) / total_w

    # Lifestyle climate bump for beach seekers.
    if "해변" in lifestyle:
        climate = (city.get("climate") or "").lower()
        if climate in _BEACH_CLIMATES:
            score = min(10.0, score + 0.8)

    # Preference mismatch hurts expected satisfaction.
    score = max(0.0, score - (_lifestyle_miss_penalty(city, country, lifestyle) * 0.3))
    score = max(0.0, score - (_city_dominance_penalty(city, lifestyle, income_usd) * 0.25))
    score = max(0.0, score - (_high_income_low_cost_penalty(city, income_usd) * 0.5))

    # Lightweight penalty for stale visa metadata; uncertainty harms practical wellbeing.
    stale_penalty = 0.5 if _source_is_stale(country.get("data_verified_date")) else 0.0
    score = max(0.0, score - stale_penalty)

    total = min(10.0, max(0.0, score))
    return {
        "total": round(total, 3),
        "safety": round(safety, 3),
        "affordability": round(affordability, 3),
        "community": round(community, 3),
        "nomad_fit": round(nomad, 3),
        "english_env": round(english, 3),
        "stale_penalty": round(stale_penalty, 3),
    }


def _wellbeing_proxy_score(
    city: dict,
    country: dict,
    income_usd: float,
    lifestyle: list[str],
    travel_type: str,
) -> float:
    """Backward-compatible scalar wellbeing score."""
    return _wellbeing_proxy_breakdown(city, country, income_usd, lifestyle, travel_type)["total"]


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
    timeline: str = "",
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
        timeline=timeline,
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
    timeline: str = "",
) -> dict[str, float]:
    """4-Block composite score breakdown (0–10)."""
    ls = _normalize_lifestyle(lifestyle)
    a = _block_a(city, country, ls, income_usd)
    b = _block_b(city, country, income_usd, ls, tax_sensitivity, timeline)
    c = _block_c(city, country, persona_type, income_usd, ls)
    d = _block_d(city, country, income_usd, travel_type, ls, stay_style, children_ages, timeline)

    w_a, w_b, w_c, w_d = _get_block_weights(timeline)
    if not persona_type or persona_type not in _PERSONA_WEIGHTS:
        w_a += w_c
        w_c = 0.0
    total = round(min(10.0, max(0.0, a * w_a + b * w_b + c * w_c + d * w_d)), 1)
    return {
        "block_a": round(a * w_a, 3),
        "block_b": round(b * w_b, 3),
        "block_c": round(c * w_c, 3),
        "block_d": round(d * w_d, 3),
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
    country_floor = _country_income_floor_monthly_usd(country)
    effective_threshold = max(_SCHENGEN_LONG_STAY_INCOME_THRESHOLD, country_floor)
    return income_usd >= effective_threshold


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def recommend_from_db(user_profile: dict, top_n: int = 3, debug_mode: bool = False) -> dict:
    """Filter and rank cities from DB; return top-N with warnings."""
    countries_list, cities_list = _load_data()

    income_usd = float(user_profile.get("income_usd") or 0)
    effective_income_usd = float(user_profile.get("effective_income_usd") or income_usd)
    timeline_raw = user_profile.get("timeline", "")
    timeline   = _TIMELINE_ALIASES.get(timeline_raw, timeline_raw)
    lifestyle  = user_profile.get("lifestyle") or []
    lifestyle_norm = _normalize_lifestyle(lifestyle)
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

    def _collect_candidates(require_must_have: bool) -> list[tuple[float, dict, dict, dict[str, float]]]:
        rows: list[tuple[float, dict, dict, dict[str, float]]] = []
        for city in cities_list:
            cid = city.get("country_id", "")
            country = country_map.get(cid)
            if country is None:
                # City belongs to a country not in visa_db — skip
                continue

            # Hard filters
            if not _passes_income_filter(country, effective_income_usd):
                continue
            if not _passes_timeline_filter(country, timeline):
                continue
            if not _passes_continent_filter(cid, preferred):
                continue
            if not _passes_schengen_long_stay_filter(country, timeline, effective_income_usd):
                continue
            if require_must_have and not _passes_lifestyle_must_have(city, country, lifestyle_norm):
                continue

            breakdown = _compute_score_breakdown(
                city=city,
                country=country,
                income_usd=effective_income_usd,
                lifestyle=lifestyle_norm,
                persona_type=persona_type,
                travel_type=travel_type,
                stay_style=stay_style,
                tax_sensitivity=tax_sensitivity,
                children_ages=children_ages,
                timeline=timeline,
            )
            score = breakdown["total"]
            rows.append((score, city, country, breakdown))
        return rows

    must_have_active = any(p in _MUST_HAVE_LIFESTYLES for p in lifestyle_norm)
    candidates = _collect_candidates(require_must_have=must_have_active)
    must_have_relaxed = False
    if must_have_active and not candidates:
        # Safety valve: if strict must-have produces empty list, fall back to soft ranking.
        candidates = _collect_candidates(require_must_have=False)
        must_have_relaxed = True

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
        normalized_lifestyle = lifestyle_norm
        wellbeing_debug = _wellbeing_proxy_breakdown(
            city=city,
            country=country,
            income_usd=effective_income_usd,
            lifestyle=normalized_lifestyle,
            travel_type=travel_type,
        )
        reasons, city_warnings = _build_reasons_and_warnings(
            city=city,
            country=country,
            breakdown=breakdown,
            income_usd=effective_income_usd,
            timeline=timeline,
            lifestyle=normalized_lifestyle,
        )
        top_cities.append({
            "city":               city.get("city", ""),
            "city_kr":            city.get("city_kr", ""),
            "country":            city.get("country", ""),
            "country_id":         cid,
            "visa_type":          country.get("visa_type", ""),
            "visa_url":           "",   # app.py will fill via _inject_visa_urls()
            "monthly_cost_usd":   city.get("monthly_cost_usd", 0),
            "score":              score,
            "reasons":            reasons,
            "realistic_warnings": city_warnings,
            "plan_b_trigger":     is_schengen,
            "references":         _build_references(city, country),
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
            "visa_free_days":             country.get("visa_free_days", 0),
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
                "wellbeing": wellbeing_debug,
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

    if must_have_relaxed:
        if language == "English":
            warnings.append(
                "Some must-have lifestyle filters were relaxed to avoid empty results. "
                "Please tighten region or budget for stricter matches."
            )
        else:
            warnings.append(
                "일부 필수 라이프스타일 조건은 결과 0개를 피하기 위해 완화되었습니다. "
                "더 엄격한 매칭을 원하면 지역/예산 조건을 함께 좁혀주세요."
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
                "effective_income_usd": effective_income_usd,
                "timeline": timeline,
                "persona_type": persona_type,
                "travel_type": travel_type,
                "stay_style": stay_style,
                "tax_sensitivity": tax_sensitivity,
                "lifestyle": lifestyle_norm,
                "must_have_lifestyle_active": must_have_active,
                "must_have_lifestyle_relaxed": must_have_relaxed,
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
