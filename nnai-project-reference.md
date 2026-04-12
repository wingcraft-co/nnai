# NomadNavigator AI (NNAI) — 프로젝트 공통 참조 문서

> **최종 업데이트**: 2026-03-29
> **목적**: Claude Web Project Agent Team 공통 참조용

---

## 1. 서비스 개요

NomadNavigator AI — AI 기반 디지털 노마드 이민 설계 서비스.
Gemini 2.5 Flash로 최적 거주 도시 TOP 3 추천 + 비자/예산/세금 상세 가이드 제공.

- **Repository:** https://github.com/wingcraft-co/nnai.git
- **서비스 도메인:** https://nnai.app (Vercel)
- **API 도메인:** https://api.nnai.app (Railway)
- **회사:** Wingcraft (wingcraft.co)

---

## 2. 배포 구조

```
사용자 → nnai.app (Vercel) → api.nnai.app (Railway) → PostgreSQL

┌─────────────────────────────────────┐
│  Vercel                             │
│  └── frontend (Next.js 16)          │
│      └── 도메인: nnai.app           │
│      └── Root Directory: /frontend  │
└─────────────────────────────────────┘
         │ HTTPS (외부)
         ▼
┌─────────────────────────────────────┐
│  Railway                            │
│  ├── backend (Python FastAPI)       │
│  │   └── 도메인: api.nnai.app       │
│  └── PostgreSQL                     │
│      └── backend만 접근             │
└─────────────────────────────────────┘
```

| 플랫폼 | 역할 | Root Directory |
|--------|------|----------------|
| Vercel | Frontend (Next.js) | `/frontend` |
| Railway | Backend (FastAPI) + DB | `/` |

**DNS (Cloudflare):**

| Type | Name | Value | Proxy |
|------|------|-------|-------|
| A | `@` | `76.76.21.21` (Vercel) | OFF |
| CNAME | `api` | Railway CNAME | OFF |

---

## 3. 기술 스택 요약

### Backend

| 항목 | 기술 |
|------|------|
| 프레임워크 | FastAPI |
| LLM | Gemini 2.5 Flash (OpenAI 호환) |
| LLM 캐싱 | Gemini Server-side Context Caching (TTL 1시간) |
| DB 추천 엔진 | recommender.py (규칙 기반 필터링/랭킹) |
| DB | PostgreSQL (psycopg2) |
| 인증 | Google OAuth 2.0 (signed cookie) |
| CI | GitHub Actions |

### Frontend

| 항목 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router, TypeScript) |
| 스타일링 | Tailwind CSS 4 |
| 컴포넌트 | shadcn/ui |
| 애니메이션 | Framer Motion |
| 상태 | 스캐폴드만 생성, UI 구현 예정 |

---

## 4. 프로젝트 구조 (간략)

```
nnai/
├── server.py               # FastAPI 서버 (API 엔드포인트 + Gradio 마운트)
├── app.py                  # 핵심 로직 (nomad_advisor, show_city_detail)
├── recommender.py          # DB 기반 추천 엔진
├── api/                    # LLM, 파싱, 인증, 핀
├── prompts/                # 프롬프트 엔지니어링
├── utils/                  # DB, 환율, 페르소나, 세금, 숙소
├── data/                   # visa_db(29국), city_scores(50도시), visa_urls
├── ui/                     # Gradio UI (레거시, 참고용)
├── tests/                  # pytest 테스트
└── frontend/               # Next.js 프론트엔드 (신규)
```

---

## 5. API 엔드포인트 목록

### 추천 (Frontend용)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| POST | `/api/recommend` | Step 1: 도시 추천 | - |
| POST | `/api/detail` | Step 2: 상세 가이드 | 권장 |

### 인증

| Method | Path | 설명 |
|--------|------|------|
| GET | `/auth/google` | Google 로그인 리다이렉트 |
| GET | `/auth/google/callback` | OAuth 콜백, 세션 쿠키 설정 |
| GET | `/auth/me` | 로그인 상태 확인 |
| GET | `/auth/logout` | 로그아웃 |

### 핀 (저장 도시)

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| POST | `/api/pins` | 핀 저장 | 필수 |
| GET | `/api/pins` | 내 핀 목록 | 필수 |
| GET | `/api/pins/community` | 커뮤니티 핀 (도시별 집계) | - |

---

## 6. API 상세 스키마

### POST /api/recommend

**Request:**
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

**Response:**
```json
{
  "markdown": "Step 1 결과 마크다운 (HTML 포함)",
  "cities": [
    {
      "city": "Lisbon",
      "city_kr": "리스본",
      "country": "Portugal",
      "country_id": "PT",
      "visa_type": "D7 Passive Income Visa",
      "monthly_cost_usd": 1800,
      "score": 9
    }
  ],
  "parsed": {
    "top_cities": [...],
    "_user_profile": {
      "nationality": "Korean",
      "income_usd": 3571,
      "income_krw": 500,
      "language": "한국어"
    }
  }
}
```

### POST /api/detail

**Request:**
```json
{
  "parsed_data": {
    "top_cities": [...],
    "_user_profile": {...}
  },
  "city_index": 0
}
```

**Response:**
```json
{
  "markdown": "Step 2 상세 가이드 마크다운"
}
```

### GET /auth/me

**Response (로그인 시):**
```json
{
  "logged_in": true,
  "name": "홍길동",
  "picture": "https://...",
  "uid": "google-oauth-sub-id"
}
```

### POST /api/pins

