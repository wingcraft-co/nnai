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
- Centered on screen via flexbox
- Globe occupies bottom portion of canvas; character sits on top of globe

### Globe
- **Style:** Pixel art using spherical (orthographic) projection
- **Pixel size:** 4px per world-map pixel (chunky, blocky feel)
- **World map:** 24 × 12 binary grid (1=land, 0=ocean)
- **Palette:**
  - Ocean: 4-shade blue (`#0A1F6B` → `#1E88E5`) based on sphere lighting
  - Land: 4-shade green (`#1B5E20` → `#66BB6A`) based on sphere lighting
  - Ice caps: light blue-white (`#B0C4DE` → `#EBF5FB`)
- **Rotation:** Counter-clockwise, ~0.014 rad/frame
- **Radius:** 34px
- **Rim:** Semi-transparent blue stroke `rgba(120,190,255,0.5)`

### Character (ㅅ shape)
- **Design:** Pixel art character shaped like Korean letter ㅅ — round head with two eyes, body tapering to a center point, two legs spreading outward in ㅅ formation
- **Facing:** Forward-facing (two eyes visible), legs walk to the left
- **Sprite size:** 6 columns × 8 rows (static body), + 2 rows for legs = 6 × 10 total
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
  - Body bobs ±1px on mid-step frames (frames 1, 3)
- **Walk speed:** 1 frame per 10 render ticks (~6 steps/sec at 60fps)

### Overlay
- **Background:** `rgba(18, 20, 35, 0.52)` — deep navy, semi-transparent
- **Blur:** `backdrop-filter: blur(7px)` applied to entire page
- **Z-index:** 9999 (above all Gradio content)
- **Transition:** None (immediate show/hide for responsiveness)

### Loading Text
- Displayed below the canvas animation
- Font: inherit app font (Inter)
- Color: `rgba(255,255,255,0.75)`
- Font size: `0.85rem`
- Text is passed per-call (step 1 and step 2 have different messages)
- Step 1 messages (cycled via generator yields):
  - `"🔍 프로필을 분석하는 중이에요..."`
  - `"🌍 전 세계 비자 데이터를 검색하는 중이에요..."`
  - `"🤖 AI가 최적의 도시를 선별하는 중이에요..."`
  - `"✨ 거의 다 됐어요!"`
- Step 2 messages:
  - `"🏙️ 선택한 도시 정보를 불러오는 중이에요..."`
  - `"📋 맞춤 가이드를 작성하는 중이에요..."`

---

## Architecture

### New Files
- `ui/loading.py` — exports `LOADING_HTML` (the overlay HTML/CSS/JS string) and `clear_loading()` helper

### Modified Files
- `ui/layout.py` — add `gr.HTML(elem_id="nnai-loading-overlay")` component; update `_APP_CSS`
- `app.py` — wire loading overlay into `nomad_advisor` and `show_city_detail` generator functions

### Component Structure

```
gr.Blocks()
  └── gr.HTML(elem_id="nnai-loading-overlay")   ← NEW: hidden by default
  └── [existing layout unchanged]
```

### CSS (added to `_APP_CSS`)
```css
#nnai-loading-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(18, 20, 35, 0.52);
  backdrop-filter: blur(7px);
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
}
#nnai-loading-overlay.active {
  display: flex;
}
```

### Yield Pattern (in generators)

Each generator function follows this pattern:

```python
def nomad_advisor(...):
    # 1. Show loading overlay (first yield)
    yield get_loading_html("🔍 프로필을 분석하는 중이에요..."), ...

    # ... AI processing ...

    # 2. Update loading text mid-way (optional yields)
    yield get_loading_html("🌍 전 세계 비자 데이터를 검색하는 중이에요..."), ...

    # 3. Clear overlay on final yield
    yield "", final_result, ...
```

`get_loading_html(message)` returns the full overlay HTML with canvas animation + the given message string embedded.

### Canvas Animation

The overlay HTML contains:
- A `<canvas>` element (88 × 108px)
- Inline `<style>` for overlay layout
- Inline `<script>` with:
  - World map pixel data
  - `drawPixelGlobe()` — spherical projection renderer
  - `drawChar()` — ㅅ character pixel renderer
  - `requestAnimationFrame` loop

The script uses `requestAnimationFrame` and handles cleanup via `cancelAnimationFrame` when the overlay is removed from the DOM (observed via `MutationObserver` on the canvas element).

---

## Data Flow

```
Button click
  → generator starts
  → first yield → gr.HTML shows overlay (canvas animates)
  → AI processing (streaming)
  → intermediate yields → overlay text updates
  → final yield → gr.HTML cleared → overlay hides
```

---

## Constraints & Notes

- **No external dependencies:** Canvas animation is pure JS/CSS, no npm packages
- **Gradio compatibility:** Uses `gr.HTML()` yield pattern which is stable across Gradio 4.x
- **Performance:** `cancelAnimationFrame` prevents animation loop leaks when overlay is hidden
- **The existing `_STEP1_LOADING` / `_STEP2_LOADING` message arrays** in `layout.py` can be reused as the per-yield text for the overlay
- **The overlay does not interfere with Gradio's own loading indicators** (button spinners remain visible under the overlay)

---

## Out of Scope

- Loading state for tab switching or dropdown changes
- Animated transitions (fade in/out) for the overlay
- Custom loading messages beyond the existing step 1/2 arrays
