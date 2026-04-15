# CHANGELOG

## [2026-04-16 KST 세션 2] — 카드 호버/잠금 인터랙션 + 메트릭 영역 i18n·환율 정합화

### 변경 파일
- `frontend/src/components/tarot/TarotCard.tsx` : 공개 카드 호버 인터랙션 + 메트릭 헬퍼 적용
- `frontend/src/components/tarot/TarotDeck.tsx` : LockedUpgradeLightbox 신규(Polar 결제 유도) + CityLightbox 메트릭 헬퍼 적용
- `frontend/src/components/tarot/format.ts` : 신규 — 메트릭 포맷 헬퍼 + `useKrwRate` hook
- `frontend/src/app/api/currency/route.ts` : 신규 — frankfurter.app BFF (1시간 revalidate, fallback 1400)
- `docs/designs/tarot-card-design.md` : States 표 갱신(Hover/Locked 행) + Decisions Log 항목 2개 추가

### 작업 요약
- 무엇을:
  1. 공개 카드(`state==="front"`) 호버 인터랙션 — scale 1.025 + depth shadow + 미세 border lift
  2. 잠금 카드 클릭 → `LockedUpgradeLightbox` (Polar 결제 유도, `PolarCheckoutButton` 재사용)
  3. 메트릭 영역 5가지 문제 일괄 정리 — VISA 라벨 모호성, `toKRW` 두 곳 불일치, 메트릭 비대칭, i18n 부재, 환율 하드코딩
- 왜: 사용자 점검에서 카드 UX 정합성 부족 확인. 백엔드 Polar 결제 도입에 맞춰 잠금 카드를 결제 entry point로 전환
- 영향 범위: result 페이지 카드 인터랙션·라이트박스·메트릭 표시. 백엔드 변경 없음

### 주요 결정사항
- **Hover 정책**: amber glow는 selected 전용. hover는 depth shadow + scale + 미세 border lift만. CSS 변수만 사용 (HEX 금지).
- **Locked 패턴 추가**: 잠금 카드 클릭 가능. 라이트박스 패턴 재사용. 디자인 문서 States 표에 Locked 행 신설.
- **카피 톤**: 타로/서정형 — "선택하지 않은 운명도 들여다보세요" / "Look into the lives you didn't choose"
- **VISA 라벨 분기**: `VISA-FREE` + days(60일/days) | `VISA` + 필요(Required). 디자인 문서 line 66과 일치.
- **toKRW 일관화**: `formatMonthly`로 단일화. 두 곳 모두 `약 196만원` (또는 en 모드 `$1,400`).
- **메트릭 비대칭 해결**: `formatInternet`이 null일 때 `"—"` 반환. 카드/라이트박스 모두 항상 3 cell.
- **환율 BFF**: frankfurter.app(키 불필요/무료), 1시간 `revalidate`, 실패 시 `1400` fallback.
- **`useKrwRate` hook**: module-level 캐시 + pending promise dedup으로 다중 컴포넌트 호출 시에도 fetch 1회.

### 다음 세션 참고사항
- UI 동작은 dev 서버에서 직접 확인 (사용자 진행)
- 영어 카피 가안 — 카피라이팅 검토 시 별도 작업
- `formatInternet`의 placeholder `"—"`는 metric 비대칭 임시 해결안. 데이터 보강 후 재검토 가능
- 환율 BFF는 frankfurter.app 의존. 백엔드 `currency.py`와 통합 검토는 추후
- `.claude/settings.json` 권한 추가, `.claude/commands/`, `.claude/session/scp.sh` 여전히 unstaged — 사용자 결정 대기

---

## [2026-04-16 KST] — origin/develop fast-forward + CLAUDE.md 동기화

### 변경 파일
- `CLAUDE.md` : 14개 신규 commit 반영 (모바일 API, 타로 세션, rate limit, billing, i18n, Polar 결제)
- `.claude/session/CHANGELOG.md` : 본 항목 추가

### 작업 요약
- 무엇을: 아내팀이 push한 14 commits를 fast-forward로 받아오고, 우리 CLAUDE.md를 최신 아키텍처에 맞춰 업데이트
- 왜: `SKIP_RAG_INIT → SKIP_EXTERNAL_INIT` 리네임, Gradio/RAG 레거시 제거, 모바일 API 8종 신설, `/api/recommend` 응답 형식 변경, `/api/reveal` 신규, rate limit + billing entitlement + PAYG 도입, Polar 결제 시스템, i18n 라우팅 등 큰 변경이 들어왔는데 CLAUDE.md(원본 develop 버전 포함)에 미반영
- 영향 범위: 문서 전용 — 코드 영향 없음. fast-forward 전 우리 frontend 작업물(타로 컴포넌트, `[locale]/result/`, BFF API routes)이 origin과 트리 해시 동일함을 확인하여 충돌 없음 검증

### CLAUDE.md 변경 요지
- **Architecture 트리**: `api/{tarot_session,visits,mobile_*}`, `utils/{rate_limit,security_events}` 추가
- **Environment Variables**: `POLAR_CHECKOUT_URL` / `NEXT_PUBLIC_POLAR_CHECKOUT_URL` 추가
- **Backend API Endpoints**: `/api/reveal`, `/api/visits/ping`, mobile_* 라우터 8종 추가
- **POST /api/recommend**: 새 필드 (`stay_style`, `tax_sensitivity`, `total_budget_krw`, `persona_vector`) + 응답 형식 변경 명시 (`markdown/cities` → `session_id/card_count`)
- **POST /api/reveal**: 신규 섹션
- **새 섹션 — Rate Limit & Billing**: rate limit 정책 표, billing entitlement, PAYG, Polar 결제
- **Frontend Development Guide**: i18n `[locale]` 라우트 구조, tweakcn Amber Mono 2.0 디자인 시스템 명시, BFF API 4종 (recommend/detail/reveal/billing-checkout) 정리
- **프론트엔드 현재 상태**: 2026-03-29 → 2026-04-16 갱신 (타로 UX/결제/광고 모듈 진행 상황 반영)

### 사전 점검 결과
- `frontend/[locale]/result/` 트리 해시 HEAD == origin/develop (`c9f3028`) — 우리 작업물 무손실
- `frontend/src/app/api/{recommend,detail,reveal}/` 양쪽 동일 — 우리 BFF route는 이미 새 백엔드 응답 형식과 호환
- `.claude/session/CHANGELOG.md`, `.claude/settings.json` origin 미변경 — unstaged 변경 그대로 보존
- backend `/api/recommend` BREAKING CHANGE (응답에서 `markdown`, `cities` 제거)는 우리 frontend `reveal` route가 이미 처리 중

