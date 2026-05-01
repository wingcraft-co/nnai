# Journey Unsupported City Search Design

## Summary

Extend the existing Nomad Journey drilldown so users can still place a flag when their city is not in the NNAI-supported city list.

The primary flow remains:

1. Select continent.
2. Select country.
3. See NNAI-supported cities in that country first.
4. Select a supported city and save a normal journey stop.

The new fallback flow is:

1. Select continent.
2. Select country.
3. Search for a city not shown in the supported list.
4. Backend verifies that the city exists and belongs to the selected country.
5. User places and saves a travel-log-only flag.
6. Later journey lines involving that unsupported stop render as dashed lines.

Unsupported cities are saved only as journey log locations. They must not be treated as NNAI-supported recommendation, visa, budget, tax, or city detail destinations.

## Product Intent

The map should feel forgiving without making the recommendation dataset look broader than it is.

Supported cities are still the trusted NNAI set. Unsupported searched cities are real-world locations that let users complete their personal log. The UI should make this distinction visible but not punitive:

- Supported city: normal city card, NNAI metadata, normal solid journey connection.
- Unsupported verified city: compact search result, "여행 로그용 위치" state, dashed journey connection.

## Current Context

Relevant existing files:

- `docs/specs/2026-05-01-journey-map-drilldown-design.md`
  - Defines continent -> country -> supported city flow.
- `frontend/src/lib/journey-map.mjs`
  - Owns supported city coordinates, country grouping helpers, projection helpers, and GPS matching.
- `frontend/src/lib/journey-map.test.mjs`
  - Covers supported city option construction and drilldown helpers.
- `api/journey.py`
  - Saves and lists user journey stops.
- `utils/db.py`
  - Owns PostgreSQL DDL for `nomad_journey_stops`.
- `tests/test_journey_api.py`
  - Covers auth, save, list, and community aggregation behavior.
- `cowork/backend/api-reference.md`
  - Must be updated if journey/geocoding API contracts change.
- `cowork/backend/db-schema.md`
  - Must be updated if `utils/db.py` DDL changes.

Frontend UI components under `frontend/src/components/` are owned by Louie and are out of scope for this backend-focused implementation pass.

## Recommended Architecture

Add backend support for verified unsupported city search and enrich journey stop records with enough metadata for the frontend to render line style.

### New Backend Geocoding API

Add a public-but-rate-limited endpoint:

```text
POST /api/journey/geocode
```

Request:

```json
{
  "query": "Granada",
  "country_code": "ES"
}
```

Response:

```json
{
  "query": "Granada",
  "country_code": "ES",
  "results": [
    {
      "city": "Granada",
      "country": "Spain",
      "country_code": "ES",
      "lat": 37.1773,
      "lng": -3.5986,
      "supported": false,
      "supported_city_id": null,
      "geocode_result_id": "geo_abc123",
      "location_source": "nominatim",
      "display_name": "Granada, Andalusia, Spain"
    }
  ],
  "attribution": "Geocoding data from OpenStreetMap contributors"
}
```

If a result matches an existing supported city in `city_scores.json`, return:

```json
{
  "city": "Lisbon",
  "country": "Portugal",
  "country_code": "PT",
  "lat": 38.7223,
  "lng": -9.1393,
  "supported": true,
  "supported_city_id": "LIS",
  "geocode_result_id": null,
  "location_source": "nnai_supported",
  "display_name": "Lisbon, Portugal"
}
```

### Provider Strategy

Use a provider abstraction so the app is not locked to one external service:

- `utils/geocoding.py`
  - validates query/country input
  - checks supported city matches first
  - calls configured external provider only on explicit search
  - normalizes provider results
  - filters to populated places/city-like results where provider metadata supports it
  - filters to the requested ISO-2 country code
  - caches query results in memory for the running process
  - issues a short-lived `geocode_result_id` for unsupported provider results

