# NomadNavigator AI — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 국적·소득·라이프스타일을 입력하면 RAG 기반 Qwen3.5-27B가 최적의 디지털 노마드 거주 도시 TOP 3와 비자 체크리스트·예산을 담은 PDF를 생성하는 Gradio 앱을 완성한다.

**Architecture:** 유저 입력 → `prompts/builder.py`가 RAG 컨텍스트를 주입한 OpenAI-messages 리스트 구성 → `api/hf_client.py`가 HF Router를 통해 Qwen3.5-27B 호출 → `api/parser.py`가 JSON 파싱 → `report/pdf_generator.py`가 PDF 생성. RAG 레이어는 `rag/` 패키지가 BAAI/bge-m3 임베딩 + FAISS 인덱스로 관련 비자·도시 데이터를 검색한다. Gradio UI는 `ui/` 패키지가 담당하며 `app.py`가 모든 모듈의 진입점이다.

**Tech Stack:** Python 3.11+, Gradio 4.x, openai SDK (HF Router), huggingface_hub (InferenceClient), FAISS-CPU, ReportLab, python-dotenv, pytest

---

## 소유권 경계 (반드시 지킬 것)

| 담당 | 파일·폴더 |
|------|-----------|
| **아내** | `app.py`, `api/`, `rag/`, `report/`, `requirements.txt` |
| **남편** | `prompts/`, `data/`, `ui/`, `assets/` |
| **공통** | `.gitignore`, `README.md`, `.env.example` |

---

## 전체 파일 맵

```
nomad-navigator-ai/
├── app.py                       ← 진입점 (아내)
├── .env.example
├── .gitignore
├── requirements.txt
├── api/
│   ├── __init__.py
│   ├── hf_client.py             ← HF Router + Qwen3.5-27B (아내)
│   └── parser.py                ← JSON 파싱 (아내)
├── rag/
│   ├── __init__.py
│   ├── embedder.py              ← BAAI/bge-m3 임베딩 (아내)
│   ├── vector_store.py          ← FAISS 인덱스 빌드·저장 (아내)
│   ├── retriever.py             ← 쿼리 → 관련 청크 (아내)
│   └── build_index.py           ← 초기 빌드 스크립트 (아내)
├── report/
│   ├── __init__.py
│   └── pdf_generator.py         ← ReportLab PDF (아내)
├── prompts/
│   ├── __init__.py
│   ├── system.py                ← SYSTEM_PROMPT (남편)
│   ├── few_shots.py             ← FEW_SHOT_EXAMPLES (남편)
│   └── builder.py               ← RAG 주입 + messages 조합 (남편)
├── data/
│   ├── visa_db.json             ← 12개국 비자 데이터 (남편, 필리핀·베트남 포함)
│   └── city_scores.json         ← 20개 도시 점수 (남편)
├── ui/
│   ├── __init__.py
│   ├── theme.py                 ← Gradio 테마 (남편)
│   └── layout.py                ← Blocks 레이아웃 (남편)
├── assets/
│   ├── banner.png
│   └── logo.png
└── tests/
    ├── conftest.py
    ├── test_parser.py
    ├── test_embedder.py
    ├── test_vector_store.py
    ├── test_retriever.py
    ├── test_pdf_generator.py
    ├── test_builder.py
    └── test_integration.py
```

---

## 의존 관계 순서

```
Chunk 1 (부트스트랩)
    ↓
Chunk 2 (데이터: visa_db, city_scores)   ← 남편 담당, RAG의 입력
    ↓
Chunk 3 (API: hf_client, parser)         ← 아내 담당
Chunk 4 (RAG: embedder → vector_store → retriever)  ← 아내, Chunk 2 필요
    ↓
Chunk 5 (Prompts: system, few_shots, builder)  ← 남편, Chunk 4 필요
Chunk 6 (Report: pdf_generator)          ← 아내, 독립적
    ↓
Chunk 7 (UI: theme, layout)              ← 남편, 독립적
    ↓
Chunk 8 (통합: app.py + end-to-end)
```

---

## Chunk 1: 프로젝트 부트스트랩

### Task 1: 환경 파일 + 패키지 설치

**Files:**
- Create: `requirements.txt`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `tests/conftest.py`

- [ ] **Step 1-1: `requirements.txt` 작성**

```
gradio>=4.0
openai>=1.30
huggingface_hub>=0.24
faiss-cpu>=1.8
numpy>=1.26
reportlab>=4.0
python-dotenv>=1.0
pytest>=8.0
pytest-mock>=3.12
```

> ⚠️ `sentence-transformers` 불포함 — 임베딩은 HF InferenceClient(`BAAI/bge-m3`)로 수행하므로 불필요. 의존성 충돌 위험 있어 제외.

- [ ] **Step 1-2: `.env.example` 작성**

```
HF_TOKEN=hf_여기에_토큰_입력
```

- [ ] **Step 1-3: `.gitignore` 작성**

```
rag/index.faiss
rag/documents.pkl
.env
__pycache__/
*.pyc
*.pyo
.pytest_cache/
dist/
*.egg-info/
```

- [ ] **Step 1-4: 가상환경 생성 + 패키지 설치**

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Expected: `Successfully installed gradio-...` 등 패키지 목록 출력

- [ ] **Step 1-5: `tests/conftest.py` 작성**

```python
import os
import pytest

@pytest.fixture(autouse=True)
def set_test_env(monkeypatch):
    """모든 테스트에 더미 HF_TOKEN 주입 (실제 API 호출 방지)"""
    monkeypatch.setenv("HF_TOKEN", "hf_test_dummy_token")
```

- [ ] **Step 1-6: pytest 동작 확인**

```bash
pytest tests/ -v --collect-only
```

Expected: `no tests ran` (아직 테스트 없음, 수집 오류 없어야 함)

- [ ] **Step 1-7: 패키지 `__init__.py` 빈 파일 일괄 생성**

```bash
touch api/__init__.py rag/__init__.py report/__init__.py prompts/__init__.py ui/__init__.py
mkdir -p data assets
```

- [ ] **Step 1-8: 커밋**

```bash
git add requirements.txt .env.example .gitignore tests/conftest.py \
        api/__init__.py rag/__init__.py report/__init__.py \
        prompts/__init__.py ui/__init__.py
git commit -m "chore: project bootstrap — deps, gitignore, test scaffold"
```

---

## Chunk 2: 데이터 레이어 (남편 담당)

### Task 2: `data/visa_db.json` — 12개국 비자 데이터

**Files:**
- Create: `data/visa_db.json`

> **리서치 순서**: 공식 사이트 → 2024/2025 최신 소득 기준 확인 → USD 환산 → JSON 입력

- [ ] **Step 2-1: 스키마 유효성 테스트 먼저 작성**

`tests/test_data_schema.py` 생성:

```python
import json, pytest

def load_visa_db():
    with open("data/visa_db.json", "r", encoding="utf-8") as f:
        return json.load(f)

def load_city_scores():
    with open("data/city_scores.json", "r", encoding="utf-8") as f:
        return json.load(f)

REQUIRED_VISA_FIELDS = {
    "id", "name", "name_kr", "visa_type",
    "min_income_usd", "stay_months", "renewable",
    "key_docs", "visa_fee_usd", "tax_note", "cost_tier", "notes", "source"
}
REQUIRED_CITY_FIELDS = {
    "id", "city", "city_kr", "country", "country_id",
    "monthly_cost_usd", "internet_mbps", "safety_score",
    "english_score", "nomad_score", "climate", "cowork_usd_month"
}

def test_visa_db_has_12_countries():
    """10개 기본국 + Philippines + Vietnam = 12개"""
    db = load_visa_db()
    assert len(db["countries"]) == 12

def test_visa_db_schema():
    db = load_visa_db()
    for c in db["countries"]:
        missing = REQUIRED_VISA_FIELDS - set(c.keys())
        assert not missing, f"{c.get('id','?')} 누락 필드: {missing}"

def test_visa_db_income_positive():
    db = load_visa_db()
    for c in db["countries"]:
        assert c["min_income_usd"] > 0

def test_visa_db_key_docs_nonempty():
    db = load_visa_db()
    for c in db["countries"]:
        assert len(c["key_docs"]) >= 2, f"{c['id']} key_docs 부족"

def test_city_scores_has_at_least_10():
    db = load_city_scores()
    assert len(db["cities"]) >= 10

def test_city_scores_schema():
    db = load_city_scores()
    for city in db["cities"]:
        missing = REQUIRED_CITY_FIELDS - set(city.keys())
        assert not missing, f"{city.get('id','?')} 누락 필드: {missing}"

def test_city_scores_range():
    db = load_city_scores()
    for city in db["cities"]:
        assert 1 <= city["safety_score"] <= 10
        assert 1 <= city["english_score"] <= 10
        assert 1 <= city["nomad_score"] <= 10
        assert city["monthly_cost_usd"] > 0

def test_city_country_id_exists_in_visa_db():
    visa = {c["id"] for c in load_visa_db()["countries"]}
    cities = load_city_scores()["cities"]
    for city in cities:
        assert city["country_id"] in visa, \
            f"{city['id']}의 country_id={city['country_id']} — visa_db에 없음"
```

- [ ] **Step 2-2: 테스트 실행 → FAIL 확인**

```bash
pytest tests/test_data_schema.py -v
```

Expected: `FileNotFoundError` (파일 없음)

- [ ] **Step 2-3: `data/visa_db.json` 작성 — 12개국 (기본 10 + PH + VN)**

