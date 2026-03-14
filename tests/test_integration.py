# tests/test_integration.py
import pytest
from unittest.mock import patch, MagicMock


def _anthropic_mock(text: str) -> MagicMock:
    """api.hf_client._get_client() 반환값 mock — messages.create()가 text를 반환"""
    block = MagicMock()
    block.text = text
    resp = MagicMock()
    resp.content = [block]
    client = MagicMock()
    client.messages.create.return_value = resp
    return client


def _anthropic_error_mock(exc: Exception) -> MagicMock:
    """messages.create()가 예외를 발생시키는 mock"""
    client = MagicMock()
    client.messages.create.side_effect = exc
    return client


# ── Step 1 파이프라인 통합 테스트 ─────────────────────────────────

MOCK_LLM_STEP1_RESPONSE = """{
  "top_cities": [
    {
      "city": "Kuala Lumpur",
      "city_kr": "쿠알라룸푸르",
      "country": "Malaysia",
      "country_id": "MY",
      "visa_type": "DE Nomad Visa",
      "visa_url": "https://www.digitalnomad.gov.my",
      "monthly_cost_usd": 1500,
      "score": 8,
      "reasons": [
        {"point": "영어와 한국어 모두 통용됩니다.", "source_url": null},
        {"point": "한인 커뮤니티가 활발합니다.", "source_url": null}
      ],
      "realistic_warnings": [
        "DE Nomad Visa 소득 기준을 반드시 확인하세요.",
        "공립학교 입학이 외국인에게 제한됩니다."
      ]
    },
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
        {"point": "생활비가 저렴합니다.", "source_url": null}
      ],
      "realistic_warnings": [
        "비자 연장 제한이 있습니다."
      ]
    },
    {
      "city": "Tbilisi",
      "city_kr": "트빌리시",
      "country": "Georgia",
      "country_id": "GE",
      "visa_type": "Remotely from Georgia",
      "visa_url": "https://stophere.georgia.com",
      "monthly_cost_usd": 800,
      "score": 7,
      "reasons": [
        {"point": "생활비가 매우 저렴합니다.", "source_url": null}
      ],
      "realistic_warnings": [
        "영어 소통이 제한적입니다."
      ]
    }
  ],
  "overall_warning": "이민은 전문가 상담 후 결정하세요."
}"""


MOCK_LLM_STEP2_RESPONSE = """{
  "city": "Kuala Lumpur",
  "country_id": "MY",
  "immigration_guide": {
    "title": "대한민국 국민의 쿠알라룸푸르 이민 가이드",
    "sections": [
      {
        "step": 1,
        "title": "출국 전 한국에서 준비할 것",
        "items": ["여권 유효기간 확인 (최소 18개월)", "소득 증빙 서류 준비"]
      },
      {
        "step": 2,
        "title": "현지 도착 후 30일 이내",
        "items": ["이민국 DE Nomad Visa 서류 제출", "국민건강보험 해외 신고"]
      }
    ]
  },
  "visa_checklist": ["여권 사본", "소득 증빙"],
  "budget_breakdown": {"rent": 700, "food": 400, "cowork": 150, "misc": 250},
  "first_steps": ["여권 유효기간 확인", "비자 서류 준비"]
}"""


def test_step1_full_pipeline():
    """
    Step 1 전체 파이프라인 통합 테스트.
    RAG 검색 → LLM 호출 → JSON 파싱 → 마크다운 포맷 → user_profile 주입 검증.
    """
    with patch("api.hf_client._get_client", return_value=_anthropic_mock(MOCK_LLM_STEP1_RESPONSE)), \
         patch("prompts.builder.retrieve_as_context", return_value="관련 비자 데이터"), \
         patch("rag.vector_store.build_index"), \
         patch("utils.currency.get_exchange_rates",
               return_value={"USD": 0.000714, "MYR": 0.00312, "THB": 0.0246}):

        import importlib
        import app as app_mod
        importlib.reload(app_mod)

        markdown, cities, parsed = app_mod.nomad_advisor(
            nationality="Korean",
            income_krw=500,
            immigration_purpose="💻 디지털 노마드 / 원격 근무",
            lifestyle=["저물가"],
            languages=["🇰🇷 한국어"],
            timeline="1년 단기 체험",
            preferred_countries=[],
        )

    assert isinstance(markdown, str)
    assert len(markdown) > 0
    assert "쿠알라룸푸르" in markdown or "Kuala Lumpur" in markdown
    assert "digitalnomad.gov.my" in markdown
    assert "현실적 고려 사항" in markdown

    assert isinstance(cities, list)
    assert len(cities) == 3
    assert cities[0]["country_id"] == "MY"

    assert "_user_profile" in parsed
    assert parsed["_user_profile"]["nationality"] == "Korean"
    assert parsed["_user_profile"]["income_krw"] == 500


def test_step1_api_error_returns_error_string():
    """
    Step 1에서 API 오류 발생 시 에러 문자열을 반환하고 크래시가 없어야 함.
    """
    with patch("api.hf_client._get_client", return_value=_anthropic_error_mock(Exception("Service Unavailable"))), \
         patch("prompts.builder.retrieve_as_context", return_value=""), \
         patch("rag.vector_store.build_index"), \
         patch("utils.currency.get_exchange_rates",
               return_value={"USD": 0.000714}):

        import importlib
        import app as app_mod
        importlib.reload(app_mod)

        result = app_mod.nomad_advisor(
            nationality="Korean",
            income_krw=300,
            immigration_purpose="💻 디지털 노마드 / 원격 근무",
            lifestyle=[],
            languages=["🇰🇷 한국어"],
            timeline="1년 단기 체험",
            preferred_countries=[],
        )

    markdown, cities, parsed = result
    assert "ERROR" in markdown or "⚠️" in markdown
    assert isinstance(cities, list)


