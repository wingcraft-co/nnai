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
- **Ratio:** **4:7 ≈ 0.571** (Rider-Waite 실측 11:19=0.579와 오차 1%. 실제 타로 카드 proportion에 최대한 근접)
- **Sizes (width × height):**
  - sm: 140 × 245
  - md: 200 × 350
  - lg: 260 × 455
- **Border radius:** 12px outer, 8px inner border (result 카드와 lightbox 공통)

## Lightbox Card (공개/잠금 공통 frame)
- **Ratio:** 4:7 (result 카드와 동일 — "카드가 확대된" 시각 연속성)
- **Width:** `min(320px, calc(100vw - 80px))` — 양옆 40px 확보해 ‹›버튼(32px) + 8px 여백
- **Height:** `aspect-[4/7]` (width × 1.75). 내부 콘텐츠는 카드 안에서 스크롤. 뷰포트 높이가 부족하면 `max-h: 85vh`로 clamp
- **Border radius:** 12px outer (result 카드와 동일)
- **Navigation:**
  - 카드 **바깥 좌/우 가운데** ‹ › 버튼 (5장 순환)
  - 카드 **바깥 우상단** × 버튼 (44×44 터치 타겟)
  - 키보드 ← → 이전/다음, ESC 닫기
  - 외부 dim 영역 클릭으로 닫기
- **Content variants:**
  - 공개 카드(state=front): flag + city_kr + city/country + metrics 3-col grid + personalized insight + visa/stats/description/login CTA + links
  - 잠금 카드(state=locked): **정보 완전 은닉 skeleton** (아래 Locked Teaser 규칙)

## Locked Teaser (lightbox 내부)
- **추론 방지 원칙:** blur 이미지 금지 (형태 유추 가능). 모든 식별 데이터는 완전 hide.
- **Hide 대상:** `city_kr`, `city`, `country`, `country_id`, `flag`, `monthly_cost_usd`, `visa_free_days`, `internet_mbps`, `visa_type`, `city_insight`, `city_description`, 링크 전부
- **Show 대상 (추론 불가):**
  - 🔒 아이콘 (48–56px, `--muted-foreground` opacity 0.4)
  - 순서 라벨: `Pro 전용 카드 #{n}` (ko) / `Premium Pick #{n}` (en) — `n`은 1-based 전체 인덱스
  - skeleton 블록 (제목용 bar + 부제 bar, 고정 폭)
  - metric 자리용 3-column skeleton (icon 자리 + label bar + value bar), `--border` divider 상하
  - CTA: "Pro로 모든 도시 보기" (ko) / "Unlock all cities with Pro" (en) — `NEXT_PUBLIC_POLAR_CHECKOUT_URL` 직접 링크, `trackResultCardInteraction({ action: "unlock_click" })`
- skeleton 블록은 `color-mix(--muted-foreground 10–20%, transparent)` 배경. 고정 shape이므로 도시별 편차 없음

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
| Locked (default) | `--border` (opacity 0.15) | dim overlay `color-mix(--card 60%, transparent)` + 🔒 | 1.0 |
| Locked (hover) | 동일 | 카드 전체 opacity 0.15 → 0.65 + 🔒 아이콘 scale 1.08 + depth shadow | 1.025 |

**Hover 정책:**
- 모든 clickable 카드(back/front/locked)에 hover scale 1.025 + depth shadow 동일 적용
- front 카드는 추가로 미세 border lift (`color-mix(--primary 22%, --border)`)
- **Locked 카드 hover**: 카드 전체 opacity `0.15 → 0.65` (duration 0.4s) + 🔒 아이콘 `scale 1.08` (duration 0.25s). "결제하면 볼 수 있다" 메타포 — 커튼이 살짝 걷히는 느낌. amber glow 추가하지 않음.
- amber glow는 selected 전용으로 분리 — hover와 selected는 시각적으로 명확히 구분
- transition: scale/box-shadow/border `duration 0.2s ease`, opacity `duration 0.4s ease-out`

