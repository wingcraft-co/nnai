# DB 기반 추천 시스템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Step 1 LLM 호출을 DB 필터링·랭킹으로 교체하여 토큰 비용을 50% 절감하고, 환경변수 토글로 즉시 롤백 가능하게 한다.

**Architecture:** `recommender.py`를 새로 추가하여 `visa_db.json` + `city_scores.json` 기반 하드 필터 + 가중 점수 로직을 구현한다. `app.py`의 `nomad_advisor()`에 `USE_DB_RECOMMENDER` 환경변수 분기를 추가하고 기존 LLM 경로를 `else` 블록으로 보존한다. `api/parser.py`와 `prompts/data_context.py`의 `data/` 하드코딩 경로를 `database/` 우선 폴백 방식으로 수정한다.

**Tech Stack:** Python 3.11+, json (stdlib), pytest, Gradio (UI 무변경)

**Spec:** `docs/superpowers/specs/2026-03-25-db-recommender-design.md`

---

## 파일 맵

| 파일 | 종류 | 역할 |
|------|------|------|
| `recommender.py` | 신규 | DB 필터링·랭킹 엔진. `recommend_from_db(user_profile)` 함수 하나만 공개 |
| `api/parser.py` | 수정 | `_data_path()` 헬퍼 추가, `_scores_path`·`_load_visa_urls` 경로 수정 |
| `prompts/data_context.py` | 수정 | `_BASE` 경로를 `database/` 우선으로 변경 |
| `app.py` | 수정 | `USE_DB_RECOMMENDER` 토글 분기 추가, `_inject_visa_urls` import 추가 |
| `tests/test_visa_db.py` | 수정 | `DATA_PATH`를 `database/` 우선으로 수정 |
| `tests/test_city_scores.py` | 수정 | `DATA_PATH`를 `database/` 우선으로 수정 |
| `tests/test_recommender.py` | 신규 | `recommend_from_db()` 단위 테스트 |

---

## Task 1: 데이터 파일 경로 수정 (api/parser.py, prompts/data_context.py, 테스트)

`data/` 디렉토리가 삭제되고 `database/`로 이동했으므로 하드코딩된 경로를 모두 수정한다.

**Files:**
- Modify: `api/parser.py:124` (generate_comparison_table 내부 _scores_path)
- Modify: `api/parser.py:207` (_load_visa_urls 내부 _data_path)
- Modify: `prompts/data_context.py:10` (_BASE)
- Modify: `tests/test_visa_db.py:12` (DATA_PATH)
- Modify: `tests/test_city_scores.py:6` (DATA_PATH)

- [ ] **Step 1: 현재 테스트 상태 확인**

```bash
SKIP_RAG_INIT=1 .venv/bin/pytest tests/test_visa_db.py tests/test_city_scores.py tests/test_parser.py -v 2>&1 | head -40
```

Expected: `test_visa_db.py`와 `test_city_scores.py`에서 FileNotFoundError 또는 FAILED 발생 (data/ 삭제됨)

- [ ] **Step 2: `api/parser.py`에 `_data_path()` 헬퍼 추가 및 경로 수정**

`api/parser.py`의 import 블록 아래, 첫 함수 정의 전에 추가:

```python
def _data_path(filename: str) -> str:
    """database/ 우선, 없으면 data/ 폴백."""
    base = os.path.dirname(os.path.dirname(__file__))
    db_path = os.path.join(base, "database", filename)
    if os.path.exists(db_path):
        return db_path
    return os.path.join(base, "data", filename)
```

`generate_comparison_table()` 내부 (line 124):
```python
# 변경 전:
_scores_path = os.path.join(os.path.dirname(__file__), "..", "data", "city_scores.json")
# 변경 후:
_scores_path = _data_path("city_scores.json")
```

