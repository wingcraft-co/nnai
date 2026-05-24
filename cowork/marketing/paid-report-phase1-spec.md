# Paid 보고서 Phase 1 구현 Spec — A · I · G · H

_Last updated: 2026-05-24_
_Status: 구현 준비 (paid-report-enhancement.md의 P1·P2 일부 발췌)_
_Scope: 적용 난이도 낮고 정확도 높은 4개 카테고리 — Personalized Summary, Resource Pack, Pre-Departure Timeline, Plan B & Visa-Run_
_Pricing: free/pro 플랜 폐지 — 맞춤 보고서 1건당 **정가 USD 4.99 → 런칭 할인가 USD 2.99** 단건 결제 모델 (2026-05-24 확정)_

## 1. 선정 근거

`paid-report-enhancement.md`의 10개 카테고리(A~J) 중 다음 기준으로 4개 선별:

- **정적 데이터 비중 ≥ 50%** — LLM 환각 위험 최소화
- **기존 코드/유틸 재활용 가능** — 신규 구현 부담 최소화
- **출력 토큰 증가 ≤ 30%** — PAYG cap 영향 최소화
- **유료 지각가치 즉시 가시화** — "내 답이 반영됐다" 신호

| 코드 | 카테고리 | 정적 데이터 비중 | 재활용 자산 | 토큰 영향 |
|------|---------|-----------------|------------|----------|
| A | Personalized Summary | 100% (입력 호명) | 기존 `_user_profile` | +1 단락 |
| I | Resource Pack | 100% (URL 큐레이션) | `visa_db.json`, `city_scores.json` | LLM 미경유 |
| G | Pre-Departure Timeline | 70% (구조) + 30% (LLM 본문) | 기존 `first_steps[]` 재구성 | +0% (재배치) |
| H | Plan B & Visa-Run | 90% (정적) + 10% (LLM 코멘트) | `utils/planb.py` 기존 구현 | LLM 미경유 |

제외 카테고리: B(visa_db 보강 필요), C(계산 로직 추가), D(LLM 환각 큼), E(효과 낮음), F(데이터 큐레이션 큼), J(톤 밸런싱 어려움).

---

## 2. 카테고리별 Spec

### A. Personalized Summary

**위치**: 보고서 상단 — `Executive Summary` 바로 위에 신설 섹션 `0. Briefing Profile`로 배치하거나, `Executive Summary` 본문 앞에 단락 추가.

**입력 호명 대상** (모두 `_user_profile`에서 추출):
- `persona_type` → 라벨 매핑 (`free_spirit` → "Free Spirit" 등)
- `travel_type` → "혼자 / 배우자 / 자녀 N명 동반"
- `children_ages[]` → "8세·12세 자녀 2명"
- `income_krw` + `has_spouse_income` + `spouse_income_krw` → 가구 합산 월소득
- `timeline` → "1년 장기 체류" 등 원문
- `stay_style` → "정착형 / 순환형 / 이동형"
- `readiness_stage` → "출국 임박 / 구체적 준비 중 / 막연한 고민"

**프롬프트 추가**(`_STEP2_SYSTEM_PROMPT`):

```text
- 보고서 상단에 'briefing_profile' 필드로 1단락(150~200자)을 작성하라.
- 다음 입력값을 반드시 자연어로 호명할 것:
  persona, travel_type, children_ages, household_income(KRW),
  timeline, stay_style, readiness_stage.
- 톤: 인사말 없이 사실 기반으로. "당신은 ~입니다" 형식 회피, "~기준" 형식 사용.
- 도시 적합성 한 줄(왜 이 도시가 본 입력 조합에 맞는가)로 마무리.
```

**예시 출력**:
> Free Spirit 페르소나·배우자 동반·8세/12세 자녀 2명·가구 월소득 500만원·1년 정착형·구체적 준비 중 단계 기준 브리핑입니다. 리스본은 D8 비자의 가족 합산 소득 요건과 국제학교 인프라 측면에서 본 구성에 적합한 후보로 분류됩니다.

**스키마**:
```ts
type BriefingData = {
  // ... 기존 필드
  briefingProfile?: string;  // A
};
```

---

### I. Resource Pack

