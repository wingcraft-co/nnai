# NomadNavigator AI — Backend API Reference

> 프론트엔드 개발자용 백엔드 API 레퍼런스
> Base URL (로컬): `http://localhost:7860`
> Base URL (프로덕션): `https://api.nnai.app`
> 최종 업데이트: 2026-04-10

---

## 목차

1. [인증 (Auth)](#인증)
2. [추천 API](#추천-api)
3. [핀 API](#핀-api)
4. [방문자 카운터 API](#방문자-카운터-api)
5. [모바일 API (JWT)](#모바일-api-jwt)
6. [공통 에러](#공통-에러)
7. [CORS & 쿠키 정책](#cors--쿠키-정책)

---

## 인증

NNAI는 **Google OAuth 2.0 + 서버 서명 쿠키** 방식을 사용합니다.
로그인 후 `nnai_session` 쿠키가 브라우저에 자동 저장되며, 이후 모든 인증 요청에 자동 첨부됩니다.
프론트엔드는 별도로 토큰을 관리할 필요 없이 **credentials: 'include'** 옵션만 설정하면 됩니다.

### GET /auth/google

Google 로그인 페이지로 리다이렉트합니다.

```
GET /auth/google
→ 302 Redirect → Google OAuth 화면
```

**사용법:** 로그인 버튼 클릭 시 이 URL로 직접 이동시킵니다.

```js
window.location.href = `${API_BASE}/auth/google`;
```

---

### GET /auth/google/callback

Google OAuth 콜백 (프론트엔드에서 직접 호출 불필요 — Google이 자동 호출)

```
GET /auth/google/callback?code={code}
→ 302 Redirect → {FRONTEND_URL}  (예: https://nnai.app)
  Set-Cookie: nnai_session=...; HttpOnly; SameSite=None; Secure; Max-Age=86400
```

에러 시: `/?auth_error=1` 로 리다이렉트
→ 프론트엔드에서 쿼리파라미터 `auth_error=1` 감지 후 에러 메시지 표시

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
  "picture": "https://lh3.googleusercontent.com/..."
}
```

**응답 (미로그인):**
```json
{
  "logged_in": false
}
```

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
→ 302 Redirect → {FRONTEND_URL}  (예: https://nnai.app)
  Set-Cookie: nnai_session=; SameSite=None; Secure; Max-Age=0  (쿠키 삭제)
```

**프론트엔드 사용 예시:**
```js
window.location.href = `${API_BASE}/auth/logout`;
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
| `immigration_purpose` | string | ✅ | — | 이민 목적 |
| `lifestyle` | string[] | ✅ | — | 선호 라이프스타일 (예: `["해변", "영어권"]`) |
| `languages` | string[] | ✅ | — | 사용 가능 언어 (예: `["영어 업무 수준"]`) |
| `timeline` | string | ✅ | — | 체류 기간 (예: `"1년 장기 체류"`) |
| `preferred_countries` | string[] | ❌ | `[]` | 선호 국가/지역 (예: `["유럽"]`) |
| `preferred_language` | string | ❌ | `"한국어"` | 응답 언어 (`"한국어"` / `"English"`) |
| `persona_type` | string \| null | ❌ | `null` | 페르소나 유형 (`wanderer|local|planner|free_spirit|pioneer`) |
| `income_type` | string | ❌ | `""` | 소득 유형 (예: `"프리랜서"`) |
| `travel_type` | string | ❌ | `"혼자 (솔로)"` | 여행 타입 |
| `children_ages` | string[] \| null | ❌ | `null` | 자녀 나이 목록 |
| `dual_nationality` | boolean | ❌ | `false` | 복수 국적 여부 |
| `readiness_stage` | string | ❌ | `""` | 준비 단계 (예: `"구체적으로 준비 중"`) |
| `has_spouse_income` | string | ❌ | `"없음"` | 배우자 소득 여부 |
| `spouse_income_krw` | integer | ❌ | `0` | 배우자 월 소득 (만원) |
| `stay_style` | string \| null | ❌ | `null` | 체류 스타일 (`정착형|순환형|이동형`) |
| `tax_sensitivity` | string \| null | ❌ | `null` | 세금 민감도 (`optimize|simple|unknown`) |
| `total_budget_krw` | integer \| null | ❌ | `null` | 단기 체류 시 총 예산 (만원 단위). 중기/장기는 `null`. |

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
  "markdown": "## 🏙 리스본 상세 이민 가이드\n### 출국 전 준비사항\n..."
}
```

> 현재 `/api/detail`은 인증 없이 호출 가능합니다.

---

## 핀 API

저장된 관심 도시를 관리합니다. **로그인 필요** (community 조회 제외).

### GET /api/pins

내 저장 도시 목록 조회. 미로그인 시 빈 배열 반환.

```
GET /api/pins
Cookie: nnai_session=...
```

**응답 (200 OK):**
```json
[
  {
    "city": "방콕",
    "display": "Bangkok, Thailand",
    "note": "좋아요",
    "lat": 13.75,
    "lng": 100.5,
    "created_at": "2026-03-30T10:00:00+00:00"
  }
]
```

---

### POST /api/pins

관심 도시 저장. **로그인 필요.**

```
POST /api/pins
Content-Type: application/json
Cookie: nnai_session=...
```

**요청 바디:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `city` | string | ✅ | 도시명 (한국어 또는 영어) |
| `display` | string | ✅ | 표시 이름 (예: `"Bangkok, Thailand"`) |
| `note` | string | ✅ | 메모 |
| `lat` | float | ✅ | 위도 |
| `lng` | float | ✅ | 경도 |
| `user_lat` | float \| null | ❌ | 사용자 현재 위치 위도 |
| `user_lng` | float \| null | ❌ | 사용자 현재 위치 경도 |

**응답 (200 OK):**
```json
{
  "id": 42,
  "city": "방콕",
  "created_at": "2026-03-30T10:00:00+00:00"
}
```

**에러 (401):** 미로그인
```json
{ "detail": "로그인이 필요합니다" }
```

---

### PUT /api/pins/{pin_id}

저장한 핀의 메모를 수정합니다. **로그인 필요. 본인 핀만 수정 가능.**

```
PUT /api/pins/{pin_id}
Content-Type: application/json
Cookie: nnai_session=...
```

**요청 바디:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `note` | string | ✅ | 변경할 메모 |

**응답 (200 OK):**
```json
{
  "id": 42,
  "note": "변경된 메모"
}
```

**에러:**
- `401` — 미로그인
- `404` — 핀 없음 또는 다른 유저의 핀

---

### DELETE /api/pins/{pin_id}

저장한 핀을 삭제합니다. **로그인 필요. 본인 핀만 삭제 가능.**

```
DELETE /api/pins/{pin_id}
Cookie: nnai_session=...
```

**응답 (200 OK):**
```json
{ "ok": true }
```

**에러:**
- `401` — 미로그인
- `404` — 핀 없음 또는 다른 유저의 핀

---

### GET /api/pins/community

전체 사용자의 핀을 도시별로 집계합니다. **인증 불필요.**

```
GET /api/pins/community
```

**응답 (200 OK):**
```json
[
  {
    "city": "방콕",
    "display": "Bangkok, Thailand",
    "lat": 13.75,
    "lng": 100.5,
    "cnt": 12
  }
]
```

> `cnt` — 해당 도시를 저장한 유저 수. 내림차순 정렬, 최대 100개.

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
  - `GET /api/mobile/pins`
  - `POST /api/mobile/pins`
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
  - `stats: { pins, posts, circles }`
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
| `404` | 리소스 없음 | 요청 ID 확인 |
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
- `HttpOnly` — JS에서 직접 접근 불가 (보안)
- `SameSite=None; Secure` — 프론트(nnai.app)·백엔드(api.nnai.app) 크로스 도메인 전달 필수
- `Max-Age=86400` — 24시간 유효

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
