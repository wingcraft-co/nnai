# Rate Limit Entitlements Design

Date: 2026-04-15
Status: Draft for review
Scope: Backend entitlement model, rate limiting, pay-as-you-go guardrails

## Goal

Introduce a billing-aware entitlement layer so rate limiting can distinguish among:

- anonymous users
- logged-in free users
- logged-in pro users
- pro users with pay-as-you-go enabled

The design must allow heavier paid usage without exposing the service to unbounded LLM cost. A pro user with pay-as-you-go enabled may bypass per-minute rate limits, but only within a hard monthly cap of 50 USD and with burst protection still enforced.

## Non-Goals

- Full billing provider implementation
- Checkout UI or webhook implementation details beyond data contracts
- Mobile-specific entitlement behavior
- Historical invoicing or tax reporting

## Current Problem

The current limiter is a single IP-based in-memory guard for `/api/recommend` and `/api/detail`. That is enough to stop anonymous abuse, but it does not support:

- different limits per endpoint
- different limits per account tier
- user-based limits for logged-in accounts
- pay-as-you-go access with a hard spend cap
- billing-safe reconciliation and audit history

## Requirements

### Functional

1. The backend must classify requests into one of four effective access modes:
   - `anonymous`
   - `free`
   - `pro`
   - `pro_payg`
2. `/api/recommend` and `/api/detail` must use separate policies.
3. Anonymous users must be limited by client IP.
4. Logged-in users must be limited by `user_id`.
5. Pro users with pay-as-you-go enabled and active entitlement must bypass per-minute rate limits.
6. Pay-as-you-go users must still be protected by endpoint-level burst caps.
7. Pay-as-you-go monthly usage must never exceed 50 USD.
8. If the cap would be exceeded, the request must be blocked before the LLM call.
9. Cap exhaustion must return `402 Payment Required` with structured details.
10. The system must store enough entitlement and usage data to support future billing provider integration.

### Non-Functional

1. Existing anonymous and logged-in recommendation flows must continue to work.
2. The design must be implementable incrementally without shipping checkout first.
3. Fail-closed behavior is preferred for billing ambiguity.
4. The data model must be auditable and idempotent for future webhook processing.

## Approaches Considered

### Approach A: Extend `users` only

Store plan and pay-as-you-go flags directly on `users`.

Pros:
- smallest immediate patch
- simple reads during request handling

Cons:
- mixes profile identity with entitlement state
- poor fit for provider webhooks and billing lifecycle
- hard to audit usage and status transitions cleanly

### Approach B: `users` plus single usage counter table

Keep entitlement flags on `users`, add a monthly usage table.

Pros:
- moderate implementation cost
- enough to gate monthly spend

Cons:
- still weak for lifecycle modeling
- status transitions and provider event idempotency stay awkward
- insufficient audit trail for cost disputes

### Approach C: Separate entitlement and ledger tables

Keep `users` for identity only. Add dedicated billing entitlement, usage ledger, and provider event tables.

Pros:
- clear separation of concerns
- billing-safe model for future checkout/webhook integration
- auditability for monthly cap decisions
- supports burst guard plus spend guard cleanly

Cons:
- largest schema change
- more request-time reads and bookkeeping

### Recommendation

Use Approach C.

This is the only option that cleanly supports `pro + payg` behavior without repainting the schema again when billing is implemented for real. The extra schema cost is justified because spend caps, webhook idempotency, and entitlement state are not profile concerns.

## Data Model

### Existing Table: `users`

Keep `users` focused on identity and session-related profile data. Do not store billing truth here beyond optional denormalized display fields in the future.

### New Table: `billing_entitlements`

Single active entitlement row per user.

```sql
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
```

Semantics:

- `plan_tier='free'` means authenticated free plan
- `plan_tier='pro'` means paid plan
- `payg_enabled=true` is only effective when `plan_tier='pro'` and `status='active'`
- `payg_monthly_cap_usd` defaults to `50.00`