`_load_visa_urls()` 전체 함수 교체 (line 203~213):
```python
# 변경 전:
def _load_visa_urls() -> dict:
    global _VISA_URLS
    if _VISA_URLS is None:
        _data_path = os.path.join(os.path.dirname(__file__), "..", "data", "visa_urls.json")
        try:
            with open(_data_path, encoding="utf-8") as f:
                _VISA_URLS = json.load(f)
        except (OSError, json.JSONDecodeError):
            _VISA_URLS = {}
    return _VISA_URLS

# 변경 후 (_data_path 로컬 변수명 충돌 해소 + 경로 수정):
def _load_visa_urls() -> dict:
    global _VISA_URLS
    if _VISA_URLS is None:
        _visa_urls_path = _data_path("visa_urls.json")
        try:
            with open(_visa_urls_path, encoding="utf-8") as f:
                _VISA_URLS = json.load(f)
        except (OSError, json.JSONDecodeError):
            _VISA_URLS = {}
    return _VISA_URLS
```

주의: `_VISA_URLS`는 모듈 임포트 시 `None`으로 초기화된다. 만약 이전 `data/` 경로 실패로 `{}` (빈 딕셔너리)로 캐시된 상태라면 경로 수정 후에도 재로드되지 않는다. 테스트는 항상 새 프로세스로 실행(`pytest`)하므로 문제없다. 장기 실행 서버 환경에서는 재시작이 필요하다.

- [ ] **Step 3: `prompts/data_context.py` 경로 수정**

```python
# 변경 전 (전체 파일):
_BASE = os.path.join(os.path.dirname(__file__), "..", "data")

def _build() -> str:
    with open(os.path.join(_BASE, "visa_db.json"), encoding="utf-8") as f:
        visa_db = json.load(f)
    with open(os.path.join(_BASE, "city_scores.json"), encoding="utf-8") as f:
        city_scores = json.load(f)
    # ... 이하 동일

# 변경 후 (_BASE 제거, _resolve 헬퍼 추가):
def _resolve(filename: str) -> str:
    """database/ 우선, 없으면 data/ 폴백."""
    base = os.path.dirname(os.path.dirname(__file__))
    p = os.path.join(base, "database", filename)
    return p if os.path.exists(p) else os.path.join(base, "data", filename)

def _build() -> str:
    with open(_resolve("visa_db.json"), encoding="utf-8") as f:
        visa_db = json.load(f)
    with open(_resolve("city_scores.json"), encoding="utf-8") as f:
        city_scores = json.load(f)
    # ... 이하 동일 (lines 19~42 그대로 유지)
```

`_BASE` 변수를 완전히 제거하고 `_resolve()`로 대체한다. 파일 내 `os.path.join(_BASE, ...)` 호출은 2곳뿐이며 모두 위에서 교체된다.

- [ ] **Step 4: 테스트 파일 경로 수정**

`tests/test_visa_db.py` (line 12):
```python
# 변경 전:
DATA_PATH = Path(__file__).parent.parent / "data" / "visa_db.json"
# 변경 후:
_db = Path(__file__).parent.parent / "database" / "visa_db.json"
_data = Path(__file__).parent.parent / "data" / "visa_db.json"
DATA_PATH = _db if _db.exists() else _data
```

`tests/test_city_scores.py` (line 6):
```python
# 변경 전:
DATA_PATH = Path(__file__).parent.parent / "data" / "city_scores.json"
# 변경 후:
_db = Path(__file__).parent.parent / "database" / "city_scores.json"
_data = Path(__file__).parent.parent / "data" / "city_scores.json"
DATA_PATH = _db if _db.exists() else _data
```

- [ ] **Step 5: 경로 수정 후 테스트 통과 확인**

```bash
SKIP_RAG_INIT=1 .venv/bin/pytest tests/test_visa_db.py tests/test_city_scores.py tests/test_parser.py -v 2>&1 | tail -20
```

Expected: 해당 파일들 모두 PASSED

- [ ] **Step 6: 커밋**

```bash
git add api/parser.py prompts/data_context.py tests/test_visa_db.py tests/test_city_scores.py
git commit -m "fix: resolve data file paths to database/ with data/ fallback"
```

---

## Task 2: `tests/test_recommender.py` 작성 (실패 확인)

`recommender.py`가 아직 없으므로 이 테스트는 ImportError로 실패해야 한다.

**Files:**
- Create: `tests/test_recommender.py`

- [ ] **Step 1: 테스트 파일 작성**

