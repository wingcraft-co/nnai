import json
import re

import utils.currency


def parse_response(raw_text: str) -> dict:
    # 1) 코드 블록 안 JSON 먼저 시도
    for match in re.findall(r"```(?:json)?\s*([\s\S]*?)```", raw_text):
        try:
            return json.loads(match.strip())
        except json.JSONDecodeError:
            continue
    # 2) 중괄호 덩어리 탐색 (긴 것 우선)
    for match in sorted(re.findall(r"\{[\s\S]*\}", raw_text), key=len, reverse=True):
        try:
            return json.loads(match)
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

    lines = ["## 🌍 맞춤 이민 설계 — 추천 도시 TOP 3\n"]

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

        # 추천 근거
        lines.append("**✅ 추천 근거**")
        for reason in city.get("reasons", []):
            point = reason.get("point", "")
            source = reason.get("source_url")
            if source:
                lines.append(f"- {point} ([출처]({source}))")
            else:
                lines.append(f"- {point}")
        lines.append("")

        # 현실적 고려 사항
        warnings = city.get("realistic_warnings", [])
        if warnings:
            lines.append("**⚠️ 현실적 고려 사항**")
            for w in warnings:
                lines.append(f"- {w}")
            lines.append("")

    # 전체 경고
    overall = data.get("overall_warning", "")
    if overall:
        lines.append("---")
        lines.append(f"> ⚠️ **주의사항**: {overall}")

    return "\n".join(lines)


def format_step2_markdown(data: dict) -> str:
    """Step 2 결과(상세 이민 가이드)를 마크다운으로 포맷팅합니다."""
    if not data:
        return "상세 가이드를 불러올 수 없습니다."

    lines = []

    city = data.get("city", "")
    guide = data.get("immigration_guide", {})

    title = guide.get("title", f"{city} 이민 가이드")
    lines.append(f"## 📋 {title}\n")

    # 단계별 섹션
    for section in guide.get("sections", []):
        step_num = section.get("step", "")
        step_title = section.get("title", "")
        lines.append(f"### Step {step_num}. {step_title}")
        for item in section.get("items", []):
            lines.append(f"- {item}")
        lines.append("")

    # 비자 체크리스트
    checklist = data.get("visa_checklist", [])
    if checklist:
        lines.append("## 📄 비자 준비 체크리스트\n")
        for item in checklist:
            lines.append(f"- [ ] {item}")
        lines.append("")

    # 예산 테이블 (USD + KRW)
    bd = data.get("budget_breakdown", {})
    if bd:
        lines.append("## 💰 월 예산 브레이크다운\n")
        lines.append("| 항목 | USD | KRW (원화) |")
        lines.append("|------|-----|-----------|")
        label_map = [("rent", "주거"), ("food", "식비"), ("cowork", "코워킹"), ("misc", "기타")]
        total_usd = 0
        for k, label in label_map:
            val = bd.get(k, 0)
            total_usd += val
            krw_val = _usd_to_krw(val)
            lines.append(f"| {label} | ${val:,} | {krw_val:,}원 |")
        total_krw = _usd_to_krw(total_usd)
        lines.append(f"| **합계** | **${total_usd:,}** | **{total_krw:,}원** |")
        lines.append("")

    # 첫 번째 실행 스텝
    first_steps = data.get("first_steps", [])
    if first_steps:
        lines.append("## 🚀 첫 번째 실행 스텝\n")
        for j, step in enumerate(first_steps, 1):
            lines.append(f"{j}. {step}")
        lines.append("")

    return "\n".join(lines)