Default provider can be OpenStreetMap Nominatim because it can verify global city existence and coordinates without exposing a browser-side key. Its public service policy requires no autocomplete, no heavy use, maximum 1 request per second, valid identifying User-Agent or Referer, attribution, and caching. The endpoint therefore must run only on explicit search submit, not on every keystroke.

If a production-grade paid geocoder is added later, it can replace the provider behind the same endpoint.

### Journey Stop Metadata

Add metadata to `nomad_journey_stops`:

- `supported_city_id TEXT NULL`
- `is_supported_city BOOLEAN NOT NULL DEFAULT FALSE`
- `location_source TEXT NOT NULL DEFAULT 'legacy'`
- `line_style TEXT NOT NULL DEFAULT 'solid'`
- `geocode_place_id TEXT NULL`
- `geocode_confidence DOUBLE PRECISION NULL`
- `geocoded_at TIMESTAMPTZ NULL`

Add coordinate checks in DB DDL:

- `lat BETWEEN -90 AND 90`
- `lng BETWEEN -180 AND 180`

Rules:

- Supported NNAI city stop:
  - `supported_city_id`: city id such as `LIS`
  - `is_supported_city`: `TRUE`
  - `location_source`: `nnai_supported`
  - `line_style`: `solid`
- Unsupported verified city stop:
  - `supported_city_id`: `NULL`
  - `is_supported_city`: `FALSE`
  - `location_source`: provider id such as `nominatim`
  - `line_style`: `dashed`
- Legacy rows:
  - `supported_city_id`: `NULL`
  - `is_supported_city`: `FALSE`
  - `location_source`: `legacy`
  - `line_style`: `solid`

This avoids breaking old data while giving Louie's frontend a direct rendering flag.

### Save API Contract

Change `POST /api/journey/stops` so the backend does not trust browser-supplied city/country/coordinates for new saves.

Supported city request:

```json
{
  "city_id": "LIS",
  "note": "추억"
}
```

Unsupported verified city request:

```json
{
  "geocode_result_id": "geo_abc123",
  "note": "추억"
}
```

Backend lookup rules:

- If `city_id` is present, load canonical city/country/coordinates from `city_scores.json`, set `is_supported_city = TRUE`, `location_source = nnai_supported`, and `line_style = solid`.
- If `geocode_result_id` is present, load canonical city/country/coordinates from the backend geocode cache, verify the result is unexpired and belongs to the current normalized query result set, set `is_supported_city = FALSE`, provider metadata, and `line_style = dashed`.
- Reject requests that provide both `city_id` and `geocode_result_id`.
- Reject requests that provide neither.
- Keep accepting the legacy `city/country/country_code/lat/lng` body only if needed for backward compatibility, but classify it as `location_source = legacy` and `line_style = solid`.

The response from `POST /api/journey/stops` and `GET /api/journey/me` includes:

```json
{
  "id": 123,
  "city": "Granada",
  "country": "Spain",
  "country_code": "ES",
  "lat": 37.1773,
  "lng": -3.5986,
  "note": "추억",
  "persona_type": "planner",
  "verified_method": "city_search_verified",
  "supported_city_id": null,
  "is_supported_city": false,
  "location_source": "nominatim",
  "line_style": "dashed",
  "created_at": "2026-05-02T..."
}
```

For supported city saves, `verified_method` can remain `gps_city_confirmed` for existing GPS flows or become `nnai_supported_city_selected` for direct supported picker saves. Do not rely on `verified_method` for line rendering; use `line_style`.

### Community API Contract

Extend `GET /api/journey/community` rows with:

```json
{
  "city": "Granada",
  "country": "Spain",
  "country_code": "ES",
  "lat": 37.1773,
  "lng": -3.5986,
  "cnt": 3,
  "supported_city_id": null,
  "line_style": "dashed"
}
```

Aggregation rule:

