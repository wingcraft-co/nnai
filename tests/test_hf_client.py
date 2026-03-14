# tests/test_hf_client.py
import pytest
from unittest.mock import MagicMock, patch


def _openai_mock(text: str) -> MagicMock:
    """OpenAI chat.completions.create() 응답 mock 생성 헬퍼"""
    msg = MagicMock()
    msg.content = text
    choice = MagicMock()
    choice.message = msg
    resp = MagicMock()
    resp.choices = [choice]
    client = MagicMock()
    client.chat.completions.create.return_value = resp
    return client


def test_query_model_returns_string():
    """정상 응답 시 문자열 반환"""
    import api.hf_client as mod
    mod._client = _openai_mock('{"greeting": "안녕하세요!"}')

    result = mod.query_model([{"role": "user", "content": "test"}])

    mod._client = None
    assert isinstance(result, str)
    assert "안녕하세요" in result


def test_query_model_strips_think_blocks():
    """<think>...</think> 블록 제거 확인"""
    import api.hf_client as mod
    mod._client = _openai_mock('<think>내부 추론입니다</think>\n{"answer": "yes"}')

    result = mod.query_model([{"role": "user", "content": "test"}])

    mod._client = None
    assert "<think>" not in result
    assert "answer" in result


def test_query_model_returns_error_on_exception():
    """API 예외 시 ERROR: 로 시작하는 문자열 반환"""
    import api.hf_client as mod
    client = MagicMock()
    client.chat.completions.create.side_effect = Exception("timeout")
    mod._client = client

    result = mod.query_model([{"role": "user", "content": "test"}])

    mod._client = None
    assert result.startswith("ERROR:")


def test_query_model_passes_system_message():
    """system role 메시지가 그대로 API에 전달되어야 함"""
    import api.hf_client as mod
    client = _openai_mock('{"ok": true}')
    mod._client = client

    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "안녕하세요"},
    ]
    mod.query_model(messages)

    mod._client = None
    call_kwargs = client.chat.completions.create.call_args.kwargs
    passed_messages = call_kwargs.get("messages", [])
    assert any(m["role"] == "system" for m in passed_messages)
