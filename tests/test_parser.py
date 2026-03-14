from api.parser import parse_response, format_result_markdown, format_step1_markdown, format_step2_markdown

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


SAMPLE_STEP1_DATA = {
    "top_cities": [
        {
            "city": "Chiang Mai",
            "city_kr": "치앙마이",
            "country": "Thailand",
            "country_id": "TH",
            "visa_type": "Tourist Visa (Extension)",
            "visa_url": "https://www.thaiembassy.com/thailand-visa/tourist-visa",
            "monthly_cost_usd": 1100,
            "score": 9,
            "reasons": [
                {"point": "디지털 노마드 커뮤니티 상위 도시입니다.", "source_url": None},
                {"point": "코워킹 월 $80 수준입니다.", "source_url": "https://example.com"},
            ],
            "realistic_warnings": [
                "관광비자 연속 갱신 제한이 있습니다.",
                "원격 근무의 법적 지위가 불명확합니다.",
            ],
        }
    ],
    "overall_warning": "이민은 전문가 상담 후 결정하세요.",
}

SAMPLE_STEP2_DATA = {
    "city": "Chiang Mai",
    "country_id": "TH",
    "immigration_guide": {
        "title": "대한민국 국민의 치앙마이 이민 가이드",
        "sections": [
            {
                "step": 1,
                "title": "출국 전 한국에서 준비할 것",
                "items": ["여권 유효기간 확인", "건강보험 가입"],
            },
            {
                "step": 2,
                "title": "현지 도착 후 30일 이내",
                "items": ["비자 연장 신청", "은행 계좌 개설"],
            },
        ],
    },
    "visa_checklist": ["여권 사본", "소득 증빙"],
    "budget_breakdown": {"rent": 500, "food": 300, "cowork": 80, "misc": 220},
    "first_steps": ["여권 유효기간 확인", "비자 종류 결정"],
}


def test_format_step1_contains_city_name():
    result = format_step1_markdown(SAMPLE_STEP1_DATA)
    assert "치앙마이" in result or "Chiang Mai" in result


def test_format_step1_contains_visa_link():
    """비자 유형에 하이퍼링크가 포함되어야 함"""
    result = format_step1_markdown(SAMPLE_STEP1_DATA)
    assert "[Tourist Visa (Extension)](" in result
    assert "thaiembassy.com" in result


def test_format_step1_contains_dual_currency():
    """월 비용이 USD와 원화 양쪽 모두 포함되어야 함"""
    from unittest.mock import patch
    with patch(
        "utils.currency.get_exchange_rates",
        return_value={"MYR": 4.18, "THB": 24.6},
    ):
        result = format_step1_markdown(SAMPLE_STEP1_DATA)
    assert "$1,100" in result
    assert "원" in result


def test_format_step1_contains_reasons_as_bullets():
    """추천 근거가 불릿 형식으로 출력되어야 함"""
    result = format_step1_markdown(SAMPLE_STEP1_DATA)
    assert "- 디지털 노마드 커뮤니티" in result
    assert "- 코워킹 월 $80" in result


def test_format_step1_contains_source_url():
    """source_url이 있는 항목은 ([출처](url)) 형식을 포함해야 함"""
    result = format_step1_markdown(SAMPLE_STEP1_DATA)
    assert "[출처]" in result


def test_format_step1_contains_warnings():
    """현실적 고려 사항 섹션이 포함되어야 함"""
    result = format_step1_markdown(SAMPLE_STEP1_DATA)
    assert "현실적 고려 사항" in result
    assert "관광비자 연속 갱신" in result


def test_format_step1_contains_overall_warning():
    """전체 경고 문구가 포함되어야 함"""
    result = format_step1_markdown(SAMPLE_STEP1_DATA)
    assert "이민은 전문가 상담 후 결정하세요" in result


def test_format_step1_empty_data_no_crash():
    """빈 데이터에서도 크래시 없이 문자열 반환"""
    result = format_step1_markdown({})
    assert isinstance(result, str)


def test_format_step2_contains_section_steps():
    """Step 1·2 섹션이 모두 출력되어야 함"""
    result = format_step2_markdown(SAMPLE_STEP2_DATA)
    assert "Step 1." in result
    assert "Step 2." in result


def test_format_step2_contains_checklist():
    """비자 체크리스트 항목이 포함되어야 함"""
    result = format_step2_markdown(SAMPLE_STEP2_DATA)
    assert "여권 사본" in result
    assert "- [ ]" in result


def test_format_step2_budget_table_contains_total():
    """예산 합계 행이 올바르게 포함되어야 함"""
    result = format_step2_markdown(SAMPLE_STEP2_DATA)
    assert "합계" in result
    assert "$1,100" in result


def test_format_step2_budget_contains_krw():
    """예산 테이블에 KRW 환산 컬럼이 있어야 함"""
    result = format_step2_markdown(SAMPLE_STEP2_DATA)
    assert "KRW" in result
    assert "원" in result


def test_format_step2_first_steps_numbered():
    """첫 번째 실행 스텝이 번호 목록으로 출력되어야 함"""
    result = format_step2_markdown(SAMPLE_STEP2_DATA)
    assert "1. 여권 유효기간 확인" in result
    assert "2. 비자 종류 결정" in result


def test_format_step2_empty_data_no_crash():
    """빈 데이터에서도 크래시 없이 문자열 반환"""
    result = format_step2_markdown({})
    assert isinstance(result, str)


def test_format_step1_no_source_url_generates_search_links():
    """source_url=None 이면 Google/YouTube 자동 링크가 포함되어야 함"""
    data = {
        "top_cities": [{
            "city": "Chiang Mai",
            "city_kr": "치앙마이",
            "country": "Thailand",
            "country_id": "TH",
            "visa_type": "Tourist Visa",
            "monthly_cost_usd": 1100,
            "score": 9,
            "reasons": [
                {"point": "노마드 커뮤니티가 활발합니다.", "source_url": None},
            ],
            "realistic_warnings": [],
        }],
    }
    result = format_step1_markdown(data)
    assert "google.com/search" in result
    assert "youtube.com/results" in result


def test_format_step1_with_source_url_no_auto_links():
    """source_url이 있으면 자동 링크 없이 출처 링크만 있어야 함"""
    data = {
        "top_cities": [{
            "city": "Chiang Mai",
            "city_kr": "치앙마이",
            "country": "Thailand",
            "country_id": "TH",
            "visa_type": "Tourist Visa",
            "monthly_cost_usd": 1100,
            "score": 9,
            "reasons": [
                {"point": "노마드 커뮤니티가 활발합니다.", "source_url": "https://nomads.com"},
            ],
            "realistic_warnings": [],
        }],
    }
    result = format_step1_markdown(data)
    assert "[출처]" in result
    assert "google.com/search" not in result
