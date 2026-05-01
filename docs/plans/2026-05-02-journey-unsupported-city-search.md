# Journey Unsupported City Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backend support for verified unsupported journey city search and dashed-line metadata without editing Louie's frontend components.

**Architecture:** Keep the existing supported-city journey flow compatible, add a backend geocoding helper with short-lived result ids, and persist explicit stop metadata (`supported_city_id`, `is_supported_city`, `location_source`, `line_style`). The save endpoint accepts the legacy body plus new safer bodies: `{ city_id, note }` for supported cities and `{ geocode_result_id, note }` for unsupported verified cities.

**Tech Stack:** FastAPI, Pydantic, PostgreSQL via psycopg2, pytest, static JSON city data, optional Nominatim-compatible HTTP provider wrapped behind `utils/geocoding.py`.

---

## File Map

- Create `utils/geocoding.py`: supported-city lookup, query normalization, provider result normalization, in-memory geocode result cache.
- Modify `api/journey.py`: add `POST /api/journey/geocode`, support `city_id`/`geocode_result_id` save bodies, return metadata fields, suppress unsupported community rows below threshold.
- Modify `utils/db.py`: add required columns, DDL columns, `ALTER TABLE` migrations, and coordinate checks.
- Modify `tests/test_journey_api.py`: extend existing registered tests; no workflow entry needed because this file is already in `.github/workflows/main-tests.yml`.
- Modify `cowork/backend/api-reference.md`: document geocode endpoint and journey metadata.
- Modify `cowork/backend/db-schema.md`: document new columns/checks.

Do not modify `frontend/src/components/journey/NomadJourneyModal.tsx`.
Do not read frontend files at runtime from backend code. `utils/geocoding.py` must own the backend copy of supported city coordinates, copied from the existing `CITY_COORDINATES` constant in `frontend/src/lib/journey-map.mjs` during implementation.

---

### Task 1: Add Geocoding Helper

**Files:**
- Create: `utils/geocoding.py`
- Test: `tests/test_journey_api.py`

- [ ] **Step 1: Add focused tests for helper behavior**

Append helper-level tests to `tests/test_journey_api.py`:

```python
def test_geocode_supported_city_match_uses_canonical_data():
    from utils.geocoding import geocode_city_candidates

    body = geocode_city_candidates("Lisbon", "PT", provider=lambda *_args, **_kwargs: [])

    assert body["country_code"] == "PT"
    assert body["results"][0]["supported"] is True
    assert body["results"][0]["supported_city_id"] == "LIS"
    assert body["results"][0]["location_source"] == "nnai_supported"
    assert body["results"][0]["geocode_result_id"] is None
    assert body["results"][0]["lat"] == 38.7223
    assert body["results"][0]["lng"] == -9.1393


def test_geocode_filters_provider_results_to_selected_country():
    from utils.geocoding import geocode_city_candidates

    def provider(query, country_code):
        return [
            {
                "city": "Granada",
                "country": "Spain",
                "country_code": "ES",
                "lat": 37.1773,
                "lng": -3.5986,
                "display_name": "Granada, Andalusia, Spain",
                "place_id": "es-granada",
                "confidence": 0.9,
            },
            {
                "city": "Granada",
                "country": "Nicaragua",
                "country_code": "NI",
                "lat": 11.9344,
                "lng": -85.956,
                "display_name": "Granada, Nicaragua",
                "place_id": "ni-granada",
                "confidence": 0.8,
            },
        ]

    body = geocode_city_candidates("Granada", "ES", provider=provider)

    assert [row["country_code"] for row in body["results"]] == ["ES"]
    assert body["results"][0]["supported"] is False
    assert body["results"][0]["geocode_result_id"].startswith("geo_")
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
SKIP_EXTERNAL_INIT=1 .venv/bin/pytest tests/test_journey_api.py::test_geocode_supported_city_match_uses_canonical_data tests/test_journey_api.py::test_geocode_filters_provider_results_to_selected_country -q
```

Expected: import error for `utils.geocoding`.

- [ ] **Step 3: Implement `utils/geocoding.py`**

Create `utils/geocoding.py`:

