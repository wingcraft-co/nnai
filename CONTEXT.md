# CONTEXT.md — NomadNavigator AI

> **최종 업데이트**: 2026-03-29
> **기준 브랜치**: main
> **작성 방식**: 코드를 직접 읽고 사실만 기재 (추측 없음)

---

## 1. 프로젝트 개요

**NomadNavigator AI (NNAI)**
한국인 + 글로벌 디지털 노마드를 위한 AI 이민 설계 서비스.
소득·국적·라이프스타일·이민 동기를 입력하면 Gemini 2.5 Flash 기반으로
최적 거주 도시 TOP 3를 추천하고, 비자 체크리스트·예산·숙소·세금 경고를
마크다운으로 제공한다.

**Repository:** https://github.com/wingcraft-co/nnai.git
**서비스 도메인:** https://nnai.app (Vercel, 프론트엔드)
**API 도메인:** https://api.nnai.app (Railway, 백엔드)
**HF Space:** https://huggingface.co/spaces/flexxiblethinking/nomad-navigator-ai

---

## 2. 기술 스택

| 레이어 | 기술 | 비고 |
|--------|------|------|
| Backend Framework | FastAPI | server.py (production entry) |
| Legacy UI | Gradio ≥4.0 | ui/layout.py — 레거시, 참고용 |
| Frontend | Next.js 16 (App Router) | frontend/ — TypeScript, Tailwind CSS 4, shadcn/ui, Framer Motion |
| LLM | Gemini 2.5 Flash | OpenAI 호환 엔드포인트 |
| LLM 캐싱 | Gemini 서버사이드 Context Caching | SYSTEM_PROMPT+DATA_CONTEXT+FEW_SHOTS (~7,500 tokens), TTL 1시간 |
| 컨텍스트 | 정적 텍스트 (`prompts/data_context.py`) | visa_db.json + city_scores.json 압축 텍스트, RAG 미사용 |
| DB | PostgreSQL | psycopg2, 싱글턴 연결 풀 |
| 인증 | Google OAuth 2.0 | signed cookie (`nnai_session`), max_age=24h |
| 환율 | 실시간 API (`utils/currency.py`) | 실패 시 1 USD ≈ 1,400 KRW 폴백 |
| CI | GitHub Actions | .github/workflows/main-tests.yml |
| 프론트엔드 배포 | Vercel | Root Directory: /frontend |
| 백엔드 배포 | Railway | Procfile: `web: python server.py` |

---

## 3. 환경 변수

```bash
# Backend (Railway)
GEMINI_API_KEY           # LLM + Gemini Context Caching
DATABASE_URL             # PostgreSQL 연결 문자열
GOOGLE_CLIENT_ID         # OAuth
GOOGLE_CLIENT_SECRET     # OAuth
OAUTH_REDIRECT_URI       # OAuth callback (기본: http://localhost:7860/auth/google/callback)
SECRET_KEY               # 세션 서명 키
FRONTEND_URL             # CORS 허용 origin (https://nnai.app)
PORT                     # 서버 포트 (기본: 7860)
USE_DB_RECOMMENDER       # DB 기반 추천 사용 (기본: 1)
SKIP_EXTERNAL_INIT=1          # 테스트 시 필수

# Frontend (Vercel)
NEXT_PUBLIC_API_URL      # 백엔드 URL (https://api.nnai.app)
```

---

## 4. 파일 구조 (현재)

