import os
import numpy as np
import requests

EMBED_MODEL = "models/gemini-embedding-001"
_EMBED_URL = (
    "https://generativelanguage.googleapis.com/v1beta/"
    f"{EMBED_MODEL}:embedContent"
)


def _embed_one(text: str) -> np.ndarray:
    key = os.getenv("GEMINI_API_KEY", "")
    resp = requests.post(
        f"{_EMBED_URL}?key={key}",
        json={"model": EMBED_MODEL, "content": {"parts": [{"text": text[:2048]}]}},
        timeout=30,
    )
    resp.raise_for_status()
    vec = np.array(resp.json()["embedding"]["values"], dtype=np.float32)
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return vec


def embed_texts(texts: list[str]) -> np.ndarray:
    """텍스트 리스트 → (N, 3072) float32, L2 정규화 적용"""
    return np.stack([_embed_one(t) for t in texts])


def embed_query(query: str) -> np.ndarray:
    """단일 쿼리 → 1D 벡터 (3072,)"""
    return _embed_one(query)
