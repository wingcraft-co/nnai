# Nomad Journey Map Design

Date: 2026-05-01
Branch: `feat/nomad-journey-map`

## Goal

Create a hidden Nomad Journey Map easter egg from the pixel globe. The feature lets logged-in users verify their current city, place a flag, write a short guestbook note, and see their authenticated nomad path over time. The public layer shows only anonymous city-level aggregates across NNAI users.

This replaces the existing saved-city `pins` feature. Existing `pins` data is intentionally discarded and must not be migrated into journey stops, because saved interest and verified presence mean different things.

## Product Behavior

Clicking the pixel globe opens an independent map modal over the existing page. The default view is "My Journey":

- Logged-in users see their verified city flags.
- Their stops are connected chronologically with a route line.
- Each personal flag can show the user's own note.
- Logged-out users can open the map, but placing a flag sends them to Google login.

The modal also includes a community toggle:

- Off by default.
- When enabled, it shows anonymous city-level counts such as "Kuala Lumpur 12".
- It never exposes individual users, exact GPS coordinates, or personal guestbook notes.
- A same-persona filter highlights city-level aggregates for users with the same `persona_type`.

## Location Verification

Version 1 uses "GPS + city confirmation":

1. Browser asks for geolocation permission.
2. The user confirms or selects the nearest city.
3. The backend stores the confirmed city center, not raw precise GPS coordinates.
4. A stop is accepted only for logged-in users.

This keeps the verification feeling real while avoiding precise-location storage and making the map visually clean.

## Data Model

Remove:

- `pins` table
- `/api/pins` endpoints
- mobile pins endpoints and `stats.pins`
- frontend/dev UI that tests or markets saved pins
- docs and tests for saved pins

Add:

```sql
CREATE TABLE IF NOT EXISTS nomad_journey_stops (
    id              SERIAL PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    city            TEXT NOT NULL,
    country         TEXT NOT NULL,
    country_code    TEXT,
    lat             DOUBLE PRECISION NOT NULL,
    lng             DOUBLE PRECISION NOT NULL,
    note            TEXT NOT NULL CHECK (char_length(note) <= 10),
    persona_type    TEXT,
    verified_method TEXT NOT NULL DEFAULT 'gps_city_confirmed',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nomad_journey_stops_user_created
ON nomad_journey_stops(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_nomad_journey_stops_city
ON nomad_journey_stops(city, country);

CREATE INDEX IF NOT EXISTS idx_nomad_journey_stops_persona
ON nomad_journey_stops(persona_type);
```

No migration from `pins` is performed. Production migration should explicitly drop the old table:

```sql
DROP TABLE IF EXISTS pins;
```

The drop must be intentional and visible in migration/release notes, not hidden as a silent side effect.

## API

New endpoints:

- `GET /api/journey/me`
  - Requires login.
  - Returns the user's stops ordered by `created_at`.
  - Used for personal flags and route line.

- `POST /api/journey/stops`
  - Requires login.
  - Body includes confirmed city, country, city-center lat/lng, note, and optional country code.
  - Enforces note length of 10 characters or fewer.
  - Captures the user's current `persona_type` on write.

- `GET /api/journey/community`
  - Public.
  - Returns city-level aggregate counts.
  - Optional `persona_type` query param returns city-level aggregate counts for that persona.
  - Does not return individual stop ids, user ids, raw notes, or exact GPS traces.

Removed endpoints:

- `GET /api/pins`
- `POST /api/pins`
- `PUT /api/pins/{pin_id}`
- `DELETE /api/pins/{pin_id}`
- `GET /api/pins/community`
- `/api/mobile/pins` equivalents

Because backend API and DB schema change, update both:

- `cowork/backend/api-reference.md`
- `cowork/backend/db-schema.md`

## Frontend Design

Respect Louis's frontend ownership by keeping the integration narrow:

- Add only a click handler around the existing globe.
- Add a self-contained `NomadJourneyModal` component.
- Add a small API client for journey endpoints if useful.
- Avoid broad page layout refactors, styling rewrites, or unrelated component changes.

The map should be vector-based and modal-scoped. It can start with a lightweight SVG/world-map rendering and evolve later. The initial modal should support:

- My Journey view
- community aggregate toggle
- same-persona highlight toggle/filter
- locate/verify city flow
- 10-character note input
- login prompt for unauthenticated flag placement

## Privacy And Safety

- Store only confirmed city-center coordinates in version 1.
- Do not expose raw user coordinates.
- Do not expose individual public guestbook notes.
- Public and same-persona views are aggregate only.
- Treat note text as user input; validate length server-side and render safely client-side.

## Tests

Backend tests should cover:

- unauthenticated users cannot create stops
- authenticated users can create stops
- note length over 10 characters is rejected
- `GET /api/journey/me` returns only the current user's stops in chronological order
- community endpoint returns city-level counts only
- persona filter returns aggregate counts only
- removed pins endpoints are no longer mounted

DB tests should cover:

- `nomad_journey_stops` exists
- `pins` is no longer part of the required schema
- note length check is represented in DDL

Frontend build verification:

- `cd frontend && npm run build`

Backend verification:

- `SKIP_EXTERNAL_INIT=1 .venv/bin/pytest tests/ -v`

If new test files are added, update `.github/workflows/main-tests.yml`.

## Out Of Scope For Version 1

- migrating existing pins data
- public individual user flags
- public guestbook notes
- photo or passport-style verification
- real-time updates
- moderation/reporting workflows
- exact GPS trace storage
- chat or social graph features
