# 아내용 Task — NomadNavigator AI (Backend)
> **역할**: Python 백엔드 전담 — HF Inference Providers API 연결 · RAG 파이프라인 구축 · JSON 파싱 · PDF 생성 · Gradio 앱 진입점
> **총 소요 시간**: 약 3시간 30분 (싱크 시간 제외)

---

## ⚡ 변경 사항 요약 (이전 버전 대비)

| 항목 | 이전 | 현재 |
|------|------|------|
| LLM 모델 | `Qwen/Qwen2.5-7B-Instruct` | `Qwen/Qwen3.5-27B` |
| API 호출 방식 | `requests.post` (raw) | `openai.OpenAI` (HF Router) |
| API 엔드포인트 | `api-inference.huggingface.co` | `router.huggingface.co/v1` |
| 데이터 레이어 | JSON 직접 로딩 | **RAG** (임베딩 + 벡터 검색) |
| 임베딩 모델 | 없음 | `BAAI/bge-m3` (HF Inference API) |
| 벡터 스토어 | 없음 | FAISS (로컬 인덱스) |
| 신규 폴더 | 없음 | `rag/` 추가 |

---

## 프로젝트 폴더 구조 (내 담당 영역)

```
nomad-navigator-ai/
├── app.py                      ← 내 메인 파일 (Gradio 진입점)
├── api/
│   ├── __init__.py
│   ├── hf_client.py            ← ✏️ 수정: HF Router + openai 클라이언트
│   └── parser.py               ← 동일 (변경 없음)
├── rag/                        ← 🆕 신규 폴더 (RAG 전담)
│   ├── __init__.py
│   ├── embedder.py             ← 🆕 텍스트 → 벡터 (BAAI/bge-m3)
│   ├── vector_store.py         ← 🆕 FAISS 인덱스 빌드 & 저장
│   ├── retriever.py            ← 🆕 쿼리 → 관련 문서 검색
│   └── build_index.py          ← 🆕 초기 인덱스 빌드 스크립트
├── report/
│   ├── __init__.py
│   └── pdf_generator.py        ← 동일 (변경 없음)
└── requirements.txt            ← ✏️ 수정
```

> **남편 담당 폴더** (건드리지 않기): `prompts/`, `data/`, `ui/`, `assets/`

---

## Phase 1 — 환경 세팅 (0:15 ~ 1:00)

### Step 1-1. `requirements.txt`

```
gradio>=4.0
openai>=1.30
huggingface_hub>=0.24
faiss-cpu>=1.8
sentence-transformers>=3.0
numpy>=1.26
reportlab>=4.0
python-dotenv>=1.0
```

> ⚠️ HF Space 무료 CPU 인스턴스 → `faiss-cpu` 사용 (faiss-gpu 불가)

### Step 1-2. `.env.example`

```
HF_TOKEN=hf_여기에_토큰_입력
```

### Step 1-3. HuggingFace Space 생성

```
1. https://huggingface.co/spaces → "Create new Space"
2. Space name: nomad-navigator-ai  |  SDK: Gradio  |  Visibility: Public
3. Settings → Repository secrets → HF_TOKEN 추가
```

### Step 1-4. ✏️ `api/hf_client.py` — HF Router + Qwen3.5-27B