**Locked 인터랙션:**
- 잠금 카드 클릭 시 카드 크기 인라인 dim 오버레이 노출 (카드 위에 직접 렌더)
- 오버레이 구성: 🔒 아이콘 + "추가 도시 보기" 텍스트 + Polar 결제 CTA 링크
- CTA: `NEXT_PUBLIC_POLAR_CHECKOUT_URL` 직접 링크 (`<a>` 태그)
- 닫기: X 버튼, 바깥 클릭
- 스타일: `color-mix(--card 85%, transparent)` + `backdrop-filter: blur(4px)` + `--border`

**CityLightbox (5장 순환 구조):**
- 카드 폼은 위 "Lightbox Card" 스펙(4:7, width min(320,100vw-80), radius 12) 그대로
- 카드 **바깥 좌/우 수직 중앙**에 ‹ › 네비게이션 (32×32, 아이콘 20px, `--foreground` on dim)
- 카드 **바깥 우상단**에 × 닫기 (44×44 터치 타겟, lucide-react `X` 20px)
- 키보드: ESC 닫기, ← → 이전/다음
- 바깥 dim 영역 클릭으로 닫기
- 하단 닫기 버튼 없음 — X/ESC/바깥 클릭/‹›만
- 5장(선택된 3 + 잠금 2) 전체 순환: `(index + 1) % 5` / `(index - 1 + 5) % 5`
- 공개 카드는 기존 콘텐츠(metrics/insight/login CTA/links). 잠금 카드는 위 Locked Teaser 규칙

**Personalized Insight (CityLightbox 상단, 비자 정보 위):**
- `getPersonalizedInsight(persona, travelType, timeline, city)` 헬퍼가 null 반환 시 미렌더
- 한국어 로케일 전용 (`locale !== "ko"` → null)
- 데이터 소스: `localStorage.persona_type` + `localStorage.result_session_v2 → parsedData._user_profile.{travel_type, timeline}` + city 객체
- 6가지 우선순위 분기 (동반자+치안 → 동반자+한인 → free_spirit+tropical → free_spirit+무비자90 → free_spirit+renewable → 단기+무비자60)
- 동반자 조건: `travel_type`에 `"배우자"`/`"파트너"`/`"가족"` 포함. copy는 중립 "동반자와 함께라면" 사용
- tropical 매칭: `city.climate?.includes("tropical")` → subtropical 포함
- UI: `font-serif text-sm`, `color: var(--primary)` (amber), `✦` prefix, border/배경 없음, 기존 `space-y-4` separator 공유 (추가 divider 금지)
- localStorage 읽기 실패/JSON.parse 실패 시 silent null