아래 10개국을 먼저 작성하고, 이후 Philippines(PH)·Vietnam(VN) 추가 (공식 출처 반드시 확인):

```json
{
  "countries": [
    {
      "id": "MY",
      "name": "Malaysia",
      "name_kr": "말레이시아",
      "visa_type": "DE Nomad Visa",
      "min_income_usd": 2400,
      "stay_months": 12,
      "renewable": true,
      "key_docs": [
        "여권 (유효기간 18개월 이상)",
        "3개월 이상 소득 증빙 (영문 고용계약서 또는 프리랜서 계약서)",
        "건강보험 증서 (말레이시아 체류 기간 커버)"
      ],
      "visa_fee_usd": 150,
      "tax_note": "비거주자 — 현지 소득세 없음",
      "cost_tier": "low",
      "notes": "동남아 노마드 기지 1순위. 한인 커뮤니티 활발, 영어 통용",
      "source": "https://www.mm2h.gov.my"
    },
    {
      "id": "PT",
      "name": "Portugal",
      "name_kr": "포르투갈",
      "visa_type": "D8 Digital Nomad Visa",
      "min_income_usd": 3280,
      "stay_months": 12,
      "renewable": true,
      "key_docs": [
        "고용계약서 또는 프리랜서 계약서 공증본",
        "3개월 급여명세서 영문 번역본",
        "범죄경력증명서 + 아포스티유"
      ],
      "visa_fee_usd": 90,
      "tax_note": "NHR 세제 신청 시 외국 소득 20% 단일세율 10년 적용",
      "cost_tier": "medium",
      "notes": "EU 영주권 경로 개방. 리스본·포르투 노마드 씬 활발",
      "source": "https://vistos.mne.gov.pt"
    },
    {
      "id": "TH",
      "name": "Thailand",
      "name_kr": "태국",
      "visa_type": "LTR Visa (Long-Term Resident)",
      "min_income_usd": 80000,
      "stay_months": 60,
      "renewable": true,
      "key_docs": [
        "고용계약서 또는 사업 증명서류",
        "연 소득 증빙 ($80,000 이상, 최근 2년)",
        "건강보험 (최소 $50,000 커버리지)"
      ],
      "visa_fee_usd": 500,
      "tax_note": "LTR 비자 소지 시 외국 소득 비과세 (2024 세법 기준 검토 필요)",
      "cost_tier": "low",
      "notes": "치앙마이·방콕이 세계 최대 노마드 허브. LTR 미충족 시 Tourist/SETV 반복 가능",
      "source": "https://ltr.boi.go.th"
    },
    {
      "id": "EE",
      "name": "Estonia",
      "name_kr": "에스토니아",
      "visa_type": "Digital Nomad Visa",
      "min_income_usd": 4500,
      "stay_months": 12,
      "renewable": false,
      "key_docs": [
        "고용계약서 또는 서비스 계약서 (원격근무 입증)",
        "3개월 급여명세서 또는 인보이스",
        "숙박 증빙 (임시 주소 확인서)"
      ],
      "visa_fee_usd": 100,
      "tax_note": "에스토니아 거주자 아닐 시 현지 소득세 없음. e-Residency 별도 신청 가능",
      "cost_tier": "medium",
      "notes": "e-Residency 병행 시 EU 법인 설립 가능. 탈린 영어 소통 원활",
      "source": "https://www.politsei.ee"
    },
    {
      "id": "ES",
      "name": "Spain",
      "name_kr": "스페인",
      "visa_type": "Startup Law Digital Nomad Visa",
      "min_income_usd": 2763,
      "stay_months": 12,
      "renewable": true,
      "key_docs": [
        "고용계약서 또는 원격근무 증명서",
        "3개월 급여명세서",
        "범죄경력증명서 + 아포스티유"
      ],
      "visa_fee_usd": 80,
      "tax_note": "베케리아 법: 외국 소득 4년간 24% 단일세율",
      "cost_tier": "medium",
      "notes": "바르셀로나·발렌시아 노마드 인프라 우수. 지중해 기후",
      "source": "https://www.exteriores.gob.es"
    },
    {
      "id": "ID",
      "name": "Indonesia",
      "name_kr": "인도네시아",
      "visa_type": "E33G Social Visit Visa (Bali Focus)",
      "min_income_usd": 2000,
      "stay_months": 6,
      "renewable": true,
      "key_docs": [
        "여권 (유효기간 18개월 이상)",
        "소득 증빙 ($2,000+/월)",
        "귀국 또는 제3국행 항공권"
      ],
      "visa_fee_usd": 35,
      "tax_note": "외국 소득에 현지 소득세 미부과 (2024 기준)",
      "cost_tier": "low",
      "notes": "발리 짱구 코워킹 허브. E33G 갱신 반복 가능 (국경 이동 필요)",
      "source": "https://molina.imigrasi.go.id"
    },
    {
      "id": "DE",
      "name": "Germany",
      "name_kr": "독일",
      "visa_type": "Freiberufler (Freelancer) Visa",
      "min_income_usd": 3500,
      "stay_months": 36,
      "renewable": true,
      "key_docs": [
        "포트폴리오 또는 클라이언트 계약서",
        "재정 자립 증명 (잔고 증명 또는 소득 증빙)",
        "거주 등록 확인서 (Anmeldung)"
      ],
      "visa_fee_usd": 100,
      "tax_note": "독일 거주자로 전 세계 소득 과세. 세율 14~45%",
      "cost_tier": "high",
      "notes": "베를린 스타트업 생태계. EU 거주 기반. 영주권 경로 5년",
      "source": "https://www.make-it-in-germany.com"
    },
    {
      "id": "GE",
      "name": "Georgia",
      "name_kr": "조지아",
      "visa_type": "Remotely from Georgia Program",
      "min_income_usd": 2000,
      "stay_months": 12,
      "renewable": true,
      "key_docs": [
        "고용계약서 또는 서비스 계약서",
        "3개월 급여명세서 또는 인보이스",
        "여권 (유효기간 6개월 이상)"
      ],
      "visa_fee_usd": 0,
      "tax_note": "조지아 거주 1년 이상 시 플랫세율 1% 적용 (Virtual Zone 등록 시)",
      "cost_tier": "low",
      "notes": "트빌리시 물가 낮고 인터넷 빠름. 비자 없이 365일 체류 가능",
      "source": "https://stophere.georgia.com"
    },
    {
      "id": "CR",
      "name": "Costa Rica",
      "name_kr": "코스타리카",
      "visa_type": "Rentista / Digital Nomad Visa",
      "min_income_usd": 3000,
      "stay_months": 24,
      "renewable": true,
      "key_docs": [
        "소득 증빙 ($3,000+/월, 공증 필요)",
        "범죄경력증명서 + 아포스티유",
        "건강보험 (코스타리카 사회보험 또는 동등)"
      ],
      "visa_fee_usd": 250,
      "tax_note": "외국 소득 비과세 (영토 과세 원칙)",
      "cost_tier": "medium",
      "notes": "열대 자연환경, 안전성 높음, 영어 통용. Pura Vida 라이프스타일",
      "source": "https://www.migracion.go.cr"
    },
    {
      "id": "GR",
      "name": "Greece",
      "name_kr": "그리스",
      "visa_type": "Digital Nomad Visa",
      "min_income_usd": 3500,
      "stay_months": 12,
      "renewable": true,
      "key_docs": [
        "고용계약서 또는 원격근무 증명서",
        "3개월 급여명세서",
        "숙박 증빙 (임대계약서)"
      ],
      "visa_fee_usd": 75,
      "tax_note": "7% 단일세율 10년 적용 (외국 연금·소득 특별세제, 2024 확인 필요)",
      "cost_tier": "medium",
      "notes": "아테네·테살로니키 노마드 씬 성장 중. 지중해 섬 옵션",
      "source": "https://nomad.gov.gr"
    }
  ]
}
```

- [ ] **Step 2-4: 테스트 실행 → visa_db 테스트 통과 확인**

```bash
pytest tests/test_data_schema.py::test_visa_db_has_12_countries \
       tests/test_data_schema.py::test_visa_db_schema \
       tests/test_data_schema.py::test_visa_db_income_positive \
       tests/test_data_schema.py::test_visa_db_key_docs_nonempty -v
```

Expected: 4 PASSED

### Task 3: `data/city_scores.json` — 20개 도시

**Files:**
- Create: `data/city_scores.json`

- [ ] **Step 3-1: `data/city_scores.json` 작성 — 20개 도시**

각 도시의 점수는 Nomad List 등 최신 자료 기준:

