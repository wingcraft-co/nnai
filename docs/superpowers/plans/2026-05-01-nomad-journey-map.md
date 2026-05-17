# Nomad Journey Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace saved-city pins with a GPS-confirmed Nomad Journey Map easter egg opened from the pixel globe.

**Architecture:** Add a separate `nomad_journey_stops` backend model/API and remove the old `pins` surface completely. Keep the frontend integration narrow by adding one modal component and one click handler around the existing globe.

**Tech Stack:** FastAPI, PostgreSQL/psycopg2, pytest, Next.js 16 App Router, TypeScript, Tailwind CSS.

---

## File Structure

- Create `api/journey.py`: authenticated personal journey endpoints and public aggregate endpoint.
- Create `tests/test_journey_api.py`: API behavior tests replacing pins API coverage.
- Modify `utils/db.py`: drop old `pins` table, create `nomad_journey_stops`, update required schema checks.
- Modify `tests/test_db.py`: assert journey schema and note-length constraint, no pins dependency.
- Delete `api/pins.py` and `tests/test_pins_api.py`.
- Modify `server.py`: remove pins router, include journey router.
- Modify `api/mobile_discover.py`: remove mobile pins request model and endpoints.
- Modify `api/mobile_profile.py` and `tests/test_mobile_contract_api.py`: remove `stats.pins`, expose `stats.journey_stops`.
- Modify `.github/workflows/main-tests.yml`: replace `tests/test_pins_api.py` with `tests/test_journey_api.py`, add `api/journey.py` to syntax check.
- Create `frontend/src/components/journey/NomadJourneyModal.tsx`: self-contained modal, SVG map, GPS-city confirmation UI, personal route, aggregate toggles.
- Modify `frontend/src/app/[locale]/page.tsx`: add globe click handler and mount modal.
- Modify `frontend/src/app/[locale]/dev/page.tsx`: remove old pins playground section and replace summary wording with journey aggregate status only if needed.
- Modify `frontend/src/lib/pricing-content.mjs`: remove saved pins pricing copy.
- Modify `cowork/backend/api-reference.md` and `cowork/backend/db-schema.md`: remove pins docs and add journey docs/schema.

## Task 1: Journey API And DB Schema

**Files:**
- Create: `api/journey.py`
- Create: `tests/test_journey_api.py`
- Modify: `utils/db.py`
- Modify: `tests/test_db.py`
- Modify: `server.py`
- Delete: `api/pins.py`
- Delete: `tests/test_pins_api.py`

- [ ] **Step 1: Write failing journey API tests**

Create `tests/test_journey_api.py` with tests for auth, create, note length, personal isolation, community aggregate, persona aggregate, and old pins route removal.

- [ ] **Step 2: Run tests and verify RED**

Run: `SKIP_EXTERNAL_INIT=1 .venv/bin/pytest tests/test_journey_api.py -v`
Expected: fail because `api.journey` does not exist.

- [ ] **Step 3: Implement `api/journey.py`**

Add `JourneyStopIn`, `_user_id`, `list_my_stops`, `create_stop`, and `community_stops`. `POST /journey/stops` must read the user's current `persona_type` from `users` and store city-center coordinates only.

- [ ] **Step 4: Replace pins schema with journey schema**

In `utils/db.py`, remove `pins` from `_REQUIRED_SCHEMA_TABLES`, add `nomad_journey_stops`, add required columns, execute `DROP TABLE IF EXISTS pins;`, and create the new table/indexes.

- [ ] **Step 5: Mount journey router and remove pins router**

Update `server.py` imports/includes and delete `api/pins.py`.

- [ ] **Step 6: Update DB tests**

Change `tests/test_db.py` to insert/fetch `nomad_journey_stops`, assert `pins` is absent after `init_db`, and assert note length over 10 characters fails.

- [ ] **Step 7: Run backend focused tests**

Run: `SKIP_EXTERNAL_INIT=1 .venv/bin/pytest tests/test_journey_api.py tests/test_db.py -v`
Expected: pass, or skip DB tests when `TEST_DATABASE_URL` is absent.

- [ ] **Step 8: Commit backend API/schema**

Commit message: `feat: add nomad journey API`

## Task 2: Remove Pins From Mobile, CI, And Pricing Copy

