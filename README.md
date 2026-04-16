# NomadNavigator AI

**디지털 노마드를 위한 AI 이민 설계 서비스**

국적 · 월 수입 · 라이프스타일을 입력하면
**Gemini 2.5 Flash** 기반으로 최적의 거주 국가와 도시 TOP 3을 추천하고
비자/예산/세금 상세 가이드를 제공합니다.

## 주요 기능
- 29개국 비자 + 50개 도시 데이터 기반 맞춤 추천
- 도시별 생활비 시뮬레이션 및 예산 분석
- 비자 준비 체크리스트 자동 생성
- 5가지 페르소나 진단 (타로 카드 UI)
- 쉥겐 90/180 계산기
- 세금 거주지 경고 시스템

## 기술 스택
- **Backend**: FastAPI (Python)
- **Frontend**: Next.js 16 (TypeScript, Tailwind CSS 4, shadcn/ui)
- **AI**: Gemini 2.5 Flash + Context Caching
- **DB**: PostgreSQL
- **Auth**: Google OAuth 2.0
- **Deploy**: Vercel (frontend) + Railway (backend)

## 도메인
- **nnai.app** — 프론트엔드 (Vercel)
- **api.nnai.app** — 백엔드 API (Railway)

## 정책 문서
- [SECURITY.md](./SECURITY.md) — 현재 적용 중인 보안 통제와 프로덕션 오픈 전 하드닝 계획
- [TERMS.md](./TERMS.md) — 서비스 이용 조건, 구독/환불 기준 초안
- [docs/privacy.html](./docs/privacy.html) — 개인정보처리방침

---

This service is for reference only and does not constitute legal immigration advice.