**위치**: 보고서 말미 — `References` 직전 새 섹션 `6. Resource Directory`.

**구성**: LLM을 경유하지 않고 **정적 데이터 + `_user_profile` 분기**로 프론트엔드에서 직접 큐레이션.

| 항목 | 출처 | 분기 조건 |
|------|------|-----------|
| 비자 공식 페이지 | `visa_db.json` 의 `visa_url` | 항상 |
| 중기 숙소 검색 | `flatio_search_url`, `anyplace_search_url` | `stay_style=정착형` → 중기 우선, `이동형` → 단기 |
| 노마드 밋업 | `city_scores.json` 의 `nomad_meetup_url` | 항상 |
| 한인 커뮤니티 | hand-curated dict (PT/JP/MY 등 주요 7개국) | 한인 커뮤니티 보유 국가만 |
| 보험 비교 | SafetyWing / Cigna Global 고정 URL | `children_ages` 유무로 plan 추천 분기 |
| 환전·송금 | Wise / Revolut 고정 URL | 항상 |
| 세무사 디렉토리 | hand-curated (PT/ES/GR/MY) | `tax_sensitivity=optimize`일 때만 |

**구현 위치**: `frontend/src/lib/briefing-data.ts` 에 `buildResourceDirectory(userProfile, countryData, cityData)` 헬퍼 신설.

**스키마**:
```ts
type BriefingResource = {
  category: "visa" | "housing" | "community" | "insurance" | "finance" | "tax";
  label: string;
  url: string;
  note?: string;  // "stay_style=정착형 기준" 등 분기 근거 표시
};

type BriefingData = {
  // ...
  resourceDirectory?: BriefingResource[];  // I
};
```

---

### G. 90-Day Pre-Departure Timeline

**위치**: 기존 `4. Action Plan` 섹션을 **D-day 기반 캘린더**로 재구성. 섹션 번호 유지.

**시작 시점 분기** (`readiness_stage` 기반):

| `readiness_stage` | 시작 D-day | 적용 |
|-------------------|-----------|------|
| 출국 임박 | D-30 | 단축 캘린더 (30/14/7/1) |
| 구체적 준비 중 | D-90 | 표준 (90/60/30/14/7/1) |
| 막연하게 고민 | D-180 | 장기 (180/120/90/60/30/14/7/1) |

**각 D-day 항목 구성** (LLM 출력):
- D-N: 해당 시점까지 완료해야 할 액션 2~4개
- 기한이 있는 항목(건보 임의계속가입·국민연금 납부예외 등)은 `deadline_critical: true` 플래그로 표시

**프롬프트 추가**:
```text
- 'action_plan' 필드를 평면 배열이 아닌 'departure_timeline' 배열로 출력.
- 각 원소: { d_day: -90, label: "D-90", items: [{ text, deadline_critical }] }
- readiness_stage가 '출국 임박'이면 D-30부터, '막연'이면 D-180부터 시작.
- 한국 거주자에게 적용되는 기한(건보 임의계속가입 퇴직 후 2개월·국민연금 납부예외 출국 14일 전 등)은
  deadline_critical=true로 마크.
```

**스키마**:
```ts
type BriefingTimelineItem = {
  text: string;
  deadline_critical?: boolean;
};

type BriefingTimelinePoint = {
  d_day: number;       // -90, -60, ...
  label: string;       // "D-90"
  items: BriefingTimelineItem[];
};

type BriefingData = {
  // ...
  departureTimeline?: BriefingTimelinePoint[];  // G (기존 first_steps 대체)
};
```

**렌더링**: `CountryBriefingDocument.tsx`에서 D-day 배지 + 기한 항목 빨강 마크.

---

### H. Plan B & Visa-Run Routes

**위치**: 보고서 후반 — `Risk Notes` 다음 새 섹션 `7. Plan B & Buffer Routes` (Pre-Departure Timeline이 4번이므로 5=Risk, 6=Resource, 7=Plan B 순서).

**구성**: LLM 미경유. `utils/planb.py`의 기존 비쉥겐 버퍼 추천 로직 + `preferred_countries[]` 분기.

