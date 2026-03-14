# NNAI v3 Refactoring Task Specification

**작성일**: 2026-03-14  
**기준 브랜치**: `main` (75/75 테스트 통과 상태)  
**작업 브랜치**: `refactor/v3-feedback`  
**작업 순서**: 반드시 아래 순서대로 실행. 각 태스크 완료 후 테스트 통과 확인 후 다음으로 이동.

---

## 사전 작업
```bash
git checkout -b refactor/v3-feedback
SKIP_RAG_INIT=1 python -m pytest tests/ -v  # 베이스라인 확인 (75/75)
```

---

## TASK-0: 서비스 목적 재정의 — 이민 관련 요소 전면 제거

### 배경
현재 UI 입력 폼에 '이민 목적'과 관련된 필드가 존재함. NomadNavigator AI의 올바른 목적은 **"디지털 노마드로서 장기 체류할 최적 도시/국가 추천"**이며, 영구 이민(permanent immigration) 맥락은 서비스 범위 외임.

### 조사 지시 (Plan Mode에서 먼저 실행)
다음 파일을 읽고, 이민 관련 필드/워딩/로직을 모두 나열하라:
- `ui/layout.py` — 입력 폼 필드 전체
- `prompts/builder.py` — `build_prompt()` 인자 및 프롬프트 문자열
- `prompts/system.py` — 시스템 프롬프트 전문
- `prompts/few_shots.py` — Few-shot 예시 전문
- `api/parser.py` — `format_step1_markdown()`, `format_step2_markdown()`

### 제거/수정 대상 (조사 후 확정)
- 입력 폼에서 '이민 목적', '이민 계획', '비자 목적' 등 영구 이민을 암시하는 모든 필드 및 레이블 제거
- 시스템 프롬프트/Few-shot에서 "이민", "영주권", "permanent residence" 등의 표현을 "디지털 노마드 장기 체류", "long-stay", "remote work visa" 등으로 교체
- 마크다운 출력 포맷에서 동일한 워딩 수정

### 완료 기준
- UI 입력 폼 어디에도 '이민 목적' 관련 필드가 없을 것
- 프롬프트/출력 전체에서 영구 이민 맥락 표현이 제거될 것

---

## TASK-1: 도시 추천 결과 (Step 1) 개선

### TASK-1-a: 비자 링크 정확성 확보

#### 문제
`visa_url` 필드에 LLM이 생성한 URL이 삽입되나, 존재하지 않는 페이지를 참조하는 경우가 빈번함.

#### 해결 방식
LLM에게 URL을 자유 생성하게 하지 말고, **코드에서 `country_id` 기반으로 하드코딩된 공식 URL을 주입**하는 방식으로 전환.

아래 매핑 테이블을 `data/visa_urls.json` 파일로 신규 생성하라:
```json
{
  "MY": "https://www.imi.gov.my/index.php/en/main-services/pass/de-rantau-nomad-pass",
  "PT": "https://imigracao.pt/en/visas/digital-nomad",
  "TH": "https://www.boi.go.th/en/index/",
  "EE": "https://www.politsei.ee/en/instructions/digital-nomad-visa",
  "ES": "https://www.exteriores.gob.es/en/ServiciosAlCiudadano/Paginas/VisadoDigitalNomad.aspx",
  "ID": "https://www.imigrasi.go.id/en/",
  "DE": "https://www.make-it-in-germany.com/en/visa-residence/types/freelancers",
  "GE": "https://stopalto.ge/en",
  "CR": "https://www.migracion.go.cr/",
  "GR": "https://migration.gov.gr/en/digital-nomad-visa/",
  "PH": "https://www.dfa.gov.ph/",
  "VN": "https://evisa.xuatnhapcanh.gov.vn/"
}
```

> **중요**: 위 URL은 초기값이며, Claude Code는 각 URL이 현재 유효한지 HTTP HEAD 요청으로 검증한 뒤 실패한 항목은 해당 이민국 공식 도메인 루트로 대체할 것.

#### 적용 위치
- `api/parser.py` 또는 `prompts/builder.py` 중 Step 1 응답 후처리 시점에, `country_id` → `visa_urls.json` 룩업으로 `visa_url` 필드를 덮어쓰는 로직 추가
- LLM 프롬프트에서 `visa_url` 생성 지시 제거 (환각 차단)

---

