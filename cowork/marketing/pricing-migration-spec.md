# Pricing Migration Spec — 단건 결제 전환

_Last updated: 2026-05-24_
_Status: 구현 준비_
_관련 문서: `paid-report-phase1-spec.md` §9_

## 0. UI 가격 표시 가이드 (확정)

```
─────────────────────
   ~~$4.99~~  →  $2.99
   Launch Sale · 40% OFF
─────────────────────
```

- 정가 `$4.99`에 취소선
- 할인가 `$2.99`를 primary 색상 + 크게 강조
- 라벨 "Launch Sale" 또는 "런칭 특가 · 40% OFF" — i18n별 카피:
  - ko: `런칭 특가 · 40% 할인`
  - en: `Launch Sale · 40% OFF`
- 결제 페이지·가격 페이지·가이드 페이지 결제 유도 카드 모두 동일 포맷

상수 정의 (`frontend/src/lib/pricing-content.ts`):

```ts
export const REPORT_PRICE = {
  list_usd: 4.99,
  sale_usd: 2.99,
  discount_label_ko: "런칭 특가 · 40% 할인",
  discount_label_en: "Launch Sale · 40% OFF",
} as const;
```

---

## 1. 정책 요약

| 항목 | 값 |
|------|-----|
| 요금 모델 | **단건 결제** (구독·플랜 폐지) |
| 정가 | **USD 4.99 / 도시 1개 보고서** |
| 런칭 할인가 | **USD 2.99** (UI에 정가 취소선 + "Launch Sale · 40% OFF" 라벨) |
| 결제 후 권한 | **영구 보관** (`library_guides` 테이블) |
| 무료 권한 | Step 1 무제한 + **무료 보고서 1개 도시** (워터마크, 풀콘텐츠) |
| Polar 구조 | 단일 product + `city_id` metadata. **실제 결제 금액은 $2.99** |
| 무료 보고서 추적 | `users.free_report_city_id` 컬럼 (NULL이면 미사용, 도시 ID면 사용 완료) |
| LLM 분기 | **없음** — 무료/유료 동일 콘텐츠, 워터마크·다운로드 잠금만 프론트 분기 |

---

## 2. 변경 범위

### 2.1 Backend

| 파일 | 작업 | Breaking |
|------|------|----------|
| `utils/db.py` | `users` 테이블에 `free_report_city_id TEXT` 컬럼 추가. `billing_entitlements.plan_tier`는 deprecated (테이블 유지, 코드에서 무시) | No (additive) |
| `api/billing.py` | Polar webhook → `library_guides` 에 `city_id` unlock 기록 (`is_free=false`). `billing_entitlements` 갱신 로직 제거 | Yes |
| `api/auth.py` | `/auth/me` 응답에서 `entitlement.plan_tier` 제거. `free_report_city_id: string \| null` 추가 | Yes |
| `server.py` `/api/detail` | 권한 가드 변경: 결제(library_guides) → 풀버전 / `free_report_city_id`와 일치 → 풀버전 (프론트가 워터마크) / 무료 미사용자 → 자동 부여 + 풀버전 / 이미 무료 사용 + 미결제 다른 도시 → `402` | Yes |
| `server.py` `/api/recommend` | rate limit 등급 분기 제거. 단일 정책 (인증 사용자 / IP 익명) | Yes |
| `utils/rate_limit.py` | `plan_tier` 기반 분기 제거. 단순 2단계 (anonymous / authenticated) | Yes |
| `api/dashboard.py` | Pro 전용 대시보드 → 보관함 통계로 재정의 또는 폐지 | TBD |

**핵심 설계 변경**: LLM 콘텐츠 분기 없음. 무료/유료는 **백엔드에서 권한 체크 + 응답에 `is_free` 플래그**만 다름. 프론트엔드가 `is_free=true`면 워터마크 + 다운로드 잠금.

### 2.2 Frontend

