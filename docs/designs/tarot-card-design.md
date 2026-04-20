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
- **Width:** `min(320px, calc(100vw - 80px), calc((100vh - 80px) * 4 / 7))` — 양옆 40px 확보해 ‹›버튼(32px) + 8px 여백. 뷰포트 세로가 부족하면 너비도 비율 맞춰 함께 줄어듦.
- **Height:** `aspect-[4/7]` (width × 1.75). **카드 내부 스크롤 금지** — 카드 메타포 유지를 위해 콘텐츠가 넘치지 않도록 정보 다이어트.
- **Border radius:** 12px outer (result 카드와 동일)
- **Navigation:**
  - 카드 **바깥 좌/우 가운데** ‹ › 버튼 (5장 순환)
  - 카드 **바깥 우상단** × 버튼 (44×44 터치 타겟)
  - 키보드 ← → 이전/다음, ESC 닫기
  - 외부 dim 영역 클릭으로 닫기
- **Content order (공개 카드)** — 실무 → 감성 → 지표 요약 → 외부 action → 전환:
  1. Flag + `city_kr` (serif) + `City, Country` (mono, muted) — Header
  2. Metrics 3×3 grid (MONTHLY / VISA / INTERNET) — Primary
  3. **비자 섹션** — "추천 비자" serif 헤딩 + **비자명 + `비자 확인하기 →` 같은 줄 flex justify-between** (비자명 왼쪽 / 링크 오른쪽 정렬) + 조건 라인 `최대 체류 {n}개월 · 연장 가능/불가`
  4. **city_insight** — 도시 한 줄 slogan (border-left `--primary` 2px + italic)
  5. Personalized insight (`✦` prefix, 유저 맥락, ko 전용, 조건부)
  6. **city_description** — 2–3줄 도시 소개 (leading-relaxed, `--muted-foreground`)
  7. **Scores pill row** — `치안 N/10` `영어 N/10` `{기후} 기후` — Primary 3 ↔ Secondary 3 대응, 객관 지표로 감성→지표 전환
  8. **External links** — `Flatio · Anyplace · Meetup` 브랜드만 dot-joined 한 줄 (text-[11px], 각 브랜드가 `--primary` 링크)
  9. Spacer (flex-1) — 하단 CTA까지 공간 채움
  10. **Login CTA** (ko + logged-out) — 단일 제목 serif + Google Sign-In 공식 **Dark Theme** 버튼

**Flow 근거**:
- **실무 먼저(비자)**: 노마드 decision funnel의 첫 관문은 "이 비자로 갈 수 있는가?". Visa 상단 배치
- **감성 중간(도시 slogan → 유저 맞춤 → 도시 설명)**: city_insight(도시 입장) → ✦(유저 맞춤) → city_description(더 긴 도시 소개)로 타인(도시) ↔ 나 ↔ 타인 왕복하며 관점 다양화
- **지표 요약(Scores)**: Header 밑 Primary metrics grid와 시각적 거리 확보로 숫자 중복 피로 해소
- **외부 action(External links) → 전환(CTA)**: 외부 이동 옵션을 CTA 바로 위에 두어 "외부로 가거나 / NNAI와 계속"의 선택을 명확히 병치
- **Drop된 항목** (Pro 가이드로 이관):
  - `data_verified_date` (데이터 출처 일자)
- **Lightbox에 유지한 이유**
  - `city_insight`(평균 21자) / `city_description`(평균 93자): "자기 발견 경험 입구" 포지셔닝의 **감성 축**. 실무(metrics/visa)와 감성(insight/description)이 함께 있어야 "이 도시가 나에게 어떤 의미인지" 감 잡음.
  - **External links**: `flatio_search_url` / `anyplace_search_url`은 **유통 BM의 affiliate 수익 경로**. `nomad_meetup_url` / `visa_url`은 engagement + reference. Lightbox가 핵심 전환 깔때기라 이 링크들은 반드시 Lightbox에 있어야 유통 수익 + 유저 탐색이 한 화면에서 완결.

**External links 워딩 규칙 (ko/en):**
| 링크 | 위치 | ko | en |
|---|---|---|---|
| `visa_url` | **비자 섹션 비자명 줄** (우측 정렬, underline, muted tone) | `비자 확인하기 →` | `Check visa →` |
| `flatio_search_url` | External links (브랜드 단일) | `Flatio` | `Flatio` |
| `anyplace_search_url` | External links (브랜드 단일) | `Anyplace` | `Anyplace` |
| `nomad_meetup_url` | External links (브랜드 단일) | `Meetup` | `Meetup` |

