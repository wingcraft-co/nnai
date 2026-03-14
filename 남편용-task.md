# 남편용 Task — NomadNavigator AI (Search · Frontend · Prompt · UI/UX)
> **역할**: 리서치 · 데이터 수집 · 프롬프트 설계 · Gradio UI/UX 전담
> **총 소요 시간**: 약 3시간 30분 (싱크 시간 제외)

---

## ⚡ 변경 사항 요약 (이전 버전 대비)

| 항목 | 이전 | 현재 |
|------|------|------|
| 데이터 활용 방식 | `build_prompt()`에서 JSON 직접 파싱 | RAG 검색 결과를 프롬프트에 주입 |
| `build_prompt()` 반환 타입 | `str` | **`list[dict]`** (OpenAI messages 형식) |
| 시스템 프롬프트 | Qwen2.5 범용 | **Qwen3.5 thinking 모드 대응** 버전 |
| `few_shots.py` 형식 | 텍스트 직렬화 | OpenAI messages 형식 |
| RAG 연동 | 없음 | `rag.retriever.retrieve_as_context()` 호출 |

---

## 프로젝트 폴더 구조 (내 담당 영역)

```
nomad-navigator-ai/
├── prompts/
│   ├── __init__.py
│   ├── system.py           ← ✏️ 수정: Qwen3.5 JSON 출력 지시 강화
│   ├── builder.py          ← ✏️ 수정: RAG 컨텍스트 주입 + list[dict] 반환
│   └── few_shots.py        ← ✏️ 수정: OpenAI messages 형식으로 변환
├── data/
│   ├── visa_db.json        ← 동일 (내용 동일, RAG가 읽어서 인덱싱)
│   └── city_scores.json    ← 동일
├── ui/
│   ├── __init__.py
│   ├── layout.py           ← 동일
│   └── theme.py            ← 동일
└── assets/
    ├── banner.png
    └── logo.png
```

> **아내 담당 파일** (건드리지 않기): `app.py`, `api/`, `rag/`, `report/`

---

## Phase 1-A — 리서치 + 데이터 수집 (0:15 ~ 1:00)

> ⚡ **최우선 Task** — 아내의 RAG 인덱스 빌드가 이 데이터에 의존합니다.
> `data/visa_db.json`과 `data/city_scores.json`을 Phase 1 안에 완성하세요.

### Step 1-1. 서칭 — 국가별 비자 최신 정보 (국가당 5분 이내)

```
검색 키워드 패턴: "{국가명} digital nomad visa 2025 2026 requirements income"

각 국가에서 확인할 항목:
□ 비자 공식 명칭
□ 최소 월 소득 기준 (USD 환산)
□ 체류 가능 기간 (개월)
□ 필수 서류 Top 3
□ 비자 신청 비용 (USD)
□ 세금 관련 혜택 여부
□ 공식 출처 링크
```

**대상 10개국**:

| # | 국가 | 비자 이름 | 참고 링크 |
|---|------|----------|----------|
| 1 | 말레이시아 | DE Nomad Visa / MM2H | https://www.mm2h.gov.my |
| 2 | 포르투갈 | D8 Visa | https://vistos.mne.gov.pt |
| 3 | 태국 | LTR Visa | https://ltr.boi.go.th |
| 4 | 에스토니아 | Digital Nomad Visa | https://www.politsei.ee |
| 5 | 스페인 | Startup Law Nomad | https://www.exteriores.gob.es |
| 6 | 인도네시아 | E33G / Second Home | https://molina.imigrasi.go.id |
| 7 | 독일 | Freiberufler Visa | https://www.make-it-in-germany.com |
| 8 | 조지아 | Remotely from Georgia | https://stophere.georgia.com |
| 9 | 코스타리카 | Rentista / Nomad Visa | https://www.migracion.go.cr |
| 10 | 그리스 | Digital Nomad Visa | https://nomad.gov.gr |

### Step 1-2. `data/visa_db.json` — 10개국 완성