| 파일 | 작업 |
|------|------|
| `frontend/src/lib/pricing-content.ts` | free/pro 비교 표 → "보고서당 ~~$4.99~~ → **$2.99** (Launch Sale)" 단순 카드로 교체 |
| `frontend/src/app/[locale]/pricing/page.tsx` | 가격 페이지 레이아웃 단순화 (1열 카드 + FAQ) |
| `frontend/src/app/[locale]/pay/page.tsx` | "Pro 구독" 카피 → "이 도시 맞춤 보고서 구매" + city_id 표시 |
| `frontend/src/app/api/billing/checkout/route.ts` | `city_id` 파라미터 받아 Polar checkout URL에 metadata로 전달 |
| `frontend/src/components/pay/PolarCheckoutButton.tsx` | city_id prop 추가 |
| `frontend/src/app/[locale]/guide/[city_id]/page.tsx` | 결제 가드 변경: `preview_used`인 경우 워터마크 모드, 결제 완료면 풀 보고서 |
| `frontend/src/components/guide/BriefingPngPreview.tsx` (또는 `CountryBriefingDocument.tsx`) | preview 모드 props 추가 + 워터마크 오버레이 |
| `frontend/src/lib/billing-return.ts` | entitlement 응답 형식 변경 반영 |
| `frontend/src/lib/dashboard-content.ts` | Dashboard 정책에 맞춰 수정 |
| `frontend/src/lib/account-menu.ts` | Pro 배지 등 제거 |

### 2.3 Polar 대시보드

- 기존 Pro 구독 product 비활성화 (사용자 없으므로 안전)
- 신규 1회성 product 생성: "NomadNavigator AI · 맞춤 보고서"
  - 정가 표시: USD 4.99
  - **실제 결제 금액: USD 2.99 (Polar discount 또는 product price 자체를 $2.99로 설정)**
  - 결제 시 metadata로 `city_id`, `user_id` 전달받음
  - 할인 표시 방식 선택지:
    - (a) Polar product 가격을 $2.99로 고정, 정가 $4.99는 UI에서만 표시
    - (b) Polar product 가격을 $4.99로 두고 coupon code `LAUNCH40` 자동 적용
  - 권장: **(a)** — 단순하고 webhook 처리 명확
- Webhook URL: `https://api.nnai.app/api/billing/webhook` (기존)

### 2.4 환경 변수

| 변수 | 변경 |
|------|------|
| `POLAR_CHECKOUT_URL` | 신규 product URL로 교체 |
| `NEXT_PUBLIC_POLAR_CHECKOUT_URL` | 동일 |
| `POLAR_PRO_PRICE_ID` 등 plan 관련 변수 | 제거 |

---

## 3. DB 스키마 변경

### 3.1 users 테이블 (additive)

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS free_report_city_id TEXT,
  ADD COLUMN IF NOT EXISTS free_report_used_at TIMESTAMPTZ;
```

- `free_report_city_id IS NULL` → 무료 보고서 미사용
- `free_report_city_id = 'lisbon'` → 리스본 보고서를 무료로 받음 (재사용 불가)
- 사용자는 본인이 무료로 받았던 도시 보고서를 보관함에서 영구 열람 가능 (워터마크 유지)
- 같은 도시를 결제하면 `library_guides`에 `is_free=false` 행이 추가되어 워터마크 제거됨

### 3.2 library_guides 테이블

기존 테이블에 `is_free BOOLEAN DEFAULT FALSE` 컬럼 추가 (additive):

```sql
ALTER TABLE library_guides
  ADD COLUMN IF NOT EXISTS is_free BOOLEAN NOT NULL DEFAULT FALSE;
```

- `is_free=true` → 무료 부여된 보고서 (프론트가 워터마크 표시)
- `is_free=false` → 결제 완료 보고서 (워터마크 없음)
- 같은 user_id × city_id 조합에 두 행이 공존 가능 — UI는 결제(`is_free=false`) 우선 표시

### 3.3 billing_entitlements (deprecated)

- 테이블 유지 (과거 데이터 보존)
- 신규 INSERT/UPDATE 중단
- `/auth/me` 응답에서 `entitlement` 필드 제거
- `cowork/backend/db-schema.md` 에 deprecated 명시

---

## 4. 결제·무료 부여 흐름 (After)

```
1. 사용자가 가이드 페이지 진입 (city_id = lisbon)
   ↓