**External links 포맷**: 브랜드명만 dot-joined 한 줄 — `Flatio · Anyplace · Meetup`. 각각이 하이퍼링크(`--primary`), 구분자는 `--muted-foreground`. 한 줄 수용 위해 카테고리 라벨("숙소 찾기" 등)과 화살표(`→`) 모두 제거. 브랜드만으로 의미 불명확한 리스크는 감수 — 카드 폭 제약에서 overflow 방지를 최우선으로. 유저가 실제로 어디로 가는지는 클릭 전 tooltip 또는 호버 상태에서 도메인 노출로 확인 가능.

- **포맷 원칙**: `{기능} [({브랜드})] →`. 기능이 주 라벨, 브랜드는 동일 기능의 다른 옵션을 구분할 때만 괄호로 부기.
- **visa_url 배치**: 비자 섹션 조건 라인에 dot-joined로 통합 (`최대 체류 12개월 · 연장 가능 · 비자 확인하기 →`) — 비자 관련 정보를 섹션 하나로 응집. External links는 **action/유통 성격 3개**(숙소 × 2 + 모임)로 정제되어 역할 일관성 확보.
- Flatio/Anyplace가 동일 "숙소 찾기" 라벨을 공유 — 동일 기능의 **두 옵션을 동시 노출**하는 패턴 (분기 큐레이션 대신 유저 선택권 제공).
- `nomad_meetup_url`은 단일 소스이므로 브랜드 표기 불필요.
- **도시 쿼리**: 모든 URL은 이미 도시별 쿼리를 포함 — 예: `flatio.com/s?destination=kuala-lumpur`, `anyplace.com/rent/kuala-lumpur`, `meetup.com/digital-nomads-kuala-lumpur/`. 빈 페이지 이동 없음.
- **결측 처리**: `nomad_meetup_url`은 52개 중 11개 도시에서 null/빈값 — 해당 링크만 조건부 생략. 숙소 2개와 visa_url은 52/52 모두 채워져 있음.
- **잠금 카드(state=locked):** **정보 완전 은닉 skeleton** (아래 Locked Teaser 규칙)

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

## Card Front — Tarot Convention (상단 심볼 / 중앙 인물 / 하단 라벨)

Card 앞면은 전통 타로 카드의 3-section 문법을 따른다 — `상단 심볼` + `중앙 주인공` + `하단 카드명`. 앞뒤 레이아웃이 동일한 골격(심볼/주인공/NNAI)이고 **"주인공만 교체"** — 뒷면은 compass rose가 주인공, 앞면은 도시 정보가 주인공.

### 구성 (위→아래)

1. **상단 심볼 (compass mini)**
   - 뒷면의 `CompassRose`와 동일 glyph, `diameter` 축소판 (sm: 20, md/lg: 24)
   - 뒷면은 full-size 중앙 compass, 앞면은 축소 compass가 상단에 위치 → "echo" 관계
   - Hover/active 시 `--border` → `--primary` (뒷면 selected와 동일 로직, trigger만 다름)

2. **중앙 (flex-1, 주인공)**
   - Flag emoji: `SIZE_CONFIG.flag` (sm: 24, md/lg: 28) centered
   - City KR: Noto Serif KR **Bold**, `SIZE_CONFIG.cityKr` (sm: 14, md/lg: 18), `--foreground`
   - City + country: Geist Mono, `SIZE_CONFIG.cityEn` (sm: 9, md/lg: 11), `--muted-foreground`, `letter-spacing: 0.03em`

3. **하단 divider** — 1px, `color-mix(--border 40%, transparent)`

4. **하단 NNAI 라벨**
   - Geist Mono, `SIZE_CONFIG.nnaiFs` (sm: 8, md/lg: 10), `letter-spacing: 0.2em`
   - Hover/active: `--muted-foreground` → `--primary` (compass mini와 색상 동기화)
   - 뒷면 NNAI와 **같은 위치·같은 스타일** (앞뒤 일관)

### Metric/Value 금지

- Card 앞면에 **수치(monthly_cost/visa_free_days/internet_mbps) 노출 금지**
- 모든 수치는 Lightbox(1단 상세) 또는 Pro 가이드(2단 상세)에서 제공
- 이유: Card = "도시의 얼굴 · 식별", Lightbox = "프로필 · 요약", Pro 가이드 = "상세 문서"의 3단 계층을 흐리지 않기 위함
- 또 다른 이유: `$1,400` / `약 196만원` / `VISA-FREE / 90 days` 등이 좁은 카드(sm=140px) 폭에서 wrap을 유발했고, 축약(`90d`, `80M`)은 의미 훼손으로 불가 → 수치를 Card에서 뺌으로써 근본 해결

## 텍스트 줄바꿈 정책

