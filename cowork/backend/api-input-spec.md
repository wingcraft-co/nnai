# POST /api/recommend — 인풋 스펙 분석

_Last updated: 2026-04-05_

## 전체 인풋 필드

| 필드 | 타입 | 기본값 | DB 필터 | LLM 프롬프트 | 영향도 |
|------|------|--------|:---:|:---:|:---:|
| `nationality` | `str` | — | warning 생성 | 직접 삽입 | 중간 |
| `income_krw` | `int` | — | 하드필터 (소득) | 직접 삽입 | **핵심** |
| `immigration_purpose` | `str` | — | — | 직접 삽입 | 사용 |
| `lifestyle` | `list[str]` | — | 소프트 스코어링 | 직접 삽입 | 사용 |
| `languages` | `list[str]` | — | — | 직접 삽입 | 낮음~중간 |
| `timeline` | `str` | — | 하드필터 (체류기간) | 힌트 삽입 | **핵심** |
| `preferred_countries` | `list[str]` | `[]` | 하드필터 (대륙) | 힌트 삽입 | **핵심** |
| `preferred_language` | `str` | `"한국어"` | warning 언어 | 프롬프트 언어 | 사용 |
| `persona_type` | `str\|null` | `null` | — | 페르소나 힌트 + 로그인 유저 DB 저장 | 사용 |
| `income_type` | `str` | `""` | — | 소득 증빙 힌트 | 사용 |
| `travel_type` | `str` | `"혼자 (솔로)"` | — | 동행 힌트 | 중간 |
| `children_ages` | `list[str]\|null` | `null` | — | 자녀 동반 힌트 | 조건부 |
| `dual_nationality` | `bool` | `false` | — | 복수국적 힌트 | 낮음 |
| `readiness_stage` | `str` | `""` | — | 준비 단계 힌트 | 낮음 |
| `has_spouse_income` | `str` | `"없음"` | — | 합산 소득 힌트 | 조건부 |
| `spouse_income_krw` | `int` | `0` | — | 합산 소득 계산 | 조건부 |
| `stay_style` | `str\|null` | `null` | 스코어링 보정 | — | 중간 |
| `tax_sensitivity` | `str\|null` | `null` | 스코어링 보정 | — | 중간 |

## DB 필터 vs LLM 프롬프트

### DB 하드필터 (recommender.py)
추천 후보 도시를 **물리적으로 제거**하는 필터. 결과에 절대적 영향.

- `income_krw` → USD 변환 후 국가별 최소 소득 기준 비교
- `timeline` → 체류 기간 + 비자 갱신 가능 여부 필터
- `preferred_countries` → 선택 대륙에 속한 국가만 통과
- `nationality` → 한국 국적 시 건보 경고 생성 (필터는 아님)

### DB 소프트 스코어링
- `lifestyle` → 코워킹/안전/저물가 등 매칭 점수 (가중치 20%)
- `income_krw` → 생활비 대비 소득 비율 점수 (가중치 20%)
- `stay_style` → 비자 접근성 가중치 보정 (`정착형/이동형`)
- `tax_sensitivity` → 조세 협약 보너스 가중치 보정 (`optimize/simple/unknown`)

### LLM 프롬프트만 사용 (Gemini 자율 판단)
DB 필터를 통과한 TOP 3에 대해 Gemini가 상세 추천문을 생성할 때 참고.

- `languages` — 영어권 도시 가중 여부
- `persona_type` — 페르소나별 추천 톤 조정
- `income_type` — 소득 증빙 방식별 비자 주의사항
- `travel_type` — 동행 유형별 인프라 강조 (국제학교, 안전 등)
- `readiness_stage` — 준비 단계별 정보 깊이 조절
- `dual_nationality` — 보조 여권 활용 안내
- `has_spouse_income` / `spouse_income_krw` — 합산 소득 비자 힌트

## 주요 필드 상세 분석

### nationality (국적)
- **DB**: 필터링 아님. `"한국"` 시 건보 경고 생성
- **LLM**: 프롬프트에 직접 삽입 → Gemini가 국적 기반 비자 조건 참고
- **영향도**: 중간

### languages (구사 언어)
- **DB**: 미사용 (스코어링에도 관여 안 함)
- **LLM**: 텍스트로 전달 → Gemini 자율 판단
- **영향도**: 낮음~중간

### travel_type (동행 유형)
- **DB**: 미사용
- **LLM**: 힌트 매핑 존재
  - `"혼자 (솔로)"` → 코워킹, 노마드 커뮤니티 강조
  - `"배우자/파트너 동반"` → 동반비자, 합산소득
  - `"자녀 동반"` → 국제학교, 의료, 안전
  - `"가족 전체 동반"` → 위 전부 + 주거 면적
- **영향도**: 중간

### readiness_stage (준비 단계)
- **DB**: 미사용
- **LLM**: **4개 옵션 중 2개만 힌트 존재**
  - `"막연하게 고민 중"` → 개요 중심 추천
  - `"이미 출국했거나 출국 임박"` → 체크리스트 우선
  - `"아직 정보 수집 중"` → **힌트 없음 (무시됨)**
  - `"구체적으로 준비 중"` → **힌트 없음 (무시됨)**
- **영향도**: 낮음 (대부분 옵션에서 실질 영향 없음)
- **현재 폼 상태**: 최신 온보딩 폼은 readiness 입력을 받지 않아 보통 빈 문자열로 전달됨

### preferred_countries (선호 지역)
- **DB**: **하드필터** — 선택한 대륙의 국가만 후보에 포함
- **LLM**: 우선 고려 힌트 삽입
- **영향도**: **핵심** (결과를 근본적으로 변경)

## 영향 미미한 필드 정리

| 필드 | 이유 |
|------|------|
| `readiness_stage` | 4개 옵션 중 2개만 힌트 존재. 나머지는 무시됨 |
| `languages` | DB 미사용. Gemini 참고 수준 |
| `dual_nationality` | `true`일 때만 한 줄 힌트. 대부분 `false` |

## 프론트엔드 폼 ↔ 백엔드 필드 매핑

| 프론트엔드 폼 필드 | 백엔드 API 필드 | 비고 |
|-------------------|----------------|------|
| 국적 | `nationality` | |
| 복수국적 | `dual_nationality` | |
| 구사 언어 | `languages` | |
| 체류 목적 | `immigration_purpose` | |
| 체류 기간 | `timeline` | |
| 라이프스타일 | `lifestyle` | 최대 3개 |
| 동행 유형 | `travel_type` | |
| 자녀 나이 | `children_ages` | 자녀 동반 시만 |
| 배우자 소득 | `has_spouse_income` | |
| 배우자 월 소득 | `spouse_income_krw` | 있음 시만 |
| 체류 스타일 | `stay_style` | 단기 체류가 아닐 때 |
| 세금 민감도 | `tax_sensitivity` | 단기 체류가 아닐 때 |
| 소득 유형 | `income_type` | |
| 월 소득 | `income_krw` | 만원 단위 |
| 선호 지역 | `preferred_countries` | |
| 준비 단계 | `readiness_stage` | |
| (자동) | `preferred_language` | `"한국어"` 고정 |
| (자동) | `persona_type` | localStorage에서 |