```python
import os
import re
from openai import OpenAI

HF_TOKEN = os.getenv("HF_TOKEN", "")
MODEL_ID  = "Qwen/Qwen3.5-27B"

# HF Inference Providers 라우터 — Novita provider로 Qwen3.5-27B 호출
client = OpenAI(
    base_url="https://router.huggingface.co/v1",
    api_key=HF_TOKEN,
)


def query_model(messages: list[dict], max_tokens: int = 2048) -> str:
    """
    HF Inference Providers 라우터를 통해 Qwen3.5-27B 호출.

    Args:
        messages: OpenAI 형식 대화 리스트
                  [{"role": "system"|"user"|"assistant", "content": "..."}]
        max_tokens: 최대 출력 토큰 수
    Returns:
        str: 모델 응답 텍스트 (thinking 블록 자동 제거)
    """
    try:
        response = client.chat.completions.create(
            model=MODEL_ID,
            messages=messages,
            max_tokens=max_tokens,
            temperature=0.3,      # 낮은 온도 → 안정적인 JSON 출력
            top_p=0.95,
            extra_body={
                "top_k": 20,
                # thinking 모드 OFF → 빠른 응답 + JSON 출력 안정성
                # V2에서 복잡한 추론 필요 시 이 줄 제거
                "chat_template_kwargs": {"thinking": False},
            },
        )
        raw = response.choices[0].message.content or ""
        # Qwen3.5 <think>...</think> 블록 혹시 포함 시 제거
        raw = re.sub(r"<think>[\s\S]*?</think>", "", raw).strip()
        return raw

    except Exception as e:
        return f"ERROR: {str(e)}"


def query_model_with_thinking(messages: list[dict], max_tokens: int = 4096) -> tuple[str, str]:
    """
    Thinking 모드 활성화 버전 (V2 고급 추론용).
    Returns: (thinking_content, response_content)
    """
    try:
        response = client.chat.completions.create(
            model=MODEL_ID,
            messages=messages,
            max_tokens=max_tokens,
            temperature=1.0,   # thinking 모드 권장 온도
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

### Step 1-5. API 연결 테스트

```python
# test_api.py 로 저장 → python test_api.py
from dotenv import load_dotenv
load_dotenv()
from api.hf_client import query_model

