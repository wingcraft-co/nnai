# AGENTS.md — NomadNavigator AI

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

AGENTS.md는 git으로 추적되는 팀 공유 파일이다.
개인 환경별 설정 및 세션 문서 관리 규칙은 `.Codex/Codex.local.md`에 분리 보관한다.
`.Codex/Codex.local.md`는 `.gitignore`에 포함되어 git으로 추적되지 않는다.

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
├── api/                    # LLM 호출, 파싱, 인증, 핀
│   ├── hf_client.py        # Gemini 2.5 Flash (OpenAI compat)
│   ├── parser.py           # JSON 파싱 + 마크다운 포맷
│   ├── cache_manager.py    # Gemini 서버사이드 Context Caching
│   ├── schengen_calculator.py
│   ├── auth.py             # Google OAuth 2.0 (FastAPI router)
│   └── pins.py             # 저장 도시 CRUD API
│
├── prompts/                # 프롬프트 엔지니어링
│   ├── builder.py          # build_prompt(), build_detail_prompt(), validate_user_profile()
│   ├── system.py           # 한국어 시스템 프롬프트
│   ├── system_en.py        # 영어 시스템 프롬프트
│   ├── few_shots.py
│   └── data_context.py     # visa_db + city_scores 압축 텍스트
│
├── utils/                  # 유틸리티
│   ├── db.py               # PostgreSQL (init_db, get_conn)
│   ├── currency.py         # 실시간 환율 (fallback: 1 USD ≈ 1,400 KRW)
│   ├── persona.py          # 5가지 페르소나 진단
│   ├── tax_warning.py      # 세금 거주지 경고
│   ├── planb.py            # 비쉥겐 버퍼 국가 추천
│   └── accommodation.py    # 중기 숙소 딥링크
│
├── ui/                     # Gradio UI (레거시, 사용하지 않음)
│   └── layout.py           # 참고용만 — 경고 로직, 입력 필드 목록 확인
│
├── data/                   # 정적 데이터
│   ├── visa_db.json        # 29개국 비자
│   ├── city_scores.json    # 50개 도시
│   └── visa_urls.json      # 공식 비자 URL
│
├── tests/                  # pytest
│
└── frontend/               # Next.js 프론트엔드
    ├── src/app/            # App Router 페이지
    ├── src/components/ui/  # shadcn/ui (card, button)
    └── src/lib/            # 유틸리티
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
GEMINI_API_KEY          # LLM + Context Caching
DATABASE_URL            # PostgreSQL (Railway 내부/서버용 기본값)
DATABASE_PUBLIC_URL     # PostgreSQL public URL (로컬 접속용 fallback)
APP_PII_ENCRYPTION_KEY  # 사용자 email/name 암복호화용 Fernet 키 (같은 DB를 쓰는 모든 서버에서 동일해야 함)
GOOGLE_CLIENT_ID        # OAuth
GOOGLE_CLIENT_SECRET    # OAuth
OAUTH_REDIRECT_URI      # OAuth callback
SECRET_KEY              # 세션 서명
FRONTEND_URL            # CORS 허용 origin (https://nnai.app)
SKIP_EXTERNAL_INIT=1         # 테스트 시 필수

# Frontend (Vercel)
NEXT_PUBLIC_API_URL     # 백엔드 URL (https://api.nnai.app)
```

## Backend API Endpoints

```
# Auth
GET  /auth/google              → Google 로그인 리다이렉트
GET  /auth/google/callback     → OAuth 콜백
GET  /auth/me                  → 현재 유저 정보
GET  /auth/logout              → 로그아웃

# Recommend (Frontend용, server.py)
POST /api/recommend            → Step 1 도시 추천
POST /api/detail               → Step 2 상세 가이드

# Pins
POST   /api/pins               → 도시 저장
GET    /api/pins               → 저장 목록
GET    /api/pins/community     → 커뮤니티 핀 (인증 불필요)
PUT    /api/pins/{pin_id}      → 수정
DELETE /api/pins/{pin_id}      → 삭제
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
  "persona_type": "",
  "income_type": "프리랜서",
  "travel_type": "혼자 (솔로)",
  "children_ages": null,
  "dual_nationality": false,
  "readiness_stage": "구체적으로 준비 중",
  "has_spouse_income": "없음",
  "spouse_income_krw": 0
}
```

Response:
```json
{
  "markdown": "...(Step 1 결과 마크다운)",
  "cities": [{"city": "Lisbon", "country_id": "PT", ...}],
  "parsed": {"top_cities": [...], "_user_profile": {...}}
}
```

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

## Frontend Development Guide

프론트엔드 작업 시 `docs/frontguide.docx` (iCloud) 참조.
워크플로우: 레이아웃 → 인터랙션 → API 연결 순서로 진행.

### 기술 스택
- **Next.js 16** (App Router) — `node_modules/next/dist/docs/` 참조 (훈련 데이터와 다를 수 있음)
- **Tailwind CSS 4** — 유틸리티 기반 스타일링
- **shadcn/ui** — 컴포넌트 (`npx shadcn@latest add [component]`)
- **Framer Motion** — 애니메이션

### 디자인 규칙
- 배경색: 딥 네이비 (#1a1a2e), 카드: 흰색, 세리프 폰트
- 타로 카드 UI: 세로 2:3 비율, 3장 가로 배치
- Framer Motion: 카드 플립 애니메이션 (Y축 회전, 0.8초 간격 순차)

### API 연결
- Frontend → Backend: `NEXT_PUBLIC_API_URL` (배포: `https://api.nnai.app`, 로컬: `http://localhost:7860`)
- Step 1: `POST /api/recommend` → 도시 추천
- Step 2: `POST /api/detail` → 상세 가이드 (로그인 필요)
- 인증: `/auth/google`, `/auth/me`, `/auth/logout`
- 핀: `/api/pins`, `/api/pins/community`

### 프론트엔드 현재 상태 (2026-03-29)
- ✅ Next.js 16 스캐폴드 생성 + Vercel 배포 완료
- ✅ Tailwind CSS 4, shadcn/ui (card, button), Framer Motion 설치
- ✅ 백엔드 API 엔드포인트 추가 (POST /api/recommend, /api/detail)
- ✅ CORS 설정 완료
- ⏳ UI 구현 미착수 (다음 세션에서 진행)

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
# HuggingFace Spaces (Gradio 버전, 레거시)
git push origin main
git push "https://flexxiblethinking:{HUGGINGFACE_TOKEN}@huggingface.co/spaces/flexxiblethinking/nomad-navigator-ai" main
```

## 관련 문서

- `.Codex/session/CONTEXT.md` — 프로젝트 전체 현황 (단일 진실 공급원)
- `.Codex/session/CHANGELOG.md` — 작업 이력 누적 로그
- `IMPLEMENTATION_STATUS.md` — Phase별 구현 현황
- `nnai-project-reference.md` — Agent Team 공통 참조
- `docs/frontguide.docx` (iCloud) — 프론트엔드 워크플로우 가이드