> 아래 스키마를 정확히 지켜야 RAG 청크 분할이 올바르게 동작합니다.

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
        "3개월 이상 소득 증빙 (영문 고용계약서 또는 사업자 계약서)",
        "건강보험 증서 (말레이시아 체류 기간 커버)"
      ],
      "visa_fee_usd": 150,
      "tax_note": "비거주자 — 현지 소득세 없음",
      "cost_tier": "low",
      "notes": "동남아 노마드 기지 1순위. 한인 커뮤니티 활발, 영어 통용",
      "source": "https://www.mm2h.gov.my"
    }
    // 나머지 9개국 동일 스키마로 작성
  ]
}
```

### Step 1-3. `data/city_scores.json` — 20개 도시 완성

> 최소 10개 도시 필수. 20개 권장 (RAG 검색 정밀도 향상).

```json
{
  "cities": [
    {
      "id": "KL",
      "city": "Kuala Lumpur",
      "city_kr": "쿠알라룸푸르",
      "country": "Malaysia",
      "country_id": "MY",
      "monthly_cost_usd": 1500,
      "internet_mbps": 100,
      "safety_score": 6,
      "english_score": 8,
      "nomad_score": 8,
      "climate": "tropical",
      "cowork_usd_month": 150
    }
    // 나머지 도시 동일 스키마
  ]
}
```

---

## Phase 1-B — 와이어프레임 스케치 (Phase 1-A 병행)

```
[NNAI 헤더 + 한 줄 설명]
────────────────────────────────────
[좌측 입력 패널]         [우측 결과 패널]
국적 Dropdown            추천 도시 TOP 3
월 수입 Slider           비자 체크리스트
라이프스타일 Checkbox    예산 브레이크다운
목표 기간 Radio          첫 실행 스텝
[분석 시작 Button]       [PDF 다운로드]
────────────────────────────────────
[법적 disclaimer footer]
```

---

## Phase 2-A — ✏️ 프롬프트 설계 (1:00 ~ 1:45)

### Step 2-1. `prompts/__init__.py`

```python
# 비워두기
```

### Step 2-2. ✏️ `prompts/system.py` — Qwen3.5 JSON 출력 강화

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

### Step 2-3. ✏️ `prompts/few_shots.py` — OpenAI messages 형식

> ⚠️ 이전 버전의 텍스트 직렬화에서 **OpenAI messages 리스트**로 변경.
> `build_prompt()`가 이 형식으로 직접 사용합니다.

```python
FEW_SHOT_EXAMPLES = [
    {
        "role": "user",
        "content": (
            "국적: Korean | 월 수입: $2,500 | "
            "라이프스타일: 저물가, 따뜻한 기후, 해변 | 기간: 1년 단기 체험\n"
            "위 프로필에 맞는 JSON 추천을 출력하세요."
        )
    },
    {
        "role": "assistant",
        "content": """{
  "top_cities": [
    {
      "city": "Chiang Mai",
      "country": "Thailand",
      "visa_type": "LTR Visa 또는 Thailand Elite",
      "monthly_cost": 1100,
      "score": 9,
      "why": "월 $1,100으로 생활 가능하며 세계 최대 규모의 디지털 노마드 커뮤니티가 있습니다. 한국 음식점도 다수 있어 적응이 빠르고 연평균 26도의 쾌적한 날씨를 자랑합니다."
    },
    {
      "city": "Kuala Lumpur",
      "country": "Malaysia",
      "visa_type": "DE Nomad Visa",
      "monthly_cost": 1500,
      "score": 8,
      "why": "DE Nomad 비자는 월 $2,400 소득 기준으로 취득 가능하며 현 수입으로 충분합니다. 영어가 통용되고 한인 커뮤니티가 활발해 첫 노마드 기지로 최적입니다."
    },
    {
      "city": "Bali (Canggu)",
      "country": "Indonesia",
      "visa_type": "E33G Social Visit Visa",
      "monthly_cost": 1400,
      "score": 7,
      "why": "짱구 지역은 코워킹 인프라가 뛰어나고 전 세계 노마드가 모이는 허브입니다. 단기 체류는 E33G 비자 반복 갱신이 현실적인 방법입니다."
    }
  ],
  "visa_checklist": [
    "여권 잔여 유효기간 18개월 이상 확인",
    "고용계약서 또는 프리랜서 계약서 영문 공증",
    "최근 3개월 급여명세서 영문 번역본 준비",
    "해외 체류 건강보험 가입 (SafetyWing 권장)",
    "말레이시아 DE Nomad Visa 온라인 사전 신청"
  ],
  "budget_breakdown": {
    "rent": 550,
    "food": 300,
    "cowork": 100,
    "misc": 150
  },
  "first_steps": [
    "여권 유효기간 확인 후 필요 시 갱신 신청",
    "SafetyWing Nomad Insurance 가입 ($56/월)",
    "말레이시아 DE Nomad Visa 공식 사이트에서 자격 요건 셀프 체크",
    "치앙마이 Airbnb 첫 한 달 예약 후 현지에서 월세 전환"
  ]
}"""
    },
    {
        "role": "user",
        "content": (
            "국적: Korean | 월 수입: $6,000 | "
            "라이프스타일: 도심, 영어권, 안전, 고속 인터넷 | 기간: 3년 장기 이민\n"
            "위 프로필에 맞는 JSON 추천을 출력하세요."
        )
    },
    {
        "role": "assistant",
        "content": """{
  "top_cities": [
    {
      "city": "Lisbon",
      "country": "Portugal",
      "visa_type": "D8 Digital Nomad Visa + NHR 세제",
      "monthly_cost": 2600,
      "score": 9,
      "why": "D8 비자 소득 기준을 크게 초과하며 NHR 혜택으로 외국 소득에 20% 단일세율이 10년간 적용됩니다. EU 영주권 경로가 열리고 영어 환경도 양호합니다."
    },
    {
      "city": "Tallinn",
      "country": "Estonia",
      "visa_type": "Digital Nomad Visa + e-Residency",
      "monthly_cost": 2200,
      "score": 8,
      "why": "디지털 노마드 비자와 e-Residency를 병행하면 EU 기반 법인 설립이 가능합니다. 인터넷 인프라가 EU 최상급이며 영어 소통이 원활합니다."
    },
    {
      "city": "Barcelona",
      "country": "Spain",
      "visa_type": "Startup Law Digital Nomad Visa",
      "monthly_cost": 2900,
      "score": 8,
      "why": "베케리아 법으로 외국 소득에 4년간 24% 단일세율이 적용됩니다. 유럽 최고의 노마드 씬과 지중해 라이프스타일을 동시에 누릴 수 있습니다."
    }
  ],
  "visa_checklist": [
    "여권 유효기간 36개월 이상 확인",
    "D8 비자: 고용계약서 + 3개월 급여명세서 영문 준비",
    "NHR 세제: 포르투갈 도착 90일 이내 세무청 신청",
    "범죄경력증명서 발급 + 아포스티유 인증",
    "포르투갈어 기초 학습 앱 시작 (Duolingo 30일)"
  ],
  "budget_breakdown": {
    "rent": 1400,
    "food": 600,
    "cowork": 250,
    "misc": 350
  },
  "first_steps": [
    "포르투갈 대사관 D8 비자 신청 서류 공식 확인",
    "NHR 전문 세무사 무료 상담 예약",
    "리스본 단기 1개월 테스트 체류 후 장기 계약 전환",
    "e-Residency 병행 신청으로 EU 법인 설립 준비"
  ]
}"""
    },
]
```

### Step 2-4. ✏️ `prompts/builder.py` — RAG 컨텍스트 주입 + `list[dict]` 반환

> **핵심 변경**: `rag.retriever.retrieve_as_context()` 호출 → 관련 데이터 자동 주입

```python
from prompts.system    import SYSTEM_PROMPT
from prompts.few_shots import FEW_SHOT_EXAMPLES
from rag.retriever     import retrieve_as_context


