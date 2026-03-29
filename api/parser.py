import json
import os
import re

import utils.currency
from utils.tax_warning import get_tax_warning
from utils.accommodation import get_accommodation_links
from utils.planb import get_planb_suggestions
from utils.data_paths import resolve_data_path
from api.schengen_calculator import SCHENGEN_COUNTRIES

# ── 도시 비교 테이블 ─────────────────────────────────────────────────────────

# UTC 오프셋 딕셔너리 (KST = +9 기준 시차 계산용)
_CITY_UTC_OFFSET: dict[str, int] = {
    # 동남아시아
    "Kuala Lumpur": 8, "Penang": 8,
    "Chiang Mai": 7, "Bangkok": 7, "Chiang Rai": 7, "Koh Samui": 7, "Phuket": 7,
    "Bali (Canggu)": 8, "Bali": 8,
    "Hanoi": 7, "Ho Chi Minh City": 7, "Da Nang": 7,
    "Manila": 8, "Cebu": 8,
    # 동아시아
    "Tokyo": 9, "Osaka": 9, "Fukuoka": 9,
    "Taipei": 8,
    # 남아시아 / 중앙아시아
    "Tbilisi": 4,
    # 유럽 서부 (UTC+0/+1)
    "Lisbon": 0, "Porto": 0,
    "Barcelona": 1, "Madrid": 1, "Valencia": 1,
    "Berlin": 1, "Munich": 1,
    "Amsterdam": 1,
    "Vienna": 1,
    "Warsaw": 1, "Krakow": 1,
    "Prague": 1,
    "Budapest": 1,
    "Milan": 1,
    "Dubrovnik": 1,
    "Belgrade": 1,
    "Skopje": 1,
    # 유럽 동부 (UTC+2)
    "Tallinn": 2,
    "Athens": 2, "Heraklion": 2,
    "Nicosia": 2,
    # 중동 (UTC+3/+4)
    "Istanbul": 3,
    "Dubai": 4,
    # 아프리카
    "Marrakech": 1,
    # 아메리카
    "Mexico City": -6, "Oaxaca": -6,
    "San Jose": -6, "Tamarindo": -6,
    "Medellin": -5, "Lima": -5,
    "Buenos Aires": -3,
    "Miami": -5,
}
_KST_OFFSET = 9


def _score_to_dots(score: int, max_score: int = 5) -> str:
    """5점 척도를 ●○ 문자로 변환"""
    score = max(1, min(5, score))
    return "●" * score + "○" * (5 - score)


def _internet_to_score(mbps: int) -> int:
    """인터넷 속도(Mbps) → 1~5점"""
    if mbps >= 100: return 5
    if mbps >= 50:  return 4
    if mbps >= 20:  return 3
    if mbps >= 10:  return 2
    return 1


def _cost_to_score(usd: int) -> int:
    """생활비(USD/월) → 1~5점 (저렴할수록 높음)"""
    if usd < 1000:  return 5
    if usd < 1500:  return 4
    if usd < 2000:  return 3
    if usd < 3000:  return 2
    return 1


def _safety_to_score(raw: int) -> int:
    """safety_score(0~10) → 1~5점"""
    return max(1, min(5, round(raw / 2)))


def _korean_to_score(size: str) -> int | None:
    """korean_community_size → 1~5점. 필드 없으면 None."""
    return {"large": 5, "medium": 3, "small": 1}.get(size)


def _get_timezone_diff(city: str) -> str:
    offset = _CITY_UTC_OFFSET.get(city)
    if offset is None:
        return "정보 없음"
    diff = offset - _KST_OFFSET
    if diff == 0:
        return "동일"
    return f"{diff:+d}h"


def _lookup_city_scores(city_name: str, scores_list: list) -> dict:
    """city 이름으로 city_scores 항목 조회. 정확일치 → 부분일치 순."""
    # 정확 일치
    for c in scores_list:
        if c.get("city", "").lower() == city_name.lower():
            return c
    # 부분 일치 (예: "Bali" → "Bali (Canggu)")
    for c in scores_list:
        if city_name.lower() in c.get("city", "").lower() or c.get("city", "").lower() in city_name.lower():
            return c
    return {}


