# Loading Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen pixel-art loading overlay (spinning Earth globe + walking ㅅ character) that appears whenever the AI is processing a request.

**Architecture:** A new `ui/loading.py` module exports `get_loading_html(message)` which returns a self-contained HTML string with inline CSS + JS canvas animation. `ui/layout.py` adds a `gr.HTML` overlay component and updates the two generator functions (`run_step1`, `run_step2`) to yield the overlay HTML on start and clear it on finish.

**Tech Stack:** Python, Gradio 4.x, vanilla JS Canvas API (no external dependencies)

**Spec:** `docs/superpowers/specs/2026-03-20-loading-component-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `ui/loading.py` | `get_loading_html(message)` + `LOADING_CLEAR` constant + full canvas animation HTML |
| Modify | `ui/layout.py:203` | Inside `gr.Blocks()`, add `loading_overlay = gr.HTML(...)` as first child (after opening line) |
| Modify | `ui/layout.py:430–466` | Update `run_step1` yields (5-tuple → 6-tuple) + outputs list |
| Modify | `ui/layout.py:514–531` | Update `run_step2` yields (bare string → 2-tuple) + outputs list |
| Modify | `tests/test_ui.py` | Add tests for `get_loading_html` and overlay presence in layout |

---

## Task 1: Create `ui/loading.py`

**Files:**
- Create: `ui/loading.py`
- Test: `tests/test_ui.py` (append to existing file)

- [ ] **Step 1.1: Write failing tests** — append to `tests/test_ui.py`

```python
# ── Loading overlay tests ──────────────────────────────────────────────────────

def test_loading_clear_is_empty_string():
    from ui.loading import LOADING_CLEAR
    assert LOADING_CLEAR == ""

def test_get_loading_html_returns_string():
    from ui.loading import get_loading_html
    assert isinstance(get_loading_html("테스트"), str)

def test_get_loading_html_contains_message():
    from ui.loading import get_loading_html
    html = get_loading_html("🔍 분석 중...")
    assert "🔍 분석 중..." in html

def test_get_loading_html_has_fixed_overlay():
    from ui.loading import get_loading_html
    html = get_loading_html("test")
    assert "position:fixed" in html
    assert "z-index:9999" in html
    assert "backdrop-filter" in html

def test_get_loading_html_has_canvas():
    from ui.loading import get_loading_html
    html = get_loading_html("test")
    assert 'id="nnai-globe-canvas"' in html
    assert 'width="88"' in html
    assert 'height="108"' in html

def test_get_loading_html_has_raf_guard():
    from ui.loading import get_loading_html
    html = get_loading_html("test")
    assert "__nnaiRAF" in html
    assert "cancelAnimationFrame" in html

def test_get_loading_html_has_canvas_connected_check():
    from ui.loading import get_loading_html
    html = get_loading_html("test")
    assert "isConnected" in html

def test_get_loading_html_different_messages_are_independent():
    from ui.loading import get_loading_html
    html1 = get_loading_html("메시지1")
    html2 = get_loading_html("메시지2")
    assert "메시지1" in html1
    assert "메시지2" in html2
    assert "메시지1" not in html2
```

- [ ] **Step 1.2: Run tests to verify they fail**

```bash
cd /Users/yoroji/Documents/hackathon/nnai
python3 -m pytest tests/test_ui.py::test_loading_clear_is_empty_string tests/test_ui.py::test_get_loading_html_returns_string -v
```

Expected: `ModuleNotFoundError: No module named 'ui.loading'`

- [ ] **Step 1.3: Create `ui/loading.py`**

```python
# ui/loading.py
"""
Loading overlay component for NomadNavigator AI.

Exports:
    get_loading_html(message) -> str   Full-screen overlay HTML with canvas animation
    LOADING_CLEAR               str   Empty string — clears the overlay when yielded to gr.HTML
"""

LOADING_CLEAR = ""