### TASK-1-b: 검색/유튜브 링크 전면 제거

#### 문제
`api/parser.py`의 `format_step1_markdown()`에서 `source_url=None`인 경우 Google 검색 링크 및 YouTube 링크를 자동 생성하는 로직이 있음.

#### 수정 대상
- `api/parser.py`: `source_url`이 `None`일 때 Google/YouTube 링크를 생성하는 모든 분기 제거
- 관련 테스트가 해당 링크 존재를 단언하고 있다면 테스트도 함께 수정

---

### TASK-1-c: 출처(References) 섹션 신설

#### 요구사항
각 추천 도시 카드 **최하단**에 `### 참고 자료` 섹션을 별도로 추가. 기존 `reasons[].source_url` 인라인 링크 방식 폐기.

#### LLM 스키마 변경 (Step 1)
`top_cities[]` 각 항목에 `references` 배열 필드를 신규 추가:
```json
"references": [
  {
    "title": "Wikipedia — Chiang Mai",
    "url": "https://en.wikipedia.org/wiki/Chiang_Mai"
  }
]
```

#### 출처 품질 기준 (프롬프트에 명시할 것)
LLM에게 아래 우선순위로 출처를 선택하도록 지시:
1. 해당 국가 정부 공식 사이트 (이민국, 비자 포털)
2. Wikipedia (해당 도시 또는 비자 제도 문서)
3. Numbeo (생활비 데이터)
4. 위 세 가지에 해당하지 않으면 출처 생략 (임의 URL 금지)

#### 마크다운 포맷 변경
`format_step1_markdown()` 수정:
```
### 참고 자료
- [Wikipedia — Chiang Mai](https://en.wikipedia.org/wiki/Chiang_Mai)
- [태국 BOI 공식 사이트](https://www.boi.go.th/en/index/)
```

---

## TASK-2: 상세 가이드 (Step 2) 개선

### TASK-2-a: 도시 선택 버튼 텍스트 동적 반영

#### 문제
현재 상세 가이드 탭의 도시 선택 UI가 "1순위 도시 / 2순위 도시 / 3순위 도시" 고정 텍스트를 사용함.

#### 요구사항
Step 1 완료 후 `parsed_state`에 저장된 `top_cities` 데이터를 활용하여, 버튼 레이블을 아래 형식으로 동적 업데이트:
```
🇲🇾 Kuala Lumpur, MYS
🇨🇷 San Jose, CRI  
🇬🇷 Athens, GRC
```

#### 구현 지시
- 국가 코드 2자리(`country_id`) → 플래그 이모지 변환 함수를 `ui/layout.py`에 추가 (지역 지시자 유니코드 계산 방식 사용)
- 2자리 ISO → 3자리 ISO 매핑 딕셔너리를 `ui/layout.py`에 추가 (12개국 범위)
- `run_step1()` generator의 yield에서 버튼 레이블 3개를 함께 반환하도록 시그니처 수정
- `ui/layout.py`의 `btn_city_1`, `btn_city_2`, `btn_city_3` (또는 Radio/Dropdown이면 해당 컴포넌트) 업데이트

---

### TASK-2-b: 비자 준비 체크리스트 파싱 버그 수정

#### 문제
Step 2 응답의 `visa_checklist` 필드가 UI에 렌더링되지 않음.

#### 조사 지시 (Plan Mode에서 먼저 실행)
1. `api/parser.py`의 `format_step2_markdown()`에서 `visa_checklist` 처리 로직 전문 출력
2. `prompts/few_shots.py`의 Step 2 Few-shot에서 `visa_checklist` 형식 확인
3. `prompts/builder.py`의 `build_detail_prompt()`에서 JSON 스키마 지시 확인
4. 실제 LLM 응답 로그에서 `visa_checklist` 값의 타입 확인 (list of str vs list of dict vs str)

#### 예상 원인 및 수정 방향
- LLM이 `visa_checklist`를 문자열 또는 dict 배열로 반환하나 파서가 list of str을 기대하는 타입 불일치 가능성
- `format_step2_markdown()`에 타입 방어 로직 추가: `str` / `list[str]` / `list[dict]` 모든 케이스 처리
- 프롬프트의 스키마 예시가 실제 파서 기대값과 일치하는지 교차 검증 후 불일치 시 프롬프트 수정

---