def generate_comparison_table(top_cities: list, language: str = "한국어") -> str:
    """
    TOP 3 도시 데이터를 받아 HTML 테이블 형식의 비교표 반환.
    city_scores.json을 직접 로드하여 참조.
    """
    if not top_cities:
        return ""

    # city_scores.json 로드
    _scores_path = str(resolve_data_path("city_scores.json"))
    try:
        with open(_scores_path, encoding="utf-8") as f:
            scores_list = json.load(f).get("cities", [])
    except Exception:
        return ""

    cities = top_cities[:3]
    is_en = language == "English"
    city_names = [c.get("city", f"City{i+1}" if is_en else f"도시{i+1}") for i, c in enumerate(cities)]
    city_scores_rows = [_lookup_city_scores(name, scores_list) for name in city_names]

    # HTML 테이블 시작
    html_lines = [
        '<style>',
        '.comparison-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.08); }',
        '.comparison-table th { background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); color: white; padding: 14px 10px; text-align: center; font-weight: 600; border: none; }',
        '.comparison-table td { padding: 12px 10px; border: 1px solid #e0e0e0; text-align: center; }',
        '.comparison-table tbody tr:hover { background: rgba(30, 58, 138, 0.04); }',
        '.comparison-table tr:nth-child(even) td { background: #f8f9fa; }',
        '.comparison-table tr:nth-child(odd) td { background: #ffffff; }',
        '.comparison-table .label-col { text-align: left; font-weight: 600; background: #f3f4f6; color: #1f2937; border-right: 2px solid #1e3a8a; }',
        '@media (prefers-color-scheme: dark) {',
        '  .comparison-table { color: #e5e7eb; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }',
        '  .comparison-table th { background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); }',
        '  .comparison-table td { border-color: #374151; }',
        '  .comparison-table tbody tr:hover { background: rgba(30, 58, 138, 0.1); }',
        '  .comparison-table tr:nth-child(even) td { background: #1f2937; }',
        '  .comparison-table tr:nth-child(odd) td { background: #111827; }',
        '  .comparison-table .label-col { background: #0f172a; color: #e5e7eb; border-right-color: #3b82f6; }',
        '}',
        '</style>',
        '<table class="comparison-table">',
        '<thead>',
        '<tr>',
        f'<th style="text-align: left;">{"Category" if is_en else "항목"}</th>',
    ]

    # 헤더 (도시명)
    header_names = [
        c.get("city", name) if is_en else c.get("city_kr", name)
        for c, name in zip(cities, city_names)
    ]
    for name in header_names:
        html_lines.append(f'<th>{name}</th>')
    html_lines.append('</tr>')
    html_lines.append('</thead>')
    html_lines.append('<tbody>')

    # 인터넷 속도
    html_lines.append('<tr>')
    html_lines.append(f'<td class="label-col">{"Internet Speed" if is_en else "인터넷 속도"}</td>')
    for s in city_scores_rows:
        mbps = s.get("internet_mbps")
        val = _score_to_dots(_internet_to_score(mbps)) if mbps else ("N/A" if is_en else "정보 없음")
        html_lines.append(f'<td>{val}</td>')
    html_lines.append('</tr>')

    # 치안
    html_lines.append('<tr>')
    html_lines.append(f'<td class="label-col">{"Safety" if is_en else "치안 수준"}</td>')
    for s in city_scores_rows:
        sv = s.get("safety_score")
        val = _score_to_dots(_safety_to_score(sv)) if sv is not None else ("N/A" if is_en else "정보 없음")
        html_lines.append(f'<td>{val}</td>')
    html_lines.append('</tr>')

    # 생활비
    html_lines.append('<tr>')
    html_lines.append(f'<td class="label-col">{"Cost of Living" if is_en else "생활비"}</td>')
    for s, c in zip(city_scores_rows, cities):
        usd = s.get("monthly_cost_usd") or c.get("monthly_cost_usd", 0)
        val = _score_to_dots(_cost_to_score(usd)) if usd else ("N/A" if is_en else "정보 없음")
        html_lines.append(f'<td>{val}</td>')
    html_lines.append('</tr>')

    # 한국어 접근성
    html_lines.append('<tr>')
    html_lines.append(f'<td class="label-col">{"Korean Community" if is_en else "한국어 커뮤니티"}</td>')
    for s in city_scores_rows:
        ks = _korean_to_score(s.get("korean_community_size", ""))
        val = _score_to_dots(ks) if ks is not None else ("N/A" if is_en else "정보 없음")
        html_lines.append(f'<td>{val}</td>')
    html_lines.append('</tr>')

    # 시차
    html_lines.append('<tr>')
    html_lines.append(f'<td class="label-col">{"Time Difference (vs KST)" if is_en else "시차 (KST 기준)"}</td>')
    tz_vals = [_get_timezone_diff(name) for name in city_names]
    for tz in tz_vals:
        html_lines.append(f'<td>{tz}</td>')
    html_lines.append('</tr>')

    # 비자 유형
    html_lines.append('<tr>')
    html_lines.append(f'<td class="label-col">{"Visa Type" if is_en else "비자 유형"}</td>')
    for c in cities:
        vt = c.get("visa_type", "-")
        visa_short = vt[:20] + "..." if len(vt) > 20 else vt
        html_lines.append(f'<td>{visa_short}</td>')
    html_lines.append('</tr>')

    html_lines.append('</tbody>')
    html_lines.append('</table>')

    return "\n".join(html_lines)

