import json, pytest

def load_visa_db():
    with open("data/visa_db.json", "r", encoding="utf-8") as f:
        return json.load(f)

def load_city_scores():
    with open("data/city_scores.json", "r", encoding="utf-8") as f:
        return json.load(f)

REQUIRED_VISA_FIELDS = {
    "id", "name", "name_kr", "visa_type",
    "min_income_usd", "stay_months", "renewable",
    "key_docs", "visa_fee_usd", "tax_note", "cost_tier", "notes", "source"
}
REQUIRED_CITY_FIELDS = {
    "id", "city", "city_kr", "country", "country_id",
    "monthly_cost_usd", "internet_mbps", "safety_score",
    "english_score", "nomad_score", "climate", "cowork_usd_month"
}

def test_visa_db_has_12_countries():
    """Task-1B 이후 29개국 (기존 12 + 신규 17)"""
    db = load_visa_db()
    assert len(db["countries"]) == 29

def test_visa_db_schema():
    db = load_visa_db()
    for c in db["countries"]:
        missing = REQUIRED_VISA_FIELDS - set(c.keys())
        assert not missing, f"{c.get('id','?')} 누락 필드: {missing}"

def test_visa_db_income_non_negative():
    """min_income_usd는 0 이상 (무비자 국가는 0 허용)."""
    db = load_visa_db()
    for c in db["countries"]:
        assert c["min_income_usd"] >= 0

def test_visa_db_key_docs_nonempty():
    db = load_visa_db()
    for c in db["countries"]:
        assert len(c["key_docs"]) >= 2, f"{c['id']} key_docs 부족"

def test_city_scores_has_at_least_10():
    db = load_city_scores()
    assert len(db["cities"]) >= 10

def test_city_scores_schema():
    db = load_city_scores()
    for city in db["cities"]:
        missing = REQUIRED_CITY_FIELDS - set(city.keys())
        assert not missing, f"{city.get('id','?')} 누락 필드: {missing}"

def test_city_scores_range():
    db = load_city_scores()
    for city in db["cities"]:
        assert 1 <= city["safety_score"] <= 10
        assert 1 <= city["english_score"] <= 10
        assert 1 <= city["nomad_score"] <= 10
        assert city["monthly_cost_usd"] > 0

def test_city_country_id_exists_in_visa_db():
    visa = {c["id"] for c in load_visa_db()["countries"]}
    cities = load_city_scores()["cities"]
    for city in cities:
        assert city["country_id"] in visa, \
            f"{city['id']}의 country_id={city['country_id']} — visa_db에 없음"
