# api/hf_client.py
import os
import re
import logging
from openai import OpenAI

logger = logging.getLogger(__name__)

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
        result = re.sub(r"<think>[\s\S]*?</think>", "", raw).strip()
        print(f"\n[API RESPONSE] length={len(result)}, first 300:\n{result[:300]!r}\n")
        return result
    except Exception as e:
        return f"ERROR: {str(e)}"


def query_model_cached(
    user_message: str,
    cache,
    max_tokens: int = 8192,
) -> str:
    """Gemini 서버 캐시를 활용한 Step 1 쿼리.

    캐시에 SYSTEM_PROMPT + DATA_CONTEXT + FEW_SHOTS가 포함되어 있으므로
    동적인 사용자 프로필 메시지만 새로 전송.

    Args:
        user_message: DATA_CONTEXT 제외한 사용자 프로필 + 지시 텍스트
        cache: cache_manager.get_or_create_cache() 가 반환한 CachedContent 객체
        max_tokens: 최대 출력 토큰 수

    Returns:
        LLM 응답 텍스트, 실패 시 "ERROR: ..." 문자열
    """
    try:
        from google import genai
        from google.genai import types

        api_key = os.getenv("GEMINI_API_KEY", "")
        client = genai.Client(api_key=api_key)

        response = client.models.generate_content(
            model=MODEL_ID,
            contents=user_message,
            config=types.GenerateContentConfig(
                cached_content=cache.name,
                temperature=0.3,
                max_output_tokens=max_tokens,
            ),
        )
        raw = response.text or ""
        result = re.sub(r"<think>[\s\S]*?</think>", "", raw).strip()
        logger.info(f"[Cached API] length={len(result)}, first 300: {result[:300]!r}")
        print(f"\n[Cached API] length={len(result)}, first 300:\n{result[:300]!r}\n")
        return result

    except Exception as exc:
        logger.warning(f"[Cached API] 실패 — 폴백 권장: {exc}")
        return f"ERROR: {str(exc)}"


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