2. /auth/me + library 상태 확인
   ┌─ logged_in=false → 로그인 유도
   ├─ library_guides에 lisbon 있고 is_free=false → 풀 보고서 (워터마크 없음)
   ├─ library_guides에 lisbon 있고 is_free=true → 풀 보고서 (워터마크)
   ├─ free_report_city_id IS NULL → 자동으로 lisbon을 무료 도시로 기록 + 풀 보고서 (워터마크)
   └─ free_report_city_id != lisbon AND library_guides에 없음 → 결제 페이지로
   ↓
3. 결제 페이지 (`/pay?city_id=lisbon`)
   - 정가 $4.99 취소선 + 할인가 $2.99 표시
   ↓
4. Polar checkout 세션 생성
   - metadata: { city_id: "lisbon", user_id: "uid_xxx" }
   - amount: $2.99
   ↓
5. Polar 결제 완료 → Webhook → /api/billing/webhook
   ↓
6. library_guides 에 (user_id, lisbon, is_free=false) INSERT (idempotent)
   ↓
7. 사용자 가이드 페이지 복귀 → 워터마크 제거된 풀 보고서
```

**Idempotency**: 무료로 받은 도시를 나중에 결제하면 동일 row의 `is_free`를 false로 UPDATE하거나, 별도 row INSERT 후 우선순위 처리.

---

## 5. /auth/me 응답 변경

### Before
```json
{
  "logged_in": true,
  "uid": "abc",
  "name": "...",
  "picture": "...",
  "entitlement": {
    "plan_tier": "pro",
    "status": "active",
    "payg_enabled": false,
    "payg_monthly_cap_usd": 50
  }
}
```

### After
```json
{
  "logged_in": true,
  "uid": "abc",
  "name": "...",
  "picture": "...",
  "free_report_city_id": "lisbon",
  "library": [
    { "city_id": "lisbon", "is_free": true },
    { "city_id": "bangkok", "is_free": false }
  ]
}
```

- `free_report_city_id`: 무료 부여 도시 (없으면 `null`)
- `library`: 보유한 모든 보고서 목록 + 워터마크 여부
- `entitlement` 필드는 응답에서 제거 (또는 하위 호환을 위해 `entitlement: null` 유지)

---

## 6. /api/detail 권한 가드

### Before
```python
# rate limit + payg cap 체크
# free 사용자는 무제한 호출 (LLM 비용 무관)
```

### After
```python
async def detail_handler(req):
    user_id = get_user_id(req)
    city_id = req.body.city_id  # 신규 필수 필드

    if not user_id:
        return JSONResponse({"detail": "Login required"}, status_code=401)

    # 1. 이 도시의 보고서가 이미 library에 있음 (무료든 결제든)
    library_row = get_library_row(user_id, city_id)
    if library_row:
        report = generate_full_report(city_id)
        return JSONResponse({**report, "is_free": library_row.is_free})

    # 2. 무료 보고서 미사용 → 이 도시를 무료로 부여
    free_city_id = get_free_report_city_id(user_id)
    if free_city_id is None:
        mark_free_report(user_id, city_id)
        insert_library_row(user_id, city_id, is_free=True)
        report = generate_full_report(city_id)
        return JSONResponse({**report, "is_free": True})

    # 3. 이미 다른 도시로 무료 보고서 사용 + 미결제 → 결제 필요
    return JSONResponse(
        {"detail": "Payment required", "city_id": city_id, "free_used_for": free_city_id},
        status_code=402,
    )
