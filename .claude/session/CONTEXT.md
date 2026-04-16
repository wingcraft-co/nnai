# CONTEXT.md
_Last updated: 2026-04-16 KST (세션 3)_

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
- **결과 페이지**: 타로카드 UI — dark 모드, 3-Stage (selecting → revealing → done), 5장 고정 레이아웃
- **타로카드 디자인**: Amber Mono 2.0 기반 정적 프리미엄 디자인. Compass Rose 뒷면, Label+Value 앞면. CSS 변수만 사용, HEX 하드코딩 금지.
- **호버**: 모든 clickable 카드에 scale 1.025 + depth shadow 동일 적용. amber glow는 selected 전용.
- **잠금 카드**: 카드 크기 인라인 dim 오버레이 (🔒 + CTA → Polar 결제). fullscreen 모달은 제거됨.
- **CityLightbox**: X 닫기 아이콘 + ESC 키 + 바깥 클릭 닫기 지원.
- **메트릭 아이콘**: lucide-react (`Banknote`/`Stamp`/`Wifi`) w-4 h-4, CSS 변수 색상. 카드+라이트박스 통일.
- **폼 자동 넘김**: 단일 선택 + 조건부 필드 없음 → 자동 다음 스텝
- **단기 체류**: 소득 대신 월 예산 버튼 선택, 배우자 소득 숨김
- **캐릭터**: 폼에서 스텝 간 슬라이드 이동 (퀴즈 경유=페르소나, 직접 진입=grace+rocky)
- **디자인 시스템**: `docs/designs/tarot-card-design.md` — 카드 색상, 타이포, 레이아웃, 상태, 인터랙션 정의

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
- [ ] Block C penalty scale 재튜닝 (페르소나 가중치 변경 반영)
- [ ] visa_free_days 아내팀 검수 (docs/review/REVIEW_visa_free_days.md)
- [ ] 타로 세션 DB/Redis 마이그레이션 (현재 인메모리)
- [ ] IRT 문항반응이론 도입 (사용자 데이터 1000명+ 수집 후)
- [ ] Google OAuth 프론트엔드 연동
- [ ] 페르소나 결과 공유 기능
- [ ] 도시 데이터 확충 (북미/중동 커버리지 부족 → 빈 결과 원인)

## 주요 결정사항
- Gradio UI 레거시 전환, 신규 UI는 Next.js로만 구현
- 세션 문서는 .claude/session/에 보관, git 추적 대상
- 코드 커밋과 세션 문서 커밋 분리
- 타로카드 3D 플립 → 정적 프리미엄 디자인 (Compass Rose 뒷면 + Label+Value 앞면, CSS 변수 전용)
- UserPriority는 별도 질문 없이 기존 입력에서 암묵 추론
- Fuzzy 페르소나: 이진 할당 → 비율 벡터 블렌딩

## 참고 링크
- Repository: git@github.com:wingcraft-co/nnai.git
- 관련 문서: CLAUDE.md, docs/frontguide.docx (iCloud)
- 타로 UX 스펙: docs/superpowers/specs/2026-04-10-tarot-card-ux-design.md
- API 레퍼런스: cowork/backend/api-reference.md
