import os

SAMPLE_PARSED = {
    "top_cities": [
        {"city": "Chiang Mai", "country": "Thailand", "visa_type": "LTR",
         "monthly_cost": 1100, "score": 9, "why": "저렴하고 노마드 많음"}
    ],
    "visa_checklist": ["여권 18개월 확인", "소득 증빙 준비"],
    "budget_breakdown": {"rent": 500, "food": 300, "cowork": 100, "misc": 200},
    "first_steps": ["여권 갱신", "건강보험 가입"],
}
SAMPLE_PROFILE = {
    "nationality": "Korean",
    "income": 3000,
    "lifestyle": ["해변"],
    "timeline": "1년 단기 체험",
}

def test_generate_report_creates_pdf(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    from report.pdf_generator import generate_report
    path = generate_report(SAMPLE_PARSED, SAMPLE_PROFILE)
    assert path is not None
    assert os.path.exists(path)
    assert path.endswith(".pdf")

def test_generate_report_pdf_nonempty(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    from report.pdf_generator import generate_report
    path = generate_report(SAMPLE_PARSED, SAMPLE_PROFILE)
    assert os.path.getsize(path) > 1000
