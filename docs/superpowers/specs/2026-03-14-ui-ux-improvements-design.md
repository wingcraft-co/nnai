# NomadNavigator AI — UI/UX 개선 설계 문서

**작성일**: 2026-03-14
**범위**: 6가지 UI/UX 개선 항목
**관련 파일**: `ui/layout.py`, `api/parser.py`, `prompts/builder.py`, `report/pdf_generator.py`, `app.py`, `tests/`

---

## 1. Step 2 별도 탭 분리

### 현재 상태
- 단일 페이지에 Step 1 (도시 추천)과 Step 2 (상세 가이드)가 세로로 배치
- Step 1 미완료 상태에서도 Step 2 UI가 노출됨

### 변경 내용
Gradio `gr.Tabs`로 두 스텝을 분리:

**Tab 1: 🔍 도시 추천**
- 기존 Step 1 입력 폼 + 결과 패널 유지
- Step 1 완료 시 하단에 `"📖 상세 가이드 받기 →"` 버튼 등장 (`visible=False` → `True`)
- 버튼 클릭 시 Tab 2로 자동 전환 (`gr.Tabs.select()`)

**Tab 2: 📖 상세 가이드**
- 도시 선택 Radio (1~3순위)
- `"상세 가이드 + PDF 받기"` 버튼
- 결과 Markdown + PDF 다운로드 컴포넌트
- `gr.State`로 Step 1 결과(parsed_dict) 공유

### 구현 포인트
```python
with gr.Tabs() as tabs:
    with gr.Tab("🔍 도시 추천", id=0):
        ...
        btn_go_step2 = gr.Button("📖 상세 가이드 받기 →", visible=False)
    with gr.Tab("📖 상세 가이드", id=1):
        ...

# Step 1 완료 콜백에서:
# 1) step1_output 업데이트
# 2) btn_go_step2 visible=True
# 3) btn_go_step2 클릭 시 tabs.select(1) 전환
```

---

## 2. 로딩 인디케이터 — yield 스트리밍

### 현재 상태
- `show_progress=True`만 설정되어 있어 Gradio 기본 스피너만 표시
- 결과 패널에 시각적 변화 없음

### 변경 내용
`run_step1()`, `run_step2()` 함수를 **generator 함수**로 변환하여 단계별 메시지 yield:

**Step 1 메시지 시퀀스:**
```
🔍 프로필을 분석하는 중이에요...
🌍 전 세계 비자 데이터를 검색하는 중이에요...
🤖 AI가 최적의 도시를 선별하는 중이에요...
✨ 거의 다 됐어요!
→ [실제 결과]
```

**Step 2 메시지 시퀀스:**
```
🏙️ 선택한 도시 정보를 불러오는 중이에요...
📋 맞춤 이민 가이드를 작성하는 중이에요...
📄 PDF 리포트를 생성하는 중이에요...
→ [실제 결과]
```

### 구현 포인트
```python
def run_step1(nat, inc, purpose, life, langs, tl, preferred_countries):
    yield "🔍 프로필을 분석하는 중이에요...", gr.update(), gr.update()
    # ... 각 단계 yield
    markdown, cities, parsed = advisor_fn(...)
    yield markdown, parsed, gr.update(visible=True)
```

---

## 3. 관심 국가 선택 (소프트 힌트)

### 현재 상태
- 국가/도시 관련 입력 없음. AI가 전체 RAG 데이터에서 자유롭게 추천

### 변경 내용
Step 1 입력 폼에 `gr.CheckboxGroup` 추가 (timeline 아래, 버튼 위):

```
관심 국가 선택 (선택 안 하면 전체 고려)
info: "선택한 국가를 우선 고려하지만, AI가 더 적합한 곳을 제안할 수 있어요"

🇲🇾 말레이시아  🇵🇹 포르투갈    🇹🇭 태국
🇪🇪 에스토니아  🇪🇸 스페인      🇮🇩 인도네시아
🇩🇪 독일        🇬🇪 조지아      🇨🇷 코스타리카
🇬🇷 그리스      🇵🇭 필리핀      🇻🇳 베트남
```

RAG 데이터의 12개 국가 전체 제공 (각 flag emoji + 한국어명).

### 프롬프트 연동
`build_prompt(user_profile)` 호출 시 `preferred_countries` 전달:
```python
user_profile = {
    ...
    "preferred_countries": ["🇲🇾 말레이시아", "🇹🇭 태국"],
}
```

`prompts/builder.py`의 user message에 추가:
```
※ 우선 고려 국가: 말레이시아, 태국 (단, 프로필에 더 적합한 다른 도시가 있다면 포함 가능)
```

---

## 4. 언어 옵션 텍스트 수정