### 다음 세션 참고사항
- `.claude/session/CONTEXT.md` 갱신 미완료 — 마이너 업데이트 필요 (현재 상태 라인만 갱신)
- `.claude/settings.json` 권한 추가 (Read, Bash) unstaged — commit 여부 사용자 결정 대기
- `.claude/commands/`, `.claude/session/scp.sh` untracked — gstack 슬래시 커맨드 심링크 / scp 헬퍼, .gitignore 정책 결정 대기
- push는 사용자 확인 후 진행 (이번 세션은 로컬 commit까지만)
- 백엔드 새 모바일 API 8종은 향후 모바일 앱 작업 시 별도 점검 필요

---

## [2026-04-11 KST] — 타로카드 UX 재설계 + 추천 로직 고도화 설계 확정

### 변경 파일
- `frontend/src/app/[locale]/result/page.tsx` : 타로카드 4-Stage 전면 재구현
- `frontend/src/components/tarot/TarotCard.tsx` : 정적 프리미엄 디자인 (Compass Rose 뒷면, Label+Value 앞면)
- `frontend/src/components/tarot/TarotDeck.tsx` : 셔플 제거, 정적 배치
- `frontend/src/components/tarot/TarotReading.tsx` : 3장 순차 리딩 + 타이핑 효과
- `frontend/src/components/tarot/CityCompare.tsx` : 리딩 하단 자연 연결
- `docs/designs/tarot-card-design.md` : 타로카드 디자인 시스템 문서
- `backend/prompts/system.py` : 짧은 리딩 전용 프롬프트 추가
- `backend/prompts/system_en.py` : 동일
- `.claude/commands/` : gstack 슬래시 커맨드 심링크 연결

### 작업 요약
- 무엇을: 타로카드 UX 전면 재설계 + 추천 로직 고도화 3개 이슈 설계 확정
- 왜: 기존 3D 플립/파티클 애니메이션이 웹 기반 한계로 조악하게 느껴짐 → 정적 프리미엄 디자인으로 전환. 리딩 경험 중심으로 재설계.
- 영향 범위: 결과 페이지 전체 UX, 백엔드 API 응답 구조, LLM 프롬프트

### 주요 결정사항
- 3D 플립/파티클/셔플 → 완전 제거. opacity fade + scale whileTap만 허용
- 리딩: 1장 깊게 → 3장 짧게 순차 리딩으로 전환
- OAuth 게이트: "리딩 받기" → "전체 가이드 받기"로 후퇴 (리딩 완료 후)
- 테마: tweakcn Amber Mono 2.0 CSS 변수 전용. HEX 하드코딩 금지
- gstack 심링크: `ln -sf ~/.claude/skills/gstack/* .claude/commands/` 로 슬래시 커맨드 활성화
- GPT Image API(gpt-image-1-mini) 발급 완료 — /design-shotgun 탐색용. 서비스 런타임 미사용이므로 유지비 없음

### 추천 로직 고도화 설계 확정 (구현은 이전 세션 완료)
- Block 가중치 동적 분기: 단기(A40/B10/C40/D10) / 중기(A30/B25/C30/D15) / 장기(현행)
- 단기 체류 시 총 예산(total_budget_krw) 인풋 전환 + visa_score 0 처리
- Block C 페르소나 가중치 재설계 (서사 정렬):
  - wanderer: nomad(3.5) + visa_freedom(2.5) + cowork(1.5)
  - local: community(3.5) + safety(2.5) + long_stay(1.5)
  - planner: cost(3.0) + tax_days(2.5) + renewable(2.0)
  - free_spirit: safety(3.0) + climate(2.5) + cost(2.0)
  - pioneer: renewable(3.5) + english(2.5) + community(1.5)
- 신규 가상 속성 3개: visa_freedom / climate_score / long_stay_score
- 페르소나 미선택 시 Block C → Block A 합산
- visa_db.json visa_free_days 필드 추가 (39개국, 한국 여권 기준)
- TOP3 결과 카드 비자 배지 (무비자 N일 / 셴겐 / 비자 필요)

### 다음 세션 참고사항
- gstack /design-consultation → /design-shotgun 실행 (새 세션, 터미널에서 슬래시 커맨드 직접 입력)
- 타로카드 비주얼 확정 후 지시문 #6 구현 진행
- Block C penalty scale 재튜닝 (페르소나 가중치 변경 반영) 미완
- visa_free_days 아내팀 검수 필요 (docs/review/REVIEW_visa_free_days.md)
- 타로 세션 인메모리 → DB/Redis 마이그레이션 추후

---

## [2026-04-11 KST 세션 4] — 타로카드 UI 전면 재설계 (Amber Mono 2.0 디자인 시스템)

### 변경 파일
- `docs/designs/tarot-card-design.md` : 신규 — 타로카드 디자인 시스템 (색상, 타이포, 카드 뒷면/앞면 스펙)
- `frontend/src/components/tarot/TarotCard.tsx` : 전면 재작성 — 컴패스 로즈 뒷면, Label+Value 앞면, 잠금 상태. 3D 플립 제거.
- `frontend/src/components/tarot/TarotDeck.tsx` : 전면 재작성 — 정적 5장 가로 배치, 부채꼴/셔플 제거
- `frontend/src/components/tarot/TarotReading.tsx` : 전면 재작성 — 3장 순차 리딩 + 타이핑 효과 (30ms/글자)
- `frontend/src/components/tarot/CityCompare.tsx` : 하드코딩 HEX/gray 클래스 → CSS 변수 전환
- `frontend/src/components/tarot/types.ts` : reading_text 필드 추가, "deck" 스테이지 제거
- `frontend/src/app/[locale]/result/page.tsx` : 전면 재설계 — dark 모드 래퍼, 새 스테이지 플로우
- `prompts/system.py` : reading_text 필드 추가 (타로 리더 톤 짧은 리딩)
- `prompts/system_en.py` : reading_text 필드 추가 (영문)
- `CLAUDE.md` : Design System 참조 섹션 + Skill routing 섹션 추가

### 작업 요약
- 무엇을: 타로카드 UI를 정적 프리미엄 디자인으로 전면 교체. gstack /design-consultation으로 디자인 시스템 수립 후 컴포넌트 재구현.
- 왜: 기존 3D 플립 애니메이션이 시각적으로 조악하고 웹 기반 퀄리티가 낮음. 애니메이션 없이 정적 비주얼만으로 타로의 신비감과 고급감 표현.
- 영향 범위: 결과 페이지 전체 (selecting → revealed → reading → comparing), LLM 프롬프트 스키마

