"""Sync latest NomadDB CSV data into canonical visa_db JSON.

Policy:
- CSV files are the latest source of truth for frequently-changing visa facts.
- JSON remains runtime canonical format for the app.
- This script merges CSV updates into existing JSON while preserving advanced/manual fields.

Default IO:
- Input CSVs: data/csv/nomad_countries_metadata.csv, data/csv/nomad_visa_relations.csv
- Base JSON: data/visa_db.json
- Output JSON: data/visa_db.json
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any

ISO3_TO_ISO2 = {
    "THA": "TH", "PRT": "PT", "IDN": "ID", "GEO": "GE", "EST": "EE", "MEX": "MX",
    "COL": "CO", "CZE": "CZ", "HUN": "HU", "ESP": "ES", "VNM": "VN", "MYS": "MY",
    "PHL": "PH", "HRV": "HR", "DEU": "DE", "NLD": "NL", "CRI": "CR", "PAN": "PA",
    "ROU": "RO", "BGR": "BG", "ARG": "AR", "URY": "UY", "MAR": "MA", "ARE": "AE",
    "CPV": "CV", "SVN": "SI", "ALB": "AL", "KEN": "KE",
}

SCHENGEN_IDS = {"PT", "ES", "DE", "EE", "GR", "HR", "CZ", "HU", "SI", "MT", "CY", "RO", "BG", "NL"}


def _parse_int(value: str | None) -> int | None:
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    digits = "".join(ch for ch in raw if ch.isdigit())
    if not digits:
        return None
    return int(digits)


def _parse_yn(value: str | None) -> bool | None:
    if value is None:
        return None
    v = value.strip().upper()
    if v == "Y":
        return True
    if v == "N":
        return False
    return None


def _cost_tier(monthly_cost_usd: int | None) -> str:
    if monthly_cost_usd is None:
        return "medium"
    if monthly_cost_usd < 1800:
        return "low"
    if monthly_cost_usd < 3000:
        return "medium"
    return "high"


def _load_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _ensure_required_defaults(country: dict[str, Any], visa_urls: dict[str, str]) -> None:
    cid = country.get("id", "")
    country.setdefault("name", cid)
    country.setdefault("name_kr", cid)
    country.setdefault("visa_type", "없음")
    country.setdefault("min_income_usd", 0)
    country.setdefault("stay_months", 12)
    country.setdefault("renewable", True)
    country.setdefault("key_docs", ["여권", "소득 증빙"])
    if len(country["key_docs"]) < 2:
        country["key_docs"] = ["여권", "소득 증빙"]
    country.setdefault("visa_fee_usd", 0)
    country.setdefault("tax_note", "확인 필요")
    country.setdefault("cost_tier", "medium")
    country.setdefault("notes", "")
    country.setdefault("source", visa_urls.get(cid, ""))

    country.setdefault("schengen", cid in SCHENGEN_IDS)
    country.setdefault("buffer_zone", False)
    country.setdefault("tax_residency_days", 183)
    country.setdefault("double_tax_treaty_with_kr", True)
    country.setdefault("mid_term_rental_available", True)


def merge_nomaddb_into_visa_db(
    base_json: dict[str, Any],
    countries_csv_rows: list[dict[str, str]],
    visa_csv_rows: list[dict[str, str]],
    visa_urls: dict[str, str],
    add_missing_countries: bool = False,
) -> tuple[dict[str, Any], dict[str, int]]:
    countries = base_json.get("countries", [])
    by_id: dict[str, dict[str, Any]] = {c["id"]: c for c in countries if "id" in c}

    meta_by_iso2: dict[str, dict[str, str]] = {}
    visa_by_iso2: dict[str, dict[str, str]] = {}

    unknown_iso3 = 0
    for row in countries_csv_rows:
        iso2 = ISO3_TO_ISO2.get(row.get("country_code", "").strip())
        if not iso2:
            unknown_iso3 += 1
            continue
        meta_by_iso2[iso2] = row

    for row in visa_csv_rows:
        iso2 = ISO3_TO_ISO2.get(row.get("country_code", "").strip())
        if not iso2:
            unknown_iso3 += 1
            continue
        visa_by_iso2[iso2] = row

    updated_count = 0
    added_count = 0
    skipped_missing_in_base = 0

    target_ids = set(meta_by_iso2) | set(visa_by_iso2)
    for cid in sorted(target_ids):
        meta = meta_by_iso2.get(cid)
        visa = visa_by_iso2.get(cid)

        if cid not in by_id:
            if not add_missing_countries:
                skipped_missing_in_base += 1
                continue
            by_id[cid] = {"id": cid}
            countries.append(by_id[cid])
            added_count += 1

        c = by_id[cid]

        if meta:
            c["name"] = meta.get("country_name_en", c.get("name", cid))
            c["name_kr"] = meta.get("country_name_ko", c.get("name_kr", cid))

            monthly_cost = _parse_int(meta.get("monthly_cost_usd_mid"))
            c["cost_tier"] = _cost_tier(monthly_cost)

            notes = (meta.get("notes") or "").strip()
            if notes:
                c["notes"] = notes

            last_verified = (meta.get("last_verified") or "").strip()
            if last_verified:
                c["data_verified_date"] = last_verified

            avail = _parse_yn(meta.get("nomad_visa_available"))
            if avail is False:
                c["visa_availability_note"] = "No dedicated DN visa (from latest CSV metadata)."

        if visa:
            visa_type = (visa.get("nomad_visa_name") or "").strip()
            if visa_type:
                c["visa_type"] = visa_type

            income = _parse_int(visa.get("nomad_visa_income_req_usd"))
            if income is not None:
                c["min_income_usd"] = income

            fee = _parse_int(visa.get("nomad_visa_fee_usd"))
            if fee is not None:
                c["visa_fee_usd"] = fee

            stay_months = _parse_int(visa.get("nomad_visa_duration_months"))
            if stay_months is not None:
                c["stay_months"] = stay_months

            renewable = _parse_yn(visa.get("nomad_visa_renewable"))
            if renewable is not None:
                c["renewable"] = renewable

            source_notes = (visa.get("source_notes") or "").strip()
            tourist_notes = (visa.get("tourist_visa_notes") or "").strip()
            notes_list = [x for x in [source_notes, tourist_notes] if x]
            if notes_list and not c.get("visa_notes"):
                c["visa_notes"] = notes_list

            last_verified = (visa.get("last_verified") or "").strip()
            if last_verified:
                c["data_verified_date"] = last_verified

        if not c.get("source"):
            c["source"] = visa_urls.get(cid, c.get("source", ""))

        _ensure_required_defaults(c, visa_urls)
        updated_count += 1

    for c in countries:
        _ensure_required_defaults(c, visa_urls)

    return base_json, {
        "updated": updated_count,
        "added": added_count,
        "skipped_missing_in_base": skipped_missing_in_base,
        "unknown_iso3": unknown_iso3,
        "csv_targets": len(target_ids),
        "total_countries": len(countries),
    }


def _write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync NomadDB CSV updates into visa_db JSON")
    parser.add_argument("--countries-csv", default="data/csv/nomad_countries_metadata.csv")
    parser.add_argument("--visa-csv", default="data/csv/nomad_visa_relations.csv")
    parser.add_argument("--base-json", default="data/visa_db.json")
    parser.add_argument("--out-json", default="data/visa_db.json")
    parser.add_argument("--visa-urls", default="data/visa_urls.json")
    parser.add_argument("--legacy-json-copy", default="")
    parser.add_argument("--add-missing-countries", action="store_true")
    args = parser.parse_args()

    countries_csv = _load_csv(Path(args.countries_csv))
    visa_csv = _load_csv(Path(args.visa_csv))
    base_json = _load_json(Path(args.base_json))
    visa_urls = _load_json(Path(args.visa_urls))

    merged, stats = merge_nomaddb_into_visa_db(
        base_json=base_json,
        countries_csv_rows=countries_csv,
        visa_csv_rows=visa_csv,
        visa_urls=visa_urls,
        add_missing_countries=args.add_missing_countries,
    )

    out_path = Path(args.out_json)
    _write_json(out_path, merged)

    legacy_path = Path(args.legacy_json_copy) if args.legacy_json_copy else None
    if legacy_path and legacy_path != out_path:
        _write_json(legacy_path, merged)

    print("[sync_nomaddb_csv_to_json] done")
    print(f"- updated: {stats['updated']}")
    print(f"- added: {stats['added']}")
    print(f"- skipped_missing_in_base: {stats['skipped_missing_in_base']}")
    print(f"- unknown_iso3: {stats['unknown_iso3']}")
    print(f"- csv_targets: {stats['csv_targets']}")
    print(f"- total_countries: {stats['total_countries']}")
    print(f"- out_json: {out_path}")
    if legacy_path and legacy_path != out_path:
        print(f"- legacy_json_copy: {legacy_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
