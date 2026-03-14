"""tests/test_city_scores.py — city_scores.json 구조 및 확장 필드 유효성 테스트"""
import json
from pathlib import Path
import pytest

DATA_PATH = Path(__file__).parent.parent / "data" / "city_scores.json"

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