### 디자인 결정
- 카드 뒷면: Compass Rose (8포인트 나침반 + 코너 장식) — CSS 전용, 이미지 없음
- 카드 앞면: Label + Value (소문자 라벨 + 데이터 값) — 정보 명확성 우선
- 색상: CSS 변수만 사용 (HEX 하드코딩 금지), dark 모드 강제
- 폰트: font-serif (Noto Serif KR) 한글, font-mono (Geist Mono) 영문/데이터
- 허용 애니메이션: opacity 페이드인 (0.4s), scale whileTap (1.02), 타이핑 효과
- 금지: rotateY/X, 파티클, 물리 기반, 복잡한 stagger

### 다음 세션 참고사항
- `reading_text`는 LLM 프롬프트에 추가됐으나 아직 백엔드 실서버에서 생성되지 않을 수 있음 (기존 캐시된 응답엔 미포함)
- gstack 설정 완료: telemetry=community, proactive=true, routing rules in CLAUDE.md
- 디자인 프리뷰 HTML: `~/.gstack/projects/wingcraft-co-nnai/designs/tarot-cards-20260410/tarot-preview.html`

---

## [2026-04-10 KST 세션 3] — 전수조사 604K건 + 빈 결과/차별화 수정 + UX 폴리싱

### 변경 파일
- `recommender.py` : 소득 필터 fallback (빈 결과 방지), income=0 바이패스, Block D companion 가중치 동적 분기(가족/자녀/혼자), DerivedPriority 강화
- `frontend/src/app/[locale]/result/page.tsx` : 디버그 패널 제거
- `frontend/src/app/[locale]/onboarding/form/page.tsx` : 페르소나 배지 카피 수정("~를 위한 도시를 찾아볼게요"), 한국어 을/를 자동 선택, 다시하기 버튼 제거
- `scripts/scoring_audit.py` : 신규 — 전수조사 스크립트 (604,800건)
- `docs/review/scoring_audit_report.json` : 감사 결과

### 작업 요약
- 무엇을: 스코어링 전수조사 604,800건 실행, 빈 결과 22,200→0건 해결, travel_type 차별화 강화, UX 카피 폴리싱
- 왜: 모든 입력 조합에서 에러/빈 결과/비정상 점수가 없는지 검증, 유저 경험 일관성 보장
- 영향 범위: 추천 엔진 하드필터, Block D 내부 가중치, 프론트엔드 UX 카피

### 전수조사 결과
- 총 조합: 604,800건 (6 페르소나 × 5 목적 × 4 체류 × 6 소득 × 4 동행 × 3 체류형태 × 3 세금 × 5 라이프스타일 × 6 대륙)
- 에러: 0건
- 점수 이상(0~10 범위 벗어남): 0건
- 차별화 검증: 9/9 통과 (purpose, persona, income, travel 모두 결과 차이 확인)
- 빈 결과: 데이터 커버리지 한계(북미 1국, 중동 2국)로 일부 대륙+소득 조합에서 발생 — 설계 오류 아님

### 다음 세션 참고사항
- `scripts/scoring_audit.py`로 언제든 전수조사 재실행 가능
- 도시 데이터 확충 시 빈 결과 자연 해소 (북미/중동/아프리카)
- gstack (Garry Tan Claude Code 스킬팩) 설치 완료 (`~/.claude/skills/gstack`)

---

## [2026-04-10 KST 세션 2] — 스코어링 고도화 + TOP5 세션 API + 결과 페이지 재설계

### 변경 파일 (주요)
- `recommender.py` : immigration_purpose Block A 가중치, Fuzzy 페르소나 블렌딩, Derived UserPriority, _get_block_weights 동적 분기, Block C 가상 속성 3개, Block D 단기 visa 0
- `api/tarot_session.py` : 신규 — 5장 서버사이드 세션 저장 + reveal 게이팅
- `server.py` : /api/reveal 엔드포인트 추가, RecommendRequest에 total_budget_krw + persona_vector, recommend 응답 session_id 전환
- `app.py` : total_budget_krw 소득 변환 분기, persona_vector 전달
- `prompts/builder.py` : Step 2 LLM 프롬프트에 타로 리더 톤 추가
- `data/visa_db.json` : visa_free_days 필드 39개국 추가
- `frontend/src/app/[locale]/result/page.tsx` : 전면 재설계 — 정보 중심 4-Stage (선택→상세→리딩→비교) + 디버그 패널
- `frontend/src/app/[locale]/onboarding/form/page.tsx` : 자동 넘김, 단기 예산 버튼, 배우자 소득 버튼, 홈 아이콘, grace+rocky 캐릭터, purpose 동적 타이틀
- `frontend/src/app/[locale]/onboarding/quiz/page.tsx` : Fuzzy 벡터 계산+저장, 홈 아이콘
- `frontend/src/data/quiz-questions.ts` : calculatePersonaVector() 추가
- `frontend/src/components/onboarding/persona-result-card.tsx` : 페르소나 캐릭터 + 땅 라인
- `frontend/src/components/tarot/` : TarotReading, CityCompare (결과 페이지에서 사용)
- `frontend/src/app/api/reveal/route.ts` : 신규 프록시
- `cowork/backend/api-reference.md` : /api/reveal 추가, /api/recommend 응답 변경
- `tests/test_tarot_session.py` : 신규 9개 테스트
- `tests/test_recommender.py` : 가중치 테스트 6개 추가

### 작업 요약

**스코어링 엔진 고도화:**
- Block 가중치를 체류 기간별 동적 분기 (각 block 함수에서 곱셈 제거, 중앙 일괄 적용)
- immigration_purpose → Block A 내부 가중치 동적 변경 (원격근무=cowork↑, 은퇴=safety↑)
- Fuzzy 페르소나: 퀴즈 7문항 다수결 → 비율 벡터 블렌딩 (wanderer 57%, planner 29%...)
- Derived UserPriority: 소득/동행/체류형태/lifestyle에서 block별 배율 암묵 추론 (cross-block)
- Block C 페르소나 가중치 전면 교체 (서사 정렬) + 가상 속성 3개 (visa_freedom, climate_score, long_stay_score)

**TOP5 세션 기반 API:**
- /api/recommend → session_id만 반환 (도시 데이터 미포함)
- /api/reveal → 유저가 선택한 3장만 반환 (백엔드 게이팅, BM 대비)
- 인메모리 세션 (api/tarot_session.py) — Railway 재배포 시 초기화됨

**프론트엔드:**
- 결과 페이지: 타로 카드 애니메이션 → 정보 중심 4-Stage UI로 전환
- 폼: 자동 넘김 (단일 선택 완료 시 0.3초 후 다음 스텝), 이전 시 필드 초기화
- 폼: 단기 체류 시 소득→예산 버튼, 배우자 소득 텍스트→버튼, Step 3 타이틀 동적 변경
- UX: 홈 아이콘(퀴즈/폼 첫 스텝), 캐릭터 슬라이드 이동, 퀴즈 결과 캐릭터+땅라인

