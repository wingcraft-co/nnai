# CONTEXT.md
_Last updated: 2026-05-01 KST (세션 8)_

## 프로젝트 개요
- 서비스명: NomadNavigator AI (NNAI)
- 목적: AI 기반 디지털 노마드 이민 설계 서비스 (Gemini 2.5 Flash로 최적 거주 도시 TOP 5 추천 + 비자/예산/세금 상세 가이드)
- 현재 단계: 개발 (백엔드+프론트엔드 운영 중, 스코어링 로직 고도화 완료)

## 기술 스택 현황
- Frontend: Next.js 16 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui, Framer Motion
- Backend: FastAPI (Python 3), Gemini 2.5 Flash (OpenAI compat)
- DB: PostgreSQL
- Infra: Vercel (frontend, nnai.app / dev.nnai.app) + Railway (backend, api.nnai.app / api-dev.nnai.app) + Cloudflare DNS

## 현재 상태

### 추천 로직
- **TOP5** 규칙 기반 DB Recommender (LLM 개입 없음, `top_n=5`)
- **2단계 API**: `/api/recommend` → session_id 반환 (도시 데이터 미포함) → `/api/reveal` → 선택한 3장 상세 데이터 반환 (백엔드 게이팅)
- **Block 가중치 동적 분기**: 단기(A40/B10/C40/D10), 중기(A30/B25/C30/D15), 장기(A30/B25/C25/D20)
- **immigration_purpose → Block A 가중치**: 목적별로 nomad/safety/cowork/internet 비율 동적 변경
- **Fuzzy 페르소나**: 퀴즈 결과를 비율 벡터로 변환, Block C에서 모든 페르소나를 소속도로 블렌딩
- **Derived UserPriority**: 소득/동행/체류형태/라이프스타일에서 block별 배율을 암묵적으로 추론 (cross-block 영향)
- **Block C 가상 속성**: visa_freedom, climate_score, long_stay_score

### 프론트엔드
- **Information Hierarchy (3-tier) 원칙**: Result Card = 식별 (얼굴) / Lightbox = 요약 + 전환 / Pro 가이드 = 상세 문서. 각 레이어가 상위를 반복하지 않고 확장.
- **Result Card 재설계 (3-B/B5, 4:7 비율)**: Card 앞면은 전통 타로 3-section 구조 — 상단 compass mini(뒷면 compass rose의 echo) + 중앙 flag/city_kr/city·country + 하단 NNAI. **수치 metric 완전 제거** (Lightbox로 이관). Hover 시 compass mini + NNAI 모두 `--primary` echo.
- **카드 비율**: 4:7 (Rider-Waite 실측 11:19과 오차 1%). 기존 디자인 문서의 2:3 기재는 오기 정정됨.
- **CityLightbox 10단계 body 구조**: Header(flag/city/country) → Primary metrics 3×3 grid → **city_insight**(감성 intro, center align, 세로선 없음) → **비자 섹션**(비자명 자체가 ExternalLink 링크 + 조건 라인) → Personalized Insight(✦, ko 전용) → city_description → **Qualitative 태그 top 3 + climate neutral pill** → External links 한 줄(center align) → spacer → **Login CTA**(정보 div + Google 공식 버튼, 하단 여백 pb-8).
- **Qualitative 태그 시스템 (뱃지 교체)**: 기존 `치안 N/10 · 영어 N/10 · {기후} 기후` 고정 3개 → **임계 돌파 강점 top 3 + climate neutral pill**로 교체. `computeCityTags(city, locale)` 함수가 7 카테고리(safety/english/nomad/coworking/community/korean_community/cowork_cheap)에서 임계 초과 폭 내림차순 + tie-break 카테고리 우선순위로 top 3 선정. 내부 점수(safety_score=Numbeo+GPI 블렌딩, english_score=내부 판단 등 근거 강도 이질적)는 recommender sort/filter에 그대로 사용하되 UI에는 qualitative 태그만 노출하여 객관성 불균형 해소. climate는 장단점이 아닌 취향이라 pill row 끝에 `opacity 0.75`로 중립 descriptor 유지. 임계값·라벨은 `format.ts` 상수.
- **비자 섹션**: "추천 비자" serif 헤딩 + **비자명 자체가 underline 링크 + ExternalLink 아이콘**. 조건 라인 `최대 체류 N개월 · 연장 가능/불가`. `normalizeVisaType` 헬퍼로 국가 prefix 제거 + 한글 제거 (MX/JP/DE/NL 등 혼재 케이스 영문 추출).
- **External links**: 한 줄 dot-joined `월세 숙소 찾기 · 단기 숙소 찾기 · 노마드 모임 찾기`. 각 카테고리 `--primary` underline 링크. 실제 destination: Flatio/Anyplace/Meetup. 브랜드명 생략.
- **Login CTA (ko 전용)**: 정보 div(배경 없음, center align) + Google 공식 `.gsi-material-button` Dark Theme 버튼. 제목 "로그인하고 {city_kr} 맞춤 가이드 받기" (font-medium, center). 버튼: pill shape, Roboto Medium 500, 공식 HTML 구조(state overlay + content-wrapper + icon + contents).
- **잠금 카드 Lightbox skeleton teaser**: 선택 안 된 2장 lightbox 진입 시 도시 식별 정보 일체 숨김(skeleton 블록), "Pro로 모든 도시 보기" CTA. 추론 방지.
- **Lightbox 네비게이션**: 5장 순환 (선택 3 + 잠금 2). ‹ › 외부 버튼 + × 우상단 + ← → ESC 키보드.
- **i18n 정책**: `defaultLocale: ko` + `localeDetection: false`. 영어 locale 방어막 4종(`showCityKr/Insight/Description/VisaSection`) — 한국어 전용 데이터는 en locale에서 생략.
- **한국어 어절 단위 줄바꿈**: Lightbox 루트에 `word-break: keep-all + overflow-wrap: break-word` — CJK 기본 글자 단위 wrap 방지.
- **Google Sign-In 공식 준수**: `globals.css`에 `.gsi-material-button` Dark Theme CSS 블록 원본 복제. Roboto Medium 500 `next/font/google` self-host 로드. 서버사이드 OAuth redirect 방식이라 deprecated `gapi.auth2` / FedCM migration 무관.
- **/guide/[city_id] 데모 페이지**: LLM 풀 가이드 prototype (방콕 MOCK). 회의용 시연. 실제 API 연동은 추후.
- **폼 자동 넘김**: 단일 선택 + 조건부 필드 없음 → 자동 다음 스텝
- **단기 체류**: 소득 대신 월 예산 버튼 선택, 배우자 소득 숨김
- **캐릭터**: 폼에서 스텝 간 슬라이드 이동 (퀴즈 경유=페르소나, 직접 진입=grace+rocky)
- **디자인 시스템**: `docs/designs/tarot-card-design.md` — 카드 색상, 타이포, 레이아웃, 상태, 인터랙션, i18n, 줄바꿈 정책 전부 정의

