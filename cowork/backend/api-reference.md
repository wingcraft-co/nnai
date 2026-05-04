# NomadNavigator AI — Backend API Reference

> 프론트엔드 개발자용 백엔드 API 레퍼런스
> Base URL (로컬): `http://localhost:7860`
> Base URL (프로덕션): `https://api.nnai.app`
> 최종 업데이트: 2026-04-22

운영 메모:
- FastAPI 앱은 startup lifecycle에서 `utils.db.ensure_database_ready()`를 호출합니다.
- 이미 준비된 DB에서는 읽기 전용 readiness check만 수행하고, 핵심 테이블/컬럼이 없을 때만 `utils.db.init_db()`로 스키마를 초기화합니다.
- 모듈 import 시점에는 DB 초기화를 수행하지 않으므로, 테스트/스크립트에서 `server` import 부작용이 없습니다.
- DB를 완전히 비운 직후 수동 초기화가 필요하면 `python scripts/init_db.py`를 실행합니다.

---

## 목차

1. [인증 (Auth)](#인증)
2. [추천 API](#추천-api)
3. [핀 API](#핀-api)
4. [결제 API](#결제-api)
5. [방문자 카운터 API](#방문자-카운터-api)
6. [모바일 API (JWT)](#모바일-api-jwt)
7. [공통 에러](#공통-에러)
8. [CORS & 쿠키 정책](#cors--쿠키-정책)

---

## 인증

 NNAI는 **Google OAuth 2.0 + 서버 서명 opaque session 쿠키** 방식을 사용합니다.
로그인 후 `nnai_session` 쿠키가 브라우저에 자동 저장되며, 쿠키 안에는 서명된 `session_id`만 들어갑니다.
실제 사용자 정보는 서버가 `auth_sessions` + `users` 테이블에서 조회합니다.
프론트엔드는 별도로 토큰을 관리할 필요 없이 **credentials: 'include'** 옵션만 설정하면 됩니다.

### GET /auth/google

Google 로그인 페이지로 리다이렉트합니다.

```
GET /auth/google
→ 302 Redirect → Google OAuth 화면
```

선택 쿼리:

- `return_to` — 로그인 완료 후 되돌아갈 프론트엔드 URL.
  허용 origin만 받아들이며, 허용되지 않은 값은 서버 기본 `FRONTEND_URL`로 폴백됩니다.
  예: `https://dev.nnai.app/ko/login`

보안 메모:
- 서버가 OAuth CSRF 방어용 `oauth_state` 쿠키를 발급합니다.
- 서버가 서명된 `oauth_return_to` 쿠키를 발급해 callback 시 안전하게 post-login redirect를 복원합니다.
- 콜백의 `state`가 쿠키와 일치하지 않으면 로그인은 거부됩니다.
- `return_to`는 allowlist 기반으로 검증되며, 임의 외부 도메인으로의 open redirect는 허용되지 않습니다.

**사용법:** 로그인 버튼 클릭 시 이 URL로 직접 이동시킵니다.

```js
window.location.href =
  `${API_BASE}/auth/google?return_to=${encodeURIComponent(window.location.href)}`;
```

---

### GET /auth/google/callback

Google OAuth 콜백 (프론트엔드에서 직접 호출 불필요 — Google이 자동 호출)

```
GET /auth/google/callback?code={code}
→ 302 Redirect → `return_to` 또는 {FRONTEND_URL}
  Set-Cookie: nnai_session=...; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=86400
```

성공 시:
- `/auth/google` 시작 시 전달한 `return_to`가 허용된 origin이면 해당 URL로 복귀
- `return_to`가 없거나 허용되지 않으면 서버 기본 `{FRONTEND_URL}`로 복귀

에러 시:
- `return_to`가 있으면 해당 URL에 `auth_error=1`, `auth_error=csrf`, 또는 `auth_error=db` 쿼리를 붙여 복귀
- `return_to`가 없으면 기존처럼 `/?auth_error=...` 로 리다이렉트
- DB 연결/쓰기 실패 시 `auth_error=db` 로 복귀하며, 임시 OAuth 쿠키는 정리됩니다.

프론트엔드 구현 메모:
- `dev.nnai.app/[locale]/login` 같은 preview/dev 도메인에서도 같은 origin으로 복귀 가능
- callback 처리 후 `oauth_state`, `oauth_return_to` 쿠키는 삭제됩니다.
- `nnai_session`에는 프로필 데이터가 아닌 opaque session만 저장됩니다.

---

### GET /auth/me

현재 로그인 상태 및 유저 정보를 반환합니다.

```
GET /auth/me
```

**응답 (로그인된 경우):**
```json
{
  "logged_in": true,
  "uid": "google_user_sub_id",
  "name": "홍길동",
  "picture": "https://lh3.googleusercontent.com/...",
  "entitlement": {
    "plan_tier": "free",
    "status": "active",
    "payg_enabled": false,
    "payg_monthly_cap_usd": 50.0
  }
}
```

`entitlement`는 entitlement row가 없더라도 정규화된 기본값(`free`, `active`, `payg_enabled=false`)으로 반환됩니다.

**응답 (미로그인):**
```json
{
  "logged_in": false
}
```

유효하지 않은 session cookie, 만료된 session, revoke된 session은 모두 `logged_in: false`로 정규화됩니다.

**응답 (DB 일시 장애):**
```json
{
  "logged_in": false,
  "error": "db_unavailable"
}
```

- 상태 코드는 `503 Service Unavailable`
- 프론트엔드는 이 응답을 로그인 실패/재시도 가능 상태로 처리해야 합니다.

**프론트엔드 사용 예시:**
```js
const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
const user = await res.json();
if (user.logged_in) { /* 로그인 상태 처리 */ }
```

---

### GET /auth/logout

로그아웃 후 홈으로 리다이렉트합니다. 쿠키가 삭제됩니다.

```
GET /auth/logout
→ 302 Redirect → `return_to` 또는 {FRONTEND_URL}
  Set-Cookie: nnai_session=; Path=/; SameSite=None; Secure; Max-Age=0  (쿠키 삭제)
```

선택 쿼리:

- `return_to` — 로그아웃 후 되돌아갈 프론트엔드 URL.
  `/auth/google`과 동일한 allowlist 검증이 적용됩니다.

**프론트엔드 사용 예시:**
```js
window.location.href =
  `${API_BASE}/auth/logout?return_to=${encodeURIComponent(window.location.href)}`;
```

---

## 추천 API

### POST /api/recommend

**Step 1** — 사용자 프로필을 기반으로 최적 거주 도시 TOP 5를 추천합니다. 도시 상세 데이터는 `/api/reveal` 호출 후 반환됩니다.

```
POST /api/recommend
Content-Type: application/json
```

**요청 바디:**

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `nationality` | string | ✅ | — | 국적 (예: `"Korean"`) |
| `income_krw` | integer | ✅ | — | 월 소득 (만원 단위, 예: `500` = 500만원) |
| `immigration_purpose` | string | ✅ | — | 이민 목적, 최대 500자 |
| `lifestyle` | string[] | ✅ | — | 선호 라이프스타일, 최대 10개 |
| `languages` | string[] | ✅ | — | 사용 가능 언어, 최대 10개 |
| `timeline` | string | ✅ | — | 체류 기간 (예: `"1년 장기 체류"`), 최대 100자 |
| `preferred_countries` | string[] | ❌ | `[]` | 선호 국가/지역, 최대 10개 |
| `preferred_language` | string | ❌ | `"한국어"` | 응답 언어 (`"한국어"` / `"English"`), 최대 20자 |
| `persona_type` | string \| null | ❌ | `null` | 페르소나 유형 (`wanderer|local|planner|free_spirit|pioneer`), 최대 50자 |
| `income_type` | string | ❌ | `""` | 소득 유형 (예: `"프리랜서"`), 최대 50자 |
| `travel_type` | string | ❌ | `"혼자 (솔로)"` | 여행 타입, 최대 50자 |
| `children_ages` | string[] \| null | ❌ | `null` | 자녀 나이 목록, 최대 10개 |
| `dual_nationality` | boolean | ❌ | `false` | 복수 국적 여부 |
| `readiness_stage` | string | ❌ | `""` | 준비 단계 (예: `"구체적으로 준비 중"`), 최대 50자 |
| `has_spouse_income` | string | ❌ | `"없음"` | 배우자 소득 여부, 최대 20자 |
| `spouse_income_krw` | integer | ❌ | `0` | 배우자 월 소득 (만원) |
| `stay_style` | string \| null | ❌ | `null` | 체류 스타일 (`정착형|순환형|이동형`), 최대 20자 |
| `tax_sensitivity` | string \| null | ❌ | `null` | 세금 민감도 (`optimize|simple|unknown`), 최대 20자 |
| `total_budget_krw` | integer \| null | ❌ | `null` | 단기 체류 시 총 예산 (만원 단위). 중기/장기는 `null`. |

검증 제약:
- `nationality` 최대 100자
- 리스트 필드(`lifestyle`, `languages`, `preferred_countries`, `children_ages`)는 최대 10개
- 제약 위반 시 `422 Unprocessable Entity`

**요청 예시:**
```json
{
  "nationality": "Korean",
  "income_krw": 500,
  "immigration_purpose": "원격 근무",
  "lifestyle": ["해변", "영어권"],
  "languages": ["영어 업무 수준"],
  "timeline": "1년 장기 체류",
  "preferred_countries": ["유럽"],
  "preferred_language": "한국어",
  "income_type": "프리랜서",
  "travel_type": "혼자 (솔로)",
  "readiness_stage": "구체적으로 준비 중",
  "stay_style": "정착형",
  "tax_sensitivity": "optimize"
}
```

**응답 (200 OK):**
```json
{
  "session_id": "abc123def456",
  "card_count": 5,
  "parsed": {
    "top_cities": [...],
    "overall_warning": "공통 경고 메시지",
    "_user_profile": { ... }
  }
}
```

> 도시 상세 데이터는 응답에 포함되지 않습니다. `/api/reveal`을 호출해야 합니다.
> rate limit은 엔드포인트별/등급별로 다릅니다. anonymous는 IP 기준, 로그인 사용자는 user_id 기준으로 제한됩니다.

**rate limit 정책:**

| 사용자 | `/api/recommend` | `/api/detail` |
|---|---:|---:|
| anonymous | 5/min | 10/min |
| free | 10/min | 20/min |
| pro | 30/min | 60/min |
| pro + payg | minute cap 없음, burst guard만 적용 | minute cap 없음, burst guard만 적용 |

**payg burst guard:**
- `/api/recommend`: 3 req/sec
- `/api/detail`: 5 req/sec

구현 메모:
- rate limit 카운터는 DB 공유 상태를 사용하므로 멀티 인스턴스 배포에서도 버킷을 공통으로 집계합니다.

**Step 1 추천 로직:**
- **스코어링 모델:** 규칙 기반 DB Recommender (LLM 개입 없음)
- **4-Block 점수 계산 (0~10):** 체류 기간에 따라 가중치 동적 분기
  - 단기(≤3개월): A=40%, B=10%, C=40%, D=10%
  - 중기(≤12개월): A=30%, B=25%, C=30%, D=15%
  - 장기(>12개월): A=30%, B=25%, C=25%, D=20%
- **Hard Filters:** 최소 소득, 체류기간, 선호 지역, 솅겐 장기체류 소득 제한
- **결과 선정:** 점수 내림차순 정렬 + 국가당 최고점 도시 1개 + 상위 5개

> **주의:** `parsed` 객체 전체를 Step 2 요청 시 `parsed_data`로 그대로 전달해야 합니다.

---

### POST /api/reveal (신규)

유저가 선택한 3장의 카드를 공개하고 도시 상세 데이터를 반환합니다.

```
POST /api/reveal
Content-Type: application/json
```

**요청 바디:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `session_id` | string | ✅ | `/api/recommend` 응답의 session_id |
| `selected_indices` | int[] | ✅ | 선택한 카드 인덱스 3개 (0-4) |

**요청 예시:**
```json
{
  "session_id": "abc123def456",
  "selected_indices": [0, 2, 4]
}
```

**응답 (200 OK):**
```json
{
  "revealed_cities": [
    {
      "city": "Lisbon",
      "city_kr": "리스본",
      "country_id": "PT",
      "monthly_cost_usd": 2200,
      "visa_free_days": 90,
      "internet_mbps": 120,
      ...
    }
  ]
}
```

**에러 (400):**
```json
{ "error": "Must select exactly 3 cards" }
{ "error": "Cards already revealed" }
{ "error": "Session not found" }
```

---

### POST /api/detail

**Step 2** — 선택한 도시의 상세 이민 가이드를 반환합니다.

```
POST /api/detail
Content-Type: application/json
```

**요청 바디:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `parsed_data` | object | ✅ | Step 1 응답의 `parsed` 객체 전체 |
| `city_index` | integer | ❌ | 도시 인덱스 (0=1위, 1=2위, 2=3위), 기본값 `0` |

**요청 예시:**
```json
{
  "parsed_data": { "...Step 1의 parsed 객체..." },
  "city_index": 0
}
```

**응답 (200 OK):**
```json
{
  "markdown": "## 🏙 리스본 상세 이민 가이드\n### 출국 전 준비사항\n...",
  "cached": false,
  "quota": {
    "is_unlimited": false,
    "limit": 2,
    "used": 1,
    "remaining": 1
  }
}
```

로그인 사용자의 경우 `user_id + onboarding _user_profile + 선택 도시` 기준으로 상세 가이드 markdown을 캐시합니다. 같은 온보딩 값과 같은 도시로 다시 요청하면 LLM을 재호출하지 않고 `cached: true`로 캐시된 markdown을 반환합니다.

무료 플랜은 캐시 miss 기준 상세 가이드 생성 2회까지 허용합니다. 캐시 hit은 추가 차감하지 않습니다. Pro 플랜은 quota가 무제한입니다.

> 인증 없이 호출하는 레거시 요청은 캐시/무료 quota 없이 기존처럼 markdown만 반환합니다.
> `/api/recommend`와 minute bucket을 공유하지 않습니다. endpoint별/등급별 정책이 각각 적용됩니다.

**에러 (402):**
```json
{
  "detail": "Free detail guide quota reached.",
  "quota": {
    "is_unlimited": false,
    "limit": 2,
    "used": 2,
    "remaining": 0
  }
}
```

pay-as-you-go 월 한도 도달 시에도 `402`를 반환합니다.

**에러 (429):**
```json
{
  "detail": "Too many requests. Please retry later."
}
```

---

## 결제 API

Polar 결제는 앱 권한의 단일 진실 공급원으로 `billing_entitlements`를 사용합니다. 카드번호/CVC/청구주소 원문은 앱 DB에 저장하지 않습니다.

### POST /api/billing/checkout

로그인된 사용자를 Polar checkout으로 보냅니다.

```http
POST /api/billing/checkout
Content-Type: application/json
```

요청 예시:

```json
{
  "plan_code": "pro_monthly",
  "locale": "ko",
  "return_path": "/ko/pricing?checkout=return"
}
```

응답:

```json
{
  "checkout_url": "https://polar.sh/checkout/..."
}
```

메모:
- 로그인되지 않으면 `401`
- 서버는 `external_customer_id=user_id`로 checkout을 생성합니다
- 생성된 checkout은 `billing_checkout_sessions`에 기록됩니다

### GET /api/billing/status

현재 로그인된 사용자의 entitlement 요약을 반환합니다.

```http
GET /api/billing/status
```

응답:

```json
{
  "entitlement": {
    "plan_tier": "free",
    "status": "active",
    "payg_enabled": false,
    "payg_monthly_cap_usd": 50.0
  }
}
```

### POST /api/billing/webhook

Polar webhook 수신 엔드포인트입니다.

```http
POST /api/billing/webhook
```

보안 메모:
- Polar 문서 기준 Standard Webhooks 헤더(`webhook-id`, `webhook-timestamp`, `webhook-signature`)를 검증합니다.
- 서명 실패 시 `403`
- `(provider, event_id)` 기준 멱등 처리로 중복 delivery는 무해합니다.
- `subscription.active`, `subscription.updated`, `subscription.past_due`, `subscription.canceled`, `subscription.revoked`, `order.paid`를 entitlement 반영에 사용합니다.

### POST /api/billing/restore

로그인된 사용자의 `external_customer_id=user_id`를 기준으로 Polar customer state를 다시 조회해 entitlement를 복구합니다.

```http
POST /api/billing/restore
```

응답 예시:

```json
{
  "ok": true,
  "restored": true,
  "entitlement": {
    "plan_tier": "pro",
    "status": "active",
    "payg_enabled": false,
    "payg_monthly_cap_usd": 50.0
  }
}
```

운영 메모:
- webhook 지연/유실 시 유료 고객 복구용 엔드포인트입니다.
- provider 상태에 active subscription이 없다고 해서 이 경로에서 자동 강등하지는 않습니다.

---

## Pro 도시 대시보드 API

상세 가이드 이후 Pro 사용자가 도시를 확정하고 개인 위젯 대시보드를 저장하는 API입니다. 모든 쓰기/조회는 `billing_entitlements.plan_tier='pro'` 및 `status IN ('active', 'grace')` 권한이 필요합니다.

### GET /api/dashboard

현재 로그인 사용자의 활성 도시 플랜, 위젯 설정, 위젯 catalog를 반환합니다.

```http
GET /api/dashboard
Cookie: nnai_session=...
```

응답:

```json
{
  "plan": {
    "id": 7,
    "city": "Bangkok",
    "city_kr": "방콕",
    "country": "Thailand",
    "country_id": "TH",
    "arrived_at": "2026-04-26",
    "visa_type": "관광비자",
    "visa_expires_at": null,
    "city_payload": { "...": "추천 도시 원본" },
    "coworking_space": {},
    "tax_profile": {},
    "status": "active"
  },
  "widgets": {
    "enabled_widgets": ["weather", "exchange", "stay", "visa", "tax"],
    "widget_order": ["weather", "exchange", "stay", "visa", "tax"],
    "widget_settings": {}
  },
  "catalog": [{ "id": "weather", "title": "날씨", "locked": true }]
}
```

### POST /api/dashboard/confirm

상세 가이드에서 선택한 도시를 활성 Pro 대시보드 도시로 확정합니다. 기존 active 플랜은 `archived` 처리되고 새 active 플랜이 생성됩니다.

```http
POST /api/dashboard/confirm
Content-Type: application/json
Cookie: nnai_session=...
```

요청:

```json
{
  "city": { "city": "Bangkok", "city_kr": "방콕", "country_id": "TH", "visa_url": "https://www.thaievisa.go.th/" },
  "user_profile": { "nationality": "Korean" },
  "arrived_at": "2026-04-26"
}
```

### PATCH /api/dashboard/widgets

사용자별 위젯 enable/disable, 표시 순서, 위젯별 설정값을 저장합니다. `weather`, `exchange`, `stay`, `visa`는 고정 위젯이라 서버가 항상 enabled/order 선두에 복원합니다.

```json
{
  "enabled_widgets": ["tax", "budget"],
  "widget_order": ["budget", "tax"],
  "widget_settings": { "budget": { "monthlyTarget": 2200 } }
}
```

### PATCH /api/dashboard/plan

활성 플랜의 사용자 입력값을 갱신합니다.

```json
{
  "arrived_at": "2026-04-10",
  "visa_type": "DTV",
  "visa_expires_at": "2027-04-10",
  "coworking_space": { "name": "The Hive", "monthly_cost_usd": 120 },
  "tax_profile": { "monthly_income_usd": 4000, "home_country": "KR" }
}
```

에러:
- `401`: 로그인 필요
- `403`: Pro 플랜 필요
- `404`: 활성 대시보드 플랜 없음 (`PATCH /api/dashboard/plan`)

---

## Nomad Journey API

픽셀 지구본 이스터에그의 노마드 여정 기록 API입니다. 기존 관심 도시 `pins` API는 제거되었고, 기존 `pins` 데이터는 새 여정 데이터로 마이그레이션하지 않습니다.

### GET /api/journey/me

내 인증 도시 목록을 시간순으로 조회합니다. **로그인 필요.**

```
GET /api/journey/me
Cookie: nnai_session=...
```

**응답 (200 OK):**
```json
[
  {
    "id": 42,
    "city": "Kuala Lumpur",
    "country": "Malaysia",
    "country_code": "MY",
    "lat": 3.139,
    "lng": 101.6869,
    "note": "KL좋아",
    "persona_type": "planner",
    "verified_method": "gps_city_confirmed",
    "supported_city_id": null,
    "is_supported_city": false,
    "location_source": "legacy",
    "line_style": "solid",
    "geocode_place_id": null,
    "geocode_confidence": null,
    "geocoded_at": null,
    "gps_verified": false,
    "flag_color": "red",
    "github_issue_url": null,
    "github_issue_key": null,
    "github_issue_status": "not_required",
    "created_at": "2026-05-01T05:00:00+00:00"
  }
]
```

**에러:**
- `401` — 미로그인

---

### POST /api/journey/geocode

국가 선택 후 지원 목록에 없는 도시를 사용자가 명시적으로 검색할 때 호출합니다. **인증 불필요.** 자동완성 용도로 매 키 입력마다 호출하지 않습니다.

```
POST /api/journey/geocode
Content-Type: application/json
```

**요청 바디:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `query` | string | ✅ | 검색할 도시명. 2~80자 |
| `country_code` | string | ✅ | ISO-2 국가 코드 |

**응답 (200 OK):**
```json
{
  "query": "Granada",
  "country_code": "ES",
  "results": [
    {
      "city": "Granada",
      "country": "Spain",
      "country_code": "ES",
      "lat": 37.1773,
      "lng": -3.5986,
      "supported": false,
      "supported_city_id": null,
      "geocode_result_id": "geo_<signed-result-token>",
      "location_source": "nominatim",
      "display_name": "Granada, Andalusia, Spain",
      "geocode_place_id": "es-granada",
      "geocode_confidence": 0.9
    }
  ],
  "attribution": "Geocoding data from OpenStreetMap contributors"
}
```

지원 도시와 매칭되는 경우 `supported: true`, `supported_city_id`, canonical 좌표를 반환하며 `geocode_result_id`는 `null`입니다. 미지원 도시는 서명된 단기 `geocode_result_id`를 반환하며 여행 로그용 위치로만 사용합니다. 추천/비자/예산/세금 상세 데이터와 연결하지 않습니다.

**운영/보안 제약:**
- 서버에서 IP/사용자 기준 1분당 12회로 제한합니다.
- provider 결과와 빈 결과는 bounded TTL cache에 저장됩니다.
- 외부 geocoder 장애는 `503`으로 반환합니다.

**에러:**
- `422` — 검색어 길이 또는 국가 코드 형식 오류
- `503` — 외부 geocoder 장애 또는 timeout

---

### POST /api/journey/stops

사용자가 확정한 여정 도시를 저장합니다. **로그인 필요.** 신규 안전 경로는 지원 도시 `city_id` 또는 백엔드가 발급한 `geocode_result_id`를 사용합니다. 기존 프론트엔드 호환을 위해 legacy `city/country/lat/lng` 요청도 계속 허용합니다.

```
POST /api/journey/stops
Content-Type: application/json
Cookie: nnai_session=...
```

**요청 바디 — 지원 도시:**
```json
{
  "city_id": "LIS",
  "gps_verified": true,
  "note": "리스본"
}
```

**요청 바디 — 미지원 검증 도시:**
```json
{
  "geocode_result_id": "geo_<signed-result-token>",
  "gps_verified": true,
  "note": "추억"
}
```

미지원 검증 도시는 `gps_verified: true`일 때만 저장할 수 있습니다. 지원 도시는 GPS 인증 성공 시 초록 깃발(`green`), GPS 미인증 시 빨간 깃발(`red`)로 저장됩니다. 미지원 검증 도시는 노란 깃발(`yellow`)로 저장되며 GitHub 도시 추가 요청 이슈 생성/연결을 시도합니다.

**요청 바디 — legacy 호환:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `city` | string | ✅ | 인증한 도시명 |
| `country` | string | ✅ | 국가명 |
| `country_code` | string \| null | ❌ | ISO-2 국가 코드 |
| `lat` | float | ✅ | 도시 중심 위도 |
| `lng` | float | ✅ | 도시 중심 경도 |
| `note` | string | ✅ | 10글자 이하 방명록 |
| `gps_verified` | boolean | ❌ | legacy 호환 요청에서는 무시되며 `false`로 저장 |

**응답 (200 OK):**
```json
{
  "id": 42,
  "city": "Kuala Lumpur",
  "country": "Malaysia",
  "country_code": "MY",
  "lat": 3.139,
  "lng": 101.6869,
  "note": "KL좋아",
  "persona_type": "planner",
  "verified_method": "gps_city_confirmed",
  "supported_city_id": null,
  "is_supported_city": false,
  "location_source": "legacy",
  "line_style": "solid",
  "geocode_place_id": null,
  "geocode_confidence": null,
  "geocoded_at": null,
  "gps_verified": false,
  "flag_color": "red",
  "github_issue_url": null,
  "github_issue_key": null,
  "github_issue_status": "not_required",
  "created_at": "2026-05-01T05:00:00+00:00"
}
```

`line_style`은 프론트엔드 여정 연결선 렌더링용입니다. 지원 도시는 `solid`, 미지원 검증 도시는 `dashed`입니다. 서버가 계산하므로 클라이언트 요청 바디로 받지 않습니다.

`flag_color`는 깃발 렌더링용입니다.

| 값 | 조건 |
|----|------|
| `green` | 지원 도시 + GPS 인증 |
| `red` | 지원 도시 또는 legacy 저장 + GPS 미인증 |
| `yellow` | 미지원 검증 도시 + GPS 인증 |

`github_issue_status`는 노란 깃발 저장 시 GitHub 이슈 자동화 상태입니다.

| 값 | 설명 |
|----|------|
| `not_required` | GitHub 이슈가 필요 없거나 로컬/테스트 환경에서 토큰이 없음 |
| `created` | 새 도시 추가 요청 이슈 생성 |
| `linked` | 기존 도시 추가 요청 이슈 연결 |
| `failed` | 이슈 생성/조회 실패. journey stop 저장은 유지 |

**에러:**
- `401` — 미로그인
- `422` — 필수 필드 누락, `note` 10글자 초과, invalid 좌표, 알 수 없는 `city_id`, 만료/위조된 `geocode_result_id`, `city_id`와 `geocode_result_id` 동시 전달, 미지원 도시 GPS 미인증 저장

---

### GET /api/journey/community

전체 사용자의 인증 도시를 도시별로 집계합니다. **인증 불필요.** 개별 사용자, 개별 방명록, 원본 GPS 좌표는 반환하지 않습니다.

```
GET /api/journey/community
GET /api/journey/community?persona_type=planner
```

**쿼리 파라미터:**

| 파라미터 | 설명 |
|----------|------|
| `persona_type` | 선택. 같은 노마드 타입 사용자만 도시별 집계 |

**응답 (200 OK):**
```json
[
  {
    "city": "Kuala Lumpur",
    "country": "Malaysia",
    "country_code": "MY",
    "lat": 3.139,
    "lng": 101.6869,
    "cnt": 12,
    "supported_city_id": "KL",
    "line_style": "solid",
    "flag_color": "green"
  }
]
```

> `cnt` — 해당 도시를 인증한 서로 다른 사용자 수. 내림차순 정렬, 최대 100개. 모든 community row는 privacy 보호를 위해 필터 적용 후 서로 다른 사용자 3명 이상일 때만 공개 응답에 포함됩니다. Legacy 좌표 직접 저장 row는 public community에서 제외됩니다.

---

## 방문자 카운터 API

페이지 방문 횟수를 DB(PostgreSQL)에 집계합니다. **인증 불필요.**

### POST /api/visits/ping

페이지 방문 시 호출. 해당 경로의 카운트를 1 증가시키고 최신값을 반환합니다.

```
POST /api/visits/ping
Content-Type: application/json
```

**요청 바디:**

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `path` | string | ❌ | `"/dev"` | 집계할 경로 |

**응답 (200 OK):**
```json
{ "path": "/dev", "count": 42 }
```

**프론트엔드 사용 예시:**
```js
// 페이지 마운트 시 호출
const res = await fetch(`${API_BASE}/api/visits/ping`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ path: '/dev' }),
});
const { count } = await res.json();
```

---

### GET /api/visits

경로별 누적 방문자 수를 조회합니다.

```
GET /api/visits?path=/dev
```

**쿼리 파라미터:**

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| `path` | `"/dev"` | 조회할 경로 |

**응답 (200 OK):**
```json
{ "path": "/dev", "count": 42 }
```

> 방문 기록이 없는 경로는 `count: 0`을 반환합니다.

---

## 모바일 API (JWT)

모바일 API는 `Authorization: Bearer <jwt>`를 사용합니다.

### 모바일 Auth

- `POST /auth/mobile/token` → `{ token, user }`
- `GET /auth/mobile/me` → `User(uid, name, picture, email, persona_type, character)`

### Core Mobile

- Feed: `GET/POST /api/mobile/posts`, `POST /api/mobile/posts/{post_id}/like`, `GET/POST /api/mobile/posts/{post_id}/comments`
- Discover/City:
  - `GET /api/mobile/cities`
  - `GET /api/mobile/cities/{city_id}`
  - `GET /api/mobile/circles`
  - `POST /api/mobile/circles/{id}/join`
  - `GET /api/mobile/city-stays`
  - `POST /api/mobile/city-stays`
  - `PATCH /api/mobile/city-stays/{id}`
  - `POST /api/mobile/city-stays/{id}/leave`
- Plans: `GET/POST/PATCH/DELETE /api/mobile/moves`, `PATCH /api/mobile/moves/{id}/items/{item_id}`
- Profile: `GET /api/mobile/profile`
- Recommend: `POST /api/mobile/recommend`, `POST /api/mobile/detail`
- Upload:
  - `POST /api/mobile/uploads/image` (multipart form-data, field: `file`) -> `{ url, image_url }`
  - `GET /api/mobile/uploads/{filename}` (업로드 이미지 파일 조회)

### Type Actions

- Planner:
  - `GET/POST /api/mobile/type-actions/planner/boards`
  - `POST /api/mobile/type-actions/planner/boards/{board_id}/tasks`
  - `PATCH /api/mobile/type-actions/planner/tasks/{task_id}`
- Free Spirit: `POST /api/mobile/type-actions/free-spirit/spins`
- Wanderer:
  - `GET /api/mobile/type-actions/wanderer/hops`
  - `POST /api/mobile/type-actions/wanderer/hops`
  - `PATCH /api/mobile/type-actions/wanderer/hops/{hop_id}`
  - `DELETE /api/mobile/type-actions/wanderer/hops/{hop_id}`
- Local:
  - `GET /api/mobile/type-actions/local/events/saved`
  - `POST /api/mobile/type-actions/local/events/save`
  - `PATCH /api/mobile/type-actions/local/events/{event_id}`
- Pioneer:
  - `GET /api/mobile/type-actions/pioneer/milestones`
  - `PATCH /api/mobile/type-actions/pioneer/milestones/{milestone_id}`

### 모바일 응답 계약 (필수 필드)

- `GET /api/mobile/profile`
  - `uid`, `name`, `picture`, `email`
  - `persona_type` (`wanderer|local|planner|free_spirit|pioneer|null`)
  - `character` (`persona_type`가 없으면 `rocky`)
  - `badges: string[]`
  - `stats: { journey_stops, posts, circles }`
- `GET/POST/PATCH /api/mobile/type-actions/wanderer/hops*`
  - `status`: `planned | booked`
  - `conditions: [{ id, label, is_done }]`
  - `is_focus: boolean`
  - `from_country`, `to_country`, `to_city`, `target_month`, `note`
- `GET/POST/PATCH /api/mobile/city-stays*`
  - `id, city, country, arrived_at, left_at, visa_expires_at, budget_total, budget_remaining, created_at, updated_at`
- `GET /api/mobile/posts`
  - `author_persona_type` 포함
- `POST /api/mobile/uploads/image`
  - 응답 `url`/`image_url`는 그대로 `<Image uri>`에 사용할 수 있는 경로(`/api/mobile/uploads/{filename}`)
- `GET/POST /api/mobile/type-actions/planner/*`
  - Board: `id, country, city, title, created_at, updated_at`
  - Task: `id, board_id, text, is_done, due_date, sort_order`
- `POST /api/mobile/type-actions/free-spirit/spins`
  - `{ spin_id, selected, candidates_count }`
- `GET /api/mobile/type-actions/local/events/saved`
  - `id, source, source_event_id, title, venue_name, address, country, city, starts_at, ends_at, lat, lng, radius_m, status`
- `GET/PATCH /api/mobile/type-actions/pioneer/milestones*`
  - `id, country, city, category, title, status, target_date, note`

---

## 공통 에러

| 상태코드 | 의미 | 대응 |
|---------|------|------|
| `401` | 로그인 필요 | `/auth/google` 로 이동 |
| `402` | pay-as-you-go 월 한도 도달 | billing/payg 안내 표시 |
| `404` | 리소스 없음 | 요청 ID 확인 |
| `429` | 요청 횟수 초과 | 잠시 후 재시도 |
| `422` | 요청 바디 형식 오류 | 필수 필드 / 타입 확인 |
| `500` | 서버 내부 오류 | 재시도 또는 문의 |

---

## CORS & 쿠키 정책

### CORS 허용 Origin
```
https://nnai.app
https://www.nnai.app
http://localhost:3000
```

### fetch 요청 시 필수 설정
```js
// 모든 API 호출에 credentials: 'include' 추가 필수 (쿠키 전달)
const res = await fetch(`${API_BASE}/api/recommend`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',   // ← 필수! 없으면 인증이 안 됩니다
  body: JSON.stringify(payload),
});
```

### 쿠키 정책
- 쿠키명: `nnai_session`
- `Path=/` — 전체 경로에서 일관되게 적용
- `HttpOnly` — JS에서 직접 접근 불가 (보안)
- `SameSite=None; Secure` — 프론트(nnai.app)·백엔드(api.nnai.app) 크로스 도메인 전달 필수
- `Max-Age=86400` — 24시간 유효

### 보안 이벤트 로깅
- 서버는 다음 이벤트를 warning 레벨 보안 로그로 기록합니다:
- `oauth_state_mismatch`
- `oauth_callback_rejected`
- `session_bad_signature`
- `rate_limit_exceeded`
- `payg_cap_reached`

---

## 환경변수 (프론트엔드)

| 변수명 | 값 | 설명 |
|--------|-----|------|
| `NEXT_PUBLIC_API_URL` | `https://api.nnai.app` | 프로덕션 백엔드 URL |
| `NEXT_PUBLIC_API_URL` | `http://localhost:7860` | 로컬 개발 시 |

```js
// frontend/src/lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:7860';
```