```json
{
  "cities": [
    {"id":"KL","city":"Kuala Lumpur","city_kr":"쿠알라룸푸르","country":"Malaysia","country_id":"MY","monthly_cost_usd":1500,"internet_mbps":100,"safety_score":6,"english_score":8,"nomad_score":8,"climate":"tropical","cowork_usd_month":150},
    {"id":"PG","city":"Penang","city_kr":"페낭","country":"Malaysia","country_id":"MY","monthly_cost_usd":1200,"internet_mbps":80,"safety_score":7,"english_score":7,"nomad_score":7,"climate":"tropical","cowork_usd_month":100},
    {"id":"LIS","city":"Lisbon","city_kr":"리스본","country":"Portugal","country_id":"PT","monthly_cost_usd":2600,"internet_mbps":200,"safety_score":8,"english_score":8,"nomad_score":9,"climate":"mediterranean","cowork_usd_month":300},
    {"id":"PTO","city":"Porto","city_kr":"포르투","country":"Portugal","country_id":"PT","monthly_cost_usd":2100,"internet_mbps":180,"safety_score":8,"english_score":7,"nomad_score":8,"climate":"mediterranean","cowork_usd_month":220},
    {"id":"CNX","city":"Chiang Mai","city_kr":"치앙마이","country":"Thailand","country_id":"TH","monthly_cost_usd":1100,"internet_mbps":150,"safety_score":7,"english_score":6,"nomad_score":9,"climate":"tropical","cowork_usd_month":80},
    {"id":"BKK","city":"Bangkok","city_kr":"방콕","country":"Thailand","country_id":"TH","monthly_cost_usd":1400,"internet_mbps":200,"safety_score":6,"english_score":7,"nomad_score":8,"climate":"tropical","cowork_usd_month":120},
    {"id":"TLL","city":"Tallinn","city_kr":"탈린","country":"Estonia","country_id":"EE","monthly_cost_usd":2200,"internet_mbps":300,"safety_score":9,"english_score":9,"nomad_score":8,"climate":"continental","cowork_usd_month":250},
    {"id":"BCN","city":"Barcelona","city_kr":"바르셀로나","country":"Spain","country_id":"ES","monthly_cost_usd":2900,"internet_mbps":250,"safety_score":6,"english_score":7,"nomad_score":8,"climate":"mediterranean","cowork_usd_month":350},
    {"id":"MAD","city":"Madrid","city_kr":"마드리드","country":"Spain","country_id":"ES","monthly_cost_usd":2700,"internet_mbps":250,"safety_score":7,"english_score":6,"nomad_score":7,"climate":"semi-arid","cowork_usd_month":300},
    {"id":"DPS","city":"Bali (Canggu)","city_kr":"발리 (짱구)","country":"Indonesia","country_id":"ID","monthly_cost_usd":1400,"internet_mbps":50,"safety_score":6,"english_score":7,"nomad_score":8,"climate":"tropical","cowork_usd_month":100},
    {"id":"BLN","city":"Berlin","city_kr":"베를린","country":"Germany","country_id":"DE","monthly_cost_usd":3200,"internet_mbps":150,"safety_score":7,"english_score":9,"nomad_score":8,"climate":"continental","cowork_usd_month":400},
    {"id":"TBS","city":"Tbilisi","city_kr":"트빌리시","country":"Georgia","country_id":"GE","monthly_cost_usd":1000,"internet_mbps":100,"safety_score":8,"english_score":5,"nomad_score":7,"climate":"continental","cowork_usd_month":80},
    {"id":"SJO","city":"San Jose","city_kr":"산호세","country":"Costa Rica","country_id":"CR","monthly_cost_usd":2200,"internet_mbps":80,"safety_score":6,"english_score":7,"nomad_score":6,"climate":"tropical","cowork_usd_month":200},
    {"id":"SJD","city":"Tamarindo","city_kr":"타마린도","country":"Costa Rica","country_id":"CR","monthly_cost_usd":2500,"internet_mbps":60,"safety_score":7,"english_score":8,"nomad_score":7,"climate":"tropical","cowork_usd_month":180},
    {"id":"ATH","city":"Athens","city_kr":"아테네","country":"Greece","country_id":"GR","monthly_cost_usd":2000,"internet_mbps":100,"safety_score":7,"english_score":7,"nomad_score":7,"climate":"mediterranean","cowork_usd_month":200},
    {"id":"HER","city":"Heraklion","city_kr":"헤라클리온 (크레타)","country":"Greece","country_id":"GR","monthly_cost_usd":1800,"internet_mbps":80,"safety_score":8,"english_score":6,"nomad_score":6,"climate":"mediterranean","cowork_usd_month":150},
    {"id":"MNL","city":"Manila","city_kr":"마닐라","country":"Philippines","country_id":"PH","monthly_cost_usd":1200,"internet_mbps":50,"safety_score":4,"english_score":9,"nomad_score":6,"climate":"tropical","cowork_usd_month":100},
    {"id":"CEU","city":"Cebu","city_kr":"세부","country":"Philippines","country_id":"PH","monthly_cost_usd":1000,"internet_mbps":50,"safety_score":5,"english_score":9,"nomad_score":7,"climate":"tropical","cowork_usd_month":80},
    {"id":"HAN","city":"Hanoi","city_kr":"하노이","country":"Vietnam","country_id":"VN","monthly_cost_usd":900,"internet_mbps":80,"safety_score":7,"english_score":5,"nomad_score":7,"climate":"subtropical","cowork_usd_month":70},
    {"id":"SGN","city":"Ho Chi Minh City","city_kr":"호치민","country":"Vietnam","country_id":"VN","monthly_cost_usd":1000,"internet_mbps":80,"safety_score":6,"english_score":5,"nomad_score":7,"climate":"tropical","cowork_usd_month":80}
  ]
}
```

> **결정**: Philippines(PH), Vietnam(VN)을 **visa_db.json에 추가 (12개국)**.
> city_scores.json에 두 국가 도시를 포함하여 RAG 검색 정밀도를 높인다.
> `test_visa_db_has_12_countries` 테스트가 이 결정을 강제한다.

visa_db.json에 두 국가를 Step 2-3 본문 끝에 추가:

```json
{
  "id": "PH",
  "name": "Philippines",
  "name_kr": "필리핀",
  "visa_type": "Special Investor's Resident Visa / Tourist Visa 연장",
  "min_income_usd": 2000,
  "stay_months": 6,
  "renewable": true,
  "key_docs": ["여권", "소득 증빙", "왕복 항공권"],
  "visa_fee_usd": 60,
  "tax_note": "외국 소득 비과세 (영토 과세)",
  "cost_tier": "low",
  "notes": "영어 공용어. 세부 아일랜드 호핑. 노마드 커뮤니티 성장 중",
  "source": "https://www.immigration.gov.ph"
},
{
  "id": "VN",
  "name": "Vietnam",
  "name_kr": "베트남",
  "visa_type": "E-Visa (90일) / DL Visa 연장",
  "min_income_usd": 1500,
  "stay_months": 3,
  "renewable": true,
  "key_docs": ["여권", "온라인 신청서", "여권사진"],
  "visa_fee_usd": 25,
  "tax_note": "외국 소득 비과세 (단기 체류 기준)",
  "cost_tier": "low",
  "notes": "하노이·호치민 물가 최저. 커피 문화, 음식 훌륭. 장기 비자는 복잡함",
  "source": "https://evisa.xuatnhapcanh.gov.vn"
}
```

- [ ] **Step 3-2: 전체 데이터 테스트 실행**

```bash
pytest tests/test_data_schema.py -v
```

Expected: 7 PASSED

- [ ] **Step 3-3: 커밋**

```bash
git add data/visa_db.json data/city_scores.json tests/test_data_schema.py
git commit -m "feat: add visa_db (12 countries) and city_scores (20 cities)"
```

---

## Chunk 3: API 레이어 (아내 담당)

### Task 4: `api/hf_client.py` — HF Router + Qwen3.5-27B

**Files:**
- Create: `api/hf_client.py`
- Create: `tests/test_hf_client.py`

- [ ] **Step 4-1: 테스트 먼저 작성**

`tests/test_hf_client.py`:

```python
import pytest
from unittest.mock import MagicMock, patch

def test_query_model_returns_string(monkeypatch):
    """정상 응답 시 문자열 반환"""
    fake_response = MagicMock()
    fake_response.choices[0].message.content = '{"greeting": "안녕하세요!"}'

    with patch("api.hf_client.client") as mock_client:
        mock_client.chat.completions.create.return_value = fake_response
        from api.hf_client import query_model
        result = query_model([{"role": "user", "content": "test"}])
        assert isinstance(result, str)
        assert "안녕하세요" in result

def test_query_model_strips_think_blocks(monkeypatch):
    """<think>...</think> 블록 제거 확인"""
    fake_response = MagicMock()
    fake_response.choices[0].message.content = (
        "<think>내부 추론입니다</think>\n{\"answer\": \"yes\"}"
    )
    with patch("api.hf_client.client") as mock_client:
        mock_client.chat.completions.create.return_value = fake_response
        from api.hf_client import query_model
        result = query_model([{"role": "user", "content": "test"}])
        assert "<think>" not in result
        assert "answer" in result

def test_query_model_returns_error_on_exception():
    """API 예외 시 ERROR: 로 시작하는 문자열 반환"""
    with patch("api.hf_client.client") as mock_client:
        mock_client.chat.completions.create.side_effect = Exception("timeout")
        from api.hf_client import query_model
        result = query_model([{"role": "user", "content": "test"}])
        assert result.startswith("ERROR:")

def test_query_model_with_thinking_returns_tuple():
    """thinking 모드 반환 타입 — (str, str) 튜플"""
    fake_response = MagicMock()
    fake_response.choices[0].message.content = "{}"
    fake_response.choices[0].message.reasoning_content = "thinking..."

    with patch("api.hf_client.client") as mock_client:
        mock_client.chat.completions.create.return_value = fake_response
        from api.hf_client import query_model_with_thinking
        thinking, content = query_model_with_thinking([{"role": "user", "content": "test"}])
        assert isinstance(thinking, str)
        assert isinstance(content, str)
```

- [ ] **Step 4-2: 테스트 실행 → FAIL 확인**

```bash
pytest tests/test_hf_client.py -v
```

Expected: `ModuleNotFoundError: No module named 'api.hf_client'`

