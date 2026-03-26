# DB 기반 추천 시스템 설계 스펙

**날짜**: 2026-03-25
**브랜치**: db
**목표**: Step 1 LLM 호출 제거 — DB 필터링·랭킹으로 대체, Step 2 LLM 유지

---

## 1. 배경 및 목표

현재 `nomad_advisor()`는 Step 1(도시 추천)과 Step 2(상세 가이드) 모두 LLM을 호출한다.
배포 서비스에서 실제 사용자가 증가할수록 LLM 비용이 선형으로 증가하는 문제가 있다.

**목표**: Step 1을 `visa_db.json` + `city_scores.json` 기반 규칙 엔진으로 교체하여 LLM 호출을 50% 절감한다. Step 2(상세 가이드)는 LLM 품질을 유지한다.

---

## 2. 아키텍처 변경

### 현재 흐름

```
사용자 입력 → validate_user_profile() → LLM (8192 tokens) → parse_response() → format_step1_markdown()
                                                                                        ↓
                                              [Step 2] → LLM (6144 tokens) → format_step2_markdown()
```

### 변경 후 흐름

```
사용자 입력 → validate_user_profile() → recommend_from_db() → format_step1_markdown()
                                         (recommender.py)              ↓
                                              [Step 2] → LLM (6144 tokens) → format_step2_markdown()
```

---

## 3. 파일 변경 범위

| 파일 | 변경 종류 | 내용 |
|------|----------|------|
| `recommender.py` | **신규** | DB 기반 필터링·랭킹 엔진 |
| `app.py` | **수정** | `nomad_advisor()`에 토글 분기 추가 |
| `api/parser.py` | **수정** | `generate_comparison_table()` 및 `_inject_visa_urls()` 데이터 경로를 `database/` 우선으로 수정 |
| 나머지 모든 파일 | **무변경** | `format_step1_markdown()` 등 기존 포맷터 재사용 |

---

## 4. 토글 메커니즘

환경변수로 기존 LLM 경로를 완전히 보존하여 롤백 가능하게 한다.

```bash
USE_DB_RECOMMENDER=1   # DB 모드 (기본값)
USE_DB_RECOMMENDER=0   # LLM 모드 (기존 동작)
```

`app.py`의 `nomad_advisor()` 내부:

```python
if os.getenv("USE_DB_RECOMMENDER", "1") == "1":
    parsed = recommend_from_db(user_profile)
else:
    # 기존 LLM 경로 (코드 삭제 없이 보존)
    ...
    raw = query_model(messages, max_tokens=8192)
    parsed = parse_response(raw)

# 두 경로 모두 공통: _user_profile 주입 (format_step1_markdown이 timeline/language 참조)
parsed["_user_profile"] = user_profile
```

HF Space Secrets에서 값만 변경하면 즉시 전환 가능.

---

## 5. recommender.py 상세 설계

### 5-1. 하드 필터 (통과 못 하면 후보 제외)

| 조건 | 기준 |
|------|------|
| 소득 | `user.income_usd >= country.min_income_usd` |
| 체류기간 | timeline 문자열 → 숫자 매핑 (아래 표 참고) |
| 선호 대륙 | `preferred_countries` 선택 시 해당 대륙 국가만, 미선택 시 전체 |
| 쉥겐 장기 체류 | timeline이 `"3년 이상"` 또는 `"5년 이상"` + 쉥겐 국가 + `income_usd < 2849` → 제외 |

**timeline 문자열 → 필터 매핑**

`user_profile["timeline"]`은 UI에서 선택한 문자열 그대로 전달된다. 매핑:

| timeline 값 | stay_months 요구 | renewable 요구 |
|------------|----------------|---------------|
| `"90일 단기 체험"` | `>= 1` | 불필요 |
| `"1년 단기 체험"` | `>= 12` | 불필요 |
| `"3년 이상 장기 이민"` | `>= 12` | `== true` |
| `"5년 이상 장기 이민"` | `>= 12` | `== true` |

**preferred_countries 대륙 매핑**

`user_profile["preferred_countries"]`는 대륙 문자열 리스트다 (예: `["아시아", "유럽"]`).
대륙별 포함 국가 ID:

| 대륙 | 국가 ID 목록 |
|------|------------|
| `"아시아"` | TH, MY, ID, VN, PH, JP, AE |
| `"유럽"` | DE, PT, EE, ES, GR, HR, CZ, HU, SI, MT, CY, AL, RS, MK |
| `"중남미"` | CR, MX, CO, AR, BR |
| `"아프리카"` | MA |
| 미선택 (빈 리스트) | 전체 허용 |

### 5-2. 소프트 점수 가중 합산 (0~10)

도시(`city_scores.json`) 단위로 점수를 계산하고, 국가(`visa_db.json`)의 하드 필터를 통과한 도시만 대상으로 한다.

