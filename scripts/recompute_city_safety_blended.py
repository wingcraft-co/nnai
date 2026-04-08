"""Recompute city safety_score by blending external city + country indicators.

Blend:
- City-level: Numbeo Safety Index (0..100) -> 0..10
- Country-level: GPI rank (from nomad_countries_metadata.csv) -> 4..10

Final:
  safety_score = round(0.6 * numbeo_city_score + 0.4 * gpi_country_score)
If city-level source is unavailable, fallback to gpi_country_score.
"""

from __future__ import annotations

import csv
import json
import os
import re
from pathlib import Path
from typing import Any
from urllib.parse import quote

import requests
from psycopg2.extras import Json
from dotenv import load_dotenv

from utils.data_paths import resolve_data_path
from utils.db import init_db

load_dotenv()

_HEADERS = {"User-Agent": "Mozilla/5.0"}
_SAFETY_RE = re.compile(
    r"Safety Index:\s*</td>\s*<td[^>]*>\s*([0-9]+(?:\.[0-9]+)?)",
    re.IGNORECASE,
)

_CITY_SLUG_OVERRIDES: dict[str, str] = {
    "Bali (Canggu)": "Canggu",
}


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


def _rank_to_score(rank: int, min_rank: int, max_rank: int) -> float:
    if max_rank <= min_rank:
        return 7.0
    norm = (rank - min_rank) / (max_rank - min_rank)
    score = 10.0 - (norm * 6.0)
    return max(1.0, min(10.0, score))


def _city_slug(city_name: str) -> str:
    name = _CITY_SLUG_OVERRIDES.get(city_name, city_name)
    name = re.sub(r"\s*\(.*?\)\s*", "", name).strip()
    return quote(name.replace(" ", "-"))


def _fetch_numbeo_safety_index(city_name: str) -> float | None:
    slug = _city_slug(city_name)
    url = f"https://www.numbeo.com/crime/in/{slug}"
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=20)
        if resp.status_code != 200:
            return None
        m = _SAFETY_RE.search(resp.text)
        if not m:
            return None
        val = float(m.group(1))
        if 0 <= val <= 100:
            return val
        return None
    except Exception:
        return None


def main() -> int:
    city_scores_path = resolve_data_path("city_scores.json")
    raw_city_csv = resolve_data_path("rawdata/city_scores.csv")
    raw_meta_csv = resolve_data_path("rawdata/nomad_countries_metadata.csv")

    city_iso3 = _load_city_iso3_map(raw_city_csv)
    gpi_rank_map = _load_gpi_rank_map(raw_meta_csv)

    with open(city_scores_path, encoding="utf-8") as f:
        payload: dict[str, Any] = json.load(f)

    cities: list[dict[str, Any]] = payload.get("cities", [])

    gpi_ranks: list[int] = []
    for city in cities:
        cid = str(city.get("id") or "")
        iso3 = city_iso3.get(cid)
        rank = gpi_rank_map.get(iso3 or "")
        if rank is not None:
            gpi_ranks.append(rank)
    if not gpi_ranks:
        raise SystemExit("No GPI rank data available.")
    min_rank, max_rank = min(gpi_ranks), max(gpi_ranks)

    updated = 0
    with_numbeo = 0
    with_numbeo_cache = 0
    gpi_only = 0
    metrics_for_db: list[dict[str, Any]] = []

    for city in cities:
        cid = str(city.get("id") or "")
        iso3 = city_iso3.get(cid)
        rank = gpi_rank_map.get(iso3 or "")
        if rank is None:
            continue

        gpi_score = _rank_to_score(rank, min_rank, max_rank)
        numbeo_idx = _fetch_numbeo_safety_index(str(city.get("city") or ""))
        if numbeo_idx is None:
            cached = city.get("safety_source_numbeo_index")
            try:
                numbeo_idx = float(cached) if cached is not None else None
            except Exception:
                numbeo_idx = None
            if numbeo_idx is not None:
                with_numbeo_cache += 1

        if numbeo_idx is not None:
            city_score = numbeo_idx / 10.0
            blended = round((city_score * 0.6) + (gpi_score * 0.4), 1)
            with_numbeo += 1
            city["safety_source_numbeo_index"] = round(numbeo_idx, 2)
            city["safety_source_city_score"] = round(city_score, 2)
            city["safety_source_id"] = "blended_numbeo_city_gpi_2024"
            city["safety_method"] = "0.6*numbeo_city_safety_0_10 + 0.4*gpi_country_rank_4_10"
            refs = list(city.get("source_refs") or [])
            if "numbeo_crime_index" not in refs:
                refs.append("numbeo_crime_index")
            if "global_peace_index_2024" not in refs:
                refs.append("global_peace_index_2024")
            city["source_refs"] = refs
            metrics_for_db.append(
                {
                    "city_id": cid,
                    "source_id": "numbeo_crime_index",
                    "metric_key": "numbeo_safety_index",
                    "metric_value": round(numbeo_idx, 2),
                    "payload": {"url": f"https://www.numbeo.com/crime/in/{_city_slug(str(city.get('city') or ''))}"},
                }
            )
        else:
            blended = round(gpi_score, 1)
            gpi_only += 1
            city.pop("safety_source_numbeo_index", None)
            city.pop("safety_source_city_score", None)
            city["safety_source_id"] = "global_peace_index_2024"
            city["safety_method"] = "gpi_country_rank_minmax_to_4_10"

        city["safety_source_rank"] = rank
        city["safety_score"] = max(1, min(10, round(blended)))
        metrics_for_db.append(
            {
                "city_id": cid,
                "source_id": "global_peace_index_2024",
                "metric_key": "gpi_rank_2024",
                "metric_value": float(rank),
                "payload": {"gpi_score_0_10": round(gpi_score, 3)},
            }
        )
        metrics_for_db.append(
            {
                "city_id": cid,
                "source_id": city["safety_source_id"],
                "metric_key": "blended_safety_score",
                "metric_value": float(city["safety_score"]),
                "payload": {"method": city.get("safety_method", "")},
            }
        )
        updated += 1

    with open(city_scores_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")

    db_url = os.environ.get("DATABASE_URL")
    db_saved = 0
    if db_url:
        conn = init_db(db_url)
        with conn.cursor() as cur:
            for m in metrics_for_db:
                cur.execute(
                    """
                    INSERT INTO verified_city_external_metrics
                    (city_id, source_id, metric_key, metric_value, fetched_at, payload)
                    VALUES (%s, %s, %s, %s, CURRENT_DATE::text, %s)
                    ON CONFLICT (city_id, source_id, metric_key) DO UPDATE SET
                        metric_value = EXCLUDED.metric_value,
                        fetched_at = EXCLUDED.fetched_at,
                        payload = EXCLUDED.payload,
                        updated_at = NOW();
                    """,
                    (
                        m["city_id"],
                        m["source_id"],
                        m["metric_key"],
                        m["metric_value"],
                        Json(m.get("payload", {})),
                    ),
                )
                db_saved += 1
        conn.commit()
        conn.close()

    print("[recompute_city_safety_blended] done")
    print(f"- updated: {updated}")
    print(f"- with_numbeo: {with_numbeo}")
    print(f"- with_numbeo_cache: {with_numbeo_cache}")
    print(f"- gpi_only: {gpi_only}")
    print(f"- gpi_rank_range: {min_rank}..{max_rank}")
    print(f"- db_saved: {db_saved}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