- [ ] **Step 4-3: `api/hf_client.py` 구현**

```python
import os
import re
from openai import OpenAI

HF_TOKEN = os.getenv("HF_TOKEN", "")
MODEL_ID  = "Qwen/Qwen3.5-27B"

client = OpenAI(
    base_url="https://router.huggingface.co/v1",
    api_key=HF_TOKEN,
)


def query_model(messages: list[dict], max_tokens: int = 2048) -> str:
    try:
        response = client.chat.completions.create(
            model=MODEL_ID,
            messages=messages,
            max_tokens=max_tokens,
            temperature=0.3,
            top_p=0.95,
            extra_body={
                "top_k": 20,
                "chat_template_kwargs": {"thinking": False},
            },
        )
        raw = response.choices[0].message.content or ""
        raw = re.sub(r"<think>[\s\S]*?</think>", "", raw).strip()
        return raw

    except Exception as e:
        return f"ERROR: {str(e)}"


def query_model_with_thinking(messages: list[dict], max_tokens: int = 4096) -> tuple[str, str]:
    try:
        response = client.chat.completions.create(
            model=MODEL_ID,
            messages=messages,
            max_tokens=max_tokens,
            temperature=1.0,
            top_p=0.95,
            extra_body={"top_k": 20},
        )
        msg = response.choices[0].message
        thinking = getattr(msg, "reasoning_content", "") or ""
        content  = msg.content or ""
        return thinking, content

    except Exception as e:
        return "", f"ERROR: {str(e)}"
```

- [ ] **Step 4-4: 테스트 실행 → PASS 확인**

```bash
pytest tests/test_hf_client.py -v
```

Expected: 4 PASSED

### Task 5: `api/parser.py` — JSON 파싱 + 마크다운 포맷

**Files:**
- Create: `api/parser.py`
- Create: `tests/test_parser.py`

- [ ] **Step 5-1: 테스트 먼저 작성**

`tests/test_parser.py`:

```python
from api.parser import parse_response, format_result_markdown

VALID_JSON_RAW = """{
  "top_cities": [
    {"city": "Chiang Mai", "country": "Thailand", "visa_type": "LTR",
     "monthly_cost": 1100, "score": 9, "why": "저렴하고 노마드 많음"}
  ],
  "visa_checklist": ["여권 18개월 이상 확인"],
  "budget_breakdown": {"rent": 500, "food": 300, "cowork": 100, "misc": 200},
  "first_steps": ["여권 확인"]
}"""

CODE_BLOCK_JSON = "```json\n" + VALID_JSON_RAW + "\n```"

def test_parse_pure_json():
    result = parse_response(VALID_JSON_RAW)
    assert result["top_cities"][0]["city"] == "Chiang Mai"
    assert result["budget_breakdown"]["rent"] == 500

def test_parse_code_block_json():
    result = parse_response(CODE_BLOCK_JSON)
    assert result["top_cities"][0]["city"] == "Chiang Mai"

def test_parse_failure_returns_fallback():
    result = parse_response("완전히 잘못된 텍스트입니다")
    assert "top_cities" in result
    assert result["top_cities"][0]["city"] == "파싱 오류"

def test_format_result_markdown_contains_sections():
    data = parse_response(VALID_JSON_RAW)
    md = format_result_markdown(data)
    assert "추천 거점 도시" in md
    assert "비자 체크리스트" in md
    assert "예산 브레이크다운" in md
    assert "Chiang Mai" in md

def test_format_result_markdown_budget_sum():
    data = parse_response(VALID_JSON_RAW)
    md = format_result_markdown(data)
    # 합계 1100 표시 확인
    assert "1,100" in md
```

- [ ] **Step 5-2: 테스트 실행 → FAIL**

```bash
pytest tests/test_parser.py -v
```

- [ ] **Step 5-3: `api/parser.py` 구현**

```python
import json
import re


def parse_response(raw_text: str) -> dict:
    # 1) 코드 블록 안 JSON 먼저 시도
    for match in re.findall(r"```(?:json)?\s*([\s\S]*?)```", raw_text):
        try:
            return json.loads(match.strip())
        except json.JSONDecodeError:
            continue
    # 2) 중괄호 덩어리 탐색 (긴 것 우선)
    for match in sorted(re.findall(r"\{[\s\S]*\}", raw_text), key=len, reverse=True):
        try:
            return json.loads(match)
        except json.JSONDecodeError:
            continue
    # 3) 파싱 실패 폴백
    return {
        "top_cities": [{"city": "파싱 오류", "country": "-", "visa_type": "-",
                         "monthly_cost": 0, "score": 0, "why": raw_text[:200]}],
        "visa_checklist": ["응답 파싱 실패. 다시 시도해 주세요."],
        "budget_breakdown": {"rent": 0, "food": 0, "cowork": 0, "misc": 0},
        "first_steps": ["다시 시도해 주세요."],
        "_raw": raw_text,
    }


def format_result_markdown(data: dict) -> str:
    lines = ["## 🌍 추천 거점 도시 TOP 3\n"]
    for i, city in enumerate(data.get("top_cities", [])[:3], 1):
        lines += [
            f"### {i}. {city.get('city','')}, {city.get('country','')}",
            f"- **비자 유형**: {city.get('visa_type','-')}",
            f"- **월 예상 비용**: ${city.get('monthly_cost',0):,}",
            f"- **추천 이유**: {city.get('why','-')}\n",
        ]
    lines.append("## 📋 비자 체크리스트\n")
    for item in data.get("visa_checklist", []):
        lines.append(f"- {item}")
    lines += ["\n## 💰 월 예산 브레이크다운\n",
              "| 항목 | 금액 |", "|------|------|"]
    bd = data.get("budget_breakdown", {})
    for k, label in [("rent","주거"), ("food","식비"), ("cowork","코워킹"), ("misc","기타")]:
        lines.append(f"| {label} | ${bd.get(k,0):,} |")
    lines.append(f"| **합계** | **${sum(bd.values()):,}** |")
    lines.append("\n## 🚀 첫 번째 실행 스텝\n")
    for j, step in enumerate(data.get("first_steps", []), 1):
        lines.append(f"{j}. {step}")
    return "\n".join(lines)
```

- [ ] **Step 5-4: 테스트 실행 → PASS**

```bash
pytest tests/test_parser.py -v
```

Expected: 5 PASSED

- [ ] **Step 5-5: 커밋**

```bash
git add api/hf_client.py api/parser.py tests/test_hf_client.py tests/test_parser.py
git commit -m "feat: add HF client (Qwen3.5-27B) and JSON parser"
```

---

## Chunk 4: RAG 파이프라인 (아내 담당)

### Task 6: `rag/embedder.py` — BGE-M3 임베딩

**Files:**
- Create: `rag/embedder.py`
- Create: `tests/test_embedder.py`

- [ ] **Step 6-1: 테스트 먼저 작성**

`tests/test_embedder.py`:

```python
import numpy as np
from unittest.mock import patch, MagicMock

def test_embed_texts_returns_correct_shape():
    """N개 텍스트 → (N, 1024) float32 배열"""
    fake_vec = [[0.1] * 1024]  # HF API 반환 형태 시뮬레이션
    with patch("rag.embedder._embed_client") as mock_client:
        mock_client.feature_extraction.return_value = fake_vec
        from rag.embedder import embed_texts
        result = embed_texts(["hello", "world"])
        assert result.shape == (2, 1024)
        assert result.dtype == np.float32

def test_embed_texts_is_l2_normalized():
    """각 벡터의 L2 노름 ≈ 1.0"""
    fake_vec = [[0.1] * 1024]
    with patch("rag.embedder._embed_client") as mock_client:
        mock_client.feature_extraction.return_value = fake_vec
        from rag.embedder import embed_texts
        result = embed_texts(["test"])
        norm = np.linalg.norm(result[0])
        assert abs(norm - 1.0) < 1e-5

def test_embed_query_returns_1d():
    """단일 쿼리 → 1D 벡터 (1024,)"""
    fake_vec = [[0.1] * 1024]
    with patch("rag.embedder._embed_client") as mock_client:
        mock_client.feature_extraction.return_value = fake_vec
        from rag.embedder import embed_query
        result = embed_query("비자 추천")
        assert result.shape == (1024,)
```

- [ ] **Step 6-2: 테스트 실행 → FAIL**

```bash
pytest tests/test_embedder.py -v
```

- [ ] **Step 6-3: `rag/embedder.py` 구현**

```python
import os
import numpy as np
from huggingface_hub import InferenceClient

HF_TOKEN    = os.getenv("HF_TOKEN", "")
EMBED_MODEL = "BAAI/bge-m3"

_embed_client = InferenceClient(provider="hf-inference", api_key=HF_TOKEN)


def embed_texts(texts: list[str]) -> np.ndarray:
    """텍스트 리스트 → (N, 1024) float32, L2 정규화 적용"""
    embeddings = []
    for text in texts:
        result = _embed_client.feature_extraction(
            text[:512],
            model=EMBED_MODEL,
        )
        vec = np.array(result, dtype=np.float32)
        if vec.ndim > 1:
            vec = vec.mean(axis=0)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        embeddings.append(vec)
    return np.stack(embeddings)


def embed_query(query: str) -> np.ndarray:
    """단일 쿼리 → 1D 벡터 (1024,)"""
    return embed_texts([query])[0]
```

- [ ] **Step 6-4: 테스트 실행 → PASS**

```bash
pytest tests/test_embedder.py -v
```