**데이터:**
- visa_db.json에 visa_free_days 추가 (39개국, 한국 여권 기준)
- 프론트 복사본 동기화, 결과 카드 비자 배지

### 다음 세션 참고사항
- **타로 세션 인메모리**: Railway 재배포 시 세션 날아감. 사용자가 recommend → reveal 사이에 배포되면 "Session not found" 에러. DB/Redis 마이그레이션 우선순위 높음.
- **Railway DEBUG_MODE=1**: 결과 페이지 디버그 패널이 이 환경변수가 켜져있어야 데이터 표시됨. dev 환경에 설정 필요.
- **Block C penalty scale**: 페르소나 가중치가 전면 변경되었으므로 기존 scale 값(0.25~1.5) 재튜닝 필요.
- **visa_free_days 검수**: docs/review/REVIEW_visa_free_days.md 참조. TH(60일→30일 논의), MX(심사관 재량), CA(eTA), KE(ETA) 확인 필요.
- **IRT**: 퀴즈 응답 로그를 DB에 저장하는 구조 마련 후, 1000명+ 데이터 수집 시 문항별 변별도 캘리브레이션 가능.

---

## [2026-04-10 KST] — visa_free_days 필드 추가 + 결과 카드 비자 배지

### 변경 파일
- `data/visa_db.json` : 39개국에 visa_free_days 필드 추가 (한국 여권 기준)
- `frontend/src/data/visa_db.json` : 프론트엔드 복사본 동기화
- `recommender.py` : API 응답에 visa_free_days 포함
- `frontend/src/app/[locale]/result/page.tsx` : City 타입 추가 + 비자 배지 UI
- `docs/review/REVIEW_visa_free_days.md` : 아내팀 검수 요청 문서

### 작업 요약
- 무엇을: 한국 여권 기준 무비자 체류 일수를 visa_db에 구조화하고, 결과 카드에 배지로 표시
- 왜: 무비자 정보가 visa_notes 텍스트에만 묻혀 있어 스코어링/UI에서 활용 불가했음
- 영향 범위: visa_db 스키마, API 응답, 프론트엔드 결과 카드

### 배지 분기 로직
- 셴겐 + 무비자 → "🛂 무비자 90일 (셴겐)"
- 비셴겐 + 무비자 → "🛂 무비자 {N}일"
- 무비자 불가(CV) → "🛂 비자 필요"

### 다음 세션 참고사항
- 아내팀(rosie) visa_free_days 전수 검수 필요 (docs/review/REVIEW_visa_free_days.md)
- 특히 TH(60일→30일 축소 논의), MX(심사관 재량), CA(eTA), KE(ETA) 확인 필요

---

## [2026-04-10 KST] — 체류 기간 모드 분기 + Block C 페르소나 재설계

### 변경 파일
- `recommender.py` : Block 함수 가중치 분리, `_get_block_weights()` 동적 분기, Block D 단기 visa 0, Block C 페르소나 가중치 전면 교체, 신규 가상 속성 3개(visa_freedom, climate_score, long_stay_score), 페르소나 미선택 시 Block C→A 합산
- `server.py` : RecommendRequest에 total_budget_krw 추가
- `app.py` : nomad_advisor() 시그니처 + 단기 체류 예산 변환 로직
- `frontend/src/app/[locale]/onboarding/form/page.tsx` : 단기 체류 시 총 예산 입력 UI, FormData에 total_budget 추가, canProceed 분기, payload 변경
- `cowork/backend/api-reference.md` : total_budget_krw 필드 추가
- `tests/test_recommender.py` : 가중치 테스트 6개 추가, pioneer 테스트 재설계

### 작업 요약
- 무엇을: 체류 기간(단기/중기/장기) 기반 Block 가중치 동적 분기 + Block C 페르소나 가중치 서사 정렬 재설계 + 단기 체류 총 예산 UI
- 왜: 단기 체류자에게 비자/비용 Block이 과도하게 영향, 페르소나 서사(프론트)와 스코어링(백엔드) 괴리 해소
- 영향 범위: 백엔드 추천 로직 전체, 프론트엔드 폼 Step 3, API 스키마

### 가중치 동적 분기
| 모드 | Block A | Block B | Block C | Block D |
|------|---------|---------|---------|---------|
| 단기 (≤3개월) | 0.40 | 0.10 | 0.40 | 0.10 |
| 중기 (≤12개월) | 0.30 | 0.25 | 0.30 | 0.15 |
| 장기 (>12개월) | 0.30 | 0.25 | 0.25 | 0.20 |

### Block C 페르소나 가중치 (신규)
| 페르소나 | 속성 1 | 속성 2 | 속성 3 |
|----------|--------|--------|--------|
| wanderer | nomad(3.5) | visa_freedom(2.5) | cowork(1.5) |
| local | community(3.5) | safety(2.5) | long_stay(1.5) |
| planner | cost(3.0) | tax_days(2.5) | renewable(2.0) |
| free_spirit | safety(3.0) | climate(2.5) | cost(2.0) |
| pioneer | renewable(3.5) | english(2.5) | community(1.5) |

### 다음 세션 참고사항
- Block C penalty scale 재튜닝 필요 (페르소나 가중치 변경으로 기존 scale 최적값 변동 가능)
- 타로카드 UX 재설계 (별도 세션)
- dev.nnai.app에서 단기 체류 총 예산 UI 실사용 테스트 필요

---

## [2026-04-10 KST] — 아내팀(rosie/case) 작업 pull 반영 (04-06~04-09, 24커밋)

### 변경 파일 (주요)
- `recommender.py` : Min-Max Normalization, internet_mbps 스코어링, Block B/C 조정, dominance penalty
- `server.py` : 라우트 추가 (mobile uploads)
- `app.py` : 추천 로직 LLM 제거 연동
- `api/mobile_type_actions.py` : 신규 — 모바일 type-actions API
- `api/mobile_uploads.py` : 신규 — 모바일 업로드 엔드포인트
- `api/mobile_auth.py`, `api/mobile_discover.py`, `api/mobile_feed.py` : 모바일 API 확장
- `frontend/src/components/debug/CityDebugPanel.tsx` : 신규 — 디버그 스코어링 로그 패널
- `frontend/src/app/[locale]/result/page.tsx` : 디버그 패널 연동
- `data/city_scores.json` : 누락 도시 추가 + 안전 지표 블렌딩
- `data/rawdata/*.csv` : AE/TW 비자 메타데이터 검증 갱신
- `utils/db.py` : 마이그레이션 테이블 추가
- `migrations/002~005` : 신규 DB 마이그레이션 4개
- `scripts/recompute_city_safety_blended.py` : 신규 — GPI 안전 지표 블렌딩 스크립트
- `scripts/recompute_city_safety_from_gpi.py` : 신규 — GPI 원본 데이터 스크립트
- `tests/test_recommender.py` : 치앙마이 dominance 회귀 테스트 추가
- `tests/test_mobile_*.py` : 모바일 API 테스트 3개 추가
- `docs/plans/2026-04-09-block-c-dominance-penalty.md` : Block C dominance penalty 구현 계획
- `docs/specs/2026-04-09-block-c-dominance-penalty-design.md` : Block C 설계 스펙