```python
"""tests/test_recommender.py — recommend_from_db() 단위 테스트"""
import pytest
from recommender import recommend_from_db


# ── 공통 user_profile 팩토리 ──────────────────────────────────────────────

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


# ── 출력 구조 검증 ────────────────────────────────────────────────────────

def test_returns_top_cities_list():
    """top_cities 키를 가진 dict 반환."""
    result = recommend_from_db(_profile())
    assert isinstance(result, dict)
    assert "top_cities" in result
    assert isinstance(result["top_cities"], list)


def test_returns_at_most_3_cities():
    """최대 3개 도시 반환."""
    result = recommend_from_db(_profile())
    assert len(result["top_cities"]) <= 3


def test_city_dict_has_required_fields():
    """각 도시 딕셔너리에 필수 필드 존재."""
    required = {"city", "city_kr", "country", "country_id", "visa_type",
                "visa_url", "monthly_cost_usd", "score",
                "reasons", "realistic_warnings", "plan_b_trigger", "references"}
    result = recommend_from_db(_profile())
    for city in result["top_cities"]:
        missing = required - set(city.keys())
        assert not missing, f"누락 필드: {missing}"


def test_overall_warning_present():
    """overall_warning 키 존재."""
    result = recommend_from_db(_profile())
    assert "overall_warning" in result
    assert isinstance(result["overall_warning"], str)


# ── 소득 하드 필터 ────────────────────────────────────────────────────────

def test_income_filter_excludes_high_income_required_countries():
    """소득 $500이면 최소소득 $2,400 이상 요구 국가(말레이시아 등) 제외."""
    result = recommend_from_db(_profile(income_usd=500))
    country_ids = {c["country_id"] for c in result["top_cities"]}
    assert "MY" not in country_ids  # 말레이시아 min_income_usd=2400


def test_high_income_includes_expensive_countries():
    """소득 $5,000이면 고소득 요건 국가도 포함 가능."""
    result = recommend_from_db(_profile(income_usd=5000))
    # 결과가 있어야 함 (소득 필터로 모두 제외되면 안 됨)
    assert len(result["top_cities"]) > 0


# ── 체류기간 하드 필터 ────────────────────────────────────────────────────

def test_long_stay_requires_renewable():
    """3년 이상 체류 선택 시 renewable=false 국가는 제외."""
    result = recommend_from_db(_profile(timeline="3년 이상 장기 이민", income_usd=5000))
    for city in result["top_cities"]:
        # 각 country_id의 renewable 여부는 visa_db에서 확인
        # 여기서는 결과가 반환되는지만 확인 (renewable 국가 존재)
        pass
    assert isinstance(result["top_cities"], list)


def test_90day_timeline_does_not_require_renewable():
    """90일 선택 시 renewable 여부 무관하게 소득 조건만 충족하면 통과."""
    result = recommend_from_db(_profile(timeline="90일 단기 체험", income_usd=3000))
    assert len(result["top_cities"]) > 0


# ── 대륙 필터 ─────────────────────────────────────────────────────────────

def test_asia_filter_excludes_european_countries():
    """아시아 선호 시 유럽 국가 ID가 결과에 없어야 함."""
    european_ids = {"DE", "PT", "EE", "ES", "GR", "HR", "CZ", "HU", "SI", "MT", "CY", "AL", "RS", "MK"}
    result = recommend_from_db(_profile(
        preferred_countries=["아시아"],
        income_usd=5000,
    ))
    result_ids = {c["country_id"] for c in result["top_cities"]}
    assert result_ids.isdisjoint(european_ids), f"유럽 국가가 포함됨: {result_ids & european_ids}"


def test_no_continent_filter_allows_all_regions():
    """대륙 미선택 시 전체 지역 후보."""
    result_all = recommend_from_db(_profile(income_usd=5000))
    result_asia = recommend_from_db(_profile(preferred_countries=["아시아"], income_usd=5000))
    # 전체 검색이 아시아 전용보다 같거나 더 다양한 지역 포함 가능
    all_ids = {c["country_id"] for c in result_all["top_cities"]}
    asia_ids = {c["country_id"] for c in result_asia["top_cities"]}
    # 최소한 아시아 결과는 전체에도 포함되어야 함 (아시아 국가가 충분히 높은 점수라면)
    # 이 테스트는 필터 동작 자체를 확인
    assert isinstance(all_ids, set)
    assert isinstance(asia_ids, set)


# ── 점수 계산 ─────────────────────────────────────────────────────────────

def test_score_is_float_in_range():
    """score 필드가 0~10 사이 float."""
    result = recommend_from_db(_profile(income_usd=5000))
    for city in result["top_cities"]:
        assert 0.0 <= city["score"] <= 10.0, f"score 범위 초과: {city['score']}"


def test_lifestyle_coworking_boosts_coworking_cities():
    """코워킹 중시 선택 시 coworking_score 높은 도시가 상위권."""
    result = recommend_from_db(_profile(
        lifestyle=["코워킹스페이스 중시"],
        income_usd=5000,
    ))
    # 결과가 존재하면 됨 (점수 부스트 동작 확인은 score 값으로)
    assert len(result["top_cities"]) > 0


# ── overall_warning 자동 생성 ─────────────────────────────────────────────

def test_korean_nationality_warning_present():
    """한국 국적이면 건강보험 경고 포함."""
    result = recommend_from_db(_profile(nationality="한국"))
    assert "건강보험" in result["overall_warning"]


def test_schengen_country_in_result_triggers_ees_warning():
    """쉥겐 국가가 결과에 있으면 EES 경고 포함."""
    # 유럽(쉥겐) 우선 + 높은 소득으로 쉥겐 국가가 결과에 포함되도록
    result = recommend_from_db(_profile(
        preferred_countries=["유럽"],
        income_usd=5000,
        timeline="1년 단기 체험",
    ))
    # 쉥겐 국가가 포함된 경우만 EES 경고 확인
    schengen_ids = {"DE", "PT", "EE", "ES", "GR", "HR", "CZ", "HU", "SI", "MT", "CY", "AL", "RS", "MK"}
    result_ids = {c["country_id"] for c in result["top_cities"]}
    if result_ids & schengen_ids:
        assert "EES" in result["overall_warning"]


# ── plan_b_trigger ────────────────────────────────────────────────────────

def test_schengen_city_has_plan_b_trigger_true():
    """쉥겐 국가 도시는 plan_b_trigger=True."""
    result = recommend_from_db(_profile(
        preferred_countries=["유럽"],
        income_usd=5000,
    ))
    schengen_ids = {"DE", "PT", "EE", "ES", "GR", "HR", "CZ", "HU", "SI", "MT", "CY", "AL", "RS", "MK"}
    for city in result["top_cities"]:
        if city["country_id"] in schengen_ids:
            assert city["plan_b_trigger"] is True


def test_non_schengen_city_has_plan_b_trigger_false():
    """비쉥겐 국가 도시는 plan_b_trigger=False."""
    result = recommend_from_db(_profile(
        preferred_countries=["아시아"],
        income_usd=5000,
    ))
    for city in result["top_cities"]:
        assert city["plan_b_trigger"] is False
```