### 데이터
- visa_db.json에 `visa_free_days` 필드 추가 (39개국, 한국 여권 기준)
- 결과 카드에 비자 배지 (무비자 N일 / 셴겐 / 비자 필요)

### 테마 zone (세션 8 명문화)
- **Dark zone (ritual)**: /result + Lightbox + /guide. 자기 발견 경험 입구, 5장 펼침→reveal→상세 reading 흐름이 ritual moment
- **Light zone (일상)**: 랜딩 + form + quiz + /dashboard. 입력/관리/일상 모드. rosie의 dashboard apple-style light theme이 zone semantics와 정합 (의미 있는 분리, 통일 시도 금지)
- **RitualTransition** (`frontend/src/components/transition/RitualTransition.tsx`): /result mount(light→dark 진입), /dashboard mount(dark→light 출구) 두 경계에 600ms black overlay fade-out. CSS @keyframes ritual-transition-fade

### 상세 가이드 양식 (세션 8 신규)
- **Country Briefing 양식** — IMF Country Report / DFAT Country Brief / Tufte LaTeX 합성 정부 보고서 톤
- 위치: `frontend/src/components/guide/CountryBriefingDocument.tsx` (1080px 고정 width HTML), `frontend/src/components/guide/BriefingPngPreview.tsx` (html-to-image 캡쳐 wrapper)
- **구조**: Masthead(NomadNavigator AI · Wingcraft + Personal Briefing 도장) → Document № NNAI-{cc}-{date}-{userhash6}(SHA-256 6 hex) → Title(SERIF 38/700) + 공식 국명(italic) → Issued / Prepared for 메타 → Quick Facts 4 컬럼(VISA/STAY/MONTHLY/TAX RES.) → 1./1.1./1.1.1. 본문 → References(4-field 학술 인용) → Footer
- **Typography**: 장 SERIF 22/700 + 52px gutter 번호 / 절 SERIF 14/700 normal case 인라인 번호 / 항 SANS 13/400 + italic (a)(b)(c) marker (Tufte 컨벤션, 같은 폰트 메트릭으로 baseline lock)
- **층위는 typography + spacing 만으로** — 가로선으로 hierarchy 만들기 금지(Tufte/USWDS 컨벤션). 가로선은 document zone boundary(masthead↔doc control, meta↔quickfacts, body↔footer, 표 top/bottom) 4곳만
- **본문 paragraph**: 첫 줄 16px 들여쓰기 (인쇄 컨벤션, parskip 0)
- **References**: { issuer, title (italic), year, url } 4-field 학술 인용. 추적 가능 URL 필수 (overseas.mofa.go.kr/{cc}-ko, numbeo.com/cost-of-living/in/{slug}). 5개 출처(MFA/Embassy/NHIS/Numbeo/SafetyWing) 동적 plug-in
- **Quick Facts**: city object의 enriched 필드(visa_type/visa_free_days/monthly_cost_usd/stay_months) 실값 plug-in. 값 없으면 em-dash "—". placeholder("Refer to..."), § 기호 절대 금지
- **워터마크 (필름풍)**: "WINGCRAFT · NNAI · {date}" condensed sans 500 26px letter-spacing 0.22em opacity 0.07 -30° 회전 brick pattern
- **deps**: html-to-image ^1.11.13 (~30KB no transitive deps), Source_Serif_4 + Inter `next/font/google`