### 작업 요약
- 무엇을: 추천 로직 대폭 개선 (스코어링 정규화, 독점 방지, 안전 지표 블렌딩) + 모바일 API 확장 + rawdata 검증
- 왜: 치앙마이 등 저비용+고nomad 도시가 거의 모든 프로필에서 TOP3에 반복 등장하는 구조적 문제 해결 + 모바일 앱 API 계약 수립
- 영향 범위: 백엔드 추천 로직 전체, 모바일 API, 프론트엔드 디버그 패널, DB 스키마

### 주요 변경사항
- **Step1 TOP3에서 LLM 완전 제거** — 순수 DB 규칙 기반 추천
- **Min-Max Normalization** — cost_of_living, internet_mbps 등 원시 값 정규화
- **Block B** — 저가 도시 과도한 cost_score 우대 완화
- **Block C dominance penalty** — `_BLOCK_C_PENALTY_SCALE_DEFAULT=0.20` 적용, 라이프스타일 미지정 시 저비용+고nomad 도시 억제
- **외부 안전 지표** — GPI 블렌딩으로 safety_score 정교화
- **모바일 API** — type-actions 614줄 신규, uploads, persona_type 표준화
- **rawdata** — AE(UAE), TW(대만) 비자 메타데이터 웹 검증 후 갱신

### 다음 세션 참고사항
- 타로카드 UX 재설계 (우리 팀 다음 작업)
- Block C penalty scale 값(0.20)이 최종 튜닝인지 아내팀 확인 필요
- 마이그레이션 002~005 프로덕션 DB 적용 여부 확인 필요

---

## [2026-04-05 KST] — 폼 카피 전면 수정 + 스텝 구조 5단계 확정

### 변경 파일
- `app/[locale]/onboarding/form/page.tsx` : 스텝 5단계 재배치 + 카피 전면 수정
- `backend/recommender.py` : children_ages 스코어링 반영
- `frontend/src/app/api/recommend/route.ts` : 백엔드 URL 환경변수화
- `frontend/src/app/api/detail/route.ts` : 백엔드 URL 환경변수화
- `frontend/.env.local` : NEXT_PUBLIC_API_URL=https://api-dev.nnai.app 추가

### 작업 요약
- 무엇을: 폼 스텝 4→5단계 재배치, 타이틀/라벨/버튼 카피 전면 수정, children_ages 스코어링 반영
- 왜: 스텝간 질문-라벨 층위 명확화, 소득-동행 순서 자연스럽게 재배치, 폼 톤 일관성 확보
- 영향 범위: 폼 전체 UX, 백엔드 Block D companion_score, API 프록시 URL

### 스텝 구조 확정
- Step 1: 목적 (immigration_purpose)
- Step 2: 체류 기간 + 체류 형태 (조건부)
- Step 3: 소득 + 세금 혜택 (조건부)
- Step 4: 동행 여부 + 조건부 필드
- Step 5: 선호 지역 + 선호 환경 (optional, 건너뛰기 가능)

### 카피 확정
- 스텝 타이틀 5개 확정
- 라벨 층위 정리 (불필요한 라벨 제거, 조건부 라벨 질문형 유지)
- CTA: "도시 추천 받기"
- 로딩: "당신에게 맞는 도시를 찾는 중이에요..."
- 에러: "뭔가 막혔어요. 다시 해볼까요?"
- 소득 비공개 안내: "비자 추천 정확도가 낮아질 수 있어요."

### children_ages 스코어링 반영
- 영아(0~2) → safety 가중치 강화 (0.8)
- 초등(7~12) → english_score 가중치 추가
- 중고등(13~18) → english_score + community_size 가중치 추가
- 중복 선택 시 가중치 합산 적용 (정규화)

### 기타
- API 프록시 route.ts 하드코딩 URL → NEXT_PUBLIC_API_URL 환경변수 참조로 변경
- develop 환경: api-dev.nnai.app / production 환경: api.nnai.app (fallback)

### 다음 세션 참고사항
- 타로카드 UX 재설계 (별도 세션)
- 스코어링 검증 이슈 2, 3 후속 논의 (치앙마이 1위 고정, 환율 변환 오차)
- Vercel develop 환경에 NEXT_PUBLIC_API_URL=https://api-dev.nnai.app 설정 확인 필요

---

## [2026-04-05 KST] — 폼 구조 개편 + 신규 인풋 추가

### 변경 파일
- `app/[locale]/onboarding/form/page.tsx` : 스텝 구조 개편, 신규 필드 추가
- `backend/recommender.py` : lifestyle 키 매핑 수정 (_LIFESTYLE_ALIASES v2 라벨 추가)

### 작업 요약
- 무엇을: 폼 4스텝 구조 개편, stay_style/tax_sensitivity 신규 인풋 추가, lifestyle 선택지 교체
- 왜: 백엔드 스코어링 로직 재설계 반영 + 유저 입력 실질 반영도 향상
- 영향 범위: 폼 전체 구조, 백엔드 lifestyle 키 매핑

### 주요 변경사항
- Step 1: 목적 + 동행 유형 (travel_type을 Step 3에서 이동)
- Step 2: 체류 기간 + 체류 형태 (stay_style 신규, 조건부)
- Step 3: 소득 + 세금 민감도 (tax_sensitivity 신규, 조건부) + 동행 조건부 필드
- Step 4: 선호 지역 + 라이프스타일 (모두 optional)
- lifestyle 선택지 8개 → 4개로 교체 (일하기 좋은 인프라/한인 커뮤니티/저물가/영어)
- lifestyle 키 매핑: 신규 라벨 → 기존 내부 키 매핑 추가, 레거시 라벨 하위 호환 유지
- stay_style, tax_sensitivity 모두 단기 체류(1~3개월) 시 숨김 처리
- canProceed: Step 4는 필수 없음 (optional only)

