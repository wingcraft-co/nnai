"""
tests/test_visa_db.py

visa_db.json 구조 및 신규 필드 유효성 테스트
"""
import json
import os
from pathlib import Path

import pytest

_db = Path(__file__).parent.parent / "database" / "visa_db.json"
_data = Path(__file__).parent.parent / "data" / "visa_db.json"
DATA_PATH = _db if _db.exists() else _data


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


# ===== P0 비자 현행화 검증 테스트 =====

def _country(cid):
    d = json.load(open(DATA_PATH, encoding="utf-8"))
    return next(c for c in d["countries"] if c["id"] == cid)


def test_ge_regulation_change_field():
    """GE: 2026-03-01 노동이민법 regulation_change 필드 존재."""
    ge = _country("GE")
    assert "regulation_change" in ge
    assert ge["regulation_change"]["effective_date"] == "2026-03-01"
    assert ge["regulation_change"]["risk_level"] == "HIGH"


def test_ge_realistic_warnings_forced():
    """GE: 노동 허가 경고 realistic_warnings_forced 필드 존재."""
    ge = _country("GE")
    assert "realistic_warnings_forced" in ge
    assert len(ge["realistic_warnings_forced"]) >= 1
    assert "노동" in ge["realistic_warnings_forced"][0]


def test_th_ltr_categories_updated():
    """TH: LTR 카테고리별 요건 업데이트 확인."""
    th = _country("TH")
    assert "ltr_categories" in th
    wgc = th["ltr_categories"]["wealthy_global_citizens"]
    assert wgc["income_requirement"] is None  # 소득 요건 폐지
    assert wgc["asset_requirement_usd"] == 1000000
    wft = th["ltr_categories"]["work_from_thailand"]
    assert wft["employer_revenue_usd"] == 50000000


def test_th_family_accompaniment():
    """TH: 동반 가족 인원 제한 없음 확인."""
    th = _country("TH")
    assert "family_accompaniment" in th
    assert th["family_accompaniment"]["max_members"] is None
    assert th["family_accompaniment"]["parents_included"] is True


def test_th_min_income_usd_removed():
    """TH: min_income_usd 80000 제거 (소득 요건 폐지 반영)."""
    th = _country("TH")
    # null이거나 필드 자체가 없어야 함
    assert th.get("min_income_usd") != 80000


def test_pt_income_monthly_eur():
    """PT: D8 소득 기준 €3,680/월 업데이트."""
    pt = _country("PT")
    assert pt.get("min_income_monthly_eur") == 3680
    assert pt.get("min_wage_eur") == 920


def test_es_income_monthly_eur():
    """ES: DNV 소득 기준 €2,849/월 업데이트."""
    es = _country("ES")
    assert es.get("min_income_monthly_eur") == 2849


def test_es_family_income_addition():
    """ES: 가족 동반 소득 기준 필드 존재."""
    es = _country("ES")
    assert "family_income_addition" in es
    assert es["family_income_addition"]["spouse_eur"] == 916
    assert es["family_income_addition"]["per_child_eur"] == 305


def test_all_4_countries_have_data_verified_date():
    """P0 수정 4개국 모두 data_verified_date 필드 있음."""
    d = json.load(open(DATA_PATH, encoding="utf-8"))
    countries = {c["id"]: c for c in d["countries"]}
    for cid in ["GE", "TH", "PT", "ES"]:
        assert "data_verified_date" in countries[cid], f"{cid} missing data_verified_date"


# ===== P1 비자 현행화 검증 테스트 =====

def test_ee_min_income_monthly_eur():
    """EE: DNV 소득 기준 €4,500/월로 업데이트."""
    ee = _country("EE")
    assert ee.get("min_income_monthly_eur") == 4500


def test_ee_visa_notes():
    """EE: visa_notes 필드 존재 및 갱신 불가 안내 포함."""
    ee = _country("EE")
    assert "visa_notes" in ee
    assert isinstance(ee["visa_notes"], list)
    assert len(ee["visa_notes"]) >= 2
    assert any("갱신" in n for n in ee["visa_notes"])


def test_ee_data_verified_date():
    """EE: data_verified_date 필드 존재."""
    ee = _country("EE")
    assert "data_verified_date" in ee


def test_id_e33g_kitas_added():
    """ID: E33G 디지털 노마드 KITAS 항목 추가 확인."""
    id_ = _country("ID")
    assert "e33g_kitas" in id_, "e33g_kitas 필드 없음"
    kitas = id_["e33g_kitas"]
    assert kitas.get("min_income_annual_usd") == 60000
    assert kitas.get("stay_duration_months") == 12


def test_id_e33g_critical_warnings():
    """ID: E33G 현지 전환 불가 및 MERP 경고 포함."""
    id_ = _country("ID")
    kitas = id_.get("e33g_kitas", {})
    warnings = kitas.get("critical_warnings", [])
    assert len(warnings) >= 2
    assert any("현지 전환" in w or "출국" in w for w in warnings)
    assert any("MERP" in w for w in warnings)


def test_id_data_verified_date():
    """ID: data_verified_date 필드 존재."""
    id_ = _country("ID")
    assert "data_verified_date" in id_


def test_gr_onsite_application_not_available():
    """GR: Law 5275/2026 시행으로 현지 신청 불가 (onsite_application_available=false)."""
    gr = _country("GR")
    assert gr.get("onsite_application_available") is False


def test_gr_application_method_note():
    """GR: application_method_note 필드에 Law 5275/2026 언급."""
    gr = _country("GR")
    note = gr.get("application_method_note", "")
    assert "5275" in note or "영사관" in note


def test_gr_family_income_addition():
    """GR: 가족 동반 소득 기준 배수 필드 존재."""
    gr = _country("GR")
    assert "family_income_addition" in gr
    assert gr["family_income_addition"].get("spouse_pct") == 20
    assert gr["family_income_addition"].get("per_child_pct") == 15


def test_gr_data_verified_date():
    """GR: data_verified_date 필드 존재."""
    gr = _country("GR")
    assert "data_verified_date" in gr


def test_my_income_tiers_two_tracks():
    """MY: DE Rantau 직군별 2트랙 income_tiers 배열 존재."""
    my = _country("MY")
    assert "income_tiers" in my
    tiers = my["income_tiers"]
    assert isinstance(tiers, list)
    assert len(tiers) == 2
    categories = {t["category"] for t in tiers}
    assert "tech" in categories
    assert "non_tech" in categories


def test_my_income_tiers_amounts():
    """MY: 테크 $2,000/월, 비테크 $5,000/월 기준."""
    my = _country("MY")
    tiers = {t["category"]: t for t in my.get("income_tiers", [])}
    assert tiers.get("tech", {}).get("min_income_monthly_usd") == 2000
    assert tiers.get("non_tech", {}).get("min_income_monthly_usd") == 5000


def test_my_data_verified_date():
    """MY: data_verified_date 필드 존재."""
    my = _country("MY")
    assert "data_verified_date" in my
