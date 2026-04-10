# Tarot Card UX — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TOP5 추천 + 2단계 reveal API로 백엔드 게이팅을 구현하여, 프론트엔드 타로카드 UX의 데이터 레이어를 제공한다.

**Architecture:** `/api/recommend`는 5장을 생성하되 도시 정보를 포함하지 않고 `session_id`만 반환한다. 유저가 3장을 선택하면 `/api/reveal`로 해당 3장의 상세 데이터를 요청한다. 세션은 서버 메모리(dict)에 임시 저장하며, 추후 DB 마이그레이션 가능.

**Tech Stack:** Python 3, FastAPI, pytest

**Spec:** `docs/superpowers/specs/2026-04-10-tarot-card-ux-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `server.py` | `/api/reveal` 엔드포인트 추가, RecommendRequest 수정 |
| `recommender.py` | `top_n` 기본값 5로 변경 |
| `app.py` | `nomad_advisor()` 응답 구조 변경 — 전체 5장 + session_id 반환 |
| `api/tarot_session.py` | **신규** — 세션 저장/조회/reveal 로직 |
| `tests/test_tarot_session.py` | **신규** — reveal API + 세션 테스트 |
| `prompts/system.py` | 타로 리더 톤 추가 (Step 2 프롬프트) |
| `prompts/system_en.py` | 타로 리더 톤 추가 (영어) |

---

### Task 1: 타로 세션 모듈 생성

**Files:**
- Create: `api/tarot_session.py`
- Create: `tests/test_tarot_session.py`

- [ ] **Step 1: 테스트 작성**

```python
# tests/test_tarot_session.py
"""타로 세션 저장/조회/reveal 테스트"""
import pytest
from api.tarot_session import create_session, get_session, reveal_cards


def test_create_session_returns_session_id():
    cities = [{"city": f"City{i}", "country_id": f"C{i}"} for i in range(5)]
    sid = create_session(cities)
    assert isinstance(sid, str)
    assert len(sid) > 8


def test_get_session_returns_stored_data():
    cities = [{"city": f"City{i}", "country_id": f"C{i}"} for i in range(5)]
    sid = create_session(cities)
    session = get_session(sid)
    assert session is not None
    assert len(session["cities"]) == 5
    assert session["revealed_indices"] is None


def test_reveal_cards_returns_selected_cities():
    cities = [{"city": f"City{i}", "score": i} for i in range(5)]
    sid = create_session(cities)
    revealed = reveal_cards(sid, [0, 2, 4])
    assert len(revealed) == 3
    assert revealed[0]["city"] == "City0"
    assert revealed[1]["city"] == "City2"
    assert revealed[2]["city"] == "City4"


def test_reveal_cards_stores_indices():
    cities = [{"city": f"City{i}"} for i in range(5)]
    sid = create_session(cities)
    reveal_cards(sid, [1, 3, 4])
    session = get_session(sid)
    assert session["revealed_indices"] == [1, 3, 4]


def test_reveal_cards_rejects_invalid_indices():
    cities = [{"city": f"City{i}"} for i in range(5)]
    sid = create_session(cities)
    with pytest.raises(ValueError):
        reveal_cards(sid, [0, 1, 5])  # index 5 out of range


def test_reveal_cards_rejects_wrong_count():
    cities = [{"city": f"City{i}"} for i in range(5)]
    sid = create_session(cities)
    with pytest.raises(ValueError):
        reveal_cards(sid, [0, 1])  # must be exactly 3


def test_reveal_cards_rejects_double_reveal():
    cities = [{"city": f"City{i}"} for i in range(5)]
    sid = create_session(cities)
    reveal_cards(sid, [0, 1, 2])
    with pytest.raises(ValueError):
        reveal_cards(sid, [0, 1, 2])  # already revealed


def test_get_session_returns_none_for_unknown():
    assert get_session("nonexistent") is None
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `SKIP_RAG_INIT=1 python3 -m pytest tests/test_tarot_session.py -v`
Expected: FAIL — `api.tarot_session` 모듈 없음

- [ ] **Step 3: 세션 모듈 구현**