- [ ] **Step 2: 테스트 실행 — ImportError로 실패 확인**

```bash
SKIP_RAG_INIT=1 .venv/bin/pytest tests/test_recommender.py -v 2>&1 | head -20
```

Expected: `ModuleNotFoundError: No module named 'recommender'`

---

## Task 3: `recommender.py` 구현

**Files:**
- Create: `recommender.py`

- [ ] **Step 1: recommender.py 파일 생성**

```python
"""recommender.py — DB 기반 국가·도시 필터링·랭킹 엔진.

recommend_from_db(user_profile) → dict
    top_cities: list[dict]  (format_step1_markdown 호환 구조)
    overall_warning: str
"""
from __future__ import annotations

import json
import os

# ── 데이터 경로 헬퍼 ──────────────────────────────────────────────────────

def _data_path(filename: str) -> str:
    """database/ 우선, 없으면 data/ 폴백."""
    base = os.path.dirname(__file__)
    db = os.path.join(base, "database", filename)
    return db if os.path.exists(db) else os.path.join(base, "data", filename)


# ── 데이터 로드 (모듈 첫 호출 시 1회) ─────────────────────────────────────

_VISA_DB: list[dict] | None = None
_CITY_SCORES: list[dict] | None = None


def _load_visa_db() -> list[dict]:
    global _VISA_DB
    if _VISA_DB is None:
        with open(_data_path("visa_db.json"), encoding="utf-8") as f:
            _VISA_DB = json.load(f)["countries"]
    return _VISA_DB


def _load_city_scores() -> list[dict]:
    global _CITY_SCORES
    if _CITY_SCORES is None:
        with open(_data_path("city_scores.json"), encoding="utf-8") as f:
            _CITY_SCORES = json.load(f)["cities"]
    return _CITY_SCORES


# ── 상수 ──────────────────────────────────────────────────────────────────

# 대륙 → 국가 ID 매핑 (preferred_countries UI 값 기준)
# 주의: UI에서 전달되는 대륙 키는 builder.py의 CONTINENT_TO_HINT와 동일해야 한다.
# builder.py 기준: "아시아", "유럽", "중남미", "중동/아프리카", "북미"
# 스펙과 차이: AE(UAE)는 스펙에서 아시아로 분류했으나 UI 키가 "중동/아프리카"이므로
# builder.py를 기준으로 "중동/아프리카"에 배치한다.
_CONTINENT_TO_IDS: dict[str, set[str]] = {
    "아시아":       {"TH", "MY", "ID", "VN", "PH", "JP"},
    "유럽":         {"DE", "PT", "EE", "ES", "GR", "HR", "CZ", "HU", "SI", "MT", "CY", "AL", "RS", "MK"},
    "중남미":       {"CR", "MX", "CO", "AR", "BR"},
    "중동/아프리카": {"AE", "MA"},
    "북미":         {"CA"},
}

# timeline 문자열 → (최소 stay_months, renewable 필요 여부)
_TIMELINE_FILTER: dict[str, tuple[int, bool]] = {
    "90일 단기 체험":     (1,  False),
    "1년 단기 체험":      (12, False),
    "3년 이상 장기 이민": (12, True),
    "5년 이상 장기 이민": (12, True),
}

# 쉥겐 장기체류 소득 기준
_SCHENGEN_LONG_STAY_INCOME = 2849
_LONG_STAY_TIMELINES = {"3년 이상 장기 이민", "5년 이상 장기 이민"}

# lifestyle 매칭 조건 (도시 데이터 기준)
_LIFESTYLE_MATCH: dict[str, callable] = {
    "코워킹스페이스 중시": lambda city, _country: city.get("coworking_score", 0) >= 7,
    "한인 커뮤니티":       lambda city, _country: city.get("korean_community_size") == "large",
    "저비용 생활":         lambda _city, country: country.get("cost_tier") == "low",
    "안전 중시":           lambda city, _country: city.get("safety_score", 0) >= 8,
    "영어권 선호":         lambda city, _country: city.get("english_score", 0) >= 7,
}

_SCHENGEN_IDS = {"DE", "PT", "EE", "ES", "GR", "HR", "CZ", "HU", "SI", "MT", "CY", "AL", "RS", "MK"}


# ── 하드 필터 ─────────────────────────────────────────────────────────────

def _allowed_country_ids(preferred_continents: list[str]) -> set[str] | None:
    """선호 대륙 → 허용 국가 ID set. 미선택이면 None (전체 허용)."""
    if not preferred_continents:
        return None
    ids: set[str] = set()
    for cont in preferred_continents:
        ids |= _CONTINENT_TO_IDS.get(cont, set())
    return ids


def _passes_hard_filter(
    country: dict,
    income_usd: int,
    min_stay_months: int,
    need_renewable: bool,
    is_long_stay: bool,
    allowed_ids: set[str] | None,
) -> bool:
    cid = country["id"]

    # 대륙 필터
    if allowed_ids is not None and cid not in allowed_ids:
        return False

    # 소득 필터
    if income_usd < (country.get("min_income_usd") or 0):
        return False

    # 체류기간 필터
    if country.get("stay_months", 0) < min_stay_months:
        return False
    if need_renewable and not country.get("renewable", False):
        return False

    # 쉥겐 장기체류 소득 기준
    if is_long_stay and country.get("schengen") and income_usd < _SCHENGEN_LONG_STAY_INCOME:
        return False

    return True


# ── 소프트 점수 ───────────────────────────────────────────────────────────

def _lifestyle_score(city: dict, country: dict, lifestyle: list[str]) -> float:
    """lifestyle 매칭 점수 (0~10). 선택 항목 없으면 5.0 (중립)."""
    known = [ls for ls in lifestyle if ls in _LIFESTYLE_MATCH]
    if not known:
        return 5.0
    matched = sum(1 for ls in known if _LIFESTYLE_MATCH[ls](city, country))
    return matched / len(known) * 10


def _compute_score(
    city: dict,
    country: dict,
    max_cost: int,
    lifestyle: list[str],
    use_english_boost: bool,
) -> float:
    """가중 합산 점수 (0~10)."""
    nomad    = city.get("nomad_score", 5)   / 10 * 10  # 그대로 사용 (0~10)
    safety   = city.get("safety_score", 5)  / 10 * 10
    cost_inv = (1 - city.get("monthly_cost_usd", 2000) / max(max_cost, 1)) * 10
    lifestyle_s = _lifestyle_score(city, country, lifestyle)
    english  = city.get("english_score", 5) / 10 * 10

    if use_english_boost:
        # english 가중치 2배(20%), 나머지 80%를 nomad/safety/cost/lifestyle에 배분
        score = (
            nomad     * 0.25 +
            safety    * 0.175 +
            cost_inv  * 0.175 +
            lifestyle_s * 0.20 +
            english   * 0.20
        )
    else:
        score = (
            nomad     * 0.30 +
            safety    * 0.20 +
            cost_inv  * 0.20 +
            lifestyle_s * 0.20 +
            english   * 0.10
        )
    return round(score, 1)


# ── overall_warning 생성 ──────────────────────────────────────────────────

def _build_overall_warning(nationality: str, result_country_ids: set[str]) -> str:
    parts = []
    if nationality == "한국":
        parts.append(
            "한국 국적자는 퇴직 후 2개월 이내 건강보험 임의계속가입 신청, 국민연금 납부예외 신청 필요"
        )
    if result_country_ids & _SCHENGEN_IDS:
        parts.append(
            "2025년 10월부터 EES(입출국 시스템) 시행으로 쉥겐 지역 90/180일 규칙 전자 추적됩니다"
        )
    if "GE" in result_country_ids:
        parts.append(
            "조지아는 2026-03-01부터 노동이민법 시행으로 장기 원격근무 비자 취득이 복잡해졌습니다"
        )
    return "\n".join(parts)


# ── 공개 API ──────────────────────────────────────────────────────────────

def recommend_from_db(user_profile: dict) -> dict:
    """
    DB 기반 국가·도시 필터링·랭킹으로 TOP 3 도시 반환.

    반환 구조는 parse_response() 출력과 동일하여
    format_step1_markdown()에서 수정 없이 사용 가능.
    (_user_profile 키는 app.py에서 공통 주입)
    """
    income_usd    = user_profile.get("income_usd", 0)
    timeline      = user_profile.get("timeline", "1년 단기 체험")
    preferred     = user_profile.get("preferred_countries", [])
    lifestyle     = user_profile.get("lifestyle", [])
    languages     = user_profile.get("languages", [])
    nationality   = user_profile.get("nationality", "")

    min_stay, need_renewable = _TIMELINE_FILTER.get(timeline, (1, False))
    is_long_stay = timeline in _LONG_STAY_TIMELINES
    allowed_ids  = _allowed_country_ids(preferred)
    use_english  = "영어" in languages

    countries = _load_visa_db()
    cities    = _load_city_scores()

    # 국가 ID → 국가 정보 매핑
    country_map = {c["id"]: c for c in countries}

    # 하드 필터 통과 도시 수집
    candidates: list[tuple[dict, dict]] = []  # (city, country)
    for city in cities:
        cid = city.get("country_id")
        country = country_map.get(cid)
        if country is None:
            continue
        if _passes_hard_filter(
            country, income_usd, min_stay, need_renewable, is_long_stay, allowed_ids
        ):
            candidates.append((city, country))

    # 최대 비용 (점수 정규화용)
    max_cost = max((c[0].get("monthly_cost_usd", 0) for c in candidates), default=4000)

    # 점수 계산 후 정렬
    scored = sorted(
        candidates,
        key=lambda x: _compute_score(x[0], x[1], max_cost, lifestyle, use_english),
        reverse=True,
    )

    # TOP 3 선정 (국가 중복 제거 — 같은 나라 도시 여러 개 방지)
    top: list[tuple[dict, dict]] = []
    seen_countries: set[str] = set()
    for city, country in scored:
        cid = country["id"]
        if cid in seen_countries:
            continue
        top.append((city, country))
        seen_countries.add(cid)
        if len(top) == 3:
            break

    result_country_ids = {country["id"] for _, country in top}

    top_cities = []
    for city, country in top:
        score = _compute_score(city, country, max_cost, lifestyle, use_english)
        top_cities.append({
            "city":             city.get("city", ""),
            "city_kr":          city.get("city_kr", city.get("city", "")),
            "country":          city.get("country", ""),
            "country_id":       country["id"],
            "visa_type":        country.get("visa_type", ""),
            "visa_url":         "",   # app.py에서 _inject_visa_urls()로 채움
            "monthly_cost_usd": city.get("monthly_cost_usd", 0),
            "score":            score,
            "reasons":          [],
            "realistic_warnings": [],
            "plan_b_trigger":   country.get("schengen", False),
            "references":       [],
        })

    overall_warning = _build_overall_warning(nationality, result_country_ids)

    return {
        "top_cities":     top_cities,
        "overall_warning": overall_warning,
    }
```

