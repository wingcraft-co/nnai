# Faceted Filter Tarot Card UI — Design Spec

## Overview

Replace the current static Gradio form with a fully custom HTML/CSS/JS interface rendered inside a single `gr.HTML` component. The new UI uses a faceted filter panel (left) and an animated tarot card selection area (right) to guide users through city discovery without any LLM calls during filtering. LLM is invoked only once after the user manually selects 3 cities.

---

## Architecture

**Approach:** `ui/layout_v2.py` — new file. `ui/layout.py` preserved for rollback.

- Gradio serves as a REST backend via `gr.Blocks`.
- All UI state and rendering handled by vanilla JS inside a `gr.HTML` component.
- JS calls Gradio via direct HTTP using named API endpoints (`/api/<name>`).
- `app.py` imports from `layout_v2` when `USE_NEW_UI=1`, falls back to `layout.py`.
- **Toggle dependency:** `USE_NEW_UI=1` requires `USE_DB_RECOMMENDER=1` — document in code comments.

**Tech stack:** Python + Gradio (`gr.Blocks`), vanilla JS (no framework), CSS `backdrop-filter`, CSS keyframe animations.

---

## Gradio Wiring

`layout_v2.py` builds a `gr.Blocks` layout. Use `api_name=` on `.click()` to enable stable named endpoints (Gradio 4.x):

```python
with gr.Blocks() as demo:
    ui_html = gr.HTML(build_ui_html())

    # Hidden components for API routing
    filter_input  = gr.Textbox(visible=False)
    filter_output = gr.Textbox(visible=False)
    step2_input   = gr.Textbox(visible=False)
    step2_output  = gr.Textbox(visible=False)

    filter_btn = gr.Button(visible=False)
    step2_btn  = gr.Button(visible=False)

    filter_btn.click(filter_cities,   inputs=filter_input,  outputs=filter_output, api_name="filter_cities")
    step2_btn.click(nomad_advisor_v2, inputs=step2_input,   outputs=step2_output,  api_name="nomad_advisor")
```

JS calls named endpoints. On local dev the base is `/`; on HF Spaces the Space is served under a subpath, so discover the base URL at init from `window.location`:

```js
// Determine base URL (local vs HF Spaces)
const BASE = window.location.pathname.replace(/\/$/, '');  // '' locally, '/space/user/name' on HF

async function gradioCall(apiName, payload) {
  const res = await fetch(`${BASE}/api/${apiName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [JSON.stringify(payload)] })
  });
  const { data } = await res.json();
  return JSON.parse(data[0]);
}
```

If this proves unreliable in the HF Spaces environment during integration testing, fall back to `/run/predict` with `fn_index` discovered from `GET ${BASE}/info`.

---

## Section 1 — Filter Layout

### Structure

13 input fields organized into 6 collapsible groups:

| Group | Fields |
|-------|--------|
| **나** | 국적 (dropdown), 복수국적 (checkbox) |
| **소득** | 월 소득 (range slider, 100~1000만원), 소득 증빙 형태 (chips: 급여명세서/사업자등록/무증빙) |
| **동반** | 동반 여부 (radio: 혼자/배우자/자녀포함), conditional: 배우자 소득 (slider), 자녀 연령대 (chips) |
| **목적 & 준비도** | 이민 목적 (dropdown: 절세/생활비절감/자녀교육/기타), 준비 단계 (radio: 탐색중/준비중/이동예정) |
| **체류 조건** | 체류 기간 (chips: 90일/6개월/1년/3년+), 선호 대륙 (chips: 아시아/유럽/중남미/기타) |
| **라이프스타일** | 라이프스타일 (multi-chips: 저물가/코워킹/안전/한인커뮤니티/자연/도시/비건/반려동물/의료, 9개), 언어 수준 (radio: 영어가능/현지어조금/한국어만) |

### Default values (B — pre-filled)

App loads with: `국적=KR`, `월소득=300만원`, `체류기간=1년`, `선호대륙=전체(아시아/유럽/중남미/기타)`, all others empty/default.

**Phase 3 banner on load:** Since 4 required fields are pre-filled, the selection banner appears after initial card animation (~1s). This is intentional.

### Profile JSON (JS → Python)

```json
{
  "nationality": "KR",
  "dual_nationality": false,
  "monthly_income_krw": 3000000,
  "income_proof": "무증빙",
  "companion_type": "혼자",
  "spouse_income_krw": null,
  "child_age_range": null,
  "immigration_purpose": "생활비절감",
  "preparation_stage": "탐색중",
  "timeline": "1년",
  "continents": ["아시아", "유럽", "중남미", "기타"],
  "lifestyle_tags": [],
  "language_level": "영어가능"
}
```

### filter_cities() — Python function contract

`filter_cities(profile_json: str) -> str` in `layout_v2.py` translates the JS profile format into what `recommend_from_db()` expects, then calls it:

```python
KRW_TO_USD = 1 / 1350.0  # fixed exchange rate for scoring purposes

