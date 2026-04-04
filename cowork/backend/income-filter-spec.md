# 소득 필터링 로직 분석 — POST /api/recommend

_Last updated: 2026-04-03_

## 환율 변환 기준

```
income_usd = income_krw × 10,000 × USD_rate
```

- 실시간 API: `exchangerate-api.com/v4/latest/KRW`
- **Fallback: 1 USD ≈ 1,400 KRW** (`usd_rate = 0.000714`)
- `income_krw`는 **만원 단위** → `× 10,000`으로 원 단위 변환 후 달러 변환
- 소스: `utils/currency.py`, `app.py:66-73`

## 필터링 로직

### 하드필터 (recommender.py:127-129)

```python
def _passes_income_filter(country: dict, income_usd: float) -> bool:
    min_inc = country.get("min_income_usd") or 0
    return income_usd >= min_inc
```

- `visa_db.json`의 각 국가 `min_income_usd` 필드와 비교
- 미달 시 해당 국가의 **모든 도시가 후보에서 제거**됨

### 스코어링 (recommender.py:78-85)

```python
def _cost_inverse_score(monthly_cost_usd, income_usd):
    ratio = monthly_cost_usd / income_usd
    score = 10.0 × max(0.0, 1.0 - ratio / 1.0)
```

- 생활비/소득 비율이 낮을수록 높은 점수 (가중치 20%)
- ratio 0.2 → 10점, ratio 1.0 → 0점

### 쉥겐 장기체류 필터 (recommender.py:151-159)

- timeline이 "3년 장기 체류" 또는 "5년 이상 초장기 체류"
- + 쉥겐 국가
- + 소득 < $2,849/월
- → 해당 국가 **제외**

## 국가별 min_income_usd 전체 목록

| 국가 ID | 국가명 | min_income_usd |
|:---:|------|---:|
| TH | Thailand | $0 |
| VN | Vietnam | $0 |
| CZ | Czech Republic | $0 |
| RS | Serbia | $0 |
| MK | North Macedonia | $0 |
| MA | Morocco | $0 |
| UY | Uruguay | $0 |
| PY | Paraguay | $0 |
| QA | Qatar | $0 |
| AL | Albania | $820 |
| CO | Colombia (Medellín) | $1,100 |
| NL | Netherlands | $1,400 |
| BR | Brazil | $1,500 |
| CV | Cape Verde | $1,600 |
| MY | Malaysia | $2,000 |
| GE | Georgia | $2,000 |
| PH | Philippines | $2,000 |
| CA | Canada | $2,500 |
| MT | Malta | $2,700 |
| AR | Argentina | $2,750 |
| BG | Bulgaria | $2,800 |
| ES | Spain (Canary Islands) | $3,000 |
| CR | Costa Rica | $3,000 |
| PA | Panama | $3,000 |
| HU | Hungary | $3,300 |
| TW | Taiwan | $3,333 |
| DE | Germany | $3,500 |
| SI | Slovenia | $3,500 |
| CY | Cyprus | $3,500 |
| AE | UAE (Dubai) | $3,500 |
| HR | Croatia | $3,600 |
| GR | Greece | $3,850 |
| PT | Portugal | $4,000 |
| RO | Romania | $4,000 |
| MX | Mexico | $4,300 |
| KE | Kenya | $4,583 |
| EE | Estonia | $4,900 |
| ID | Indonesia (Bali) | $5,000 |
| JP | Japan | $5,583 |

- 총 39개국
- 최솟값: $0 (9개국 — 소득 무관)
- 최댓값: $5,583 (일본)

## 소득 구간별 통과 국가 수

| income_krw (만원) | ≈ USD/월 | 통과 국가 수 (39개 중) | 비고 |
|:---:|:---:|:---:|------|
| 100 | $714 | 9 | min=0인 국가만 (태국, 베트남, 체코 등) |
| 200 | $1,428 | 14 | + 알바니아, 콜롬비아, 네덜란드 등 |
| 300 | $2,142 | 19 | + 말레이시아, 조지아, 필리핀 등 |
| 400 | $2,857 | 24 | + 캐나다, 말타, 아르헨티나, 불가리아 등 |
| 500 | $3,571 | 33 | + 유럽 대부분 (독일, 스페인, 그리스 등) |
| 600 | $4,285 | 35 | + 포르투갈, 루마니아, 멕시코 |
| 700 | $5,000 | 37 | + 케냐, 에스토니아 |
| 800 | $5,714 | 39 | 전체 통과 (일본 포함) |

## 프론트엔드 소득 구간 버튼 설계 참고

### 핵심 컷오프

| 구간 | 의미 |
|------|------|
| **~200만원** | 동남아 + 동유럽 일부만 가능 |
| **~300만원** | 동남아 전체 + 중남미 일부 |
| **~500만원** | 유럽 대부분 열림 |
| **~700만원 이상** | 거의 전체 (일본, 에스토니아 포함) |

### 권장 구간 버튼 (5단계)

```
200만원 이하 / 200~300만원 / 300~500만원 / 500~700만원 / 700만원 이상
```

또는 슬라이더:
- 범위: 100~1000만원
- 스텝: 50만원
- 기본값: 300만원

### 참고

- "무소득 / 은퇴" 선택 시 income_krw는 "월 가용 예산"으로 해석됨
- income_krw=0이면 $0 → min_income_usd=0인 9개국만 통과
- 배우자 소득은 LLM 프롬프트 힌트에만 사용, DB 하드필터에는 미반영
