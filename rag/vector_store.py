import os, json, pickle
import faiss
import numpy as np
from rag.embedder import embed_texts
from utils.data_paths import resolve_data_path

INDEX_PATH = "rag/index.faiss"
DOCS_PATH  = "rag/documents.pkl"


def _chunk_visa_db(path: str | None = None) -> list[dict]:
    path = path or str(resolve_data_path("visa_db.json"))
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


def _chunk_city_scores(path: str | None = None) -> list[dict]:
    path = path or str(resolve_data_path("city_scores.json"))
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
        print("RAG 인덱스 발견 — 로드 스킵 (재빌드: force=True)")
        return

    print("RAG 인덱스 빌드 중...")
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

    print(f"RAG 완성 — {len(chunks)}개 청크, 벡터 차원: {dim}")


def load_index():
    if not os.path.exists(INDEX_PATH):
        raise FileNotFoundError("RAG 인덱스 없음 — build_index() 먼저 실행")
    index = faiss.read_index(INDEX_PATH)
    with open(DOCS_PATH, "rb") as f:
        docs = pickle.load(f)
    return index, docs