```

**핵심**: LLM 호출은 항상 동일 (`generate_full_report`). 응답에 `is_free` 플래그만 추가하여 프론트엔드가 워터마크/다운로드 잠금을 분기.

---

## 7. 무료 보고서 (블러+워터마크) 모드 구현

### 7.1 백엔드

**LLM 분기 없음**. `build_detail_prompt`는 그대로. 응답에 `is_free` 플래그만 추가.
LLM은 항상 풀버전을 출력하고, **블러 처리는 전적으로 프론트엔드 책임**.

### 7.2 프론트엔드 동작 — `isFree: boolean` prop

`CountryBriefingDocument.tsx`에 prop 추가. 동작:

| 상태 | 워터마크 | 앞부분 (3섹션) | 뒷부분 | 다운로드 | 결제 유도 카드 |
|------|---------|---------------|--------|---------|--------------|
| `isFree=true` | 대각선 반투명 | 명확 | **블러** | 비활성화 | 표시 |
| `isFree=false` | 없음 | 명확 | 명확 | 활성화 | 없음 |

### 7.3 블러 처리 구현

**컷오프 기준**: `BriefingData.sections[]` 의 인덱스 기준으로 앞 3개는 명확, 4번째부터 블러.

```tsx
// CountryBriefingDocument.tsx (개념 코드)
const BLUR_START_INDEX = 3;  // 4번째 섹션부터 블러