def filter_cities(profile_json: str) -> str:
    import json
    profile = json.loads(profile_json)

    # Map JS field names → recommend_from_db() field names
    db_profile = {
        "income_usd":          (profile.get("monthly_income_krw") or 0) * KRW_TO_USD,
        "preferred_countries": profile.get("continents") or [],       # 아시아/유럽/...
        "lifestyle":           profile.get("lifestyle_tags") or [],
        "timeline":            profile.get("timeline", ""),
        "nationality":         "한국" if profile.get("nationality") == "KR" else profile.get("nationality", ""),
    }

    result = recommend_from_db(db_profile, top_n=8)   # see Backend Changes below
    disabled = compute_disabled_options(db_profile)    # new helper in recommender.py

    return json.dumps({
        "top_cities": result["top_cities"],
        "disabled_options": disabled
    }, ensure_ascii=False)
```

**Lifestyle tag mapping:** The JS chips (저물가/코워킹/안전/한인커뮤니티/...) must map to the keys in `_LIFESTYLE_MATCH` in `recommender.py` (`저비용 생활`, `코워킹스페이스 중시`, `안전 중시`, `한인 커뮤니티`, `영어권 선호`). Define a mapping dict in `layout_v2.py`:

```python
LIFESTYLE_TAG_MAP = {
    "저물가":    "저비용 생활",
    "코워킹":    "코워킹스페이스 중시",
    "안전":      "안전 중시",
    "한인커뮤니티": "한인 커뮤니티",
    "영어권":    "영어권 선호",
}
```

Tags not in the map are passed through as-is (forward-compatible).

**Timeline mapping:** JS chip values (`90일/6개월/1년/3년+`) must map to `_TIMELINE_FILTER` keys in `recommender.py`:

Add a `"6개월 단기 체험"` entry to `_TIMELINE_FILTER` in `recommender.py`:

```python
_TIMELINE_FILTER["6개월 단기 체험"] = (6, False)  # min 6 months stay, not renewable
```

Then map JS chips:

```python
TIMELINE_MAP = {
    "90일":  "90일 단기 체험",
    "6개월": "6개월 단기 체험",  # new bucket — requires recommender.py change
    "1년":   "1년 단기 체험",
    "3년+":  "3년 이상 장기 이민",
}
```

This is an additional required change to `recommender.py` (item 3 in backend changes below).

**Continent chip mapping:** The UI exposes 4 chips (`아시아/유럽/중남미/기타`). `_CONTINENT_TO_IDS` in `recommender.py` has keys `아시아`, `유럽`, `중남미`, `중동/아프리카`, `북미`. `"기타"` is not a key and would silently match nothing. Define a mapping in `layout_v2.py`:

```python
CONTINENT_MAP = {
    "아시아": "아시아",
    "유럽":   "유럽",
    "중남미": "중남미",
    "기타":   ["중동/아프리카", "북미"],  # expands to two keys
}
```

`filter_cities()` expands `"기타"` into `["중동/아프리카", "북미"]` before passing `preferred_countries` to `recommend_from_db()`. This makes cities in UAE, Morocco, Canada reachable via the `"기타"` chip.

### Backend changes required (recommender.py)

1. **Raise top-N cap from 3 to 8:** `recommend_from_db()` currently hard-breaks at `len(top_cities_raw) == 3` (line 212). Add `top_n: int = 3` parameter; existing callers (not passing `top_n`) keep the default behavior. `filter_cities()` passes `top_n=8`. The `filter_cities()` code in this spec shows `recommend_from_db(db_profile, top_n=8)` — this is post-modification code, not the current signature.

2. **Add `compute_disabled_options(db_profile: dict) -> dict`:** New function in `recommender.py`. For each filterable dimension, test which option values would yield `top_cities == []` when substituted into the current profile. Strategy: iterate the known option sets for `continents` (the 4 UI chips), `timeline` (4 chips), and `lifestyle_tags` (9 chips). For each candidate value, run the hard-filter pass only (skip scoring) to check if any city survives. Return values that kill all results.

   Performance: worst case ~17 quick filter passes per call (hard-filter only, no scoring, no JSON serialisation). Acceptable for ~50ms target; no caching required initially. Return JS chip label strings (reverse-mapped through `TIMELINE_MAP` / `LIFESTYLE_TAG_MAP`).

3. **Add `"6개월 단기 체험"` to `_TIMELINE_FILTER`:** `(6, False)` — min 6 months stay, not renewable. Required for the 6개월 chip to filter distinctly from 1년.

### filter_cities() response shape

```json
{
  "top_cities": [
    {
      "city": "Chiang Mai",
      "city_kr": "치앙마이",
      "country": "Thailand",
      "country_id": "TH",
      "score": 8.4,
      "monthly_cost_usd": 1200,
      "visa_type": "TR Visa"
    }
  ],
  "disabled_options": {
    "continents": ["유럽"],
    "timeline": ["3년+"],
    "lifestyle_tags": []
  }
}
```

Disabled option values use the exact JS chip label strings (e.g., `"유럽"`, `"3년+"`). `compute_disabled_options()` must return values in JS chip label format (reverse-map through the TIMELINE_MAP / LIFESTYLE_TAG_MAP).

### Faceted filter behavior

- Any filter change triggers `filter_cities()`.
- Chips in `disabled_options` render as: `opacity: 0.3`, `cursor: not-allowed`, `aria-disabled="true"`. De-selecting always allowed.
- Required fields for "selection complete": 국적, 월소득, 체류기간, 선호대륙(≥1).

### Loading state during filter_cities()

While a request is in flight, existing cards reduce to `opacity: 0.6` and a small spinner appears in the card area header. Cards do not disappear until new results arrive.

### Zero-results handling

If `top_cities` is empty: cards animate out, show "현재 조건에 맞는 도시가 없습니다. 필터를 조정해보세요." Selection prompt hidden.

### Card count

Returns 0–8 cities. Partial rows centered (`justify-content: center`). Desktop: 4 columns. Mobile: 2 columns.

### Visual design — iOS glass / pebble

- Background: `#f0f4f8`
- Panels: `background: rgba(255,255,255,0.72)`, `backdrop-filter: blur(20px)`, `border: 1px solid rgba(255,255,255,0.5)`, `border-radius: 20px`, `box-shadow: 0 4px 24px rgba(0,0,0,0.08)`
- Typography: `-apple-system, 'SF Pro Display', sans-serif`; Accent: `#7c3aed`
- Active chips: `background: rgba(124,58,237,0.12)`, `border-color: #7c3aed`
- **Dark mode (`prefers-color-scheme: dark`):** background `#0f0f1a`, panels `rgba(30,30,60,0.72)`, text `#e0e0f0`. Reference existing dark mode CSS in `layout.py`.

