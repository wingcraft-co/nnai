# PostHog Consent-Based Analytics Design

## Goal

NNAI 프론트엔드의 PostHog 수집 방식을 `cookieless 최소 추적` 중심에서 `동의 기반 2단계 분석` 구조로 재설계한다. `develop/preview`에서 먼저 실험하고, 나중에 `main/production`으로 옮길 수 있어야 한다.

## Product Decision

- 쿠키 배너는 한국어로 제공한다.
- 버튼 문구는 아래로 고정한다.
  - `필수 분석만 허용`
  - `전체 허용`
  - `자세히 보기`
- `필수 분석만 허용`은 익명 최소 수집을 의미한다.
- `전체 허용`은 쿠키 기반 추적, autocapture, session replay까지 포함한다.
- `자세히 보기`는 개인정보처리방침 또는 쿠키 설명으로 연결한다.
- `develop/preview`에서 먼저 full tracking을 검증한다.
- `main/production`은 별도 판단 전까지 full tracking을 바로 켜지 않는다.

## Consent Model

### 1. Essential analytics only

- 사용자가 `필수 분석만 허용`을 선택하면 cookieless 기반 최소 추적을 허용한다.
- 이 모드에서는 persistent cookie 기반 식별을 만들지 않는다.
- 목적은 방문자 수, 라우트 흐름, 추천/로그인/결제 퍼널 파악이다.

수집 범위:
- `page_view`
- landing CTA 클릭
- 추천 제출/성공/실패
- 로그인 진입/클릭/성공
- pricing 진입
- checkout 클릭/복귀

금지:
- session replay
- autocapture
- exact income/budget
- 자유 입력 텍스트
- 이메일, 이름, OAuth 식별자

### 2. Allow all tracking

- 사용자가 `전체 허용`을 선택하면 cookie 기반 persistent tracking을 활성화한다.
- 이 모드에서는 autocapture와 session replay를 켠다.
- 목적은 UX 마찰 분석, 이탈 원인 파악, replay 기반 디버깅이다.

추가 수집 범위:
- autocapture
- session replay
- onboarding step dwell
- form abandon
- result card interaction
- guide CTA interaction
- pricing section engagement

## UX Design

### Consent banner

- 첫 방문 시 하단 배너로 노출한다.
- 사용자가 응답하기 전까지 선택 상태는 `unknown`이다.
- 선택 결과는 브라우저 저장소에 저장한다.
- 이후 footer 또는 privacy 페이지에서 설정을 다시 열 수 있어야 한다.

### Learn more

- `자세히 보기`는 개인정보처리방침에서 아래 내용을 설명해야 한다.
  - Essential mode와 full mode의 차이
  - 익명 최소 수집 항목
  - 전체 허용 시 replay/autocapture가 포함된다는 점
  - 언제든 동의를 변경할 수 있다는 점

## Technical Design

### Analytics mode split

- `NEXT_PUBLIC_POSTHOG_MODE=minimal|full` 같은 모드 플래그를 둔다.
- consent 상태와 배포 환경을 함께 보고 실제 모드를 결정한다.
- preview에서는 full mode 검증이 가능해야 한다.
- production에서는 full mode를 막거나 별도 플래그로 제어한다.

### Wizard usage

- `npx -y @posthog/wizard@latest --region eu`로 기본 PostHog 연결을 확인한다.
- wizard가 생성한 기본 코드는 그대로 신뢰하지 않고, 아래 규칙으로 덮어쓴다.
  - consent 전에는 capture 차단
  - essential consent면 cookieless 최소 추적
  - full consent면 cookie 기반 추적 + replay/autocapture

### Existing event layer

- 현재 `frontend/src/lib/analytics/posthog.ts`
- 현재 `frontend/src/lib/analytics/events.ts`
- 현재 `frontend/src/components/analytics/*`

이 구조는 유지하되, consent 상태와 모드 전환을 수용하도록 재구성한다.

## Privacy / Legal Design

- `docs/privacy.html`을 현재 cookieless-only 문구에서 2단계 consent 문구로 바꾼다.
- `필수 분석만 허용`이 실제로 익명 최소 수집이라는 점을 명시한다.
- `전체 허용`은 쿠키 기반 추적과 session replay를 포함한다는 점을 명시한다.
- 동의 철회/재설정 방법을 명시한다.

## Risks

- full mode를 preview에서 검증하더라도 production 반영 전에는 법무 검토가 필요하다.
- session replay는 민감 UI 구간 마스킹/차단이 필요할 수 있다.
- wizard 기본 설정을 그대로 수용하면 현재 설계와 충돌할 수 있으므로 wrapper 계층이 필요하다.

## Verification

- consent 미선택 상태에서 PostHog 요청이 차단되는지 확인
- `필수 분석만 허용` 선택 시 essential 이벤트만 들어오는지 확인
- `전체 허용` 선택 시 cookie 기반 추적과 replay/autocapture가 활성화되는지 확인
- 동의 변경 후 모드가 즉시 반영되는지 확인
- privacy 문서 문구와 실제 동작이 일치하는지 확인
