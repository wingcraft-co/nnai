"""Sync latest raw city score CSV into canonical city_scores JSON.

Preserves richer manually maintained fields while refreshing CSV-backed values.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any


def _load_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def _load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def _write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _parse_int(value: str | None) -> int | None:
    if value is None:
        return None
    raw = value.strip()
    if not raw:
        return None
    digits = "".join(ch for ch in raw if ch.isdigit())
    if not digits:
        return None
    return int(digits)


def _parse_bool(value: str | None) -> bool | None:
    if value is None:
        return None
    raw = value.strip().upper()
    if raw == "Y":
        return True
    if raw == "N":
        return False
    return None


def merge_city_scores(
    base_json: dict[str, Any],
    csv_rows: list[dict[str, str]],
) -> tuple[dict[str, Any], dict[str, int]]:
    cities = base_json.get("cities", [])
    by_id: dict[str, dict[str, Any]] = {city["id"]: city for city in cities if "id" in city}

    updated = 0
    skipped = 0

    for row in csv_rows:
        city_id = (row.get("city_id") or "").strip()
        if not city_id or city_id not in by_id:
            skipped += 1
            continue

        city = by_id[city_id]
        city["id"] = city_id
        city["city"] = row.get("city_en", city.get("city", city_id))
        city["city_kr"] = row.get("city_ko", city.get("city_kr", city_id))
        city["country_id"] = row.get("country_id_2", city.get("country_id", ""))

        for key in [
            "monthly_cost_usd",
            "internet_mbps",
            "safety_score",
            "english_score",
            "nomad_score",
            "cowork_usd_month",
            "coworking_score",
            "mid_term_rent_usd",
            "tax_residency_days",
        ]:
            parsed = _parse_int(row.get(key))
            if parsed is not None:
                city[key] = parsed

        for key in ["climate", "community_size", "korean_community_size", "data_verified_date"]:
            value = (row.get(key) or "").strip()
            if value:
                city[key] = value

        for key in ["flatio_search_url", "anyplace_search_url", "nomad_meetup_url"]:
            value = (row.get(key) or "").strip()
            if value:
                city[key] = value

        source_refs = (row.get("source_refs") or "").strip()
        if source_refs:
            city["source_refs"] = [item for item in source_refs.split("|") if item]

        work_disclosure_risk = (row.get("work_disclosure_risk") or "").strip()
        round_trip_required = _parse_bool(row.get("round_trip_required"))
        if work_disclosure_risk or round_trip_required is not None:
            existing_entry_tips = city.get("entry_tips", {})
            if isinstance(existing_entry_tips, dict):
                entry_tips = dict(existing_entry_tips)
            else:
                entry_tips = {}
                if isinstance(existing_entry_tips, str) and existing_entry_tips.strip():
                    entry_tips["work_disclosure_risk"] = existing_entry_tips.strip()
            if round_trip_required is not None:
                entry_tips["round_trip_required"] = round_trip_required
            if work_disclosure_risk:
                entry_tips["work_disclosure_risk"] = work_disclosure_risk
            entry_tips.setdefault("visa_run_options", [])
            city["entry_tips"] = entry_tips

        updated += 1

    return base_json, {
        "updated": updated,
        "skipped": skipped,
        "csv_rows": len(csv_rows),
        "total_cities": len(cities),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync raw city score CSV into city_scores JSON")
    parser.add_argument("--city-csv", default="data/rawdata/city_scores.csv")
    parser.add_argument("--base-json", default="data/city_scores.json")
    parser.add_argument("--out-json", default="data/city_scores.json")
    parser.add_argument("--legacy-json-copy", default="")
    args = parser.parse_args()

    city_csv = _load_csv(Path(args.city_csv))
    base_json = _load_json(Path(args.base_json))
    merged, stats = merge_city_scores(base_json=base_json, csv_rows=city_csv)

    out_path = Path(args.out_json)
    _write_json(out_path, merged)

    legacy_path = Path(args.legacy_json_copy) if args.legacy_json_copy else None
    if legacy_path and legacy_path != out_path:
        _write_json(legacy_path, merged)

    print("[sync_city_scores_csv_to_json] done")
    print(f"- updated: {stats['updated']}")
    print(f"- skipped: {stats['skipped']}")
    print(f"- csv_rows: {stats['csv_rows']}")
    print(f"- total_cities: {stats['total_cities']}")
    print(f"- out_json: {out_path}")
    if legacy_path and legacy_path != out_path:
        print(f"- legacy_json_copy: {legacy_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
