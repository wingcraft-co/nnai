"""tests/test_city_scores.py — city_scores.json 구조 및 확장 필드 유효성 테스트"""
import json
from pathlib import Path
import pytest
from utils.data_paths import resolve_data_path

_db = Path(__file__).parent.parent / "database" / "city_scores.json"
DATA_PATH = _db if _db.exists() else resolve_data_path("city_scores.json")

@pytest.fixture(scope="module")
def city_db():
    with open(DATA_PATH, encoding="utf-8") as f:
        return json.load(f)

def test_total_city_count(city_db):
    assert len(city_db["cities"]) == 50

def test_new_fields_present_in_all_cities(city_db):
    required = {"coworking_score","community_size","mid_term_rent_usd",
                "tax_residency_days","flatio_search_url","anyplace_search_url",
                "nomad_meetup_url","korean_community_size"}
    for c in city_db["cities"]:
        missing = required - set(c.keys())
        assert not missing, f"{c['id']} 누락: {missing}"

def test_community_size_valid_values(city_db):
    valid = {"small","medium","large"}
    for c in city_db["cities"]:
        assert c["community_size"] in valid
        assert c["korean_community_size"] in valid

def test_coworking_score_range(city_db):
    for c in city_db["cities"]:
        assert 1 <= c["coworking_score"] <= 10, f"{c['id']} coworking_score 범위 오류"

def test_mid_term_rent_positive(city_db):
    for c in city_db["cities"]:
        assert c["mid_term_rent_usd"] > 0, f"{c['id']} mid_term_rent_usd 양수여야 함"

def test_flatio_url_format(city_db):
    for c in city_db["cities"]:
        url = c["flatio_search_url"]
        assert url.startswith("https://www.flatio.com/"), f"{c['id']} flatio URL 형식 오류"

def test_base_fields_present(city_db):
    base = {"id","city","city_kr","country","country_id","monthly_cost_usd",
            "internet_mbps","safety_score","english_score","nomad_score","climate","cowork_usd_month"}
    for c in city_db["cities"]:
        missing = base - set(c.keys())
        assert not missing, f"{c['id']} 기본 필드 누락: {missing}"

def test_known_cities_present(city_db):
    ids = {c["id"] for c in city_db["cities"]}
    for expected in ["CNX","BKK","LIS","BCN","TBS","OSA","TYO","MDE","DXB","DAD"]:
        assert expected in ids, f"{expected} 누락"


# ── entry_tips 필드 테스트 ────────────────────────────────────────────────────

ENTRY_TIPS_CITIES = ["KL", "CNX", "BKK", "DPS", "CEU", "DAD"]

@pytest.fixture(scope="module")
def entry_tips_cities(city_db):
    return {c["id"]: c for c in city_db["cities"] if c["id"] in ENTRY_TIPS_CITIES}


def test_entry_tips_present_in_target_cities(entry_tips_cities):
    """쿠알라룸푸르·치앙마이·방콕·발리·세부·다낭에 entry_tips 필드가 있어야 함."""
    for city_id in ENTRY_TIPS_CITIES:
        assert city_id in entry_tips_cities, f"{city_id} 도시 없음"
        assert "entry_tips" in entry_tips_cities[city_id], f"{city_id} entry_tips 누락"


def test_entry_tips_round_trip_required_field(entry_tips_cities):
    """entry_tips에 round_trip_required(bool) 필드가 있어야 함."""
    for city_id in ENTRY_TIPS_CITIES:
        tips = entry_tips_cities[city_id].get("entry_tips", {})
        assert "round_trip_required" in tips, f"{city_id} round_trip_required 누락"
        assert isinstance(tips["round_trip_required"], bool)


def test_entry_tips_visa_run_options_field(entry_tips_cities):
    """entry_tips에 visa_run_options(list) 필드가 있어야 함."""
    for city_id in ENTRY_TIPS_CITIES:
        tips = entry_tips_cities[city_id].get("entry_tips", {})
        assert "visa_run_options" in tips, f"{city_id} visa_run_options 누락"
        assert isinstance(tips["visa_run_options"], list)


def test_entry_tips_work_disclosure_risk_field(entry_tips_cities):
    """entry_tips에 work_disclosure_risk(str) 필드가 있어야 함."""
    for city_id in ENTRY_TIPS_CITIES:
        tips = entry_tips_cities[city_id].get("entry_tips", {})
        assert "work_disclosure_risk" in tips, f"{city_id} work_disclosure_risk 누락"
        assert isinstance(tips["work_disclosure_risk"], str)
        assert len(tips["work_disclosure_risk"]) > 0


def test_round_trip_required_true_for_risk_countries(entry_tips_cities):
    """MY·TH·ID·PH 국가는 round_trip_required=True여야 함."""
    round_trip_required_ids = ["KL", "CNX", "BKK", "DPS", "CEU"]
    for city_id in round_trip_required_ids:
        tips = entry_tips_cities[city_id].get("entry_tips", {})
        assert tips.get("round_trip_required") is True, f"{city_id} round_trip_required=True여야 함"


def test_danang_round_trip_not_required(entry_tips_cities):
    """다낭(VN)은 무비자 90일로 비자런 불필요 — round_trip_required=False여야 함."""
    tips = entry_tips_cities["DAD"].get("entry_tips", {})
    assert tips.get("round_trip_required") is False, "DAD round_trip_required=False여야 함"