### dev preview 진입점 (세션 8 신규)
- 랜딩 하단 [로그인 후 플로우] FREE / PRO 토글 — 백엔드 호출 우회 + mock 데이터로 result→guide→dashboard 시각 검증
- URL flag: `?dev_preview=1&plan=free|pro`
- Hook 4지점: TarotDeck(isLoggedIn 강제 true + /auth/me 우회), guide 페이지(/api/billing/status·/api/detail 우회 + mock briefing), dashboard 페이지(/api/dashboard 우회 + mock plan/widgets), handleDetailClick(navigation 시 flag propagate)
- Mock 데이터: `frontend/src/lib/dev-preview.ts` (billing/quota/dashboard) + `frontend/src/lib/briefing-data.ts` (Country Briefing)
- 본 인프라는 향후 모든 백엔드-게이트 흐름 시각 디버깅에 재사용 가능

## 주요 API 변경사항 (아내팀 주의)

### POST /api/recommend — 응답 구조 변경
```json
{
  "session_id": "abc123",
  "card_count": 5,
  "parsed": { "top_cities": [...], ... }
}
```
> 도시 상세 데이터는 응답에 포함되지 않음. `/api/reveal` 호출 필요.

### POST /api/reveal (신규)
```json
// 요청
{ "session_id": "abc123", "selected_indices": [0, 2, 4] }
// 응답
{ "revealed_cities": [ {도시 상세}, {도시 상세}, {도시 상세} ] }
```

### RecommendRequest 신규 필드
- `total_budget_krw: int | None` — 단기 체류 시 월 예산 (만원)
- `persona_vector: dict[str, float] | None` — 퍼지 페르소나 벡터

### 타로 세션 (인메모리)
- `api/tarot_session.py` — 서버 메모리에 5장 저장, reveal 시 3장 반환
- **Railway 재배포 시 세션 초기화됨** — 추후 DB/Redis 마이그레이션 필요

### 팀 작업 — Pro 도시 대시보드 신규 (rosie, 2026-04-26)
> 자세한 스펙은 `cowork/backend/api-reference.md` / `db-schema.md` 참조

- `GET /api/dashboard` → 활성 플랜 + 위젯 설정 + catalog 반환
- `POST /api/dashboard/confirm` → 도시 확정 (기존 active → archived, 사용자당 1개 active)
- `PATCH /api/dashboard/widgets` → enabled/order/settings 저장
- `PATCH /api/dashboard/plan` → arrived_at/visa_type/coworking_space/tax_profile 갱신
- 신규 테이블: `user_city_plans` (active 1개 unique partial index), `dashboard_widget_settings`
- 권한: `plan_tier='pro'` + `status IN ('active','grace')` 만 쓰기/조회

### 팀 작업 — Detail 가이드 캐시 + 무료 quota (rosie, 2026-04-26)
- `POST /api/detail` 응답에 `cached`, `quota` 필드 추가
- 신규 테이블: `detail_guide_cache` (PK = user_id + cache_key, cache_key = `_user_profile + selected_city` SHA-256)
- 무료: cache miss 기준 2회. Pro: 무제한
- 402 에러 포맷 변경 (`Free detail guide quota reached.` + quota 객체)
- `frontend/src/lib/guide-export.*` — 가이드 내보내기 plan-gating

