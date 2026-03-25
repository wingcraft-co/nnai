"""ui/layout_v2.py — Custom faceted filter tarot card UI (Phase 2 UI)."""
from __future__ import annotations

import json
import os

import gradio as gr

from recommender import recommend_from_db, compute_disabled_options
from api.parser import _inject_visa_urls

# ---------------------------------------------------------------------------
# Field mapping constants (JS chip labels → recommender.py internal keys)
# ---------------------------------------------------------------------------

KRW_TO_USD = 1 / 1350.0  # fixed rate for scoring; currency precision not required here

LIFESTYLE_TAG_MAP = {
    "저물가":     "저비용 생활",
    "코워킹":     "코워킹스페이스 중시",
    "안전":       "안전 중시",
    "한인커뮤니티": "한인 커뮤니티",
    "영어권":     "영어권 선호",
}

TIMELINE_MAP = {
    "90일":  "90일 단기 체험",
    "6개월": "6개월 단기 체험",
    "1년":   "1년 단기 체험",
    "3년+":  "3년 이상 장기 이민",
}

# "기타" expands to two internal continent keys
CONTINENT_MAP_EXPANSION = {
    "기타": ["중동/아프리카", "북미"],
}


def _map_profile(profile: dict) -> dict:
    """Translate JS profile fields to recommend_from_db() field names."""
    # Expand continents: "기타" → ["중동/아프리카", "북미"]
    raw_continents = profile.get("continents") or []
    expanded: list[str] = []
    for c in raw_continents:
        expanded.extend(CONTINENT_MAP_EXPANSION.get(c, [c]))

    # Map lifestyle chip labels
    raw_tags = profile.get("lifestyle_tags") or []
    mapped_lifestyle = [LIFESTYLE_TAG_MAP.get(t, t) for t in raw_tags]

    # Map timeline chip label
    raw_timeline = profile.get("timeline", "")
    mapped_timeline = TIMELINE_MAP.get(raw_timeline, raw_timeline)

    # nationality: "KR" → "한국" for recommend_from_db warning logic
    nationality = profile.get("nationality", "")
    if nationality == "KR":
        nationality = "한국"

    return {
        "income_usd":          (profile.get("monthly_income_krw") or 0) * KRW_TO_USD,
        "preferred_countries": expanded,
        "lifestyle":           mapped_lifestyle,
        "timeline":            mapped_timeline,
        "nationality":         nationality,
    }


def filter_cities(profile_json: str) -> str:
    """
    Gradio API endpoint: filter and rank cities from DB.

    Input:  JSON string with JS profile fields (see spec Section 1)
    Output: JSON string {"top_cities": [...], "disabled_options": {...}}
    """
    profile = json.loads(profile_json)
    db_profile = _map_profile(profile)
    result = recommend_from_db(db_profile, top_n=8)
    _inject_visa_urls(result)
    disabled = compute_disabled_options(db_profile)
    return json.dumps({
        "top_cities": result["top_cities"],
        "disabled_options": disabled,
    }, ensure_ascii=False)


def nomad_advisor_v2(payload_json: str) -> str:
    """
    Gradio API endpoint: run LLM detail guide for 3 selected cities.

    Input:  JSON string {"profile": {...JS fields...}, "selected_cities": ["치앙마이", ...]}
    Output: JSON string {"markdown": "...combined markdown for all 3 cities..."}
    """
    payload = json.loads(payload_json)
    profile = payload.get("profile", {})
    selected_names = payload.get("selected_cities", [])  # city_kr names

    db_profile = _map_profile(profile)
    # Re-add income_krw (만원 단위) for build_detail_prompt() which reads this key
    db_profile["income_krw"] = (profile.get("monthly_income_krw") or 0) // 10000

    # Fetch up to 8 cities from DB to find the selected ones by name
    result = recommend_from_db(db_profile, top_n=8)
    _inject_visa_urls(result)

    # Build lookup by city_kr (Korean name) and city (English name)
    all_cities = result["top_cities"]
    name_to_city = {}
    for c in all_cities:
        name_to_city[c.get("city_kr", "")] = c
        name_to_city[c.get("city", "")] = c

    # Preserve selection order; skip any city not found in DB results
    selected_city_dicts = [name_to_city[n] for n in selected_names if n in name_to_city]

    if not selected_city_dicts:
        return json.dumps({"markdown": "선택된 도시를 찾을 수 없습니다."}, ensure_ascii=False)

    parsed_data = {
        "top_cities":    selected_city_dicts,
        "_user_profile": db_profile,
    }

    # Import lazily to avoid circular import at module load time
    from app import show_city_detail

    markdowns = []
    for i in range(len(selected_city_dicts)):
        md = show_city_detail(parsed_data, city_index=i)
        markdowns.append(md)

    combined = "\n\n---\n\n".join(markdowns)
    return json.dumps({"markdown": combined}, ensure_ascii=False)


def build_ui_html() -> str:
    """Return the full custom HTML/CSS/JS for the faceted filter UI."""
    # Stub — replaced in Tasks 3–5
    return "<div style='padding:40px;font-family:sans-serif;'>UI 로딩 중...</div>"


def build_layout_v2(nomad_advisor_fn, show_city_detail_fn) -> gr.Blocks:
    """
    Build and return the Gradio Blocks demo with the custom UI.

    USE_NEW_UI=1 implies USE_DB_RECOMMENDER=1.
    Both filter_cities and nomad_advisor_v2 expose named API endpoints.

    nomad_advisor_fn and show_city_detail_fn are accepted for interface consistency
    with create_layout() in layout.py, but this layout uses module-level functions.
    """
    with gr.Blocks(css="body { margin:0; }") as demo:
        gr.HTML(build_ui_html())

        # Hidden components — sole purpose is Gradio API routing
        filter_input  = gr.Textbox(visible=False)
        filter_output = gr.Textbox(visible=False)
        step2_input   = gr.Textbox(visible=False)
        step2_output  = gr.Textbox(visible=False)

        filter_btn = gr.Button(visible=False)
        step2_btn  = gr.Button(visible=False)

        filter_btn.click(
            filter_cities,
            inputs=filter_input,
            outputs=filter_output,
            api_name="filter_cities",
        )
        step2_btn.click(
            nomad_advisor_v2,
            inputs=step2_input,
            outputs=step2_output,
            api_name="nomad_advisor",
        )

    return demo
