# Block C Dominance Penalty 적용 설계

**날짜:** 2026-04-09  
**대상 파일:** `recommender.py`  
**상태:** 승인됨

---

## 배경 및 문제

치앙마이($1,100/월, nomad=9, cowork=9, korean_community=large)가 라이프스타일·지역 선호를 지정하지 않은 거의 모든 프로필에서 TOP 3에 반복 등장한다.

근본 원인: `_block_a()`에서는 `_city_dominance_penalty`(최대 2.5)를 적용해 저비용+고nomad 클러스터를 억제하지만, `_block_c()`에서는 penalty가 전혀 없어 Block A에서 깎인 점수를 Block C에서 그대로 회복한다.

중소득/라이프없음 프로필 기준:

| 블록 | 치앙마이 | Amsterdam |
|------|---------|-----------|
| A (30%) | 1.716 | 2.430 |
| B (25%) | **0.938** | 0.250 |
| C (25%) | **2.167** | 2.125 |
| D (20%) | 1.366 | 1.479 |
| **합계** | **6.2** | **6.3** |

Block B(저비용)와 Block C(nomad/cowork 최고점)가 동시에 치앙마이를 상위로 끌어올린다.

---

## 설계

### 변경 대상

`recommender.py` — `_block_c()` 함수만 수정.

### 변경 내용

**1. `_block_c()` 시그니처에 `lifestyle` 파라미터 추가**

```python
# 변경 전
def _block_c(city, country, persona_type, income_usd) -> float:

# 변경 후
def _block_c(city, country, persona_type, income_usd, lifestyle=None) -> float:
```

**2. `_compute_score_breakdown()`에서 `lifestyle` 전달**

```python
c = _block_c(city, country, persona_type, income_usd, ls)
```

**3. `_block_c()` 내부에 dominance penalty 차감**

정규화 점수 계산 후, 페르소나별 스케일로 penalty를 차감한다.

```python
# 페르소나별 penalty 스케일
_BLOCK_C_PENALTY_SCALE = {
    "pioneer":     0.25,   # cost_score 가중치로 이미 반영됨
    "local":       0.40,   # 부분적 저비용 선호 가능
    "planner":     0.40,
    "wanderer":    0.60,
    "free_spirit": 0.60,
    "":            0.60,   # 페르소나 미지정
}

scale = _BLOCK_C_PENALTY_SCALE.get(persona_type or "", 0.60)
penalty = _city_dominance_penalty(city, lifestyle or [], income_usd)
normalized = max(0.0, normalized - penalty * scale)
return min(10.0, normalized) * 0.25
```

### 예상 효과

중소득/라이프없음(income=$3,000) 기준:

| 도시 | 현재 | 변경 후 | 순위 변화 |
|------|------|---------|----------|
| Chiang Mai | 6.2 | ~5.8 | 2위 → 7~8위 |
| Bali (Canggu) | 6.4 | ~6.0 | 소폭 하락 |
| Bangkok | 5.8 | ~5.5 | 소폭 하락 |
| Amsterdam | 6.3 | 6.3 | 유지 |
| Lisbon | 6.7 | 6.7 | 유지 |

pioneer + 저비용선호 프로필: 치앙마이 penalty가 0.25×로 완화되어 여전히 추천 가능.

---

## 테스트 계획

`tests/test_recommender.py`에 다음 케이스 추가:

1. **회귀 — 치앙마이 과다 선출 방지**  
   중소득($3,000) + 라이프스타일 없음 → 치앙마이 TOP 3 미등장 확인

2. **보호 — pioneer 페르소나**  
   소득 $2,000 + pioneer + 저비용선호 → 치앙마이 TOP 5 등장 가능 확인

3. **기존 동작 유지 — 고소득/코워킹**  
   소득 $6,000 + 코워킹중시 → Lisbon/Amsterdam 계열 유지 확인

---

## 범위 외

- Block B cost cap 변경 없음 (이 설계에서는 불필요)
- 다른 블록(A, D) 변경 없음
- 데이터(city_scores.json, visa_db.json) 변경 없음
