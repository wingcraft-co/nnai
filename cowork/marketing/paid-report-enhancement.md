# Paid 보고서(Step 2) 콘텐츠 강화 제안

_Last updated: 2026-05-23_
_Status: 제안 (구현 전 협의 필요)_

## 1. 문제 정의

현재 Step 2 유료 보고서(`/api/detail` → `_STEP2_SYSTEM_PROMPT`)는 다음 4개 섹션만 출력한다.

| 현재 필드 | 내용 |
|----------|------|
| `immigration_guide.sections[]` | 단계별 이민 준비 가이드 |
| `visa_checklist[]` | 비자 신청 서류 체크리스트 |
| `budget_breakdown` | rent / food / cowork / insurance / misc 5항목 월 예산 |
| `first_steps[]` | 출국 직전 우선순위 액션 |

반면 온보딩 설문은 다음을 수집한다:

```
nationality, income_krw, income_type, immigration_purpose,
lifestyle[], languages[], timeline, preferred_countries[],
preferred_language, persona_type, travel_type, children_ages,
dual_nationality, readiness_stage,
has_spouse_income, spouse_income_krw,
stay_style, tax_sensitivity, total_budget_krw, persona_vector
```

이 중 다수가 **프롬프트 hint(개인화 톤 조절)** 로만 흘러가고, 보고서의 **별도 섹션으로 가시화되지 않는다**. 사용자가 "내가 답한 게 어디에 반영됐지?"를 느끼지 못해, 유료 전환의 지각가치가 낮다.

**개선 원칙**
1. 사용자가 입력한 각 항목이 보고서에서 **이름으로 호명**되어야 한다 ("자녀 2명·8세/12세 기준 …", "프리랜서 소득 기준 …").
2. 무료 Step 1은 유지하고, **유료에서만 나오는 카테고리**를 명확히 분리한다.
3. LLM 환각 위험을 줄이기 위해 가능한 항목은 **city_scores.json / visa_db.json** 정적 데이터를 우선 사용한다.

---

## 2. 추가 제안 카테고리 (입력 → 산출물 매핑)

### A. Personalized Summary (모든 사용자 공통, 입력 호명)
보고서 최상단에 "왜 이 보고서가 당신에게 맞는가"를 입력 기반으로 1단락으로 요약.

- **입력**: `persona_type`, `travel_type`, `children_ages`, `income_krw`, `timeline`, `stay_style`, `readiness_stage`
- **산출**: "37세·프리랜서·배우자+자녀 2명(8/12세) 동반·월소득 500만원·1년 정착형·이미 출국 임박 단계의 당신에게 리스본은…" 형태의 hyper-personalized 인트로
- **가치**: 즉시 "내 답이 반영됐다"는 신호 + 공유/스크린샷 유도

### B. Visa Decision Tree (income_type · travel_type · dual_nationality)
`visa_checklist` 평면 배열을 **나의 케이스에 맞는 비자 1~2개 추천 + 대안** 구조로 격상.

- **입력**: `income_type`, `income_krw`, `travel_type`, `has_spouse_income`, `dual_nationality`, `children_ages`
- **산출**:
  - 1순위 비자 (e.g. 포르투갈 D8) + 신청 가능 여부 판정 (소득 요건 충족 여부 자동 계산)
  - 2순위 비자 (e.g. 포르투갈 D7) + 차이점
  - 거절 리스크 (프리랜서 서류 거절 사례 등)
  - 복수국적자: 보조 여권 활용 시나리오 분기
- **가치**: 비자 선택은 가장 비싼 의사결정. "내 소득으로 가능/불가능"이 자동 판정되는 게 핵심 차별점.

### C. Personalized Budget Forecast (income_krw · total_budget_krw · stay_style · travel_type)
현재 `budget_breakdown`은 1인 기준 5항목. 이를 **가족 구성 × 체류 스타일 × 환율 반영**으로 확장.

- **입력**: `travel_type`, `children_ages`, `stay_style`, `income_krw`, `total_budget_krw`, `has_spouse_income`
- **산출**:
  - 가족 단위 월 예산 (가구원수 배수 적용)
  - 초기 정착 일회성 비용 (보증금·항공권·비자 신청료·국제이사 등)
  - **체류 기간 총비용 시뮬레이션** (예: 1년 정착형 vs 6개월×2개 도시 순환형 비교)
  - 소득 대비 여유분 (`income_krw + spouse_income_krw - 월예산` × 12)
  - 단기 체류 시 `total_budget_krw` 소진 예상 시점
- **가치**: "내 예산으로 가능한가"가 한눈에. 무료 보고서로는 절대 못 만드는 수치.

### D. Tax Strategy Brief (tax_sensitivity · timeline · income_type · dual_nationality)
현재 `tax_warning`은 도시 카드의 한 줄 경고. 유료에서는 **세금 시나리오 브리프**로 확장.

