<!-- /autoplan restore point: /Users/yoroji/.gstack/projects/wingcraft-co-nnai/gstack-review-autoplan-restore-20260414-080707.md -->
# NNAI 수익화 구현 설계

> 작성일: 2026-04-13
> 상태: APPROVED
> 기반 문서: design-doc.md, bm-strategy.md

---

## Phase 1: Affiliate 인프라 (Week 1, Effort: S)

### 1-1. 숙소 딥링크에 Affiliate ID 추가

**파일:** `utils/accommodation.py`

```python
# 환경 변수에서 affiliate ID 로드
AFFILIATE_IDS = {
    "airbnb": os.getenv("AIRBNB_AFFILIATE_ID", ""),
    "booking": os.getenv("BOOKING_AFFILIATE_ID", ""),
    "flatio": os.getenv("FLATIO_AFFILIATE_ID", ""),
}

def build_deeplink(platform: str, city: str, ...) -> str:
    base_url = ...  # 기존 로직
    aid = AFFILIATE_IDS.get(platform, "")
    if aid:
        return f"{base_url}&{aid}"
    return base_url
```

### 1-2. Step 2에 "실행 가이드" 섹션

**파일:** `api/parser.py` — `format_step2_markdown()` 끝에 append

```python
def _build_action_guide(city: str, country_id: str) -> str:
    """도시별 affiliate 링크가 포함된 실행 가이드 마크다운 생성"""
    links = {
        "accommodation": build_deeplink("airbnb", city),
        "insurance": f"https://safetywing.com/?ref={os.getenv('SAFETYWING_AFFILIATE_ID', '')}",
        "esim": f"https://airalo.com/?ref={os.getenv('AIRALO_AFFILIATE_ID', '')}",
    }
    return f"""
---
## 실행 가이드

### 숙소
- [Airbnb에서 {city} 중기 숙소 검색]({links['accommodation']})

### 보험  
- [SafetyWing 노마드 보험]({links['insurance']}) — 월 $45~

### 통신
- [Airalo eSIM]({links['esim']}) — {country_id} 현지 데이터
"""
```

### 1-3. AdModule 실제 파트너 연결

**파일:** `frontend/src/components/ad/ad-data.ts` — 더미 데이터를 실제 파트너 정보로 교체
**파일:** `frontend/src/components/ad/AdModule.tsx` — 추천 도시 context에 따른 동적 광고

### 1-4. 클릭 추적

**파일:** `frontend/src/lib/analytics.ts` (신규)

```typescript
export function trackAffiliateClick(partner: string, city: string, countryId: string) {
  // GA4 event
  if (typeof gtag !== "undefined") {
    gtag("event", "affiliate_click", {
      partner,
      city,
      country_id: countryId,
    });
  }
}
```

**DB (선택):** `utils/db.py`에 affiliate_clicks 테이블

```sql
CREATE TABLE IF NOT EXISTS affiliate_clicks (
    id SERIAL PRIMARY KEY,
    user_id TEXT,
    partner TEXT NOT NULL,
    city TEXT,
    country_id TEXT,
    clicked_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Phase 2: Freemium Gate (Week 2, Effort: M)

### 2-1. Stripe 연동

**파일:** `api/billing.py` (신규)

```python
import stripe
from fastapi import APIRouter

router = APIRouter(prefix="/api/billing")

@router.post("/checkout")
async def create_checkout(user=Depends(get_current_user)):
    session = stripe.checkout.Session.create(
        customer_email=user.email,
        line_items=[{"price": os.getenv("STRIPE_PRICE_ID"), "quantity": 1}],
        mode="subscription",
        success_url=f"{os.getenv('FRONTEND_URL')}/result?upgraded=true",
        cancel_url=f"{os.getenv('FRONTEND_URL')}/result",
    )
    return {"checkout_url": session.url}

@router.post("/webhook")
async def stripe_webhook(request: Request):
    # checkout.session.completed → users.subscription_tier = 'pro'
    # customer.subscription.deleted → users.subscription_tier = 'free'
    ...

@router.get("/status")
async def billing_status(user=Depends(get_current_user)):
    return {"tier": user.subscription_tier, "usage_this_month": get_monthly_usage(user.id)}
