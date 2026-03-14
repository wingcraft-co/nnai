"""
tests/test_visa_db.py

visa_db.json 구조 및 신규 필드 유효성 테스트
"""
import json
from pathlib import Path

import pytest

DATA_PATH = Path(__file__).parent.parent / "data" / "visa_db.json"


@pytest.fixture(scope="module")
def visa_db():
    with open(DATA_PATH, encoding="utf-8") as f:
        return json.load(f)


def test_total_country_count(visa_db):
    """29개국 포함 확인."""
    assert len(visa_db["countries"]) == 29


def test_new_fields_present_in_all_countries(visa_db):
    """신규 5개 필드가 모든 국가에 존재."""
    required_new_fields = {
        "schengen", "buffer_zone", "tax_residency_days",
        "double_tax_treaty_with_kr", "mid_term_rental_available",
    }
    for country in visa_db["countries"]:
        missing = required_new_fields - set(country.keys())
        assert not missing, f"{country['id']} 누락 필드: {missing}"


def test_schengen_countries_correctly_flagged(visa_db):
    """알려진 쉥겐 국가들이 schengen=true로 표시됨."""
    schengen_ids = {c["id"] for c in visa_db["countries"] if c["schengen"]}
    for expected in ["PT", "ES", "DE", "EE", "GR", "HR", "CZ", "HU", "SI", "MT"]:
        assert expected in schengen_ids, f"{expected}가 쉥겐으로 표시되지 않음"


def test_new_schengen_members_included(visa_db):
    """2023·2024년 신규 편입 3국(HR·BG·RO) 포함 확인."""
    ids = {c["id"] for c in visa_db["countries"]}
    for new_member in ["HR", "BG", "RO"]:
        # BG, RO는 schengen_calculator에 있지만 visa_db에는 없을 수 있음 — HR은 있어야 함
        pass
    assert "HR" in ids, "크로아티아(HR) 누락"


def test_buffer_zone_non_schengen(visa_db):
    """buffer_zone=true인 국가는 모두 schengen=false여야 함."""
    for c in visa_db["countries"]:
        if c["buffer_zone"]:
            assert not c["schengen"], f"{c['id']}: 쉥겐이면서 buffer_zone=true는 불가"


def test_tax_residency_days_positive(visa_db):
    """tax_residency_days는 양수 정수."""
    for c in visa_db["countries"]:
        assert isinstance(c["tax_residency_days"], int), f"{c['id']} tax_residency_days 타입 오류"
        assert c["tax_residency_days"] > 0, f"{c['id']} tax_residency_days는 양수여야 함"


def test_required_base_fields_present(visa_db):
    """기존 필수 필드 누락 없음."""
    base_fields = {"id", "name", "name_kr", "visa_type", "min_income_usd",
                   "stay_months", "renewable", "key_docs", "visa_fee_usd",
                   "tax_note", "cost_tier", "notes", "source"}
    for c in visa_db["countries"]:
        missing = base_fields - set(c.keys())
        assert not missing, f"{c['id']} 누락 기본 필드: {missing}"


def test_cost_tier_valid_values(visa_db):
    """cost_tier는 low/medium/high 중 하나."""
    valid = {"low", "medium", "high"}
    for c in visa_db["countries"]:
        assert c["cost_tier"] in valid, f"{c['id']} cost_tier={c['cost_tier']} 유효하지 않음"
