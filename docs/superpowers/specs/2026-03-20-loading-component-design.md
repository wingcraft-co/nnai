# Loading Component Design

**Date:** 2026-03-20
**Status:** Approved
**Author:** UX Designer (via brainstorming session)

---

## Overview

A full-screen loading overlay for the Gradio-based nomad advisor app. When any long-running AI operation is in progress, the entire app background is blurred and a centered pixel-art animation appears.

---

## Visual Design

### Size & Position
- Canvas size: **88 × 108px** (approximately "cherry tomato" size, ~2–3cm on screen)
- Centered on screen via flexbox overlay
- Globe occupies bottom portion of canvas; character sits on top of globe

### Globe
- **Style:** Pixel art using spherical (orthographic) projection
- **Pixel size:** 4px per world-map pixel (chunky, blocky feel)
- **World map:** 24 × 12 binary grid (1=land, 0=ocean)
- **Palette:**
  - Ocean: 4-shade blue (`#0A1F6B` → `#1E88E5`) based on sphere lighting (z/r ratio)
  - Land: 4-shade green (`#1B5E20` → `#66BB6A`) based on sphere lighting
  - Ice caps: light blue-white (`#B0C4DE` → `#EBF5FB`)
- **Rotation:** Counter-clockwise, ~0.014 rad/frame
- **Radius:** 34px
- **Rim:** Semi-transparent blue stroke `rgba(120,190,255,0.5)`

### Character (ㅅ shape)
- **Design:** Pixel art shaped like Korean letter ㅅ — round forward-facing head with two eyes, body tapering to a center point, two legs spreading outward in ㅅ formation
- **Facing:** Forward-facing (two eyes visible), legs walk to the left
- **Sprite size:** 6 columns × 10 rows (8 body rows + 2 leg rows)
- **Scale:** 5px per pixel → 30 × 50px rendered size
- **Colors:**
  - Body: `#FFE082` (amber yellow)
  - Shadow edge: `#F9A825`
  - Eyes: `#2C1A00` (dark)
- **Animation:** 4-frame walk cycle
  - Frame 0: left leg forward, right leg back (stride A)
  - Frame 1: legs under body (mid-step)
  - Frame 2: right leg forward, left leg back (stride B)
  - Frame 3: legs under body (mid-step)
  - Body bobs +1 pixel down on mid-step frames (frames 1, 3)
- **Walk speed:** 1 frame per 10 render ticks (~6 steps/sec at 60fps)

### Overlay
- **Background:** `rgba(18, 20, 35, 0.52)` — deep navy, semi-transparent
- **Blur:** `backdrop-filter: blur(7px)` applied to entire page
- **Position:** `fixed; inset: 0; z-index: 9999`
- **Show:** yield full HTML string (canvas + script + text) to `gr.HTML` component
- **Hide:** yield empty string `""` to the same `gr.HTML` component

### Loading Text
- Displayed below the canvas animation
- Font: inherit app font (Inter), color `rgba(255,255,255,0.75)`, size `0.85rem`
- Text is passed per-yield call; step 1 and step 2 use existing `_STEP1_LOADING` / `_STEP2_LOADING` message arrays (these arrays are **replaced** with overlay-based yields — they are no longer yielded to the Markdown output directly)

**Step 1 messages** (one per intermediate yield):
```python
_STEP1_LOADING = [
    "🔍 프로필을 분석하는 중이에요...",
    "🌍 전 세계 비자 데이터를 검색하는 중이에요...",
    "🤖 AI가 최적의 도시를 선별하는 중이에요...",
    "✨ 거의 다 됐어요!",
]
```

**Step 2 messages**:
```python
_STEP2_LOADING = [
    "🏙️ 선택한 도시 정보를 불러오는 중이에요...",
    "📋 맞춤 가이드를 작성하는 중이에요...",
]
```

---

## Architecture

### New Files
- `ui/loading.py` — exports `get_loading_html(message: str) -> str` and `LOADING_CLEAR = ""`

### Modified Files
- `ui/layout.py`:
  - Add `loading_overlay = gr.HTML(elem_id="nnai-loading-overlay")` inside `gr.Blocks()`, **before** the `gr.Tabs()` block
  - Add `loading_overlay` as the **6th element** in `run_step1`'s `outputs` list
  - Add `loading_overlay` as the **2nd element** in `run_step2`'s `outputs` list
  - Update all yields in `run_step1` and `run_step2` to include the overlay value
  - Add overlay CSS to `_APP_CSS`

### Component Placement in `create_layout()`

```python
with gr.Blocks() as demo:
    loading_overlay = gr.HTML(elem_id="nnai-loading-overlay")   # ← NEW
    parsed_state = gr.State({})
    with gr.Tabs() as tabs:
        ...  # existing layout unchanged
```

### Updated Output Lists

`run_step1` — currently 5 outputs, becomes 6:
```python
outputs=[step1_output, parsed_state, btn_go_step2, tabs, city_choice, loading_overlay]
```

`run_step2` — currently 1 output, becomes 2:
```python
outputs=[step2_output, loading_overlay]
```

### CSS