### 변경 내용
`ui/layout.py`:
```python
# Before
"🇰🇷 한국어만 가능"

# After
"🇰🇷 한국어"
```

연관 파일 동일 수정:
- `tests/test_ui.py` — 해당 문자열 참조 시 수정
- `tests/test_integration.py` — mock 데이터에서 참조 시 수정

---

## 5. PDF 한글 폰트 수정

### 현재 상태
- ReportLab 기본 Helvetica 폰트 사용
- 한글 문자 출력 불가 (빈 박스 또는 깨짐)

### 변경 내용

**폰트 번들링:**
- `assets/fonts/NanumGothic.ttf` 파일 추가 (Google Fonts / Nanum 폰트 패키지)
- HF Space(Linux) 환경에서도 동작하도록 폰트 파일 직접 번들

**ReportLab 등록:**
```python
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

FONT_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "fonts", "NanumGothic.ttf")
pdfmetrics.registerFont(TTFont("NanumGothic", FONT_PATH))
```

**모든 ParagraphStyle 변경:**
```python
# Before
ParagraphStyle("CustomBody", parent=styles["Normal"], fontSize=10, ...)

# After
ParagraphStyle("CustomBody", parent=styles["Normal"], fontSize=10, fontName="NanumGothic", ...)
```

**PDF 내용 한국어화:**
- "NomadNavigator AI - 이민 설계 리포트" (제목)
- "추천 도시 TOP 3" (섹션)
- "비자 준비 체크리스트" (섹션)
- "월 예산 브레이크다운" (섹션)
- 예산 항목: 임대료, 식비, 코워킹, 기타

**Table 폰트 처리:**
```python
TableStyle([
    ("FONTNAME", (0,0), (-1,-1), "NanumGothic"),
    ("FONTNAME", (0,0), (-1,0), "NanumGothic"),  # header
    ...
])
```

---

## 6. 추천 근거 링크 자동 생성

### 현재 상태
- `source_url`이 있으면 `([출처](url))` 표시
- `source_url`이 null이면 링크 없음

### 변경 내용
`api/parser.py`의 `format_step1_markdown()` 수정:

**source_url 있는 경우:** 기존 `([출처](url))` 유지

**source_url 없는 경우:** Google 검색 + YouTube 검색 링크 자동 생성
```python
from urllib.parse import quote

def _make_search_links(city: str, point: str) -> str:
    query = quote(f"{city} {point[:20]} 이민")
    google = f"https://www.google.com/search?q={query}"
    youtube = f"https://www.youtube.com/results?search_query={query}"
    return f" ([🔍 검색]({google})) ([▶ 유튜브]({youtube}))"
```

**출력 예시:**
```markdown
- 치앙마이는 디지털 노마드 커뮤니티 규모 기준 전 세계 상위 5개 도시입니다. ([🔍 검색](...)) ([▶ 유튜브](...))
- 코워킹 스페이스 월 이용료가 $60~100 수준입니다. ([출처](https://nomads.com))
```

---

## 변경 파일 목록

| 파일 | 변경 유형 | 내용 |
|------|---------|------|
| `ui/layout.py` | 수정 | Tabs 구조, 로딩 yield, 국가 선택 추가, 언어 텍스트 |
| `prompts/builder.py` | 수정 | preferred_countries 힌트 삽입 |
| `api/parser.py` | 수정 | 자동 검색 링크 생성 |
| `report/pdf_generator.py` | 수정 | NanumGothic 폰트 등록, 한국어화 |
| `assets/fonts/NanumGothic.ttf` | 신규 | 한글 폰트 파일 |
| `tests/test_ui.py` | 수정 | 언어 텍스트, 탭 구조 반영 |
| `tests/test_integration.py` | 수정 | 언어 텍스트, preferred_countries 파라미터 |
| `tests/test_parser.py` | 수정 | 자동 링크 생성 테스트 추가 |

---

## 비변경 파일

- `app.py` — `advisor_fn`, `detail_fn` 시그니처 변경 없음 (`preferred_countries`는 `user_profile` 내부에 포함)
- `rag/` — RAG 데이터 변경 없음
- `api/hf_client.py` — 변경 없음
- `prompts/few_shots.py` — 변경 없음
- `prompts/system.py` — 변경 없음

---

## 테스트 전략

- `test_ui.py`: 탭 구조, 국가 선택 컴포넌트 존재, 언어 옵션 확인
- `test_parser.py`: `source_url=None` 시 Google/YouTube 링크 포함 여부
- `test_integration.py`: `preferred_countries` 파라미터 전달 정상 동작
- `report/test_pdf_generator.py`: PDF 생성 시 한글 깨짐 없음 (파일 사이즈 > 0 확인)