### New Table: `billing_usage_ledger`

Append-only record of cost-bearing requests.

```sql
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
```

Semantics:

- `estimated_cost_usd` is used for preflight cap enforcement and early accounting
- `billed_cost_usd` can be filled later if provider-side actuals differ
- `request_key` provides idempotency for retries and duplicate writes

### New Table: `billing_provider_events`

Tracks processed provider webhooks for idempotency and audit.

```sql
CREATE TABLE IF NOT EXISTS billing_provider_events (
    id              BIGSERIAL PRIMARY KEY,
    provider        TEXT NOT NULL,
    event_id        TEXT NOT NULL,
    payload_digest  TEXT NOT NULL,
    processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, event_id)
);
```

## Runtime Entitlement Resolution

Each request resolves into one effective access mode:

1. No logged-in user:
   - mode = `anonymous`
   - subject key = client IP
2. Logged-in user with no entitlement row:
   - mode = `free`
   - subject key = `user_id`
3. Logged-in user with `plan_tier='free'`:
   - mode = `free`
   - subject key = `user_id`
4. Logged-in user with `plan_tier='pro'` and `status='active'` and `payg_enabled=false`:
   - mode = `pro`
   - subject key = `user_id`
5. Logged-in user with `plan_tier='pro'` and `status='active'` and `payg_enabled=true`:
   - mode = `pro_payg`
   - subject key = `user_id`
6. Any non-active pro entitlement:
   - degrade to `free`

Fail-closed rule:

- If entitlement lookup fails unexpectedly for a logged-in user, degrade to `free` limits and do not grant payg bypass.

## Rate Limit Policy

### Minute-Level Limits

Separate minute buckets by endpoint.

| Mode | `/api/recommend` | `/api/detail` |
|---|---:|---:|
| `anonymous` | 5/min | 10/min |
| `free` | 10/min | 20/min |
| `pro` | 30/min | 60/min |
| `pro_payg` | bypass | bypass |

Implementation rules:

- anonymous bucket key uses IP
- authenticated bucket key uses `user_id`
- `/api/recommend` and `/api/detail` never share the same minute bucket

### Burst Guard

Pay-as-you-go users bypass minute caps but still keep burst protection.

| Mode | `/api/recommend` | `/api/detail` |
|---|---:|---:|
| `pro_payg` | 3 requests/sec | 5 requests/sec |

Burst guard exists to prevent:

- accidental infinite loops from the client
- concurrent request floods from a single account
- sudden LLM cost spikes before monthly cap accounting catches up

The burst guard may also be reused for non-payg users later, but that is not required in this phase.

## Monthly Spend Cap

### Rule

Hard cap: `50.00 USD` per billing period for pay-as-you-go usage.

### Enforcement

Before running an LLM call for a `pro_payg` request:

1. Resolve the user entitlement row.
2. Sum this period's payg usage from `billing_usage_ledger`.
3. Estimate the request cost.
4. If `current_usage + estimated_cost > payg_monthly_cap_usd`, reject before the upstream LLM call.
5. Otherwise proceed and append a ledger row.

### Response Contract

Cap exhaustion returns `402 Payment Required`.

```json
{
  "detail": "Monthly pay-as-you-go cap reached.",
  "cap_usd": 50.0,
  "current_usage_usd": 49.82
}
```

Rationale:

- This is not a generic rate-limit event.
- The caller is blocked by payment policy, not by short-term traffic shaping.

## Cost Accounting Strategy

Initial implementation uses estimated cost accounting.

Request path:

1. Build a request key.
2. Estimate request cost from endpoint-specific heuristics.
3. Preflight against current period total.
4. If allowed, execute the LLM call.
5. Write a ledger row with `estimated_cost_usd`.

Future provider reconciliation:

- if exact billed amounts become available, update `billed_cost_usd`
- reporting prefers `billed_cost_usd` when present, otherwise falls back to `estimated_cost_usd`

This lets the system ship the protection layer before provider-side exact billing is integrated.

