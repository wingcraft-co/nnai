# Journey Map Drilldown Design

## Summary

Replace the current search-first Nomad Journey modal with a simple map-first drilldown:

1. User clicks the pixel globe on the home page.
2. The journey modal opens on a simplified world map with continent bubbles.
3. User selects a continent.
4. The map zooms/focuses to that continent and shows supported countries only.
5. User selects a country.
6. A city picker shows only NNAI-supported cities in that country.
7. User selects a city and sees a flag preview on the map.
8. User saves the flag as part of their digital nomad log.

The key UX goal is to remove the need to manually search for a city. The interaction should feel closer to finding listings on a map: visible regions, tap targets, progressive narrowing, and a clear selected-state panel.

## Product Intent

The feature should make the journey map feel like a playful extension of the existing pixel-art globe, not a form.

Primary logged-out CTA copy:

> 내 발자취를 남기고 저장해서  
> 나만의 디지털노마드 log를 완성해보세요.

CTA behavior:

- Logged out: `로그인하고 내 log 저장하기`
- Logged in: `깃발 꽂기`

The journey represents places the user has already left a nomad footprint in. Wishlist behavior is out of scope for this version.

## Current Context

Relevant files:

- `frontend/src/app/[locale]/page.tsx`
  - Home page renders the pixel globe and opens `NomadJourneyModal`.
- `frontend/src/components/journey/NomadJourneyModal.tsx`
  - Current modal uses a static world map, city search, GPS confirmation, community overlay, and save CTA.
- `frontend/src/lib/journey-map.mjs`
  - Builds city options from `city_scores.json`, owns city coordinates, search helpers, and map projection.
- `frontend/src/data/city_scores.json`
  - Source of supported cities and countries.
- `api/journey.py`
  - Existing backend endpoints already save journey stops as city-level rows.

The existing backend stores `city`, `country`, `country_code`, `lat`, `lng`, and `note`. This design keeps that contract. No database migration is required.

## Interaction Model

### Stage 1: Continent Overview

The modal opens with the same dark navy map atmosphere and pixel-globe continuity. The world map is visible but simplified.

Large continent bubbles appear over the map:

- Europe
- Asia
- Americas
- Middle East / Africa

Only continents that contain at least one supported city are active. Each bubble can show a small count such as `유럽 18`.

On click:

- `activeContinent` is set.
- The map visually focuses on that region.
- The side/bottom panel changes from intro CTA to country selection.

### Stage 2: Supported Country Selection

The selected continent view shows supported countries only. Countries are rendered as flag bubbles or compact country markers.

Country data is derived from supported city data:

- `country_code`
- `country`
- `continent`
- representative map point, computed from the average of supported city coordinates in that country
- supported city count

On country click:

- `activeCountryCode` is set.
- City list panel opens.
- The selected country marker is highlighted.

Countries that NNAI does not support should not be shown as selectable options in v1. This keeps the UI honest and avoids dead-end interactions.

### Stage 3: Supported City Selection

The city picker always appears after country selection, even if the country has only one supported city.

The panel shows:

- country flag and name
- supported city cards/list rows
- basic city metadata already available, when useful and compact:
  - Korean city name
  - English city name
  - monthly cost
  - nomad score

On city click:

- `selectedCityId` is set.
- A flag preview drops onto the city point.
- Clicking the same selected city again unsets the pending selection.

This unset behavior applies to the pending selection before save. Removing already saved stops is not included in this version because the current backend has no delete endpoint for journey stops.

### Stage 4: Save

When a pending city is selected:

- Logged out users see the promotional copy and login CTA.
- Logged in users can save the selected city as a journey stop.

Save uses the existing `POST /api/journey/stops` endpoint with:

- `city`
- `country`
- `country_code`
- `lat`
- `lng`
- `note`

The existing 10-character note field can remain, but it should be visually secondary. The main action is selecting and saving a flag.

## Layout

Use a map-first layout.

Desktop:

- Full modal map canvas.
- Top window-style title bar remains.
- Right-side panel shows current stage and CTA.
- Map remains visible behind all stages.

Mobile:

- Full modal map canvas.
- Bottom sheet shows current stage.
- Bottom sheet should not cover more than roughly half the viewport unless expanded by scroll.

The existing search input should be removed from the primary flow. If retained, it should be a small fallback control, not the main interaction.