# Module-level cache for visa URLs loaded from data/visa_urls.json
_VISA_URLS: dict | None = None


def _load_visa_urls() -> dict:
    """Load visa_urls.json once and cache it. Returns empty dict on failure."""
    global _VISA_URLS
    if _VISA_URLS is None:
        _visa_urls_path = resolve_data_path("visa_urls.json")
        try:
            with open(_visa_urls_path, encoding="utf-8") as f:
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
    # 3) 잘린 JSON 부분 복구 시도 — suffix를 붙여 강제 완성
    _stripped = raw_text.rstrip()
    for suffix in ("}]}", "}}", "}]}", "]}", "}"):
        try:
            parsed = json.loads(_stripped + suffix)
            cities = parsed.get("top_cities", [])
            if cities and cities[0].get("city"):
                print(f"\n[PARSE RECOVER] Partial JSON recovered with suffix {suffix!r}, cities={[c.get('city') for c in cities]}\n")
                return _inject_visa_urls(parsed)
        except (json.JSONDecodeError, KeyError):
            continue

    # 4) 파싱 실패 폴백
    print(f"\n[PARSE FAIL] raw length={len(raw_text)}, first 500 chars:\n{raw_text[:500]!r}\n")
    return {
        "top_cities": [{"city": "파싱 오류", "country": "-", "visa_type": "-",
                         "monthly_cost": 0, "score": 0, "why": raw_text[:200]}],
        "visa_checklist": ["응답 파싱 실패. 다시 시도해 주세요."],
        "budget_breakdown": {"rent": 0, "food": 0, "cowork": 0, "misc": 0},
        "first_steps": ["다시 시도해 주세요."],
        "_raw": raw_text,
    }


# 유니코드 이모티콘 범위 패턴 (보조 후처리용 — 프롬프트 지시가 1순위)
_EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001F9FF"
    "\U00002700-\U000027BF"
    "\U0000FE00-\U0000FE0F"
    "\U00002600-\U000026FF"
    "]+"
)


def _clean_inline_emoji(text: str) -> str:
    """문장 중간 이모티콘 제거. 줄 시작 이모티콘(섹션 헤더)은 유지."""
    lines = text.split("\n")
    cleaned = []
    for line in lines:
        stripped = line.lstrip()
        if stripped and _EMOJI_RE.match(stripped[0]):
            cleaned.append(line)
        else:
            cleaned.append(_EMOJI_RE.sub("", line))
    return "\n".join(cleaned)