### 다음 세션 참고사항
- 폼 스텝 타이틀 카피 확정 필요
- 폼 라벨/버튼 카피 수정 필요
- INCOME_TYPE_OPTIONS 상수가 미사용 상태로 잔존 (제거 가능)

---

## [2026-04-05 KST] — 백엔드 스코어링 로직 전면 재설계

### 변경 파일
- `backend/recommender.py` : 스코어링 4-Block 구조 전면 재작성
- `backend/server.py` : RecommendRequest에 stay_style, tax_sensitivity 추가
- `backend/app.py` : nomad_advisor() 파라미터 + user_profile에 두 필드 추가
- `app/[locale]/onboarding/form/page.tsx` : stay_style, tax_sensitivity 인풋 추가

### 작업 요약
- 무엇을: 스코어링 로직 전면 재설계 — DB 고정값 60% 지배 구조 해체
- 왜: 유저 입력이 실제 결과에 반영되지 않는 구조적 문제 해결
- 영향 범위: 백엔드 추천 로직 전체, 폼 스텝 구조

### 주요 변경사항
- 실질 영향 필드: 2개(소득, 지역) → 8개 전체
- lifestyle 키 불일치 수정 (_LIFESTYLE_ALIASES 추가) — 항상 0점이던 문제 해결
- timeline 키 불일치 수정 (_TIMELINE_ALIASES 추가) — 체류기간 필터 정상화
- 4-Block 스코어링 도입
  - Block A 기본 적합도 30% (nomad/safety/coworking + lifestyle 배율)
  - Block B 재정 적합도 25% (cost_score + tax_bonus × tax_sensitivity)
  - Block C 페르소나 적합도 25% (5개 페르소나별 속성 가중치 차등)
  - Block D 실용 조건 적합도 20% (visa + english + companion × stay_style)
- 신규 인풋 2개 추가: stay_style(체류 형태), tax_sensitivity(세금 민감도)
- 대만(TW) 아시아 대륙 매핑 누락 수정
- 페르소나 키 프론트-백엔드 완전 일치 확인

### 다음 세션 참고사항
- 폼 스텝 구조 확정됨 (4스텝: 목적/라이프스타일/동행/예산)
- 폼 카피 수정 미완 (스텝 구조 확정되었으므로 다음 세션 진행 가능)
- 더 알아보기 → 타로카드 UX 재설계 (별도 세션)
- Jakarta city_scores.json 미등록 (우선순위 낮음, 추후 추가)

---

## [2026-04-05 KST] — 카피라이팅 전면 검토 + 폼 구조 논의

### 변경 파일
- `app/[locale]/page.tsx` : 랜딩 카피 + UI 수정 (지구본 위치, 카피 교체)
- `data/quiz-questions.ts` : 퀴즈 문항 3개 수정
- `app/[locale]/onboarding/form/page.tsx` : 페르소나별 캐릭터 GIF 이동 구현

### 작업 요약
- 무엇을: 랜딩 카피 전면 개편, 퀴즈 문항 수정, 폼 구조 및 백엔드 로직 문제 진단
- 왜: 서비스 포지셔닝 강화 + 추천 다양성 부재 문제 확인
- 영향 범위: 랜딩, 퀴즈, 폼 구조, 백엔드 스코어링 로직

### 랜딩 변경사항
- 헤드라인: "어떤 노마드가 될지, 같이 찾아볼게요." → "나는 어떤 노마드일까?"
- 서브카피: AI 키워드 제거, 줄바꿈 추가
- CTA 1: "내 노마드 유형 알아보기" → "내 유형 찾아보기"
- CTA 1 안내 문구 제거
- CTA 2 안내 문구: 경고성 → 긍정형 + opacity 처리
- 지구본(earth_web.gif) 헤드라인 위로 이동

### 퀴즈 변경사항
- 질문 3: "미라클 모닝. 일어나서 운동부터 해야지." → "일어나서 운동부터 해야지."
- 질문 4: "현지에서 당하는 인종차별." → "믿었던 친구의 배신."
- 질문 7: "안정" → "성공"

### 폼 변경사항
- 페르소나별 픽셀아트 캐릭터 GIF 스텝 이동 구현
  (wanderer/local/planner/free_spirit/pioneer, 스텝별 위치 이동)
- 페르소나 없이 직접 진입 시 earth_64.gif 기본값
- 캐릭터 에셋 8개 public/ 배포 (5 페르소나 + earth 3종)

### 주요 결정사항
- 라이프스타일 스텝 프론트에서 제거 확정 (백엔드 DB는 유지)
- 체류 기간 Step 1에서 분리 확정
- 백엔드 스코어링 로직 전면 재설계 필요 확정
  (현재 DB 고정값 60% 지배, 유저 입력 반영도 낮음)
- 폼 스텝 구조 재확정은 백엔드 재설계 이후로 이월

### 다음 세션 참고사항
- 백엔드 스코어링 로직 전면 재설계 (별도 세션)
  - 페르소나 포함 전체 유저 입력 가중치 반영
  - 추가 인풋 항목 설계 (언어 환경, 세금 민감도, 체류 형태)
- 폼 스텝 구조 재확정 (백엔드 재설계 이후)
- 폼 카피 수정 미완 (스텝 구조 확정 후 진행)

---

## [2026-04-04 21:30 KST] — 진입점 분리 + 로컬스토리지 전환 + Step2 롤백

### 변경 파일
- `app/[locale]/page.tsx` : 랜딩 페이지 전면 재작성 (진입점 2개 분리)
- `app/[locale]/onboarding/quiz/page.tsx` : sessionStorage → localStorage 전환
- `app/[locale]/onboarding/form/page.tsx` : sessionStorage → localStorage 전환 + "다시 하기" 링크 추가
- `app/[locale]/result/page.tsx` : Step 2 API 연결 시도 후 롤백 → alert 원복

### 작업 요약
- 무엇을: 랜딩 진입점 분리, 페르소나 저장 방식 전환, Step 2 API 롤백
- 왜: 퀴즈/직접진입 분기 UX 구현 + 재방문 시 페르소나 유지 + Step 2는 원래 기획(타로카드 UX)으로 재설계 필요 판단
- 영향 범위: 랜딩, 온보딩 퀴즈/폼, result 페이지

### 주요 결정사항
- 페르소나는 LLM 미연동 상태로 UX 경험 역할만 유지 (옵션 B 확정)
- LLM 재도입 시점 + 페르소나 백엔드 연동 방식은 별도 세션에서 논의
- 더 알아보기(Step 2)는 현재 구현 폐기. 타로카드 UX 기획으로 재설계 예정
- Google OAuth 연동은 로컬스토리지 브리지 완료 후 다음 우선순위