def build_prompt(user_profile: dict) -> list[dict]:
    """
    유저 프로필 + RAG 검색 결과 → OpenAI messages 형식 반환.

    Args:
        user_profile: {
            "nationality": str,       예) "Korean"
            "income":      int,       예) 3000  (USD)
            "lifestyle":   list[str], 예) ["해변", "저물가"]
            "timeline":    str,       예) "1년 단기 체험"
        }
    Returns:
        list[dict]: [
            {"role": "system",    "content": SYSTEM_PROMPT},
            {"role": "user",      "content": few-shot 예시 1},
            {"role": "assistant", "content": few-shot 답변 1},
            ...
            {"role": "user",      "content": 실제 유저 요청 + RAG 컨텍스트},
        ]
    """
    nationality = user_profile.get("nationality", "Korean")
    income      = user_profile.get("income", 3000)
    lifestyle   = user_profile.get("lifestyle", [])
    timeline    = user_profile.get("timeline", "1년 단기 체험")

    # ── RAG 검색: 소득·라이프스타일 기반 쿼리 ──────────────────
    rag_query = (
        f"{nationality} 디지털 노마드 월 소득 ${income} "
        f"라이프스타일 {' '.join(lifestyle)} {timeline} 비자 도시 추천"
    )
    rag_context = retrieve_as_context(rag_query, top_k=6)

    # ── 유저 메시지 조합 ─────────────────────────────────────
    user_message = f"""국적: {nationality}
월 수입: ${income:,} USD
라이프스타일: {', '.join(lifestyle) if lifestyle else '특별한 선호 없음'}
목표 기간: {timeline}

{rag_context}

위 프로필과 RAG 데이터를 기반으로 최적의 디지털 노마드 거주 도시 3곳을 추천하세요.
반드시 순수 JSON만 출력하세요. 코드 블록이나 설명 문장 없이 JSON만."""

    # ── messages 조합 ────────────────────────────────────────
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(FEW_SHOT_EXAMPLES)
    messages.append({"role": "user", "content": user_message})

    return messages