**산출 항목**:
- **백업 도시 2곳**: 1순위 도시와 같은 비자 카테고리 또는 동일 지역(쉥겐/ASEAN/남미)에서 `city_scores.json` 기반 추출
- **쉥겐 90/180 버퍼 동선**: 1순위가 쉥겐권이면 `utils/planb.py` 결과 + 비쉥겐 버퍼 추천
- **순환형 분기**: `stay_style=순환형`일 때만 분기별 이동 동선 (Q1·Q2·Q3·Q4) 제안

**구현 위치**:
- 백엔드 `api/parser.py` 에 `build_plan_b(top_city, user_profile)` 헬퍼 추가 — `utils/planb.py` 재사용
- 프론트엔드는 백엔드 응답을 그대로 렌더링

**스키마**:
```ts
type BriefingPlanB = {
  backup_cities: Array<{
    city: string;
    country_id: string;
    reason: string;  // "동일 D8 비자 카테고리" 등
  }>;
  schengen_buffer?: Array<{
    country_id: string;
    country: string;
    note: string;
  }>;
  rotation_plan?: Array<{
    quarter: "Q1" | "Q2" | "Q3" | "Q4";
    city: string;
    rationale: string;
  }>;
};

type BriefingData = {
  // ...
  planB?: BriefingPlanB;  // H
};
```

---

## 3. 전체 스키마 통합

```ts
type BriefingData = {
  // 기존 필드 (변경 없음)
  documentId: string;
  issuedDate: string;
  preparedFor: string;
  classification: string;
  cityName: string;
  cityKr: string | null;
  countryOfficial: string;
  countryId: string;
  quickFacts: { visa; stay; monthly; taxResidency };
  sections: BriefingSection[];
  references: BriefingReference[];

  // Phase 1 신규 (모두 옵셔널 — 하위 호환)
  briefingProfile?: string;                  // A
  departureTimeline?: BriefingTimelinePoint[]; // G (sections[]의 Action Plan을 대체)
  planB?: BriefingPlanB;                     // H
  resourceDirectory?: BriefingResource[];    // I
};
```

---

## 4. 무료 vs 유료 분기 (Phase 1 적용 후)

가격 정책: **무료 = Step 1 + 무료 보고서 1회(워터마크, 풀콘텐츠) / 유료 = 맞춤 보고서 1건 정가 USD 4.99 (런칭 할인 USD 2.99)** (구독 없음, 영구 보관).

| 카테고리 | 무료 (Step 1, 무제한) | 무료 보고서 (1회, 블러+워터마크) | 유료 (USD 2.99, 영구) |
|---------|---------------------|--------------------------------|----------------------|
| 도시 추천 | 3장 카드 + 1줄 reason | (동일) | (동일) |
| LLM 콘텐츠 | — | **풀버전 동일** (LLM 출력 분기 없음) | 풀버전 |
| 앞부분 (~40%) | — | **명확히 표시** (워터마크만) | 명확 |
| 뒷부분 (~60%) | — | **블러 처리** (길이는 보이지만 텍스트 불가독) | 명확 |
| 워터마크 | — | **NomadNavigator AI · Free Sample** | 없음 |
| 다운로드 (PNG/MD) | — | **비활성화** | 활성화 |
| 보관함 저장 | — | 저장 (블러+워터마크 유지) | 저장 (영구) |

**결제 단위**: 도시 1개의 맞춤 보고서 = 정가 USD 4.99, **런칭 할인가 USD 2.99**. 결제 후 보관함에서 영구 열람.
**할인 표시**: UI에서 정가에 취소선, 할인가 강조. 라벨 "Launch Sale" 또는 "런칭 특가 · 40% OFF".
**무료 보고서 한도**: 사용자당 평생 **딱 1개 도시**의 보고서. 사용자가 선택한 도시 1개에만 적용. `users.free_report_city_id` 컬럼으로 추적.
**핵심**: 무료/유료 LLM 콘텐츠 동일. 무료는 **앞부분 명확 + 뒷부분 블러** + 워터마크 + 다운로드 잠금. 결제하면 블러 해제·워터마크 제거·다운로드 활성화.

