# CONTEXT.md
_Last updated: 2026-04-10 KST_

## 프로젝트 개요
- 서비스명: NomadNavigator AI (NNAI)
- 목적: AI 기반 디지털 노마드 이민 설계 서비스 (Gemini 2.5 Flash로 최적 거주 도시 TOP 3 추천 + 비자/예산/세금 상세 가이드)
- 현재 단계: 개발 (백엔드 운영 중, 프론트엔드 스캐폴드 완료)

## 기술 스택 현황
- Frontend: Next.js 16 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui, Framer Motion
- Backend: FastAPI (Python 3), Gemini 2.5 Flash (OpenAI compat)
- DB: PostgreSQL
- Infra: Vercel (frontend, nnai.app / dev.nnai.app) + Railway (backend, api.nnai.app / api-dev.nnai.app) + Cloudflare DNS

## 현재 상태
**Step1 TOP3 추천은 규칙 기반 DB Recommender로 고정** (LLM 개입 없음).
Block 가중치가 체류 기간(단기/중기/장기)에 따라 동적 분기됨.
Block C 페르소나 가중치 전면 재설계 완료 — 서사와 스코어링 정렬.
단기 체류자에게 "총 예산" 입력 UI 제공 (월 소득 대신).
페르소나 미선택 시 Block C 가중치가 Block A에 합산됨.

## 최근 변경 (04-10 우리팀 작업)
- Block 가중치 동적 분기: 단기(A40/B10/C40/D10), 중기(A30/B25/C30/D15), 장기(A30/B25/C25/D20)
- Block 함수에서 가중치 곱셈 제거, `_compute_score_breakdown()`에서 일괄 적용
- 단기 Block D visa_score 0 처리
- `total_budget_krw` 백엔드 파이프라인 (server.py, app.py)
- 프론트엔드 단기 체류 시 총 예산 입력 UI (form/page.tsx)
- Block C 페르소나 가중치 재설계:
  - wanderer: nomad(3.5) + visa_freedom(2.5) + cowork(1.5)
  - local: community(3.5) + safety(2.5) + long_stay(1.5)
  - planner: cost(3.0) + tax_days(2.5) + renewable(2.0)
  - free_spirit: safety(3.0) + climate(2.5) + cost(2.0)
  - pioneer: renewable(3.5) + english(2.5) + community(1.5)
- 신규 가상 속성: visa_freedom, climate_score, long_stay_score
- 페르소나 미선택 시 Block C→Block A 가중치 합산
- API 문서 동기화 (total_budget_krw)

## 진행 중인 작업
- [x] 백엔드 스코어링 로직 전면 재설계
- [x] 폼 스텝 구조 재확정 (5단계)
- [x] 신규 인풋 추가 (stay_style, tax_sensitivity)
- [x] lifestyle 선택지 교체 + 백엔드 키 매핑
- [x] 폼 카피 수정
- [x] children_ages 스코어링 반영
- [x] Block C dominance penalty (치앙마이 독점 방지)
- [x] Min-Max Normalization + internet_mbps 스코어링
- [x] 모바일 API 계약 (type-actions, uploads)
- [x] rawdata AE/TW 검증 및 동기화
- [x] Block 가중치 동적 분기 (체류 기간 기반)
- [x] Block C 페르소나 가중치 재설계 (서사 정렬)
- [x] 단기 체류 총 예산 UI + 백엔드 파이프라인
- [ ] 타로카드 UX 재설계
- [ ] LLM 재도입 시점 + 페르소나 백엔드 연동 방식 검토
- [ ] 페르소나 결과 공유 기능
- [ ] Google OAuth 프론트엔드 연동
- [ ] Block C penalty scale 재튜닝 (페르소나 가중치 변경 반영)

## 서비스 포지셔닝 (2026-03-30 확정)

**핵심 포지셔닝:**
"노마드가 되고 싶은 게 아니라, 어떤 노마드가 될지 모르는 거야. 우리가 찾아줄게."

**차별점:**
기존 노마드 정보 서비스가 '정보 제공'에 머무는 반면,
NNAI는 '자기 발견의 경험'을 입구로 사용한다.
페르소나 진단 → 국가 추천으로 이어지는 구조는
자아 분류(자기 서사) + 실제 행동 가능한 결론을 동시에 제공한다.

**UX 설계 필터:**
기능을 추가할 때마다 "이게 유저의 나 서사를 강화하는가?"를 기준으로 판단한다.

**자연 유입 경로:**
페르소나 결과는 공유 가능한 콘텐츠로 설계한다.
"나는 거점 정착형 노마드야" — MBTI 공유 심리와 동일한 구조.

## 주요 결정사항
- Gradio UI 레거시 전환, 신규 UI는 Next.js로만 구현
- 세션 문서는 .claude/session/에 보관, git 추적 대상
- 코드 커밋과 세션 문서 커밋 분리

## 참고 링크
- Repository: git@github.com:wingcraft-co/nnai.git
- 관련 문서: CLAUDE.md, docs/frontguide.docx (iCloud)