### 다음 세션 참고사항
- 더 알아보기 → 타로카드 UX 재설계 (별도 세션)
- LLM 재도입 시점 논의 (별도 세션)
- Google OAuth 프론트엔드 연동
- 페르소나 결과 공유 기능

---

## [2026-04-04 20:10 KST] — result 페이지 전면 재설계

### 변경 파일
- `backend/recommender.py` : city_scores.json + visa_db.json 필드 top_cities에 병합
- `backend/data/city_descriptions.json` : 50개 도시 한국어 소개 텍스트 생성
- `app/[locale]/result/page.tsx` : result 페이지 카드 구조 전면 재설계

### 작업 요약
- 무엇을: result 페이지 정보 레이어 + 서술 레이어 분리 재설계
- 왜: 팩트 나열에서 "노마드 선배의 조언" 구조로 전환, 신뢰+영감 동시 제공
- 영향 범위: result 페이지 전체, 백엔드 API 응답 구조

### 주요 변경사항
- 추천 점수(score) 제거
- 백엔드 city_scores/visa_db 필드 API 응답에 병합
  (internet_mbps, safety_score, english_score, stay_months, renewable 등)
- 50개 도시 소개 텍스트 city_descriptions.json으로 관리
- 카드 구조: 인사이트 → 정보 블록 → 서술 블록(도시소개+조언) → 링크
- 한화 환산 예산 표시 (약 {n}만원)
- 소득 대비 생활비 비율 조언 (소득의 약 n%)
- 인사이트/조언 중복 방지 로직
- 더 알아보기 → 버튼 추가 (Step 2 API 연결 미착수)
- 데이터 출처 표시 (Numbeo, NomadList)

### 다음 세션 참고사항
- 더 알아보기 → Step 2 API(/api/detail) 연결 미착수
- 페르소나 결과 공유 기능 미구현
- Google OAuth 프론트엔드 연동 미착수

---

## [2026-04-04 00:10 KST] — 폼 UX 전면 재설계

### 변경 파일
- `app/[locale]/onboarding/form/page.tsx` : 폼 6스텝 → 4스텝 재설계 전면 교체

### 작업 요약
- 무엇을: 폼 스텝 구조 재설계 + 불필요 필드 제거 + 소득 구간 버튼화
- 왜: 백엔드 API 스펙 분석 결과 실질 영향 없는 필드 정리, 월 소득 타이핑 제거
- 영향 범위: 온보딩 폼 전체 UX, API 전송 데이터 구조

### 주요 변경사항
- Step 1 "기본 정보" 제거 (nationality/languages/dual_nationality 고정값 처리)
- readiness_stage, income_type 제거
- 월 소득 숫자 입력 → 6개 구간 버튼 2×3 그리드로 교체
- 비공개 선택 시 추천 제한 안내 문구 노출
- 동행 조건 조건부 필드 추가 (children_ages, has_spouse_income, spouse_income_krw)
- 텍스트 전면 수정 (노마드 톤으로 통일)
- 퀴즈 버튼과 동일한 레이아웃/스타일 적용

### 다음 세션 참고사항
- 전체 플로우 end-to-end 테스트 필요 (폼 → API → result 페이지)
- result 페이지 UX 디테일 검토 필요
- 페르소나 결과 공유 기능 미구현
- Google OAuth 프론트엔드 연동 미착수

---

## [2026-04-03 23:00 KST] — 디자인 시스템 Amber Mono 2.0 전환 + 퀴즈/결과 페이지 디테일

### 변경 파일
- `app/globals.css` : Amber Mono 2.0 CSS 변수 전면 교체, accent hover primary hue 조정
- `app/layout.tsx` : Geist Mono(영문) + Noto Serif KR(한글) 폰트 조합 적용
- `components/onboarding/quiz-card.tsx` : hover/on-click 버튼 상태 정의
- `components/onboarding/persona-result-card.tsx` : 카드 border-l-4 accent line, 서브텍스트 수정

### 작업 요약
- 무엇을: MX-Brutalist → Amber Mono 2.0 컬러 시스템 전환 + 폰트 조합 확정
- 왜: 한글 폰트 호환성 + 아날로그 메모장 감성 + 브루탈리스트 무게감 조정
- 영향 범위: 프론트엔드 전체 스타일링

### 다음 세션 참고사항
- 다음 작업: /onboarding/form → 백엔드 API 연결
- 퀴즈 선택지 버튼 hover(accent)/on-click(primary) 상태 확정됨
- 결과 페이지 카드 border-l-4 primary accent line 적용됨

---

## [2026-04-03 KST] — UI 리디자인 + API 연결 완료

### 변경 파일
- `app/[locale]/layout.tsx` : 폰트 Noto Serif KR 단일 폰트로 교체
- `app/globals.css` : 세계之外 테마 토큰 전면 교체, dark 강제 해제
- `app/[locale]/onboarding/quiz/page.tsx` : 이전 버튼 추가, 레이아웃 수정, max-w-sm
- `app/[locale]/onboarding/result/page.tsx` : 결과 카드 위계 재설계, 카드 순서 변경 (도시→일→순간→가치)
- `components/onboarding/persona-result-card.tsx` : description/city/work/value/moment string→string[] 배열 구조로 변경
- `data/personas.ts` : 전체 필드 string[] 배열 구조로 변환
- `app/api/recommend/route.ts` : Next.js API Route 프록시 신규 생성
- `app/[locale]/onboarding/form/page.tsx` : API 호출 연결, 로딩/에러 처리
- `app/[locale]/result/page.tsx` : 도시 카드 3개 + 비교표 구현, 마크다운 제거

### 작업 요약
- 무엇을: 테마 라이트 모드 전환 + Noto Serif KR 폰트 확정 + 퀴즈/결과 UX 개선 + 백엔드 API 연결
- 왜: 다크 테마 감성 미달, 한글 폰트 미지원, API 연결 CORS 문제 해결
- 영향 범위: 프론트엔드 전체 + 백엔드 API 연결

### 다음 세션 참고사항
- 퀴즈 페이지 수직 정렬 마무리 필요
- 폼 페이지 UX 디테일 미완
- 페르소나 결과 공유 기능 미구현
- Google OAuth 프론트엔드 연동 미착수
- 테마 재선정 보류 (Noto Serif KR 확정, 컬러는 추후 판단)
- 로컬 테스트는 production 빌드 권장 (dev 서버 hydration 이슈)

---

## [2026-04-03 KST] — 디자인 시스템 전면 교체 + 퀴즈/결과 페이지 리디자인