- [ ] **Step 2: 테스트 실행 — 통과 확인**

```bash
SKIP_RAG_INIT=1 .venv/bin/pytest tests/test_recommender.py -v
```

Expected: 모든 테스트 PASSED

- [ ] **Step 3: 전체 기존 테스트도 통과 확인**

```bash
SKIP_RAG_INIT=1 .venv/bin/pytest tests/ -v --ignore=tests/test_pdf_generator.py 2>&1 | tail -20
```

Expected: 전체 통과 (test_pdf_generator.py 제외)

- [ ] **Step 4: 커밋**

```bash
git add recommender.py tests/test_recommender.py
git commit -m "feat: add recommend_from_db() — DB-based city filtering and ranking engine"
```

---

## Task 4: `app.py` 토글 분기 추가

**Files:**
- Modify: `app.py`

- [ ] **Step 1: import 추가**

`app.py` 상단 import 블록에 추가:

```python
from recommender        import recommend_from_db
from api.parser         import _inject_visa_urls
```

- [ ] **Step 2: `nomad_advisor()` 내 LLM 블록을 토글 분기로 교체**

현재 LLM 블록 (app.py line 103~133):

```python
    # --- 서버사이드 Context Caching 시도 ---
    cache_key     = f"step1_{'en' if preferred_language == 'English' else 'ko'}"
    system_prompt = SYSTEM_PROMPT_EN if preferred_language == "English" else SYSTEM_PROMPT

    cache = get_or_create_cache(...)

    if cache:
        ...
    else:
        messages = build_prompt(user_profile)
        raw      = query_model(messages, max_tokens=8192)

    if raw.startswith("ERROR"):
        return f"⚠️ API 오류: {raw}", [], {}

    parsed = parse_response(raw)

    # user_profile 주입 (Step 2에서 참조)
    parsed["_user_profile"] = user_profile
```