- unsupported stops are excluded from public community aggregates until they meet a k-anonymity threshold of at least `cnt >= 3`
- supported city groups return `solid`
- unsupported city groups that pass the threshold return `dashed`

The community response must continue excluding user ids, notes, emails, and names.

## User Experience Contract For Louie's Frontend

After country selection:

- render supported city list first
- render unsupported search as a secondary fallback
- do not call geocoding while typing
- call geocoding only when user presses Enter or clicks search
- show a loading state tied to the single submitted query
- show "지원 도시가 아니므로 여행 로그용 위치로 저장됩니다" for unsupported verified city results
- show a dashed preview line/marker state for unsupported pending selection
- show normal solid preview for supported city selection
- save endpoint receives only `city_id` for supported cities or `geocode_result_id` for unsupported verified cities; it does not send coordinates back for persistence

Logged-out users:

- may browse continent/country/supported city lists
- may perform explicit city verification search subject to public rate limits
- may preview a flag
- must log in before saving

## Error Handling

Geocoding endpoint:

- query shorter than 2 characters: `422`
- invalid country code: `422`
- provider timeout: `503` with retryable message
- provider returns no city-like result in selected country: `200` with empty results
- provider rate limited: `429`
- unsupported provider configuration: `503`

Save endpoint:

- unauthenticated: existing `401`
- invalid coordinates: `422`
- unknown `city_id`: `422`
- expired or unknown `geocode_result_id`: `422`
- request contains both `city_id` and `geocode_result_id`: `422`
- request contains neither `city_id` nor `geocode_result_id`: `422`
- legacy coordinate body contains non-finite or out-of-range coordinates: `422`

## Security And Privacy

The external geocoder must never receive user identity, notes, email, session ids, or persona data. Send only:

- query text
- country code filter
- app-identifying User-Agent

The backend endpoint should:

- reuse existing endpoint rate limiting if possible
- add a stricter public geocoding bucket if existing rate limiting is too broad
- bound query length
- normalize and encode query parameters through structured HTTP client params
- use allowlisted provider URL only
- do not follow redirects to non-allowlisted hosts
- timeout quickly
- cap provider response size
- cache successful and empty results
- avoid logging full raw provider responses
- avoid long-term storage of raw free-text queries
- hash normalized query for abuse metrics when useful
- include attribution in the API response or expose a constant frontend can display

## Testing

Backend unit tests:

- supported city match returns `supported: true`, canonical coordinates, and `location_source: nnai_supported`
- unsupported provider result in selected country returns `supported: false` and provider coordinates
- provider result from a different country is filtered out
- short query is rejected
- unknown country code is rejected
- save supported city sets `line_style: solid`
- save unsupported verified city sets `line_style: dashed`
- save unsupported city with forged/expired `geocode_result_id` is rejected
- save request with both `city_id` and `geocode_result_id` is rejected
- invalid lat/lng values are rejected
- `GET /api/journey/me` includes new metadata fields
- `GET /api/journey/community` still excludes private fields, includes line style, and suppresses unsupported rows below the k-anonymity threshold

Frontend route helper work should be left to Louie unless explicitly handed off. The frontend will need per-segment route rendering instead of one all-or-nothing polyline:

- supported selected stop maps to solid line
- unsupported selected stop maps to dashed line
- mixed route segments use dashed when either endpoint is unsupported, if that is the desired visual rule

## Documentation

Because this changes API contracts and DB DDL, update in the same implementation:

- `cowork/backend/api-reference.md`
- `cowork/backend/db-schema.md`

If new backend tests are added, update `.github/workflows/main-tests.yml` according to project rules.

## Out Of Scope

- Editing `frontend/src/components/journey/NomadJourneyModal.tsx`
- Adding frontend UI for the search box
- Changing recommendation, visa, budget, tax, or city detail behavior
- Treating unsupported cities as supported city candidates
- Full GIS map engine
- Route optimization or itinerary planning
