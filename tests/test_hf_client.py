# tests/test_hf_client.py
import pytest
from unittest.mock import MagicMock, patch


def test_query_model_returns_string():
    """정상 응답 시 문자열 반환"""
    with patch("api.hf_client.requests.post") as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = [{"generated_text": '{"greeting": "안녕하세요!"}'}]
        mock_post.return_value = mock_resp

        from api.hf_client import query_model
        result = query_model([{"role": "user", "content": "test"}])

    assert isinstance(result, str)
    assert "안녕하세요" in result


def test_query_model_strips_think_blocks():
    """<think>...</think> 블록 제거 확인"""
    with patch("api.hf_client.requests.post") as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = [
            {"generated_text": '<think>내부 추론입니다</think>\n{"answer": "yes"}'}
        ]
        mock_post.return_value = mock_resp

        from api.hf_client import query_model
        result = query_model([{"role": "user", "content": "test"}])

    assert "<think>" not in result
    assert "answer" in result


def test_query_model_returns_error_on_exception():
    """API 예외 시 ERROR: 로 시작하는 문자열 반환"""
    with patch("api.hf_client.requests.post") as mock_post:
        mock_post.side_effect = Exception("timeout")

        from api.hf_client import query_model
        result = query_model([{"role": "user", "content": "test"}])

    assert result.startswith("ERROR:")


def test_query_model_handles_openai_chat_format():
    """OpenAI chat completion 응답 형식도 처리해야 함"""
    with patch("api.hf_client.requests.post") as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": '{"result": "ok"}'}}]
        }
        mock_post.return_value = mock_resp

        from api.hf_client import query_model
        result = query_model([{"role": "user", "content": "test"}])

    assert isinstance(result, str)
    assert "result" in result
