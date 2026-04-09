# Block C Dominance Penalty Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `_block_c()`에 `_city_dominance_penalty`를 적용하여 라이프스타일 미지정 프로필에서 치앙마이 등 저비용+고nomad/cowork 도시가 반복 등장하는 문제를 제거한다.

**Architecture:** `recommender.py`의 `_block_c()` 시그니처에 `lifestyle` 파라미터를 추가하고, 페르소나별 스케일 상수(`_BLOCK_C_PENALTY_SCALE`)를 이용해 `_city_dominance_penalty`를 정규화 점수에서 차감한다. `_compute_score_breakdown()`에서 `lifestyle`을 전달하도록 한 줄 수정한다.

**Tech Stack:** Python 3, pytest (`SKIP_RAG_INIT=1`)

---

### Task 1: 회귀 테스트 작성 (실패 확인)

**Files:**
- Modify: `tests/test_recommender.py`

- [ ] **Step 1: 테스트 3개를 `test_recommender.py` 끝에 추가**

```python
def test_chiang_mai_not_in_top3_for_generic_mid_income_profile():
    """라이프스타일 미지정 중소득 프로필에서 치앙마이는 TOP 3에 등장하지 않아야 한다."""
    result = recommend_from_db(_profile(income_usd=3000, lifestyle=[], persona_type=""))
    top3_cities = [c["city"] for c in result["top_cities"]]
    assert "Chiang Mai" not in top3_cities, (
        f"치앙마이가 TOP 3에 등장함: {top3_cities}"
    )


def test_chiang_mai_can_appear_for_pioneer_low_cost_profile():
    """pioneer + 저비용 선호 프로필에서는 치앙마이가 TOP 5 안에 등장할 수 있어야 한다."""
    result = recommend_from_db(
        _profile(income_usd=2000, lifestyle=["저비용 생활"], persona_type="pioneer"),
        top_n=5,
    )
    top5_cities = [c["city"] for c in result["top_cities"]]
    assert "Chiang Mai" in top5_cities, (
        f"pioneer+저비용 프로필에서 치앙마이가 TOP 5에 없음: {top5_cities}"
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
```

- [ ] **Step 2: 테스트 실행하여 첫 번째 테스트가 실패하는지 확인**

```bash
SKIP_RAG_INIT=1 .venv/bin/pytest tests/test_recommender.py::test_chiang_mai_not_in_top3_for_generic_mid_income_profile -v
```

예상 결과: **FAILED** — `치앙마이가 TOP 3에 등장함: ['Amsterdam', 'Chiang Mai', 'Kuala Lumpur']`

- [ ] **Step 3: 커밋**

```bash
git add tests/test_recommender.py
git commit -m "test: add Chiang Mai dominance regression tests (currently failing)"
```

---

### Task 2: `_BLOCK_C_PENALTY_SCALE` 상수 추가

**Files:**
- Modify: `recommender.py:110` (상수 블록 끝, `_PERSONA_WEIGHTS` 정의 바로 아래)

- [ ] **Step 1: `_PERSONA_WEIGHTS` 딕셔너리(line ~110) 바로 아래에 상수 추가**

```python
# Block C penalty scale per persona — lower = gentler penalty on cheap+high-nomad cities
# pioneer explicitly weights cost_score, so penalty is already partially baked in.
_BLOCK_C_PENALTY_SCALE: dict[str, float] = {
    "pioneer":     0.25,
    "local":       0.40,
    "planner":     0.40,
    "wanderer":    0.60,
    "free_spirit": 0.60,
}
_BLOCK_C_PENALTY_SCALE_DEFAULT = 0.60  # no persona
```

- [ ] **Step 2: 저장 후 import 오류 없는지 확인**

```bash
SKIP_RAG_INIT=1 python -c "import recommender; print('ok')"
```

예상 결과: `ok`

---

### Task 3: `_block_c()` 수정 — lifestyle 파라미터 + penalty 적용

**Files:**
- Modify: `recommender.py:453-491`

- [ ] **Step 1: `_block_c()` 시그니처와 본문 교체**

현재 (line 453):
```python
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
```

