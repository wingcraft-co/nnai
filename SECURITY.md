# SECURITY.md

> 최종 업데이트: 2026-04-16
> 상태: 운영 기준 초안. 실제 프로덕션 오픈 전 보안 점검과 법률 검토를 다시 수행한다.

## 목적

이 문서는 NomadNavigator AI (NNAI)가 고객 정보를 보호하기 위해 현재 적용 중인 보안 통제와,
프로덕션 결제 오픈 전 추가로 적용할 보안 하드닝 계획을 기록한다.

이 문서는 "우리가 보안을 중요하게 다룬다"는 선언문이 아니라, 어떤 정보를 저장하고 어떤 정보는 저장하지 않으며,
어떤 통제가 이미 적용되어 있고 무엇이 아직 남아 있는지를 명확히 남기는 운영 문서다.

## 보안 원칙

1. 가장 좋은 보안은 민감정보를 저장하지 않는 것이다.
2. 결제정보는 가능한 한 결제 플랫폼(Polar)에만 남기고, 앱 DB에는 entitlement 판단에 필요한 최소 정보만 저장한다.
3. 고객 PII는 평문 저장을 최소화하고, 필요한 경우 앱 레벨 암호화를 적용한다.
4. 로그에는 토큰, 쿠키, 카드정보, 전체 provider payload, 고객 이메일 원문을 남기지 않는다.
5. 유료 고객은 결제 동기화 지연 때문에 바로 차단하지 않는다. 결제 상태 불일치 시 grace, restore, 수동 복구 절차를 우선한다.
6. "유출 위험 0%"는 약속할 수 없다. 대신 저장 최소화, 평문 제거, 키 분리, blast radius 축소를 목표로 한다.

## 현재 적용 중인 보안 통제

2026-04-16 기준 코드베이스에서 확인된 항목:

- Google OAuth 2.0 로그인 사용
- 서버 서명 opaque session 쿠키 사용
- `HttpOnly`, `Secure`, `SameSite` 쿠키 정책 적용
- OAuth `state` 검증 적용
- `return_to` allowlist 검증으로 open redirect 차단
- `SECRET_KEY` 미설정 시 서버 시작 실패
- `auth_sessions` 테이블 기반 세션 revoke/만료 관리
- 웹/모바일 OAuth 로그인 시 encrypted PII copy(`email_enc`, `name_enc`) 저장
- 신규 OAuth 로그인부터 raw `users.email`, `users.name` 저장 중단, 조회는 encrypted copy 복호화 경로 사용
- 앱 시작 시 남아 있는 레거시 plain `users.email`/`users.name`을 encrypted copy로 백필하고 raw 컬럼을 비움
- Polar webhook은 Standard Webhooks 서명 검증 후 처리하고 `(provider, event_id)` 기준으로 멱등 처리
- Polar checkout 생성은 `external_customer_id=user_id`로 연결하고 앱 DB에는 provider id / entitlement 상태만 저장
- `POST /api/recommend`, `POST /api/detail`에 entitlement-aware rate limit 적용
- `billing_entitlements`, `billing_usage_ledger`, `billing_provider_events` 테이블 존재
- 보안 이벤트 로깅 (`rate_limit_exceeded`, `oauth_state_mismatch`, `session_bad_signature` 등) 적용
- SQL query parameterization 사용

## 프로덕션 결제 오픈 전 추가할 하드닝

아래 항목은 "적용 예정"이며, 완료되기 전까지 이미 완료된 것으로 문서화하지 않는다.

### 1. 고객 PII 평문 의존 축소

적용 목표:

- 남아 있는 기타 PII 평문 의존 경로를 단계적으로 제거
- 조회/검색이 꼭 필요한 경우 hash 또는 복호화 helper를 통해 접근
- 암호화 키는 환경변수/secret로 분리하고 git에 저장하지 않음

### 2. 결제 Reconciliation / Restore 강화

적용 목표:

- Polar customer state 조회 기반 `restore purchase` 경로 추가
- webhook 지연/유실 시 checkout session 기준 재동기화
- 결제 완료 후 entitlement 동기화 실패 시 `restore purchase` 경로 제공

### 3. 로그 Redaction

적용 목표:

- 이메일 원문 대신 redacted identifier 사용
- provider payload 전체 로깅 금지
- access token, session token, webhook secret, checkout secret 로깅 금지

### 4. Secrets 관리 강화

운영 시 필수 secret 예시:

- `SECRET_KEY`
- `APP_PII_ENCRYPTION_KEY`
- `POLAR_ACCESS_TOKEN`
- `POLAR_WEBHOOK_SECRET`
- `DATABASE_URL`
- OAuth client secrets

원칙:

- 모든 secret은 환경변수 또는 배포 플랫폼 secret store에만 저장
- `.env`는 로컬 개발용으로만 사용
- secret rotation이 가능한 구조 유지

## 결제 및 고객 데이터 저장 원칙

NNAI는 다음 데이터를 앱 DB에 저장하지 않는 것을 원칙으로 한다.

- 카드번호
- CVC/CVV
- 카드 만료일 원문
- billing address 전체 원문
- 결제 수단 토큰 원문
- Polar raw webhook payload 전체

NNAI가 앱 DB에 저장할 수 있는 항목:

- 내부 `user_id`
- `plan_tier`, `status`, `current_period_start`, `current_period_end`
- `provider_customer_id`, `provider_subscription_id`
- pay-as-you-go 사용량 합산에 필요한 ledger 데이터
- 고객 지원에 필요한 최소 메타데이터

## 유료 고객 보호 원칙

유료 고객은 매출원이자 신뢰의 핵심이다. 보안과 운영은 다음 원칙을 따른다.

- webhook 지연만으로 즉시 free 강등하지 않는다
- 짧은 동기화 지연에는 `grace`를 둔다
- 고객이 결제를 마쳤는데 entitlement 반영이 지연되면 `restore purchase` 경로를 제공한다
- 수동 복구가 필요할 경우 audit trail이 남는 방식으로 처리한다

## 한계와 정직한 고지

다음 표현은 사용하지 않는다.

- "완벽하게 안전하다"
- "유출 가능성이 전혀 없다"
- "절대 해킹되지 않는다"

대신 다음을 기준으로 운영한다.

- 저장하는 정보 자체를 줄인다
- 평문 저장을 줄인다
- 키를 분리한다
- 로그와 운영 도구에서 노출을 줄인다
- 사고 시 빠르게 탐지하고 복구할 수 있게 만든다

## 보안 문의 및 신고

보안 취약점이나 개인정보 관련 우려가 있으면 아래 채널로 제보한다.

- 이메일: `nnai.support@gmail.com`

신고 시 포함하면 좋은 정보:

- 발견 일시
- 영향받는 경로 또는 화면
- 재현 단계
- 스크린샷 또는 요청/응답 예시

## 관련 문서

- [개인정보처리방침](./docs/privacy.html)
- [환불 및 서비스 약관](./TERMS.md)
- [보안 감사 보고서](./cowork/security/audit-report.md)
- [Polar billing/security 구현 계획](./docs/superpowers/plans/2026-04-16-polar-billing-security.md)
