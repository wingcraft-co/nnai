"""
api/cache_manager.py — Gemini 서버사이드 Context Caching 관리자

SYSTEM_PROMPT + DATA_CONTEXT + FEW_SHOT_EXAMPLES를 Gemini 서버에 캐싱하여
매 Step 1 요청마다 동일한 대용량 정적 컨텍스트를 재전송하는 비용/지연을 절감.

캐싱 구조:
  system_instruction = SYSTEM_PROMPT + "\\n\\n" + DATA_CONTEXT  (~3,200 tokens)
  contents           = FEW_SHOT_EXAMPLES (user/model 교대)      (~4,300 tokens)
  합계 ≈ 7,500 tokens → gemini-2.5-flash 최소 요건(1,024 tokens) 충족

TTL: 1시간, 만료 5분 전 자동 갱신
언어별 별도 캐시: step1_ko / step1_en
"""

import os
import datetime
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_CACHE_TTL_SECONDS = 3600      # 1시간
_REFRESH_BEFORE_SECONDS = 300  # 만료 5분 전 갱신

# cache_key → {"obj": CachedContent, "expiry": datetime}
_cache_store: dict[str, dict] = {}


def _to_genai_contents(messages: list[dict]) -> list:
    """OpenAI 형식 messages → google-genai Content 객체 리스트.

    "system" 역할은 system_instruction으로 별도 처리되므로 스킵.
    "assistant" → "model" 로 변환 (Gemini 규격).
    """
    from google.genai import types

    result = []
    for msg in messages:
        if msg["role"] == "system":
            continue
        role = "model" if msg["role"] == "assistant" else "user"
        result.append(
            types.Content(role=role, parts=[types.Part(text=msg["content"])])
        )
    return result


def get_or_create_cache(
    system_prompt: str,
    data_context: str,
    few_shot_messages: list[dict],
    cache_key: str = "default",
) -> Optional[object]:
    """Gemini 서버에 컨텍스트 캐시 생성 또는 기존 캐시 반환.

    Args:
        system_prompt: 시스템 프롬프트 (SYSTEM_PROMPT 또는 SYSTEM_PROMPT_EN)
        data_context: 정적 데이터 컨텍스트 (DATA_CONTEXT)
        few_shot_messages: OpenAI 형식 few-shot 예시 메시지 목록
        cache_key: 캐시 구분 키 (예: "step1_ko", "step1_en")

    Returns:
        CachedContent 객체 또는 None (실패·API키 없음 시 — 자동 폴백)
    """
    now = datetime.datetime.now(datetime.timezone.utc)

    # 유효한 캐시가 있으면 재사용
    state = _cache_store.get(cache_key)
    if state and now < state["expiry"]:
        logger.info(f"[Cache] HIT  key={cache_key}  name={state['obj'].name}")
        return state["obj"]

    # 테스트 환경에서는 실 API 호출 스킵 (SKIP_RAG_INIT=1 과 동일한 역할)
    if os.getenv("SKIP_RAG_INIT") == "1":
        logger.debug("[Cache] SKIP_RAG_INIT=1 — 캐싱 스킵, 폴백 사용")
        return None

    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        logger.warning("[Cache] GEMINI_API_KEY 없음 — 캐싱 스킵, 폴백 사용")
        return None

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)

        combined_system = f"{system_prompt}\n\n{data_context}"
        contents = _to_genai_contents(few_shot_messages)

        cache = client.caches.create(
            model="gemini-2.5-flash",
            config=types.CreateCachedContentConfig(
                system_instruction=combined_system,
                contents=contents,
                ttl=f"{_CACHE_TTL_SECONDS}s",
            ),
        )

        expiry = now + datetime.timedelta(
            seconds=_CACHE_TTL_SECONDS - _REFRESH_BEFORE_SECONDS
        )
        _cache_store[cache_key] = {"obj": cache, "expiry": expiry}
        logger.info(
            f"[Cache] CREATED  key={cache_key}  name={cache.name}  expiry={expiry.isoformat()}"
        )
        return cache

    except Exception as exc:
        logger.warning(f"[Cache] 생성 실패 — 폴백 사용: {exc}")
        return None


def invalidate(cache_key: Optional[str] = None) -> None:
    """캐시 무효화 (특정 키 또는 전체).

    데이터 업데이트 후 강제 갱신이 필요할 때 호출.
    """
    if cache_key:
        _cache_store.pop(cache_key, None)
        logger.info(f"[Cache] 무효화: key={cache_key}")
    else:
        _cache_store.clear()
        logger.info("[Cache] 전체 무효화")
