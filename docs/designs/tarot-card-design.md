# Design System — NNAI Tarot Cards

## Product Context
- **What this is:** AI-powered digital nomad immigration planning service. Users answer lifestyle questions, get 3 city recommendations displayed as tarot cards.
- **Who it's for:** Korean digital nomad aspirants, 20-40s
- **Space/industry:** Immigration tech, lifestyle planning
- **Project type:** Web app (Next.js)

## Aesthetic Direction
- **Direction:** Luxury/Refined + Art Deco hybrid
- **Decoration level:** Intentional (geometric border ornaments, corner flourishes, no textures/noise)
- **Mood:** Pulling a gilt-edged card from a velvet box. Mystical, premium, precise. The tarot card is the product's signature moment.
- **Preview:** `~/.gstack/projects/wingcraft-co-nnai/designs/tarot-cards-20260410/tarot-preview.html`

## Typography
- **Display/City names (Korean):** Noto Serif KR 700 — serif reads as editorial/premium, limited to card titles only
- **Data/Labels/City names (English):** Geist Mono 400/500 — monospace for data credibility, all-caps for labels
- **Loading:** Google Fonts (Noto Serif KR), Geist npm package (already installed)
- **Scale:** Labels 9-10px uppercase letterspaced, Data 12-14px, City EN 14px, City KR 18-22px

## Color
- **Approach:** Restrained (amber on dark, color is rare and meaningful)
- **Theme:** tweakcn Amber Mono 2.0 — all accent colors derive from globals.css CSS variables

| CSS Variable | Role | Usage |
|-------------|------|-------|
| `--primary` | Primary amber | Selected borders, active elements, CTA buttons |
| `--ring` | Selection ring | Glow on selected cards (box-shadow) |
| `--border` | Default border | Unselected card borders, dividers |
| `--card` | Card surface | Card background |
| `--background` | Page background | Deep dark background |
| `--foreground` | Primary text | City names, metric values |
| `--muted-foreground` | Secondary text | Labels, descriptions |

**HEX 하드코딩 금지.** 모든 색상은 CSS 변수로 참조한다.

## Card Dimensions
- **Ratio:** 2:3 (real tarot proportions)
- **Single card:** 200x300px
- **5-card row:** 160x240px per card, 16px gap
- **Border radius:** 8px outer, 4px inner border

## Card Back — Compass Rose (Variant B)
- Double border: 1.5px outer + 1px inner (6px gap), both `--border`
- Four corner flourishes (L-shaped, 20px, `--border`)
- Center: 8-point compass rose
  - Outer ring: 80px diameter, 1px `--border`
  - 4 cardinal + 4 diagonal rays: 1px `--border`
  - Inner ring: 40px diameter, 1px `--primary` (brighter)
  - Center dot: 8px, filled `--primary`
- Below compass: "NNAI" in Geist Mono 10px, `letter-spacing: 0.35em`, `--border`
- **Selected state:** outer border brightens to `--primary`, `box-shadow: 0 0 20px 4px var(--ring)`, inner border brightens to `--primary`

## Card Front — Label + Value (Variant A)
- Single border: 1.5px `--border`
- Padding: 20px 16px 16px
- **Top section:**
  - Flag emoji: 32px centered
  - City name EN: Geist Mono 14px 500, `--text-white`, centered, `letter-spacing: 0.05em`
  - City name KR: Noto Serif KR 18px 700, `--text-white`, centered
- **Divider:** 1px `--border`, 14px margin top/bottom
- **Metrics (3 rows, 12px gap):**
  - Each row: icon (lucide-react w-4 h-4, `--muted-foreground`) + text column
  - Label: Geist Mono 10px uppercase, `--text-muted`, `letter-spacing: 0.1em`
  - Value: Geist Mono 13px 500, `--text-white`
  - Icons: Banknote (MONTHLY), Stamp (VISA), Wifi (INTERNET) — lucide-react
  - Metrics: MONTHLY + cost, VISA-FREE + days, INTERNET + Mbps
- **Bottom divider:** 1px `--border`

## Layout
- **5-card arrangement:** Flex row, centered, equal spacing (16px gap)
- **No fan, no overlap, no rotation** — flat side-by-side
- **No animation** — static cards only. Visual quality carries the mystical feel.

## States
| State | Border | Glow / Shadow | Scale |
|-------|--------|---------------|-------|
| Default | `--border` | none | 1.0 |
| Hover (모든 clickable 카드) | front: `color-mix(--primary 22%, --border)` (미세 lift) / back·locked: 변화 없음 | depth shadow `0 6px 18px color-mix(--background 70%, transparent)` — amber glow 없음 | 1.025 |
| Selected | `--primary` | `--ring` 20px + 60px outer (amber glow) | 1.0 |
| Locked | `--border` (opacity 0.15) | dim overlay `color-mix(--card 60%, transparent)` + 🔒 | 1.0 |

**Hover 정책:**
- 모든 clickable 카드(back/front/locked)에 hover scale 1.025 + depth shadow 동일 적용
- front 카드는 추가로 미세 border lift (`color-mix(--primary 22%, --border)`)
- amber glow는 selected 전용으로 분리 — hover와 selected는 시각적으로 명확히 구분
- transition: `duration 0.2s ease` (scale, box-shadow, border)

**Locked 인터랙션:**
- 잠금 카드 클릭 시 카드 크기 인라인 dim 오버레이 노출 (카드 위에 직접 렌더)
- 오버레이 구성: 🔒 아이콘 + "추가 도시 보기" 텍스트 + Polar 결제 CTA 링크
- CTA: `NEXT_PUBLIC_POLAR_CHECKOUT_URL` 직접 링크 (`<a>` 태그)
- 닫기: X 버튼, 바깥 클릭
- 스타일: `color-mix(--card 85%, transparent)` + `backdrop-filter: blur(4px)` + `--border`

**CityLightbox (공개 카드 상세):**
- 상단 X 닫기 아이콘 (lucide-react `X`)
- ESC 키로 닫기 지원
- 바깥 클릭으로 닫기

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-10 | Compass Rose for card back | Best thematic fit (nomad = navigation). Corner flourishes add Art Deco detail without clutter. |
| 2026-04-10 | Label + Value for card front | Most informative layout. Small caps labels create clear hierarchy without taking space from values. |
| 2026-04-10 | No animation | Current flip animation quality is low. Static design with strong visual carries mystical feel better than mediocre motion. |
| 2026-04-10 | CSS-only geometric patterns | Zero asset dependencies, scales perfectly, matches minimalist Amber Mono aesthetic. |
| 2026-04-10 | Card surface darker than background | Cards sit INTO the background rather than floating on top. Creates depth without shadows. |
| 2026-04-16 | Hover scale 1.025 + depth shadow 모든 clickable 카드 적용 | 모든 상태의 카드에 동일한 호버 피드백 제공. amber glow는 selected 전용 유지. |
| 2026-04-16 | Locked 카드 → 인라인 dim 오버레이 (fullscreen modal 제거) | 카드 크기 오버레이가 맥락 유지에 더 적합. Polar CTA 직접 링크로 단순화. |
| 2026-04-16 | Metric 아이콘 emoji → lucide-react | Banknote/Stamp/Wifi로 통일. 크기·정렬·색상 일관성 확보 (w-4 h-4, CSS 변수). |
| 2026-04-16 | CityLightbox X 닫기 + ESC 키 지원 | 접근성 및 사용성 개선. |
