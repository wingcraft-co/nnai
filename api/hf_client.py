# api/hf_client.py
import os
import re
import anthropic

MODEL_ID = "claude-sonnet-4-6"

_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
    return _client


def query_model(messages: list[dict], max_tokens: int = 2048) -> str:
    """Claude API에 chat messages를 전송하고 텍스트 응답을 반환합니다."""
    try:
        system = ""
        conv_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system = msg["content"]
            else:
                conv_messages.append({"role": msg["role"], "content": msg["content"]})

        kwargs: dict = {
            "model": MODEL_ID,
            "max_tokens": max_tokens,
            "messages": conv_messages,
        }
        if system:
            kwargs["system"] = system

        response = _get_client().messages.create(**kwargs)
        raw = response.content[0].text
        return re.sub(r"<think>[\s\S]*?</think>", "", raw).strip()
    except Exception as e:
        return f"ERROR: {str(e)}"


def query_model_with_thinking(messages: list[dict], max_tokens: int = 4096) -> tuple[str, str]:
    """extended thinking 모드로 Claude에 질의하고 (reasoning, content) 튜플을 반환합니다."""
    try:
        system = ""
        conv_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system = msg["content"]
            else:
                conv_messages.append({"role": msg["role"], "content": msg["content"]})

        kwargs: dict = {
            "model": MODEL_ID,
            "max_tokens": max_tokens,
            "thinking": {"type": "enabled", "budget_tokens": 2048},
            "messages": conv_messages,
        }
        if system:
            kwargs["system"] = system

        response = _get_client().messages.create(**kwargs)

        thinking = ""
        content = ""
        for block in response.content:
            if block.type == "thinking":
                thinking = block.thinking
            elif block.type == "text":
                content = block.text

        return thinking, content
    except Exception as e:
        return "", f"ERROR: {str(e)}"