**블러 경계 (잠정)**: 보고서 상단에서 약 40% 지점. 첫 3개 섹션(Briefing Profile · Executive Summary · Visa Pathway 2.1)까지 명확, 그 이후(Cost Profile · Timeline · Risk · Plan B · Resource Directory) 블러. 페이지 픽셀 기반 또는 섹션 인덱스 기반 컷오프 중 택일 (P3에서 결정).

---

## 5. 구현 순서

| Step | 작업 | 파일 | 의존성 |
|------|------|------|--------|
| 1 | `BriefingData` 타입 확장 (4개 필드 추가) | `frontend/src/lib/briefing-data.ts` | — |
| 2 | A: `_STEP2_SYSTEM_PROMPT`에 briefing_profile 지시 추가 | `prompts/builder.py` | Step 1 |
| 3 | G: action_plan → departure_timeline 프롬프트·파서 교체 | `prompts/builder.py`, `api/parser.py` | Step 1 |
| 4 | I: 정적 큐레이션 헬퍼 | `frontend/src/lib/briefing-data.ts` | Step 1 |
| 5 | H: 백엔드 plan_b 헬퍼 | `api/parser.py`, `utils/planb.py` 재사용 | Step 1 |
| 6 | 렌더링 — 4개 신규 섹션 | `frontend/src/components/guide/CountryBriefingDocument.tsx` | Step 1~5 |
| 7 | 마크다운 변환기 업데이트 | `frontend/src/lib/briefing-markdown.ts` | Step 6 |
| 8 | i18n 영어 프롬프트 페어 | `prompts/system_en.py` | Step 2, 3 |
| 9 | 테스트 (briefing 구조 회귀) | `frontend/src/lib/*.test.mjs` | Step 6 |

---

## 6. 검토가 필요한 의사결정

1. **`first_steps[]` 하위 호환**: G 적용 시 기존 `first_steps[]` 키를 deprecated로 두고 양쪽 다 출력할지, 완전 교체할지. → 보관함의 과거 구매 보고서가 깨지지 않도록 **하위 호환 유지** 권장.
2. **`Action Plan` 섹션 번호**: G가 기존 4번 섹션을 대체하면 5번(Risk Notes) 이후 번호 그대로. 6=Resource, 7=Plan B로 자연 확장 가능.
3. **A 호명 톤**: "당신은…" vs "본 입력 조합 기준…" → 후자(객관·문서 톤) 권장. IMF 보고서 스타일 일관성.
4. **H 백업 도시 선정 알고리즘**: `city_scores.json` 의 score 단순 정렬 vs 동일 visa 카테고리 우선 vs 사용자 입력(`preferred_countries`) 가중치. → 1차는 단순 정렬, A/B로 검증 후 가중치 도입.
5. **I의 한인 커뮤니티 dict**: hand-curated 데이터 갱신 주기 — `cowork/marketing/resource-directory.md` 별도 파일로 관리하고 분기별 검토.

---

## 7. 관련 파일

- `prompts/builder.py` — `_STEP2_SYSTEM_PROMPT`, `build_detail_prompt()`
- `prompts/system_en.py` — 영어 프롬프트
- `api/parser.py` — Step 2 응답 파싱
- `utils/planb.py` — 비쉥겐 버퍼 (H 재사용)
- `frontend/src/lib/briefing-data.ts` — 타입 + I 큐레이션 헬퍼
- `frontend/src/lib/briefing-markdown.ts` — 마크다운 변환
- `frontend/src/components/guide/CountryBriefingDocument.tsx` — 렌더링
- `frontend/src/app/[locale]/guide/[city_id]/page.tsx` — 가이드 페이지
- `frontend/src/app/[locale]/library/page.tsx` — 보관함 모달

---

## 8. 출력 토큰 예상

| 카테고리 | 추가 토큰 (한국어 기준) |
|---------|------------------------|
| A | +80~120 토큰 (1단락) |
| G | ±0 (기존 first_steps 재배치) |
| H | LLM 미경유 (백엔드 헬퍼) |
| I | LLM 미경유 (프론트 헬퍼) |

**합계**: +80~120 토큰. PAYG cap 영향 1% 미만.

---

## 9. Pricing 정책 전환 (2026-05-24)

### 변경 요약