**Files:**
- Modify: `api/mobile_discover.py`
- Modify: `api/mobile_profile.py`
- Modify: `tests/test_mobile_contract_api.py`
- Modify: `.github/workflows/main-tests.yml`
- Modify: `frontend/src/lib/pricing-content.mjs`

- [ ] **Step 1: Write failing mobile contract expectation**

Update `tests/test_mobile_contract_api.py` so profile stats require `journey_stops`, `posts`, and `circles`, and no longer require `pins`.

- [ ] **Step 2: Run focused mobile contract test and verify RED**

Run: `SKIP_EXTERNAL_INIT=1 .venv/bin/pytest tests/test_mobile_contract_api.py::test_profile_includes_required_persona_type_field -v`
Expected: fail while `api/mobile_profile.py` still returns `stats.pins`.

- [ ] **Step 3: Remove mobile pins routes**

Delete `PinCreate` and `/api/mobile/pins` handlers from `api/mobile_discover.py`.

- [ ] **Step 4: Replace profile pin count**

In `api/mobile_profile.py`, count `nomad_journey_stops` and return `stats.journey_stops`.

- [ ] **Step 5: Update CI and pricing copy**

Replace `tests/test_pins_api.py` with `tests/test_journey_api.py` in `.github/workflows/main-tests.yml`, add `api/journey.py` to syntax check, and remove saved-pins claims from pricing copy.

- [ ] **Step 6: Run focused checks**

Run: `SKIP_EXTERNAL_INIT=1 .venv/bin/pytest tests/test_mobile_contract_api.py::test_profile_includes_required_persona_type_field -v`
Run: `node --test --experimental-strip-types frontend/src/lib/pricing-content.test.mjs`

- [ ] **Step 7: Commit removal cleanup**

Commit message: `fix: remove legacy pins surfaces`

## Task 3: Frontend Journey Modal

**Files:**
- Create: `frontend/src/components/journey/NomadJourneyModal.tsx`
- Modify: `frontend/src/app/[locale]/page.tsx`
- Modify: `frontend/src/app/[locale]/dev/page.tsx`

- [ ] **Step 1: Add the self-contained modal**

Create a client component with local state for auth, personal stops, community aggregates, persona aggregates, GPS status, selected city, note, and view toggles. Use a simple vector SVG map projection helper for v1.

- [ ] **Step 2: Add globe click integration**

In `frontend/src/app/[locale]/page.tsx`, wrap the existing globe image in a button and mount `NomadJourneyModal`.

- [ ] **Step 3: Remove dev pins playground**

In `frontend/src/app/[locale]/dev/page.tsx`, remove old pins state/effects/actions/section and update stats labels so no `/api/pins` calls remain.

- [ ] **Step 4: Run frontend build**

Run: `npm run build` from `frontend`.
Expected: build succeeds.

- [ ] **Step 5: Commit frontend modal**

Commit message: `feat: add nomad journey map modal`

## Task 4: Backend Documentation

**Files:**
- Modify: `cowork/backend/api-reference.md`
- Modify: `cowork/backend/db-schema.md`

- [ ] **Step 1: Update API docs**

Remove the pins endpoint section and document:
`GET /api/journey/me`, `POST /api/journey/stops`, and `GET /api/journey/community`.

- [ ] **Step 2: Update DB docs**

Remove the `pins` table and add `nomad_journey_stops`, including the note length constraint and explicit `DROP TABLE IF EXISTS pins;` migration intent.

- [ ] **Step 3: Run docs-relevant search**

Run: `rg -n "/api/pins|\\bpins\\b|Saved pins|저장 핀|관심 도시 핀" cowork/backend .github api utils tests frontend/src`
Expected: no active backend/frontend/test references to legacy pins, except intentional historical docs outside touched scope if any.

- [ ] **Step 4: Commit docs**

Commit message: `docs: document nomad journey API`

## Task 5: Final Verification

- [ ] **Step 1: Run backend regression suite**

Run: `SKIP_EXTERNAL_INIT=1 .venv/bin/pytest tests/ -v`

- [ ] **Step 2: Run frontend build**

Run: `npm run build` from `frontend`.

- [ ] **Step 3: Review diff**

Run: `git status -sb` and `git diff --stat develop...HEAD`.

- [ ] **Step 4: Finish branch**

Use `superpowers:finishing-a-development-branch` to decide whether to push/open PR.