```python
"""City geocoding helpers for Nomad Journey."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import math
import re
import secrets
import time
import unicodedata
from pathlib import Path
from typing import Callable, TypedDict
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from utils.paths import resolve_data_path

ATTRIBUTION = "Geocoding data from OpenStreetMap contributors"
SUPPORTED_SOURCE = "nnai_supported"
NOMINATIM_SOURCE = "nominatim"
GEOCODE_RESULT_TTL_SECONDS = 15 * 60
_NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
_LAST_PROVIDER_CALL = 0.0
_QUERY_CACHE: dict[tuple[str, str], tuple[datetime, list[dict]]] = {}
_RESULT_CACHE: dict[str, dict] = {}
SUPPORTED_CITY_COORDINATES = {
    "LIS": (38.7223, -9.1393),
    "PTO": (41.1579, -8.6291),
    "KL": (3.139, 101.6869),
    "PG": (5.4141, 100.3288),
    "CNX": (18.7883, 98.9853),
    "BKK": (13.7563, 100.5018),
    "DPS": (-8.65, 115.138),
    "TYO": (35.6762, 139.6503),
    "OSA": (34.6937, 135.5023),
    "FUK": (33.5902, 130.4017),
}


class ProviderResult(TypedDict, total=False):
    city: str
    country: str
    country_code: str
    lat: float
    lng: float
    display_name: str
    place_id: str
    confidence: float


def normalize_city_query(query: str) -> str:
    normalized = unicodedata.normalize("NFKC", query or "")
    normalized = re.sub(r"\s+", " ", normalized).strip()
    if len(normalized) < 2 or len(normalized) > 80:
        raise ValueError("query must be between 2 and 80 characters")
    return normalized


def normalize_country_code(country_code: str) -> str:
    code = (country_code or "").strip().upper()
    if not re.fullmatch(r"[A-Z]{2}", code):
        raise ValueError("country_code must be ISO-2")
    return code


def _finite_coordinate(value: object, low: float, high: float) -> float:
    number = float(value)
    if not math.isfinite(number) or number < low or number > high:
        raise ValueError("invalid coordinate")
    return number


def _load_supported_cities() -> list[dict]:
    with Path(resolve_data_path("city_scores.json")).open(encoding="utf-8") as handle:
        return json.load(handle).get("cities", [])


def _supported_city_rows(query: str, country_code: str) -> list[dict]:
    needle = query.casefold()
    rows = []
    for city in _load_supported_cities():
        if str(city.get("country_id", "")).upper() != country_code:
            continue
        names = {str(city.get("id", "")), str(city.get("city", "")), str(city.get("city_kr", ""))}
        if needle not in {name.casefold() for name in names if name}:
            continue
        coordinate = SUPPORTED_CITY_COORDINATES.get(str(city["id"]))
        if not coordinate:
            continue
        lat, lng = coordinate
        rows.append(
            {
                "city": city["city"],
                "country": city["country"],
                "country_code": country_code,
                "lat": lat,
                "lng": lng,
                "supported": True,
                "supported_city_id": city["id"],
                "geocode_result_id": None,
                "location_source": SUPPORTED_SOURCE,
                "display_name": f"{city['city']}, {city['country']}",
            }
        )
    return rows


def _store_result(row: dict) -> str:
    result_id = f"geo_{secrets.token_urlsafe(12)}"
    _RESULT_CACHE[result_id] = {
        **row,
        "expires_at": datetime.now(timezone.utc) + timedelta(seconds=GEOCODE_RESULT_TTL_SECONDS),
    }
    return result_id


def get_cached_geocode_result(result_id: str) -> dict | None:
    row = _RESULT_CACHE.get(result_id)
    if not row:
        return None
    if row["expires_at"] < datetime.now(timezone.utc):
        _RESULT_CACHE.pop(result_id, None)
        return None
    return {key: value for key, value in row.items() if key != "expires_at"}


def nominatim_provider(query: str, country_code: str) -> list[ProviderResult]:
    global _LAST_PROVIDER_CALL
    elapsed = time.monotonic() - _LAST_PROVIDER_CALL
    if elapsed < 1.0:
        time.sleep(1.0 - elapsed)
    params = urlencode(
        {
            "q": query,
            "countrycodes": country_code.lower(),
            "format": "jsonv2",
            "limit": "5",
            "addressdetails": "1",
        }
    )
    request = Request(
        f"{_NOMINATIM_URL}?{params}",
        headers={"User-Agent": "NomadNavigatorAI/1.0 (https://nnai.app)"},
    )
    _LAST_PROVIDER_CALL = time.monotonic()
    with urlopen(request, timeout=3) as response:
        payload = json.loads(response.read(100_000).decode("utf-8"))
    rows: list[ProviderResult] = []
    for item in payload:
        place_type = item.get("type")
        place_class = item.get("class")
        address = item.get("address") or {}
        if place_class != "place" or place_type not in {"city", "town", "village", "municipality"}:
            continue
        rows.append(
            {
                "city": item.get("name") or address.get("city") or address.get("town") or query,
                "country": address.get("country") or "",
                "country_code": str(address.get("country_code") or "").upper(),
                "lat": float(item["lat"]),
                "lng": float(item["lon"]),
                "display_name": item.get("display_name") or "",
                "place_id": str(item.get("place_id") or ""),
                "confidence": float(item.get("importance") or 0),
            }
        )
    return rows


def geocode_city_candidates(
    query: str,
    country_code: str,
    provider: Callable[[str, str], list[ProviderResult]] = nominatim_provider,
) -> dict:
    normalized_query = normalize_city_query(query)
    normalized_country = normalize_country_code(country_code)
    supported = _supported_city_rows(normalized_query, normalized_country)
    if supported:
        return {
            "query": normalized_query,
            "country_code": normalized_country,
            "results": supported,
            "attribution": ATTRIBUTION,
        }

    cache_key = (normalized_country, normalized_query.casefold())
    cached = _QUERY_CACHE.get(cache_key)
    if cached and cached[0] > datetime.now(timezone.utc):
        provider_rows = cached[1]
    else:
        provider_rows = list(provider(normalized_query, normalized_country))
        _QUERY_CACHE[cache_key] = (
            datetime.now(timezone.utc) + timedelta(seconds=GEOCODE_RESULT_TTL_SECONDS),
            provider_rows,
        )

    results = []
    for raw in provider_rows:
        if normalize_country_code(str(raw.get("country_code", ""))) != normalized_country:
            continue
        row = {
            "city": str(raw.get("city") or normalized_query),
            "country": str(raw.get("country") or ""),
            "country_code": normalized_country,
            "lat": _finite_coordinate(raw.get("lat"), -90, 90),
            "lng": _finite_coordinate(raw.get("lng"), -180, 180),
            "supported": False,
            "supported_city_id": None,
            "location_source": NOMINATIM_SOURCE,
            "display_name": str(raw.get("display_name") or ""),
            "geocode_place_id": str(raw.get("place_id") or ""),
            "geocode_confidence": float(raw.get("confidence") or 0),
        }
        row["geocode_result_id"] = _store_result(row)
        results.append(row)

    return {
        "query": normalized_query,
        "country_code": normalized_country,
        "results": results[:5],
        "attribution": ATTRIBUTION,
    }
```

