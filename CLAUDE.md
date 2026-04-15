# CLAUDE.md — NomadNavigator AI

## Project Rules

### cowork 문서 동기화 (필수)

아래 두 문서는 항상 코드와 동기화 상태를 유지한다. 관련 코드 변경 시 **같은 작업 내에서** 반드시 업데이트한다.

| 문서 | 업데이트 트리거 |
|------|----------------|
| `cowork/backend/api-reference.md` | 엔드포인트 추가/수정/삭제, 요청·응답 스키마 변경, 인증 로직 변경 |
| `cowork/backend/db-schema.md` | 테이블 추가/삭제, 컬럼 추가/수정/삭제, 외래키 변경 (`utils/db.py` DDL 변경) |

### rawdata → JSON/DB 동기화

`data/rawdata/` 폴더에 팀원이 최신 정보를 CSV로 지속 업데이트한다.
세션 시작 시 rawdata에 변경이 있는지 확인하고, 변경이 있으면 대응하는 JSON 파일을 재생성한다.

| rawdata CSV | 대응 JSON | 동기화 스크립트 |
|-------------|----------|----------------|
| `data/rawdata/city_scores.csv` | `data/city_scores.json` | `scripts/sync_nomaddb_csv_to_json.py` |
| `data/rawdata/nomad_countries_metadata.csv` | `data/visa_db.json` | `scripts/sync_nomaddb_csv_to_json.py` |
| `data/rawdata/nomad_visa_relations.csv` | `data/visa_db.json` | `scripts/sync_nomaddb_csv_to_json.py` |

JSON 재생성 후 프론트엔드 enrichment용 복사본도 갱신해야 한다:
- `frontend/src/data/city_scores.json`
- `frontend/src/data/visa_db.json`

### GitHub Actions 테스트

새 테스트 파일을 추가할 때마다 `.github/workflows/main-tests.yml`의 테스트 목록에 함께 등록한다.

### Git 브랜치 전략

| 브랜치 | 용도 | Railway 환경 |
|--------|------|-------------|
| `main` | 프로덕션 (사용자 페이지) | production |
| `develop` | 개발/테스트 | develop |

- **push는 항상 `develop` 브랜치**로 한다. `main`으로의 병합은 별도 협의 후 진행.
- Railway는 각 브랜치에 대응하는 환경(production / develop)으로 자동 배포된다.

### 로컬 환경 설정 분리

CLAUDE.md는 git으로 추적되는 팀 공유 파일이다.
개인 환경별 설정 및 세션 문서 관리 규칙은 `.claude/CLAUDE.local.md`에 분리 보관한다.
`.claude/CLAUDE.local.md`는 `.gitignore`에 포함되어 git으로 추적되지 않는다.

---

## Project Overview

NomadNavigator AI (NNAI) — AI 기반 디지털 노마드 이민 설계 서비스.
Gemini 2.5 Flash로 최적 거주 도시 TOP 3 추천 + 비자/예산/세금 상세 가이드 제공.

**Repository:** git@github.com:wingcraft-co/nnai.git (SSH)
**Domain:** nnai.app (Vercel) / api.nnai.app (Railway)
**Company:** Wingcraft (wingcraft.co)

## Architecture

