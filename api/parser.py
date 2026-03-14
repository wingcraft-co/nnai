import json
import re


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