Expected: 3 PASSED

### Task 7: `rag/vector_store.py` — FAISS 인덱스 빌드·저장·로드

**Files:**
- Create: `rag/vector_store.py`
- Create: `tests/test_vector_store.py`

- [ ] **Step 7-1: 테스트 먼저 작성**

`tests/test_vector_store.py`:

```python
import os, pickle, tempfile
import numpy as np
import faiss
from unittest.mock import patch

def _fake_embed(texts):
    """실제 API 없이 랜덤 1024차원 벡터 반환"""
    n = len(texts)
    vecs = np.random.rand(n, 1024).astype(np.float32)
    vecs = vecs / np.linalg.norm(vecs, axis=1, keepdims=True)
    return vecs

def test_build_and_load_index(tmp_path, monkeypatch):
    """인덱스 빌드 후 파일 존재 + 로드 성공"""
    monkeypatch.setenv("HF_TOKEN", "dummy")
    # 임시 경로 패치
    monkeypatch.setattr("rag.vector_store.INDEX_PATH", str(tmp_path / "index.faiss"))
    monkeypatch.setattr("rag.vector_store.DOCS_PATH",  str(tmp_path / "docs.pkl"))

    with patch("rag.vector_store.embed_texts", side_effect=_fake_embed), \
         patch("rag.vector_store._chunk_visa_db", return_value=[
             {"id":"test1","text":"말레이시아 비자 정보","metadata":{"type":"visa"}}
         ]), \
         patch("rag.vector_store._chunk_city_scores", return_value=[
             {"id":"test2","text":"쿠알라룸푸르 도시 정보","metadata":{"type":"city"}}
         ]):
        from rag.vector_store import build_index, load_index
        build_index(force=True)
        index, docs = load_index()
        assert index.ntotal == 2
        assert len(docs) == 2

def test_build_index_skip_if_exists(tmp_path, monkeypatch, capsys):
    """인덱스 이미 존재하면 빌드 스킵"""
    monkeypatch.setattr("rag.vector_store.INDEX_PATH", str(tmp_path / "index.faiss"))
    monkeypatch.setattr("rag.vector_store.DOCS_PATH",  str(tmp_path / "docs.pkl"))
    # 빈 파일로 존재 흉내
    (tmp_path / "index.faiss").touch()
    (tmp_path / "docs.pkl").touch()

    with patch("rag.vector_store.embed_texts") as mock_embed:
        from rag.vector_store import build_index
        build_index(force=False)
        mock_embed.assert_not_called()
```

- [ ] **Step 7-2: 테스트 실행 → FAIL**

```bash
pytest tests/test_vector_store.py -v
```

- [ ] **Step 7-3: `rag/vector_store.py` 구현**

```python
import os, json, pickle
import faiss
import numpy as np
from rag.embedder import embed_texts

INDEX_PATH = "rag/index.faiss"
DOCS_PATH  = "rag/documents.pkl"


def _chunk_visa_db(path: str = "data/visa_db.json") -> list[dict]:
    with open(path, "r", encoding="utf-8") as f:
        db = json.load(f)
    chunks = []
    for c in db.get("countries", []):
        chunks.append({
            "id": f"visa_{c['id']}",
            "text": (
                f"국가: {c['name_kr']} ({c['name']})\n"
                f"비자 유형: {c['visa_type']}\n"
                f"최소 월 소득: ${c['min_income_usd']:,} USD\n"
                f"체류 기간: {c['stay_months']}개월 (갱신: {c['renewable']})\n"
                f"비자 비용: ${c.get('visa_fee_usd', 0)}\n"
                f"세금: {c.get('tax_note', '-')}\n"
                f"특이사항: {c.get('notes', '')}"
            ),
            "metadata": {"type": "visa", "country_id": c["id"], "country": c["name_kr"]},
        })
        chunks.append({
            "id": f"docs_{c['id']}",
            "text": (
                f"{c['name_kr']} 비자 필수 서류:\n"
                + "\n".join(f"- {d}" for d in c.get("key_docs", []))
            ),
            "metadata": {"type": "docs", "country_id": c["id"], "country": c["name_kr"]},
        })
    return chunks


def _chunk_city_scores(path: str = "data/city_scores.json") -> list[dict]:
    with open(path, "r", encoding="utf-8") as f:
        db = json.load(f)
    chunks = []
    for city in db.get("cities", []):
        chunks.append({
            "id": f"city_{city['id']}",
            "text": (
                f"도시: {city.get('city_kr', city['city'])}, {city['country']}\n"
                f"월 생활비: ${city['monthly_cost_usd']:,}\n"
                f"인터넷: {city['internet_mbps']} Mbps\n"
                f"안전: {city['safety_score']}/10  영어: {city['english_score']}/10\n"
                f"노마드 점수: {city['nomad_score']}/10\n"
                f"기후: {city['climate']}\n"
                f"코워킹: ${city['cowork_usd_month']}/월"
            ),
            "metadata": {"type": "city", "city_id": city["id"], "country_id": city["country_id"]},
        })
    return chunks


def build_index(force: bool = False):
    if not force and os.path.exists(INDEX_PATH) and os.path.exists(DOCS_PATH):
        print("✅ RAG 인덱스 발견 — 로드 스킵 (재빌드: force=True)")
        return

    print("🔨 RAG 인덱스 빌드 중...")
    chunks = _chunk_visa_db() + _chunk_city_scores()
    texts  = [c["text"] for c in chunks]

    print(f"  {len(chunks)}개 청크 임베딩 중 (BAAI/bge-m3)...")
    embeddings = embed_texts(texts)

    dim   = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)
    index.add(embeddings)

    os.makedirs(os.path.dirname(INDEX_PATH) or ".", exist_ok=True)
    faiss.write_index(index, INDEX_PATH)
    with open(DOCS_PATH, "wb") as f:
        pickle.dump(chunks, f)

    print(f"✅ RAG 완성 — {len(chunks)}개 청크, 벡터 차원: {dim}")


def load_index():
    if not os.path.exists(INDEX_PATH):
        raise FileNotFoundError("RAG 인덱스 없음 — build_index() 먼저 실행")
    index = faiss.read_index(INDEX_PATH)
    with open(DOCS_PATH, "rb") as f:
        docs = pickle.load(f)
    return index, docs
```

- [ ] **Step 7-4: 테스트 실행 → PASS**

```bash
pytest tests/test_vector_store.py -v
```

Expected: 2 PASSED

### Task 8: `rag/retriever.py` + `rag/build_index.py`

**Files:**
- Create: `rag/retriever.py`
- Create: `rag/build_index.py`
- Create: `tests/test_retriever.py`

- [ ] **Step 8-1: 테스트 먼저 작성**

`tests/test_retriever.py`:

```python
import numpy as np
from unittest.mock import patch, MagicMock
import faiss

def _make_fake_index(dim=1024, n=5):
    vecs = np.random.rand(n, dim).astype(np.float32)
    vecs = vecs / np.linalg.norm(vecs, axis=1, keepdims=True)
    index = faiss.IndexFlatIP(dim)
    index.add(vecs)
    return index

FAKE_DOCS = [
    {"id": f"doc_{i}", "text": f"텍스트 {i}", "metadata": {"type": "visa"}}
    for i in range(5)
]

def test_retrieve_returns_list_of_dicts():
    fake_index = _make_fake_index()
    fake_q_vec = np.random.rand(1024).astype(np.float32)
    fake_q_vec /= np.linalg.norm(fake_q_vec)

    with patch("rag.retriever.load_index", return_value=(fake_index, FAKE_DOCS)), \
         patch("rag.retriever.embed_query", return_value=fake_q_vec):
        # 상태 초기화
        import rag.retriever as r
        r._index = None
        r._docs  = None
        results = r.retrieve("비자 추천 쿼리", top_k=3)
        assert isinstance(results, list)
        assert len(results) == 3
        assert "score" in results[0]

def test_retrieve_as_context_returns_string():
    fake_index = _make_fake_index()
    fake_q_vec = np.random.rand(1024).astype(np.float32)
    fake_q_vec /= np.linalg.norm(fake_q_vec)

    with patch("rag.retriever.load_index", return_value=(fake_index, FAKE_DOCS)), \
         patch("rag.retriever.embed_query", return_value=fake_q_vec):
        import rag.retriever as r
        r._index = None
        r._docs  = None
        ctx = r.retrieve_as_context("테스트", top_k=2)
        assert isinstance(ctx, str)
        assert "RAG" in ctx
```

- [ ] **Step 8-2: 테스트 실행 → FAIL**

```bash
pytest tests/test_retriever.py -v
```

- [ ] **Step 8-3: `rag/retriever.py` 구현**

```python
import numpy as np
from rag.embedder    import embed_query
from rag.vector_store import load_index

_index = None
_docs  = None


def _ensure_loaded():
    global _index, _docs
    if _index is None:
        _index, _docs = load_index()


def retrieve(query: str, top_k: int = 6) -> list[dict]:
    _ensure_loaded()
    q_vec = embed_query(query).reshape(1, -1).astype(np.float32)
    scores, indices = _index.search(q_vec, top_k)

    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx < 0:
            continue
        doc = _docs[idx].copy()
        doc["score"] = float(score)
        results.append(doc)
    return results


def retrieve_as_context(query: str, top_k: int = 6) -> str:
    docs = retrieve(query, top_k=top_k)
    if not docs:
        return "관련 데이터를 찾지 못했습니다."
    lines = ["=== RAG 검색 결과 (관련 비자·도시 데이터) ==="]
    for i, doc in enumerate(docs, 1):
        lines.append(f"\n[{i}] {doc['text']}")
    return "\n".join(lines)
```

