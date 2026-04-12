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
