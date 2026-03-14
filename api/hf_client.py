# api/hf_client.py
import os
import re
import requests

HF_TOKEN = os.getenv("HF_TOKEN", "")
MODEL_ID  = "Qwen/Qwen3.5-27B"
_ROUTER_URL = "https://router.huggingface.co/v1/chat/completions"


def query_model(messages: list[dict], max_tokens: int = 2048) -> str:
    """LLM에 chat messages를 전송하고 텍스트 응답을 반환합니다."""
    try:
        payload = {
            "model": MODEL_ID,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0.3,
            "top_p": 0.95,
        }
        resp = requests.post(
            _ROUTER_URL,
            headers={
                "Authorization": f"Bearer {HF_TOKEN}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()

        # OpenAI-compatible chat completion format
        if isinstance(data, dict) and "choices" in data:
            raw = data["choices"][0]["message"]["content"] or ""
        # HF Inference text-generation format
        elif isinstance(data, list) and data:
            raw = data[0].get("generated_text", "")
        else:
            raw = str(data)

        raw = re.sub(r"<think>[\s\S]*?</think>", "", raw).strip()
        return raw
    except Exception as e:
        return f"ERROR: {str(e)}"


def query_model_with_thinking(messages: list[dict], max_tokens: int = 4096) -> tuple[str, str]:
    """thinking 모드로 LLM에 질의하고 (reasoning, content) 튜플을 반환합니다."""
    try:
        payload = {
            "model": MODEL_ID,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 1.0,
            "top_p": 0.95,
        }
        resp = requests.post(
            _ROUTER_URL,
            headers={
                "Authorization": f"Bearer {HF_TOKEN}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=180,
        )
        resp.raise_for_status()
        data = resp.json()

        if isinstance(data, dict) and "choices" in data:
            msg = data["choices"][0].get("message", {})
            thinking = msg.get("reasoning_content", "") or ""
            content  = msg.get("content", "") or ""
        elif isinstance(data, list) and data:
            content  = data[0].get("generated_text", "")
            thinking = ""
        else:
            thinking, content = "", str(data)

        return thinking, content
    except Exception as e:
        return "", f"ERROR: {str(e)}"