Lightbox 카드 루트 `<motion.div>`에 `word-break: keep-all` + `overflow-wrap: break-word`를 적용한다. CJK(한국어) 텍스트가 브라우저 기본값으로 글자 단위에서 줄바꿈되는 것을 막고, **어절/공백/구두점 경계**에서만 wrap되도록. 영문은 기본 동작(공백 기준)을 유지, 너무 긴 영단어/URL은 `overflow-wrap`으로 안전망.

- 적용 스코프: Lightbox 카드 전체 (공개 FrontContent + LockedTeaser 공통)
- 효과: `city_description`(2-3줄 wrap), `personalInsight`(✦ 한 줄), Login CTA 타이틀/서브카피, visa 조건 라인 등 모든 한국어 텍스트가 어절 단위로 읽히게 됨
- Tailwind 대신 inline style로 적용 — `wordBreak: "keep-all"` + `overflowWrap: "break-word"` (Tailwind 버전 무관, CSS 상속)

## i18n 정책

**Locale 결정 (`frontend/src/i18n/routing.ts`):**
- `defaultLocale: "ko"` — 서비스 타겟이 한국 디지털 노마드이므로 기본값은 한국어
- `localeDetection: false` — 브라우저 `Accept-Language` 기반 자동 redirect 끔. 시스템 언어가 영어인 한국 유저(실제 발생한 엣지케이스)가 `/en/`로 이동해 혼재 콘텐츠 보는 것을 차단
- 영어 locale은 유저가 **명시적으로** URL(`/en/...`) 또는 언어 스위처로 진입할 때만

**영어 locale에서 생략되는 한국어 전용 데이터:**
| 필드 | 이유 |
|---|---|
| `city_kr` | 한국어 도시명. 영어 locale은 `city, country`만 노출 |
| `city_insight` | 영어 번역 데이터 미보유 (ko JSON 50건만) |
| `city_description` | 영어 번역 데이터 미보유 |
| `visa_type` 한글 잔존 시 | "없음 (솅겐 90일 활용)" 등 7개 국가 — visa 섹션 전체 생략 |

Lightbox 컴포넌트는 `showCityKr` / `showCityInsight` / `showCityDescription` / `showVisaSection` 가드 변수로 조건부 렌더.

**Visa 이름 정규화 (`normalizeVisaType`):**
모든 locale에서 **영문 비자명 노출 원칙** (공식성/식별성 우선). 2단계 처리:
1. 국가 prefix 제거 ("Colombia Digital Nomad Visa" → "Digital Nomad Visa") — CO/GR/HR 3건
2. 한글 제거 — 양방향 괄호 패턴 매칭
   - "영어 (한국어)" → 괄호 블록 삭제 (예: `Freiberufler (프리랜서 비자)` → `Freiberufler`)
   - "한국어 (영어)" → 괄호 내용만 추출 (예: `임시거주비자 (Temporary Resident Visa)` → `Temporary Resident Visa`)
   - 매칭되는 영문 대응이 없으면 원문 유지 (best-effort)

대응 영문이 없는 7개 국가(CZ/MA/MK/PY/QA/RS/VN — "없음/무비자" 계열)는 영어 locale에서 visa 섹션 자체를 렌더하지 않음.

**영어 번역 데이터 확장은 별도 이니셔티브 (T3)**: `city_insights.en.json` / `city_descriptions.en.json` 추가, `visa_db`에 한/영 분리 필드. 로드맵 과제.

## Information Hierarchy (3-tier)

| Layer | Role | Content |
|---|---|---|
| **Result Card** | 식별 + 도시의 얼굴 | flag, city_kr, city/country, compass mini(echo), NNAI |
| **Lightbox Card** | 요약 + 보조 지표 + 전환 | + MONTHLY/VISA/INTERNET metrics, scores pill(치안/영어), 비자 섹션, login CTA |
| **Pro 가이드** | 상세 문서 | + city_insight, city_description, 타임라인, 외부 링크, data_verified_date |

각 레이어는 상위 레이어를 **반복하지 않고 확장**한다. Lightbox가 Card의 단순 확대가 아니라 "한 단계 더 파면 새 정보가 나오는" 독립 가치를 갖는다.

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