### 변경 파일
- `app/layout.tsx` : 폰트 Instrument_Serif 단일 교체, dark 클래스 제거
- `app/globals.css` : CSS 변수 전면 교체 (oklch 색상, shadow, tracking)
- `app/[locale]/onboarding/quiz/page.tsx` : 레이아웃 리디자인 (max-w-sm, 수직 중앙, 이전 버튼)
- `app/[locale]/onboarding/quiz/result/page.tsx` : 처음부터 다시하기 버튼, i18n 제거, 스타일 통일
- `components/onboarding/quiz-card.tsx` : 선택지 스타일 통일 (text-foreground, font-medium)
- `components/onboarding/persona-result-card.tsx` : 결과 카드 sm:grid-cols-2, 디자인 변수 교체
- `components/onboarding/progress-bar.tsx` : 디자인 변수 교체
- `data/quiz-questions.ts` : 퀴즈 텍스트 수정 (줄바꿈, 문구 변경)

### 작업 요약
- 무엇을: shadcn 테마 기반 디자인 시스템 전면 교체 + 퀴즈/결과 페이지 레이아웃 리디자인
- 왜: v21 테마 적용 + 모바일 중심 UX 개선 + Instrument Serif 폰트 통일
- 영향 범위: 프론트엔드 전체 스타일링, 온보딩 퀴즈/결과 페이지

### 다음 세션 참고사항
- 다음 작업: /onboarding/form → 백엔드 API 연결
- 페르소나 결과 공유 기능 미구현 (자리만 잡혀 있음)
- 로컬 테스트는 production 빌드로 해야 함 (dev 서버는 네트워크 접속 시 hydration 실패)
- 기존 온보딩 CSS 변수(--onboarding-*) 완전 삭제됨, 참조하는 곳 없는지 확인 필요

---

## [2026-04-03 KST] — Framer Motion 인터랙션 추가 (퀴즈 전환 + 결과 등장)

### 변경 파일
- `app/[locale]/onboarding/quiz/page.tsx` : AnimatePresence + motion.div 퀴즈 카드 페이드 전환
- `components/onboarding/persona-result-card.tsx` : 타이틀 + 4개 축 카드 stagger 등장 애니메이션

### 작업 요약
- 무엇을: 퀴즈 문항 전환 페이드 (아웃 0.25s / 인 0.35s) + 결과 카드 순차 등장 (0.3s 간격 stagger, fadeUp)
- 왜: 온보딩 UX 인터랙션 완성
- 영향 범위: 퀴즈 페이지, 결과 페이지

### 다음 세션 참고사항
- 다음 작업: /onboarding/form → 백엔드 API 연결
- 페르소나 결과 공유 기능 미구현 (자리만 잡혀 있음)
- 로컬 테스트는 production 빌드로 해야 함 (dev 서버는 네트워크 접속 시 hydration 실패)

---

## [2026-04-03 KST] — 페르소나 결과 페이지 콘텐츠 + 퀴즈 데이터 업데이트

### 변경 파일
- `data/personas.ts` : 페르소나 5종 전체 콘텐츠 업데이트 (description, city, work, value, moment)
- `data/quiz-questions.ts` : 퀴즈 7문항 재설계 + 페르소나 매핑 순서 섞기 적용
- `components/onboarding/persona-result-card.tsx` : traits 3개 → 4개 축 구조로 변경

### 작업 요약
- 무엇을: 페르소나별 4개 축 콘텐츠 확정 및 결과 페이지 구조 변경
- 왜: UX 논의에서 확정된 "도시/일/가치/순간" 4축 구조 반영
- 영향 범위: 퀴즈 결과 페이지 전체 경험

### 다음 세션 참고사항
- 다음 작업: Framer Motion 인터랙션 (퀴즈 슬라이드, 결과 등장)
- 다음 작업: /onboarding/form → 백엔드 API 연결
- 페르소나 결과 공유 기능 미구현 (자리만 잡혀 있음)

---

## [2026-03-30 KST] — 온보딩 플로우 골격 + 스타일링 구현

### 변경 파일
- `frontend/src/app/layout.tsx` : Playfair Display, 다크 테마, 메타데이터
- `frontend/src/app/globals.css` : 온보딩 CSS 변수 12개 추가
- `frontend/src/data/personas.ts` : 페르소나 5종 상수
- `frontend/src/data/quiz-questions.ts` : 퀴즈 7문항 + calculatePersona()
- `frontend/src/data/form-options.ts` : 폼 선택지 10종
- `frontend/src/components/onboarding/*` : 5개 컴포넌트 생성
- `frontend/src/app/onboarding/**` : 퀴즈/결과/폼 페이지
- `frontend/src/app/result/**` : placeholder 페이지

### 작업 요약
- 무엇을: 투트랙 온보딩 플로우 전체 골격 및 스타일링 구현
- 왜: UX 논의에서 확정된 페르소나 진단 → 정밀 분석 구조 반영
- 영향 범위: 프론트엔드 전체 온보딩 경험

### 다음 세션 참고사항
- persona-result-card traits 텍스트 색상은 primary로 변경 완료
- 다음 작업: Framer Motion 인터랙션
- 다음 작업: /onboarding/form → 백엔드 API 연결

---

## [2026-03-30 KST] — 서비스 포지셔닝 확정

### 작업 요약
- 무엇을: 핵심 포지셔닝 및 UX 설계 필터 정의
- 왜: 온보딩 플로우 논의 중 MBTI/자아탐색 인사이트에서 도출
- 영향 범위: 전체 UX 설계 기준, 향후 기능 추가 판단 기준

### 다음 세션 참고사항
- 모든 기능 설계 시 "유저의 나 서사를 강화하는가?" 필터 적용
- 페르소나 결과 공유 기능은 자연 유입 경로로 우선 구현 대상

---

## [2026-03-30 KST] — 세션 문서 관리 체계 초기 설정

### 변경 파일
- `.claude/session/CONTEXT.md` : 프로젝트 현황 문서 최초 생성
- `.claude/session/CHANGELOG.md` : 작업 이력 로그 최초 생성
- `CLAUDE.md` : 세션 문서 관리 지시문 추가

### 작업 요약
- 무엇을: .claude/session/ 디렉토리에 CONTEXT.md, CHANGELOG.md 초기 생성 및 CLAUDE.md에 관리 규칙 추가
- 왜: 세션 간 컨텍스트 유지 및 작업 이력 추적을 위한 체계 수립
- 영향 범위: 모든 후속 세션의 작업 완료 프로세스

### 다음 세션 참고사항
- 작업 완료 시 반드시 Step 1~4 (CHANGELOG → CONTEXT → scp → git push) 순서 준수
- myserver SSH alias 정상 작동 확인 필요

---
