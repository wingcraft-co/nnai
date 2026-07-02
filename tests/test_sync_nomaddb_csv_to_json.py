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


def test_merge_syncs_ees_applicable_flag():
    mod = _load_module()

    base = {
        "countries": [
            {
                "id": "NL",
                "name": "Netherlands",
                "name_kr": "네덜란드",
                "visa_type": "Old",
                "min_income_usd": 0,
                "stay_months": 0,
                "renewable": False,
                "key_docs": ["여권", "소득 증빙"],
                "visa_fee_usd": 0,
                "tax_note": "확인 필요",
                "cost_tier": "medium",
                "notes": "",
                "source": "https://example.com",
                "schengen": True,
                "buffer_zone": False,
                "tax_residency_days": 183,
                "double_tax_treaty_with_kr": True,
                "mid_term_rental_available": True,
            }
        ]
    }

    merged, _ = mod.merge_nomaddb_into_visa_db(
        base_json=copy.deepcopy(base),
        countries_csv_rows=[],
        visa_csv_rows=[
            {
                "country_code": "NLD",
                "nomad_visa_name": "MVV Zelfstandige",
                "nomad_visa_income_req_usd": "2020",
                "nomad_visa_fee_usd": "423",
                "nomad_visa_duration_months": "36",
                "nomad_visa_renewable": "Y",
                "ees_applicable": "Y",
                "source_notes": "",
                "tourist_visa_notes": "",
                "last_verified": "2026-06-12",
                "official_source_url": "https://ind.nl/example",
            }
        ],
        visa_urls={},
        add_missing_countries=False,
    )

    assert merged["countries"][0]["ees_applicable"] is True


def test_merge_normalizes_null_defaults_for_base_only_country():
    mod = _load_module()

    base = {
        "countries": [
            {
                "id": "MK",
                "name": "North Macedonia",
                "name_kr": "북마케도니아",
                "visa_type": "사전비자 필요",
                "min_income_usd": None,
                "stay_months": 3,
                "renewable": False,
                "key_docs": ["유효 여권", "체류 경비 증빙"],
                "visa_fee_usd": 60,
                "tax_note": "확인 필요",
                "cost_tier": "low",
                "notes": "old",
                "source": "https://example.com/mk",
                "schengen": False,
                "buffer_zone": False,
                "tax_residency_days": 183,
                "double_tax_treaty_with_kr": False,
                "mid_term_rental_available": False,
            }
        ]
    }

    merged, _ = mod.merge_nomaddb_into_visa_db(
        base_json=copy.deepcopy(base),
        countries_csv_rows=[],
        visa_csv_rows=[],
        visa_urls={},
        add_missing_countries=False,
    )

    assert merged["countries"][0]["min_income_usd"] == 0