result = query_model([
    {"role": "user", "content": 'Reply ONLY with JSON: {"greeting": "안녕하세요!"}'}
])
print(result)
# 기대 출력: {"greeting": "안녕하세요!"}
```

✅ **Phase 1 완료 체크**: JSON 형태 응답 확인 후 다음 단계

---

## Phase 2-A — 🆕 RAG 파이프라인 구축 (1:00 ~ 1:45)

> **RAG 흐름 요약**
> 1. `data/*.json` → 텍스트 청크 분할 → BAAI/bge-m3 임베딩 → FAISS 인덱스 저장
> 2. 런타임: 유저 쿼리 → 임베딩 → FAISS 검색 → 관련 청크 → 프롬프트 주입 → LLM

### Step 2-1. `rag/__init__.py`

```python
# 비워두기
```

### Step 2-2. `rag/embedder.py` — BGE-M3 임베딩

```python
import os
import numpy as np
from huggingface_hub import InferenceClient

HF_TOKEN    = os.getenv("HF_TOKEN", "")
EMBED_MODEL = "BAAI/bge-m3"   # 1024차원, 한국어·영어·중국어 다국어 지원

_embed_client = InferenceClient(provider="hf-inference", api_key=HF_TOKEN)


def embed_texts(texts: list[str]) -> np.ndarray:
    """
    텍스트 리스트 → (N, 1024) float32 임베딩 행렬.
    코사인 유사도 검색을 위해 L2 정규화 적용.
    """
    embeddings = []
    for text in texts:
        result = _embed_client.feature_extraction(
            text[:512],          # 토큰 안전 마진
            model=EMBED_MODEL,
        )
        vec = np.array(result, dtype=np.float32)
        if vec.ndim > 1:
            vec = vec.mean(axis=0)   # mean pooling
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm         # L2 정규화
        embeddings.append(vec)
    return np.stack(embeddings)


def embed_query(query: str) -> np.ndarray:
    """단일 쿼리 → 1D 벡터 (1024,)"""
    return embed_texts([query])[0]
```

### Step 2-3. `rag/vector_store.py` — FAISS 인덱스 빌드 & 저장

```python
import os
import json
import pickle
import faiss
import numpy as np
from rag.embedder import embed_texts

INDEX_PATH = "rag/index.faiss"
DOCS_PATH  = "rag/documents.pkl"   # [{id, text, metadata}, ...] 리스트


# ─── 청크 분할 헬퍼 ─────────────────────────────────────────────

def _chunk_visa_db(path: str = "data/visa_db.json") -> list[dict]:
    """visa_db.json → 국가별 청크 (비자 정보 / 서류 목록 분리)"""
    with open(path, "r", encoding="utf-8") as f:
        db = json.load(f)

    chunks = []
    for c in db.get("countries", []):
        # 청크 A: 비자 기본 정보
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
        # 청크 B: 필수 서류
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
    """city_scores.json → 도시별 청크"""
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


# ─── 인덱스 빌드 / 로드 ────────────────────────────────────────

def build_index(force: bool = False):
    """
    data/ 폴더의 JSON → 청크 → 임베딩 → FAISS 인덱스 저장.
    이미 인덱스가 있으면 스킵 (force=True 시 강제 재빌드).
    """
    if not force and os.path.exists(INDEX_PATH) and os.path.exists(DOCS_PATH):
        print("✅ RAG 인덱스 발견 — 로드 스킵 (재빌드: force=True)")
        return

    print("🔨 RAG 인덱스 빌드 중...")
    chunks = _chunk_visa_db() + _chunk_city_scores()
    texts  = [c["text"] for c in chunks]

    print(f"  {len(chunks)}개 청크 임베딩 중 (BAAI/bge-m3)...")
    embeddings = embed_texts(texts)          # (N, 1024) float32

    dim   = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)           # 내적 = 코사인 유사도 (L2 정규화 후)
    index.add(embeddings)

    os.makedirs("rag", exist_ok=True)
    faiss.write_index(index, INDEX_PATH)
    with open(DOCS_PATH, "wb") as f:
        pickle.dump(chunks, f)

    print(f"✅ RAG 완성 — {len(chunks)}개 청크, 벡터 차원: {dim}")


def load_index():
    """저장된 인덱스 + 문서 로드"""
    if not os.path.exists(INDEX_PATH):
        raise FileNotFoundError("RAG 인덱스 없음 — build_index() 먼저 실행")
    index = faiss.read_index(INDEX_PATH)
    with open(DOCS_PATH, "rb") as f:
        docs = pickle.load(f)
    return index, docs
```

### Step 2-4. `rag/retriever.py` — 쿼리 → 관련 청크 검색

```python
import numpy as np
from rag.embedder import embed_query
from rag.vector_store import load_index

_index = None
_docs  = None


def _ensure_loaded():
    global _index, _docs
    if _index is None:
        _index, _docs = load_index()


def retrieve(query: str, top_k: int = 6) -> list[dict]:
    """
    자연어 쿼리 → 관련 청크 top_k개.
    반환: [{"id", "text", "metadata", "score"}, ...]
    """
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
    """검색 결과 → 프롬프트 주입용 문자열"""
    docs = retrieve(query, top_k=top_k)
    if not docs:
        return "관련 데이터를 찾지 못했습니다."

    lines = ["=== RAG 검색 결과 (관련 비자·도시 데이터) ==="]
    for i, doc in enumerate(docs, 1):
        lines.append(f"\n[{i}] {doc['text']}")
    return "\n".join(lines)
```

### Step 2-5. `rag/build_index.py` — 최초 빌드 스크립트

```python
"""
최초 1회만 실행:
    python rag/build_index.py
    python rag/build_index.py --force   (강제 재빌드)

HF Space deploy 시 app.py 상단 build_index() 호출로 자동 실행.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()
from rag.vector_store import build_index

if __name__ == "__main__":
    build_index(force="--force" in sys.argv)
```

---

## Phase 2-B — `api/parser.py` (변경 없음)

```python
import json, re

def parse_response(raw_text: str) -> dict:
    json_pattern = r"```(?:json)?\s*([\s\S]*?)```"
    for match in re.findall(json_pattern, raw_text):
        try:
            return json.loads(match.strip())
        except json.JSONDecodeError:
            continue
    for match in sorted(re.findall(r"\{[\s\S]*\}", raw_text), key=len, reverse=True):
        try:
            return json.loads(match)
        except json.JSONDecodeError:
            continue
    return {
        "top_cities": [{"city": "파싱 오류", "country": "-", "visa_type": "-",
                        "monthly_cost": 0, "score": 0, "why": raw_text[:200]}],
        "visa_checklist": ["응답 파싱 실패. 다시 시도해 주세요."],
        "budget_breakdown": {"rent": 0, "food": 0, "cowork": 0, "misc": 0},
        "first_steps": ["다시 시도해 주세요."], "_raw": raw_text,
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
    for k, label in [("rent","주거"),("food","식비"),("cowork","코워킹"),("misc","기타")]:
        lines.append(f"| {label} | ${bd.get(k,0):,} |")
    lines.append(f"| **합계** | **${sum(bd.values()):,}** |")
    lines.append("\n## 🚀 첫 번째 실행 스텝\n")
    for j, step in enumerate(data.get("first_steps", []), 1):
        lines.append(f"{j}. {step}")
    return "\n".join(lines)
```

---

## Phase 2-C — `app.py` 메인 파일 (2:00 ~ 2:30)

```python
import os
from dotenv import load_dotenv
load_dotenv()

# 아내 담당
from api.hf_client import query_model
from api.parser    import parse_response, format_result_markdown
from report.pdf_generator import generate_report
from rag.vector_store     import build_index

# 남편 담당
from prompts.builder import build_prompt
from ui.layout       import create_layout


# ── 앱 시작 시 RAG 인덱스 자동 초기화 ──────────────────────────
print("🔧 RAG 인덱스 초기화...")
build_index(force=False)
print("✅ RAG 준비 완료")


def nomad_advisor(nationality, income, lifestyle, timeline):
    """핵심 파이프라인: RAG → 프롬프트 → Qwen3.5-27B → 파싱 → PDF"""
    user_profile = {
        "nationality": nationality,
        "income":      int(income),
        "lifestyle":   lifestyle if isinstance(lifestyle, list) else [lifestyle],
        "timeline":    timeline,
    }

    # 1. 프롬프트 생성 (남편 모듈 — RAG 컨텍스트 주입 포함)
    messages = build_prompt(user_profile)        # list[dict] 반환

    # 2. Qwen3.5-27B 호출
    raw_response = query_model(messages, max_tokens=2048)
    if raw_response.startswith("ERROR"):
        return f"⚠️ API 오류: {raw_response}", None

    # 3. 파싱 → 마크다운 → PDF
    parsed          = parse_response(raw_response)
    markdown_output = format_result_markdown(parsed)
    pdf_path        = generate_report(parsed, user_profile)

    return markdown_output, pdf_path


if __name__ == "__main__":
    demo = create_layout(nomad_advisor)
    demo.launch()
```

---

## Phase 3 — 안정화 + 배포 (2:55 ~ 3:50)

### `.gitignore` 추가 항목

```
rag/index.faiss
rag/documents.pkl
.env
__pycache__/
*.pyc
```

> `build_index()`가 Space 첫 실행 시 자동으로 인덱스를 재생성하므로 커밋 불필요.

### 배포 체크리스트

```
□ python rag/build_index.py   (로컬에서 한 번 실행해 청크 수 확인)
□ git push → HF Space 빌드 로그에서 "RAG 준비 완료" 확인
□ 테스트 3케이스 실행 (아래 표 참고)
□ PDF 다운로드 정상 여부 확인
□ 응답 속도 기록 (Novita 경유 Qwen3.5-27B: 약 5~15초 예상)
```

### 테스트 시나리오

| 케이스 | 국적 | 소득 | 라이프스타일 | 기간 |
|--------|------|------|------------|------|
| A | Korean | $2,000 | 저물가, 따뜻한 기후 | 1년 단기 체험 |
| B | Korean | $5,500 | 도심, 영어권, 안전 | 3년 장기 이민 |
| C | American | $4,000 | 해변, 노마드 커뮤니티 | 1년 단기 체험 |

---

## 완료 기준 (Done Definition)

```
✅ query_model() — Qwen3.5-27B 응답 수신 (HF Router 경유)
✅ build_index() — RAG 인덱스 빌드 성공 (청크 수 터미널에 출력)
✅ retrieve_as_context() — 비자·도시 관련 텍스트 반환 확인
✅ end-to-end — 입력 → RAG → Qwen3.5 → JSON → PDF 정상 작동
✅ HF Space Public URL 접근 가능
```

---

## 남편에게 전달할 인터페이스 (계약)

```python
# ⚠️ build_prompt 반환 타입 변경: str → list[dict]
def build_prompt(user_profile: dict) -> list[dict]:
    """
    Returns OpenAI messages 형식:
    [
        {"role": "system", "content": "SYSTEM_PROMPT"},
        {"role": "user",   "content": "유저 프로필 + RAG 컨텍스트"},
    ]
    """
    ...

# nomad_advisor 시그니처 — 변경 없음
def nomad_advisor(nationality: str, income: int,
                  lifestyle: list, timeline: str) -> tuple[str, str]:
    ...
```
