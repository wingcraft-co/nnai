# 스코어링 시나리오 테스트 결과
_테스트일: 2026-04-05 (KST)_
_테스트 환경: 로컬 recommender.py 직접 호출 (income_usd=2857, 약 400만원)_

---

## 시나리오 공통 조건

| 항목 | 값 |
|------|-----|
| nationality | 한국 |
| income_krw | 400 (만원) → income_usd ≈ $2,857 |
| preferred_countries | [] (전 세계) |
| immigration_purpose | 원격 근무 |

---

## 시나리오 A — 번아웃 탈출형 솔로

| 항목 | 값 |
|------|-----|
| persona_type | burnout_escape (자유로운 영혼) |
| travel_type | 혼자 (솔로) |
| timeline | 6개월 중기 체류 |
| stay_style | 정착형 |
| tax_sensitivity | unknown |
| lifestyle | 일하기 좋은 인프라 |

### 결과

| 순위 | 도시 | 국가 | 점수 | 월비용 | 비자 |
|------|------|------|------|--------|------|
| #1 | 치앙마이 | TH | 7.7 | $1,100 | DTV |
| #2 | 쿠알라룸푸르 | MY | 7.3 | $1,500 | DE Rantau |
| #3 | 암스테르담 | NL | 6.7 | $2,400 | 자영업 비자 |

**특징:** coworking_score + nomad_score 가중치가 높은 burnout_escape 성향 반영. 암스테르담이 3위 — 코워킹 인프라 최상위.

---

## 시나리오 B — 가족 동반 설계형

| 항목 | 값 |
|------|-----|
| persona_type | fire_optimizer (영리한 설계자) |
| travel_type | 가족 전체 동반 |
| timeline | 1년 장기 체류 |
| stay_style | 정착형 |
| tax_sensitivity | optimize |
| lifestyle | 저렴한 물가와 생활비 |

### 결과

| 순위 | 도시 | 국가 | 점수 | 월비용 | 비자 |
|------|------|------|------|--------|------|
| #1 | 치앙마이 | TH | 7.6 | $1,100 | DTV |
| #2 | 트빌리시 | GE | 7.2 | $1,000 | Remotely from Georgia |
| #3 | 페낭 | MY | 7.1 | $1,000 | DE Rantau |

**특징:** fire_optimizer의 safety + renewable + tax 가중치 반영. 트빌리시가 2위 — renewable True, 저비용, tax_residency_days 높음. 가족 동반이라 safety 가중치가 companion_score에 반영됨. 시나리오 A의 암스테르담/KL 대신 트빌리시/페낭으로 교체.

---

## 시나리오 C — 자유 이동형 개척자

| 항목 | 값 |
|------|-----|
| persona_type | expat_freedom (용감한 개척자) |
| travel_type | 혼자 (솔로) |
| timeline | 영주권/이민 목표 |
| stay_style | 이동형 |
| tax_sensitivity | optimize |
| lifestyle | 영어로 생활 가능 |

### 결과

| 순위 | 도시 | 국가 | 점수 | 월비용 | 비자 |
|------|------|------|------|--------|------|
| #1 | 치앙마이 | TH | 7.3 | $1,100 | DTV |
| #2 | 쿠알라룸푸르 | MY | 6.6 | $1,500 | DE Rantau |
| #3 | 트빌리시 | GE | 6.5 | $1,000 | Remotely from Georgia |

**특징:** expat_freedom의 cost_score 가중치 최대. 이동형 stay_style로 nomad_visa 보유 도시에 visa_score ×1.5 적용. "영어로 생활 가능" 라벨이 english_score 배율에 반영. 트빌리시 경고: 이중과세협약 미체결(tax_treaty=False) + 세금 거주지 리스크.

---

## 시나리오 간 TOP 3 비교

| 순위 | A (번아웃/솔로) | B (설계/가족) | C (개척/이동) |
|------|----------------|--------------|--------------|
| #1 | 치앙마이 (7.7) | 치앙마이 (7.6) | 치앙마이 (7.3) |
| #2 | **쿠알라룸푸르** (7.3) | **트빌리시** (7.2) | **쿠알라룸푸르** (6.6) |
| #3 | **암스테르담** (6.7) | **페낭** (7.1) | **트빌리시** (6.5) |

- 치앙마이가 3개 시나리오 모두 1위 — nomad 9, 저비용, renewable, community large 등 전방위 강점
- 2~3위는 페르소나별로 다르게 분화: A는 코워킹 도시(암스테르담), B는 제도 안정 도시(트빌리시, 페낭), C는 비용 효율 도시(KL, 트빌리시)
- 점수 범위도 차이: A(6.7~7.7), B(7.1~7.6), C(6.5~7.3)

---

## 발견된 이슈

### 이슈 1 — 프론트 API 테스트 시 시나리오 A, B 결과 동일

**현상:** `localhost:3000/api/recommend` 프록시 경유 시 시나리오 A와 B가 동일한 TOP 3(치앙마이/프라하/다낭), 동일 점수(5.9/5.5/5.5) 반환.

**원인:** 프론트 API Route(`/api/recommend/route.ts`)가 `https://api.nnai.app`(Railway production = main 브랜치)을 호출. main에는 스코어링 재설계가 미반영(구버전). persona_type, stay_style, tax_sensitivity 등 신규 필드가 무시됨.

**해결:** develop → main 머지 후 Railway 자동 배포로 해소 예정. 로컬 직접 호출(`recommender.py`)로는 정상 작동 확인됨.

### 이슈 2 — 치앙마이 1위 고정

**현상:** 3개 시나리오 모두 치앙마이가 1위.

**원인:** 치앙마이의 DB 고정값이 전방위 최상위(nomad 9, community large, cost $1,100, renewable True, stay 12m, tax_treaty True). Block A(30%) 기본 적합도에서 압도적 우위.

**평가:** 구조적 문제가 아닌 데이터 특성. 2~3위가 페르소나별로 다르게 분화되고 있으므로 스코어링 로직은 정상 작동. 치앙마이가 실제로 디지털 노마드 1위 도시인 점을 고려하면 합리적. 향후 도시 데이터 추가(50 → 100+) 시 자연스럽게 분산될 수 있음.

### 이슈 3 — income_usd 변환 오차

**현상:** 프론트에서 income_krw=400(만원) 전송 시 app.py에서 환율 API 호출 후 변환. 테스트에서는 고정값 $2,857 사용.

**영향:** 실시간 환율에 따라 소득 기반 필터링 결과가 달라질 수 있음. 테스트 재현성을 위해 income_usd 고정값 사용.