```
nnai/
├── app.py                  # 핵심 로직: nomad_advisor(), show_city_detail()
├── server.py               # FastAPI 서버 (production entry) + API 엔드포인트 + CORS
├── recommender.py          # DB 기반 도시 필터링 & 랭킹
│
├── api/                    # LLM 호출, 파싱, 인증, 핀, 타로/모바일 라우터
│   ├── hf_client.py        # Gemini 2.5 Flash (OpenAI compat)
│   ├── parser.py           # JSON 파싱 + 마크다운 포맷
│   ├── cache_manager.py    # Gemini 서버사이드 Context Caching
│   ├── schengen_calculator.py
│   ├── auth.py             # Google OAuth 2.0 (FastAPI router)
│   ├── pins.py             # 저장 도시 CRUD API
│   ├── tarot_session.py    # 타로 카드 세션 인메모리 스토어 (recommend → reveal)
│   ├── visits.py           # 페이지 방문자 카운터 API
│   └── mobile_*.py         # 모바일 API 8종 (auth/discover/feed/plans/profile/recommend/type_actions/uploads)
│
├── prompts/                # 프롬프트 엔지니어링
│   ├── builder.py          # build_prompt(), build_detail_prompt(), validate_user_profile()
│   ├── system.py           # 한국어 시스템 프롬프트
│   ├── system_en.py        # 영어 시스템 프롬프트
│   ├── few_shots.py
│   └── data_context.py     # visa_db + city_scores 압축 텍스트
│
├── utils/                  # 유틸리티
│   ├── db.py               # PostgreSQL (init_db, get_conn, billing/usage/rate_limit 함수)
│   ├── currency.py         # 실시간 환율 (fallback: 1 USD ≈ 1,400 KRW)
│   ├── persona.py          # 5가지 페르소나 진단
│   ├── tax_warning.py      # 세금 거주지 경고
│   ├── planb.py            # 비쉥겐 버퍼 국가 추천
│   ├── accommodation.py    # 중기 숙소 딥링크
│   ├── rate_limit.py       # 요청 등급/엔드포인트별 rate limit 정책
│   └── security_events.py  # 보안 이벤트 로깅
│
├── data/                   # 정적 데이터
│   ├── visa_db.json        # 29개국 비자
│   ├── city_scores.json    # 50개 도시
│   └── visa_urls.json      # 공식 비자 URL
│
├── tests/                  # pytest
│
└── frontend/               # Next.js 프론트엔드 (i18n: [locale])
    ├── src/app/[locale]/        # i18n 라우팅 (ko/en) — page, layout, ad, dev, onboarding, pay, pricing, result
    ├── src/app/api/             # BFF route (recommend, detail, reveal, billing/checkout)
    ├── src/components/tarot/    # 타로 카드 UI (TarotDeck, TarotCard, TarotReading, CityCompare)
    ├── src/components/pay/      # Polar 결제 (PayCheckoutCard, PolarCheckoutButton)
    ├── src/components/ad/       # 파트너 광고 모듈 (AdModule, AdSign)
    ├── src/components/ui/       # shadcn/ui (card, button)
    └── src/lib/                 # 유틸리티 (pricing-content 등)
```

## Tech Stack

| Layer | Backend | Frontend |
|-------|---------|----------|
| Framework | FastAPI | Next.js 16 (App Router) |
| Language | Python 3 | TypeScript |
| Styling | — | Tailwind CSS 4 |
| Components | — | shadcn/ui |
| Animation | — | Framer Motion |
| LLM | Gemini 2.5 Flash | — |
| DB | PostgreSQL | — |
| Auth | Google OAuth 2.0 | — |

> UI는 Next.js로만 구현. Gradio UI는 삭제됨.

## Commands

```bash
# Backend
python server.py                                   # FastAPI 서버 실행
SKIP_EXTERNAL_INIT=1 .venv/bin/pytest tests/ -v        # 테스트

# Frontend
cd frontend && npm run dev                         # Next.js 개발 서버 (localhost:3000)
cd frontend && npm run build                       # 프로덕션 빌드
```

## Environment Variables

```bash
# Backend (Railway)
GEMINI_API_KEY                  # LLM + Context Caching
DATABASE_URL                    # PostgreSQL
GOOGLE_CLIENT_ID                # OAuth
GOOGLE_CLIENT_SECRET            # OAuth
OAUTH_REDIRECT_URI              # OAuth callback
SECRET_KEY                      # 세션 서명
FRONTEND_URL                    # CORS 허용 origin (https://nnai.app)
SKIP_EXTERNAL_INIT=1            # 테스트 시 필수
POLAR_CHECKOUT_URL              # Polar 결제 다이렉트 URL (선택, BFF에서 사용)

# Frontend (Vercel)
NEXT_PUBLIC_API_URL             # 백엔드 URL (https://api.nnai.app)
NEXT_PUBLIC_POLAR_CHECKOUT_URL  # Polar 결제 다이렉트 URL (선택, 클라이언트에서 사용)
```