- **입력**: `tax_sensitivity` (optimize/simple/unknown), `timeline`, `income_type`, `nationality`, `dual_nationality`
- **산출**:
  - 한국 세법상 거주자/비거주자 판정 (183일 룰 + 가족·자산 기준)
  - 이중과세방지협약 적용 여부 (city_scores `double_tax_treaty_with_kr`)
  - `tax_sensitivity=optimize`인 경우: NHR(포르투갈), 영토주의 과세국(말레이시아 등) 비교
  - `tax_sensitivity=simple`인 경우: 가장 단순한 신고 케이스 권장
  - 프리랜서 vs 법인재직 소득 신고 차이
- **가치**: 세무사 상담 전 사전 학습 자료. 잘못된 신고로 인한 가산세 회피.

### E. Lifestyle Fit Report (lifestyle[] · persona_type · languages[])
선택된 라이프스타일/언어 요건이 **선택 도시에서 얼마나 충족되는지** 정량 평가.

- **입력**: `lifestyle[]`, `languages[]`, `persona_type`, `preferred_language`
- **산출**:
  - 각 lifestyle 태그별 도시 적합도 (해변 9/10, 영어권 7/10 …)
  - 언어 요건 vs 현지 영어 통용도(`english_score`) 충족 여부
  - 페르소나별 추천 동선 (wanderer는 코워킹 hopping, builder는 startup 허브 …)
  - 코리안 커뮤니티 규모(`korean_community_size`) → 적응 난이도 추정
- **가치**: "왜 하필 이 도시인가"에 대한 데이터 기반 근거.

### F. Family Logistics Pack (travel_type · children_ages · has_spouse_income)
가족 동반자 전용 섹션. 솔로 사용자에게는 표시하지 않음.

- **입력**: `travel_type`, `children_ages[]`, `has_spouse_income`
- **산출**:
  - 자녀 연령별 학교 옵션 (국제학교 학비 범위, 입학 시기)
  - 의료 인프라 (소아과·응급실 접근성)
  - 배우자 동반 비자 가능 여부 + 배우자 취업 허용 여부
  - 합산 소득 기준 비자 필터 (예: 스페인 DNV는 부양가족 1인당 +25%)
- **가치**: 가족 사용자의 가장 큰 불안(자녀 교육·의료)에 대한 직접적 답. 솔로 보고서와 차별화된 분량.

### G. 90-Day Pre-Departure Timeline (readiness_stage · timeline)
현재 `first_steps[]`는 평면 리스트. 이를 **D-day 기반 캘린더**로 변환.

- **입력**: `readiness_stage`, `timeline`
- **산출**:
  - D-90 / D-60 / D-30 / D-14 / D-7 / D-1 각 시점 액션
  - `readiness_stage=출국 임박`이면 D-30부터 시작
  - `readiness_stage=막연하게 고민`이면 D-180부터 시작
  - 기한 항목(건보 임의계속가입, 국민연금 납부예외)을 캘린더 위에 마크
- **가치**: "오늘 뭘 해야 하나"가 명확. 보고서를 책상 위에 두고 쓰게 만듦.

### H. Plan B & Visa-Run Routes (preferred_countries · stay_style)
1순위 도시가 막혔을 때 대안 + 비자런 동선.

- **입력**: `preferred_countries[]`, `stay_style`, `timeline`
- **산출**:
  - 1순위 도시 비자 거절 / 90일 만료 시 백업 도시 2곳
  - 쉥겐 90/180 룰 적용 시 비쉥겐 버퍼 (이미 `utils/planb.py` 보유 — 활용)
  - 순환형(`stay_style=순환형`) 사용자에게는 분기별 이동 동선 제안
- **가치**: 1순위만 추천하는 무료 보고서 대비 "현실적 대안"으로 차별화.

### I. Resource Pack (모든 입력 기반 큐레이션)
보고서 말미의 **개인화된 링크 모음**.

- **산출**:
  - 비자 공식 페이지 (`visa_url`)
  - 중기 숙소 검색 (`flatio_search_url`, `anyplace_search_url`) — `stay_style`에 따라 단/중기 우선순위 다르게
  - 한인 커뮤니티 채널 (telegram/카카오)
  - 노마드 밋업 (`nomad_meetup_url`)
  - 권장 보험 (SafetyWing/Cigna Global) 비교
  - 환전/송금 (Wise/Revolut)
  - `tax_sensitivity=optimize`인 경우: 현지 한인 세무사 디렉토리
- **가치**: 단순 정보가 아닌 **실행 도구**. 보고서가 북마크처럼 재방문됨.

### J. Risk & Reality Check (persona_type · readiness_stage · income_type)
무료에서는 city 카드의 `realistic_warnings` 1~2개만 표시. 유료에서는 **사용자 케이스의 구체적 실패 시나리오**를 다룬다.

