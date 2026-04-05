# Result 페이지 데이터 스펙

_Last updated: 2026-04-05_

## 1) 데이터 소스 흐름

1. 온보딩 폼에서 `POST /api/recommend` 호출
2. Next Route Handler([frontend/src/app/api/recommend/route.ts])에서 백엔드 `POST /api/recommend` 응답 수신
3. 같은 Route Handler에서 로컬 데이터(`city_scores.json`, `visa_db.json`, `city_descriptions.json`, `city_insights.json`)를 합쳐 `cities`/`parsed.top_cities`를 enrichment
4. 최종 JSON을 프론트가 받아 `sessionStorage("nnai_result")`에 저장

즉, Result 페이지는 **이미 enrichment된 데이터**를 사용합니다.

## 2) Result 페이지 실제 사용 필드

기준 파일: `frontend/src/app/[locale]/result/page.tsx`

### 핵심 렌더링
- `cities[].city_kr`, `cities[].country`
- `cities[].visa_type`, `cities[].stay_months`, `cities[].renewable`
- `cities[].monthly_cost_usd`
- `cities[].city_description`, `cities[].city_insight`
- `cities[].visa_url`, `cities[].flatio_search_url`
- `cities[].data_verified_date`

### 점수/조언 생성용
- `cities[].safety_score`, `internet_mbps`, `english_score`, `nomad_score`
- `cities[].cowork_usd_month`, `mid_term_rent_usd`
- `cities[].korean_community_size`, `double_tax_treaty_with_kr`
- `parsed._user_profile.persona_type`, `travel_type`, `lifestyle`, `timeline`, `income_krw`

### 현재 미사용(보유)
- `anyplace_search_url`, `nomad_meetup_url`, `entry_tips`, `key_docs`, `visa_fee_usd`, `visa_notes` 등 일부

## 3) 현재 API 응답 구조(요약)

```json
{
  "markdown": "...",
  "cities": [
    {
      "city": "Lisbon",
      "city_kr": "리스본",
      "country": "Portugal",
      "country_id": "PT",
      "visa_type": "...",
      "monthly_cost_usd": 2200,
      "score": 9,

      "internet_mbps": 120,
      "safety_score": 8.1,
      "english_score": 8.6,
      "nomad_score": 8.9,
      "cowork_usd_month": 180,
      "korean_community_size": "medium",
      "mid_term_rent_usd": 1100,

      "stay_months": 12,
      "renewable": true,
      "key_docs": ["..."],
      "visa_fee_usd": 95,
      "tax_note": "...",

      "city_description": "...",
      "city_insight": "...",
      "flatio_search_url": "...",
      "anyplace_search_url": "...",
      "nomad_meetup_url": "...",
      "entry_tips": {"...": "..."},
      "data_verified_date": "..."
    }
  ],
  "parsed": {
    "top_cities": ["...동일 구조..."],
    "overall_warning": "...",
    "_user_profile": {
      "persona_type": "slow_nomad"
    }
  }
}
```

## 4) Step 2(`/api/detail`) 연동 상태

- 엔드포인트는 구현되어 있음
- Result 페이지 UI의 "더 알아보기" 버튼은 아직 `alert("준비 중이에요.")` 상태
- 따라서 Step 2 데이터는 현재 페이지에서 미사용

## 5) 구현 기준 정리

- Result 화면 고도화(카드/비교/필터)는 **백엔드 추가 수정 없이** 진행 가능
- 추가로 필요한 건 프론트 컴포넌트에서 이미 내려오는 필드를 활용하는 일
- Step 2 상세 가이드를 연결하려면 버튼 액션에서 `/api/detail` 호출만 붙이면 됨