---

## Section 2 — Animation Flow

**Phase 1 — App load:** Panel slides in, cards appear with 0.08s stagger, floating begins (±4px sine loop). Phase 3 banner appears at ~1s.

**Phase 2 — Filter change:**
- Slider: 300ms debounce. In-flight requests cancelled via `AbortController` (last-write-wins).
- Chip: immediate, same cancellation.
- Entering: `translateY(16px)→0 + opacity 0→1`, 350ms, 0.08s stagger.
- Leaving: `scale→0.8 + opacity→0`, 250ms, simultaneous.

**Phase 3 — Selection ready:** Banner "✨ 운명의 도시를 3곳 골라주세요". Float ±4px → ±10px, speed ×1.2.

**Phase 4 — Card selection:**
- Tap: `scale(1→1.08→1)` spring, gold border glow 150ms. Re-tapping de-selects (toggle).
- Counter: "1/3 → 2/3 → 3/3".
- 3rd tap → auto-transition: 0.4s hold → non-selected fade (200ms) → selected 3 center (spring) → flip at 1.0s (0.3s stagger) → Step 2 button at 1.9s.

**Phase 5 — Flip:** `rotateY(0→180deg)`, 400ms, 0.3s stagger. Face at 90deg: flag, city name, monthly cost. **Hover before reveal: glow only, no name.**

**`prefers-reduced-motion`:** Disable all CSS animations and keyframes (floating, enter/exit, flip, glow pulse). State changes still apply instantly.

