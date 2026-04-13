# TODOS.md — NomadNavigator AI

> CEO Review (2026-04-14) 기반. 상세 내용: `cowork/ceo/ceo-review-2026-04-14.md`

---

## NOW (즉시 구현)

### #1 공유 카드 — 바이럴 엔진
- **What:** 타로 결과를 카카오톡/인스타 스토리로 공유할 수 있는 OG 이미지 생성
- **Why:** MAU 0인 현재, 유기적 성장을 만드는 가장 빠른 레버. 사용자가 "나의 노마드 타로 결과: 리스본/치앙마이/트빌리시" 같은 카드를 공유하면 바이럴 루프 시작
- **Where:** Frontend `@vercel/og` Edge Function
- **Effort:** S (human: 1일) → S (CC: ~30분)
- **Priority:** P1
- **Definition of Done:** `/api/og?cities=LIS,CNX,TBS&persona=wanderer` → OG 이미지 PNG 생성. CDN 캐시 `max-age=86400`. 카카오톡/인스타 미리보기 검증
- **Depends on:** 프론트엔드 핵심 플로우(결과 페이지) 완성

### #2 비교 모드 — TOP 3 테이블 뷰
- **What:** 추천 도시 TOP 3를 나란히 놓고 비용/비자/인터넷/안전/노마드 점수를 비교하는 테이블
- **Why:** 사용자의 의사결정을 직접 도와주는 핵심 기능. city_scores.json에 데이터가 이미 전부 있어서 프론트엔드만 추가
- **Where:** Frontend only (결과 페이지에 "비교" 탭)
- **Effort:** S (human: 1일) → S (CC: ~20분)
- **Priority:** P1
- **Definition of Done:** 6개 컬럼 (도시명, 월비용, 비자유형, 인터넷, 안전점수, 노마드점수). 모바일: 가로 스크롤 + 첫 컬럼 고정. 도시 1개만일 때 안내 메시지
- **Depends on:** 프론트엔드 핵심 플로우(결과 페이지) 완성

---

## AFTER MAU (MAU 확보 후 재검토)

### #3 "나와 비슷한 노마드" 위젯
- **What:** 같은 페르소나의 다른 사용자가 어떤 도시를 저장(핀)했는지 보여주는 위젯
- **Why:** 사회적 증거(social proof)로 의사결정 도움. `/api/pins/community` 엔드포인트 이미 존재
- **Where:** Frontend + `/api/pins/community` (persona_type 필터 추가)
- **Effort:** S (human: 1일) → S (CC: ~30분)
- **Priority:** P2
- **Risks:** MAU 0이면 빈 위젯. 시드 데이터는 합성 community proof 신뢰 리스크 (Codex #7). persona_type 핀 저장 스키마 검증 필요
- **Depends on:** MAU 확보 (최소 100명), pins 테이블에 persona_type 컬럼 존재 확인

### #4 비용 슬라이더 — 인터랙티브 필터
- **What:** 예산을 조절하면 실시간으로 도시 목록이 변하는 슬라이더 UI
- **Why:** 데모에서 임팩트 큰 인터랙션. 사용자가 예산을 입력하기 전에 탐색 가능
- **Where:** Frontend only (city_scores.json 클라이언트사이드 필터링)
- **Effort:** S (human: 1일) → S (CC: ~30분)
- **Priority:** P2
- **Risks:** 정적 데이터(city_scores.json)와 LLM 추천(Gemini)이 충돌 가능. 슬라이더에서 $1000 이하로 필터링했는데 AI가 $1500 도시를 추천하면 신뢰 상실 (Codex #4)
- **구현 시 주의:** recommender.py 필터링 로직과 프론트엔드 필터링이 같은 기준을 사용하도록 통일. 또는 AI 프롬프트에 사용자 예산 제약을 강제
- **Depends on:** MAU 확보, 정적/동적 데이터 통일 방안 결정

### #5 계절 필터 + "지금 떠나면" 모드
- **What:** 현재 계절 기반으로 "지금 당장 떠나면 어디가 좋을까?" 추천
- **Why:** 시의성 높은 기능. 계절에 따라 추천이 달라지면 반복 방문 유도
- **Where:** Backend `recommender.py` + Frontend
- **Effort:** M (human: 3일) → S (CC: ~1시간)
- **Priority:** P2
- **Prerequisites:** `city_scores.json`의 `climate` 필드 존재 여부 확인. 없으면 `rawdata/city_scores.csv`에 climate 컬럼 추가 → `sync_nomaddb_csv_to_json.py` 실행 → `frontend/src/data/city_scores.json` 갱신
- **Depends on:** MAU 확보, climate 데이터 마이그레이션

### #6 이메일 다이제스트
- **What:** 선택한 도시의 주간 환율/비자 뉴스 요약을 이메일로 발송
- **Why:** 일회성 방문자 → 반복 방문자 전환하는 리텐션 레버
- **Where:** Backend: Resend API + GitHub Actions schedule
- **Effort:** M (human: 5일) → M (CC: ~1-2시간)
- **Priority:** P3
- **Risks:** 법적 준수 스코프 과소평가 (Codex #10). 수신거부 링크, 동의 타임스탬프, 반송 처리, SPF/DKIM/DMARC 설정 필요. GitHub Actions 스케줄러는 재시도/관찰 약함 (Codex #11)
- **구현 시 주의:** users 테이블에 `email_digest_opt_in BOOLEAN DEFAULT FALSE` + `email_consent_at TIMESTAMP` 컬럼 추가. digest 관련 엔드포인트는 internal-only API key 인증 필수. DB 접근은 API 엔드포인트(`GET /api/digest/subscribers`, `POST /api/digest/send`) 경유
- **Depends on:** MAU 확보 (최소 50명), Resend 계정 설정, 도메인 SPF/DKIM

### #7 시뮬레이터 모드
- **What:** "리스본에서 6개월 살면" 시나리오 시뮬레이션 대시보드. 총 비용, 비자 타임라인, 세금 영향
- **Why:** 사용자가 구체적인 체류 계획을 세울 수 있게 돕는 도구
- **Where:** Frontend 신규 페이지 `/[locale]/simulate` + Backend `GET /api/currency`
- **Effort:** M (human: 5일) → M (CC: ~1-2시간)
- **Priority:** P3
- **Risks:** Step 2 상세 가이드와 데이터 중복 (Codex #12). 시뮬레이터의 고유 가치를 명확히 정의해야 함. `/api/currency`는 외부 API 의존 (실패 시 fallback 1,400 KRW/USD)
- **차별화 방향:** Step 2는 "이 도시로 이주하려면?" (정적 가이드), 시뮬레이터는 "이 도시에서 N개월 살면 얼마?" (기간 변수에 따른 동적 계산 + 비교 시나리오)
- **Depends on:** MAU 확보, Step 2 상세 가이드 완성

---

## VISION (장기, 별도 아키텍처 필요)

### 비자 D-day 카운트다운 대시보드
- 사용자별 비자 만료일 추적, 쉥겐 90일 실시간 계산
- 별도 사용자 상태 관리 + push notification 인프라 필요

### 보험/코워킹 직접 예약 연동
- SafetyWing, Airalo 등 파트너 API 직접 연동
- 파트너 계약 + API 통합 필요

### 데이터 플라이휠 / ML 추천
- 사용자 선택 데이터 → 추천 알고리즘 개선
- 현재 Gemini API 아키텍처와 근본적으로 다른 파이프라인 필요

### 커뮤니티 채팅/모임 기능
- 같은 도시 한국인 노마드 연결
- 실시간 채팅 인프라 (WebSocket) + 모더레이션 필요
