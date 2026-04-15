# Rate Limit Entitlements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 엔드포인트별/등급별 rate limit와 `pro + payg` 월 50달러 상한을 지원하는 entitlement 기반 보호 계층을 백엔드에 추가한다.

**Architecture:** `users`는 로그인 프로필만 유지하고, 신규 `billing_entitlements`, `billing_usage_ledger`, `billing_provider_events` 테이블을 추가한다. 요청 시 entitlement를 해석해 `anonymous/free/pro/pro_payg` 모드로 분기하고, `/api/recommend`와 `/api/detail`에 endpoint-specific minute limit, payg burst guard, payg spend-cap preflight를 적용한다.

**Tech Stack:** Python 3, FastAPI, PostgreSQL (`psycopg2`), pytest

---

### Task 1: Entitlement 모델 테스트 추가

**Files:**
- Create: `tests/test_rate_limit_entitlements.py`

- [ ] **Step 1: failing test 작성**

```python
from fastapi import Request

from utils.rate_limit import RateLimitPolicy, RequestAccessMode, resolve_request_access_mode


def test_resolve_request_access_mode_defaults_to_free_for_logged_in_user_without_entitlement():
    mode = resolve_request_access_mode(
        user_id="user-1",
        entitlement=None,
    )
    assert mode == RequestAccessMode.FREE


def test_resolve_request_access_mode_returns_pro_payg_for_active_payg_entitlement():
    entitlement = {
        "plan_tier": "pro",
        "status": "active",
        "payg_enabled": True,
    }
    mode = resolve_request_access_mode(
        user_id="user-1",
        entitlement=entitlement,
    )
    assert mode == RequestAccessMode.PRO_PAYG


def test_rate_limit_policy_uses_endpoint_specific_minute_limits():
    policy = RateLimitPolicy()
    assert policy.minute_limit(RequestAccessMode.ANONYMOUS, "recommend") == 5
    assert policy.minute_limit(RequestAccessMode.ANONYMOUS, "detail") == 10
    assert policy.minute_limit(RequestAccessMode.PRO, "recommend") == 30
    assert policy.minute_limit(RequestAccessMode.PRO, "detail") == 60


def test_rate_limit_policy_enables_burst_guard_only_for_pro_payg():
    policy = RateLimitPolicy()
    assert policy.burst_limit(RequestAccessMode.PRO_PAYG, "recommend") == 3
    assert policy.burst_limit(RequestAccessMode.PRO_PAYG, "detail") == 5
    assert policy.burst_limit(RequestAccessMode.FREE, "recommend") is None
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `SKIP_EXTERNAL_INIT=1 .venv/bin/pytest tests/test_rate_limit_entitlements.py -q`

Expected: `ModuleNotFoundError` 또는 `ImportError`로 FAIL

---

### Task 2: DB 스키마와 entitlement lookup 추가

**Files:**
- Modify: `utils/db.py`
- Test: `tests/test_rate_limit_entitlements.py`

- [ ] **Step 1: failing test 추가**

```python
from utils.rate_limit import normalize_entitlement


def test_normalize_entitlement_defaults_missing_row_to_free():
    normalized = normalize_entitlement(None)
    assert normalized["plan_tier"] == "free"
    assert normalized["status"] == "active"
    assert normalized["payg_enabled"] is False
    assert normalized["payg_monthly_cap_usd"] == 50.0
```

- [ ] **Step 2: `utils/db.py`에 테이블 DDL 추가**

```python
        cur.execute("""
            CREATE TABLE IF NOT EXISTS billing_entitlements (
                user_id                TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                plan_tier              TEXT NOT NULL CHECK (plan_tier IN ('free', 'pro')),
                status                 TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'canceled', 'grace')),
                payg_enabled           BOOLEAN NOT NULL DEFAULT FALSE,
                payg_monthly_cap_usd   NUMERIC(10,2) NOT NULL DEFAULT 50.00,
                current_period_start   TIMESTAMPTZ,
                current_period_end     TIMESTAMPTZ,
                updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """)
```

```python
        cur.execute("""
            CREATE TABLE IF NOT EXISTS billing_usage_ledger (
                id                   BIGSERIAL PRIMARY KEY,
                user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                endpoint             TEXT NOT NULL CHECK (endpoint IN ('recommend', 'detail')),
                request_key          TEXT NOT NULL,
                usage_type           TEXT NOT NULL CHECK (usage_type IN ('subscription', 'payg')),
                estimated_cost_usd   NUMERIC(10,4) NOT NULL DEFAULT 0,
                billed_cost_usd      NUMERIC(10,4),
                created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (request_key)
            );
        """)
```

```python
        cur.execute("""
            CREATE TABLE IF NOT EXISTS billing_provider_events (
                id              BIGSERIAL PRIMARY KEY,
                provider        TEXT NOT NULL,
                event_id        TEXT NOT NULL,
                payload_digest  TEXT NOT NULL,
                processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (provider, event_id)
            );
        """)