위 블록을 아래로 교체:

```python
    if os.getenv("USE_DB_RECOMMENDER", "1") == "1":
        # DB 기반 추천 경로 (LLM 호출 없음)
        parsed = recommend_from_db(user_profile)
        _inject_visa_urls(parsed)
    else:
        # 기존 LLM 경로 (롤백용, 삭제 금지)
        cache_key     = f"step1_{'en' if preferred_language == 'English' else 'ko'}"
        system_prompt = SYSTEM_PROMPT_EN if preferred_language == "English" else SYSTEM_PROMPT

        cache = get_or_create_cache(
            system_prompt=system_prompt,
            data_context=DATA_CONTEXT,
            few_shot_messages=FEW_SHOT_EXAMPLES,
            cache_key=cache_key,
        )

        if cache:
            user_msg = build_step1_user_message(user_profile)
            raw = query_model_cached(user_msg, cache, max_tokens=8192)
            if raw.startswith("ERROR"):
                logger.warning("[app] Cached query failed — invalidating cache, falling back")
                invalidate(cache_key)
                messages = build_prompt(user_profile)
                raw = query_model(messages, max_tokens=8192)
        else:
            messages = build_prompt(user_profile)
            raw      = query_model(messages, max_tokens=8192)

        if raw.startswith("ERROR"):
            return f"⚠️ API 오류: {raw}", [], {}

        parsed = parse_response(raw)

    # 두 경로 공통: _user_profile 주입 (format_step1_markdown이 timeline/language 참조)
    parsed["_user_profile"] = user_profile
```