- [ ] **Step 4: Run tests to verify helper behavior passes**

Run:

```bash
SKIP_EXTERNAL_INIT=1 .venv/bin/pytest tests/test_journey_api.py::test_geocode_supported_city_match_uses_canonical_data tests/test_journey_api.py::test_geocode_filters_provider_results_to_selected_country -q
```

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add utils/geocoding.py tests/test_journey_api.py
git commit -m "feat: add journey city geocoding helper"
```

---

### Task 2: Add Journey Schema Metadata

**Files:**
- Modify: `utils/db.py`
- Test: `tests/test_db.py`

- [ ] **Step 1: Write schema readiness test**

Append to `tests/test_db.py`:

```python
def test_required_schema_includes_journey_metadata_columns():
    from utils import db

    required = db._REQUIRED_SCHEMA_COLUMNS["nomad_journey_stops"]

    assert {"supported_city_id", "is_supported_city", "location_source", "line_style"}.issubset(required)
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
SKIP_EXTERNAL_INIT=1 .venv/bin/pytest tests/test_db.py::test_required_schema_includes_journey_metadata_columns -q
```

Expected: assertion failure.

- [ ] **Step 3: Update schema readiness columns**

In `utils/db.py`, extend `_REQUIRED_SCHEMA_COLUMNS["nomad_journey_stops"]`:

```python
        "supported_city_id",
        "is_supported_city",
        "location_source",
        "line_style",
        "geocode_place_id",
        "geocode_confidence",
        "geocoded_at",