# Animation script kept as a separate constant so get_loading_html can use
# plain string concatenation, avoiding f-string brace-escaping issues with JS.
#
# Key safety features:
#   window.__nnaiRAF guard  — cancels previous RAF loop before starting a new one,
#                             preventing duplicate loops when Gradio re-executes the
#                             <script> tag on each intermediate loading yield.
#   canvas.isConnected check — auto-stops the loop when Gradio clears the gr.HTML
#                              component (sets innerHTML to ""), which detaches the
#                              canvas from the DOM.
_ANIM_SCRIPT = """<script>
(function(){
if(window.__nnaiRAF)cancelAnimationFrame(window.__nnaiRAF);

/* World map: 24 cols x 12 rows  (1=land, 0=ocean)
   col 0 = -180 deg lon, col 23 = +165 deg lon, each col ~15 deg
   row 0 = 75-90 deg N,  row 11 = 75-90 deg S,  each row ~15 deg */
var W=[
  [0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0],
  [1,1,0,0,0,0,0,0,0,0,1,1,1,0,1,1,1,1,1,1,1,1,0,0],
  [1,1,0,1,1,1,1,1,1,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,0,0,0,0,1,1,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,0,0,1,0,0,0,1,1,1,1,1,0,1,1,1,1,0,0,0],
  [0,0,0,0,0,0,0,0,1,1,1,0,0,1,1,1,0,0,0,1,1,0,0,0],
  [0,0,0,0,0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0,1,1,0,0],
  [0,0,0,0,0,0,0,0,0,1,1,0,0,0,1,0,0,0,0,0,1,1,0,0],
  [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
];
var MC=24,MR=12,PS=4;
var LAND=['#1B5E20','#2E7D32','#43A047','#66BB6A'];
var OCEAN=['#0A1F6B','#0D47A1','#1565C0','#1E88E5'];
var ICE=['#B0C4DE','#D6EAF8','#EBF5FB'];
function sh(p,l){return p[Math.min(p.length-1,Math.floor(l*p.length))];}

function drawEarth(ctx,cx,cy,r,ang){
  for(var py=-r;py<r;py+=PS){
    for(var px=-r;px<r;px+=PS){
      var pc=px+PS/2,pcy=py+PS/2,d2=pc*pc+pcy*pcy;
      if(d2>r*r)continue;
      var z=Math.sqrt(r*r-d2);
      var lat=Math.asin(-pcy/r);
      var lon=((Math.atan2(pc,z)-ang)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);
      var mc=Math.floor(lon/(2*Math.PI)*MC)%MC;
      var mr=Math.max(0,Math.min(MR-1,Math.floor((Math.PI/2-lat)/Math.PI*MR)));
      var light=z/r;
      var col;
      if(mr===0||mr>=10)col=sh(ICE,light);
      else if(W[mr][mc]===1)col=sh(LAND,light);
      else col=sh(OCEAN,light);
      ctx.fillStyle=col;
      ctx.fillRect(Math.round(cx+px),Math.round(cy+py),PS,PS);
    }
  }
  /* polar ice caps (fixed, non-rotating) */
  ctx.save();ctx.globalAlpha=0.65;ctx.fillStyle='#D6EAF8';
  ctx.beginPath();ctx.arc(cx,cy-r+PS,r*0.25,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(cx,cy+r-PS,r*0.32,0,Math.PI*2);ctx.fill();
  ctx.restore();
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);
  ctx.strokeStyle='rgba(120,190,255,0.5)';ctx.lineWidth=1.5;ctx.stroke();
}

/* s-character (Korean: s shape)
   6 cols x 10 rows at scale=5px, forward-facing, legs walk left */
var Y='#FFE082',D='#F9A825',K='#2C1A00',T=null;
var BODY=[[T,T,Y,Y,T,T],[T,Y,Y,Y,Y,T],[Y,Y,K,Y,K,Y],
          [Y,Y,Y,Y,Y,Y],[T,Y,Y,Y,Y,T],[T,T,Y,Y,T,T]];
var LEGS=[
  [[Y,T,T,T,T,Y],[Y,T,T,T,Y,T]],
  [[T,Y,Y,Y,T,T],[T,Y,T,Y,T,T]],
  [[Y,T,T,T,T,Y],[T,Y,T,T,T,Y]],
  [[T,Y,Y,Y,T,T],[T,Y,T,Y,T,T]]
];
var BOB=[0,1,0,1];
function drawChar(ctx,ox,oy,sc,frame){
  var f=frame&3;
  var by=BOB[f]*sc;
  var rows=BODY.concat(LEGS[f]);
  for(var r=0;r<rows.length;r++){
    var isLeg=r>=BODY.length;
    var yOff=isLeg?0:by;
    for(var c=0;c<rows[r].length;c++){
      var col=rows[r][c];if(!col)continue;
      ctx.fillStyle=col;
      ctx.fillRect(ox+c*sc,oy+r*sc+yOff,sc,sc);
      if(col===Y){ctx.fillStyle=D;ctx.fillRect(ox+c*sc,oy+r*sc+yOff+sc-1,sc,1);}
    }
  }
}

/* Animation loop
   Canvas: 88x108px
   Globe:  radius=34, center=(44, 70)  [70 = 108-34-4]
   Char:   charX=29 [44-3*5], charY=-4 [70-34-8*5]
           body bottom at globe top (y=36), legs overlap into globe */
var angle=0,tick=0,wf=0;
function loop(){
  var canvas=document.getElementById('nnai-globe-canvas');
  if(!canvas||!canvas.isConnected){window.__nnaiRAF=null;return;}
  var ctx=canvas.getContext('2d');
  ctx.imageSmoothingEnabled=false;
  ctx.clearRect(0,0,88,108);
  angle-=0.014;
  tick++;
  if(tick%10===0)wf++;
  drawEarth(ctx,44,70,34,angle);
  drawChar(ctx,29,-4,5,wf);
  window.__nnaiRAF=requestAnimationFrame(loop);
}
window.__nnaiRAF=requestAnimationFrame(loop);
})();
</script>"""


