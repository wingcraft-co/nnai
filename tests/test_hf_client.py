# tests/test_hf_client.py
import pytest
from unittest.mock import MagicMock, patch


def _mock_anthropic(text: str) -> MagicMock:
    """anthropic.Anthropic().messages.create() 응답 mock 생성 헬퍼"""
    block = MagicMock()
    block.text = text
    resp = MagicMock()
    resp.content = [block]

    client = MagicMock()
    client.messages.create.return_value = resp
    return client


def test_query_model_returns_string():
    """정상 응답 시 문자열 반환"""
    import api.hf_client as mod
    mod._client = _mock_anthropic('{"greeting": "안녕하세요!"}')

    result = mod.query_model([{"role": "user", "content": "test"}])

    mod._client = None  # 테스트 후 초기화
    assert isinstance(result, str)
    assert "안녕하세요" in result


def test_query_model_strips_think_blocks():
    """<think>...</think> 블록 제거 확인"""
    import api.hf_client as mod
    mod._client = _mock_anthropic('<think>내부 추론입니다</think>\n{"answer": "yes"}')

    result = mod.query_model([{"role": "user", "content": "test"}])

    mod._client = None
    assert "<think>" not in result
    assert "answer" in result


def test_query_model_returns_error_on_exception():
    """API 예외 시 ERROR: 로 시작하는 문자열 반환"""
    import api.hf_client as mod
    client = MagicMock()
    client.messages.create.side_effect = Exception("timeout")
    mod._client = client

    result = mod.query_model([{"role": "user", "content": "test"}])

    mod._client = None
    assert result.startswith("ERROR:")


def test_query_model_separates_system_message():
    """system role 메시지가 Anthropic API의 system 파라미터로 전달되어야 함"""
    import api.hf_client as mod
    client = _mock_anthropic('{"ok": true}')
    mod._client = client

    mod.query_model([
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "안녕하세요"},
    ])

    mod._client = None
    call_kwargs = client.messages.create.call_args.kwargs
    assert call_kwargs.get("system") == "You are a helpful assistant."
    # messages 리스트에 system role이 없어야 함
    for msg in call_kwargs.get("messages", []):
        assert msg["role"] != "system"