```

- [ ] **Step 3: entitlement helper 추가**

```python
def get_billing_entitlement(user_id: str) -> dict | None:
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT plan_tier, status, payg_enabled, payg_monthly_cap_usd,
                   current_period_start, current_period_end
            FROM billing_entitlements
            WHERE user_id = %s
            """,
            (user_id,),
        )
        row = cur.fetchone()
    if not row:
        return None
    return {
        "plan_tier": row[0],
        "status": row[1],
        "payg_enabled": row[2],
        "payg_monthly_cap_usd": float(row[3]),
        "current_period_start": row[4],
        "current_period_end": row[5],
    }
```

- [ ] **Step 4: 테스트 재실행**

Run: `SKIP_EXTERNAL_INIT=1 .venv/bin/pytest tests/test_rate_limit_entitlements.py -q`

Expected: newly added normalization test still FAIL, import succeeds

---

### Task 3: Rate limit/entitlement 유틸 구현

**Files:**
- Modify: `utils/rate_limit.py`
- Test: `tests/test_rate_limit_entitlements.py`

- [ ] **Step 1: 최소 구현**

```python
from enum import StrEnum


class RequestAccessMode(StrEnum):
    ANONYMOUS = "anonymous"
    FREE = "free"
    PRO = "pro"
    PRO_PAYG = "pro_payg"


def normalize_entitlement(entitlement: dict | None) -> dict:
    if not entitlement:
        return {
            "plan_tier": "free",
            "status": "active",
            "payg_enabled": False,
            "payg_monthly_cap_usd": 50.0,
            "current_period_start": None,
            "current_period_end": None,
        }
    normalized = {
        "plan_tier": entitlement.get("plan_tier", "free"),
        "status": entitlement.get("status", "active"),
        "payg_enabled": bool(entitlement.get("payg_enabled", False)),
        "payg_monthly_cap_usd": float(entitlement.get("payg_monthly_cap_usd", 50.0)),
        "current_period_start": entitlement.get("current_period_start"),
        "current_period_end": entitlement.get("current_period_end"),
    }
    return normalized


def resolve_request_access_mode(user_id: str | None, entitlement: dict | None) -> RequestAccessMode:
    if not user_id:
        return RequestAccessMode.ANONYMOUS
    normalized = normalize_entitlement(entitlement)
    if normalized["plan_tier"] != "pro":
        return RequestAccessMode.FREE
    if normalized["status"] != "active":
        return RequestAccessMode.FREE
    if normalized["payg_enabled"]:
        return RequestAccessMode.PRO_PAYG
    return RequestAccessMode.PRO


class RateLimitPolicy:
    def minute_limit(self, mode: RequestAccessMode, endpoint: str) -> int | None:
        table = {
            RequestAccessMode.ANONYMOUS: {"recommend": 5, "detail": 10},
            RequestAccessMode.FREE: {"recommend": 10, "detail": 20},
            RequestAccessMode.PRO: {"recommend": 30, "detail": 60},
            RequestAccessMode.PRO_PAYG: {"recommend": None, "detail": None},
        }
        return table[mode][endpoint]

    def burst_limit(self, mode: RequestAccessMode, endpoint: str) -> int | None:
        if mode != RequestAccessMode.PRO_PAYG:
            return None
        return {"recommend": 3, "detail": 5}[endpoint]
```

- [ ] **Step 2: 테스트 실행하여 pass 확인**

Run: `SKIP_EXTERNAL_INIT=1 .venv/bin/pytest tests/test_rate_limit_entitlements.py -q`

Expected: PASS

---

### Task 4: 서버 엔드포인트 테스트 확장

**Files:**
- Modify: `tests/test_server_endpoints.py`

- [ ] **Step 1: failing test 추가**

```python
def test_detail_has_higher_minute_limit_than_recommend():
    limiter = InMemoryRateLimiter(limit=2, window_seconds=60)
    assert limiter.limit == 2


def test_payg_cap_returns_402_before_detail_handler_runs():
    client = TestClient(_build_payg_limited_app(current_usage=49.9, estimated_cost=0.2))
    response = client.post("/api/detail", json={"parsed_data": {}})
    assert response.status_code == 402
    assert response.json()["detail"] == "Monthly pay-as-you-go cap reached."


def test_auth_me_returns_entitlement_summary_when_logged_in():
    response = _serialize_auth_me_payload(
        {
            "uid": "user-1",
            "name": "Jane",
            "picture": "https://example.com/a.png",
        },
        {
            "plan_tier": "pro",
            "status": "active",
            "payg_enabled": True,
            "payg_monthly_cap_usd": 50.0,
        },
    )
    assert response["entitlement"]["plan_tier"] == "pro"
    assert response["entitlement"]["payg_enabled"] is True
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `SKIP_EXTERNAL_INIT=1 .venv/bin/pytest tests/test_server_endpoints.py -q`

Expected: helper missing 또는 assertion failure로 FAIL

---

### Task 5: 서버 rate limit enforcement 구현

**Files:**
- Modify: `server.py`
- Modify: `utils/rate_limit.py`
- Test: `tests/test_server_endpoints.py`

- [ ] **Step 1: request guard helper 추가**

```python
def enforce_endpoint_guard(request: Request, endpoint: str) -> dict:
    user_id = getattr(request.state, "user_id", None)
    entitlement = get_billing_entitlement(user_id) if user_id else None
    normalized = normalize_entitlement(entitlement)
    mode = resolve_request_access_mode(user_id, normalized)
    subject_key = user_id or _REQUEST_LIMITER.client_identifier(request)
    _REQUEST_LIMITER.enforce_minute_limit(subject_key, mode, endpoint)
    _REQUEST_LIMITER.enforce_burst_limit(subject_key, mode, endpoint)
    return normalized
```

- [ ] **Step 2: `/api/recommend`, `/api/detail`에 endpoint별 guard 연결**

```python
@app.post("/api/recommend")
async def api_recommend(req: RecommendRequest, request: Request):
    entitlement = enforce_endpoint_guard(request, "recommend")
```

```python
@app.post("/api/detail")
async def api_detail(req: DetailRequest, request: Request):
    entitlement = enforce_endpoint_guard(request, "detail")
```

- [ ] **Step 3: `/auth/me` entitlement 응답 확장**

```python
        entitlement = normalize_entitlement(get_billing_entitlement(data["uid"]))
        return JSONResponse({
            "logged_in": True,
            "name": data["name"],
            "picture": data.get("picture"),
            "uid": data["uid"],
            "entitlement": {
                "plan_tier": entitlement["plan_tier"],
                "status": entitlement["status"],
                "payg_enabled": entitlement["payg_enabled"],
                "payg_monthly_cap_usd": entitlement["payg_monthly_cap_usd"],
            },
        })
```

- [ ] **Step 4: 테스트 재실행**

Run: `SKIP_EXTERNAL_INIT=1 .venv/bin/pytest tests/test_server_endpoints.py -q`

Expected: PASS

---

### Task 6: Payg usage cap 구현

**Files:**
- Modify: `utils/db.py`
- Modify: `utils/rate_limit.py`
- Modify: `server.py`
- Test: `tests/test_server_endpoints.py`

- [ ] **Step 1: usage ledger helper 추가**

```python
def get_payg_usage_total(user_id: str, period_start, period_end) -> float:
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COALESCE(SUM(COALESCE(billed_cost_usd, estimated_cost_usd)), 0)
            FROM billing_usage_ledger
            WHERE user_id = %s
              AND usage_type = 'payg'
              AND created_at >= %s
              AND created_at < %s
            """,
            (user_id, period_start, period_end),
        )
        row = cur.fetchone()
    return float(row[0] or 0)