변경 후:
```python
def _block_c(
    city: dict,
    country: dict,
    persona_type: str,
    income_usd: float,
    lifestyle: list[str] | None = None,
) -> float:
    """Persona-driven scoring — different personas value different attributes."""
    ranges = _score_ranges or {}
    ls = lifestyle or []

    if not persona_type or persona_type not in _PERSONA_WEIGHTS:
        # No persona: uniform average of key attributes
        normalized = (
            _normalize(city.get("nomad_score", 5),     *ranges.get("nomad_score",     (5, 9)))
            + _normalize(city.get("safety_score", 5),    *ranges.get("safety_score",    (4, 9)))
            + _normalize(city.get("coworking_score", 5), *ranges.get("coworking_score", (4, 9)))
        ) / 3.0
        penalty = _city_dominance_penalty(city, ls, income_usd)
        normalized = max(0.0, normalized - penalty * _BLOCK_C_PENALTY_SCALE_DEFAULT)
        return min(10.0, normalized) * 0.25

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
    scale = _BLOCK_C_PENALTY_SCALE.get(persona_type, _BLOCK_C_PENALTY_SCALE_DEFAULT)
    penalty = _city_dominance_penalty(city, ls, income_usd)
    normalized = max(0.0, normalized - penalty * scale)
    return min(10.0, normalized) * 0.25
```

- [ ] **Step 2: import 오류 없는지 확인**

```bash
SKIP_RAG_INIT=1 python -c "import recommender; print('ok')"
```

예상 결과: `ok`

---

### Task 4: `_compute_score_breakdown()` — lifestyle 전달

**Files:**
- Modify: `recommender.py:720-745`

- [ ] **Step 1: `_compute_score_breakdown()` 내 `_block_c` 호출 줄 수정**

현재 (line ~736):
```python
c = _block_c(city, country, persona_type, income_usd)
```

변경 후:
```python
c = _block_c(city, country, persona_type, income_usd, ls)
```

(`ls`는 같은 함수 내 line 733에서 이미 `ls = _normalize_lifestyle(lifestyle)`로 정의되어 있음)

- [ ] **Step 2: 확인**

```bash
SKIP_RAG_INIT=1 python -c "import recommender; print('ok')"
```

예상 결과: `ok`

---

### Task 5: 테스트 실행하여 통과 확인

**Files:** 없음 (실행만)

- [ ] **Step 1: 새로 추가한 3개 테스트 실행**

```bash
SKIP_RAG_INIT=1 .venv/bin/pytest tests/test_recommender.py::test_chiang_mai_not_in_top3_for_generic_mid_income_profile tests/test_recommender.py::test_chiang_mai_can_appear_for_pioneer_low_cost_profile tests/test_recommender.py::test_high_income_coworking_profile_unaffected -v
```

예상 결과: **3 passed**

- [ ] **Step 2: 전체 테스트 스위트 실행 (회귀 없는지 확인)**

```bash
SKIP_RAG_INIT=1 .venv/bin/pytest tests/test_recommender.py -v
```

예상 결과: 기존 테스트 포함 전체 통과. 실패하는 테스트가 있으면 수정 전 상태로 돌아가 원인 분석.

- [ ] **Step 3: 커밋**

```bash
git add recommender.py tests/test_recommender.py
git commit -m "fix: apply dominance penalty in Block C to prevent cheap+high-nomad city over-selection

- Add _BLOCK_C_PENALTY_SCALE constant (per-persona scale factors)
- _block_c() now accepts lifestyle param and applies _city_dominance_penalty
- pioneer persona uses 0.25x scale to preserve low-cost intent
- _compute_score_breakdown() passes lifestyle to _block_c"
```

---

## 자체 검토

**스펙 커버리지:**
- ✅ `_block_c()` 시그니처에 `lifestyle` 추가 (Task 3)
- ✅ `_BLOCK_C_PENALTY_SCALE` 페르소나별 상수 (Task 2)
- ✅ `_compute_score_breakdown()`에서 `ls` 전달 (Task 4)
- ✅ 회귀 테스트 3개 (Task 1)

**Placeholder 없음** ✅

**타입 일관성:**
- `_block_c()` 반환 `float` — Task 3 코드에서 유지 ✅
- `_city_dominance_penalty(city, ls, income_usd)` — 기존 시그니처 그대로 ✅
- `_BLOCK_C_PENALTY_SCALE_DEFAULT` — Task 2에서 정의, Task 3에서 사용 ✅