### 팀 작업 — DB hardening (rosie, 2026-04-21~22)
- `utils.db.ensure_database_ready()` 도입 — readiness check 우선, 빈 DB일 때만 advisory lock 후 `init_db()`
- DB connection recovery / transaction release / auth flow 강화 (DB 다운 시 `/auth/me` 503 + `auth_error=db` redirect)
- `DATABASE_PUBLIC_URL` env fallback 추가 (로컬 접속용)
- `scripts/init_db.py` 신설 (수동 초기화 진입점)
- `frontend/src/components/legal/UserAccountMenu.tsx` 신규

## 스코어링 로직 전체 구조

```
City_Score = Σ (Block_i × BlockWeight_i × DerivedPriority_i)

Block A (기본 적합도): purpose별 nomad/safety/cowork/internet 가중치 동적
Block B (재정 적합도): cost_score(50%) + tax_bonus(50%)
Block C (페르소나 적합도): Fuzzy 블렌딩 또는 단일 페르소나 (미선택 시 0 → Block A 합산)
Block D (실용 조건): visa + language + companion + wellbeing

DerivedPriority: 소득/동행/체류형태/라이프스타일/목적에서 암묵 추론
BlockWeight: 체류 기간별 동적 (단기/중기/장기)
```

## 진행 중인 작업
- [x] Block 가중치 동적 분기 (체류 기간 기반)
- [x] Block C 페르소나 가중치 재설계 (서사 정렬)
- [x] 단기 체류 총 예산 UI + 백엔드 파이프라인
- [x] visa_free_days 필드 추가 + 결과 카드 배지
- [x] TOP5 + 세션 기반 reveal API (백엔드 게이팅)
- [x] 결과 페이지 정보 중심 4-Stage 재설계
- [x] immigration_purpose → Block A 가중치 반영
- [x] Fuzzy 페르소나 (퀴즈 비율 벡터 블렌딩)
- [x] Derived UserPriority (cross-block 암묵 배율)
- [x] 폼 자동 넘김 (단일 선택 완료 시)
- [x] LLM 타로 리더 톤 프롬프트 추가 + reading_text 필드
- [x] 타로카드 UI 전면 재설계 (Amber Mono 2.0, 정적 프리미엄 디자인)
- [x] 카드 UX 개선 — 호버 전체 적용, 잠금 인라인 오버레이, lucide-react 아이콘, 라이트박스 X/ESC
- [x] 전수조사 604,800건 통과 (에러 0, 점수 이상 0, 차별화 9/9)
- [x] 소득 필터 fallback (빈 결과 방지)
- [x] income=0(비공개) 소득 필터 바이패스
- [x] Block D companion 가중치 동적 분기 (가족/자녀/혼자)
- [x] 폼 UX: 페르소나 배지 카피 개선, 한국어 조사 자동 선택
- [x] Information Hierarchy 3-tier 원칙 명문화 (Card/Lightbox/Guide 역할 분리)
- [x] Card 앞면 수치 metric 제거 + 타로 3-section(compass mini/city/NNAI) 재설계
- [x] Lightbox 10단계 body 구조 확정 (감성 intro → 실무 → 감성·지표 순환 → action → CTA)
- [x] i18n 혼재 엣지케이스 해결 (defaultLocale ko + localeDetection off + 영어 locale 방어막)
- [x] `normalizeVisaType` / `formatClimate` 헬퍼 (영문 비자명 원칙, 9개 기후 한국어 매핑)
- [x] Google Sign-In 공식 `.gsi-material-button` CSS 채택 + Roboto 500 `next/font/google` 로드
- [x] Lightbox 잠금 카드 skeleton teaser (추론 방지, Pro CTA)
- [x] Lightbox 7차 align center 3종 (External links / city_insight / Login CTA) + CTA 하단 여백 확보(pb-4→pb-8) + city_insight 좌측 세로선 제거
- [x] 뱃지 시스템 전환 — 점수 N/10 고정 → qualitative 태그 top 3 (Method B: 임계 초과 폭 + 카테고리 우선순위 tie-break, 7 카테고리, 0개면 섹션 생략)
- [x] **dev preview 진입점** — `?dev_preview=1&plan=free|pro` URL flag, 백엔드 무변경 + mock으로 result→guide→dashboard 시각 검증 (세션 8, test/dev-preview-flow 브랜치)
- [x] **RitualTransition** — /result, /dashboard mount 시 600ms black overlay fade-out, ritual zone 경계 마킹 (세션 8)
- [x] **테마 zone 분리 명문화** — dark = ritual / light = 일상, 통일 시도 금지 (세션 8)
- [x] **Country Briefing 양식 (v6)** — IMF 톤 / 1./1.1. 숫자 / bold serif / 가로선 0개 / paragraph indent / Document № / References 4-field 학술 인용 (세션 8, test 브랜치)
- [ ] **Country Briefing v6 시각 검증 미완** — Vercel preview 401 gated로 사용자 직접 확인. 가로선 0개 + IMF bold serif + paragraph indent + Quick Facts 실값이 양식 신뢰도를 만드는지 체감 (세션 8)
- [ ] `computeCityTags` 52개 도시 snapshot 테스트 추가
- [ ] 영문 라벨 worst case 2줄 여부 실측 (필요시 `TAG_LABELS` 추가 축약)
- [ ] Block C penalty scale 재튜닝 (페르소나 가중치 변경 반영)
- [ ] visa_free_days 아내팀 검수 (docs/review/REVIEW_visa_free_days.md)
- [ ] 타로 세션 DB/Redis 마이그레이션 (현재 인메모리)
- [ ] IRT 문항반응이론 도입 (사용자 데이터 1000명+ 수집 후)
- [ ] 페르소나 결과 공유 기능
- [ ] 도시 데이터 확충 (북미/중동 커버리지 부족 → 빈 결과 원인)
- [ ] **T3: 영어 번역 데이터 pipeline** — `city_insights.en.json`, `city_descriptions.en.json`, `visa_db` 한/영 분리. Gemini 일괄 번역 + 매년 갱신. 별도 이니셔티브.
- [ ] **Two-step 모달 분리 (Q4 백로그)** — Google 버튼과 프로젝트 amber 팔레트 구조적 부조화 해결. Lightbox CTA는 프로젝트 자유 디자인 + 클릭 시 모달에서 Google 공식 버튼. 즉시 아님.
- [ ] **city 매칭 fallback 버그** — `/guide/{cityId}` 진입 시 `revealedCities.find(c => c.id === cityId)` 실패 시 `[0]` fallback (세션 8 발견, 메데인→바르셀로나 케이스). enrichCities `id` 필드 부여 검증 필요
- [ ] **backend CORS 정책** — Vercel preview 동적 URL `*.vercel.app` allowlist 추가 (rosie와 합의 필요)
- [ ] **Pro 동선 통합** — Lightbox CTA → /pricing → 결제 → /dashboard confirm 단계별 카피/플로우 정리 (세션 8 외 항목으로 보류)
- [ ] **Detail API quota UI 노출** — `/api/detail` 응답의 `cached`/`quota` 필드를 frontend 사용자에게 노출 방식 미정 (1/2 사용 임박 알림 등)
- [ ] **LLM JSON → BriefingData 매핑** — 현재 dev preview만 Country Briefing 사용, 실서비스는 markdown+canvas. 다음 단계로 LLM Step 2 출력 스키마를 BriefingData에 매핑 (또는 schema 확장)
- [ ] **테스트 브랜치 머지/삭제** — `test/dev-preview-flow` 사용자 검증 완료 시 develop merge → 삭제. 세션 문서는 머지 시점 갱신
- [ ] Light Theme 전환 검토 (백로그 — 테마 zone 분리 명문화로 상위 변경 가능성 감소)