**Visa 섹션 데이터 규칙:**
- **헤더**: `추천 비자` (ko) / `Recommended Visa` (en) — NNAI가 이 도시에 제안하는 비자라는 맥락 명시 (단순 "비자"보다 context 강화)
- **비자명** (`visa_type`): `normalizeVisaType(visa_type, country)`로 정규화 — 국가명 prefix가 있으면 제거 ("Colombia Digital Nomad Visa" → "Digital Nomad Visa"). country의 복합 표기 "Colombia (Medellín)"는 `split(' (')[0]`로 primary name만 추출해 매칭. 39개 중 CO/GR/HR 3건만 prefix 제거 대상.
- **체류 기간** (`stay_months`): `최대 체류 {n}개월` (ko) / `Max stay {n} months` (en). null이면 생략. 단순 `{n}개월`은 무엇의 기간인지 모호했으므로 "최대 체류" 접두사로 의미 명시.
- **연장 여부** (`renewable`): `true` → `연장 가능` / `Renewable`, `false` → `연장 불가` / `Non-renewable`, null이면 생략. "갱신" 대신 "연장"(일상 한국어 + renewable의 자연스러운 번역) 사용.
- **조건 줄 연결**: `stay_months`와 `renewable` 둘 다 있으면 ` · ` 구분자로 한 줄. 하나만 있으면 해당 값만.
- **소득 요건/수수료 미포함 (E-1)**: `min_income_usd`, `visa_fee_usd`는 데이터에 있지만 Lightbox에 포함 안 함. 3-tier 원칙(Lightbox=요약, Pro 가이드=상세)상 상세 조건은 Pro 가이드로 이관.

**Scores (치안/영어/기후) 섹션 — Secondary qualifier 3개:**
- Primary 3 metric(MONTHLY/VISA/INTERNET)과 **1:1 대응하는 Secondary 3 배지**. "Primary = filter, Secondary = qualifier" 층위 분리.
- pill/badge 형태로 flex wrap (3개면 sm 카드폭에서 자연 한 줄).
- 스타일: `font-mono`, `text-[10px]`, `border: 1px var(--border)`, `border-radius: 9999px`, `color: var(--muted-foreground)`, `letter-spacing: 0.03em`
- 각 값 null이면 해당 pill 생략. 3개 모두 null이면 섹션 전체 생략.

**Secondary 배지 3종:**
| 배지 | 데이터 소스 | ko 포맷 | en 포맷 |
|---|---|---|---|
| 치안 | `safety_score` (1–10) | `치안 6/10` | `Safety 6/10` |
| 영어 | `english_score` (1–10) | `영어 8/10` | `English 8/10` |
| 기후 | `climate` (범주형 9종) | `{매핑} 기후` | `{capitalized}` |

**Climate 매핑 (ko):**
- `tropical` → 열대 기후
- `subtropical` → 아열대 기후
- `mediterranean` → 지중해성 기후
- `continental` → 대륙성 기후
- `maritime` → 해양성 기후
- `temperate` → 온대 기후
- `desert` → 사막 기후
- `semi-arid` → 반건조 기후
- `highland` → 고산 기후
- 미매핑 값 → `{원본} 기후`로 fallback

영어 locale은 첫 글자 capitalize (`Tropical`, `Semi-arid`).

**배지 후보에서 의도적으로 제외된 것:**
- **코워킹 점수**: INTERNET(Primary)의 파생 지표 성격 강함 → 정보 중복
- **한인 커뮤니티 (`korean_community_size`)**: "한인"이라는 용어가 맥락 의존적 — 배지 단독으로 self-explanatory하지 않음
- **노마드 점수 (`nomad_score`)**: Primary 3 metric의 overall 평균 성격 → 중복
- **연평균 기온 (°C)**: 데이터 없음. 추가하려면 외부 소스 import 필요 (현재 보류)
- **외부 노마드 랭킹 (Nomad List 등)**: 데이터 없음. 장기적으로 정보 가치 높지만 매년 갱신 pipeline 부담 → 보류

**Primary Login CTA:**
- 기존 transparent border 스타일에서 `--primary` 배경으로 강화 — 라이트박스의 유일 전환 지점
- 구성: serif 헤딩 `{city_kr} 맞춤 이민 가이드 받기` + 11px 서브카피 + Google 로고 + `"Google로 계속하기 →"` 텍스트
- amber glow 적용 금지 (selected 전용 정책 유지), hover는 `opacity: 0.9`로만 피드백
- `showLoginCta = locale === "ko" && isLoggedIn === false`일 때만 렌더. 로그인된 유저는 CTA 미노출, 하단 공간은 비워둔다 (카드 자연스러움).

**Personalized Insight (CityLightbox 상단, 비자 정보 위):**
- `getPersonalizedInsight(persona, travelType, timeline, city)` 헬퍼가 null 반환 시 미렌더
- 한국어 로케일 전용 (`locale !== "ko"` → null)
- 데이터 소스: `localStorage.persona_type` + `localStorage.result_session_v2 → parsedData._user_profile.{travel_type, timeline}` + city 객체
- 6가지 우선순위 분기 (동반자+치안 → 동반자+한인 → free_spirit+tropical → free_spirit+무비자90 → free_spirit+renewable → 단기+무비자60)
- 동반자 조건: `travel_type`에 `"배우자"`/`"파트너"`/`"가족"` 포함. copy는 중립 "동반자와 함께라면" 사용
- tropical 매칭: `city.climate?.includes("tropical")` → subtropical 포함
- UI: `font-serif text-sm`, `color: var(--primary)` (amber), `✦` prefix, border/배경 없음, 기존 `space-y-4` separator 공유 (추가 divider 금지)
- localStorage 읽기 실패/JSON.parse 실패 시 silent null