```

---

## Phase 2-B — Gradio UI 구현 (1:45 ~ 2:45)

### Step 3-1. `ui/__init__.py`

```python
# 비워두기
```

### Step 3-2. `ui/theme.py`

```python
import gradio as gr

def create_theme():
    return gr.themes.Soft(
        primary_hue=gr.themes.colors.blue,
        secondary_hue=gr.themes.colors.teal,
        font=[gr.themes.GoogleFont("Inter"), "sans-serif"],
    ).set(
        button_primary_background_fill="#0C447C",
        button_primary_background_fill_hover="#185FA5",
        button_primary_text_color="white",
    )
```

### Step 3-3. `ui/layout.py`

```python
import gradio as gr
from ui.theme import create_theme

NATIONALITIES = [
    "Korean", "Japanese", "Chinese", "American",
    "British", "German", "French", "Australian", "Other"
]
LIFESTYLE_OPTIONS = [
    "🏖️ 해변", "🏙️ 도심", "💰 저물가", "🔒 안전 우선",
    "🌐 영어권", "☀️ 따뜻한 기후", "❄️ 선선한 기후",
    "🤝 노마드 커뮤니티", "🍜 한국 음식",
]


def create_layout(advisor_fn):
    """
    Gradio Blocks 전체 레이아웃.
    advisor_fn: app.py의 nomad_advisor 함수
    """
    theme = create_theme()

    with gr.Blocks(
        theme=theme,
        title="NomadNavigator AI",
        css="""
        .main-header{text-align:center;padding:20px 0 10px}
        .main-header h1{font-size:2rem;color:#0C447C}
        .main-header p{color:#888780;font-size:.95rem}
        footer{display:none!important}
        """,
    ) as demo:

        with gr.Column(elem_classes="main-header"):
            gr.HTML("""
                <h1>🌏 NomadNavigator AI</h1>
                <p>국적 · 소득 · 라이프스타일을 입력하면 AI가 최적의 이민 설계를 제안합니다</p>
            """)

        with gr.Row():
            with gr.Column(scale=1):
                gr.Markdown("### 📋 내 프로필 입력")

                nationality = gr.Dropdown(
                    choices=NATIONALITIES, value="Korean",
                    label="국적", info="여권 발급 국가 기준"
                )
                income = gr.Slider(
                    minimum=1000, maximum=12000, value=3000, step=500,
                    label="월 수입 (USD)", info="세전 월 소득 기준"
                )
                lifestyle = gr.CheckboxGroup(
                    choices=LIFESTYLE_OPTIONS,
                    label="라이프스타일 선호",
                    info="해당 항목 모두 선택"
                )
                timeline = gr.Radio(
                    choices=["1년 단기 체험", "3년 장기 이민"],
                    value="1년 단기 체험",
                    label="목표 기간"
                )
                btn = gr.Button("🚀 이민 설계 시작", variant="primary", size="lg")
                gr.Markdown("_⚠️ 본 서비스는 참고용이며 법적 이민 조언이 아닙니다._")

            with gr.Column(scale=1):
                gr.Markdown("### 📊 맞춤 이민 설계 결과")
                output_md  = gr.Markdown("← 왼쪽에서 프로필을 입력하고 분석을 시작하세요.")
                output_pdf = gr.File(label="📄 리포트 PDF 다운로드")

        btn.click(
            fn=advisor_fn,
            inputs=[nationality, income, lifestyle, timeline],
            outputs=[output_md, output_pdf],
            show_progress=True,
        )

    return demo