## 주요 결정사항
- Gradio UI 레거시 전환, 신규 UI는 Next.js로만 구현
- 세션 문서는 .claude/session/에 보관, git 추적 대상
- 코드 커밋과 세션 문서 커밋 분리
- 타로카드 3D 플립 → 정적 프리미엄 디자인 (Compass Rose 뒷면 + Label+Value 앞면, CSS 변수 전용)
- UserPriority는 별도 질문 없이 기존 입력에서 암묵 추론
- Fuzzy 페르소나: 이진 할당 → 비율 벡터 블렌딩
- **Information Hierarchy 3-tier**: Card(식별) / Lightbox(요약+전환) / Guide(상세) 엄격 분리. 각 레이어가 상위를 반복하지 않고 확장.
- **Card 비율 4:7 확정**: Rider-Waite 타로 실측 11:19과 오차 1%. 디자인 문서 2:3 기재는 오기로 정정.
- **Lightbox 스크롤 절대 금지**: 카드 시각 정체성 유지. overflow는 콘텐츠 다이어트로만 해결.
- **visa_type 영문 원칙**: 모든 locale에서 영문 비자명. `normalizeVisaType`로 국가 prefix + 한글 제거.
- **i18n default locale ko**: 서비스 한국 타겟 반영. `localeDetection: false`로 브라우저 시스템 언어 redirect 차단.
- **Google Sign-In 공식 CSS 원본 복제**: 수기 inline style 금지. `globals.css`의 `.gsi-material-button` 블록이 단일 진실.
- **CTA best practices 수렴**: 2-6단어 + specific action verb + benefit-led + medium weight + center align.
- **서버사이드 OAuth redirect 유지**: Authorization Code Flow. `gapi.auth2` / FedCM migration 대상 아님.
- **HEX 금지 규칙 예외 목록**: Google 로고 4색(#EA4335/#4285F4/#FBBC05/#34A853) + Google Dark Theme 3색(#131314/#E3E3E3/#8E918F) — 공식 브랜드 가이드 준수.
- **내부 점수 vs UI 표기 분리 원칙**: safety/english/nomad/coworking 등 점수 필드는 근거 강도가 이질적(외부 지표 블렌딩 vs 내부 에디토리얼). 내부는 raw score로 sort/filter 계속 사용하되, 사용자 노출은 qualitative 태그(임계 돌파만, 객관성 착시 방지) 로 통일. 수치 직접 노출은 Pro 가이드 같은 상세 컨텍스트에서만.
- **테마 zone 분리 명문화** (세션 8): dark = ritual zone (/result+Lightbox+/guide), light = 일상 zone (/dashboard). dashboard light theme이 우연이 아니라 의미 있는 분리. 통일 시도 금지. 진입/출구에 RitualTransition 600ms 적용
- **Country Briefing 양식** (세션 8): 학술 / 컨설팅 / 정부 Country Brief 3안 중 정부 톤 선택. 콘텐츠 자연 매핑 + 권위감 + 서비스 정체성과 일치. IMF Editorial Style + Tufte LaTeX + USWDS 합성
- **레이아웃 작업 시 reference 우선** (세션 8): 가로선으로 hierarchy 만드는 충동은 typography 약함의 신호 = amateur. 비-trivial 레이아웃 작업 전 실제 문서 spec 학습 필수 (Tufte / USWDS / IMF / Bringhurst)
- **References 학술 인용 톤 의무화** (세션 8): { issuer, title (italic), year, url } 4-field 구조. "Korean Embassy in Spain"만 적기 금지. overseas.mofa.go.kr/{cc}-ko 같은 추적 가능 URL 필수. 사용자 인용: "사람들 우리 서비스 믿고 큰 돈 써서 떠날텐데, 이런 식이면 우리 망해"
- **Mock 데이터 country-agnostic body 원칙** (세션 8): TH 하드코딩으로 Spain briefing에 TH 정보 leak → 공신력 즉시 붕괴 사례. 본문은 country-agnostic, specific은 동적 plug-in. 값 없으면 em-dash "—". placeholder 텍스트 / § 기호 사용 금지
- **숫자 체계** (세션 8): 1./1.1./1.1.1 사용. § 기호 사용 금지
- **Document № 체계** (세션 8): NNAI-{cc}-{date}-{userhash6}. userhash는 user_profile SHA-256 prefix 6 hex (개인화 표시)
- **Path A (HTML + html-to-image) 선택** (세션 8): 양식 fidelity가 캔버스 직접 그리기 한계 초과. 1080px hidden DOM 렌더 후 toPng 캡쳐. 단 캡쳐 시 root clone에 `style: { position:'static', left:'auto' }` 필수 — opacity:0/visibility:hidden/offscreen 위치 모두 SVG foreignObject에 그대로 전이됨
- **테스트 브랜치 컨벤션** (세션 8): test/* 브랜치는 머지+삭제 라이프사이클. 세션 문서는 develop merge 시점에 갱신 (격리 브랜치 작업 기록은 본 CONTEXT/CHANGELOG에 명시)

## 참고 링크
- Repository: git@github.com:wingcraft-co/nnai.git
- 관련 문서: CLAUDE.md, docs/frontguide.docx (iCloud)
- 타로 UX 스펙: docs/superpowers/specs/2026-04-10-tarot-card-ux-design.md
- API 레퍼런스: cowork/backend/api-reference.md