| 항목 | Before | After |
|------|--------|-------|
| 요금제 | free / pro (월간 구독) | **단건 결제만** (구독 없음) |
| 무료 사용자 권한 | Step 1 + Step 2 N회 무료 | Step 1 무제한 / Step 2는 결제 시에만 |
| 유료 단위 | pro 월 구독 (+ PAYG) | **맞춤 보고서 1건 = USD 3** |
| 보유 기간 | 구독 유지 동안 | **영구 (보관함에 저장)** |

### 영향 받는 컴포넌트

| 영역 | 파일/모듈 | 작업 |
|------|----------|------|
| Pricing 페이지 | `frontend/src/app/[locale]/pricing/page.tsx`, `frontend/src/lib/pricing-content.ts` | 무료/Pro 비교 표 → "보고서당 $3" 단순 카드로 교체 |
| Polar 상품 | Polar 대시보드 | 정기 구독 상품 → 1회성 상품으로 신규 생성 |
| 결제 BFF | `frontend/src/app/api/billing/checkout/route.ts` | `city_id` 파라미터 받아 도시별 결제 세션 생성 |
| Pay 페이지 | `frontend/src/app/[locale]/pay/page.tsx` | "Pro 구독" 카피 → "이 도시 맞춤 보고서 구매" |
| Entitlement DB | `utils/db.py` `billing_entitlements` 테이블 | `plan_tier` 컬럼 폐기 또는 deprecated. 도시별 영구 보유는 별도 `library_guides` 테이블로 관리 (이미 존재) |
| Rate limit | `utils/rate_limit.py` | free/pro/payg 등급 분기 제거. 인증된 사용자 단일 등급 + IP 기반 anonymous |
| `/api/detail` | `server.py` | "결제 완료된 city_id만 허용" 가드. 미결제 city_id 요청 시 `402` 반환 |
| `/auth/me` | `api/auth.py` | `entitlement.plan_tier` 응답 deprecated. `purchased_city_ids[]` 신설 권장 |
| Dashboard | `api/dashboard.py`, `frontend/src/app/[locale]/dashboard` | Pro 전용 기능 재정의 또는 폐지 검토 |
| 결제 webhook | `api/billing.py` | Polar 1회성 결제 이벤트 → `library_guides` 에 unlock 기록 |

### Migration 노트

- 기존 pro 구독자가 있다면 잔여 기간 정책 별도 협의 (현재 production 사용자 규모 확인 필요)
- `billing_entitlements` 테이블은 컬럼 추가/삭제 없이 **읽기 시 plan_tier 무시** 방향이 안전
- `library_guides` 테이블이 이미 도시별 unlock 기록을 보관하므로, 단건 결제 모델과 자연스럽게 매칭됨

### 결정 사항 (2026-05-24)

| 의사결정 | 결정 |
|---------|------|
| 기존 pro 구독자 grandfathering | **불필요** (production 구독자 없음) |
| Polar 상품 구조 | **단일 product + city_id metadata**. 도시 50개 별도 상품 생성 안 함 |
| 무료 사용자 권한 | **평생 1개 도시 보고서, 워터마크 + 풀콘텐츠** 제공 (LLM 분기 없음) |
| 단건 가격 | **정가 USD 4.99 → 런칭 할인가 USD 2.99 (확정)**. UI에 취소선 + 40% OFF 라벨 |

### 후속 의사결정

1. **번들 가격**: 2~3개 도시 일괄 구매 할인 — Phase 2 검토
2. **환불 정책**: LLM 응답 품질 불만 시 환불 절차 (Polar refund API 활용)
3. **공유 URL**: 결제한 보고서를 타인이 공유 URL로 보는 것 허용 여부
4. **워터마크 디자인**: 텍스트 vs 반투명 이미지, 위치 (대각선 vs 좌상단)
5. **무료 보고서 선택 시점**: 결제 페이지에서 "이 도시는 무료로 받기" 옵션 노출 vs 첫 가이드 진입 자동 부여

---

## 10. 관련 문서

- `cowork/marketing/paid-report-enhancement.md` — 원본 10개 카테고리 제안
- `cowork/backend/api-reference.md` — `/api/detail` 스펙
- `cowork/backend/db-schema.md` — `billing_entitlements`, `library_guides` 테이블
- `cowork/frontend/result-page-data-spec.md` — Step 1 데이터 명세
