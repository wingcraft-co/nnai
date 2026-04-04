# Result 페이지 데이터 스펙

_Last updated: 2026-04-04_

## 1. 현재 API 응답 구조 (POST /api/recommend)

sessionStorage `nnai_result`에 저장되는 전체 JSON:

```json
{
  "markdown": "string (Step 1 결과 HTML 마크다운)",
  "cities": [/* top_cities와 동일 */],
  "parsed": {
    "top_cities": [
      {
        "city": "Prague",
        "city_kr": "프라하",
        "country": "Czech Republic",
        "country_id": "CZ",
        "visa_type": "없음 (솅겐 90일 활용)",
        "visa_url": "https://www.mzv.cz",
        "monthly_cost_usd": 1600,
        "score": 5.7,
        "reasons": [],
        "realistic_warnings": [],
        "plan_b_trigger": true,
        "references": []
      }
    ],
    "overall_warning": "솅겐 지역 입국 시 EES...",
    "_user_profile": {
      "nationality": "Korean",
      "income_usd": 3305,
      "income_krw": 500,
      "purpose": "원격 근무",
      "lifestyle": ["해변", "영어권"],
      "languages": ["영어 업무 수준"],
      "timeline": "1년 장기 체류",
      "preferred_countries": ["유럽"],
      "language": "한국어",
      "persona_type": "slow_nomad",
      "income_type": "",
      "travel_type": "혼자 (솔로)",
      "children_ages": [],
      "dual_nationality": false,
      "readiness_stage": "",
      "has_spouse_income": "없음",
      "spouse_income_krw": 0
    }
  }
}
```

## 2. 현재 result 페이지 필드 사용 현황

### 사용 중인 필드

| 필드 | 위치 | 용도 |
|------|------|------|
| `cities[].city_kr` | 도시 카드 | 도시명 |
| `cities[].country` | 도시 카드 | 국가명 |
| `cities[].visa_type` | 도시 카드 + 비교표 | 비자 유형 |
| `cities[].visa_url` | 도시 카드 | 비자 정보 링크 |
| `cities[].monthly_cost_usd` | 도시 카드 + 비교표 | 월 생활비 |
| `cities[].score` | 도시 카드 + 비교표 | 추천 점수 (0~10) |
| `cities[].plan_b_trigger` | 도시 카드 + 비교표 | 플랜B 검토 필요 여부 |
| `parsed.top_cities` | 비교표 | 비교표 렌더링 소스 |
| `parsed.overall_warning` | 경고 섹션 | 전체 경고 문구 |

### 미사용 필드

| 필드 | 값 | 미사용 이유 |
|------|------|------|
| `cities[].city` | `"Prague"` | 영문명 (city_kr만 표시) |
| `cities[].country_id` | `"CZ"` | ISO 코드 |
| `cities[].reasons` | `[]` | DB 경로에서 빈 배열 반환 |
| `cities[].realistic_warnings` | `[]` | DB 경로에서 빈 배열 반환 |
| `cities[].references` | `[]` | DB 경로에서 빈 배열 반환 |
| `parsed._user_profile` | `{...}` | Step 2 (상세 가이드) 호출용 |
| `markdown` | HTML string | 카드 UI로 대체됨 |

> **참고:** `reasons`, `realistic_warnings`, `references`는 DB 경로(`USE_DB_RECOMMENDER=1`)에서 항상 빈 배열. LLM 경로에서만 채워짐.

## 3. 백엔드에서 제공 가능한 추가 데이터

### 3-1. city_scores.json (50개 도시)

현재 API 응답에 포함되지 않지만, 백엔드에서 조회 가능한 도시별 상세 데이터:

| 필드 | 타입 | 설명 | 활용 가능성 |
|------|------|------|:---:|
| `internet_mbps` | `int` | 인터넷 속도 (Mbps) | 높음 |
| `safety_score` | `int (0~10)` | 치안 점수 | 높음 |
| `english_score` | `int (0~10)` | 영어 통용도 | 높음 |
| `nomad_score` | `int (0~10)` | 노마드 적합도 | 높음 |
| `climate` | `string` | 기후 (tropical, continental 등) | 중간 |
| `cowork_usd_month` | `int` | 코워킹 월비용 (USD) | 높음 |
| `coworking_score` | `int (0~10)` | 코워킹 인프라 점수 | 중간 |
| `community_size` | `string` | 노마드 커뮤니티 규모 (large/medium/small) | 높음 |
| `mid_term_rent_usd` | `int` | 중기 임대료 (USD/월) | 높음 |
| `tax_residency_days` | `int` | 세금 거주지 기준일 | 중간 |
| `korean_community_size` | `string` | 한인 커뮤니티 규모 | 높음 |
| `flatio_search_url` | `string` | Flatio 숙소 검색 URL | 높음 |
| `anyplace_search_url` | `string` | Anyplace 숙소 검색 URL | 높음 |
| `nomad_meetup_url` | `string` | 노마드 밋업 URL | 높음 |
| `entry_tips.round_trip_required` | `bool` | 왕복 항공권 필수 여부 | 높음 |
| `entry_tips.round_trip_note` | `string` | 왕복 항공권 주의사항 | 높음 |
| `entry_tips.visa_run_options` | `array` | 비자런 옵션 (목적지, 방법, 시간, 비용) | 높음 |
| `entry_tips.work_disclosure_risk` | `string` | 입국심사 시 원격근무 언급 리스크 | 높음 |
| `source_refs` | `array` | 데이터 출처 목록 | 낮음 |
| `data_verified_date` | `string` | 데이터 검증일 | 중간 |

