# 백엔드 스코어링 현황 분석
_작성일: 2026-04-05 (KST)_

---

## 1. rawdata CSV 컬럼

### `city_scores.csv` (24 컬럼)
```
city_id, city_en, city_ko, country_code, country_id_2, monthly_cost_usd,
internet_mbps, safety_score, english_score, nomad_score, climate,
cowork_usd_month, coworking_score, community_size, mid_term_rent_usd,
tax_residency_days, flatio_search_url, anyplace_search_url, nomad_meetup_url,
korean_community_size, round_trip_required, work_disclosure_risk,
source_refs, data_verified_date
```

### `nomad_countries_metadata.csv` (27 컬럼)
```
country_code, country_name_en, country_name_ko, capital, currency, timezone,
primary_language, monthly_cost_usd_mid, rent_1br_city_usd, meal_avg_usd,
transport_monthly_usd, internet_speed_mbps, internet_reliability,
avg_temp_celsius, climate_type, rainy_season, dry_season,
coworking_spaces_level, english_level, gpi_rank_2024,
nomad_popularity_rank, nomad_visa_available, notes, last_verified,
schengen, cost_tier, tax_residency_days, double_tax_treaty_with_kr
```

### `nomad_visa_relations.csv` (26 컬럼)
```
country_code, country_name_en, country_name_ko, korea_visa_free_days,
korea_entry_type, nomad_visa_available, nomad_visa_name,
nomad_visa_income_req_usd, nomad_visa_fee_usd, nomad_visa_duration_months,
nomad_visa_renewable, tourist_visa_notes, source_notes, last_verified,
schengen, ees_applicable, buffer_zone, tax_residency_days,
double_tax_treaty_with_kr, cost_tier, mid_term_rental_available,
key_docs, tax_note, income_period, income_tiers_note, official_source_url
```

---

## 2. JSON 파일 키

### `city_scores.json` (23 키)
```
id, city, city_kr, country, country_id, monthly_cost_usd, internet_mbps,
safety_score, english_score, nomad_score, climate, cowork_usd_month,
coworking_score, community_size, mid_term_rent_usd, tax_residency_days,
flatio_search_url, anyplace_search_url, nomad_meetup_url,
korean_community_size, entry_tips, source_refs, data_verified_date
```

### `visa_db.json` (23 키)
```
id, name, name_kr, visa_type, min_income_usd, stay_months, renewable,
key_docs, visa_fee_usd, tax_note, cost_tier, notes, source, schengen,
buffer_zone, tax_residency_days, double_tax_treaty_with_kr,
mid_term_rental_available, income_period, ees_applicable,
income_tiers, data_verified_date, visa_notes
```

### `data/` 전체 JSON 목록
`ads_config.json`, `city_descriptions.json`, `city_insights.json`, `city_scores.json`, `source_catalog.json`, `visa_db.json`, `visa_urls.json`

---

## 3. 스코어링 로직 (`recommender.py`)

### Hard Filters (4개)

| 필터 | 사용 필드 | 로직 |
|------|----------|------|
| `_passes_income_filter` | `income_usd` vs `country.min_income_usd` | 소득 < 최소 요구 → 제외 |
| `_passes_timeline_filter` | `timeline` vs `country.stay_months`, `renewable` | 체류기간 미달 or 갱신불가(장기) → 제외 |
| `_passes_continent_filter` | `preferred_countries` vs `_CONTINENT_TO_IDS` 매핑 | 선택 대륙에 없는 국가 → 제외 |
| `_passes_schengen_long_stay_filter` | 솅겐 + 장기체류 + 소득 < $2,849 | 조건 불충분 → 제외 |

### Soft Scoring (가중합 0~10)

| 항목 | 비중 | 데이터 소스 | 비고 |
|------|------|------------|------|
| `nomad_score` | 30% | city_scores.json (고정값) | DB 고정 |
| `safety_score` | 20% | city_scores.json (고정값) | DB 고정 |
| `cost_inverse` | 20% | `monthly_cost_usd` / `income_usd` | **유일한 동적 계산** |
| `lifestyle` | 20% | `_LIFESTYLE_MATCH` 5개 키 매칭 | **키 불일치 문제** |
| `english_score` | 10% | city_scores.json (고정값) | DB 고정 |

**핵심 문제: DB 고정값이 60% (nomad 30% + safety 20% + english 10%), 사용자 입력 영향은 cost 20% + lifestyle 20% = 40%인데, lifestyle마저 키 불일치로 사실상 cost 20%만 동적.**