## Backend API Endpoints

> 전체 스펙은 `cowork/backend/api-reference.md` 참조 (단일 진실 공급원).

```
# Auth
GET  /auth/google              → Google 로그인 리다이렉트
GET  /auth/google/callback     → OAuth 콜백
GET  /auth/me                  → 현재 유저 정보 + entitlement
GET  /auth/logout              → 로그아웃

# Recommend (Frontend용, server.py)
POST /api/recommend            → Step 1 도시 추천 (5장 카드 세션 생성, rate-limited)
POST /api/reveal               → 선택한 카드 3장 공개 + 도시 상세 데이터
POST /api/detail               → Step 2 상세 가이드 (rate-limited, PAYG cap 적용)

# Pins
POST   /api/pins               → 도시 저장
GET    /api/pins               → 저장 목록
GET    /api/pins/community     → 커뮤니티 핀 (인증 불필요)
PUT    /api/pins/{pin_id}      → 수정
DELETE /api/pins/{pin_id}      → 삭제

# Visits
POST /api/visits/ping          → 페이지 방문자 카운터 증가/조회

# Mobile API (모바일 앱 전용, JWT 인증) — prefix는 각 라우터 내부에서 정의
mobile_auth, mobile_discover, mobile_feed, mobile_plans,
mobile_profile, mobile_recommend, mobile_type_actions, mobile_uploads
```

### POST /api/recommend

Request:
```json
{
  "nationality": "Korean",
  "income_krw": 500,
  "immigration_purpose": "원격 근무",
  "lifestyle": ["해변", "영어권"],
  "languages": ["영어 업무 수준"],
  "timeline": "1년 장기 체류",
  "preferred_countries": ["유럽"],
  "preferred_language": "한국어",
  "persona_type": "wanderer",
  "income_type": "프리랜서",
  "travel_type": "혼자 (솔로)",
  "children_ages": null,
  "dual_nationality": false,
  "readiness_stage": "구체적으로 준비 중",
  "has_spouse_income": "없음",
  "spouse_income_krw": 0,
  "stay_style": "정착형",
  "tax_sensitivity": "optimize",
  "total_budget_krw": null,
  "persona_vector": null
}
```

신규 필드:
- `stay_style` — 정착형 / 순환형 / 이동형 (선택)
- `tax_sensitivity` — optimize / simple / unknown (선택)
- `total_budget_krw` — 단기 체류 시 총 예산(만원), 중기/장기는 `null`
- `persona_vector` — 페르소나 벡터 dict (선택)

Response:
```json
{
  "session_id": "abc123def456",
  "card_count": 5,
  "parsed": {"top_cities": [...], "_user_profile": {...}}
}
```

> ⚠️ 기존 `markdown`, `cities` 응답 필드는 제거됨. 도시 상세 데이터는 `/api/reveal` 호출 후 반환.

### POST /api/reveal

타로 카드 5장 중 사용자가 선택한 3장을 공개하고 도시 상세 데이터를 반환.

Request:
```json
{
  "session_id": "abc123def456",
  "selected_indices": [0, 2, 4]
}
```

Response:
```json
{
  "revealed_cities": [{"city": "Lisbon", "country_id": "PT", ...}]
}
```

에러 (400): `Must select exactly 3 cards` / `Cards already revealed` / `Session not found`

### POST /api/detail

Request:
```json
{
  "parsed_data": {"top_cities": [...], "_user_profile": {...}},
  "city_index": 0
}
```

Response:
```json
{
  "markdown": "...(Step 2 상세 가이드 마크다운)"
}
```

에러: `429` (rate limit), `402` (PAYG 월 캡 초과)

## Rate Limit & Billing

### Rate Limit 정책

