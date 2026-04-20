# CONTEXT.md
_Last updated: 2026-04-20 KST (세션 6)_

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
- **CityLightbox 10단계 body 구조**: Header(flag/city/country) → Primary metrics 3×3 grid → **city_insight**(감성 intro) → **비자 섹션**(비자명 자체가 ExternalLink 링크 + 조건 라인) → Personalized Insight(✦, ko 전용) → city_description → Secondary 배지 3종(치안/영어/기후) → External links 한 줄 → spacer → **Login CTA**(정보 div + Google 공식 버튼).
- **Secondary 배지 3종**: `치안 N/10` `영어 N/10` `{기후} 기후` — Primary 3 metric과 1:1 대응. `formatClimate` 9개 매핑.
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
- [ ] Block C penalty scale 재튜닝 (페르소나 가중치 변경 반영)
- [ ] visa_free_days 아내팀 검수 (docs/review/REVIEW_visa_free_days.md)
- [ ] 타로 세션 DB/Redis 마이그레이션 (현재 인메모리)
- [ ] IRT 문항반응이론 도입 (사용자 데이터 1000명+ 수집 후)
- [ ] 페르소나 결과 공유 기능
- [ ] 도시 데이터 확충 (북미/중동 커버리지 부족 → 빈 결과 원인)
- [ ] **T3: 영어 번역 데이터 pipeline** — `city_insights.en.json`, `city_descriptions.en.json`, `visa_db` 한/영 분리. Gemini 일괄 번역 + 매년 갱신. 별도 이니셔티브.
- [ ] **Two-step 모달 분리 (Q4 백로그)** — Google 버튼과 프로젝트 amber 팔레트 구조적 부조화 해결. Lightbox CTA는 프로젝트 자유 디자인 + 클릭 시 모달에서 Google 공식 버튼. 즉시 아님.
- [ ] Light Theme 전환 검토 (카드 전체 + Google 버튼 Light Theme 통일)

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

## 참고 링크
- Repository: git@github.com:wingcraft-co/nnai.git
- 관련 문서: CLAUDE.md, docs/frontguide.docx (iCloud)
- 타로 UX 스펙: docs/superpowers/specs/2026-04-10-tarot-card-ux-design.md
- API 레퍼런스: cowork/backend/api-reference.md