No special CSS is added to `_APP_CSS` for the overlay. The `gr.HTML` component's outer wrapper (`#nnai-loading-overlay`) has no visual styling — all overlay CSS is inline inside the HTML string returned by `get_loading_html()`. This avoids any dependency on Gradio's internal DOM structure or `:empty` selector reliability.

`get_loading_html()` returns an HTML string whose outermost element has inline `style="position:fixed; inset:0; z-index:9999; ..."`. When `LOADING_CLEAR = ""` is yielded, Gradio sets the `gr.HTML` innerHTML to empty, the fixed-position div is removed, and the overlay disappears naturally.

### Yield Pattern in `run_step1` and `run_step2`

The two actual generator functions are `run_step1` and `run_step2` inside `ui/layout.py`. **`nomad_advisor` and `show_city_detail` in `app.py` are plain `return` functions and are NOT modified.**

```python
# run_step1 (currently yields 5-tuples, becomes 6-tuples)
# IMPORTANT: The existing loading strings that were previously yielded to
# step1_output (position 0) are REMOVED. Position 0 becomes gr.update()
# during loading — the loading text moves to the overlay only.
def run_step1(...):
    # First: show overlay (position 0 is now gr.update(), not a loading string)
    yield gr.update(), gr.update(), gr.update(), gr.update(), gr.update(), get_loading_html(_STEP1_LOADING[0])

    try:
        result = nomad_advisor(...)  # unchanged plain function

        for msg in _STEP1_LOADING[1:]:
            yield gr.update(), gr.update(), gr.update(), gr.update(), gr.update(), get_loading_html(msg)

        # Final: clear overlay, emit result
        yield result_md, new_state, btn_update, tabs_update, cities, LOADING_CLEAR

    except Exception as e:
        # Exception branch: must match 6-tuple arity AND clear overlay
        yield f"⚠️ 오류가 발생했습니다: {str(e)}", {}, gr.update(visible=False), gr.update(), gr.update(), LOADING_CLEAR


# run_step2 (currently yields bare strings, becomes 2-tuples)
def run_step2(...):
    yield gr.update(), get_loading_html(_STEP2_LOADING[0])

    try:
        result = show_city_detail(...)  # unchanged plain function

        yield gr.update(), get_loading_html(_STEP2_LOADING[1])

        yield result_md, LOADING_CLEAR

    except Exception as e:
        # Exception branch: must match 2-tuple arity AND clear overlay
        yield f"⚠️ 오류가 발생했습니다: {str(e)}", LOADING_CLEAR
```

### `get_loading_html(message)` Implementation

Returns a self-contained HTML string with:
- The overlay content div (canvas + text label)
- Inline CSS for centering the content inside the fixed overlay
- Inline JS with canvas animation

**Critical implementation detail — preventing duplicate animation loops:**

Each call to `get_loading_html()` injects a new `<script>` tag. Gradio 4.x re-executes script tags on each `gr.HTML` update. To prevent multiple concurrent `requestAnimationFrame` loops:

```javascript
// Cancel any previous loop before starting a new one
if (window.__nnaiRAF) cancelAnimationFrame(window.__nnaiRAF);

function loop() {
  const canvas = document.getElementById('nnai-globe-canvas');
  if (!canvas || !canvas.isConnected) {
    // Canvas removed from DOM (overlay cleared) — auto-stop
    window.__nnaiRAF = null;
    return;
  }
  // ... render globe and character ...
  window.__nnaiRAF = requestAnimationFrame(loop);
}
window.__nnaiRAF = requestAnimationFrame(loop);
```

The `!canvas.isConnected` guard handles cleanup when the overlay is hidden (Gradio replaces innerHTML with empty string, detaching the canvas from the DOM). No MutationObserver is needed.

---

## Data Flow

```
Button click (step 1 or step 2)
  → run_step1 / run_step2 generator starts
  → first yield → gr.HTML receives full overlay HTML → overlay appears, animation starts
  → nomad_advisor() / show_city_detail() called (plain return functions, unchanged)
  → intermediate yields → gr.HTML receives updated HTML (new message, script re-runs, previous RAF cancelled)
  → final yield → gr.HTML receives "" → overlay div content empty → display:none via CSS
```

---

## Constraints & Notes

- **No external dependencies:** Canvas animation is pure JS/CSS, no npm packages
- **Gradio compatibility:** Uses stable `gr.HTML()` yield pattern (Gradio 4.x)
- **Animation loop safety:** `window.__nnaiRAF` guard prevents duplicate loops; `canvas.isConnected` check auto-stops when overlay is cleared
- **`app.py` is not modified** — `nomad_advisor` and `show_city_detail` remain plain functions
- **`_STEP1_LOADING` / `_STEP2_LOADING` arrays** are moved from direct Markdown yields to overlay text — they are replaced, not reused alongside the old pattern
- The existing Gradio button loading spinner remains visible under the overlay (no conflict)

---

## Out of Scope

- Loading state for tab switching or dropdown changes
- Animated fade in/out transitions for the overlay
- Custom loading messages beyond the existing step 1/2 arrays