### 3-2. visa_db.json (39개국)

국가별 비자 상세 데이터:

| 필드 | 타입 | 설명 | 활용 가능성 |
|------|------|------|:---:|
| `name_kr` | `string` | 국가 한글명 | 높음 |
| `min_income_usd` | `int` | 최소 소득 기준 (USD/월) | 높음 |
| `stay_months` | `int` | 체류 기간 (월) | 높음 |
| `renewable` | `bool` | 갱신 가능 여부 | 높음 |
| `key_docs` | `array[string]` | 필요 서류 목록 | **매우 높음** |
| `visa_fee_usd` | `int` | 비자 수수료 (USD) | 높음 |
| `tax_note` | `string` | 세금 요약 | 높음 |
| `cost_tier` | `string` | 물가 수준 (low/medium/high) | 중간 |
| `notes` | `string` | 비자 참고사항 | 높음 |
| `source` | `string` | 공식 출처 URL | 높음 |
| `schengen` | `bool` | 쉥겐 국가 여부 | 중간 |
| `buffer_zone` | `bool` | 쉥겐 버퍼존 국가 | 중간 |
| `double_tax_treaty_with_kr` | `bool` | 한국과 이중과세 방지 협약 | 높음 |
| `mid_term_rental_available` | `bool` | 중기 임대 가능 여부 | 중간 |
| `ees_applicable` | `bool` | EES 적용 여부 | 중간 |
| `income_tiers` | `array` | 소득 기준 상세 (직군별) | 중간 |
| `data_verified_date` | `string` | 데이터 검증일 | 중간 |
| `visa_notes` | `array[string]` | 비자 추가 주의사항 | 높음 |

### 3-3. Step 2 상세 가이드 (POST /api/detail)

LLM (Gemini 2.5 Flash) 호출로 생성되는 도시별 상세 정착 가이드:

| 필드 | 설명 |
|------|------|
| `immigration_guide.title` | 가이드 제목 |
| `immigration_guide.sections` | 단계별 섹션 (step, title, items) |
| `visa_checklist` | 비자 준비 체크리스트 |
| `budget_breakdown` | 월 예산 (rent, food, cowork, insurance, misc) |
| `budget_source` | 예산 출처 (Numbeo URL) |
| `first_steps` | 첫 실행 스텝 |
| 숙소 딥링크 | Flatio, Anyplace, 노마드 밋업 링크 |
| 플랜B 제안 | 쉥겐 90일 소진 후 비쉥겐 대안 국가 |
| 세금 경고 | 세금 거주지 경고 (country_id + timeline 기반) |

**호출 방법:**
```json
POST /api/detail
{
  "parsed_data": {
    "top_cities": [...],
    "_user_profile": {...}
  },
  "city_index": 0  // 0, 1, 2 중 선택
}
```

**응답:** `{ "markdown": "...(상세 가이드 HTML 마크다운)" }`

### 3-4. 백엔드 유틸리티 함수들

| 모듈 | 함수 | 설명 |
|------|------|------|
| `utils/tax_warning.py` | `get_tax_warning(country_id, timeline, language)` | 세금 거주지 경고 생성 |
| `utils/accommodation.py` | `get_accommodation_links(city_name)` | Flatio/Anyplace/밋업 딥링크 |
| `utils/planb.py` | `get_planb_suggestions(country_id, language, max)` | 쉥겐 버퍼존 국가 추천 |
| `api/schengen_calculator.py` | `SCHENGEN_COUNTRIES` | 쉥겐 국가 목록 |
| `api/parser.py` | `generate_comparison_table(top_cities, language)` | 도시 비교 HTML 테이블 |

## 4. result 페이지에서 활용 가능한 데이터 요약

### 현재 사용 중 (API 응답에 포함)
- 도시명, 국가명, 비자 유형, 비자 URL, 월 생활비, 추천 점수, 플랜B 트리거, 전체 경고

### 추가 활용 가능 (백엔드 수정 필요)
- **도시 상세**: 인터넷 속도, 치안, 영어 통용도, 코워킹 비용, 중기 임대료, 한인 커뮤니티 규모
- **비자 상세**: 필요 서류, 비자 수수료, 체류 기간, 갱신 가능 여부, 세금 요약
- **입국 팁**: 왕복 항공권 필수 여부, 비자런 옵션, 원격근무 언급 리스크
- **외부 링크**: Flatio, Anyplace, 노마드 밋업 그룹
- **상세 가이드**: Step 2 API 호출 (LLM 기반, 비자 체크리스트 + 예산 + 실행 스텝)

### 백엔드 수정 없이 가능
- `parsed._user_profile` 기반 개인화 메시지 (페르소나, 소득, 타임라인 등)
- `cities` 배열 기반 비교 로직 (프론트에서 직접 정렬/하이라이트)
- `POST /api/detail` 호출 (이미 구현된 엔드포인트)

### 백엔드 수정 필요
- city_scores.json 데이터를 API 응답에 포함 (recommender.py에서 city dict를 확장)
- visa_db.json 상세 데이터를 API 응답에 포함 (key_docs, visa_fee 등)