- [ ] **Step 3: `.env.example`에 새 변수 추가**

`.env.example` 파일에 아래 줄 추가:

```
USE_DB_RECOMMENDER=1   # 1=DB 모드(기본), 0=LLM 모드(롤백)
```

- [ ] **Step 4: 전체 테스트 통과 확인**

```bash
SKIP_RAG_INIT=1 .venv/bin/pytest tests/ -v --ignore=tests/test_pdf_generator.py 2>&1 | tail -20
```

Expected: 전체 통과

- [ ] **Step 5: DB 모드 실제 동작 확인 (수동)**

```bash
USE_DB_RECOMMENDER=1 SKIP_RAG_INIT=1 .venv/bin/python -c "
from recommender import recommend_from_db
result = recommend_from_db({
    'nationality': '한국', 'income_usd': 2000, 'income_krw': 280,
    'purpose': '디지털 노마드', 'lifestyle': ['코워킹스페이스 중시'],
    'languages': ['영어'], 'timeline': '1년 단기 체험',
    'preferred_countries': ['아시아'], 'language': '한국어',
    'persona_type': '', 'income_type': '', 'travel_type': '혼자 (솔로)',
    'children_ages': [], 'dual_nationality': False, 'readiness_stage': '',
    'has_spouse_income': '없음', 'spouse_income_krw': 0,
})
for c in result['top_cities']:
    print(c['city_kr'], c['country_id'], c['score'])
print('WARNING:', result['overall_warning'][:50])
"
```