---

## 4. 프론트엔드 → 백엔드 필드 불일치 분석

### 전체 데이터 흐름
```
Frontend form → POST /api/recommend (server.py RecommendRequest)
→ nomad_advisor() (app.py) → user_profile dict
→ recommend_from_db() (recommender.py)
```

### 필드별 사용 현황

| 필드 | 프론트 전송값 | 백엔드 실사용 | 상태 |
|------|-------------|-------------|------|
| `nationality` | `"한국"` (고정) | warning 생성에만 사용 | OK |
| `income_krw` | `150/250/400/600/800/0` | → `income_usd` 변환 → hard filter + cost score | **핵심 필드** |
| `immigration_purpose` | `"원격 근무"` 등 | `user_profile["purpose"]`로 저장, **recommender에서 미사용** | 사실상 무시 |
| `lifestyle` | `["해변","안전","영어권"]` 등 | `_LIFESTYLE_MATCH` 매칭 시도 | **키 불일치** |
| `languages` | `[]` (고정 빈배열) | `user_profile`에 저장, **recommender에서 미사용** | 무시 |
| `timeline` | `"1~3개월 단기 체류"` 등 | hard filter (`_TIMELINE_FILTER`) | **키 불일치** |
| `preferred_countries` | `["아시아","유럽"]` 등 | hard filter (`_CONTINENT_TO_IDS`) | OK |
| `preferred_language` | `"한국어"` (고정) | warning 언어 결정 | OK |
| `persona_type` | localStorage값 | `user_profile`에 저장, **recommender에서 미사용** | 무시 |
| `income_type` | `""` (고정) | `user_profile`에 저장, **recommender에서 미사용** | 무시 |
| `travel_type` | `"혼자 (솔로)"` 등 | `user_profile`에 저장, **recommender에서 미사용** | 무시 |
| `children_ages` | 조건부 | `user_profile`에 저장, **recommender에서 미사용** | 무시 |
| `dual_nationality` | `false` (고정) | `user_profile`에 저장, **recommender에서 미사용** | 무시 |
| `readiness_stage` | `""` (고정) | `user_profile`에 저장, **recommender에서 미사용** | 무시 |
| `has_spouse_income` | 조건부 | `user_profile`에 저장, **recommender에서 미사용** | 무시 |
| `spouse_income_krw` | 조건부 | `user_profile`에 저장, **recommender에서 미사용** | 무시 |

### 키 불일치 상세

**lifestyle 불일치:**

| 프론트 전송값 | 백엔드 `_LIFESTYLE_MATCH` 키 | 매칭 |
|-------------|---------------------------|------|
| `"해변"` | (해당 키 없음) | X |
| `"산/자연"` | (해당 키 없음) | X |
| `"도시"` | (해당 키 없음) | X |
| `"카페 문화"` | (해당 키 없음) | X |
| `"영어권"` | `"영어권 선호"` | X (다른 문자열) |
| `"코워킹 스페이스"` | `"코워킹스페이스 중시"` | X (다른 문자열) |
| `"저물가"` | `"저비용 생활"` | X (다른 문자열) |
| `"안전"` | `"안전 중시"` | X (다른 문자열) |

→ **8개 중 0개 매칭. lifestyle 점수는 항상 0점**

**timeline 불일치:**

| 프론트 전송값 | 백엔드 `_TIMELINE_FILTER` 키 | 매칭 |
|-------------|--------------------------|------|
| `"1~3개월 단기 체류"` | `"90일 단기 체험"` | X |
| `"6개월 중기 체류"` | `"6개월 단기 체험"` | X |
| `"1년 장기 체류"` | `"1년 단기 체험"` | X |
| `"영주권/이민 목표"` | `"3년 장기 체류"` / `"5년 이상 초장기 체류"` | X |

→ **timeline 매칭 실패 → `_passes_timeline_filter`가 항상 True 반환 → 체류기간 필터 무효화**

---

## 5. 요약

### 실제로 추천 결과에 영향을 주는 필드
1. `income_krw` → hard filter + cost score (유일한 동적 점수)
2. `preferred_countries` → hard filter (대륙 필터)

### 구조적으로 무시되는 필드
- `lifestyle` → 키 불일치로 0점 고정
- `timeline` → 키 불일치로 필터 무효화
- `immigration_purpose`, `persona_type`, `income_type`, `travel_type`, `children_ages` 등 → recommender에서 아예 참조 안 함
