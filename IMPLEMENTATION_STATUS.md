# IMPLEMENTATION_STATUS.md — NomadNavigator AI

> **기준일**: 2026-03-29
> **기준 브랜치**: main (`2c72e72`)
> **배포 상태**: Backend — Railway (운영 중) / Frontend — Vercel (스캐폴드 배포)

---

## 1. Phase별 진행도

### Phase 1: 백엔드 핵심 파이프라인

| 항목 | 상태 | 파일 |
|------|:----:|------|
| Step 1 도시 추천 (LLM 경로) | ✅ | app.py, prompts/builder.py |
| Step 1 도시 추천 (DB 경로) | ✅ | recommender.py |
| Step 2 상세 가이드 | ✅ | app.py |
| LLM 응답 파싱 (4단계) | ✅ | api/parser.py |
| 마크다운 포맷 (Step 1/2) | ✅ | api/parser.py |
| 도시 비교 테이블 | ✅ | api/parser.py |
| Gemini Context Caching | ✅ | api/cache_manager.py |
| 사전 검증 (hard_block) | ✅ | prompts/builder.py |
| 시스템 프롬프트 (한/영) | ✅ | prompts/system.py, system_en.py |
| Few-shot 예시 | ✅ | prompts/few_shots.py |
| 정적 데이터 컨텍스트 | ✅ | prompts/data_context.py |

### Phase 2: 도메인 로직

| 항목 | 상태 | 파일 |
|------|:----:|------|
| 페르소나 진단 (5가지) | ✅ | utils/persona.py |
| 세금 거주지 경고 | ✅ | utils/tax_warning.py |
| 비쉥겐 버퍼 추천 (Plan B) | ✅ | utils/planb.py |
| 쉥겐 90/180 계산기 | ✅ | api/schengen_calculator.py |
| 중기 숙소 딥링크 | ✅ | utils/accommodation.py |
| 환율 변환 (실시간 + 폴백) | ✅ | utils/currency.py |
| 비자 URL 자동 주입 | ✅ | api/parser.py |
| 소득 경고 시스템 | ✅ | prompts/builder.py (삭제: ui/layout.py) |
| 시스템 언어 정책 (국적 기반) | ✅ | app.py |

### Phase 3: 인프라

| 항목 | 상태 | 파일/위치 |
|------|:----:|-----------|
| PostgreSQL 마이그레이션 | ✅ | utils/db.py, scripts/migrate_sqlite_to_pg.py |
| Google OAuth 2.0 | ✅ | api/auth.py |
| 핀 CRUD API | ✅ | api/pins.py |
| CORS 설정 | ✅ | server.py |
| Frontend API 엔드포인트 | ✅ | server.py (POST /api/recommend, /api/detail) |
| GitHub Actions CI | ✅ | .github/workflows/main-tests.yml |
| Railway 배포 | ✅ | Procfile |
| Vercel 배포 연결 | ✅ | frontend/ |
| AdSense + Privacy | ✅ | server.py, docs/privacy.html |

### Phase 4: 프론트엔드 (Next.js)