def get_loading_html(message: str) -> str:
    """Return a self-contained full-screen loading overlay HTML string.

    The overlay is position:fixed covering the full viewport. It contains:
    - An 88x108px canvas rendering a pixel-art Earth globe (CCW rotation)
      with a ㅅ-shaped walking character on top
    - A text label showing *message*
    - An inline <script> starting the requestAnimationFrame loop

    Each call cancels any existing RAF loop (window.__nnaiRAF) before starting
    a new one, so yielding multiple loading messages in sequence is safe.

    Clearing: yield LOADING_CLEAR ("") to the gr.HTML component. Gradio sets
    innerHTML to empty, detaching the canvas; the loop's isConnected check
    then exits the loop automatically.
    """
    return (
        '<div style="position:fixed;inset:0;z-index:9999;'
        'background:rgba(18,20,35,0.52);backdrop-filter:blur(7px);'
        'display:flex;align-items:center;justify-content:center;'
        'flex-direction:column;gap:12px;">'
        '<canvas id="nnai-globe-canvas" width="88" height="108" '
        'style="display:block;image-rendering:pixelated;'
        'image-rendering:crisp-edges;"></canvas>'
        '<p style="color:rgba(255,255,255,0.75);font-size:0.85rem;'
        'font-family:Inter,sans-serif;margin:0;text-align:center;">'
        + message
        + '</p>'
        + _ANIM_SCRIPT
        + '</div>'
    )
```

- [ ] **Step 1.4: Run tests to verify they pass**

```bash
python3 -m pytest tests/test_ui.py -k "loading" -v
```

Expected: all 8 loading tests PASS

- [ ] **Step 1.5: Commit**

```bash
git add ui/loading.py tests/test_ui.py
git commit -m "feat: add loading overlay module with pixel art globe animation"
```

---

## Task 2: Wire loading overlay into `layout.py`

**Files:**
- Modify: `ui/layout.py`
- Test: `tests/test_ui.py` (append)

### 2a — Add component, update `run_step1`

- [ ] **Step 2a.1: Write failing test** — append to `tests/test_ui.py`

```python
# ── Loading overlay wired into layout ─────────────────────────────────────────