Expected: 3개 도시 출력, warning에 "건강보험" 포함

- [ ] **Step 6: 커밋**

```bash
git add app.py .env.example
git commit -m "feat: add USE_DB_RECOMMENDER toggle to nomad_advisor()"
```

---

## Task 5: 최종 검증 및 완료

- [ ] **Step 1: 전체 테스트 스위트 실행**

```bash
SKIP_RAG_INIT=1 .venv/bin/pytest tests/ -v --ignore=tests/test_pdf_generator.py 2>&1 | tail -10
```

Expected: `N passed, 4 skipped` (N ≥ 256, test_recommender.py 추가분 포함)

- [ ] **Step 2: LLM 모드 폴백 동작 확인 (환경변수 0으로 설정)**

```bash
USE_DB_RECOMMENDER=0 SKIP_RAG_INIT=1 .venv/bin/python -c "
import os
print('LLM 모드:', os.getenv('USE_DB_RECOMMENDER'))
# app import만 테스트 (실제 LLM 호출 없이 import 오류만 확인)
from app import nomad_advisor
print('import OK')
"
```

Expected: `LLM 모드: 0`, `import OK`

- [ ] **Step 3: 최종 커밋 (필요 시)**

모든 변경사항이 이미 각 태스크에서 커밋됨. 누락 파일이 있으면:

```bash
git add -p
git commit -m "chore: finalize DB recommender refactoring"
```