| 등급          | `/api/recommend` | `/api/detail` | 비고 |
|---------------|------------------|---------------|------|
| anonymous     | 5/min            | 10/min        | IP 기준 |
| free          | 10/min           | 20/min        | user_id 기준 |
| pro           | 30/min           | 60/min        | user_id 기준 |
| pro + payg    | minute cap 없음  | minute cap 없음 | burst guard만 |

PAYG burst guard: recommend 3 req/sec, detail 5 req/sec. 초과 시 `429`.

### Billing Entitlement
- DB: `billing_entitlements` 테이블 (`utils/db.py` DDL, 자세한 컬럼은 `cowork/backend/db-schema.md`)
- 핵심 필드: `plan_tier (free|pro)`, `status (active|past_due|canceled|grace)`, `payg_enabled`, `payg_monthly_cap_usd`
- `/auth/me` 응답에 entitlement 포함됨
- entitlement row 미생성 시 기본값: `free` / `active` / `payg_enabled=false`

### PAYG (Pay As You Go)
- pro + payg 등급은 분당 한도가 풀리고 월 캡(`payg_monthly_cap_usd`, 기본 $50) 적용
- 캡 초과 시 `402` 응답: `{"detail": "Monthly pay-as-you-go cap reached.", "cap_usd": ..., "current_usage_usd": ...}`
- 사용량 ledger: `billing_usage_ledger` 테이블, webhook 멱등성: `billing_provider_events`

### 결제 (Polar)
- Frontend BFF: `POST /api/billing/checkout` (Next.js → Polar 다이렉트 URL or 백엔드 프록시)
- 환경변수: `POLAR_CHECKOUT_URL` / `NEXT_PUBLIC_POLAR_CHECKOUT_URL`
- 가격 페이지: `frontend/src/app/[locale]/pricing/page.tsx` (i18n)
- 결제 페이지: `frontend/src/app/[locale]/pay/page.tsx`

## Frontend Development Guide

프론트엔드 작업 시 `docs/frontguide.docx` (iCloud) 참조.
워크플로우: 레이아웃 → 인터랙션 → API 연결 순서로 진행.

### 기술 스택
- **Next.js 16** (App Router) — `node_modules/next/dist/docs/` 참조 (훈련 데이터와 다를 수 있음)
- **Tailwind CSS 4** — 유틸리티 기반 스타일링
- **shadcn/ui** — 컴포넌트 (`npx shadcn@latest add [component]`)
- **Framer Motion** — 애니메이션 (단, 타로 카드는 정적 디자인으로 전환됨)
- **next-intl** — i18n (라우트 prefix `[locale]`: ko/en)

### 라우트 구조 (App Router + i18n)
```
src/app/
├── [locale]/
│   ├── layout.tsx
│   ├── page.tsx              # 랜딩
│   ├── ad/                   # 광고 모듈 프리뷰 (sidebar / section variant)
│   ├── dev/                  # 개발용
│   ├── onboarding/
│   │   ├── form/             # 5스텝 입력 폼
│   │   └── quiz/             # 페르소나 진단 + 결과
│   ├── result/               # 타로 결과 메인 (selecting → revealing → done)
│   │   └── [id]/             # 결과 ID로 공유 (placeholder)
│   ├── pay/                  # Polar 결제 페이지
│   └── pricing/              # 가격 페이지
└── api/
    ├── recommend/            # BFF: backend /api/recommend 호출 + city enrichment
    ├── detail/               # BFF: backend /api/detail 호출
    ├── reveal/               # BFF: backend /api/reveal 호출 + city enrichment
    └── billing/checkout/     # BFF: Polar 결제 프록시
```

### 디자인 규칙
- 디자인 시스템: **tweakcn Amber Mono 2.0** — CSS 변수만 사용, HEX 하드코딩 금지
- 자세한 사항은 `docs/designs/tarot-card-design.md` 참조
- 타로 카드: 5장 정적 배치 → 3장 선택 → reveal → 비교/상세 라이트박스