def test_layout_has_loading_overlay_html_component():
    """layout must declare a gr.HTML with elem_id='nnai-loading-overlay'."""
    import gradio as gr
    from ui.layout import create_layout
    demo = create_layout(lambda *a, **kw: ("md", [], {}), lambda *a: "detail")
    elem_ids = {
        getattr(c, "elem_id", None)
        for c in demo.blocks.values()
        if isinstance(c, gr.HTML)
    }
    assert "nnai-loading-overlay" in elem_ids, (
        f"gr.HTML with elem_id='nnai-loading-overlay' not found. "
        f"Found HTML elem_ids: {elem_ids}"
    )
```

- [ ] **Step 2a.2: Run test to verify it fails**

```bash
python3 -m pytest tests/test_ui.py::test_layout_has_loading_overlay_html_component -v
```

Expected: FAIL — `nnai-loading-overlay` not found

- [ ] **Step 2a.3: Add import and `loading_overlay` component to `layout.py`**

**Add import** — insert after line 2 (`from ui.theme import create_theme`):

```python
from ui.loading import get_loading_html, LOADING_CLEAR
```

**Add component** — inside `create_layout()`, insert `loading_overlay` as the FIRST statement inside `with gr.Blocks(...) as demo:` (before the `with gr.Column(elem_classes="main-header"):` block at line 206):

```python
    with gr.Blocks(title="NomadNavigator AI") as demo:

        # ── 로딩 오버레이 (position:fixed — DOM 위치 무관) ───────────────
        loading_overlay = gr.HTML(elem_id="nnai-loading-overlay")

        # ── 헤더 ────────────────────────────────────────────────────────
        with gr.Column(elem_classes="main-header"):
            # ... rest unchanged
```

- [ ] **Step 2a.4: Verify component test passes**

```bash
python3 -m pytest tests/test_ui.py::test_layout_has_loading_overlay_html_component -v
```

Expected: PASS

- [ ] **Step 2a.5: Replace `run_step1` (lines 430–466)**

The loading messages are yielded **before** `advisor_fn` is called. This matches the current behavior — messages cycle through quickly, the last one ("✨ 거의 다 됐어요!") remains visible while the blocking API call runs.

```python
        def run_step1(nat, dual_nat, inc, inc_type, purpose, readiness_stage_val, life, langs, tl,
                      pref_countries, ui_lang, q_motiv, q_euro, q_concern_val,
                      travel_type_val, children_ages_val,
                      has_spouse_income_val, spouse_income_krw_val):
            try:
                from utils.persona import diagnose_persona
                persona_type = diagnose_persona(q_motiv, q_euro, None, None, q_concern_val)
                # Show loading overlay — messages cycle before advisor call.
                # Loading text moves to overlay; step1_output (pos 0) stays unchanged.
                for msg in _STEP1_LOADING:
                    yield (
                        gr.update(),
                        gr.update(),
                        gr.update(visible=False),
                        gr.update(),
                        gr.update(),
                        get_loading_html(msg),
                    )
                markdown, cities, parsed = advisor_fn(
                    nat, inc, purpose, life, langs, tl, pref_countries, ui_lang, persona_type,
                    dual_nationality=dual_nat,
                    income_type=inc_type,
                    travel_type=travel_type_val, children_ages=children_ages_val,
                    readiness_stage=readiness_stage_val,
                    has_spouse_income=has_spouse_income_val,
                    spouse_income_krw=spouse_income_krw_val,
                )
                labels = [
                    _city_btn_label(cities[i]) if i < len(cities) else _FALLBACK_LABELS[i]
                    for i in range(3)
                ]
                yield (
                    markdown,
                    parsed,
                    gr.update(visible=True),
                    gr.update(),
                    gr.update(choices=labels, value=labels[0]),
                    LOADING_CLEAR,
                )
            except Exception as e:
                yield (
                    f"⚠️ 오류가 발생했습니다: {str(e)}",
                    {},
                    gr.update(visible=False),
                    gr.update(),
                    gr.update(),
                    LOADING_CLEAR,
                )
