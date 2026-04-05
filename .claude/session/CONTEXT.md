# CONTEXT.md
_Last updated: 2026-04-05 KST_

## 프로젝트 개요
- 서비스명: NomadNavigator AI (NNAI)
- 목적: AI 기반 디지털 노마드 이민 설계 서비스 (Gemini 2.5 Flash로 최적 거주 도시 TOP 3 추천 + 비자/예산/세금 상세 가이드)
- 현재 단계: 개발 (백엔드 운영 중, 프론트엔드 스캐폴드 완료)

## 기술 스택 현황
- Frontend: Next.js 16 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui, Framer Motion
- Backend: FastAPI (Python 3), Gemini 2.5 Flash (OpenAI compat)
- DB: PostgreSQL
- Infra: Vercel (frontend, nnai.app) + Railway (backend, api.nnai.app) + Cloudflare DNS

## 현재 상태
폼 카피 전면 수정 완료. 스텝 5단계 확정 및 재배치.
타이틀/라벨/버튼 카피 확정. children_ages 스코어링 반영 완료.
타로카드 UX 재설계 대기 중.

## 최근 변경
- 폼 스텝 4→5단계 재배치 (소득↔동행 순서 교체)
- 타이틀/라벨/버튼 카피 전면 수정
- children_ages 연령대별 스코어링 반영
- CTA "도시 추천 받기" 확정
- API 프록시 route.ts 하드코딩 URL → NEXT_PUBLIC_API_URL 환경변수화

## 진행 중인 작업
- [x] 백엔드 스코어링 로직 전면 재설계
- [x] 폼 스텝 구조 재확정 (5단계)
- [x] 신규 인풋 추가 (stay_style, tax_sensitivity)
- [x] lifestyle 선택지 교체 + 백엔드 키 매핑
- [x] 폼 카피 수정
- [x] children_ages 스코어링 반영
- [ ] 타로카드 UX 재설계
- [ ] LLM 재도입 시점 + 페르소나 백엔드 연동 방식 검토
- [ ] 페르소나 결과 공유 기능
- [ ] Google OAuth 프론트엔드 연동

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
