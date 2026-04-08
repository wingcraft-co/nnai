"""Recompute city safety_score from external Global Peace Index rank.

Inputs:
- data/city_scores.json
- data/rawdata/city_scores.csv (city_id -> country_code mapping)
- data/rawdata/nomad_countries_metadata.csv (country_code -> gpi_rank_2024)

Output:
- data/city_scores.json (in-place)
"""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

from utils.data_paths import resolve_data_path


def _to_int(raw: str | None) -> int | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    digits = "".join(ch for ch in s if ch.isdigit())
    if not digits:
        return None
    return int(digits)


def _load_city_iso3_map(csv_path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    with csv_path.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            city_id = (row.get("city_id") or "").strip()
            iso3 = (row.get("country_code") or "").strip()
            if city_id and iso3:
                out[city_id] = iso3
    return out


def _load_gpi_rank_map(csv_path: Path) -> dict[str, int]:
    out: dict[str, int] = {}
    with csv_path.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            iso3 = (row.get("country_code") or "").strip()
            gpi_rank = _to_int(row.get("gpi_rank_2024"))
            if iso3 and gpi_rank is not None:
                out[iso3] = gpi_rank
    return out


def _rank_to_score(rank: int, min_rank: int, max_rank: int) -> int:
    """Map rank to 4..10 score (lower rank = safer)."""
    if max_rank <= min_rank:
        return 7
    # Normalize so min rank => 10, max rank => 4
    norm = (rank - min_rank) / (max_rank - min_rank)
    score = 10.0 - (norm * 6.0)
    return max(1, min(10, round(score)))


def main() -> int:
    city_scores_path = resolve_data_path("city_scores.json")
    raw_city_csv = resolve_data_path("rawdata/city_scores.csv")
    raw_meta_csv = resolve_data_path("rawdata/nomad_countries_metadata.csv")

    city_iso3 = _load_city_iso3_map(raw_city_csv)
    gpi_rank_map = _load_gpi_rank_map(raw_meta_csv)

    with open(city_scores_path, encoding="utf-8") as f:
        payload: dict[str, Any] = json.load(f)

    cities: list[dict[str, Any]] = payload.get("cities", [])
    ranks: list[int] = []
    for city in cities:
        cid = str(city.get("id") or "")
        iso3 = city_iso3.get(cid)
        if not iso3:
            continue
        rank = gpi_rank_map.get(iso3)
        if rank is not None:
            ranks.append(rank)

    if not ranks:
        raise SystemExit("No GPI ranks found; aborting.")

    min_rank, max_rank = min(ranks), max(ranks)
    updated = 0
    skipped = 0

    for city in cities:
        cid = str(city.get("id") or "")
        iso3 = city_iso3.get(cid)
        rank = gpi_rank_map.get(iso3 or "")
        if rank is None:
            skipped += 1
            continue

        city["safety_score"] = _rank_to_score(rank, min_rank, max_rank)
        city["safety_source_id"] = "global_peace_index_2024"
        city["safety_source_rank"] = rank
        city["safety_method"] = "country_gpi_rank_minmax_to_4_10"

        source_refs = list(city.get("source_refs") or [])
        if "global_peace_index_2024" not in source_refs:
            source_refs.append("global_peace_index_2024")
        city["source_refs"] = source_refs
        updated += 1

    with open(city_scores_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print("[recompute_city_safety_from_gpi] done")
    print(f"- updated: {updated}")
    print(f"- skipped: {skipped}")
    print(f"- rank_range: {min_rank}..{max_rank}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