### TASK-2-c & 2-d: 월 예산 섹션 — 근거 데이터 추가 및 워딩 변경

#### 워딩 변경
- 섹션 제목: `"월 예산 브레이크다운"` → `"한 달 예상 지출 내역"`
- 마크다운 출력에서 동일하게 적용

#### 근거 데이터 요구사항
LLM이 `budget_breakdown` 수치를 생성할 때 Numbeo 데이터를 참조 기준으로 사용하도록 프롬프트에 명시:

**프롬프트에 추가할 지시:**
```
budget_breakdown의 각 항목은 Numbeo(https://www.numbeo.com/cost-of-living/)의
해당 도시 생활비 데이터를 기준으로 작성하라.
출력 JSON에 "budget_source" 필드를 추가하여 Numbeo URL을 포함하라.
예: "budget_source": "https://www.numbeo.com/cost-of-living/in/Chiang-Mai"
```

**Step 2 JSON 스키마 변경:**
```json
"budget_breakdown": {
  "rent": 600,
  "food": 300,
  "cowork": 100,
  "misc": 150
},
"budget_source": "https://www.numbeo.com/cost-of-living/in/Chiang-Mai"
```

**마크다운 출력 변경 (`format_step2_markdown()`):**
```
### 한 달 예상 지출 내역
| 항목 | 금액 (USD) |
|------|-----------|
| 주거 | $600 |
| 식비 | $300 |
| 코워킹 | $100 |
| 기타 | $150 |
| **합계** | **$1,150** |

> 출처: [Numbeo — Chiang Mai 생활비](https://www.numbeo.com/cost-of-living/in/Chiang-Mai)
```

---

### TASK-2-e: `first_steps` 미출력 버그 수정

#### 문제
Step 2 결과에서 "첫 번째 실행 스텝" 섹션이 렌더링되지 않음. API 호출 또는 파싱 문제 의심.

#### 조사 지시 (Plan Mode에서 먼저 실행)
1. `api/hf_client.py`의 `query_model()`에 임시 로그를 추가하여 Step 2 raw 응답 전문을 `stderr`에 출력
2. `api/parser.py`의 `parse_response()`가 `first_steps` 키를 올바르게 추출하는지 단위 테스트로 확인
3. `format_step2_markdown()`에서 `first_steps` 렌더링 분기가 존재하는지 확인
4. `prompts/builder.py`의 `build_detail_prompt()`에서 `first_steps` 생성 지시가 포함되어 있는지 확인

#### 수정 방향
- raw 응답 로그 확인 후: LLM이 `first_steps`를 반환하지 않는다면 → 프롬프트 강화
- LLM은 반환하나 파서가 누락한다면 → `parse_response()` 또는 `format_step2_markdown()` 수정
- `max_tokens` 한도 초과로 응답이 잘린다면 → `hf_client.py`의 `max_tokens` 값 상향 검토

---

## TASK-3: PDF 기능 전면 제거

### 제거 대상 파일 및 코드

**삭제할 파일/디렉터리:**
- `report/pdf_generator.py`
- `report/` 디렉터리 (비어있으면 삭제)
- `assets/fonts/NanumGothic.ttf`
- `assets/fonts/` 디렉터리 (비어있으면 삭제)
- `assets/` 디렉터리 (비어있으면 삭제)

**수정할 파일:**
- `ui/layout.py`: `output_pdf` 컴포넌트 및 관련 렌더링 코드 제거, `run_step2()` yield 시그니처에서 PDF 출력 제거
- `app.py`: `pdf_generator` import 및 호출 제거
- `requirements.txt`: `reportlab` 패키지 제거

**기술 스택 표에서 PDF 행 제거** (CONTEXT.md는 별도 업데이트)

### 완료 기준
- `import reportlab` 또는 `from report` 참조가 코드베이스 어디에도 없을 것
- `run_step2()` yield 값이 `[step2_output]` 단일 값으로 축소될 것
- PDF 관련 테스트 삭제 또는 skip 처리

---

## 전체 완료 기준
```bash
SKIP_RAG_INIT=1 python -m pytest tests/ -v  # 모든 테스트 통과
python app.py  # 앱 정상 기동 확인
```

완료 후 커밋:
```bash
git add -A
git commit -m "refactor: v3 — remove PDF/immigration, fix step2 bugs, improve references"
git push origin refactor/v3-feedback
```