## Visual Direction

Keep the current NNAI style:

- deep navy background `#1a1a2e`
- warm paper panel `#fffaf2`
- accent orange `#d1842c`
- serif headings
- pixel-art continuity from `/earth_web.gif`
- existing low-resolution world map asset if it still reads well

Avoid a high-fidelity GIS look. The map should feel intentionally simple, playful, and scannable.

Marker behavior:

- continent: large translucent circles
- country: flag bubble or compact circle with flag
- selected country: orange ring or filled state
- selected city: dropped flag preview
- saved stops: persistent orange flag markers

## Component Design

Refactor `NomadJourneyModal` into smaller internal pieces or sibling components:

- `JourneyMapCanvas`
  - renders map asset, overlays, saved stops, pending city flag
- `ContinentSelector`
  - renders continent bubbles
- `CountrySelector`
  - renders supported country markers for active continent
- `CitySelectorPanel`
  - renders supported cities for active country
- `JourneySavePanel`
  - renders note, login/save CTA, status text

`NomadJourneyModal` should own state and API calls:

- `activeContinent`
- `activeCountryCode`
- `selectedCityId`
- `note`
- `auth`
- `myStops`
- `community`
- `showCommunity`
- `showPersona`

## Data Helpers

Extend `frontend/src/lib/journey-map.mjs` with pure helpers:

- `buildJourneyCountryOptions(cityOptions)`
- `filterJourneyCountriesByContinent(countryOptions, continent)`
- `filterJourneyCitiesByCountry(cityOptions, countryCode)`
- `getJourneyContinentCounts(countryOptions)`

Add a country-to-continent map for supported countries only. This should live near the journey map helpers rather than in the component.

The existing city coordinate table remains the source of city marker positions.

## Analytics

If analytics helpers are available, add non-PII events later in implementation:

- `journey_map_open`
- `journey_continent_select`
- `journey_country_select`
- `journey_city_select`
- `journey_save_click`
- `journey_save_success`

Event props should be enum/small strings only:

- `continent`
- `country_code`
- `city_id`
- `logged_in`

No notes, names, emails, or free text should be captured.

## Error Handling

Expected states:

- auth fetch fails: treat as logged out
- community fetch fails: hide community overlay without blocking map
- save returns 401: redirect to Google login
- save returns 422: show note length validation message
- save fails otherwise: show a short retry message

If a country has no supported cities due to data mismatch, do not render that country as selectable.

## Accessibility

All map markers must be real buttons, not only SVG shapes.

Required labels:

- continent button: `유럽 선택`
- country button: `Portugal 선택, 지원 도시 2개`
- city button: `Lisbon 선택`
- selected city button: `Lisbon 선택 해제`

Keyboard users should be able to move through the same flow:

- Tab through continent markers
- Enter/Space to select
- Back button in panel to return to the previous stage
- Escape closes the modal, preserving current behavior

## Testing

Add or update focused frontend tests where practical:

- `buildJourneyCountryOptions` groups supported cities by country.
- continent counts include only countries with supported cities.
- filtering by country returns only that country's supported cities.
- selecting the same city twice clears pending selection.

Manual verification:

- Open home page and click pixel globe.
- Select a continent.
- Select a country.
- Confirm the city list always appears, including one-city countries.
- Select and unset a city.
- Logged-out save CTA redirects to Google login.
- Logged-in save uses existing journey endpoint.
- Mobile viewport keeps map and bottom sheet usable.

Run:

- `cd frontend && npm run build`

If backend files are not changed, backend pytest is not required. If any API or DB behavior changes during implementation, update `cowork/backend/api-reference.md` or `cowork/backend/db-schema.md` as required by `AGENTS.md`.

## Out Of Scope

- Wishlist countries.
- Saving country-only journey stops.
- Deleting already saved journey stops.
- Adding unsupported countries as requestable destinations.
- Backend schema migration.
- Replacing the world map asset with a full GIS map engine.

## Open Implementation Notes

- The current community overlay is city-based. It can remain city-based and appear after continent/country selection, or be aggregated visually by country later.
- GPS confirmation can remain as a secondary button, but it should not dominate the new map-first flow.
- Duplicate saved stops should be visually discouraged in the frontend by marking already saved cities. Backend uniqueness can be considered later if needed.
