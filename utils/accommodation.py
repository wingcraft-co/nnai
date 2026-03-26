"""utils/accommodation.py — 중기 숙소 딥링크 조회"""
from __future__ import annotations
import json
from pathlib import Path

from utils.data_paths import resolve_data_path

_city_scores_cache: dict | None = None


def _load_city_scores() -> dict:
    """city_scores.json을 city name(소문자) → dict로 인덱싱하여 반환."""
    global _city_scores_cache
    if _city_scores_cache is None:
        with open(resolve_data_path("city_scores.json"), encoding="utf-8") as f:
            data = json.load(f)
        _city_scores_cache = {
            c["city"].lower(): c for c in data["cities"]
        }
    return _city_scores_cache


def get_accommodation_links(city_name: str) -> dict:
    """
    도시명으로 city_scores.json에서 숙소 딥링크를 조회한다.

    Args:
        city_name: 도시명 (영문, 대소문자 무관)

    Returns:
        {
            "flatio_url": str or "",
            "anyplace_url": str or "",
            "nomad_meetup_url": str or "",
            "mid_term_rent_usd": int or 0,
        }
    """
    db = _load_city_scores()
    city = db.get(city_name.lower(), {})
    return {
        "flatio_url":        city.get("flatio_search_url", ""),
        "anyplace_url":      city.get("anyplace_search_url", ""),
        "nomad_meetup_url":  city.get("nomad_meetup_url", ""),
        "mid_term_rent_usd": city.get("mid_term_rent_usd", 0),
    }
