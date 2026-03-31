import json
import re
from pathlib import Path

from utils.data_paths import resolve_data_path

DATE_RE = re.compile(r"^\d{4}-\d{2}(-\d{2})?$")


def _load_city_scores():
    with open(resolve_data_path("city_scores.json"), encoding="utf-8") as f:
        return json.load(f)


def _load_visa_db():
    with open(resolve_data_path("visa_db.json"), encoding="utf-8") as f:
        return json.load(f)


def _load_source_catalog():
    p = Path(__file__).parent.parent / "data" / "source_catalog.json"
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def test_source_catalog_has_sources():
    cat = _load_source_catalog()
    assert "sources" in cat
    assert len(cat["sources"]) >= 3


def test_city_scores_have_source_refs_and_verified_date():
    cities = _load_city_scores()["cities"]
    for c in cities:
        assert "source_refs" in c and isinstance(c["source_refs"], list) and len(c["source_refs"]) >= 1
        assert "data_verified_date" in c and DATE_RE.match(c["data_verified_date"])


def test_city_source_refs_exist_in_catalog():
    cities = _load_city_scores()["cities"]
    source_ids = {s["id"] for s in _load_source_catalog()["sources"]}
    for c in cities:
        missing = [rid for rid in c.get("source_refs", []) if rid not in source_ids]
        assert not missing, f"{c['id']} unknown source_refs: {missing}"


def test_visa_db_has_source_and_verified_date():
    countries = _load_visa_db()["countries"]
    for c in countries:
        assert str(c.get("source", "")).startswith("http"), f"{c['id']} source must be URL"
        assert DATE_RE.match(str(c.get("data_verified_date", ""))), f"{c['id']} missing/invalid data_verified_date"