```
nnai/
├── CLAUDE.md                   # Claude Code 세션 지침
├── CONTEXT.md                  # ← 이 파일
├── README.md
├── Procfile                    # Railway: web: python server.py
├── requirements.txt
├── pytest.ini
├── .github/
│   └── workflows/main-tests.yml  # GitHub Actions CI
│
├── app.py                      # Gradio 진입점: nomad_advisor(), show_city_detail()
├── server.py                   # FastAPI 서버 (production entry) + API 엔드포인트
├── recommender.py              # DB 기반 도시 필터링 & 랭킹
│
├── api/
│   ├── hf_client.py            # Gemini 2.5 Flash 클라이언트 (OpenAI compat)
│   ├── parser.py               # JSON 파싱 + 마크다운 포맷 + 도시 비교 테이블
│   ├── schengen_calculator.py  # 쉥겐 90/180 롤링 윈도우 계산기
│   ├── cache_manager.py        # Gemini 서버사이드 Context Caching 관리
│   ├── auth.py                 # Google OAuth 2.0 FastAPI router
│   └── pins.py                 # 저장 도시 CRUD API
│
├── prompts/
│   ├── builder.py              # build_prompt(), build_detail_prompt(), validate_user_profile()
│   ├── system.py               # 한국어 시스템 프롬프트 (Step 1 JSON 스키마 포함)
│   ├── system_en.py            # 영어 시스템 프롬프트
│   ├── few_shots.py            # Few-shot 예시
│   └── data_context.py         # visa_db + city_scores → 압축 텍스트
│
├── utils/
│   ├── db.py                   # PostgreSQL init_db(), get_conn()
│   ├── currency.py             # get_exchange_rates()
│   ├── persona.py              # diagnose_persona(), get_persona_hint() — 5가지 페르소나
│   ├── tax_warning.py          # get_tax_warning() — 세금 거주지 경고
│   ├── planb.py                # get_planb_suggestions() — 비쉥겐 버퍼 추천
│   ├── accommodation.py        # get_accommodation_links() — 중기 숙소 딥링크
│   ├── data_paths.py           # resolve_data_path()
│   └── link_validator.py       # URL 검증 CLI (런타임 미사용)
│
├── data/
│   ├── visa_db.json            # 29개국 비자 데이터
│   ├── city_scores.json        # 50개 도시 점수 데이터
│   └── visa_urls.json          # 국가별 공식 비자 URL
│
├── scripts/
│   └── migrate_sqlite_to_pg.py # SQLite→PostgreSQL 마이그레이션
│
├── docs/
│   └── privacy.html            # 개인정보처리방침
│
├── tests/                      # pytest 테스트 스위트
│
└── frontend/                   # Next.js 프론트엔드 (신규)
    ├── package.json            # next 16.2.1, react 19.2.4, framer-motion, shadcn
    ├── src/app/
    │   ├── layout.tsx          # Root layout
    │   └── page.tsx            # Home page (스캐폴드)
    ├── src/components/ui/
    │   ├── button.tsx          # shadcn button
    │   └── card.tsx            # shadcn card
    └── src/lib/utils.ts        # cn() 유틸리티
```

---

## 5. 핵심 아키텍처: 2단계 파이프라인

### Step 1 — 도시 추천 (`nomad_advisor()` in `app.py`)

```
사용자 입력 (UI/API)
→ 페르소나 진단 (utils/persona.py:diagnose_persona)
→ KRW → USD 환율 변환 (utils/currency.py)
→ 사전 검증 (prompts/builder.py:validate_user_profile)
    └─ hard_block 시: LLM 호출 없이 즉시 안내 메시지 반환
→ USE_DB_RECOMMENDER=1 (기본):
    └─ recommend_from_db(user_profile) → 규칙 기반 필터링+랭킹
→ USE_DB_RECOMMENDER=0 (LLM 경로):
    → Gemini Context Cache 조회 (api/cache_manager.py)
        ├─ 캐시 히트: build_step1_user_message() → query_model_cached()
        └─ 캐시 미스: build_prompt() → query_model()
    → parse_response()
→ visa_url 자동 주입 (data/visa_urls.json)
→ _user_profile 주입
→ format_step1_markdown()
    ├─ TOP 3 도시 카드 (USD + KRW 이중 통화)
    ├─ 세금 거주지 경고 (utils/tax_warning.py)
    ├─ 도시 비교 테이블 (api/parser.py:generate_comparison_table)
    └─ 참고 자료 링크
→ 반환: (markdown_str, cities_list, parsed_dict)
```

### Step 2 — 상세 가이드 (`show_city_detail_with_nationality()` in `app.py`)