```

### 2-2. DB 변경

**파일:** `utils/db.py`, `migrations/006_subscription.sql`

```sql
ALTER TABLE users ADD COLUMN subscription_tier TEXT DEFAULT 'free';
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN detail_usage_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN usage_reset_at TIMESTAMPTZ DEFAULT NOW();
```

### 2-3. Step 2 게이팅

**파일:** `server.py` — `/api/detail` 수정

```python
@app.post("/api/detail")
async def api_detail(req: DetailRequest, request: Request):
    user = get_user_from_session(request)
    if user and user.subscription_tier == "free":
        usage = get_monthly_usage(user.id)
        if usage >= 2:
            return JSONResponse(status_code=402, content={
                "error": "free_limit",
                "upgrade_url": "/api/billing/checkout"
            })
    # 기존 로직...
```

### 2-4. 프론트엔드 페이월

**파일:** `frontend/src/components/Paywall.tsx` (신규)

- 402 응답 인터셉트 → 모달 표시
- 타로 테마: "당신의 완전한 리딩을 열어보세요"
- Stripe Checkout URL로 리다이렉트

---

## 환경 변수 추가

```bash
# Affiliate (Railway)
AIRBNB_AFFILIATE_ID=
BOOKING_AFFILIATE_ID=
FLATIO_AFFILIATE_ID=
SAFETYWING_AFFILIATE_ID=
AIRALO_AFFILIATE_ID=

# Stripe (Railway)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=

# Stripe (Vercel)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

---

## cowork 문서 업데이트 체크리스트

Phase 1 완료 시:
- [ ] `cowork/backend/api-reference.md` — affiliate 관련 변경 없음 (백엔드 API 변경 없음)
- [ ] `cowork/backend/db-schema.md` — affiliate_clicks 테이블 추가

