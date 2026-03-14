# api/hf_client.py
import os
import re
from openai import OpenAI

MODEL_ID = "gemini-2.5-flash"
_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(
            api_key=os.getenv("GEMINI_API_KEY", ""),
            base_url=_GEMINI_BASE_URL,
        )
    return _client


def query_model(messages: list[dict], max_tokens: int = 2048) -> str:
    """Gemini API에 chat messages를 전송하고 텍스트 응답을 반환합니다.

    max_tokens를 충분히 크게 설정하여 thinking 토큰 소비 후에도 JSON이 잘리지 않게 합니다.
    응답에 <think>...</think> 블록이 있으면 제거 후 반환합니다.
    """
    try:
        response = _get_client().chat.completions.create(
            model=MODEL_ID,
            messages=messages,
            max_tokens=max_tokens,
            temperature=0.3,
        )
        raw = response.choices[0].message.content or ""
        return re.sub(r"<think>[\s\S]*?</think>", "", raw).strip()
    except Exception as e:
        return f"ERROR: {str(e)}"


def query_model_with_thinking(messages: list[dict], max_tokens: int = 4096) -> tuple[str, str]:
    """thinking 없이 Gemini에 질의하고 ('', content) 튜플을 반환합니다."""
    try:
        response = _get_client().chat.completions.create(
            model=MODEL_ID,
            messages=messages,
            max_tokens=max_tokens,
            temperature=0.3,
        )
        content = response.choices[0].message.content or ""
        return "", content
    except Exception as e:
        return "", f"ERROR: {str(e)}"