| 항목 | 가중치 | 기준 |
|------|--------|------|
| `nomad_score` | 30% | city_scores.json (0~10) |
| `safety_score` | 20% | city_scores.json (0~10) |
| 생활비 역수 | 20% | `1 - (monthly_cost_usd / max_cost_in_candidates)` |
| lifestyle 매칭 | 20% | 아래 매칭 테이블 참고 |
| `english_score` | 10% | `languages`에 `"영어"` 포함 시 가중치 2배 (20%), 나머지 항목 비율 유지 |

### 5-3. lifestyle 매칭 규칙

lifestyle 매칭 점수 = 매칭된 항목 수 / 전체 선택 항목 수 × 10

| 사용자 선택 lifestyle 값 | 매칭 조건 |
|------------------------|----------|
| `"코워킹스페이스 중시"` | `coworking_score >= 7` |
| `"한인 커뮤니티"` | `korean_community_size == "large"` |
| `"저비용 생활"` | `cost_tier == "low"` (visa_db) |
| `"안전 중시"` | `safety_score >= 8` |
| `"영어권 선호"` | `english_score >= 7` |
| 기타 항목 | 매칭 조건 없음 (무시) |

### 5-4. visa_url 주입

`recommend_from_db()`는 `visa_url` 필드를 직접 채우지 않고 빈 문자열로 둔다.
`api/parser.py`의 기존 `_inject_visa_urls()` 함수를 호출하여 `visa_urls.json`에서 주입한다.
`app.py`에서 `recommend_from_db()` 반환 후 `_inject_visa_urls(parsed)`를 명시적으로 호출한다.

### 5-5. 출력 포맷

기존 `parse_response()` 출력과 동일한 딕셔너리 구조를 반환한다.
`format_step1_markdown()`이 수정 없이 그대로 동작해야 한다.
`_user_profile` 키는 `app.py`에서 두 경로 공통으로 주입한다 (Section 4 참고).

```python
{
  "top_cities": [
    {
      "city": str,               # 영어
      "city_kr": str,            # 한국어
      "country": str,            # 영어
      "country_id": str,         # ISO-2
      "visa_type": str,
      "visa_url": "",            # app.py에서 _inject_visa_urls()로 채움
      "monthly_cost_usd": int,
      "score": float,            # 가중 점수 (0~10, 소수점 1자리)
      "reasons": [],             # 빈 리스트 — Step 2에서 LLM 설명 제공
      "realistic_warnings": [],  # 빈 리스트 (overall_warning으로 대체)
      "plan_b_trigger": bool,    # schengen == true이면 True
      "references": []
    }
  ],
  "overall_warning": str         # 아래 5-6 참고
}
```

### 5-6. overall_warning 자동 생성 규칙

조건에 해당하는 문구를 줄바꿈으로 연결한다.

| 조건 | 포함 문구 |
|------|---------|
| `nationality == "한국"` | "한국 국적자는 퇴직 후 2개월 이내 건강보험 임의계속가입 신청, 국민연금 납부예외 신청 필요" |
| top_cities 중 쉥겐 국가 포함 | "2025년 10월부터 EES(입출국 시스템) 시행으로 쉥겐 지역 90/180일 규칙 전자 추적됩니다" |
| top_cities 중 GE 포함 | "조지아는 2026-03-01부터 노동이민법 시행으로 장기 원격근무 비자 취득이 복잡해졌습니다" |

---

## 6. 데이터 파일 경로 통일

현재 `api/parser.py`의 `generate_comparison_table()`과 `_inject_visa_urls()`는 `data/` 경로를 하드코딩하고 있으나, git status 기준으로 `data/city_scores.json`, `data/visa_db.json`, `data/visa_urls.json`이 삭제된 상태다. `database/` 디렉토리에 최신 파일이 존재한다.

**수정 대상**: `api/parser.py` 내 모든 데이터 파일 로딩 경로를 `database/` 우선, `data/` 폴백 방식으로 수정한다.

```python
def _data_path(filename: str) -> str:
    base = os.path.dirname(os.path.dirname(__file__))
    db_path = os.path.join(base, "database", filename)
    if os.path.exists(db_path):
        return db_path
    return os.path.join(base, "data", filename)
```

`prompts/data_context.py`의 `_BASE` 경로도 동일하게 수정한다.

---

## 7. 비기능 요구사항

- Step 1 응답 시간: LLM 대비 100배 이상 빠름 (즉시 반환)
- 기존 256개 테스트 전부 통과 유지
- `USE_DB_RECOMMENDER=0`으로 설정 시 기존 동작 100% 동일

---

## 8. 범위 외 (이번 스펙에 포함 안 됨)

- Step 2 LLM 최적화
- RAG 코드 정리
- 추천 이유 자동 생성 (템플릿 방식)