- [ ] **Step 8-4: `rag/build_index.py` 구현**

```python
"""
최초 1회만 실행:
    python rag/build_index.py
    python rag/build_index.py --force
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()
from rag.vector_store import build_index

if __name__ == "__main__":
    build_index(force="--force" in sys.argv)
```

- [ ] **Step 8-5: 테스트 실행 → PASS**

```bash
pytest tests/test_retriever.py tests/test_embedder.py tests/test_vector_store.py -v
```

Expected: 7 PASSED

- [ ] **Step 8-6: 커밋**

```bash
git add rag/embedder.py rag/vector_store.py rag/retriever.py rag/build_index.py \
        tests/test_embedder.py tests/test_vector_store.py tests/test_retriever.py
git commit -m "feat: add RAG pipeline (BGE-M3 + FAISS)"
```

---

## Chunk 5: 프롬프트 설계 (남편 담당)

### Task 9: `prompts/system.py` + `prompts/few_shots.py`

**Files:**
- Create: `prompts/system.py`
- Create: `prompts/few_shots.py`
- Create: `tests/test_prompts.py`

- [ ] **Step 9-1: 테스트 먼저 작성**

`tests/test_prompts.py`:

```python
from prompts.system    import SYSTEM_PROMPT
from prompts.few_shots import FEW_SHOT_EXAMPLES
import json

def test_system_prompt_is_string():
    assert isinstance(SYSTEM_PROMPT, str)
    assert "JSON" in SYSTEM_PROMPT

def test_few_shots_format():
    assert isinstance(FEW_SHOT_EXAMPLES, list)
    assert len(FEW_SHOT_EXAMPLES) >= 4  # user+assistant 2쌍 = 4 메시지
    for msg in FEW_SHOT_EXAMPLES:
        assert "role" in msg
        assert "content" in msg
        assert msg["role"] in ("user", "assistant")

def test_few_shots_assistant_is_valid_json():
    for msg in FEW_SHOT_EXAMPLES:
        if msg["role"] == "assistant":
            parsed = json.loads(msg["content"])
            assert "top_cities" in parsed
            assert "visa_checklist" in parsed
            assert "budget_breakdown" in parsed
            assert "first_steps" in parsed

def test_few_shots_pairs():
    """user → assistant 쌍 순서 확인"""
    roles = [m["role"] for m in FEW_SHOT_EXAMPLES]
    for i in range(0, len(roles) - 1, 2):
        assert roles[i] == "user"
        assert roles[i+1] == "assistant"
```

- [ ] **Step 9-2: 테스트 실행 → FAIL**

```bash
pytest tests/test_prompts.py -v
```

- [ ] **Step 9-3: `prompts/system.py` 구현**

태스크 파일의 SYSTEM_PROMPT 내용 그대로 복사:

```python
SYSTEM_PROMPT = """당신은 디지털 노마드 이민 설계 전문가입니다.
사용자의 국적, 소득, 라이프스타일, 목표 기간 및 제공된 비자·도시 데이터를 바탕으로
최적의 거주 국가와 도시를 추천하고 실질적인 비자 취득 로드맵을 제공합니다.

[출력 규칙 — 반드시 준수]
1. 오직 JSON 형식으로만 답하세요. JSON 외 어떤 텍스트도 출력하지 마세요.
2. 마크다운 코드 블록(```json)으로 감싸지 마세요. 순수 JSON만 출력하세요.
3. 숫자 필드(monthly_cost, score, rent 등)는 반드시 정수(int)로 입력하세요.
4. why, visa_checklist, first_steps 필드는 반드시 한국어로 작성하세요.
5. 제공된 RAG 검색 데이터를 최우선으로 참조하세요.

[출력 스키마 — 정확히 따를 것]
{
  "top_cities": [
    {
      "city": "도시명 (영어)",
      "country": "국가명 (영어)",
      "visa_type": "비자 유형명",
      "monthly_cost": 숫자,
      "score": 숫자(1-10),
      "why": "추천 이유 (한국어, 2~3문장)"
    }
  ],
  "visa_checklist": ["항목 (한국어)"],
  "budget_breakdown": {
    "rent": 숫자,
    "food": 숫자,
    "cowork": 숫자,
    "misc": 숫자
  },
  "first_steps": ["실행 가능한 스텝 (한국어)"]
}"""
```

- [ ] **Step 9-4: `prompts/few_shots.py` 구현**

태스크 파일의 FEW_SHOT_EXAMPLES 내용 그대로 복사 (두 쌍의 user/assistant 메시지).

- [ ] **Step 9-5: 테스트 실행 → PASS**

```bash
pytest tests/test_prompts.py -v
```

Expected: 4 PASSED

### Task 10: `prompts/builder.py` — RAG 주입 + messages 조합

**Files:**
- Create: `prompts/builder.py`
- Update: `tests/test_builder.py`

- [ ] **Step 10-1: 테스트 먼저 작성**

`tests/test_builder.py`:

```python
from unittest.mock import patch

FAKE_RAG_CONTEXT = "=== RAG 검색 결과 ===\n[1] 말레이시아 비자 정보..."
SAMPLE_PROFILE = {
    "nationality": "Korean",
    "income": 3000,
    "lifestyle": ["해변", "저물가"],
    "timeline": "1년 단기 체험",
}

def test_build_prompt_returns_list():
    with patch("prompts.builder.retrieve_as_context", return_value=FAKE_RAG_CONTEXT):
        from prompts.builder import build_prompt
        result = build_prompt(SAMPLE_PROFILE)
        assert isinstance(result, list)

def test_build_prompt_starts_with_system():
    with patch("prompts.builder.retrieve_as_context", return_value=FAKE_RAG_CONTEXT):
        from prompts.builder import build_prompt
        result = build_prompt(SAMPLE_PROFILE)
        assert result[0]["role"] == "system"

def test_build_prompt_ends_with_user():
    with patch("prompts.builder.retrieve_as_context", return_value=FAKE_RAG_CONTEXT):
        from prompts.builder import build_prompt
        result = build_prompt(SAMPLE_PROFILE)
        assert result[-1]["role"] == "user"

def test_build_prompt_includes_rag_context():
    with patch("prompts.builder.retrieve_as_context", return_value=FAKE_RAG_CONTEXT):
        from prompts.builder import build_prompt
        result = build_prompt(SAMPLE_PROFILE)
        last_user = result[-1]["content"]
        assert "RAG 검색 결과" in last_user

def test_build_prompt_includes_user_profile():
    with patch("prompts.builder.retrieve_as_context", return_value=FAKE_RAG_CONTEXT):
        from prompts.builder import build_prompt
        result = build_prompt(SAMPLE_PROFILE)
        last_user = result[-1]["content"]
        assert "Korean" in last_user
        assert "3,000" in last_user
        assert "해변" in last_user

def test_build_prompt_rag_query_uses_profile():
    """RAG 쿼리에 프로필 정보 포함 여부"""
    with patch("prompts.builder.retrieve_as_context", return_value=FAKE_RAG_CONTEXT) as mock_rag:
        from prompts.builder import build_prompt
        build_prompt(SAMPLE_PROFILE)
        call_args = mock_rag.call_args[0][0]
        assert "Korean" in call_args or "3000" in call_args
```

- [ ] **Step 10-2: 테스트 실행 → FAIL**

```bash
pytest tests/test_builder.py -v
```

- [ ] **Step 10-3: `prompts/builder.py` 구현**

```python
from prompts.system    import SYSTEM_PROMPT
from prompts.few_shots import FEW_SHOT_EXAMPLES
from rag.retriever     import retrieve_as_context


def build_prompt(user_profile: dict) -> list[dict]:
    nationality = user_profile.get("nationality", "Korean")
    income      = user_profile.get("income", 3000)
    lifestyle   = user_profile.get("lifestyle", [])
    timeline    = user_profile.get("timeline", "1년 단기 체험")

    rag_query = (
        f"{nationality} 디지털 노마드 월 소득 ${income} "
        f"라이프스타일 {' '.join(lifestyle)} {timeline} 비자 도시 추천"
    )
    rag_context = retrieve_as_context(rag_query, top_k=6)

    user_message = f"""국적: {nationality}
월 수입: ${income:,} USD
라이프스타일: {', '.join(lifestyle) if lifestyle else '특별한 선호 없음'}
목표 기간: {timeline}

{rag_context}