def test_step1_income_krw_converted_to_usd():
    """
    KRW 입력값이 올바르게 USD로 환산되어 user_profile에 저장되는지 검증.
    500만원 → 약 $3,570 (환율 1USD=1400KRW 기준)
    """
    with patch("api.hf_client._get_client", return_value=_anthropic_mock(MOCK_LLM_STEP1_RESPONSE)), \
         patch("prompts.builder.retrieve_as_context", return_value=""), \
         patch("rag.vector_store.build_index"), \
         patch("utils.currency.get_exchange_rates",
               return_value={"USD": 0.000714}):

        import importlib
        import app as app_mod
        importlib.reload(app_mod)

        _, _, parsed = app_mod.nomad_advisor(
            nationality="Korean",
            income_krw=500,
            immigration_purpose="💻 디지털 노마드 / 원격 근무",
            lifestyle=[],
            languages=["🇰🇷 한국어"],
            timeline="1년 단기 체험",
            preferred_countries=[],
        )

    profile = parsed["_user_profile"]
    assert 3000 < profile["income_usd"] < 4500


# ── Step 2 파이프라인 통합 테스트 ─────────────────────────────────

def test_step2_full_pipeline(tmp_path, monkeypatch):
    """
    Step 2 전체 파이프라인 통합 테스트.
    parsed_data → 도시 선택 → LLM 호출 → 상세 가이드 마크다운 + PDF 생성 검증.
    """
    import os
    monkeypatch.chdir(tmp_path)

    mock_parsed = {
        "top_cities": [
            {
                "city": "Kuala Lumpur",
                "city_kr": "쿠알라룸푸르",
                "country": "Malaysia",
                "country_id": "MY",
                "visa_type": "DE Nomad Visa",
                "visa_url": "https://www.digitalnomad.gov.my",
                "monthly_cost_usd": 1500,
                "score": 8,
                "reasons": [],
                "realistic_warnings": [],
            }
        ],
        "_user_profile": {
            "nationality": "Korean",
            "income_usd": 3570,
            "income_krw": 500,
            "purpose": "디지털 노마드",
            "lifestyle": [],
            "languages": ["한국어"],
            "timeline": "1년 단기 체험",
        },
    }

    with patch("api.hf_client._get_client", return_value=_anthropic_mock(MOCK_LLM_STEP2_RESPONSE)):

        from app import show_city_detail

        markdown, pdf_path = show_city_detail(mock_parsed, city_index=0)

    assert isinstance(markdown, str)
    assert len(markdown) > 0
    assert "출국 전" in markdown or "Step 1" in markdown
    assert "비자 준비" in markdown or "visa" in markdown.lower() or "체크리스트" in markdown

    assert pdf_path is not None
    assert os.path.exists(pdf_path)
    assert pdf_path.endswith(".pdf")
    assert os.path.getsize(pdf_path) > 0

    if pdf_path and os.path.exists(pdf_path):
        os.remove(pdf_path)


def test_step2_invalid_city_index():
    """
    city_index가 범위를 초과할 경우 에러 없이 메시지 반환.
    """
    mock_parsed = {
        "top_cities": [{"city": "Kuala Lumpur", "country_id": "MY"}],
        "_user_profile": {},
    }

    from app import show_city_detail

    markdown, pdf_path = show_city_detail(mock_parsed, city_index=99)

    assert isinstance(markdown, str)
    assert "찾을 수 없습니다" in markdown
    assert pdf_path is None


def test_step2_empty_parsed_data():
    """
    parsed_data가 비어있는 경우 에러 없이 메시지 반환.
    """
    from app import show_city_detail

    markdown, pdf_path = show_city_detail({}, city_index=0)

    assert isinstance(markdown, str)
    assert pdf_path is None


def test_step2_user_profile_passed_to_prompt():
    """
    user_profile의 purpose와 nationality가 Step 2 프롬프트에 올바르게 전달되는지 검증.
    """
    mock_parsed = {
        "top_cities": [
            {
                "city": "Lisbon",
                "city_kr": "리스본",
                "country": "Portugal",
                "country_id": "PT",
                "monthly_cost_usd": 2600,
                "reasons": [],
                "realistic_warnings": [],
            }
        ],
        "_user_profile": {
            "nationality": "Korean",
            "income_usd": 6000,
            "income_krw": 840,
            "purpose": "자녀 교육 이민",
            "lifestyle": [],
            "languages": ["영어"],
            "timeline": "영구 이민",
        },
    }

    with patch("api.hf_client._get_client", return_value=_anthropic_mock(MOCK_LLM_STEP2_RESPONSE)), \
         patch("app.build_detail_prompt") as mock_build:

        mock_build.return_value = [
            {"role": "system", "content": "test"},
            {"role": "user", "content": "test"},
        ]

        from app import show_city_detail

        show_city_detail(mock_parsed, city_index=0)

    assert mock_build.called
    call_args = mock_build.call_args
    passed_profile = call_args[0][1]
    assert passed_profile["purpose"] == "자녀 교육 이민"
    assert passed_profile["nationality"] == "Korean"