---

## Section 3 — Data Flow

### Race condition

```js
let currentFilterRequest = null;

async function onFilterChange() {
  if (currentFilterRequest) currentFilterRequest.abort();
  const controller = new AbortController();
  currentFilterRequest = controller;
  try {
    const res = await fetch('/api/filter_cities', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [JSON.stringify(state.filters)] })
    });
    const { data } = await res.json();
    const result = JSON.parse(data[0]);
    setState({ availableCities: result.top_cities, disabledOptions: result.disabled_options });
  } catch (e) {
    if (e.name === 'AbortError') return;
    setState({ filterError: true });
  } finally {
    if (currentFilterRequest === controller) currentFilterRequest = null;
  }
}
```

### Step 2 payload

**Request to `/api/nomad_advisor`:**
```json
{
  "profile": { "...all 13 JS profile fields..." },
  "selected_cities": ["치앙마이", "다낭", "멕시코시티"]
}
```

`nomad_advisor_v2(payload_json: str) -> str` parses this, maps profile fields via the same field-mapping logic as `filter_cities()`, injects `selected_cities` so the existing `nomad_advisor()` in `app.py` uses only those 3 cities. Returns the full detail JSON.

**Step 2 UI (detail phase):** During LLM call, show existing pixel globe overlay. On success, right panel transitions to Step 2 result view (3 city detail cards with visa type, budget, warnings, plan B) — reuse existing Step 2 rendering from `layout.py`. "처음으로" button resets `phase → 'filtering'`, clears `selectedCards`, restores filter+card layout without page reload.

### Error states

| Scenario | UI behavior |
|----------|-------------|
| `filter_cities()` network error | Toast: "연결 오류. 잠시 후 다시 시도해주세요." Cards stay at last valid state. |
| `filter_cities()` empty results | Empty-state message in card area. |
| `nomad_advisor()` error or timeout (>30s) | Error panel with retry button. |

### JS state

```js
let state = {
  filters: {
    nationality, dual_nationality, monthly_income_krw, income_proof,
    companion_type, spouse_income_krw, child_age_range,
    immigration_purpose, preparation_stage,
    timeline, continents, lifestyle_tags, language_level
  },
  availableCities: [],
  disabledOptions: {},
  selectedCards: [],      // city indices, max 3, toggle on re-tap
  phase: 'filtering',     // 'filtering' | 'selecting' | 'revealing' | 'detail'
  step2Loading: false,
  filterError: false
};
```

### Accessibility

- Chips/cards: `role="button"`, `tabindex="0"`, `aria-pressed`
- Counter: `aria-live="polite"`; Disabled chips: `aria-disabled="true"`
- After reveal: focus moves to Step 2 button

---

## Layout

```
+------------------------------------------+
|  Header (glassmorphism, sticky)           |
+------------------+-----------------------+
|  Left panel      |  Right panel          |
|  320-380px wide  |  Card area (flex-grow)|
|  6 filter groups |  0-8 floating cards   |
|  collapsible     |  4-col grid (desktop) |
|                  |  2-col grid (mobile)  |
+------------------+-----------------------+
```

**Mobile (`<768px`):** Filters collapse to sticky top bar with "필터" button → full-screen overlay. Card area fills viewport below. Float amplitude `±3px`.

---

## Implementation Order

**`recommender.py` must be modified before `layout_v2.py` is written.** `layout_v2.py` calls `recommend_from_db(..., top_n=8)` and `compute_disabled_options(...)` — both require the backend changes to exist first. Implement in this sequence:

1. Patch `recommender.py` (add `top_n` param + `compute_disabled_options`)
2. Write `ui/layout_v2.py`
3. Update `app.py` toggle

## File Changes

| File | Action | Notes |
|------|--------|-------|
| `recommender.py` | Modify first | (1) `top_n: int = 3` param, raise cap. (2) `compute_disabled_options()`. |
| `ui/layout_v2.py` | Create second | `gr.Blocks`, full HTML/CSS/JS, `filter_cities()`, `nomad_advisor_v2()`, field-mapping dicts |
| `app.py` | Modify last | `USE_NEW_UI` toggle; comment dependency on `USE_DB_RECOMMENDER=1` |
| `ui/layout.py` | Preserve | Rollback — do not touch |

---

## Out of Scope

- Mobile native app, persistence, user accounts
- More than 3 city selections
- Scoring logic changes beyond top-N cap
- Pagination, offline/PWA
