# prompts/data_context.py
"""
visa_db.json + city_scores.json을 압축 텍스트로 변환하여 LLM 컨텍스트로 제공합니다.
앱 시작 시 모듈 로드 시 1회 빌드되며 이후 모든 요청에서 재사용됩니다.
RAG(임베딩 API) 호출 없이 전체 데이터를 LLM에 직접 전달합니다.
"""
import json
import os

from utils.data_paths import resolve_data_path


def _build() -> str:
    with open(resolve_data_path("visa_db.json"), encoding="utf-8") as f:
        visa_db = json.load(f)
    with open(resolve_data_path("city_scores.json"), encoding="utf-8") as f:
        city_scores = json.load(f)

    lines = ["=== 비자·도시 데이터베이스 (전체) ===", "[비자 정보 — 국가별]"]
    for c in visa_db.get("countries", []):
        schengen = "쉥겐O" if c.get("schengen") else "쉥겐X"
        treaty   = "조세조약O" if c.get("double_tax_treaty_with_kr") else "조세조약X"
        buffer   = " buffer_zone" if c.get("buffer_zone") else ""
        tax_days = c.get("tax_residency_days", "-")
        min_income = c['min_income_usd']
        income_str = f"${min_income:,}" if min_income is not None else "카테고리별 상이"
        lines.append(
            f"{c['name_kr']}({c['id']}) | {c['visa_type']} | 소득≥{income_str} | "
            f"{c['stay_months']}개월({'갱신O' if c['renewable'] else '갱신X'}) | "
            f"비용${c.get('visa_fee_usd', 0)} | {schengen} | 세금거주{tax_days}일 | {treaty}{buffer}"
        )

    lines += ["", "[도시 정보]"]
    for city in city_scores.get("cities", []):
        lines.append(
            f"{city.get('city_kr', city['city'])},{city['country']}({city['country_id']}) | "
            f"${city['monthly_cost_usd']:,}/월 | 인터넷{city['internet_mbps']}Mbps | "
            f"안전{city['safety_score']} 영어{city['english_score']} 노마드{city['nomad_score']} | "
            f"기후:{city['climate']} | 코워킹${city['cowork_usd_month']}/월"
        )

    return "\n".join(lines)


# 모듈 로드 시 1회 빌드 → 이후 모든 요청에서 재사용
DATA_CONTEXT: str = _build()