```python
# api/tarot_session.py
"""타로 세션 — 5장 추천 결과의 서버사이드 저장 및 reveal 게이팅."""
from __future__ import annotations

import uuid
from typing import Any

# In-memory session store (추후 DB/Redis로 교체 가능)
_sessions: dict[str, dict[str, Any]] = {}


def create_session(cities: list[dict]) -> str:
    """5장 도시 데이터를 저장하고 session_id를 반환한다."""
    session_id = uuid.uuid4().hex[:16]
    _sessions[session_id] = {
        "cities": cities,
        "revealed_indices": None,
    }
    return session_id


def get_session(session_id: str) -> dict[str, Any] | None:
    """세션 데이터를 반환한다. 없으면 None."""
    return _sessions.get(session_id)


def reveal_cards(session_id: str, indices: list[int]) -> list[dict]:
    """선택된 3장의 인덱스를 받아 해당 도시 데이터를 반환한다."""
    session = _sessions.get(session_id)
    if session is None:
        raise ValueError("Session not found")
    if session["revealed_indices"] is not None:
        raise ValueError("Cards already revealed")
    if len(indices) != 3:
        raise ValueError("Must select exactly 3 cards")
    if any(i < 0 or i >= len(session["cities"]) for i in indices):
        raise ValueError("Invalid card index")

    session["revealed_indices"] = sorted(indices)
    return [session["cities"][i] for i in indices]
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `SKIP_RAG_INIT=1 python3 -m pytest tests/test_tarot_session.py -v`
Expected: 8/8 PASS

- [ ] **Step 5: Commit**

```bash
git add api/tarot_session.py tests/test_tarot_session.py
git commit -m "feat: add tarot session module for card reveal gating"
```

---

### Task 2: /api/recommend 응답 구조 변경 — 5장 + session_id

**Files:**
- Modify: `recommender.py` — `recommend_from_db()` 기본 `top_n` 3→5
- Modify: `server.py` — `api_recommend()` 응답에 session_id 추가, 도시 상세 데이터 제외

- [ ] **Step 1: recommender.py — top_n 기본값 변경**

`recommender.py`에서 `recommend_from_db()` 함수의 시그니처를 찾아 `top_n=3`을 `top_n=5`로 변경.

```python
# 변경 전
def recommend_from_db(user_profile: dict, top_n: int = 3, ...) -> dict:

# 변경 후
def recommend_from_db(user_profile: dict, top_n: int = 5, ...) -> dict:
```

- [ ] **Step 2: server.py — api_recommend 응답 변경**

`server.py`의 `api_recommend()` 함수를 수정:

```python
@app.post("/api/recommend")
async def api_recommend(req: RecommendRequest, request: Request):
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        persist_user_persona_type(user_id, req.persona_type)

    from app import nomad_advisor
    markdown, cities, parsed = nomad_advisor(
        nationality=req.nationality,
        income_krw=req.income_krw,
        immigration_purpose=req.immigration_purpose,
        lifestyle=req.lifestyle,
        languages=req.languages,
        timeline=req.timeline,
        preferred_countries=req.preferred_countries,
        preferred_language=req.preferred_language,
        persona_type=req.persona_type,
        income_type=req.income_type,
        travel_type=req.travel_type,
        children_ages=req.children_ages,
        dual_nationality=req.dual_nationality,
        readiness_stage=req.readiness_stage,
        has_spouse_income=req.has_spouse_income,
        spouse_income_krw=req.spouse_income_krw,
        stay_style=req.stay_style,
        tax_sensitivity=req.tax_sensitivity,
        total_budget_krw=req.total_budget_krw,
    )

    # 타로 세션: 5장 저장, 상세 데이터 미포함 응답
    from api.tarot_session import create_session
    session_id = create_session(cities)

    return {
        "session_id": session_id,
        "card_count": len(cities),
        "parsed": parsed,
    }
```

- [ ] **Step 3: 기존 테스트 업데이트**

`tests/test_recommender.py`에서 `top_n` 기본값이 5로 변경되었으므로, 기존 테스트 중 `len(result["top_cities"]) <= 3` 을 assert하는 테스트를 수정:

```python
# test_returns_at_most_3_cities → test_returns_at_most_5_cities
def test_returns_at_most_5_cities():
    result = recommend_from_db(_profile())
    assert len(result["top_cities"]) <= 5

# test_top_n_default_still_returns_3 → 수정
def test_top_n_default_returns_5():
    """Default top_n=5 keeps existing callers unchanged."""
    result = recommend_from_db(_profile(income_usd=3000))
    assert len(result["top_cities"]) <= 5
```

- [ ] **Step 4: 테스트 실행**

Run: `SKIP_RAG_INIT=1 python3 -m pytest tests/test_recommender.py tests/test_tarot_session.py -v`
Expected: 모든 테스트 PASS

- [ ] **Step 5: Commit**

```bash
git add recommender.py server.py tests/test_recommender.py
git commit -m "feat: change top_n default to 5, return session_id without city details"
```

---

### Task 3: /api/reveal 엔드포인트 추가

**Files:**
- Modify: `server.py` — `/api/reveal` 엔드포인트 추가

- [ ] **Step 1: 테스트 추가**

`tests/test_tarot_session.py` 끝에 API 레벨 테스트 추가:

```python
def test_reveal_endpoint_integration():
    """reveal API가 3장의 도시 데이터를 반환하는지 검증."""
    from api.tarot_session import create_session
    cities = [
        {"city": "Lisbon", "country_id": "PT", "monthly_cost_usd": 1800},
        {"city": "Bangkok", "country_id": "TH", "monthly_cost_usd": 1100},
        {"city": "Medellin", "country_id": "CO", "monthly_cost_usd": 1200},
        {"city": "Tbilisi", "country_id": "GE", "monthly_cost_usd": 900},
        {"city": "Budapest", "country_id": "HU", "monthly_cost_usd": 1500},
    ]
    sid = create_session(cities)
    revealed = reveal_cards(sid, [0, 2, 3])
    assert len(revealed) == 3
    assert revealed[0]["city"] == "Lisbon"
    assert revealed[1]["city"] == "Medellin"
    assert revealed[2]["city"] == "Tbilisi"
