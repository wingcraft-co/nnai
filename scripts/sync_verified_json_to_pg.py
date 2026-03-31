"""Sync verified JSON datasets into PostgreSQL verified_* tables.

Usage:
  DATABASE_URL=... python scripts/sync_verified_json_to_pg.py
"""

from __future__ import annotations

import json
import os
from datetime import datetime, UTC
from pathlib import Path

from psycopg2.extras import Json

from utils.data_paths import resolve_data_path
from utils.db import init_db


def _read_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def sync_verified_data() -> dict[str, int]:
    conn = init_db(os.environ.get("DATABASE_URL"))

    visa_db = _read_json(resolve_data_path("visa_db.json"))
    city_scores = _read_json(resolve_data_path("city_scores.json"))
    source_catalog = _read_json(resolve_data_path("source_catalog.json"))

    sources = source_catalog.get("sources", [])
    countries = visa_db.get("countries", [])
    cities = city_scores.get("cities", [])

    with conn.cursor() as cur:
        for s in sources:
            cur.execute(
                """
                INSERT INTO verified_sources (id, name, publisher, url, metric_scope, last_checked)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    publisher = EXCLUDED.publisher,
                    url = EXCLUDED.url,
                    metric_scope = EXCLUDED.metric_scope,
                    last_checked = EXCLUDED.last_checked,
                    updated_at = NOW();
                """,
                (
                    s.get("id"),
                    s.get("name"),
                    s.get("publisher"),
                    s.get("url"),
                    Json(s.get("metric_scope", [])),
                    s.get("last_checked"),
                ),
            )

        for c in countries:
            cur.execute(
                """
                INSERT INTO verified_countries (
                    country_id, name, name_kr, visa_type, min_income_usd,
                    stay_months, renewable, visa_fee_usd, source_url,
                    data_verified_date, is_verified, raw_data
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (country_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    name_kr = EXCLUDED.name_kr,
                    visa_type = EXCLUDED.visa_type,
                    min_income_usd = EXCLUDED.min_income_usd,
                    stay_months = EXCLUDED.stay_months,
                    renewable = EXCLUDED.renewable,
                    visa_fee_usd = EXCLUDED.visa_fee_usd,
                    source_url = EXCLUDED.source_url,
                    data_verified_date = EXCLUDED.data_verified_date,
                    is_verified = EXCLUDED.is_verified,
                    raw_data = EXCLUDED.raw_data,
                    updated_at = NOW();
                """,
                (
                    c.get("id"),
                    c.get("name"),
                    c.get("name_kr"),
                    c.get("visa_type"),
                    c.get("min_income_usd"),
                    c.get("stay_months"),
                    c.get("renewable"),
                    c.get("visa_fee_usd"),
                    c.get("source"),
                    c.get("data_verified_date"),
                    True,
                    Json(c),
                ),
            )

        for city in cities:
            cur.execute(
                """
                INSERT INTO verified_cities (
                    city_id, city, city_kr, country, country_id,
                    monthly_cost_usd, internet_mbps, safety_score,
                    english_score, nomad_score, tax_residency_days,
                    data_verified_date, is_verified, raw_data
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (city_id) DO UPDATE SET
                    city = EXCLUDED.city,
                    city_kr = EXCLUDED.city_kr,
                    country = EXCLUDED.country,
                    country_id = EXCLUDED.country_id,
                    monthly_cost_usd = EXCLUDED.monthly_cost_usd,
                    internet_mbps = EXCLUDED.internet_mbps,
                    safety_score = EXCLUDED.safety_score,
                    english_score = EXCLUDED.english_score,
                    nomad_score = EXCLUDED.nomad_score,
                    tax_residency_days = EXCLUDED.tax_residency_days,
                    data_verified_date = EXCLUDED.data_verified_date,
                    is_verified = EXCLUDED.is_verified,
                    raw_data = EXCLUDED.raw_data,
                    updated_at = NOW();
                """,
                (
                    city.get("id"),
                    city.get("city"),
                    city.get("city_kr"),
                    city.get("country"),
                    city.get("country_id"),
                    city.get("monthly_cost_usd"),
                    city.get("internet_mbps"),
                    city.get("safety_score"),
                    city.get("english_score"),
                    city.get("nomad_score"),
                    city.get("tax_residency_days"),
                    city.get("data_verified_date"),
                    True,
                    Json(city),
                ),
            )

        cur.execute("DELETE FROM verified_city_sources;")
        for city in cities:
            city_id = city.get("id")
            for source_id in city.get("source_refs", []):
                cur.execute(
                    """
                    INSERT INTO verified_city_sources (city_id, source_id)
                    VALUES (%s, %s)
                    ON CONFLICT (city_id, source_id) DO NOTHING;
                    """,
                    (city_id, source_id),
                )

        ts = datetime.now(UTC).isoformat()
        cur.execute(
            """
            INSERT INTO verification_logs (entity_type, entity_id, action, notes, payload)
            VALUES (%s, %s, %s, %s, %s);
            """,
            (
                "sync_run",
                ts,
                "upsert_verified_data",
                "Synced verified JSON datasets into PostgreSQL.",
                Json(
                    {
                        "sources": len(sources),
                        "countries": len(countries),
                        "cities": len(cities),
                    }
                ),
            ),
        )

    conn.commit()
    conn.close()
    return {
        "sources": len(sources),
        "countries": len(countries),
        "cities": len(cities),
    }


def main() -> int:
    stats = sync_verified_data()
    print("[sync_verified_json_to_pg] done")
    print(f"- sources: {stats['sources']}")
    print(f"- countries: {stats['countries']}")
    print(f"- cities: {stats['cities']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