```

---

## Phase 3 — 런칭 준비 (2:55 ~ 3:50)

### Step 4-1. `README.md` (HF Space 소개)

```markdown
---
title: NomadNavigator AI
emoji: 🌏
colorFrom: blue
colorTo: teal
sdk: gradio
sdk_version: 4.0.0
app_file: app.py
pinned: false
license: apache-2.0
---

# 🌏 NomadNavigator AI

**디지털 노마드를 위한 AI 이민 설계 서비스**

국적 · 월 수입 · 라이프스타일을 입력하면
**Qwen3.5-27B** + **RAG** 기반으로 최적의 거주 국가와 도시를 추천하고
비자 체크리스트와 예산이 담긴 PDF 리포트를 즉시 생성합니다.

## 주요 기능
- 🎯 10개국 비자 정보 기반 맞춤 추천 (RAG)
- 💰 도시별 생활비 시뮬레이션
- 📋 비자 준비 체크리스트 자동 생성
- 📄 PDF 리포트 다운로드

## 기술 스택
- **AI**: Qwen3.5-27B (HuggingFace Inference Providers via Novita)
- **RAG**: BAAI/bge-m3 임베딩 + FAISS 벡터 검색
- **Frontend**: Gradio 4.x
- **PDF**: ReportLab

⚠️ 본 서비스는 참고용이며 법적 이민 조언이 아닙니다.
```

### Step 4-2. Product Hunt 초안 (영어, 100자 이내)

```
Tagline:
"AI relocation planner for digital nomads — visa + budget + top cities in one PDF report"

Description:
"Enter your nationality, income & lifestyle. Get a personalized PDF with top 3 cities,
visa checklist, and budget — powered by Qwen3.5-27B + RAG. Built by a couple team in one day."

Hunter's comment:
"Built this in a 4-hour hackathon (AI dev wife + PM husband team).
Gap we noticed: every tool either dumps raw data or charges $500 for lawyers.
NNAI fills the middle — instant, personalized, and free.
Feedback welcome from nomads who've gone through the visa process!"
```

### Step 4-3. 초기 유저 피드백 DM 초안

```
안녕하세요 [이름]님! 저희 부부가 오늘 AI 서비스를 만들었습니다.
디지털 노마드 이민 고민 중이신 분께 딱 맞을 것 같아요.

국적·소득 입력하면 비자 추천 + 예산 + PDF 리포트가 즉시 나옵니다.
🔗 [HF Space URL]

5분만 써보시고 피드백 한마디만 주시면 감사하겠습니다! 🙏
(비자 정보 정확한지, UI 편한지, 추천 도시 마음에 드는지)
```

---

## 완료 기준 (Done Definition)

```
✅ visa_db.json — 10개국 정확한 데이터 완성
✅ city_scores.json — 최소 10개 도시 완성
✅ build_prompt() — list[dict] 반환, RAG 컨텍스트 포함 확인
✅ few_shots.py — OpenAI messages 형식 2쌍 완성
✅ Gradio UI — 모든 입력 필드 + 결과 패널 표시
✅ README.md — HF Space 공개 페이지 정상 표시
```

---

## 아내에게 전달할 인터페이스 (계약)

```python
# ⚠️ 반환 타입 변경: str → list[dict]
def build_prompt(user_profile: dict) -> list[dict]:
    """
    Returns OpenAI messages 형식.
    아내의 query_model(messages) 에 그대로 전달됩니다.
    이 시그니처를 절대 변경하지 마세요.
    """
    ...

# create_layout 입력/출력 — 동일
def create_layout(advisor_fn) -> gr.Blocks:
    ...
```

---

## RAG 동작 원리 (참고용 — 구현은 아내 담당)

```
[남편이 만든 data/*.json]
        ↓ (아내가 청크 분할 + 임베딩)
[FAISS 벡터 인덱스]
        ↓ (런타임)
유저 입력 → 임베딩 → 유사도 검색 → 관련 청크 top-6
        ↓ (남편의 builder.py가 주입)
[Qwen3.5-27B 프롬프트] = System Prompt + Few-shots + RAG 컨텍스트 + 유저 프로필
        ↓
JSON 응답 → 파싱 → 마크다운 + PDF
```

**내가 할 일**: `visa_db.json`과 `city_scores.json`을 **정확하고 풍부하게** 작성할수록
RAG 검색 품질이 높아지고 LLM 응답 정확도가 올라갑니다.