```

- [ ] **Step 4: Update DDL and migration ALTERs**

In the `CREATE TABLE IF NOT EXISTS nomad_journey_stops` block, add:

```sql
                supported_city_id TEXT,
                is_supported_city BOOLEAN NOT NULL DEFAULT FALSE,
                location_source TEXT NOT NULL DEFAULT 'legacy',
                line_style TEXT NOT NULL DEFAULT 'solid',
                geocode_place_id TEXT,
                geocode_confidence DOUBLE PRECISION,
                geocoded_at TIMESTAMPTZ,
                CHECK (lat BETWEEN -90 AND 90),
                CHECK (lng BETWEEN -180 AND 180),
                CHECK (line_style IN ('solid', 'dashed'))
```

After the create-table statement, add idempotent migrations:

```python
        for column_sql in [
            "ADD COLUMN IF NOT EXISTS supported_city_id TEXT",
            "ADD COLUMN IF NOT EXISTS is_supported_city BOOLEAN NOT NULL DEFAULT FALSE",
            "ADD COLUMN IF NOT EXISTS location_source TEXT NOT NULL DEFAULT 'legacy'",
            "ADD COLUMN IF NOT EXISTS line_style TEXT NOT NULL DEFAULT 'solid'",
            "ADD COLUMN IF NOT EXISTS geocode_place_id TEXT",
            "ADD COLUMN IF NOT EXISTS geocode_confidence DOUBLE PRECISION",
            "ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ",
        ]:
            cur.execute(f"ALTER TABLE nomad_journey_stops {column_sql};")
        cur.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'chk_nomad_journey_stops_lat_range'
                ) THEN
                    ALTER TABLE nomad_journey_stops
                    ADD CONSTRAINT chk_nomad_journey_stops_lat_range CHECK (lat BETWEEN -90 AND 90);
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'chk_nomad_journey_stops_lng_range'
                ) THEN
                    ALTER TABLE nomad_journey_stops
                    ADD CONSTRAINT chk_nomad_journey_stops_lng_range CHECK (lng BETWEEN -180 AND 180);
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'chk_nomad_journey_stops_line_style'
                ) THEN
                    ALTER TABLE nomad_journey_stops
                    ADD CONSTRAINT chk_nomad_journey_stops_line_style CHECK (line_style IN ('solid', 'dashed'));
                END IF;
            END $$;
        """)
```

- [ ] **Step 5: Run schema test**

Run:

```bash
SKIP_EXTERNAL_INIT=1 .venv/bin/pytest tests/test_db.py::test_required_schema_includes_journey_metadata_columns -q
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add utils/db.py tests/test_db.py
git commit -m "feat: add journey stop metadata schema"
```

---

### Task 3: Add Geocode Endpoint And Safe Save Paths

**Files:**
- Modify: `api/journey.py`
- Test: `tests/test_journey_api.py`

- [ ] **Step 1: Add API tests**

Append to `tests/test_journey_api.py`:

```python
def test_create_stop_rejects_invalid_coordinates_without_db():
    from pydantic import ValidationError
    from api.journey import JourneyStopIn

    with pytest.raises(ValidationError):
        JourneyStopIn(city="Bad", country="Nowhere", country_code="NO", lat=91, lng=0, note="")


def test_create_stop_rejects_ambiguous_new_save_body_without_db():
    from pydantic import ValidationError
    from api.journey import JourneyStopIn

    with pytest.raises(ValidationError):
        JourneyStopIn(city_id="LIS", geocode_result_id="geo_fake", note="")
```

Add DB-backed tests:

```python
@requires_db
def test_create_supported_city_id_stop_sets_solid_metadata():
    client = TestClient(_make_app("uid1"))

    response = client.post("/api/journey/stops", json={"city_id": "LIS", "note": "리스본"})

    assert response.status_code == 200
    body = response.json()
    assert body["city"] == "Lisbon"
    assert body["country_code"] == "PT"
    assert body["supported_city_id"] == "LIS"
    assert body["is_supported_city"] is True
    assert body["location_source"] == "nnai_supported"
    assert body["line_style"] == "solid"


@requires_db
def test_create_unsupported_geocode_stop_sets_dashed_metadata(monkeypatch):
    from utils.geocoding import geocode_city_candidates

    def provider(_query, _country_code):
        return [{
            "city": "Granada",
            "country": "Spain",
            "country_code": "ES",
            "lat": 37.1773,
            "lng": -3.5986,
            "display_name": "Granada, Spain",
            "place_id": "es-granada",
            "confidence": 0.9,
        }]

    result_id = geocode_city_candidates("Granada", "ES", provider=provider)["results"][0]["geocode_result_id"]
    client = TestClient(_make_app("uid1"))

    response = client.post("/api/journey/stops", json={"geocode_result_id": result_id, "note": "그라나다"})

    assert response.status_code == 200
    body = response.json()
    assert body["city"] == "Granada"
    assert body["supported_city_id"] is None
    assert body["is_supported_city"] is False
    assert body["location_source"] == "nominatim"
    assert body["line_style"] == "dashed"
```

- [ ] **Step 2: Run tests to verify failures**

Run:

```bash
SKIP_EXTERNAL_INIT=1 .venv/bin/pytest tests/test_journey_api.py::test_create_stop_rejects_invalid_coordinates_without_db tests/test_journey_api.py::test_create_stop_rejects_ambiguous_new_save_body_without_db -q
```

Expected: failures until model validation is updated.

- [ ] **Step 3: Update request models**

In `api/journey.py`, replace `JourneyStopIn` with:

```python
class JourneyStopIn(BaseModel):
    city: str | None = Field(default=None, min_length=1, max_length=100)
    country: str | None = Field(default=None, min_length=1, max_length=100)
    country_code: str | None = Field(default=None, max_length=2)
    lat: float | None = None
    lng: float | None = None
    note: str = Field(default="", max_length=10)
    city_id: str | None = Field(default=None, max_length=20)
    geocode_result_id: str | None = Field(default=None, max_length=80)

    @model_validator(mode="after")
    def validate_shape(self):
        new_keys = [bool(self.city_id), bool(self.geocode_result_id)]
        if all(new_keys):
            raise ValueError("city_id and geocode_result_id are mutually exclusive")
        if any(new_keys):
            return self
        if not all([self.city, self.country, self.lat is not None, self.lng is not None]):
            raise ValueError("legacy saves require city, country, lat, and lng")
        if not math.isfinite(float(self.lat)) or not -90 <= float(self.lat) <= 90:
            raise ValueError("lat must be between -90 and 90")
        if not math.isfinite(float(self.lng)) or not -180 <= float(self.lng) <= 180:
            raise ValueError("lng must be between -180 and 180")
        return self
```

Also import:

```python
import math
from pydantic import BaseModel, Field, model_validator
from utils.geocoding import geocode_city_candidates, get_cached_geocode_result
```

- [ ] **Step 4: Add geocode endpoint**

Add:

```python
class JourneyGeocodeIn(BaseModel):
    query: str = Field(min_length=2, max_length=80)
    country_code: str = Field(min_length=2, max_length=2)


@router.post("/journey/geocode")
def geocode_journey_city(body: JourneyGeocodeIn):
    try:
        return geocode_city_candidates(body.query, body.country_code)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
```

- [ ] **Step 5: Add canonical city lookup and insert path**

Add helper functions:

```python
def _supported_city_by_id(city_id: str) -> dict | None:
    from utils.geocoding import _load_supported_cities

    normalized = city_id.upper()
    return next((row for row in _load_supported_cities() if str(row.get("id", "")).upper() == normalized), None)


def _stop_payload_from_request(stop: JourneyStopIn) -> dict:
    if stop.city_id:
        city = _supported_city_by_id(stop.city_id)
        if not city:
            raise HTTPException(422, "지원 도시를 찾을 수 없습니다")
        from utils.geocoding import SUPPORTED_CITY_COORDINATES
        coordinate = SUPPORTED_CITY_COORDINATES.get(str(city["id"]))
        if not coordinate:
            raise HTTPException(422, "지원 도시 좌표를 찾을 수 없습니다")
        lat, lng = coordinate
        return {
            "city": city["city"],
            "country": city["country"],
            "country_code": city["country_id"],
            "lat": lat,
            "lng": lng,
            "verified_method": "nnai_supported_city_selected",
            "supported_city_id": city["id"],
            "is_supported_city": True,
            "location_source": "nnai_supported",
            "line_style": "solid",
            "geocode_place_id": None,
            "geocode_confidence": None,
            "geocoded_at": None,
        }
    if stop.geocode_result_id:
        result = get_cached_geocode_result(stop.geocode_result_id)
        if not result:
            raise HTTPException(422, "검증된 도시 검색 결과가 만료되었습니다")
        return {
            "city": result["city"],
            "country": result["country"],
            "country_code": result["country_code"],
            "lat": result["lat"],
            "lng": result["lng"],
            "verified_method": "backend_geocoded_unsupported",
            "supported_city_id": None,
            "is_supported_city": False,
            "location_source": result["location_source"],
            "line_style": "dashed",
            "geocode_place_id": result.get("geocode_place_id"),
            "geocode_confidence": result.get("geocode_confidence"),
            "geocoded_at": datetime.now(timezone.utc),
        }
    return {
        "city": stop.city,
        "country": stop.country,
        "country_code": stop.country_code,
        "lat": stop.lat,
        "lng": stop.lng,
        "verified_method": "gps_city_confirmed",
        "supported_city_id": None,
        "is_supported_city": False,
        "location_source": "legacy",
        "line_style": "solid",
        "geocode_place_id": None,
        "geocode_confidence": None,
        "geocoded_at": None,
    }
```

Replace the `INSERT` column list and return list to include metadata columns.

- [ ] **Step 6: Update list and community queries**

In `list_my_journey`, select:

```sql
supported_city_id, is_supported_city, location_source, line_style,
geocode_place_id, geocode_confidence, geocoded_at
```

In `community_journey`, suppress unsupported rows below threshold with a `HAVING` expression:

```sql
HAVING BOOL_OR(is_supported_city) OR COUNT(*) >= 3
```

Return:

```sql
MIN(supported_city_id) AS supported_city_id,
CASE WHEN BOOL_OR(is_supported_city) THEN 'solid' ELSE 'dashed' END AS line_style
```

- [ ] **Step 7: Run journey API tests**

Run:

```bash
SKIP_EXTERNAL_INIT=1 .venv/bin/pytest tests/test_journey_api.py -q
```

Expected: non-DB tests pass locally; DB-marked tests skip unless `TEST_DATABASE_URL` is set.

- [ ] **Step 8: Commit**

```bash
git add api/journey.py tests/test_journey_api.py
git commit -m "feat: add verified journey city saves"
```

---

### Task 4: Update Backend Docs

**Files:**
- Modify: `cowork/backend/api-reference.md`
- Modify: `cowork/backend/db-schema.md`

- [ ] **Step 1: Update API reference**

Add sections for:

```markdown
### POST /api/journey/geocode

Request:
```json
{"query":"Granada","country_code":"ES"}
```

Response includes `results[].supported`, `results[].supported_city_id`, `results[].geocode_result_id`, `results[].location_source`, and `attribution`.

### POST /api/journey/stops

Supported save:
```json
{"city_id":"LIS","note":"리스본"}
```

Unsupported verified save:
```json
{"geocode_result_id":"geo_...","note":"추억"}
```

Legacy save remains accepted for current frontend compatibility.
```

- [ ] **Step 2: Update DB schema doc**

Document new `nomad_journey_stops` columns:

```markdown
| supported_city_id | TEXT | NNAI-supported city id when selected |
| is_supported_city | BOOLEAN | true for canonical supported city saves |
| location_source | TEXT | `legacy`, `nnai_supported`, `nominatim` |
| line_style | TEXT | `solid` or `dashed` |
| geocode_place_id | TEXT | provider place id for unsupported city |
| geocode_confidence | DOUBLE PRECISION | provider confidence/importance |
| geocoded_at | TIMESTAMPTZ | backend geocoding verification time |
```

- [ ] **Step 3: Commit**

```bash
git add cowork/backend/api-reference.md cowork/backend/db-schema.md
git commit -m "docs: update journey geocoding contracts"
```

---

### Task 5: Final Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run backend regression target**

Run:

```bash
SKIP_EXTERNAL_INIT=1 .venv/bin/pytest tests/test_journey_api.py tests/test_db.py -q
```

Expected: pass, with DB-backed tests skipped if `TEST_DATABASE_URL` is not configured.

- [ ] **Step 2: Run CI syntax command**

Run:

```bash
python -m py_compile app.py server.py recommender.py api/parser.py api/detail_cache.py api/journey.py prompts/builder.py api/visits.py utils/geocoding.py
```

Expected: no output and exit 0.

- [ ] **Step 3: Check no Louie-owned frontend components changed**

Run:

```bash
git diff --name-only origin/develop..HEAD
```

Expected: no `frontend/src/components/` files.

- [ ] **Step 4: Push develop**

Run:

```bash
git push origin develop
```

Expected: remote `develop` updates successfully.
