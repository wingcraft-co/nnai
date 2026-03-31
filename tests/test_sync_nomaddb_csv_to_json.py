import copy
import importlib.util
from pathlib import Path


def _load_module():
    path = Path(__file__).parent.parent / "scripts" / "sync_nomaddb_csv_to_json.py"
    spec = importlib.util.spec_from_file_location("sync_nomaddb_csv_to_json", path)
    mod = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(mod)
    return mod


def test_merge_updates_existing_country_from_csv_rows():
    mod = _load_module()

    base = {
        "countries": [
            {
                "id": "TH",
                "name": "Thailand",
                "name_kr": "태국",
                "visa_type": "LTR Visa",
                "min_income_usd": None,
                "stay_months": 60,
                "renewable": True,
                "key_docs": ["A", "B"],
                "visa_fee_usd": 500,
                "tax_note": "x",
                "cost_tier": "low",
                "notes": "old",
                "source": "https://example.com/th",
                "schengen": False,
                "buffer_zone": True,
                "tax_residency_days": 180,
                "double_tax_treaty_with_kr": True,
                "mid_term_rental_available": True,
            }
        ]
    }

    countries_csv = [
        {
            "country_code": "THA",
            "country_name_en": "Thailand",
            "country_name_ko": "태국",
            "monthly_cost_usd_mid": "1500",
            "nomad_visa_available": "Y",
            "notes": "new meta notes",
            "last_verified": "2026-03-31",
        }
    ]
    visa_csv = [
        {
            "country_code": "THA",
            "nomad_visa_name": "Destination Thailand Visa (DTV)",
            "nomad_visa_income_req_usd": "0",
            "nomad_visa_fee_usd": "280",
            "nomad_visa_duration_months": "12",
            "nomad_visa_renewable": "Y",
            "source_notes": "src",
            "tourist_visa_notes": "tour",
            "last_verified": "2026-03-31",
        }
    ]

    merged, stats = mod.merge_nomaddb_into_visa_db(
        base_json=copy.deepcopy(base),
        countries_csv_rows=countries_csv,
        visa_csv_rows=visa_csv,
        visa_urls={"TH": "https://official.example/th"},
        add_missing_countries=False,
    )

    th = merged["countries"][0]
    assert stats["updated"] == 1
    assert th["visa_type"] == "Destination Thailand Visa (DTV)"
    assert th["min_income_usd"] == 0
    assert th["visa_fee_usd"] == 280
    assert th["stay_months"] == 12
    assert th["renewable"] is True
    assert th["notes"] == "new meta notes"
    assert th["data_verified_date"] == "2026-03-31"


def test_merge_skips_missing_country_without_add_flag():
    mod = _load_module()

    merged, stats = mod.merge_nomaddb_into_visa_db(
        base_json={"countries": []},
        countries_csv_rows=[{"country_code": "KEN", "country_name_en": "Kenya", "country_name_ko": "케냐"}],
        visa_csv_rows=[],
        visa_urls={},
        add_missing_countries=False,
    )

    assert merged["countries"] == []
    assert stats["skipped_missing_in_base"] == 1