위 프로필과 RAG 데이터를 기반으로 최적의 디지털 노마드 거주 도시 3곳을 추천하세요.
반드시 순수 JSON만 출력하세요. 코드 블록이나 설명 문장 없이 JSON만."""

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(FEW_SHOT_EXAMPLES)
    messages.append({"role": "user", "content": user_message})

    return messages
```

- [ ] **Step 10-4: 테스트 실행 → PASS**

```bash
pytest tests/test_builder.py tests/test_prompts.py -v
```

Expected: 10 PASSED

- [ ] **Step 10-5: 커밋**

```bash
git add prompts/system.py prompts/few_shots.py prompts/builder.py \
        tests/test_prompts.py tests/test_builder.py
git commit -m "feat: add prompt engineering (system, few-shots, RAG builder)"
```

---

## Chunk 6: PDF 리포트 생성 (아내 담당)

### Task 11: `report/pdf_generator.py` — ReportLab PDF

**Files:**
- Create: `report/pdf_generator.py`
- Create: `tests/test_pdf_generator.py`

- [ ] **Step 11-1: 테스트 먼저 작성**

`tests/test_pdf_generator.py`:

```python
import os, tempfile

SAMPLE_PARSED = {
    "top_cities": [
        {"city": "Chiang Mai", "country": "Thailand", "visa_type": "LTR",
         "monthly_cost": 1100, "score": 9, "why": "저렴하고 노마드 많음"}
    ],
    "visa_checklist": ["여권 18개월 확인", "소득 증빙 준비"],
    "budget_breakdown": {"rent": 500, "food": 300, "cowork": 100, "misc": 200},
    "first_steps": ["여권 갱신", "건강보험 가입"],
}
SAMPLE_PROFILE = {
    "nationality": "Korean",
    "income": 3000,
    "lifestyle": ["해변"],
    "timeline": "1년 단기 체험",
}

def test_generate_report_creates_pdf(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    from report.pdf_generator import generate_report
    path = generate_report(SAMPLE_PARSED, SAMPLE_PROFILE)
    assert path is not None
    assert os.path.exists(path)
    assert path.endswith(".pdf")

def test_generate_report_pdf_nonempty(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    from report.pdf_generator import generate_report
    path = generate_report(SAMPLE_PARSED, SAMPLE_PROFILE)
    assert os.path.getsize(path) > 1000  # 최소 1KB
```

- [ ] **Step 11-2: 테스트 실행 → FAIL**

```bash
pytest tests/test_pdf_generator.py -v
```

- [ ] **Step 11-3: `report/pdf_generator.py` 구현**

```python
import os
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


def _get_styles():
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Title"],
        fontSize=20,
        textColor=colors.HexColor("#0C447C"),
        spaceAfter=12,
    )
    heading_style = ParagraphStyle(
        "CustomHeading",
        parent=styles["Heading2"],
        fontSize=13,
        textColor=colors.HexColor("#185FA5"),
        spaceBefore=12,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "CustomBody",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
    )
    return title_style, heading_style, body_style


def generate_report(parsed: dict, user_profile: dict) -> str:
    os.makedirs("reports", exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = f"reports/nomad_report_{ts}.pdf"

    doc = SimpleDocTemplate(
        path, pagesize=A4,
        rightMargin=2*cm, leftMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm,
    )
    title_s, heading_s, body_s = _get_styles()
    story = []

    # 제목
    story.append(Paragraph("🌏 NomadNavigator AI — 이민 설계 리포트", title_s))
    story.append(Paragraph(
        f"생성일: {datetime.now().strftime('%Y년 %m월 %d일')} | "
        f"국적: {user_profile.get('nationality','-')} | "
        f"월 수입: ${user_profile.get('income',0):,} USD",
        body_s
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#0C447C")))
    story.append(Spacer(1, 12))

    # 추천 도시
    story.append(Paragraph("추천 거점 도시 TOP 3", heading_s))
    for i, city in enumerate(parsed.get("top_cities", [])[:3], 1):
        story.append(Paragraph(
            f"{i}. {city.get('city','')}, {city.get('country','')} "
            f"— {city.get('visa_type','')} | ${city.get('monthly_cost',0):,}/월 "
            f"| 점수: {city.get('score','-')}/10",
            body_s
        ))
        story.append(Paragraph(f"   이유: {city.get('why','')}", body_s))
        story.append(Spacer(1, 6))

    # 비자 체크리스트
    story.append(Paragraph("비자 체크리스트", heading_s))
    for item in parsed.get("visa_checklist", []):
        story.append(Paragraph(f"☐  {item}", body_s))

    # 예산 브레이크다운
    story.append(Paragraph("월 예산 브레이크다운", heading_s))
    bd = parsed.get("budget_breakdown", {})
    label_map = {"rent": "주거비", "food": "식비", "cowork": "코워킹", "misc": "기타"}
    table_data = [["항목", "금액 (USD)"]]
    for k, label in label_map.items():
        table_data.append([label, f"${bd.get(k,0):,}"])
    table_data.append(["합계", f"${sum(bd.values()):,}"])
    t = Table(table_data, colWidths=[8*cm, 6*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#0C447C")),
        ("TEXTCOLOR",  (0,0), (-1,0), colors.white),
        ("FONTSIZE",   (0,0), (-1,-1), 10),
        ("ROWBACKGROUNDS", (0,1), (-1,-2), [colors.white, colors.HexColor("#EEF4FB")]),
        ("FONTNAME",   (0,-1), (-1,-1), "Helvetica-Bold"),
        ("GRID",       (0,0), (-1,-1), 0.5, colors.HexColor("#CCCCCC")),
    ]))
    story.append(t)

    # 첫 번째 실행 스텝
    story.append(Paragraph("첫 번째 실행 스텝", heading_s))
    for j, step in enumerate(parsed.get("first_steps", []), 1):
        story.append(Paragraph(f"{j}. {step}", body_s))

    story.append(Spacer(1, 20))
    story.append(Paragraph(
        "⚠️ 본 리포트는 참고용이며 법적 이민 조언이 아닙니다. "
        "실제 비자 신청 전 반드시 공식 기관에 확인하세요.",
        ParagraphStyle("disclaimer", parent=body_s, fontSize=8, textColor=colors.gray)
    ))

    doc.build(story)
    return path
```

- [ ] **Step 11-4: 테스트 실행 → PASS**

```bash
pytest tests/test_pdf_generator.py -v
```

Expected: 2 PASSED

- [ ] **Step 11-5: 커밋**

```bash
git add report/pdf_generator.py tests/test_pdf_generator.py
git commit -m "feat: add PDF report generator (ReportLab)"
```

---

## Chunk 7: Gradio UI (남편 담당)

### Task 12: `ui/theme.py` + `ui/layout.py`

**Files:**
- Create: `ui/theme.py`
- Create: `ui/layout.py`
- Create: `tests/test_ui.py`

- [ ] **Step 12-1: 테스트 먼저 작성**

`tests/test_ui.py`:

```python
def test_create_theme_returns_gradio_theme():
    import gradio as gr
    from ui.theme import create_theme
    theme = create_theme()
    assert isinstance(theme, gr.themes.Base)

def test_create_layout_returns_blocks():
    import gradio as gr
    from ui.layout import create_layout
    dummy_fn = lambda *args: ("결과 마크다운", None)
    demo = create_layout(dummy_fn)
    assert isinstance(demo, gr.Blocks)

def test_create_layout_has_correct_inputs():
    """레이아웃에 필수 입력 컴포넌트 포함 확인 (타입 기반)"""
    import gradio as gr
    from ui.layout import create_layout
    demo = create_layout(lambda *a: ("", None))
    # Blocks 내부 컴포넌트 접근
    component_types = {type(c).__name__ for c in demo.blocks.values()}
    assert "Dropdown"     in component_types
    assert "Slider"       in component_types
    assert "CheckboxGroup" in component_types
    assert "Radio"        in component_types
```

- [ ] **Step 12-2: 테스트 실행 → FAIL**

```bash
pytest tests/test_ui.py -v
```

- [ ] **Step 12-3: `ui/theme.py` 구현**

태스크 파일의 `create_theme()` 코드 그대로 복사.

- [ ] **Step 12-4: `ui/layout.py` 구현**

태스크 파일의 `create_layout()` 코드 그대로 복사.

- [ ] **Step 12-5: 테스트 실행 → PASS**

```bash
pytest tests/test_ui.py -v
```

Expected: 3 PASSED

- [ ] **Step 12-6: 커밋**

```bash
git add ui/theme.py ui/layout.py tests/test_ui.py
git commit -m "feat: add Gradio theme and layout"
```

---

## Chunk 8: 통합 — `app.py` + End-to-End

### Task 13: `app.py` + 통합 테스트

**Files:**
- Create: `app.py`
- Create: `tests/test_integration.py`

- [ ] **Step 13-1: 통합 테스트 먼저 작성**

`tests/test_integration.py`:

```python
"""
통합 테스트 — 실제 API 호출 없이 전체 파이프라인 검증.
nomad_advisor() 함수를 mock으로 감싸 end-to-end 흐름 확인.
"""
import os, json
from unittest.mock import patch, MagicMock

FAKE_JSON_RESPONSE = json.dumps({
    "top_cities": [
        {"city": "Chiang Mai", "country": "Thailand",
         "visa_type": "LTR", "monthly_cost": 1100, "score": 9,
         "why": "저렴하고 노마드 많음"}
    ],
    "visa_checklist": ["여권 확인"],
    "budget_breakdown": {"rent": 500, "food": 300, "cowork": 100, "misc": 200},
    "first_steps": ["여권 갱신"]
})

def test_nomad_advisor_pipeline(tmp_path, monkeypatch):
    """mock API + mock RAG → 마크다운 문자열 + PDF 경로 반환"""
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("HF_TOKEN", "dummy")

    with patch("rag.vector_store.build_index"), \
         patch("prompts.builder.retrieve_as_context", return_value="RAG context"), \
         patch("api.hf_client.query_model", return_value=FAKE_JSON_RESPONSE):
        from app import nomad_advisor
        md, pdf_path = nomad_advisor(
            nationality="Korean",
            income=3000,
            lifestyle=["해변", "저물가"],
            timeline="1년 단기 체험"
        )
        assert isinstance(md, str)
        assert "Chiang Mai" in md
        assert pdf_path is not None
        assert os.path.exists(pdf_path)

def test_nomad_advisor_api_error(tmp_path, monkeypatch):
    """API 오류 시 오류 메시지 반환, PDF는 None"""
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("HF_TOKEN", "dummy")

    with patch("rag.vector_store.build_index"), \
         patch("prompts.builder.retrieve_as_context", return_value="RAG context"), \
         patch("api.hf_client.query_model", return_value="ERROR: timeout"):
        from app import nomad_advisor
        md, pdf_path = nomad_advisor("Korean", 3000, ["해변"], "1년 단기 체험")
        assert "API 오류" in md or "ERROR" in md
        assert pdf_path is None
```

- [ ] **Step 13-2: 테스트 실행 → FAIL**

```bash
pytest tests/test_integration.py -v
```

- [ ] **Step 13-3: `app.py` 구현**

```python
import os
from dotenv import load_dotenv
load_dotenv()

from api.hf_client        import query_model
from api.parser           import parse_response, format_result_markdown
from report.pdf_generator import generate_report
from rag.vector_store     import build_index
from prompts.builder      import build_prompt
from ui.layout            import create_layout

# 앱 시작 시 RAG 인덱스 자동 초기화
print("🔧 RAG 인덱스 초기화...")
build_index(force=False)
print("✅ RAG 준비 완료")


def nomad_advisor(nationality, income, lifestyle, timeline) -> tuple[str, str | None]:
    """핵심 파이프라인: RAG → 프롬프트 → Qwen3.5-27B → 파싱 → PDF"""
    user_profile = {
        "nationality": nationality,
        "income":      int(income),
        "lifestyle":   lifestyle if isinstance(lifestyle, list) else [lifestyle],
        "timeline":    timeline,
    }

    messages     = build_prompt(user_profile)
    raw_response = query_model(messages, max_tokens=2048)

    if raw_response.startswith("ERROR"):
        return f"⚠️ API 오류: {raw_response}", None

    parsed          = parse_response(raw_response)
    markdown_output = format_result_markdown(parsed)
    pdf_path        = generate_report(parsed, user_profile)

    return markdown_output, pdf_path


if __name__ == "__main__":
    demo = create_layout(nomad_advisor)
    demo.launch()
```

- [ ] **Step 13-4: 통합 테스트 실행 → PASS**

```bash
pytest tests/test_integration.py -v
```

Expected: 2 PASSED

- [ ] **Step 13-5: 전체 테스트 스위트 실행**

```bash
pytest tests/ -v --tb=short
```

Expected: 모든 테스트 PASSED (약 30+)

- [ ] **Step 13-6: 커밋**

```bash
git add app.py tests/test_integration.py
git commit -m "feat: integrate all modules in app.py + integration tests"
```

---

## Chunk 9: 배포 준비 + 로컬 E2E 검증

### Task 14: API 연결 테스트 스크립트

**Files:**
- Create: `test_api.py` (임시, .gitignore 추가)

- [ ] **Step 14-1: API 연결 검증 스크립트 실행**

`.env` 파일에 실제 HF_TOKEN 입력 후:

```python
# test_api.py
from dotenv import load_dotenv
load_dotenv()
from api.hf_client import query_model

result = query_model([
    {"role": "user", "content": 'Reply ONLY with JSON: {"greeting": "안녕하세요!"}'}
])
print(result)
# 기대: {"greeting": "안녕하세요!"}
assert '"greeting"' in result, f"FAIL: {result}"
print("✅ API 연결 성공")
```

```bash
python test_api.py
```

Expected: `{"greeting": "안녕하세요!"}`

- [ ] **Step 14-2: RAG 인덱스 로컬 빌드**

```bash
python rag/build_index.py
```

Expected:
```
🔨 RAG 인덱스 빌드 중...
  XX개 청크 임베딩 중 (BAAI/bge-m3)...
✅ RAG 완성 — XX개 청크, 벡터 차원: 1024
```

청크 수 확인: visa (12개국 × 2 = 24) + city (20개) = 48개 예상

- [ ] **Step 14-3: 로컬 앱 실행 + 시나리오 테스트**

```bash
python app.py
```

브라우저에서 http://localhost:7860 접속 후 3가지 테스트:

| 케이스 | 국적 | 소득 | 라이프스타일 | 기간 | 기대 |
|--------|------|------|-------------|------|------|
| A | Korean | $2,000 | 저물가, 따뜻한 기후 | 1년 단기 | 치앙마이·발리·쿠알라룸푸르 계열 |
| B | Korean | $5,500 | 도심, 영어권, 안전 | 3년 장기 | 리스본·탈린·바르셀로나 계열 |
| C | American | $4,000 | 해변, 노마드 커뮤니티 | 1년 단기 | 발리·치앙마이·코스타리카 계열 |

- [ ] **Step 14-4: PDF 다운로드 확인**

각 케이스에서 PDF 다운로드 정상 여부 확인 (파일 열림, 내용 렌더링)

### Task 15: README + HF Space 배포

**Files:**
- Modify: `README.md`

- [ ] **Step 15-1: `README.md` HF Space 메타데이터 업데이트**

```markdown
---
title: NomadNavigator AI
emoji: 🌏
colorFrom: blue
colorTo: teal
sdk: gradio
sdk_version: 4.44.0
app_file: app.py
pinned: false
license: apache-2.0
short_description: AI 디지털 노마드 이민 설계 서비스
---

# 🌏 NomadNavigator AI

**디지털 노마드를 위한 AI 이민 설계 서비스**

국적 · 월 수입 · 라이프스타일을 입력하면
**Qwen3.5-27B** + **RAG** 기반으로 최적의 거주 국가와 도시를 추천하고
비자 체크리스트와 예산이 담긴 PDF 리포트를 즉시 생성합니다.

## 주요 기능
- 🎯 12개국 비자 정보 기반 맞춤 추천 (RAG)
- 💰 도시별 생활비 시뮬레이션 (20개 도시)
- 📋 비자 준비 체크리스트 자동 생성
- 📄 PDF 리포트 다운로드

## 기술 스택
- **AI**: Qwen3.5-27B (HuggingFace Inference Providers via Novita)
- **RAG**: BAAI/bge-m3 임베딩 + FAISS 벡터 검색
- **Frontend**: Gradio 4.x
- **PDF**: ReportLab

⚠️ 본 서비스는 참고용이며 법적 이민 조언이 아닙니다.
```

- [ ] **Step 15-2: HF Space 생성**

```
1. https://huggingface.co/spaces → "Create new Space"
2. Space name: nomad-navigator-ai
   SDK: Gradio | Visibility: Public
3. Settings → Repository secrets → HF_TOKEN 추가
```

> **`.env` vs HF Space 환경변수 차이**
> - 로컬 개발: `.env` 파일 → `load_dotenv()`가 `os.environ`에 주입
> - HF Space: `.env` 파일 **사용 불가** (업로드 금지, .gitignore 처리)
>   → Space Settings의 Repository secrets에 `HF_TOKEN` 추가하면 자동으로 `os.getenv("HF_TOKEN")` 에서 읽힘
> - 코드(`app.py`)는 항상 `os.getenv()` 사용 — 두 환경 모두 동작 ✅

- [ ] **Step 15-3: 최종 커밋 + Push**

```bash
git add README.md
git commit -m "docs: update README for HF Space deployment"
git push origin main
```

- [ ] **Step 15-4: HF Space 빌드 로그 확인**

빌드 로그에서 다음 확인:
- `✅ RAG 준비 완료` 출력
- `Running on public URL` 출력

- [ ] **Step 15-5: Public URL 접속 + 최종 검증**

---

## 완료 기준 체크리스트

```
□ pytest tests/ — 전체 PASSED
□ query_model() — Qwen3.5-27B 응답 수신 (HF Router 경유)
□ build_index() — 48개 청크 임베딩 성공 (12개국 × 2 + 20개 도시)
□ retrieve_as_context() — 비자·도시 텍스트 반환 확인
□ end-to-end — 입력 → RAG → Qwen3.5 → JSON → PDF 정상 작동
□ HF Space Public URL 접근 가능
□ 테스트 시나리오 A/B/C 모두 정상 응답
```

---

## 빠른 참조: 주요 인터페이스 계약

```python
# 아내 → 남편에게 제공
def query_model(messages: list[dict], max_tokens: int = 2048) -> str: ...
def retrieve_as_context(query: str, top_k: int = 6) -> str: ...

# 남편 → 아내에게 제공 (반환 타입: list[dict], str 아님)
def build_prompt(user_profile: dict) -> list[dict]: ...
def create_layout(advisor_fn) -> gr.Blocks: ...

# app.py 핵심 함수
def nomad_advisor(nationality: str, income: int,
                  lifestyle: list, timeline: str) -> tuple[str, str | None]: ...
```

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| `ERROR: 401` | HF_TOKEN 미설정 또는 만료 | `.env` 또는 Space Secrets 확인 |
| `FileNotFoundError: RAG 인덱스 없음` | `build_index()` 미실행 | `python rag/build_index.py` 실행 |
| JSON 파싱 오류 (파싱 오류 도시 반환) | LLM이 마크다운 블록으로 감쌈 | `parser.py`의 코드 블록 파싱 자동 처리 |
| FAISS `IndexFlatIP` 차원 불일치 | 다른 모델로 인덱스 재빌드 | `python rag/build_index.py --force` |
| PDF 한글 깨짐 | ReportLab 기본 폰트 | 나눔고딕 등 TTF 등록 (선택적 개선) |