**Login CTA (CityLightbox 외부 링크 위):**
- 렌더 조건: `locale === "ko"` AND `fetch("/auth/me")` 결과 `logged_in === false`
- auth 체크는 쿠키 세션 기반 (프로젝트 실제 메커니즘). 네트워크 실패 시 기본 "로그아웃"으로 처리 (CTA 표시)
- 구성: divider (`--border 40%` alpha) → 타이틀 "{city_kr} 맞춤 이민 가이드 받기" (`font-serif text-sm font-medium`, `--foreground`) → 서브카피 `font-sans text-xs`, `--muted-foreground` → 전체 너비 버튼 (border `--border`, transparent bg, `--foreground` text, `hover:bg-primary/10`) + Google 브랜드 SVG 인라인(16×16)
- 클릭 액션: `buildGoogleLoginUrl(API_BASE, window.location.href)` 헬퍼로 `/auth/google?return_to=...` 리다이렉트 (기존 `GoogleLoginPanel.tsx`와 동일 메커니즘 재사용)
- Google 로고 브랜드 컬러(#EA4335/#4285F4/#FBBC05/#34A853)는 HEX 금지 규칙의 예외 — 상표권 준수
- `✦` prefix는 Personalized Insight와 겹쳐서 CTA 타이틀엔 미사용
- divider는 **CTA 블록 위에만** 1개. 블록 내부 타이틀/서브카피/버튼은 `space-y-2`로 묶음

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
| 2026-04-17 | Metric 3셀 `flex-1 min-w-0` 균등 너비 | `justify-around` + 가변 content 너비는 아이콘을 1/3 지점에서 벗어나게 함. 균등 너비 컬럼으로 아이콘 정렬 고정. |
| 2026-04-17 | Locked 카드 hover: opacity 0.15 → 0.65 + 🔒 scale 1.08 | 기존 hover(scale+shadow)는 opacity 0.15에 가려져 거의 인지 불가. opacity pop으로 "커튼이 걷히는" 피드백 제공. amber 정책 유지. |
| 2026-04-17 | CityLightbox 하단 닫기 버튼 제거, X 버튼 44×44 터치 영역 + 스크롤 밖 고정 | 중복 CTA 제거. WCAG 2.5.5 Target Size 준수. 스크롤 시 X가 사라지는 문제 해결 위해 scroll 컨테이너 구조 분리. |
| 2026-04-17 | Personalized Insight 한 줄 도입 (CityLightbox 비자 정보 위) | "자기 발견 경험 입구" 포지셔닝 강화. 동반자 조건 copy는 `"파트너"` → `"동반자"` 중립화 (가족/자녀 동반 유저 포함). `--primary` amber 유지 (`--accent`는 dark 모드에서 muted brown이라 부적합). ko 전용. |
| 2026-04-17 | Login CTA (CityLightbox 외부 링크 위) | 로그인 전환 entry point 추가. auth 체크는 localStorage 키 대신 `/auth/me` 쿠키 세션(프로젝트 실제 메커니즘). `buildGoogleLoginUrl` 기존 헬퍼 재사용. ko 전용. |
| 2026-04-20 | Card ratio 문서 2:3 → **4:7** 정정 + lightbox도 4:7 카드화 | 문서의 2:3 기재는 실제 Rider-Waite 타로(11:19≈0.579)와 맞지 않음. 코드의 4:7(0.571)이 타로 실측과 오차 1%로 가장 충실. Lightbox를 같은 4:7/12radius 카드 frame으로 통일 → result↔lightbox "확대" 시각 연속성 확보. 모바일 `min(320, 100vw-80)`로 양옆 40px 확보해 외부 ‹›× 네비게이션 공간 마련. |
| 2026-04-20 | Metric 3셀 flex → **grid 3×3** 재편 | `VISA-FREE` 라벨과 `30 days` 같은 공백 포함 value가 좁은 셀에서 wrap되면 해당 열만 아래로 밀리던 문제. grid rows로 icon/label/value 3행을 전 열에 동기화 → 어느 셀이 2줄이 되어도 세 열 함께 정렬. |
| 2026-04-20 | Locked 카드 인라인 overlay 폐기, Lightbox 내 skeleton teaser로 통합 | 인라인 overlay는 목록 맥락엔 유지했지만 정보 탐색 단일 경로(Lightbox)로 통일하는 게 더 일관됨. blur 이미지 금지 — 형태 추론 가능하므로 이름/숫자 전부 hide한 skeleton + 순서 번호만. Pro CTA 카피는 "Pro로 모든 도시 보기"로 — "AI가 선별한" 류 표현은 순수 백엔드 로직 결과라 거짓이므로 금지. |
| 2026-04-20 | Locked 카드 default opacity 0.15 → **0.65** (hover 0.85) | 0.15는 카드 존재 자체가 사라질 정도로 dim. 0.65에서 "카드가 여기 있다" 존재감 + lock 신호 공존. hover는 0.85까지 올려 인터랙티브 피드백. scale/shadow는 공개 카드와 동일한 whileHover로 자동 적용. |
