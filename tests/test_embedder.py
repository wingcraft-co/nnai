import numpy as np
from unittest.mock import patch, MagicMock


def _mock_embed_response(dim: int = 3072) -> MagicMock:
    """requests.post() 응답 mock — Gemini embedding REST API 형식"""
    resp = MagicMock()
    resp.json.return_value = {"embedding": {"values": [0.1] * dim}}
    return resp


def test_embed_texts_returns_correct_shape():
    """N개 텍스트 → (N, 3072) float32 배열"""
    with patch("rag.embedder.requests.post", return_value=_mock_embed_response()):
        from rag.embedder import embed_texts
        result = embed_texts(["hello", "world"])
        assert result.shape == (2, 3072)
        assert result.dtype == np.float32


def test_embed_texts_is_l2_normalized():
    """각 벡터의 L2 노름 ≈ 1.0"""
    with patch("rag.embedder.requests.post", return_value=_mock_embed_response()):
        from rag.embedder import embed_texts
        result = embed_texts(["test"])
        norm = np.linalg.norm(result[0])
        assert abs(norm - 1.0) < 1e-5


def test_embed_query_returns_1d():
    """단일 쿼리 → 1D 벡터 (3072,)"""
    with patch("rag.embedder.requests.post", return_value=_mock_embed_response()):
        from rag.embedder import embed_query
        result = embed_query("비자 추천")
        assert result.shape == (3072,)