**Login CTA (Lightbox 하단 전환 지점):**
- 렌더 조건: `locale === "ko"` AND `fetch("/auth/me")` 결과 `logged_in === false`
- auth 체크는 쿠키 세션 기반 (프로젝트 실제 메커니즘). 네트워크 실패 시 기본 "로그아웃"으로 처리 (CTA 표시)

**구조 — 타이틀 한 줄 + Google 공식 Dark Theme 버튼**:
```
로그인하고 맞춤 노마드 로드맵 받기        ← 단일 제목 (serif, foreground)

┌─ Google Sign-In Dark Theme 버튼 ──┐
│ [G]  Google로 계속하기             │  ← #131314 bg, #E3E3E3 text, 1px #8E918F border
└──────────────────────────────────┘
```

- **타이틀**: `font-serif text-[13px] font-bold`, `--foreground` — `{city_kr}` 같은 도시명 prefix 없이 공통 문구. 서브카피는 콘텐츠 다이어트로 제거 (헤더 city 정보 + 타이틀의 "맞춤" 단어로 충분)
- **버튼**: Google Sign-In 공식 **Dark Theme 가이드 준수**
  - `background: #131314` / `color: #E3E3E3` / `border: 1px solid #8E918F`
  - `border-radius: 6px`, `padding: 10px 12px`, `gap: 10px`
  - `fontFamily: 'Roboto', 'Noto Sans KR', sans-serif`, `fontSize: 14px`, `fontWeight: 500` (Google 권장)
  - 내부: 표준 4색 G 로고(16×16) + `Google로 계속하기` (공식 승인 한국어 로컬라이즈 = "Continue with Google")
  - **화살표 `→` 금지** — Google 공식 버튼 텍스트에 화살표 없음
- 두 블록 사이 `gap-2` (8px)
- 클릭 액션: `buildGoogleLoginUrl(API_BASE, window.location.href)` 헬퍼로 `/auth/google?return_to=...` 리다이렉트 (기존 `GoogleLoginPanel.tsx`와 동일 메커니즘 재사용)

**HEX 예외 목록 (상표권/공식 가이드 준수):**
| 용도 | HEX | 출처 |
|---|---|---|
| Google G 로고 4색 | `#EA4335 / #4285F4 / #FBBC05 / #34A853` | Google Brand Guidelines |
| Google 버튼 Dark Theme bg | `#131314` | Google Sign-In Branding Guide |
| Google 버튼 Dark Theme text | `#E3E3E3` | 동상 |
| Google 버튼 Dark Theme border | `#8E918F` | 동상 |

위 HEX는 프로젝트의 "HEX 금지 → CSS 변수만" 규칙의 **명시적 예외**. 그 외 모든 UI는 여전히 CSS 변수만 사용.