### API 연결
- Frontend → Backend: `NEXT_PUBLIC_API_URL` (배포: `https://api.nnai.app`, 로컬: `http://localhost:7860`)
- Step 1: `POST /api/recommend` → 세션 ID + parsed (도시 상세 미포함)
- Reveal: `POST /api/reveal` → 선택한 3장 도시 상세 반환
- Step 2: `POST /api/detail` → 도시별 이민 가이드 (rate-limited)
- 인증: `/auth/google`, `/auth/me`, `/auth/logout`
- 핀: `/api/pins`, `/api/pins/community`
- 결제: `/api/billing/checkout` (Polar BFF)

### 프론트엔드 현재 상태 (2026-04-16)
- ✅ Next.js 16 + i18n (next-intl) `[locale]` 라우팅, Vercel 배포
- ✅ 디자인 시스템: tweakcn Amber Mono 2.0
- ✅ 타로 카드 UX (5장 표시 → 3장 선택 → reveal → 비교/상세 라이트박스)
- ✅ 결제 페이지 (Polar) + 가격 페이지 (i18n ko/en)
- ✅ 광고 모듈 프로토타입 (sidebar / section variant)
- ⏳ 타로 reveal 백엔드 통합 후 이펙트/카피 다듬기
- ⏳ /onboarding/quiz 페르소나 진단 흐름 마무리

## LLM Response Schema (Step 1)

```json
{
  "top_cities": [{
    "city": "City Name",
    "city_kr": "도시명",
    "country": "Country",
    "country_id": "ISO-2",
    "visa_type": "비자 유형",
    "monthly_cost_usd": 1200,
    "score": 8,
    "reasons": [{"point": "추천 근거"}],
    "realistic_warnings": ["경고"],
    "tax_warning": "세금 경고 or null"
  }],
  "overall_warning": "공통 경고"
}
```

## Conventions

- 커밋 메시지: `feat:`, `fix:`, `chore:`, `test:`, `docs:` prefix 사용
- 한국어 우선 (UI 텍스트, 프롬프트, 문서)
- 백엔드 변경 시 반드시 `SKIP_EXTERNAL_INIT=1 pytest` 실행
- frontend/ 작업 시 backend API 스키마 변경 금지 (별도 협의 필요)
- 시스템 언어 정책: 국적 기반 답변 언어 결정 (test_language_policy.py 참조)

## Deployment

### 배포 구조 (Vercel + Railway)

```
Vercel
└── frontend (Next.js)
    └── 공개 도메인: nnai.app
    └── Root Directory: /frontend

Railway Project (nnai)
├── backend (Python FastAPI)
│   └── 공개 도메인: api.nnai.app
└── Database: PostgreSQL
```

**트래픽 흐름:** 사용자 → `nnai.app` (Vercel) → `api.nnai.app` (Railway) → DB

**DNS (Cloudflare):**
- A `@` → `76.76.21.21` (Vercel), Proxy OFF
- CNAME `api` → Railway CNAME, Proxy OFF

**CORS:** server.py에 설정 완료 (nnai.app, www.nnai.app, localhost:3000, FRONTEND_URL)

**GitHub 연동:**
- Vercel: wingcraft-co/nnai (Root: /frontend, auto-deploy)
- Railway: wingcraft-co/nnai (Root: /, auto-deploy)

**CI:** GitHub Actions (.github/workflows/main-tests.yml) — push/PR 시 core regression tests

### 기타 배포

```bash
# HuggingFace Spaces (삭제됨 — Gradio 레거시)
```

## 관련 문서

- `.claude/session/CONTEXT.md` — 프로젝트 전체 현황 (단일 진실 공급원)
- `.claude/session/CHANGELOG.md` — 작업 이력 누적 로그
- `IMPLEMENTATION_STATUS.md` — Phase별 구현 현황
- `nnai-project-reference.md` — Agent Team 공통 참조
- `docs/frontguide.docx` (iCloud) — 프론트엔드 워크플로우 가이드

## Design System
Always read `docs/designs/tarot-card-design.md` before making any visual or UI decisions on the tarot cards.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match the design spec.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health

