import pytest
from unittest.mock import MagicMock, patch

def test_query_model_returns_string():
    """정상 응답 시 문자열 반환"""
    fake_response = MagicMock()
    fake_response.choices[0].message.content = '{"greeting": "안녕하세요!"}'
    with patch("api.hf_client.client") as mock_client:
        mock_client.chat.completions.create.return_value = fake_response
        from api.hf_client import query_model
        result = query_model([{"role": "user", "content": "test"}])
        assert isinstance(result, str)
        assert "안녕하세요" in result

def test_query_model_strips_think_blocks():
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