**미래 과제 — Light Theme 전환 검토**: 현재 다크 카드와 톤 통합을 위해 Dark Theme 채택. 추후 카드 전체 Light Theme 도입 시 Google 버튼도 Light Theme (#FFFFFF bg + #1F1F1F text + #747775 border)로 함께 전환.

**카피 원칙:**
- **"이민 가이드" → "노마드 로드맵"**: 서비스 타겟의 실제 유스케이스는 원격근무/프리랜서/장기여행/은퇴거주 등 다양 — "이민"은 영구 이주 뉘앙스라 부적합. "노마드 로드맵"이 브랜드 포지셔닝(자기 발견 경험 입구)과 일치.
- **"AI가 생성해드려요" → "검증된 데이터를 제공해드려요"**: 생성형 AI 할루시네이션 우려 + AI 피싱 증가 시대에 "AI가 창작한다"는 프레이밍은 신뢰도 저하. 실제 NNAI는 `visa_db.json`/`city_scores.json` 등 **공식 소스**(Numbeo, NomadList 등 `source_refs`)를 LLM이 "개인 조건에 맞춰 정리"하는 구조 — 창작이 아닌 큐레이션. 카피가 이 사실을 정직하게 반영. AI 단어는 브랜드명(NNAI)에 내재하므로 서브카피에서 명시 불필요.

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
| 2026-04-20 | Lightbox 카드 내부 스크롤 제거 + 콘텐츠 다이어트 | 4:7 카드에 스크롤은 "카드" 메타포와 충돌. drop: `city_insight` / `city_description` / 외부 링크 / `data_verified_date`. 이들은 Pro 가이드로 이관 (라이트박스=요약, 가이드=상세). `flex-col + flex-1 spacer`로 CTA가 자연스럽게 하단 정렬. |
| 2026-04-20 | Scores(치안/영어)를 pill 층위로 분리 | 기존엔 metric(주)과 일반 텍스트(보조)가 평면 나열되어 중요도가 흐림. pill/badge로 시각 층위 구분 → metric이 주 지표, scores가 보조 컨텍스트임이 즉시 전달. 카드 폭 제약(≤320px)에서 metric grid를 5열로 확장하는 것보다 경제적. |
| 2026-04-20 | 비자 섹션 재설계: normalizeVisaType + serif 헤딩 + `갱신 불가` 조건부 | 39개 비자 중 3건(CO/GR/HR)만 "Country ..." prefix가 있어 헤더의 `City, Country`와 중복 → primary country name prefix를 제거하는 `normalizeVisaType` 유틸 도입. '갱신 가능'은 대다수 비자가 공유하는 기본값이라 정보 가치 낮음 → `renewable=false`일 때만 '갱신 불가'로 노출 (exception-only UX). "비자 정보"(mono 10px) 라벨 → "비자"(serif 13px bold) 헤딩으로 위계 강화. |
| 2026-04-20 | Login CTA를 transparent border → `--primary` 배경 블록으로 강화 | 라이트박스는 "자기 발견 입구 → 로그인 → Pro" 전환 깔때기의 핵심 지점. CTA 위계가 주변 콘텐츠보다 약하면 전환 손실. amber glow는 selected 전용 정책이므로 CTA는 primary 배경 + hover opacity로 차별화. |
| 2026-04-20 | Card 앞면 metric 전면 제거 → 3-B/B5 (compass mini + title + NNAI) | sm=140px 카드 폭에서 `$1,400` / `약 196만원` / `VISA-FREE` / `90 days` / `80Mbps` value가 wrap되는 문제를 축약(`90d`/`80M`)으로는 의미 훼손 없이 해결 불가. 대신 **3단 정보 계층(Card=식별, Lightbox=요약, Pro 가이드=상세)을 엄격히 분리** — 모든 수치는 Lightbox 이하로 이관. Card는 전통 타로 3-section(상단 심볼/중앙 인물/하단 라벨) 문법 채택 → 뒷면 compass rose와 앞면 compass mini가 "같은 세계관"의 echo 관계를 이룸. `readingText` prop 및 관련 JSX는 dead code로 제거. |
| 2026-04-20 | Information Hierarchy 3-tier 원칙 명문화 | 이전엔 각 레이어(Card/Lightbox/Guide)가 실질적 역할 분담 없이 같은 metric을 중복 표시했음. 원칙: **각 레이어는 상위 레이어를 반복하지 않고 확장한다.** Lightbox가 Card의 단순 확대가 아니라 한 단계 더 파야 나오는 독립 가치 확보 — MONTHLY/VISA/INTERNET/scores/비자/CTA는 Lightbox 이하 전용. |
| 2026-04-20 | Secondary 배지 2개 → **3개(치안/영어/기후)로 확장**, Primary 3과 1:1 대응 | 원래 2개 배지에서 대칭적 4개로 확장 검토. 후보 전수 검토 결과: **코워킹**은 INTERNET 파생(중복), **한인 커뮤니티**는 "한인" 용어의 맥락 의존성으로 self-explanatory 실패, **노마드 점수**는 Primary 평균 성격으로 중복, **연평균 기온/외부 노마드 랭킹**은 데이터 pipeline 부재. 남은 강한 배지 = 치안/영어/기후. 4개 대칭 대신 **"Primary 3 ↔ Secondary 3" 1:1 대응**이 정보 계층 원칙과 더 정합. `climate` 범주형을 한국어 "{xxx} 기후" 접미사로 표기해 배지 단독 self-explanatory 확보. |
| 2026-04-20 | 비자 섹션 copy 개선 — "비자" → "추천 비자", "{n}개월" → "최대 체류 {n}개월", `renewable=true`도 "연장 가능"으로 노출 | KL 케이스에서 헤더 "비자"가 context 부족 + "12개월"이 무엇의 기간인지 불명 + 연장 여부 한쪽만 노출되어 불완전. Secondary 배지 층위 분리 이후 비자 섹션은 "친절한 정보 요약" 역할로 재정의 → 긍정 쪽도 정보 가치 보유(이전 "당연한 긍정은 노이즈" 원칙 맥락 전환). "갱신" → "연장"은 일상 한국어 + renewable 번역 자연스러움. E-1: `min_income_usd`/`visa_fee_usd`는 3-tier 원칙상 Pro 가이드로 이관, Lightbox는 요약 역할 유지. 명사만 사용하는 일관성 유지. |
| 2026-04-20 | **city_insight + city_description 복원** (drop 철회) | 초기 콘텐츠 다이어트에서 Pro 가이드로 이관했으나, 실제 데이터 길이 검토 결과 insight 평균 21자 + description 평균 93자로 공간 부담 적음. NNAI 서비스 포지셔닝("자기 발견 경험 입구")의 **감성 축**을 담당하는 핵심 텍스트 — 실무(metrics/visa)만으로는 "이 도시가 나에게 어떤 의미인지" 전달 부족. reading flow: Scores(숫자) → ✦(유저 맥락) → city_insight(도시 slogan) → city_description(도시 설명) → 비자(실무) → CTA(전환)으로 감성→실무→전환 자연 흐름. 3-tier 원칙은 여전히 유효 — 외부 링크/data_verified_date 같은 reference 성격은 Pro 가이드 이관 유지. |
| 2026-04-20 | **External links 복원** (유통 BM 반영) | `flatio_search_url`/`anyplace_search_url`은 서비스의 **유통 수익 모델 핵심 접점**. Lightbox는 유저가 도시별로 머무는 단일 전환 깔때기이므로 여기서 숙소 affiliate 링크가 빠지면 수익 구조 자체가 작동하지 않음. `nomad_meetup_url`(커뮤니티 engagement), `visa_url`(공식 reference)도 함께 복원. 스타일: Visa section 아래 `flex-wrap`, `text-[11px]` `--primary`, 영어 locale 라벨 매핑(Visa info / Flatio / Anyplace / Meetup). spacer가 자동 흡수하므로 CTA 레이아웃 영향 없음. `data_verified_date`만 drop 유지 — 실무 수익 vs 데이터 reference의 가치 차이. |
| 2026-04-20 | External links 워딩 통일 — `{기능} [(브랜드)] →` 포맷 | 초기 워딩(`비자 정보 / 숙소 찾기 / Anyplace / 밋업`)은 축이 혼재(카테고리·action·브랜드·장르)되어 유저 파악 실패. 특히 한국 유저에겐 Flatio/Anyplace 브랜드 생소 + Meetup만 브랜드 생략되어 일관성도 깨졌음. 원칙 재수립: **기능이 주 라벨, 브랜드는 동일 기능 옵션 구분용 괄호로만**. Flatio vs Anyplace 분기 큐레이션(stay_months 기반) 대신 **둘 다 같은 "숙소 찾기" 라벨 + 브랜드 괄호로 동시 노출** — 분기 로직 자의성 회피 + 파트너십 공정성 + 유저 선택권. 최종 4개: 비자 확인하기 / 숙소 찾기 (Flatio) / 숙소 찾기 (Anyplace) / 노마드 모임 찾기. |
| 2026-04-20 | **i18n 정책 — defaultLocale ko + localeDetection off + 영어 locale 방어막** | **엣지케이스 발견**: 한국인 유저의 시스템 언어가 영어라 브라우저 `Accept-Language: en-US`로 자동 `/en/`로 redirect됨. 결과: UI 라벨은 영어, 일부 데이터(city_kr/city_insight/city_description/한글 visa_type)는 한국어로 혼재 노출. **해결**: (T1) 서비스 타겟이 한국이므로 `defaultLocale: ko` + `localeDetection: false`로 자동 redirect 차단, 유저의 명시적 선택으로만 locale 전환. (T2a) 영어 locale에서 한국어 전용 데이터 4종(`city_kr`, `city_insight`, `city_description`, 한글 `visa_type`) 생략 가드 추가. (T2b) `normalizeVisaType`에 한글 제거 로직 확장 — 모든 locale에서 영문 비자명 원칙. T3(영어 번역 데이터 pipeline)은 별도 로드맵. |
| 2026-04-20 | Lightbox body 순서 재배열 + visa_url을 비자 섹션 조건 라인에 통합 | 기존 순서(Scores → ✦ → insight → description → Visa → Links)는 "감성→실무" 흐름이었으나, 실제 노마드 decision funnel은 "이 비자로 갈 수 있는가?"가 첫 관문이라 Visa를 상단에 배치하는 것이 더 natural. 새 순서: Visa → External links → city_insight → ✦ → city_description → Scores → CTA. 부가 효과 — Header 밑 Primary metrics grid와 Scores pills가 시각적 거리를 확보해 숫자 중복 피로 해소, Scores가 pill 형태로 카드 마감 "엔드 마크" 역할. visa_url은 External links에서 제거하고 비자 섹션 조건 라인에 dot-joined로 통합(`최대 체류 12개월 · 연장 가능 · 비자 확인하기 →`) — 비자 관련 정보 응집 + External links가 action/유통 3개(숙소×2 + 모임)로 정제되어 역할 일관성 확보. |
| 2026-04-20 | Login CTA 카피 재작성 — "이민 가이드/AI 생성" → "노마드 로드맵/검증된 데이터" | PM 관점 재검토로 기존 카피의 2가지 문제 확인. (1) "**이민 가이드**"는 서비스 타겟 유스케이스(원격근무/프리랜서/장기여행/은퇴거주)와 불일치 — "이민"은 영구 이주 뉘앙스. → "**노마드 로드맵**"으로 교체, 브랜드(NNAI = Nomad Navigator)와 일관. (2) "**AI가 생성해드려요**"는 생성형 AI 할루시네이션 우려 + AI 피싱 증가 시대에 유저 불안을 오히려 자극. 실제 NNAI 파이프라인은 공식 데이터(Numbeo/NomadList 등 `source_refs`) + LLM 개인화 조합이지 "창작"이 아님. → "**당신에게 맞는 검증된 데이터를 제공해드려요**"로 교체. "검증된 데이터"가 신뢰 신호, "당신에게 맞는"이 개인화 가치. AI 단어는 NNAI 브랜드명에 내재하므로 서브카피에서 삭제. |
| 2026-04-20 | Lightbox 레이아웃 미세 조정 + Login CTA 구조 분리 (Option α) | (1) visa_url 링크(`비자 확인하기 →`)를 `--primary`에서 `--muted-foreground` + underline으로 변경 — 조건 라인(`최대 체류 N개월 · 연장 가능`)의 muted 톤과 일치시켜 "조건의 연장선"으로 자연스럽게. 링크임은 밑줄로 신호. (2) External links(숙소 × 2 + 모임)를 Visa 섹션 바로 아래에서 **Scores pills 아래**로 이동 — "외부 action(이탈)"을 CTA(전환) 직전에 배치해 "외부로 가거나 / NNAI와 계속"의 선택을 명확히 병치. (3) "노마드 모임 찾기 →"에 `(Meetup)` 브랜드 복원 — Flatio/Anyplace와 일관성. "동일 기능이면 동일 포맷" 원칙. (4) **Login CTA 구조 분리** — 기존엔 전체 `<button>`이 primary 배경이라 "정보 블록 + 버튼"처럼 보이지만 기능적으론 "전부가 버튼"인 시각/기능 불일치. Option α 적용: 제목/서브카피는 일반 텍스트 div(배경 없음), Google 버튼만 primary 배경. 정보는 정보, 액션은 액션으로 분리. |
| 2026-04-20 | Lightbox 한국어 어절 단위 줄바꿈 (`word-break: keep-all`) | 한국어 텍스트(`personalInsight` / `city_description` 등)가 브라우저 기본값으로 **글자 단위**에서 줄바꿈되어 "실롬,/ 아리/, 통로 지역이" 같은 가독성 저하 현상. CJK 전용 CSS `word-break: keep-all` 적용하면 공백·구두점 경계에서만 wrap → "실롬, 아리, 통로 지역이 / 노마드에게 인기 있고" 같이 자연 읽기 가능. `overflow-wrap: break-word`로 긴 영단어/URL 안전망. Lightbox 카드 루트에 한 번 inline style로 적용해 하위 모든 텍스트에 CSS 상속. |
| 2026-04-20 | Lightbox 추가 다이어트 — CTA 축소 + External links 브랜드만 + 비자 라인 재배치 + Google Dark Theme 공식 버튼 | 4:7 카드 비율 유지 시 콘텐츠 overflow 발생 (CTA 잘림). "스크롤 허용" 대신 **콘텐츠 다이어트**로 대응: (1) CTA 제목 `{city_kr} 맞춤 노마드 로드맵 받기` → `로그인하고 맞춤 노마드 로드맵 받기` (city_kr 중복 제거, "로그인하고" 액션 명시). (2) CTA 서브카피 `당신에게 맞는 검증된 데이터를 제공해드려요` 완전 삭제 — 제목의 "맞춤" 단어로 충분. (3) External links를 `숙소 찾기 (Flatio) → 숙소 찾기 (Anyplace) → 노마드 모임 찾기 (Meetup) →` 3줄/2줄에서 `Flatio · Anyplace · Meetup` 한 줄로 축약 — 카테고리 라벨과 화살표 전부 제거해 공간 확보, 브랜드명만으로 의미 전달 리스크는 수용. (4) 비자 섹션의 visa_url 링크를 조건 라인에서 비자명 줄로 이동 — `DE Rantau Nomad Pass ← flex justify-between → 비자 확인하기 →` 형태로 한 줄에 병치. 조건 라인은 `최대 체류 · 연장 가능`만. (5) **Google 버튼 공식 가이드 준수** — amber primary 배경 위반. Dark Theme 채택(#131314 bg, #E3E3E3 text, 1px #8E918F border), 화살표 `→` 제거, "Google로 계속하기"만. HEX 예외 목록에 추가. 추후 Light Theme 전환 시 카드 전체와 함께 재검토. |