```

- [ ] **Step 2a.6: Update `btn_step1.click` outputs list**

Change `outputs=[step1_output, parsed_state, btn_go_step2, tabs, city_choice]` to:

```python
        btn_step1.click(
            fn=run_step1,
            inputs=[
                nationality, dual_nationality, income_krw, income_type, immigration_purpose,
                readiness_stage,
                lifestyle, languages, timeline, preferred_countries,
                ui_language,
                q_motivation, q_europe, q_concern,
                travel_type, children_ages,
                has_spouse_income, spouse_income_krw,
            ],
            outputs=[step1_output, parsed_state, btn_go_step2, tabs, city_choice, loading_overlay],
        )
```

### 2b — Update `run_step2`

- [ ] **Step 2b.1: Replace `run_step2` (lines 514–531)**

```python
        def run_step2(parsed, choice):
            try:
                static_map = {"1순위 도시": 0, "2순위 도시": 1, "3순위 도시": 2}
                if choice in static_map:
                    idx = static_map[choice]
                else:
                    cities = parsed.get("top_cities", [])
                    dynamic_labels = [_city_btn_label(c) for c in cities]
                    idx = dynamic_labels.index(choice) if choice in dynamic_labels else 0
                for msg in _STEP2_LOADING:
                    yield gr.update(), get_loading_html(msg)
                markdown = detail_fn(parsed, city_index=idx)
                yield markdown, LOADING_CLEAR
            except Exception as e:
                import traceback
                traceback.print_exc()
                yield f"⚠️ 오류가 발생했습니다: {str(e)}", LOADING_CLEAR
```

- [ ] **Step 2b.2: Update `btn_step2.click` outputs list**

Change `outputs=[step2_output]` to:

```python
        btn_step2.click(
            fn=run_step2,
            inputs=[parsed_state, city_choice],
            outputs=[step2_output, loading_overlay],
        )
```

- [ ] **Step 2b.3: Run full test suite**

```bash
python3 -m pytest tests/ -v --tb=short 2>&1 | tail -30
```

Expected: all existing tests pass + new loading tests pass; no import errors

- [ ] **Step 2b.4: Commit**

```bash
git add ui/layout.py tests/test_ui.py
git commit -m "feat: wire pixel art loading overlay into layout generators"
```

---

## Task 3: Manual Browser Verification

- [ ] **Step 3.1: Start the app**

```bash
cd /Users/yoroji/Documents/hackathon/nnai
python3 app.py
```

Open `http://127.0.0.1:7860` in a browser.

- [ ] **Step 3.2: Verify Step 1 loading**

1. Fill in any profile (nationality=Korean, income=500, etc.)
2. Click "🚀 도시 추천 받기"
3. **Expected:**
   - Entire app background blurs immediately
   - Pixel-art Earth globe appears centered, spinning counter-clockwise
   - ㅅ character walks on top of the globe
   - Loading messages cycle in Korean below the animation
   - On completion: overlay disappears, result renders in the result panel normally

- [ ] **Step 3.3: Verify Step 2 loading**

1. After Step 1 completes, click "📖 상세 가이드 받기 →", select a city, click "📖 상세 가이드 받기"
2. **Expected:** Same overlay with Step 2 messages; clears when guide is ready

- [ ] **Step 3.4: Verify error path (overlay clears on error)**

Temporarily add `raise ValueError("test error")` as the first line of `nomad_advisor()` in `app.py`, trigger Step 1.
**Expected:** Overlay disappears and error message "⚠️ 오류가 발생했습니다: test error" appears in the result panel. Overlay does NOT stay stuck on screen.
Revert the temporary change before committing.

- [ ] **Step 3.5: Final commit**

```bash
git add -A
git commit -m "feat: loading overlay complete — pixel art globe + ㅅ character"
```