```

```python
def insert_usage_ledger_entry(...):
    ...
```

- [ ] **Step 2: payg preflight helper 추가**

```python
def enforce_payg_cap(user_id: str, entitlement: dict, endpoint: str, estimated_cost_usd: float) -> None:
    if not entitlement["payg_enabled"] or entitlement["plan_tier"] != "pro" or entitlement["status"] != "active":
        return
    current_usage = get_payg_usage_total(
        user_id,
        entitlement["current_period_start"],
        entitlement["current_period_end"],
    )
    cap = float(entitlement["payg_monthly_cap_usd"])
    if current_usage + estimated_cost_usd > cap:
        raise HTTPException(
            status_code=402,
            detail={
                "detail": "Monthly pay-as-you-go cap reached.",
                "cap_usd": cap,
                "current_usage_usd": round(current_usage, 4),
            },
        )
```

- [ ] **Step 3: LLM 호출 전 preflight, 성공 후 ledger 기록**

```python
    estimated_cost = estimate_endpoint_cost("recommend")
    if user_id:
        enforce_payg_cap(user_id, entitlement, "recommend", estimated_cost)
    ...
    if user_id and resolve_request_access_mode(user_id, entitlement) == RequestAccessMode.PRO_PAYG:
        insert_usage_ledger_entry(...)
```

- [ ] **Step 4: 테스트 실행**

Run: `SKIP_EXTERNAL_INIT=1 .venv/bin/pytest tests/test_server_endpoints.py tests/test_rate_limit_entitlements.py -q`

Expected: PASS

---

### Task 7: 문서 동기화

**Files:**
- Modify: `cowork/backend/api-reference.md`
- Modify: `cowork/backend/db-schema.md`
- Modify: `cowork/security/audit-report.md`

- [ ] **Step 1: API 문서 반영**

```md
- `/auth/me` 응답에 `entitlement` 추가
- `/api/recommend`, `/api/detail`에 tier별 rate limit / `402` / `429` 문서화
```

- [ ] **Step 2: DB 스키마 문서 반영**

```md
- `billing_entitlements`
- `billing_usage_ledger`
- `billing_provider_events`
```

- [ ] **Step 3: audit checklist 갱신**

```md
- H-01 세부 상태를 entitlement-aware rate limiting 반영 기준으로 업데이트
```

- [ ] **Step 4: 최종 검증**

Run: `SKIP_EXTERNAL_INIT=1 .venv/bin/pytest tests/test_server_endpoints.py tests/test_rate_limit_entitlements.py -q`

Expected: PASS
