"""utils/planb.py — 쉥겐 소진 후 비쉥겐 버퍼 국가 추천"""
from __future__ import annotations
import json
from pathlib import Path

_VISA_DB_PATH = Path(__file__).parent.parent / "data" / "visa_db.json"
_visa_db_cache: list | None = None


def _load_buffer_countries() -> list[dict]:
    """visa_db.json에서 buffer_zone=True인 국가 목록 반환."""
    global _visa_db_cache
    if _visa_db_cache is None:
        with open(_VISA_DB_PATH, encoding="utf-8") as f:
            all_countries = json.load(f)["countries"]
        _visa_db_cache = [c for c in all_countries if c.get("buffer_zone")]
    return _visa_db_cache


# 버퍼 국가별 한국어 추천 이유 (간결한 1문장)
_BUFFER_REASONS_KR = {
    "GE": "무비자 365일 체류 가능, 물가 낮음, 트빌리시 노마드 커뮤니티 활발. ⚠️ 주의: 2026-03-01 조지아 노동이민법 시행 — 원격 근무자도 노동 활동 허가 필요 가능성. 위반 시 벌금 2,000 라리(약 $740). 출국 전 최신 규정 확인 필수.",
    "AL": "무비자 1년 체류, 발칸 최저 물가, 쉥겐 인접 지리적 위치",
    "RS": "베오그라드 유럽 최저권 물가, 비쉥겐 무비자 연장 가능",
    "MK": "스코페 물가 발칸 최저, 비쉥겐 인접 루트 활용 가능",
    "CY": "EU 회원국(비쉥겐), 영어 통용, 지중해 섬 생활",
    "TH": "치앙마이·방콕 노마드 허브, 무비자 30일+연장 용이",
    "VN": "동남아 저물가, 무비자 45일, 식음료 문화 최상",
    "PH": "영어 공용어, 무비자 30일+연장, 섬 라이프스타일",
    "MA": "유럽 접근성 최고(2시간), 쉥겐 인접 북아프리카 허브",
    "ID": "발리 코워킹 허브, 물가 저렴, 소셜 씬 활발",
}

_BUFFER_REASONS_EN = {
    "GE": "365-day visa-free stay, low cost of living, vibrant nomad scene in Tbilisi. ⚠️ Warning: Georgia Labour Immigration Law effective 2026-03-01 — remote workers may need a labour activity permit. Fines up to 2,000 GEL (~$740) for violations. Verify latest regulations before departure.",
    "AL": "1-year visa-free, lowest cost in the Balkans, geographically close to Schengen",
    "RS": "Belgrade among cheapest in Europe, extendable visa-free stays",
    "MK": "Skopje lowest costs in the Balkans, useful non-Schengen transit route",
    "CY": "EU member (non-Schengen), English widely spoken, Mediterranean island life",
    "TH": "Chiang Mai & Bangkok top nomad hubs, easy 30-day + extension visas",
    "VN": "Southeast Asian low costs, 45-day visa-free, excellent food culture",
    "PH": "English official language, 30-day visa-free + extension, island lifestyle",
    "MA": "Closest non-Schengen to Europe (2hr flight), growing North Africa hub",
    "ID": "Bali coworking hub, affordable, vibrant social scene",
}


def get_planb_suggestions(
    current_country_id: str,
    language: str = "한국어",
    max_suggestions: int = 3,
) -> list[dict]:
    """
    쉥겐 국가 체류 후 이동할 비쉥겐 버퍼 국가 추천 목록을 반환.
    현재 국가와 동일한 국가는 제외.

    Args:
        current_country_id: 현재 선택된 쉥겐 국가 ISO-2 코드
        language: "한국어" or "English"
        max_suggestions: 반환할 최대 추천 수

    Returns:
        list of dicts with keys: id, name, name_kr, reason, visa_type, min_income_usd, cost_tier
    """
    buffer_countries = _load_buffer_countries()
    reasons = _BUFFER_REASONS_KR if language == "한국어" else _BUFFER_REASONS_EN

    suggestions = []
    for country in buffer_countries:
        cid = country["id"]
        if cid == current_country_id:
            continue
        reason = reasons.get(cid, country.get("notes", ""))
        suggestions.append({
            "id":            cid,
            "name":          country.get("name", cid),
            "name_kr":       country.get("name_kr", cid),
            "reason":        reason,
            "visa_type":     country.get("visa_type", ""),
            "min_income_usd": country.get("min_income_usd", 0),
            "cost_tier":     country.get("cost_tier", ""),
        })

    # Priority: GE > AL > RS > others (order in visa_db)
    priority = ["GE", "AL", "RS", "TH", "VN", "CY", "MA"]
    suggestions.sort(key=lambda c: priority.index(c["id"]) if c["id"] in priority else 99)
    return suggestions[:max_suggestions]