```

- [ ] **Step 2: server.py에 /api/reveal 추가**

`server.py`의 `/api/detail` 엔드포인트 위에 추가:

```python
class RevealRequest(BaseModel):
    session_id: str
    selected_indices: list[int]


@app.post("/api/reveal")
async def api_reveal(req: RevealRequest):
    from api.tarot_session import reveal_cards
    try:
        revealed = reveal_cards(req.session_id, req.selected_indices)
    except ValueError as e:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=400, content={"error": str(e)})
    return {"revealed_cities": revealed}
```

- [ ] **Step 3: 테스트 실행**

Run: `SKIP_RAG_INIT=1 python3 -m pytest tests/test_tarot_session.py -v`
Expected: 9/9 PASS

- [ ] **Step 4: Commit**

```bash
git add server.py tests/test_tarot_session.py
git commit -m "feat: add /api/reveal endpoint for tarot card gating"
```

---

### Task 4: LLM 프롬프트 타로 리더 톤 추가

**Files:**
- Modify: `prompts/system.py` — Step 2 프롬프트에 타로 리더 톤 지시 추가
- Modify: `prompts/system_en.py` — 영어 버전 동일 적용

- [ ] **Step 1: system.py 확인 후 톤 지시 추가**

`prompts/system.py`에서 Step 2 (도시 상세 가이드) 프롬프트를 찾아, 기존 지시문 앞에 톤 지시를 추가:

```python
# 기존 지시문 앞에 추가
TAROT_TONE_KR = """
당신은 타로 리더입니다.
유저가 선택한 도시 카드를 해석하듯, 따뜻하고 개인적인 톤으로 도시를 소개하세요.
도입부 1~2문장은 "이 카드가 당신을 선택했다"는 느낌으로 시작하세요.
예: "{도시} 카드가 당신을 선택했네요. 이 도시는..."
이후 비자, 예산, 세금, 생활 팁은 실용적이되, 조언하는 선배의 톤을 유지하세요.
"""
```

- [ ] **Step 2: system_en.py에도 동일 적용**

```python
TAROT_TONE_EN = """
You are a tarot reader.
Interpret the selected city card in a warm, personal tone.
Start with 1-2 sentences like "The {city} card has chosen you..."
Then provide practical visa, budget, tax, and lifestyle guidance in an advisory tone.
"""
```

- [ ] **Step 3: builder.py에서 프롬프트 조합 시 타로 톤 포함**

`prompts/builder.py`의 `build_detail_prompt()` 함수에서 시스템 프롬프트에 타로 톤을 prepend:

```python
# build_detail_prompt() 내부
system_prompt = TAROT_TONE_KR + existing_system_prompt  # 한국어
# 또는
system_prompt = TAROT_TONE_EN + existing_system_prompt  # 영어
```

언어 분기는 기존 `preferred_language` 파라미터 활용.

- [ ] **Step 4: Commit**

```bash
git add prompts/system.py prompts/system_en.py prompts/builder.py
git commit -m "feat: add tarot reader tone to Step 2 LLM prompt"
```

---

### Task 5: API 문서 동기화

**Files:**
- Modify: `cowork/backend/api-reference.md`

- [ ] **Step 1: /api/recommend 응답 구조 업데이트**

기존 응답 스키마를 세션 기반으로 변경:

```markdown
### POST /api/recommend — 응답 (변경됨)
```json
{
  "session_id": "abc123def456",
  "card_count": 5,
  "parsed": { ... }
}
```
> 도시 상세 데이터는 /api/reveal 호출 후 반환됨.
```

- [ ] **Step 2: /api/reveal 문서 추가**

```markdown
### POST /api/reveal (신규)

선택된 3장의 카드를 공개하고 도시 상세 데이터를 반환합니다.

요청:
```json
{
  "session_id": "abc123def456",
  "selected_indices": [0, 2, 4]
}
```

응답:
```json
{
  "revealed_cities": [
    { "city": "Lisbon", "country_id": "PT", ... },
    { "city": "Medellín", "country_id": "CO", ... },
    { "city": "Tbilisi", "country_id": "GE", ... }
  ]
}
```
```

- [ ] **Step 3: Commit**

```bash
git add cowork/backend/api-reference.md
git commit -m "docs: add /api/reveal to API reference, update /api/recommend response"
```
