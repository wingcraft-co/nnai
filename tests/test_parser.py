from api.parser import parse_response, format_result_markdown

VALID_JSON_RAW = """{
  "top_cities": [
    {"city": "Chiang Mai", "country": "Thailand", "visa_type": "LTR",
     "monthly_cost": 1100, "score": 9, "why": "저렴하고 노마드 많음"}
  ],
  "visa_checklist": ["여권 18개월 이상 확인"],
  "budget_breakdown": {"rent": 500, "food": 300, "cowork": 100, "misc": 200},
  "first_steps": ["여권 확인"]
}"""

CODE_BLOCK_JSON = "```json\n" + VALID_JSON_RAW + "\n```"

def test_parse_pure_json():
    result = parse_response(VALID_JSON_RAW)
    assert result["top_cities"][0]["city"] == "Chiang Mai"
    assert result["budget_breakdown"]["rent"] == 500

def test_parse_code_block_json():
    result = parse_response(CODE_BLOCK_JSON)
    assert result["top_cities"][0]["city"] == "Chiang Mai"

def test_parse_failure_returns_fallback():
    result = parse_response("완전히 잘못된 텍스트입니다")
    assert "top_cities" in result
    assert result["top_cities"][0]["city"] == "파싱 오류"

def test_format_result_markdown_contains_sections():
    data = parse_response(VALID_JSON_RAW)
    md = format_result_markdown(data)
    assert "추천 거점 도시" in md
    assert "비자 체크리스트" in md
    assert "예산 브레이크다운" in md
    assert "Chiang Mai" in md

def test_format_result_markdown_budget_sum():
    data = parse_response(VALID_JSON_RAW)
    md = format_result_markdown(data)
    assert "1,100" in md
