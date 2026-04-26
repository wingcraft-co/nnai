"""Detail guide cache key and quota helpers."""
from __future__ import annotations

import hashlib
import json
from typing import Any

FREE_DETAIL_GUIDE_LIMIT = 2


def _canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _selected_city(parsed_data: dict, city_index: int) -> dict:
    top_cities = parsed_data.get("top_cities")
    if not isinstance(top_cities, list) or not top_cities:
        return {}
    if city_index < 0 or city_index >= len(top_cities):
        city_index = 0
    selected = top_cities[city_index]
    return selected if isinstance(selected, dict) else {}


def build_detail_cache_key(parsed_data: dict, city_index: int) -> str:
    """Hash user onboarding profile + selected city so repeat detail calls reuse markdown."""
    payload = {
        "user_profile": parsed_data.get("_user_profile", {}),
        "selected_city": _selected_city(parsed_data, city_index),
    }
    return hashlib.sha256(_canonical_json(payload).encode("utf-8")).hexdigest()


def build_detail_quota(plan_tier: str, used_count: int) -> dict:
    if plan_tier == "pro":
        return {
            "is_unlimited": True,
            "limit": None,
            "used": used_count,
            "remaining": None,
        }

    remaining = max(0, FREE_DETAIL_GUIDE_LIMIT - used_count)
    return {
        "is_unlimited": False,
        "limit": FREE_DETAIL_GUIDE_LIMIT,
        "used": used_count,
        "remaining": remaining,
    }
