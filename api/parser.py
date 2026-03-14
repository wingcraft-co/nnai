import json
import os
import re

import utils.currency
from utils.tax_warning import get_tax_warning
from utils.accommodation import get_accommodation_links

# Module-level cache for visa URLs loaded from data/visa_urls.json
_VISA_URLS: dict | None = None


def _load_visa_urls() -> dict:
    """Load visa_urls.json once and cache it. Returns empty dict on failure."""
    global _VISA_URLS
    if _VISA_URLS is None:
        _data_path = os.path.join(os.path.dirname(__file__), "..", "data", "visa_urls.json")
        try:
            with open(_data_path, encoding="utf-8") as f:
                _VISA_URLS = json.load(f)
        except (OSError, json.JSONDecodeError):
            _VISA_URLS = {}
    return _VISA_URLS


def _inject_visa_urls(parsed: dict) -> dict:
    """Overwrite visa_url for each city in top_cities with the official hardcoded URL.

    If country_id is not in visa_urls.json, the LLM-generated value is kept as-is.
    """
    visa_urls = _load_visa_urls()
    for city in parsed.get("top_cities", []):
        country_id = city.get("country_id")
        if country_id and country_id in visa_urls:
            city["visa_url"] = visa_urls[country_id]
    return parsed


def parse_response(raw_text: str) -> dict:
    # 1) 코드 블록 안 JSON 먼저 시도
    for match in re.findall(r"```(?:json)?\s*([\s\S]*?)```", raw_text):
        try:
            return _inject_visa_urls(json.loads(match.strip()))
        except json.JSONDecodeError:
            continue
    # 2) 중괄호 덩어리 탐색 (긴 것 우선)
    for match in sorted(re.findall(r"\{[\s\S]*\}", raw_text), key=len, reverse=True):
        try:
            return _inject_visa_urls(json.loads(match))
        except json.JSONDecodeError:
            continue
    # 3) 파싱 실패 폴백
    return {
        "top_cities": [{"city": "파싱 오류", "country": "-", "visa_type": "-",
                         "monthly_cost": 0, "score": 0, "why": raw_text[:200]}],
        "visa_checklist": ["응답 파싱 실패. 다시 시도해 주세요."],
        "budget_breakdown": {"rent": 0, "food": 0, "cowork": 0, "misc": 0},
        "first_steps": ["다시 시도해 주세요."],
        "_raw": raw_text,
    }


def format_result_markdown(data: dict) -> str:
    lines = ["## 🌍 추천 거점 도시 TOP 3\n"]
    for i, city in enumerate(data.get("top_cities", [])[:3], 1):
        lines += [
            f"### {i}. {city.get('city','')}, {city.get('country','')}",
            f"- **비자 유형**: {city.get('visa_type','-')}",
            f"- **월 예상 비용**: ${city.get('monthly_cost',0):,}",
            f"- **추천 이유**: {city.get('why','-')}\n",
        ]
    lines.append("## 📋 비자 체크리스트\n")
    for item in data.get("visa_checklist", []):
        lines.append(f"- {item}")
    lines += ["\n## 💰 월 예산 브레이크다운\n",
              "| 항목 | 금액 |", "|------|------|"]
    bd = data.get("budget_breakdown", {})
    for k, label in [("rent","주거"), ("food","식비"), ("cowork","코워킹"), ("misc","기타")]:
        lines.append(f"| {label} | ${bd.get(k,0):,} |")
    lines.append(f"| **합계** | **${sum(bd.values()):,}** |")
    lines.append("\n## 🚀 첫 번째 실행 스텝\n")
    for j, step in enumerate(data.get("first_steps", []), 1):
        lines.append(f"{j}. {step}")
    return "\n".join(lines)


def _usd_to_krw(usd_amount: float) -> int:
    """USD 금액을 KRW로 환산합니다. 환율 조회 실패 시 1 USD = 1,400 KRW 사용."""
    try:
        rates = utils.currency.get_exchange_rates()
        usd_rate = rates.get("USD", 0.000714)  # 1 KRW = X USD
        krw = round(usd_amount / usd_rate)
    except Exception:
        krw = round(usd_amount * 1400)
    return krw


def format_step1_markdown(data: dict) -> str:
    """Step 1 결과(TOP 3 도시 추천)를 마크다운으로 포맷팅합니다."""
    if not data:
        return "추천 결과를 불러올 수 없습니다."

    lines = ["## 🌍 맞춤 장기 체류 설계 — 추천 도시 TOP 3\n"]

    for i, city in enumerate(data.get("top_cities", [])[:3], 1):
        city_en = city.get("city", "")
        city_kr = city.get("city_kr", city_en)
        country = city.get("country", "")
        visa_type = city.get("visa_type", "-")
        visa_url = city.get("visa_url")
        cost_usd = city.get("monthly_cost_usd", city.get("monthly_cost", 0))
        score    = city.get("score", "-")

        cost_krw = _usd_to_krw(cost_usd)

        # 도시 헤더
        lines.append(f"### {i}. {city_kr} ({city_en}), {country}")
        lines.append(f"⭐ 추천 점수: **{score}/10**\n")

        # 비자 유형 (하이퍼링크)
        if visa_url:
            lines.append(f"- **비자 유형**: [{visa_type}]({visa_url})")
        else:
            lines.append(f"- **비자 유형**: {visa_type}")

        # 월 예상 비용 (이중 통화)
        lines.append(f"- **월 예상 비용**: ${cost_usd:,} (약 {cost_krw:,}원)\n")

        # 추천 근거 (항상 평문 — 출처는 하단 참고 자료 섹션에서 처리)
        lines.append("**✅ 추천 근거**")
        for reason in city.get("reasons", []):
            point = reason.get("point", "")
            lines.append(f"- {point}")
        lines.append("")

        # 현실적 고려 사항
        warnings = city.get("realistic_warnings", [])
        if warnings:
            lines.append("**⚠️ 현실적 고려 사항**")
            for w in warnings:
                lines.append(f"- {w}")
            lines.append("")

        # 세금 거주지 경고
        country_id = city.get("country_id", "")
        timeline = data.get("_user_profile", {}).get("timeline", "")
        language = data.get("_user_profile", {}).get("language", "한국어")
        tax_warn = get_tax_warning(country_id, timeline, language)
        if tax_warn:
            if language == "English":
                lines.append(f"\n**💼 Tax Note**\n\n{tax_warn}\n")
            else:
                lines.append(f"\n**💼 세금 주의사항**\n\n{tax_warn}\n")

        # 참고 자료
        references = city.get("references")
        if references:
            valid_refs = [r for r in references if r.get("url")]
            if valid_refs:
                lines.append("### 참고 자료")
                for ref in valid_refs:
                    lines.append(f"- [{ref.get('title', ref['url'])}]({ref['url']})")
                lines.append("")

    # 전체 경고
    overall = data.get("overall_warning", "")
    if overall:
        lines.append("---")
        lines.append(f"> ⚠️ **주의사항**: {overall}")

    return "\n".join(lines)