Phase 2 완료 시:
- [ ] `cowork/backend/api-reference.md` — /api/billing/* 3개 엔드포인트 추가
- [ ] `cowork/backend/db-schema.md` — users 테이블 subscription 컬럼 추가

---

## AUTOPLAN REVIEW (2026-04-14)

### Phase 0 Intake
- Base branch: develop
- Plan target: cowork/marketing/implementation-plan.md
- UI scope: YES (Paywall, AdModule, result flow)
- DX scope: YES (billing endpoints, proxy contract, webhook lifecycle)
- Premise gate: PASSED
  - 사용자 확정: 결제 플랫폼은 Polar 검토/기준으로 진행

### Step 0A Premise Challenge
1. 수요 검증 없이 결제를 먼저 도입하면 학습보다 운영부채가 커질 위험이 큼.
2. Step 2 완전 차단은 전환 검증보다 가치 인식 자체를 저해할 수 있음.
3. 결제 플랫폼 제약(국가/정산/세금)을 구현 전에 고정해야 재작업을 줄일 수 있음.

### Step 0B What Already Exists
- api/parser.py::format_step2_markdown()에 숙소/커뮤니티 섹션이 이미 존재
- utils/accommodation.py::get_accommodation_links()로 기존 딥링크 매핑 존재
- server.py는 request.state.user_id 기반 인증 컨텍스트 구조
- frontend/src/app/[locale]/result/page.tsx는 /api/recommend,/api/reveal 중심 플로우
- frontend/src/app/api/detail/route.ts는 non-2xx body를 일반화해 402 payload 유실 위험

### Step 0C-bis Implementation Alternatives
| Approach | Summary | Effort | Risk | Pros | Cons |
|---|---|---|---|---|---|
| A. Quick Revenue Patch | 기존 /api/detail 게이트 + 즉시 paywall | S | High | 빠른 배포 | 실제 사용자 플로우와 불일치 |
| B. Flow-Aligned Monetization (선택) | result 플로우 기준 preview+gate 재정의 + billing 계약 명시 | M | Med | 퍼널 정합성/계측 가능성 | 초기 설계 시간 증가 |
| C. Demand-First | affiliate+계측 선행, 결제는 플랫폼 확정 후 | S-M | Low | 리스크 최소 | 단기 현금화 지연 |

Recommendation: B

### Step 0D Mode Selection
- Mode: SELECTIVE_EXPANSION

### Step 0E Temporal Interrogation
- HOUR1: 실제 과금 대상 플로우 확정
- HOUR2-3: entitlement 모델(웹훅 idempotency + stale 복구) 확정
- HOUR4-5: 프록시 402 payload 보존 + 모달 상태기계 연결
- HOUR6+: 이벤트 taxonomy + cowork 문서 동기화

## Phase 1 CEO Review

### CEO DUAL VOICES — CONSENSUS TABLE
| Dimension | Claude | Codex | Consensus |
|---|---|---|---|
| Premises valid? | N/A | 전제 challenge | DISAGREE |
| Right problem? | N/A | demand-before-monetization 경고 | DISAGREE |
| Scope calibration? | N/A | paywall timing 과격 | DISAGREE |
| Alternatives explored? | N/A | subscription 외 대안 부족 | DISAGREE |
| Competitive risks covered? | N/A | moat 과대평가 지적 | DISAGREE |
| 6-month trajectory sound? | N/A | 계측/신뢰/유지전략 부족 | DISAGREE |

- Voice source: codex-only (subagent unavailable in current execution constraints)

### Error & Rescue Registry
| Method/Path | What Can Go Wrong | Rescue Action | User Sees |
|---|---|---|---|
| POST /api/billing/checkout | 미인증/세션만료 | 401 + login hint | 로그인 후 계속 |
| POST /api/billing/webhook | signature 불일치 | 400 + audit log | 사용자 영향 없음 |
| entitlement check | webhook 지연 | status recheck/polling | 결제 확인 중 안내 |
| detail gate | free_limit + payload 누락 | proxy/body passthrough | paywall modal |
| affiliate link build | ID/링크 없음 | 링크 숨김/대체문구 | 깨진 링크 대신 안내 |

### Failure Modes Registry
| Failure Mode | Covered by Test? | Error Handling? | Silent Failure Risk |
|---|---|---|---|
| /api/detail 미호출 상태 게이트 무의미 | No (current) | No | Critical |
| Next proxy가 402 body 삭제 | No (current) | Partial | Critical |
| webhook 중복 처리로 tier 오염 | Planned | Planned | Medium |
| affiliate 링크 무효/미승인 | Planned | Planned | Low |

### NOT in Scope (CEO)
- 장기 마켓플레이스/CAL.com 연동
- B2B API 상품화

## Phase 2 Design Review (UI scope: yes)

### Design Litmus Scorecard
| Dimension | Claude | Codex | Consensus |
|---|---|---|---|
| Information hierarchy | N/A | developer-centered 지적 | DISAGREE |
| State coverage | N/A | loading/empty/error/partial 공백 | DISAGREE |
| User journey continuity | N/A | core value gate 타이밍 위험 | DISAGREE |
| Specificity vs generic | N/A | 파일체크리스트 중심 | DISAGREE |
| Design system alignment | N/A | 구체성 부족 | DISAGREE |
| Responsive strategy | N/A | 모바일 전략 공백 | DISAGREE |
| Accessibility | N/A | keyboard/focus/contrast 미정 | DISAGREE |

### Design Pass Scores
| Pass | Before | After |
|---|---:|---:|
| Info Architecture | 4 | 7 |
| Interaction States | 3 | 8 |
| Emotional Arc | 5 | 7 |
| AI Slop Risk | 6 | 8 |
| Design System Alignment | 5 | 7 |
| Responsive/A11y | 2 | 7 |
| Unresolved Decisions | 3 | 8 |

### Required Design Decisions Added
- 무료 사용자 상세 미리보기 깊이 고정
- paywall 모바일 동작(스크롤잠금/포커스트랩/escape) 명시
- 401/402/403 상태별 카피+CTA 분리

## Phase 3 Eng Review

### ENG DUAL VOICES — CONSENSUS TABLE
| Dimension | Claude | Codex | Consensus |
|---|---|---|---|
| Architecture sound? | N/A | gate target mismatch | DISAGREE |
| Test coverage sufficient? | N/A | gap 큼 | DISAGREE |
| Performance risks addressed? | N/A | 부분 | PARTIAL |
| Security threats covered? | N/A | webhook/auth 경계 미정 | DISAGREE |
| Error paths handled? | N/A | proxy+billing 계약 미흡 | DISAGREE |
| Deployment risk manageable? | N/A | schema 소스 분산 위험 | DISAGREE |

### Architecture ASCII Diagram

Frontend Result Page
   | (recommend/reveal)
   v
Next API Proxy (/api/detail?) ---> FastAPI /api/detail(or /api/result-detail)
   |                                  |
   |<-- 402/403 + structured payload -|
   |
Paywall Modal -> /api/billing/checkout -> Polar Checkout
                                  |
                                  v
                           /api/billing/webhook
                                  |
                                  v
                           entitlement ledger/status

### Test Diagram (codepaths -> coverage)
- result/page.tsx CTA -> detail call: GAP
- frontend/api/detail/route.ts non-2xx payload passthrough: GAP
- /api/billing/checkout auth fail/success: GAP
- /api/billing/webhook signature/idempotency: GAP
- entitlement stale recovery path: GAP
- affiliate fallback(no id/no link): GAP

### Test Plan Artifact
- Written: /Users/yoroji/.gstack/projects/wingcraft-co-nnai/yoroji-gstack-review-eng-review-test-plan-20260414-082105.md

### NOT in Scope (Eng)
- full migration framework 교체

## Phase 3.5 DX Review (DX scope: yes)

### DX DUAL VOICES — CONSENSUS TABLE
| Dimension | Claude | Codex | Consensus |
|---|---|---|---|
| Getting started <5 min? | N/A | no | DISAGREE |
| API naming guessable? | N/A | partial | PARTIAL |
| Error messages actionable? | N/A | no | DISAGREE |
| Docs complete? | N/A | no | DISAGREE |
| Upgrade path safe? | N/A | no | DISAGREE |
| Dev env friction-free? | N/A | no | DISAGREE |

### Developer Journey Map (9-stage)
| Stage | Current | Friction |
|---|---|---|
| Discover | 문서 분산 | billing 결정 지연 |
| Install | backend/frontend 동시 이해 | 경로 복잡 |
| First call | recommend/reveal 쉬움 | detail gate 경로 불명확 |
| Integrate paywall | proxy/body 손실 | 상태 계약 미정 |
| Checkout | 플랫폼 미확정 | API shape 불명확 |
| Webhook | 멱등/지연 처리 미정 | 운영 위험 |
| Verify entitlement | 상태조회 계약 미정 | 디버깅 난이도 |
| Rollback | 부분 롤백 설계 없음 | 배포 리스크 |
| Observe | 이벤트 taxonomy 부족 | 학습 불가 |

### DX Scorecard
| Dimension | Score |
|---|---:|
| Getting Started | 4 |
| API/Contract Clarity | 5 |
| Error UX | 4 |
| Docs IA | 5 |
| Upgrade/Migration | 4 |
| Tooling/Env | 5 |
| Community/Extensibility | 5 |
| Measurement Loop | 3 |
| Overall | 4.4/10 |

### DX Implementation Checklist
- [ ] Polar checkout/webhook/status endpoint 계약 확정
- [ ] detail gate 대상 플로우 재정의 (result flow aligned)
- [ ] Next proxy 402/403 body passthrough
- [ ] billing error schema(problem/cause/fix) 문서화
- [ ] 이벤트 taxonomy(view_limit_hit, paywall_shown, checkout_started, checkout_completed, entitlement_refreshed)

## Cross-Phase Themes
1. Flow mismatch: 과금 지점과 실제 사용자 플로우 불일치
2. Contract ambiguity: 상태코드/오류payload/entitlement lifecycle 공백
3. Measurement gap: 수익화 판단용 계측 설계 부족

## Decision Audit Trail
| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---:|---|---|---|---|---|---|
| 1 | CEO | Mode=SELECTIVE_EXPANSION | Mechanical | P1,P2 | blast radius 내 완결도 | HOLD/SCOPE REDUCTION |
| 2 | CEO | 계측 선행 확장 수용 | Taste | P1,P3 | 수요 검증 없는 과금 리스크 완화 | 즉시 과금 우선 |
| 3 | CEO | 결제 전제 Polar 반영 | User Challenge resolved | User input | 사용자 최신 의사결정 반영 | Stripe 고정 |
| 4 | Design | hard gate only 대신 preview+upsell | Taste | P1,P5 | 신뢰/전환 균형 | 완전차단 |
| 5 | Design | 모바일/a11y 상태 표 필수화 | Mechanical | P1 | 구현자 임의 해석 방지 | 임기응변 |
| 6 | Eng | 게이팅 endpoint를 result flow 기준으로 재정의 | Mechanical | P5 | /api/detail 단독 게이트 무효 가능 | 기존안 |
| 7 | Eng | proxy non-2xx body passthrough | Mechanical | P1,P5 | paywall payload 보존 필수 | generic wrapping |
| 8 | Eng | entitlement ledger 모델 요구 | Taste | P1,P3 | webhook 순서/중복 안전성 | users counter 단일컬럼 |
| 9 | DX | 이벤트 taxonomy 도입 | Mechanical | P1 | 학습 가능한 퍼널 확보 | affiliate_click 단일 |
| 10 | DX | 실행순서 기반 docs 재편 | Mechanical | P5 | TTHW 단축 | 파일 나열형 |

## Deferred to TODOS.md
- [ ] Polar 운영 정책(정산/환불/세금) 문서화
- [ ] paywall copy A/B test 실험안
- [ ] provider abstraction(Polar 외 공급자) 인터페이스
- [ ] 모바일 결과 플로우 E2E 자동화