## API Impact

### `/auth/me`

Extend response for logged-in users with entitlement summary:

```json
{
  "logged_in": true,
  "uid": "user_123",
  "name": "Jane",
  "picture": "https://...",
  "entitlement": {
    "plan_tier": "pro",
    "status": "active",
    "payg_enabled": true,
    "payg_monthly_cap_usd": 50.0
  }
}
```

If no entitlement row exists, return a normalized free entitlement summary.

### `/api/recommend` and `/api/detail`

New documented failure modes:

- `429 Too Many Requests`
  - minute limit exceeded
  - burst guard exceeded
- `402 Payment Required`
  - pay-as-you-go monthly cap reached

The frontend should distinguish these cases:

- `429`: wait and retry later
- `402`: show billing/payg cap messaging

## Documentation Tracking

Security remediation work tracked from this design must also update:

- `cowork/security/audit-report.md`

Rule:

- add or maintain a remediation checklist in the audit report
- only mark an item complete when the code change is actually reflected
- documentation-only updates do not count as remediation complete
- items intentionally excluded from current scope should remain visible and be labeled as deferred or excluded

## Error Handling

### Rate Limit Exceeded

Return `429`:

```json
{
  "detail": "Too many requests. Please retry later."
}
```

### Payg Cap Reached

Return `402`:

```json
{
  "detail": "Monthly pay-as-you-go cap reached.",
  "cap_usd": 50.0,
  "current_usage_usd": 49.82
}
```

### Invalid or Inactive Entitlement

Degrade to free behavior instead of granting elevated access.

## Testing Strategy

### Unit Tests

- entitlement resolution for anonymous/free/pro/pro_payg
- minute bucket selection by endpoint
- user-based vs IP-based keying
- burst guard behavior for payg
- cap preflight rejection at 50 USD boundary
- inactive entitlement fallback to free

### Integration Tests

- `/api/recommend` and `/api/detail` return `429` for the correct buckets
- payg users bypass minute caps but hit burst caps
- payg users receive `402` before LLM execution when cap is exceeded
- `/auth/me` returns normalized entitlement summary

### Regression

- existing recommendation flow still returns success for normal requests
- non-payg pro users still use higher finite limits

## Migration Plan

1. Add new tables in `utils/db.py` DDL.
2. Backfill logged-in users implicitly as free when no entitlement row exists.
3. Update request middleware or helper layer to resolve entitlement per request.
4. Replace the current single limiter with policy-driven endpoint-specific limiting.
5. Add spend-cap preflight for `pro_payg`.
6. Extend `/auth/me`.
7. Update API and DB schema docs.

## Risks

### Cost Estimation Drift

Estimated request cost may differ from provider-billed cost.

Mitigation:

- store both estimated and billed amounts
- default to conservative estimates in early phase

### Concurrency Around Cap Checks

Two concurrent payg requests could pass the cap check before either ledger row is written.

Mitigation:

- use transactional checks plus insert
- consider row-level locking on entitlement state during payg preflight

### Abuse Beyond Minute Limits

Minute caps alone are too slow to stop bursts.

Mitigation:

- explicit burst guard for payg
- ability to extend burst guard to other tiers later

## Open Implementation Decisions

These are intentionally narrowed, not left ambiguous:

- billing provider remains undecided; schema must stay provider-neutral
- exact cost estimator formula is a separate implementation concern, but the ledger contract is fixed
- entitlement lookup should be centralized so all future paid endpoints can reuse it

## Decision Summary

Implement a provider-neutral entitlement layer with:

- separate `billing_entitlements` table
- append-only `billing_usage_ledger`
- idempotent `billing_provider_events`
- endpoint-specific minute rate limits
- payg minute-limit bypass with burst guard
- hard monthly payg cap of 50 USD
- `402 Payment Required` for cap exhaustion

This keeps anonymous abuse under control, gives paid users materially better throughput, and prevents pay-as-you-go from becoming an unbounded liability.
