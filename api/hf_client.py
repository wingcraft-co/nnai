import os
import re
from openai import OpenAI

HF_TOKEN = os.getenv("HF_TOKEN", "")
MODEL_ID  = "Qwen/Qwen3.5-27B"

client = OpenAI(
    base_url="https://router.huggingface.co/v1",
    api_key=HF_TOKEN,
)


def query_model(messages: list[dict], max_tokens: int = 2048) -> str:
    try:
        response = client.chat.completions.create(
            model=MODEL_ID,
            messages=messages,
            max_tokens=max_tokens,
            temperature=0.3,
            top_p=0.95,
            extra_body={
                "top_k": 20,
                "chat_template_kwargs": {"thinking": False},
            },
        )
        raw = response.choices[0].message.content or ""
        raw = re.sub(r"<think>[\s\S]*?</think>", "", raw).strip()
        return raw
    except Exception as e:
        return f"ERROR: {str(e)}"


def query_model_with_thinking(messages: list[dict], max_tokens: int = 4096) -> tuple[str, str]:
    try:
        response = client.chat.completions.create(
            model=MODEL_ID,
            messages=messages,
            max_tokens=max_tokens,
            temperature=1.0,
            top_p=0.95,
            extra_body={"top_k": 20},
        )
        msg = response.choices[0].message
        thinking = getattr(msg, "reasoning_content", "") or ""
        content  = msg.content or ""
        return thinking, content
    except Exception as e:
        return "", f"ERROR: {str(e)}"
