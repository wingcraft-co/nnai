NNAI용 PostHog 최소 추적 설계서 v1

목표는 배너 없이 가능한 최소 추적으로도 DAU/WAU/MAU, 방문자 추세, 추천 퍼널, 결제 전환, 광고주 소개용 집계 데이터를 확보하는 것입니다.

핵심 결정

PostHog Cloud EU 사용
웹 SDK는 cookieless_mode: "always" 사용
identify() 사용 금지
autocapture: false
disable_session_recording: true
capture_pageview: false
페이지뷰는 앱에서 수동 전송
PostHog 프로젝트에서 IP capture disabled
개인정보처리방침에 PostHog 사용과 수집 항목 추가
다른 광고/분석 태그는 이번 작업에 추가하지 않음
왜 이 구조인가

page_view와 핵심 이벤트만으로도 일일 방문자, 총 방문자, DAU/WAU/MAU, 주요 퍼널 분석이 가능함
쿠키/로컬스토리지 기반 식별을 피해서 법적·운영 복잡도를 낮춤
나중에 필요하면 cookieless_mode: "on_reject" + 동의 배너 + identify()로 확장 가능함
수집 금지 항목

이메일, 이름, OAuth 식별자
자유입력 텍스트
정확한 소득값, 예산값
URL query string 전체
추천 결과의 원문 마크다운
세션 리플레이, heatmap, autocapture 데이터
허용 이벤트

page_view
props: page_key, pathname, locale
landing_cta_click
props: cta = quiz|form|preview
quiz_start
props: entry_page
quiz_complete
props: persona_type
form_step_view
props: step_number, step_key
form_step_complete
props: step_number, step_key
recommend_submit
props: entry = quiz|direct, has_persona
recommend_success
props: card_count, has_persona
recommend_failure
props: stage = recommend|reveal, error_kind
result_reveal_complete
props: selected_count
guide_click
props: city_id
login_view
props: locale
login_click
props: provider = google
login_success
props: provider = google
pay_view
props: locale
checkout_click
props: provider = polar
checkout_success
props: provider = polar
분석 기준 이벤트

방문자/DAU/WAU/MAU 기준: page_view
제품 활성화 기준: recommend_success
핵심 전환 기준: checkout_success
이벤트 속성 원칙

속성은 enum, boolean, small integer만 허용
before_send에서 query/hash 제거
pathname은 정규화된 경로만 전송
폼 응답은 상세값 대신 coarse bucket만 검토 가능하지만 v1에서는 제외
구현 파일 구조

새 파일: frontend/src/lib/analytics/posthog.ts
새 파일: frontend/src/lib/analytics/events.ts
새 파일: frontend/src/components/analytics/PostHogProvider.tsx
새 파일: frontend/src/components/analytics/PageViewTracker.tsx
수정: frontend/src/app/layout.tsx
수정: frontend/src/app/[locale]/layout.tsx
수정: frontend/src/app/[locale]/page.tsx
수정: frontend/src/app/[locale]/onboarding/form/page.tsx
수정: frontend/src/app/[locale]/result/page.tsx
수정: frontend/src/app/[locale]/login/page.tsx
수정: frontend/src/app/[locale]/pay/page.tsx
수정: 로그인/결제 버튼이 실제 있는 컴포넌트
수정: docs/privacy.html 또는 현재 privacy 원문 소스
환경변수

NEXT_PUBLIC_POSTHOG_KEY
NEXT_PUBLIC_POSTHOG_HOST
값 기본 추천: https://eu.i.posthog.com
NEXT_PUBLIC_POSTHOG_UI_HOST
값 기본 추천: https://eu.posthog.com
NEXT_PUBLIC_POSTHOG_ENABLED
로컬 개발 기본값은 0 권장
초기 대시보드

Traffic Overview: unique visitors, pageviews, top pages, countries, referrers
Growth: DAU, WAU, MAU, stickiness
Activation Funnel: page_view(home) → recommend_submit → recommend_success → result_reveal_complete
Revenue Funnel: pay_view → checkout_click → checkout_success
Interest Dashboard: guide_click by city_id
검증 기준

PostHog 관련 쿠키/로컬스토리지 키가 생성되지 않아야 함
각 라우트 이동마다 page_view가 1회만 찍혀야 함
recommend_success와 checkout_click이 live events에서 보여야 함
이벤트에 이메일, 이름, query string, exact income가 없어야 함
PostHog 비활성 환경에서는 앱 동작이 깨지지 않아야 함
v2 확장 경로

법무 검토 후 필요시 cookieless_mode: "on_reject" + 동의 배너
로그인 유저 동의 후 identify()
광고 성과 측정용 캠페인 attribution 강화
서버사이드 결제 성공 이벤트 연동
Codex CLI용 작업 지시문

NNAI frontend에 PostHog 최소 추적을 도입하라.

목표:
- PostHog Cloud EU 기반
- cookieless_mode: "always"
- identify 사용 금지
- autocapture false
- session recording false
- 수동 page_view + 수동 핵심 이벤트만 수집
- DAU/WAU/MAU, 방문자수, 추천 퍼널, 결제 퍼널 분석 가능해야 함
- 개인정보처리방침에 분석 도구 사용 추가

구현 요구사항:
- posthog-js 설치
- analytics 초기화 래퍼 작성
- page_view는 route change 기준으로 수동 전송
- 다음 이벤트 구현:
  page_view, landing_cta_click, quiz_start, quiz_complete, form_step_view,
  form_step_complete, recommend_submit, recommend_success, recommend_failure,
  result_reveal_complete, guide_click, login_view, login_click, login_success,
  pay_view, checkout_click, checkout_success
- 이벤트에는 PII 전송 금지
- exact income/budget/free text/query string 전송 금지
- NEXT_PUBLIC_POSTHOG_ENABLED=0일 때 no-op 동작
- docs/privacy.html 업데이트
- 변경 후 npm build 또는 가능한 검증 수행

파일 후보:
- frontend/src/lib/analytics/posthog.ts
- frontend/src/lib/analytics/events.ts
- frontend/src/components/analytics/PostHogProvider.tsx
- frontend/src/components/analytics/PageViewTracker.tsx
- frontend/src/app/layout.tsx
- frontend/src/app/[locale]/layout.tsx
- frontend/src/app/[locale]/page.tsx
- frontend/src/app/[locale]/onboarding/form/page.tsx
- frontend/src/app/[locale]/result/page.tsx
- frontend/src/app/[locale]/login/page.tsx
- frontend/src/app/[locale]/pay/page.tsx
- privacy 문서 원본

완료 조건:
- 쿠키/로컬스토리지 기반 식별 없음
- page_view와 recommend_success가 PostHog에서 확인 가능
- build가 통과하거나 실패 원인이 명확히 보고됨
참고:

PostHog data collection: posthog.com/docs/privacy/data-collection
PostHog JS config: posthog.com/docs/libraries/js/config
PostHog GDPR guide: posthog.com/docs/privacy/gdpr-compliance