```
선택 도시 + _user_profile
→ UI 언어 결정 (Step 1에서 저장된 언어 우선, 없으면 국적 기반 폴백)
→ build_detail_prompt() — 개인화 블록 조립
    ├─ 소득 증빙 유형별 힌트
    ├─ 체류 기간별 힌트
    ├─ 동반 구성별 힌트
    └─ 출국 임박 단계: 건강보험 기한 경고
→ query_model() (max_tokens=6144)
→ parse_response()
→ format_step2_markdown()
    ├─ 단계별 정착 가이드
    ├─ 비자 체크리스트
    ├─ 예산 테이블 (rent/food/cowork/insurance/misc)
    ├─ 첫 실행 스텝 (기한 있는 항목 최우선)
    ├─ 중기 숙소 딥링크 (utils/accommodation.py)
    └─ 플랜B 비쉥겐 버퍼 (쉥겐 국가 선택 시)
→ 반환: markdown_str
```

### Step 0 — 쉥겐 계산기 (독립 모듈)

```
입출국 날짜 리스트 → api/schengen_calculator.py → 잔여일 + 리셋 날짜 + 경고
- 29개국 기준, 롤링 윈도우 방식 (과거 180일 중 체류 합산)
```

---

## 6. 주요 컴포넌트 상세

### `server.py` — FastAPI 서버 (production entry)
- CORS 미들웨어 (nnai.app, localhost:3000, FRONTEND_URL)
- AuthMiddleware: 쿠키에서 user_id 추출 → request.state.user_id
- `POST /api/recommend` → nomad_advisor() 래핑
- `POST /api/detail` → show_city_detail_with_nationality() 래핑
- Gradio demo를 `/` 에 마운트 (레거시)
- `/ads.txt`, `/privacy` 정적 서빙

### `app.py` — 핵심 함수
- `nomad_advisor(nationality, income_krw, immigration_purpose, lifestyle, languages, timeline, preferred_countries=None, preferred_language="한국어", persona_type="", income_type="", travel_type="혼자 (솔로)", children_ages=None, dual_nationality=False, readiness_stage="", has_spouse_income="없음", spouse_income_krw=0)` → `tuple[str, list, dict]`
- `show_city_detail_with_nationality(parsed_data, city_index=0)` → `str`
- `_get_language_by_nationality(nationality)` → `str`

### `api/hf_client.py`
- `query_model(messages, max_tokens=2048)` → `str` — Gemini 2.5 Flash, `<think>` 블록 자동 제거
- `query_model_cached(user_message, cache, max_tokens=8192)` → `str` — 서버사이드 캐시 활용

### `api/parser.py`
- `parse_response(raw_text)` → `dict` — 4단계 파싱 (코드블록→정규식→suffix 복구→폴백)
- `format_step1_markdown(data)` → `str`
- `format_step2_markdown(data, visa_data=None)` → `str`
- `generate_comparison_table(top_cities)` → `str` — 5점 척도 비교 테이블
- `_inject_visa_urls(parsed)` — LLM 생성 URL을 visa_urls.json으로 자동 교체

### `api/cache_manager.py`
- `get_or_create_cache(system_prompt, data_context, few_shot_messages, cache_key)` → `CachedContent | None`
- `invalidate(cache_key=None)` — 캐시 무효화

### `api/schengen_calculator.py`
- `SCHENGEN_COUNTRIES: frozenset[str]` — 29개국 ISO-2
- `calculate_remaining_days(trips)` — 롤링 윈도우 잔여일 계산

### `recommender.py` — DB 기반 추천
- `recommend_from_db(user_profile)` → `dict` — visa_db + city_scores 규칙 기반 필터링/랭킹

### `prompts/builder.py`
- `build_prompt(user_profile)` → `list[dict]` — Step 1 전체 메시지 조립
- `build_step1_user_message(user_profile)` → `str` — 캐시 모드용 (동적 부분만)
- `build_detail_prompt(selected_city, user_profile)` → `list[dict]` — Step 2 메시지
- `validate_user_profile(user_profile)` → `dict` — `{"valid", "warnings", "hard_block"}`