def _normalize_string_list(value) -> list:
    """LLM 출력의 타입 불일치를 방어합니다.

    Handles:
    - list[str]  → 그대로 반환
    - list[dict] → 각 dict에서 "item"/"text"/"content" 키 또는 str() 변환
    - str        → 줄바꿈 또는 쉼표로 분리
    - 기타       → 빈 리스트
    """
    if isinstance(value, str):
        # 줄바꿈으로 우선 분리, 없으면 쉼표로 분리
        if "\n" in value:
            return [s.strip() for s in value.split("\n") if s.strip()]
        return [s.strip() for s in value.split(",") if s.strip()]
    elif isinstance(value, list):
        items = []
        for item in value:
            if isinstance(item, str):
                items.append(item)
            elif isinstance(item, dict):
                text = (
                    item.get("item")
                    or item.get("text")
                    or item.get("content")
                    or item.get("step")
                    or str(item)
                )
                items.append(text)
            else:
                items.append(str(item))
        return items
    return []


def format_step2_markdown(data: dict) -> str:
    """Step 2 결과(상세 정착 가이드)를 마크다운으로 포맷팅합니다."""
    if not data:
        return "상세 가이드를 불러올 수 없습니다."

    lines = []

    city = data.get("city", "")
    guide = data.get("immigration_guide", {})

    title = guide.get("title", f"{city} 정착 가이드")
    lines.append(f"## 📋 {title}\n")

    # 단계별 섹션
    for section in guide.get("sections", []):
        step_num = section.get("step", "")
        step_title = section.get("title", "")
        lines.append(f"### Step {step_num}. {step_title}")
        for item in section.get("items", []):
            lines.append(f"- {item}")
        lines.append("")

    # 비자 체크리스트 (type defense: str / list[str] / list[dict] 모두 처리)
    checklist = _normalize_string_list(data.get("visa_checklist", []))
    if checklist:
        lines.append("## 📄 비자 준비 체크리스트\n")
        for item in checklist:
            lines.append(f"- [ ] {item}")
        lines.append("")

    # 예산 테이블 (USD + KRW)
    bd = data.get("budget_breakdown", {})
    if bd:
        lines.append("## 💰 한 달 예상 지출 내역\n")
        lines.append("| 항목 | 금액 (USD) |")
        lines.append("|------|-----------|")
        label_map = [("rent", "주거"), ("food", "식비"), ("cowork", "코워킹"), ("misc", "기타")]
        total_usd = 0
        for k, label in label_map:
            val = bd.get(k, 0)
            total_usd += val
            lines.append(f"| {label} | ${val:,} |")
        lines.append(f"| **합계** | **${total_usd:,}** |")
        budget_source = data.get("budget_source", "")
        if budget_source:
            # Extract city name from URL for display label
            # e.g. https://www.numbeo.com/cost-of-living/in/Chiang-Mai → Chiang-Mai
            city_slug = budget_source.rstrip("/").rsplit("/", 1)[-1]
            city_display = city_slug.replace("-", " ")
            lines.append(f"\n> 출처: [Numbeo — {city_display} 생활비]({budget_source})")
        lines.append("")

    # 첫 번째 실행 스텝 (type defense: str / list[str] / list[dict] 모두 처리)
    first_steps = _normalize_string_list(data.get("first_steps", []))
    if first_steps:
        lines.append("### 첫 번째 실행 스텝\n")
        for j, step in enumerate(first_steps, 1):
            lines.append(f"{j}. {step}")
        lines.append("")

    # 숙소 딥링크 섹션
    city_name = data.get("city", "")
    if city_name:
        links = get_accommodation_links(city_name)
        accom_parts = []
        if links["flatio_url"]:
            rent_note = f" (평균 ${links['mid_term_rent_usd']:,}/월)" if links["mid_term_rent_usd"] else ""
            accom_parts.append(f"- 🏠 [Flatio — 중기 임대{rent_note}]({links['flatio_url']})")
        if links["anyplace_url"]:
            accom_parts.append(f"- 🏡 [Anyplace — 가구 완비 원룸]({links['anyplace_url']})")
        if links["nomad_meetup_url"]:
            accom_parts.append(f"- 🤝 [노마드 밋업 그룹]({links['nomad_meetup_url']})")
        if accom_parts:
            lines.append("\n---\n\n### 🏠 중기 숙소 & 커뮤니티\n")
            lines.extend(accom_parts)
            lines.append("")

    return "\n".join(lines)