def _clean_output(text: str) -> str:
    """LLM 출력 후처리 보조 함수.

    프롬프트 지시가 1순위. 이 함수는 LLM이 지시를 어긴 경우의 안전망.
    - 문장 중간 이모티콘 제거 (섹션 헤더 이모티콘 유지)
    - 느낌표(!) 제거
    """
    text = _clean_inline_emoji(text)
    text = text.replace("!", "")
    return text


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
        language = data.get("_user_profile", {}).get("language", "한국어") if isinstance(data, dict) else "한국어"
        return "Could not load recommendation results." if language == "English" else "추천 결과를 불러올 수 없습니다."

    language = data.get("_user_profile", {}).get("language", "한국어")
    is_en = language == "English"

    lines = [
        "## 🌍 Personalized Long-Stay Plan — Top 3 Recommended Cities\n"
        if is_en else
        "## 🌍 맞춤 장기 체류 설계 — 추천 도시 TOP 3\n"
    ]

    # 카드 스타일 CSS
    lines.append("""<style>
.city-card {
  border: 1px solid;
  border-radius: 12px;
  padding: 24px;
  margin: 16px 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  color: #333;
}

@media (prefers-color-scheme: light) {
  .city-card {
    border-color: #d0d0d0;
    background: linear-gradient(135deg, #f5f6f7 0%, #ffffff 100%);
    color: #1a1a2e;
  }
  .city-card-header { color: #1a1a2e; }
  .city-card-score { color: #ff6b6b; }
  .city-card a { color: #0066cc; }
  .city-card strong { color: #1a1a2e; }
}

@media (prefers-color-scheme: dark) {
  .city-card {
    border-color: #3b82f6;
    background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
    color: #e5e7eb;
  }
  .city-card-header { color: #f0f9ff; }
  .city-card-score { color: #fbbf24; }
  .city-card a { color: #60a5fa; }
  .city-card strong { color: #e5e7eb; }
  .city-card p { color: #e5e7eb; }
}

.city-card-header { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
.city-card-score { font-size: 18px; margin-bottom: 16px; }
</style>
""")

    for i, city in enumerate(data.get("top_cities", [])[:3], 1):
        city_en = city.get("city", "")
        city_kr = city.get("city_kr", city_en)
        country = city.get("country", "")
        visa_type = city.get("visa_type", "-")
        visa_url = city.get("visa_url")
        cost_usd = city.get("monthly_cost_usd", city.get("monthly_cost", 0))
        score    = city.get("score", "-")

        cost_krw = _usd_to_krw(cost_usd)

        # 카드 시작
        lines.append('<div class="city-card">')
        header_city = f"{city_en}, {country}" if is_en else f"{city_kr} ({city_en}), {country}"
        lines.append(f'<div class="city-card-header">#{i}. {header_city}</div>')
        lines.append(
            f'<div class="city-card-score">⭐ Recommendation Score: {score}/10</div>'
            if is_en else
            f'<div class="city-card-score">⭐ 추천 점수: {score}/10</div>'
        )

        # 비자 유형 (HTML 링크 사용)
        if visa_url:
            if "google.com/search" in visa_url:
                lines.append(
                    f'**Visa Type**: {visa_type} — <a href="{visa_url}">Official link pending verification</a>'
                    if is_en else
                    f'**비자 유형**: {visa_type} — <a href="{visa_url}">공식 링크 확인 중</a>'
                )
            else:
                lines.append(
                    f'**Visa Type**: <a href="{visa_url}">{visa_type}</a>'
                    if is_en else
                    f'**비자 유형**: <a href="{visa_url}">{visa_type}</a>'
                )
        else:
            lines.append(
                f'**Visa Type**: {visa_type}'
                if is_en else
                f'**비자 유형**: {visa_type}'
            )

        # 월 예상 비용
        lines.append(
            f'**Estimated Monthly Cost**: ${cost_usd:,} (about ₩{cost_krw:,})'
            if is_en else
            f'**월 예상 비용**: ${cost_usd:,} (약 {cost_krw:,}원)'
        )

        # 추천 근거
        reasons = city.get("reasons", [])
        if reasons:
            lines.append("**✅ Why This City**" if is_en else "**✅ 추천 근거**")
            for reason in reasons:
                point = reason.get("point", "")
                lines.append(f"- {point}")

        # 현실적 고려 사항
        warnings = city.get("realistic_warnings", [])
        if warnings:
            lines.append("**⚠️ Practical Considerations**" if is_en else "**⚠️ 현실적 고려 사항**")
            for w in warnings:
                lines.append(f"- {w}")

        # 세금 거주지 경고
        country_id = city.get("country_id", "")
        timeline = data.get("_user_profile", {}).get("timeline", "")
        language = data.get("_user_profile", {}).get("language", "한국어")
        tax_warn = get_tax_warning(country_id, timeline, language)
        if tax_warn:
            if language == "English":
                lines.append(f"**💼 Tax Note**\n\n{tax_warn}")
            else:
                lines.append(f"**💼 세금 주의사항**\n\n{tax_warn}")

        # 참고 자료
        references = city.get("references")
        if references:
            valid_refs = [r for r in references if r.get("url")]
            if valid_refs:
                lines.append("**📚 References**" if is_en else "**📚 참고 자료**")
                for ref in valid_refs:
                    lines.append(f"- <a href=\"{ref['url']}\">{ref.get('title', ref['url'])}</a>")

        # 카드 종료
        lines.append('</div>')

    # 도시 비교 테이블 삽입 (TOP 3 카드 하단)
    top_cities = data.get("top_cities", [])
    if len(top_cities) >= 2:
        language = data.get("_user_profile", {}).get("language", "한국어")
        table_header = "### 📊 도시 비교" if language != "English" else "### 📊 City Comparison"
        lines.append("\n" + table_header)
        lines.append(generate_comparison_table(top_cities, language=language))

    # 전체 경고
    overall = data.get("overall_warning", "")
    if overall:
        lines.append("---")
        lines.append(
            f"> ⚠️ **Important Note**: {overall}"
            if is_en else
            f"> ⚠️ **주의사항**: {overall}"
        )

    return _clean_output("\n".join(lines))


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