| 항목 | 상태 | 비고 |
|------|:----:|------|
| Next.js 프로젝트 스캐폴드 | ✅ | Next.js 16, TypeScript |
| Tailwind CSS 4 설치 | ✅ | |
| shadcn/ui 초기화 (card, button) | ✅ | |
| Framer Motion 설치 | ✅ | |
| Vercel 배포 | ✅ | Root: /frontend |
| Step 1 입력 폼 구현 | ⏳ | 20+ 컴포넌트 |
| Step 1 결과 렌더링 | ⏳ | 마크다운/카드 UI |
| Step 2 상세 가이드 UI | ⏳ | |
| 타로 카드 플립 애니메이션 | ⏳ | Framer Motion |
| 인증 연동 (Google OAuth) | ⏳ | 기존 /auth/* 재활용 |
| 노마드 지도 (React-Leaflet) | ⏳ | |
| i18n (한국어/영어) | ⏳ | |
| 반응형 디자인 | ⏳ | |
| 로딩/스켈레톤 UI | ⏳ | |

---

## 2. 아키텍처 개요

```
사용자 → nnai.app (Vercel/Next.js)
         → POST /api/recommend → api.nnai.app (Railway/FastAPI)
             → validate_user_profile()
             → recommend_from_db() or query_model()
             → parse_response() → format_step1_markdown()
             → return {markdown, cities, parsed}

         → POST /api/detail → api.nnai.app
             → build_detail_prompt()
             → query_model()
             → parse_response() → format_step2_markdown()
             → return {markdown}

         → /auth/* → Google OAuth 2.0
         → /api/pins → PostgreSQL CRUD
```

---

## 3. 모듈별 구현 내용

### 진입점

| 파일 | 역할 | 주요 함수 |
|------|------|-----------|
| server.py | FastAPI 서버, CORS, 미들웨어, API 엔드포인트 | api_recommend(), api_detail() |
| app.py | 핵심 비즈니스 로직 | nomad_advisor(), show_city_detail_with_nationality() |
| recommender.py | DB 기반 도시 필터링/랭킹 | recommend_from_db() |

### API 모듈

| 파일 | 역할 |
|------|------|
| api/hf_client.py | Gemini 2.5 Flash 클라이언트 (query_model, query_model_cached) |
| api/parser.py | JSON 파싱, 마크다운 포맷, 비교 테이블 |
| api/cache_manager.py | Gemini 서버사이드 Context Caching |
| api/schengen_calculator.py | 쉥겐 90/180 롤링 윈도우 |
| api/auth.py | Google OAuth 2.0 (4 endpoints) |
| api/pins.py | 핀 CRUD (3 endpoints) |

### 프롬프트

| 파일 | 역할 |
|------|------|
| prompts/builder.py | Step 1/2 프롬프트 조립, 입력 검증 |
| prompts/system.py | 한국어 시스템 프롬프트 (13개 규칙) |
| prompts/system_en.py | 영어 시스템 프롬프트 |
| prompts/few_shots.py | Few-shot 예시 메시지 |
| prompts/data_context.py | visa_db + city_scores 텍스트 압축 |

### 유틸리티

| 파일 | 역할 |
|------|------|
| utils/db.py | PostgreSQL init + 싱글턴 연결 |
| utils/currency.py | 실시간 환율 (fallback 포함) |
| utils/persona.py | 5가지 페르소나 진단/힌트 |
| utils/tax_warning.py | 세금 거주지 경고 생성 |
| utils/planb.py | 비쉥겐 버퍼 국가 추천 |
| utils/accommodation.py | 중기 숙소 딥링크 조회 |

---

## 4. 데이터

| 파일 | 규모 |
|------|------|
| data/visa_db.json | 29개국, 22 필드 |
| data/city_scores.json | 50개 도시, 21 필드 |
| data/visa_urls.json | 국가별 공식 비자 URL |

---

## 5. 테스트

- **프레임워크**: pytest
- **CI**: GitHub Actions (push/PR → Python 3.11, core regression tests)
- **테스트 파일**: 25개 (test_outputs 디렉토리 포함)
- **실행**: `SKIP_EXTERNAL_INIT=1 pytest tests/ -v`

---

## 6. 환경 변수 및 배포

### 배포 구조

```
Vercel (frontend) ← nnai.app
Railway (backend) ← api.nnai.app + PostgreSQL
Cloudflare (DNS) ← A @→76.76.21.21, CNAME api→Railway
```

### 환경 변수

| 변수 | 플랫폼 | 용도 |
|------|--------|------|
| GEMINI_API_KEY | Railway | LLM |
| DATABASE_URL | Railway | PostgreSQL |
| GOOGLE_CLIENT_ID | Railway | OAuth |
| GOOGLE_CLIENT_SECRET | Railway | OAuth |
| OAUTH_REDIRECT_URI | Railway | OAuth callback |
| SECRET_KEY | Railway | 세션 서명 |
| FRONTEND_URL | Railway | CORS origin |
| NEXT_PUBLIC_API_URL | Vercel | 백엔드 URL |

---

## 7. 미구현 항목 (백로그)

| 항목 | 우선순위 | 비고 |
|------|:--------:|------|
| Next.js 프론트엔드 UI 전체 구현 | P0 | Step 1 폼, 결과, Step 2, 인증 |
| 타로 카드 플립 애니메이션 | P0 | Framer Motion, Y축 회전 |
| i18n (한국어/영어) | P1 | next-intl 등 |
| 노마드 지도 (React-Leaflet) | P1 | 커뮤니티/내 핀 |
| 핀 삭제/수정 API (PUT/DELETE) | P2 | pins.py에 미구현 |
| ~~RAG 코드 정리~~ | ✅ | rag/ 디렉토리 삭제 완료 |
| PDF 관련 코드 정리 | P3 | test_pdf_generator.py skip 상태 |