function CountryBriefingDocument({ data, isFree }: Props) {
  return (
    <article className="relative">
      {data.sections.map((section, idx) => {
        const blurred = isFree && idx >= BLUR_START_INDEX;
        return (
          <Section
            key={section.num}
            data={section}
            className={blurred ? "blur-sm select-none pointer-events-none" : ""}
            aria-hidden={blurred}
          />
        );
      })}

      {isFree && <PaywallCard cityId={data.countryId} />}
      {isFree && <FreeSampleWatermark />}
    </article>
  );
}
```

Tailwind 클래스:
- `blur-sm` (4px blur) — 읽을 수 없되 레이아웃은 그대로
- `select-none pointer-events-none` — 텍스트 복사·우클릭 방지
- `aria-hidden` — 스크린리더에서 가려진 콘텐츠 노출 차단

### 7.4 워터마크 디자인

```tsx
function FreeSampleWatermark() {
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      style={{ transform: "rotate(-30deg)" }}
    >
      <span className="font-mono text-4xl tracking-widest text-foreground/10">
        NomadNavigator AI · Free Sample
      </span>
    </div>
  );
}
```

투명도 10%로 본문 가독성 유지하면서 PNG 캡처 시도엔 명확히 보임 (블러까지 더해지면 거의 모든 무단 사용 방지).

### 7.5 결제 유도 카드 (블러 영역 위 sticky)

```tsx
function PaywallCard({ cityId }: { cityId: string }) {
  return (
    <div className="sticky bottom-4 mx-auto max-w-md rounded-lg border bg-background p-5 shadow-xl">
      <p className="text-sm text-muted-foreground">이 보고서의 나머지를 보려면</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-muted-foreground line-through">$4.99</span>
        <span className="text-2xl font-bold text-primary">$2.99</span>
        <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
          Launch Sale · 40% OFF
        </span>
      </div>
      <Button className="mt-3 w-full">맞춤 보고서 구매하기</Button>
    </div>
  );
}
```

위치: 블러 시작 지점(4번째 섹션) 위에 sticky로 고정. 사용자가 스크롤하면 항상 시야에 있음.

### 7.6 PNG 캡처 방지

`html-to-image` 라이브러리는 CSS `filter: blur()` 를 그대로 렌더하므로 블러 상태의 PNG가 생성됨. 추가로:

- `isFree=true`일 때 PNG/MD 다운로드 버튼 자체를 비활성화 (`disabled` 속성)
- 우클릭 메뉴 비활성화 (`onContextMenu={e => e.preventDefault()}`)
- 본문에 `user-select: none` 적용 (블러 영역에 이미 포함됨)

---

## 8. 마이그레이션 절차

| Step | 작업 | 환경 | 롤백 |
|------|------|------|------|
| 1 | DB 컬럼 추가 (`users.free_report_city_id`, `users.free_report_used_at`, `library_guides.is_free`) | dev → prod | `DROP COLUMN` |
| 2 | Polar 신규 product 생성, 환경변수 갱신 | Polar 대시보드 | 기존 환경변수 유지 |
| 3 | 백엔드 코드 배포 (rate_limit·auth·detail·billing) | develop 브랜치 | revert PR |
| 4 | 프론트엔드 배포 (pricing·pay·guide·preview) | develop 브랜치 | revert PR |
| 5 | 기존 pro 구독자 안내 메일 (해당 없음 — skip) | — | — |
| 6 | 프로덕션 배포 (`main` 머지) | main | revert PR |

---

## 9. 테스트 계획

| 테스트 케이스 | 예상 결과 |
|--------------|----------|
| 비로그인 사용자 → 가이드 페이지 | 로그인 유도 |
| 로그인 + 무료 보고서 미사용 + 첫 도시 가이드 | 자동으로 무료 부여 + 워터마크 풀 보고서 |
| 로그인 + 무료 보고서 사용 완료(lisbon) + lisbon 재방문 | 워터마크 풀 보고서 (재 LLM 호출 없이 캐시 활용) |
| 로그인 + 무료 보고서 사용 완료(lisbon) + bangkok 진입 | 결제 페이지 redirect |
| 로그인 + bangkok 결제 완료 → bangkok 가이드 | 워터마크 없는 풀 보고서 |
| 로그인 + lisbon 결제 (무료 사용 후) | lisbon 워터마크 제거됨 |
| 결제 → webhook 실패 → 재시도 | `library_guides`에 idempotent INSERT |

---

## 10. 영향 받는 테스트 파일

- `tests/test_billing_checkout.py` — 단건 결제 흐름으로 재작성
- `tests/test_billing_webhook.py` — `library_guides` INSERT 검증
- `tests/test_auth_routes.py` — `/auth/me` 응답 스키마
- `tests/test_rate_limit_entitlements.py` — entitlement 분기 제거에 따라 단순화
- `tests/test_rate_limit_storage.py` — 동일
- `frontend/src/lib/pricing-content.test.mjs` — 신규 카드 구조
- `frontend/src/lib/billing-return.test.mjs` — 신규 응답 형식

---

## 11. 작업 우선순위

| Phase | 작업 | 산출물 |
|-------|------|--------|
| **P0** | Polar product 생성 (가격 $2.99 / 정가 $4.99 표시), 환경변수 결정 | 운영 작업 |
| **P1** | DB 컬럼 추가 + `/auth/me` 응답 정리 + `/api/detail` 가드 | 백엔드 PR #1 |
| **P2** | Pricing/Pay 페이지 UI + checkout BFF 수정 | 프론트엔드 PR #2 |
| **P3** | 워터마크 모드 (프론트 `isFree` 분기 — 백엔드 LLM 분기 없음) | PR #3 |
| **P4** | 테스트 갱신 + 문서 동기화 (api-reference.md, db-schema.md) | PR #4 |
| **P5** | Dashboard 재정의 또는 폐지 | PR #5 |

---

## 12. 관련 파일 (요약)

### 백엔드
- `utils/db.py`, `utils/rate_limit.py`
- `api/auth.py`, `api/billing.py`, `api/dashboard.py`
- `server.py` — `/api/recommend`, `/api/detail` (city_id 가드 + is_free 응답)
- `prompts/builder.py` — **분기 없음** (참고용)

### 프론트엔드
- `frontend/src/lib/pricing-content.ts`, `frontend/src/lib/billing-return.ts`
- `frontend/src/app/[locale]/pricing/page.tsx`, `frontend/src/app/[locale]/pay/page.tsx`
- `frontend/src/app/[locale]/guide/[city_id]/page.tsx`
- `frontend/src/app/api/billing/checkout/route.ts`
- `frontend/src/components/pay/PolarCheckoutButton.tsx`
- `frontend/src/components/guide/CountryBriefingDocument.tsx`

### 문서
- `cowork/backend/api-reference.md` — `/auth/me`, `/api/detail`, `/api/billing/*` 스펙 갱신
- `cowork/backend/db-schema.md` — `users.preview_used_at` 추가, `billing_entitlements` deprecated 명시
- `CLAUDE.md` — "Rate Limit & Billing" 섹션 재작성