### `utils/persona.py`
- 5가지 페르소나: `wanderer`, `local`, `planner`, `free_spirit`, `pioneer`
- `diagnose_persona(...)` → `str`, `get_persona_hint(persona_type)` → `str`

### `utils/db.py`
- `init_db(url=None)` → `connection` — 테이블 생성 (users, pins)
- `get_conn()` → `connection` — 싱글턴

### `api/auth.py`
- `GET /auth/google` → Google OAuth 리다이렉트
- `GET /auth/google/callback` → 토큰 교환, 유저 upsert, 쿠키 설정
- `GET /auth/me` → `{logged_in, name, picture, uid}`
- `GET /auth/logout` → 쿠키 삭제
- `extract_user_id(request)` → `str | None` — 미들웨어용

### `api/pins.py`
- `POST /api/pins` → 핀 저장
- `GET /api/pins` → 내 핀 목록
- `GET /api/pins/community` → 커뮤니티 핀 (도시별 집계, 최대 100)

---

## 7. UI 구조

### 현재: Gradio UI (레거시, ui/layout.py)
- Tab 1: 도시 추천 — 입력 폼(20+ 컴포넌트) + 결과 마크다운
- Tab 2: 상세 가이드 — 도시 선택 + 결과 마크다운
- 실시간 경고 시스템: check_income_warning(), check_companion_warning()
- 로딩 오버레이: 픽셀아트 지구본 애니메이션
- 노마드 게스트북 지도: Leaflet.js 모달