- **입력**: `persona_type`, `readiness_stage`, `income_type`, `dual_nationality`
- **산출**:
  - 프리랜서 → 비자 서류 거절 빈도 높은 케이스
  - 출국 임박 → 흔히 놓치는 기한(건보·연금·전입신고)
  - 무소득/은퇴 → 자산 증명 기준 미달 케이스
  - 복수국적 → 보조 여권으로 입국 후 발생하는 세금 거주지 혼선
- **가치**: 보고서가 "장밋빛 광고"가 아니라 "현실 자문"으로 포지셔닝됨. 신뢰도 ↑.

---

## 3. 무료 vs 유료 분기 명확화

현재 두 단계의 차별점이 모호하다. 다음과 같이 분리 권장:

| 카테고리 | 무료 (Step 1) | 유료 (Step 2) |
|---------|--------------|--------------|
| 도시 추천 | 3장 카드 + 1줄 reason | (동일) |
| 비자 정보 | 비자명·체류기간 | **Decision Tree (B)** + 자격 자동판정 |
| 예산 | 1인 단일 추정값 | **Personalized Forecast (C)** 가족·체류기간 시뮬레이션 |
| 세금 | 한 줄 경고 | **Tax Strategy Brief (D)** |
| 가족 정보 | — | **Family Logistics Pack (F)** |
| 액션 | — | **Pre-Departure Timeline (G)** |
| 대안 | — | **Plan B & Visa-Run (H)** |
| 리소스 | 일부 링크 | **Resource Pack (I)** 큐레이션 |
| 리스크 | 1~2줄 | **Risk & Reality Check (J)** |
| Personalized Summary | — | **(A)** 입력 호명 인트로 |

---

## 4. 출력 스키마 확장안 (참고)

기존 스키마를 유지하면서 추가 키를 옵셔널로 붙이는 방식 권장 (하위 호환 안전):

```json
{
  "city": "...",
  "country_id": "...",
  "personalized_summary": "...",          // A
  "visa_decision": {                       // B
    "primary": {"name": "...", "qualifies": true, "reason": "..."},
    "alternatives": [...],
    "rejection_risks": [...]
  },
  "immigration_guide": { ... },            // 기존 유지
  "visa_checklist": [...],                 // 기존 유지
  "budget_forecast": {                     // C (budget_breakdown 확장)
    "monthly_household": {...},
    "one_time_setup": {...},
    "total_stay_projection_usd": 18500,
    "surplus_per_month_krw": 1200000
  },
  "tax_brief": {                           // D
    "residency_status": "...",
    "treaty_applies": true,
    "scenario": "..."
  },
  "lifestyle_fit": [                       // E
    {"tag": "해변", "score": 9, "evidence": "..."}
  ],
  "family_logistics": { ... },             // F (travel_type이 가족일 때만)
  "departure_timeline": [                  // G (first_steps 확장)
    {"d_day": -90, "items": [...]},
    {"d_day": -60, "items": [...]}
  ],
  "plan_b": { ... },                       // H
  "resource_pack": { ... },                // I
  "risk_check": [...]                      // J
}
```

---

## 5. 구현 우선순위 (제안)

| Phase | 항목 | 근거 |
|-------|------|------|
| P1 (즉시) | A · C · G | 입력 호명·예산·타임라인 — 지각가치 가장 큼. LLM 환각 위험 낮음. |
| P2 | B · F · J | 비자 판정·가족·리스크 — 정적 데이터(`visa_db.json`) 보강 필요. |
| P3 | D · E · H · I | 세금·라이프스타일·Plan B·리소스 — 데이터 큐레이션 비용 큼. |

---

## 6. 검토가 필요한 의사결정

1. **분량 인플레이션 vs 가독성**: 10개 섹션 모두 들어가면 보고서가 30페이지+가 된다. PDF 출력 시 페이지 구성 필요.
2. **LLM 비용**: 출력 토큰이 2~3배 늘면 PAYG cap 도달 속도가 빨라진다. 정적 데이터 활용 비율을 높여야 한다.
3. **다국어 (ko/en)**: 모든 신규 섹션에 영어 프롬프트 페어 필요.
4. **A/B 테스트**: 어떤 카테고리가 실제로 결제 전환에 기여하는지 측정 장치 필요(`billing_usage_ledger` 활용).
5. **"입력 호명"의 톤**: 너무 직접적이면 "감시당하는 느낌", 너무 추상적이면 개인화가 안 느껴짐. 카피 가이드 별도 필요.

---

## 7. 관련 파일

- `prompts/builder.py` — `_STEP2_SYSTEM_PROMPT`, `build_detail_prompt()`
- `api/parser.py` — Step 2 응답 파싱·마크다운 포맷
- `frontend/src/app/api/detail/route.ts` — BFF
- `frontend/src/app/[locale]/guide/[city_id]/page.tsx` — 보고서 렌더링
- `cowork/frontend/result-page-data-spec.md` — Step 1 데이터 명세
- `utils/planb.py` — 이미 구현된 비쉥겐 버퍼 로직 (H 섹션 재활용 가능)
