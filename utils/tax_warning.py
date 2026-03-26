"""utils/tax_warning.py — 세금 거주지 경고 자동 생성"""
from __future__ import annotations
import json
from pathlib import Path

from utils.data_paths import resolve_data_path

_visa_db_cache: dict | None = None


def _load_visa_db() -> dict:
    global _visa_db_cache
    if _visa_db_cache is None:
        with open(resolve_data_path("visa_db.json"), encoding="utf-8") as f:
            _visa_db_cache = {c["id"]: c for c in json.load(f)["countries"]}
    return _visa_db_cache


# 체류 기간 문자열 → 대략적 일수 매핑
_TIMELINE_DAYS = {
    "1년 단기 체험":       365,
    "3년 장기 체류":       365 * 3,
    "5년 이상 초장기 체류": 365 * 5,
    # English variants
    "1 year":             365,
    "3 years":            365 * 3,
    "5+ years":           365 * 5,
}


def get_tax_warning(country_id: str, timeline: str, language: str = "한국어") -> str:
    """
    국가별 세금 거주지 기준일과 사용자 체류 계획을 비교하여 경고 문자열 반환.
    해당 없으면 빈 문자열 반환.

    Args:
        country_id: ISO-2 국가 코드
        timeline: 체류 계획 문자열 (user_profile["timeline"])
        language: "한국어" or "English"

    Returns:
        경고 문자열 (없으면 "")
    """
    db = _load_visa_db()
    country = db.get(country_id)
    if not country:
        return ""

    tax_days = country.get("tax_residency_days", 183)
    planned_days = _TIMELINE_DAYS.get(timeline, 0)

    if planned_days == 0 or planned_days < tax_days:
        return ""

    country_name = country.get("name_kr" if language == "한국어" else "name", country_id)
    has_treaty = country.get("double_tax_treaty_with_kr", False)

    if language == "English":
        warning = (
            f"⚠️ **Tax Residency Alert**: Staying {planned_days // 365}+ year(s) in "
            f"{country.get('name', country_id)} may classify you as a tax resident "
            f"(threshold: {tax_days} days)."
        )
        if has_treaty:
            warning += " 🇰🇷 South Korea has a double taxation treaty with this country."
        else:
            warning += " ⚠️ No double taxation treaty with South Korea — consult a tax professional."
    else:
        warning = (
            f"⚠️ **세금 거주지 주의**: {country_name}에서 {planned_days // 365}년 이상 체류 시 "
            f"세금 거주자로 분류될 수 있습니다 (기준: {tax_days}일)."
        )
        if has_treaty:
            warning += " 🇰🇷 한국과 이중과세방지조약 체결국입니다."
        else:
            warning += " ⚠️ 한국과 이중과세방지조약 미체결 — 세무 전문가 상담을 권장합니다."

    return warning