### 신규: Next.js Frontend (frontend/)
- 현재 스캐폴드만 생성. UI 구현 예정.
- 기술 스택: Next.js 16, Tailwind CSS 4, shadcn/ui, Framer Motion
- 디자인: 딥 네이비 (#1a1a2e) 배경, 타로 카드 UI (2:3 비율, 3장 가로), 세리프 폰트

---

## 8. 데이터 현황

### `data/visa_db.json` — 29개국

**주요 필드**: id, name, name_kr, visa_type, min_income_usd, stay_months, renewable, key_docs, visa_fee_usd, tax_note, cost_tier, notes, source, schengen, buffer_zone, tax_residency_days, double_tax_treaty_with_kr, mid_term_rental_available, income_period, ees_applicable, income_tiers, data_verified_date

### `data/city_scores.json` — 50개 도시

**주요 필드**: id, city, city_kr, country, country_id, monthly_cost_usd, internet_mbps, safety_score, english_score, nomad_score, climate, cowork_usd_month, coworking_score, community_size, mid_term_rent_usd, tax_residency_days, flatio_search_url, anyplace_search_url, nomad_meetup_url, korean_community_size, entry_tips

### DB 스키마 (PostgreSQL)

```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,       -- Google OAuth sub
    email TEXT, name TEXT, picture TEXT, created_at TEXT
);
CREATE TABLE pins (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    city TEXT NOT NULL, display TEXT, note TEXT,
    lat REAL NOT NULL, lng REAL NOT NULL,
    user_lat REAL, user_lng REAL, created_at TEXT NOT NULL
);
```

---

## 9. LLM 응답 JSON 스키마

### Step 1 (prompts/system.py 기준)

```json
{
  "top_cities": [
    {
      "city": "도시명 (영어)",
      "city_kr": "도시명 (한국어)",
      "country": "국가명 (영어)",
      "country_id": "ISO-2 코드",
      "visa_type": "비자 유형명",
      "visa_url": "비자 공식 URL (시스템이 visa_urls.json으로 자동 교체)",
      "monthly_cost_usd": 1800,
      "score": 9,
      "reasons": [{"point": "한국어 추천 근거", "source_url": null}],
      "realistic_warnings": ["경고 문자열"],
      "tax_warning": "세금 거주지 경고 또는 null",
      "plan_b_trigger": false,
      "references": [{"title": "출처 제목", "url": "https://..."}]
    }
  ],
  "overall_warning": "전체 공통 경고 (한국어)"
}
```

### Step 2 (prompts/builder.py 기준)

```json
{
  "city": "도시명",
  "country_id": "ISO-2 코드",
  "immigration_guide": {
    "title": "가이드 제목",
    "sections": [{"step": 1, "title": "섹션 제목", "items": ["항목"]}]
  },
  "visa_checklist": ["여권 사본", "소득 증빙 서류"],
  "budget_breakdown": {
    "rent": 600, "food": 300, "cowork": 100, "insurance": 60, "misc": 150
  },
  "budget_source": "https://www.numbeo.com/cost-of-living/in/...",
  "first_steps": ["건강보험 임의계속가입 신청 (퇴직 후 2개월 이내)"]
}
```

---

## 10. 테스트 구성

**실행**: `SKIP_EXTERNAL_INIT=1 .venv/bin/pytest tests/ -v`

**GitHub Actions CI**: `.github/workflows/main-tests.yml` — push/PR 시 자동 실행 (Python 3.11, core regression tests)

| 파일 | 주요 내용 |
|------|----------|
| test_builder.py | build_prompt(), build_detail_prompt(), validate_user_profile() |
| test_parser.py | parse_response() 4단계, format_step1/step2_markdown() |
| test_schengen_calculator.py | 90/180 롤링 윈도우, 경계값 |
| test_visa_db.py | 29개국 필수 필드 |
| test_city_scores.py | 50개 도시 필수 필드 |
| test_data_schema.py | visa_db + city_scores 스키마 검증 |
| test_ui.py | check_income_warning(), check_companion_warning() |
| test_tax_warning.py | get_tax_warning() 국가별 경고 |
| test_planb.py | get_planb_suggestions(), GE 노동이민법 경고 |
| test_persona.py | diagnose_persona() 5가지 분류 |
| test_accommodation.py | get_accommodation_links() |
| test_prompts.py | 시스템 프롬프트 필수 문구 |
| test_integration.py | 전체 파이프라인 연동 |
| test_currency.py | 환율 폴백 |
| test_hf_client.py | query_model() 에러 처리 |
| test_language_policy.py | 시스템 언어 정책 |
| test_recommender.py | DB 기반 랭킹 |
| test_db.py | PostgreSQL 연결 (skip without TEST_DATABASE_URL) |
| test_pins_api.py | 핀 CRUD (skip without TEST_DATABASE_URL) |
| test_pdf_generator.py | 전체 skip (PDF 기능 제거됨) |

---

## 11. 최근 주요 커밋 (`git log --oneline -10`)

```
2c72e72 feat: add Next.js frontend scaffold + backend API endpoints for frontend
d1f8970 Merge branch 'feat/tarot-ui' into main
c23faa0 fix: udpate
bcfe34a fix: update
bcc2a29 chore: ignore docs/superpowers from git
b1f9422 chore: remove users.db from git tracking
98e48ac feat: add SQLite→PostgreSQL data migration script
e9c8063 test: update tests for PostgreSQL (skip without TEST_DATABASE_URL)
bf9b86c fix: update pins.py SQL for PostgreSQL (placeholders + RETURNING id)
0a958b9 fix: update auth.py SQL placeholders for PostgreSQL
```

---

## 12. 알려진 이슈 (현재 미해결)

1. **`format_result_markdown()` 레거시**: `api/parser.py`에 잔존, `format_step1_markdown()`으로 대체됨. 미사용.
4. **Gemini Context Cache 조건부**: `GEMINI_API_KEY` 없으면 캐싱 없이 폴백.
5. **Frontend 미구현**: Next.js 스캐폴드만 생성. UI 구현 예정.

---

## 13. 로컬 실행

```bash
# Backend
cd /Users/flexxiblethinking/dev/nnai
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
export GEMINI_API_KEY="..." DATABASE_URL="..."
python server.py

# Frontend
cd frontend && npm install && npm run dev

# 테스트
SKIP_EXTERNAL_INIT=1 .venv/bin/pytest tests/ -v
```