def format_step2_markdown(data: dict, visa_data: dict | None = None) -> str:
    """Step 2 결과(상세 정착 가이드)를 마크다운으로 포맷팅합니다."""
    if not data:
        language = data.get("_user_profile", {}).get("language", "한국어") if isinstance(data, dict) else "한국어"
        return "Could not load the detailed guide." if language == "English" else "상세 가이드를 불러올 수 없습니다."

    lines = []
    language = data.get("_user_profile", {}).get("language", "한국어")
    is_en = language == "English"

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
        lines.append("## 📄 Visa Checklist\n" if is_en else "## 📄 비자 준비 체크리스트\n")
        for item in checklist:
            lines.append(f"- [ ] {item}")
        lines.append("")

    # 예산 테이블 (USD + KRW)
    bd = data.get("budget_breakdown", {})
    if bd:
        lines.append("## 💰 Estimated Monthly Budget\n" if is_en else "## 💰 한 달 예상 지출 내역\n")
        lines.append("| Category | Amount (USD) |" if is_en else "| 항목 | 금액 (USD) |")
        lines.append("|------|-----------|")
        label_map = (
            [("rent", "Rent"), ("food", "Food"), ("cowork", "Coworking"), ("insurance", "Insurance"), ("misc", "Misc")]
            if is_en else
            [("rent", "주거"), ("food", "식비"), ("cowork", "코워킹"), ("insurance", "해외보험"), ("misc", "기타")]
        )
        total_usd = 0
        for k, label in label_map:
            val = bd.get(k, 0)
            total_usd += val
            lines.append(f"| {label} | ${val:,} |")
        lines.append(f"| **Total** | **${total_usd:,}** |" if is_en else f"| **합계** | **${total_usd:,}** |")
        budget_source = data.get("budget_source", "")
        if budget_source:
            # Extract city name from URL for display label
            # e.g. https://www.numbeo.com/cost-of-living/in/Chiang-Mai → Chiang-Mai
            city_slug = budget_source.rstrip("/").rsplit("/", 1)[-1]
            city_display = city_slug.replace("-", " ")
            lines.append(
                f"\n> Source: [Numbeo — {city_display} Cost of Living]({budget_source})"
                if is_en else
                f"\n> 출처: [Numbeo — {city_display} 생활비]({budget_source})"
            )
        lines.append("")

    # 첫 번째 실행 스텝 (type defense: str / list[str] / list[dict] 모두 처리)
    first_steps = _normalize_string_list(data.get("first_steps", []))
    if first_steps:
        lines.append("### First Action Steps\n" if is_en else "### 첫 번째 실행 스텝\n")
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
            if is_en:
                rent_note = f" (avg ${links['mid_term_rent_usd']:,}/month)" if links["mid_term_rent_usd"] else ""
                accom_parts.append(f"- 🏠 [Flatio — Mid-term Rentals{rent_note}]({links['flatio_url']})")
            else:
                accom_parts.append(f"- 🏠 [Flatio — 중기 임대{rent_note}]({links['flatio_url']})")
        if links["anyplace_url"]:
            accom_parts.append(
                f"- 🏡 [Anyplace — Furnished Stays]({links['anyplace_url']})"
                if is_en else
                f"- 🏡 [Anyplace — 가구 완비 원룸]({links['anyplace_url']})"
            )
        if links["nomad_meetup_url"]:
            accom_parts.append(
                f"- 🤝 [Nomad Meetup Groups]({links['nomad_meetup_url']})"
                if is_en else
                f"- 🤝 [노마드 밋업 그룹]({links['nomad_meetup_url']})"
            )
        if accom_parts:
            lines.append("\n---\n\n### 🏠 Mid-Term Housing & Community\n" if is_en else "\n---\n\n### 🏠 중기 숙소 & 커뮤니티\n")
            lines.extend(accom_parts)
            lines.append("")

    # 플랜B 섹션 (쉥겐 국가 선택 시만)
    country_id = data.get("country_id", "")
    if country_id in SCHENGEN_COUNTRIES:
        suggestions = get_planb_suggestions(country_id, language=language, max_suggestions=3)
        if suggestions:
            if language == "English":
                header = "\n---\n\n### 🔄 Plan B: After Your 90-Day Schengen Limit\n\n"
                header += "_When your 90 Schengen days are used up, these non-Schengen countries make ideal next stops:_\n\n"
            else:
                header = "\n---\n\n### 🔄 플랜B: 쉥겐 90일 소진 후 대안\n\n"
                header += "_쉥겐 체류일을 모두 소진한 후, 아래 비쉥겐 국가로 이동하여 체류를 이어갈 수 있습니다:_\n\n"

            planb_items = []
            for s in suggestions:
                name_display = s["name"] if language == "English" else s["name_kr"]
                income_note = f" (소득 기준 없음)" if s["min_income_usd"] == 0 else f" (월 ${s['min_income_usd']:,}+ 필요)"
                if language == "English":
                    income_note = " (no income requirement)" if s["min_income_usd"] == 0 else f" (${s['min_income_usd']:,}+/month required)"
                planb_items.append(
                    f"**{name_display}** ({s['visa_type']}){income_note}\n> {s['reason']}"
                )
            lines.append(header + "\n\n".join(planb_items) + "\n")

    # 출처 및 기준일 블록 (visa_data 전달 시)
    if visa_data is not None:
        verified_date = visa_data.get("data_verified_date", "N/A" if is_en else "정보 없음") or ("N/A" if is_en else "정보 없음")
        source = visa_data.get("source", "")
        lines.append("\n---")
        lines.append(f"**Data Verified Date**: {verified_date}" if is_en else f"**데이터 기준일**: {verified_date}")
        if source:
            lines.append(f"**Source**: {source}" if is_en else f"**출처**: {source}")
        lines.append(
            "\n※ Visa rules can change at any time. Verify with the official authority before final application."
            if is_en else
            "\n※ 비자 규정은 수시로 변경될 수 있습니다. 최종 신청 전 해당국 공식 기관에서 재확인을 권장합니다."
        )

    return _clean_output("\n".join(lines))