**Request:**
```json
{
  "city": "Lisbon",
  "display": "Lisbon, Portugal",
  "note": "Great coworking spaces",
  "lat": 38.7169,
  "lng": -9.1395,
  "user_lat": 37.5665,
  "user_lng": 126.978
}
```

**Response:**
```json
{
  "id": 123,
  "city": "Lisbon",
  "created_at": "2026-03-29T15:00:00+00:00"
}
```

### GET /api/pins/community

**Response:**
```json
[
  {"city": "Lisbon", "display": "Lisbon, Portugal", "lat": 38.7169, "lng": -9.1395, "cnt": 12},
  {"city": "Chiang Mai", "display": "Chiang Mai, Thailand", "lat": 18.7883, "lng": 98.9853, "cnt": 8}
]
```

---

## 7. 사용자 플로우

```
[Step 1] 프로필 입력 → POST /api/recommend → TOP 3 도시 추천
   ├── 입력: 국적, 소득, 목적, 라이프스타일, 언어, 체류기간, 대륙 선호 등 (20+ 필드)
   ├── 실시간 경고: 소득 미달, 가족 동반 조건 등
   └── 결과: 마크다운 (도시 카드 3장 + 비교 테이블)

[Step 2] 도시 선택 → POST /api/detail → 상세 정착 가이드 (로그인 필요)
   └── 결과: 비자 체크리스트, 예산, 숙소, 세금, 첫 단계

[Map] 노마드 게스트북 지도
   ├── GET /api/pins/community → 커뮤니티 핀 조회
   └── POST /api/pins → 내 핀 저장 (로그인 필요)
```

---

## 8. 프론트엔드 구현 상태 및 계획

### 완료

- Next.js 16 프로젝트 스캐폴드 (`frontend/`)
- Tailwind CSS 4, shadcn/ui (card, button), Framer Motion 설치
- Vercel 배포 연결 (wingcraft-co/nnai, Root: /frontend)
- 백엔드 API 엔드포인트 추가 (POST /api/recommend, /api/detail)
- CORS 설정 (nnai.app, localhost:3000)

### 미구현 (작업 예정)

| 항목 | 우선순위 |
|------|:--------:|
| Step 1 입력 폼 (20+ 컴포넌트) | P0 |
| Step 1 결과 렌더링 (도시 카드 + 비교 테이블) | P0 |
| 타로 카드 플립 애니메이션 (Framer Motion) | P0 |
| Step 2 상세 가이드 UI | P0 |
| 인증 연동 (Google OAuth) | P1 |
| i18n (한국어/영어) | P1 |
| 노마드 지도 (React-Leaflet) | P1 |
| 반응형 디자인 | P1 |
| 로딩/스켈레톤 UI | P1 |

### 디자인 규칙

- 배경색: 딥 네이비 (#1a1a2e)
- 카드: 흰색, 세리프 폰트
- 타로 카드 UI: 세로 2:3 비율, 3장 가로 배치
- Framer Motion: Y축 회전, 0.8초 간격 순차 플립

---

## 9. 환경변수 목록

### Backend (Railway)

| 변수 | 용도 |
|------|------|
| GEMINI_API_KEY | LLM + Context Caching |
| DATABASE_URL | PostgreSQL 연결 문자열 |
| GOOGLE_CLIENT_ID | OAuth |
| GOOGLE_CLIENT_SECRET | OAuth |
| OAUTH_REDIRECT_URI | OAuth callback |
| SECRET_KEY | 세션 서명 키 |
| FRONTEND_URL | CORS 허용 origin |
| PORT | 서버 포트 (기본: 7860) |
| USE_DB_RECOMMENDER | DB 추천 사용 (기본: 1) |

### Frontend (Vercel)

| 변수 | 용도 |
|------|------|
| NEXT_PUBLIC_API_URL | 백엔드 URL (https://api.nnai.app) |

---

## 10. 개발 컨벤션

- **커밋:** `feat:`, `fix:`, `chore:`, `test:` prefix
- **언어:** 한국어 우선 (UI 텍스트, 프롬프트, 문서)
- **테스트:** 백엔드 변경 시 `SKIP_EXTERNAL_INIT=1 pytest` 필수
- **API 스키마:** frontend 작업 시 backend API 스키마 변경 금지 (별도 협의)
- **Next.js:** v16은 훈련 데이터와 다를 수 있음 — `node_modules/next/dist/docs/` 참조
- **shadcn/ui:** `npx shadcn@latest add [component]`로 추가
- **Git remote:** SSH (`git@github.com:wingcraft-co/nnai.git`)
- **CI:** GitHub Actions — push/PR 시 core regression tests 자동 실행

---

## 11. 데이터 구조 요약

### visa_db.json (29개국)

주요 필드: id, name, name_kr, visa_type, min_income_usd, stay_months, renewable, schengen, buffer_zone, tax_residency_days, double_tax_treaty_with_kr, income_tiers, data_verified_date

### city_scores.json (50개 도시)

주요 필드: id, city, city_kr, country, country_id, monthly_cost_usd, internet_mbps, safety_score, english_score, nomad_score, coworking_score, korean_community_size, flatio_search_url, anyplace_search_url

### DB 스키마 (PostgreSQL)

| 테이블 | PK | 주요 컬럼 |
|--------|-----|-----------|
| users | id (TEXT, Google sub) | email, name, picture, created_at |
| pins | id (SERIAL) | user_id→users, city, display, note, lat, lng, created_at |
