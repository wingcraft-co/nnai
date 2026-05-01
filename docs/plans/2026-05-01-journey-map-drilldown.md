# Journey Map Drilldown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the search-first Nomad Journey modal with a continent -> supported country -> supported city map drilldown while keeping journey saves city-based.

**Architecture:** Keep the existing backend contract and `NomadJourneyModal` entry point. Add pure journey-map grouping helpers in `frontend/src/lib/journey-map.mjs`, cover them with Node tests, then refactor the modal render flow around stage state (`continent`, `country`, `city`) and existing API calls.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, lucide-react, Node test runner for `.mjs` helpers.

---

### Task 1: Journey Map Data Helpers

**Files:**
- Modify: `frontend/src/lib/journey-map.mjs`
- Modify: `frontend/src/lib/journey-map.test.mjs`

- [ ] **Step 1: Add failing tests for supported country and continent helpers**

Add these imports to `frontend/src/lib/journey-map.test.mjs`:

```js
import {
  buildJourneyCityOptions,
  buildJourneyCountryOptions,
  filterJourneyCitiesByCountry,
  filterJourneyCountriesByContinent,
  getJourneyContinentCounts,
  findJourneyCitySearchMatch,
  filterJourneyCities,
  projectJourneyPoint,
  resolveJourneyLocation,
} from './journey-map.mjs';
```

Replace the existing import block with the above, then append:

```js
test('groups supported cities into journey country options', () => {
  const cities = buildJourneyCityOptions(cityScores);
  const countries = buildJourneyCountryOptions(cities);
  const portugal = countries.find((country) => country.country_code === 'PT');

  assert.equal(portugal.country, 'Portugal');
  assert.equal(portugal.continent, 'Europe');
  assert.equal(portugal.city_count, 2);
  assert.deepEqual(portugal.city_ids, ['LIS', 'PTO']);
  assert.equal(Number.isFinite(portugal.lat), true);
  assert.equal(Number.isFinite(portugal.lng), true);
});

test('filters supported countries and cities by drilldown selection', () => {
  const cities = buildJourneyCityOptions(cityScores);
  const countries = buildJourneyCountryOptions(cities);

  assert.equal(filterJourneyCountriesByContinent(countries, 'Europe').some((country) => country.country_code === 'PT'), true);
  assert.equal(filterJourneyCountriesByContinent(countries, 'Asia').some((country) => country.country_code === 'PT'), false);
  assert.deepEqual(filterJourneyCitiesByCountry(cities, 'PT').map((city) => city.id), ['LIS', 'PTO']);
});

test('counts active continents from supported countries only', () => {
  const cities = buildJourneyCityOptions(cityScores);
  const countries = buildJourneyCountryOptions(cities);
  const counts = getJourneyContinentCounts(countries);

  assert.equal(counts.Europe > 0, true);
  assert.equal(counts.Asia > 0, true);
  assert.equal(counts.Americas > 0, true);
  assert.equal(counts.Africa > 0, true);
  assert.equal(counts.Oceania, undefined);
});
```

- [ ] **Step 2: Run helper tests and verify they fail for missing exports**

Run:

```bash
cd frontend && node --test src/lib/journey-map.test.mjs
```

Expected: fail with an export error for `buildJourneyCountryOptions`.

- [ ] **Step 3: Add country/continent helpers**

In `frontend/src/lib/journey-map.mjs`, add a supported country continent map after `ISO3_ALIAS`:

```js
const COUNTRY_CONTINENTS = {
  AR: "Americas",
  AT: "Europe",
  AE: "Middle East",
  CO: "Americas",
  CR: "Americas",
  CY: "Europe",
  CZ: "Europe",
  DE: "Europe",
  EE: "Europe",
  ES: "Europe",
  GE: "Europe",
  GR: "Europe",
  HR: "Europe",
  HU: "Europe",
  ID: "Asia",
  IT: "Europe",
  JP: "Asia",
  MA: "Africa",
  MK: "Europe",
  MX: "Americas",
  MY: "Asia",
  NL: "Europe",
  PE: "Americas",
  PH: "Asia",
  PL: "Europe",
  PT: "Europe",
  PY: "Americas",
  QA: "Middle East",
  RS: "Europe",
  TH: "Asia",
  TR: "Europe",
  TW: "Asia",
  US: "Americas",
  VN: "Asia",
};
```

Add exports near the other helper exports:

```js
export function buildJourneyCountryOptions(cityOptions) {
  const byCountry = new Map();

  for (const city of cityOptions ?? []) {
    const countryCode = String(city.country_code ?? "").toUpperCase();
    const continent = COUNTRY_CONTINENTS[countryCode];
    if (!countryCode || !continent) continue;

    const current = byCountry.get(countryCode) ?? {
      country: city.country,
      country_code: countryCode,
      continent,
      city_count: 0,
      city_ids: [],
      latTotal: 0,
      lngTotal: 0,
    };

    current.city_count += 1;
    current.city_ids.push(city.id);
    current.latTotal += Number(city.lat);
    current.lngTotal += Number(city.lng);
    byCountry.set(countryCode, current);
  }

  return [...byCountry.values()]
    .map((country) => ({
      country: country.country,
      country_code: country.country_code,
      continent: country.continent,
      city_count: country.city_count,
      city_ids: country.city_ids,
      lat: country.latTotal / country.city_count,
      lng: country.lngTotal / country.city_count,
    }))
    .sort((a, b) => a.continent.localeCompare(b.continent) || a.country.localeCompare(b.country));
}

export function filterJourneyCountriesByContinent(countryOptions, continent) {
  return (countryOptions ?? []).filter((country) => country.continent === continent);
}

export function filterJourneyCitiesByCountry(cityOptions, countryCode) {
  const normalized = String(countryCode ?? "").toUpperCase();
  return (cityOptions ?? []).filter((city) => city.country_code === normalized);
}

export function getJourneyContinentCounts(countryOptions) {
  return (countryOptions ?? []).reduce((counts, country) => {
    counts[country.continent] = (counts[country.continent] ?? 0) + 1;
    return counts;
  }, {});
}
```

- [ ] **Step 4: Run helper tests and verify they pass**

Run:

```bash
cd frontend && node --test src/lib/journey-map.test.mjs
```

Expected: all tests pass.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add frontend/src/lib/journey-map.mjs frontend/src/lib/journey-map.test.mjs
git commit -m "feat: add journey map drilldown helpers"
```

### Task 2: Map-First Modal Drilldown

**Files:**
- Modify: `frontend/src/components/journey/NomadJourneyModal.tsx`
- Modify: `frontend/src/lib/analytics/events.ts`

- [ ] **Step 1: Add journey analytics helpers**

Add these types to `frontend/src/lib/analytics/events.ts`:

```ts
export type JourneyContinent = "Europe" | "Asia" | "Americas" | "Middle East" | "Africa";
```

Add these functions near the other tracking helpers:

```ts
export function trackJourneyMapOpen(): void {
  captureFullAnalyticsEvent("journey_map_open", {});
}

export function trackJourneyContinentSelect(continent: JourneyContinent): void {
  captureFullAnalyticsEvent("journey_continent_select", { continent });
}

export function trackJourneyCountrySelect(countryCode: string): void {
  captureFullAnalyticsEvent("journey_country_select", { country_code: countryCode });
}

export function trackJourneyCitySelect(cityId: string): void {
  captureFullAnalyticsEvent("journey_city_select", { city_id: cityId });
}

export function trackJourneySaveClick(loggedIn: boolean): void {
  captureFullAnalyticsEvent("journey_save_click", { logged_in: loggedIn });
}

export function trackJourneySaveSuccess(cityId: string): void {
  captureFullAnalyticsEvent("journey_save_success", { city_id: cityId });
}
```

- [ ] **Step 2: Refactor modal imports and types**

In `frontend/src/components/journey/NomadJourneyModal.tsx`, replace the journey-map import with:

```ts
import {
  buildJourneyCityOptions,
  buildJourneyCountryOptions,
  filterJourneyCitiesByCountry,
  filterJourneyCountriesByContinent,
  projectJourneyPoint,
  resolveJourneyLocation,
} from "@/lib/journey-map.mjs";
```

Add analytics imports:

```ts
import {
  type JourneyContinent,
  trackJourneyCitySelect,
  trackJourneyContinentSelect,
  trackJourneyCountrySelect,
  trackJourneyMapOpen,
  trackJourneySaveClick,
  trackJourneySaveSuccess,
} from "@/lib/analytics/events";
```

Replace the `JourneyCityOption` type with:

```ts
type JourneyContinentValue = JourneyContinent;

type JourneyCityOption = {
  id: string;
  city: string;
  city_kr: string;
  country: string;
  country_code: string;
  lat: number;
  lng: number;
  search_index: string;
  gps_confirmed?: boolean;
  gps_distance_km?: number;
};

type JourneyCountryOption = {
  country: string;
  country_code: string;
  continent: JourneyContinentValue;
  city_count: number;
  city_ids: string[];
  lat: number;
  lng: number;
};
```

Add:

```ts
const COUNTRY_OPTIONS = buildJourneyCountryOptions(CITY_OPTIONS) as JourneyCountryOption[];
const CONTINENT_MARKERS: Array<{ id: JourneyContinentValue; label: string; x: number; y: number; size: number }> = [
  { id: "Americas", label: "아메리카", x: 230, y: 310, size: 104 },
  { id: "Europe", label: "유럽", x: 493, y: 230, size: 92 },
  { id: "Africa", label: "아프리카", x: 514, y: 382, size: 86 },
  { id: "Middle East", label: "중동", x: 590, y: 330, size: 78 },
  { id: "Asia", label: "아시아", x: 710, y: 300, size: 112 },
];
```

- [ ] **Step 3: Replace search state with drilldown state**

Remove:

```ts
const [selectedCity, setSelectedCity] = useState<JourneyCityOption>(CITY_OPTIONS[0]);
const [cityQuery, setCityQuery] = useState("");
const lastSearchMatchRef = useRef("");
```

Add:

```ts
const [activeContinent, setActiveContinent] = useState<JourneyContinentValue | null>(null);
const [activeCountryCode, setActiveCountryCode] = useState<string | null>(null);
const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
const selectedCity = CITY_OPTIONS.find((city) => city.id === selectedCityId) ?? null;
```

Delete the `findJourneyCitySearchMatch` search effect. Keep GPS support as a secondary action, but update `requestLocation()` so it sets drilldown state:

```ts
setActiveContinent((COUNTRY_OPTIONS.find((country) => country.country_code === city.country_code)?.continent ?? null) as JourneyContinentValue | null);
setActiveCountryCode(city.country_code);
setSelectedCityId(city.id);
```

- [ ] **Step 4: Add drilldown selection helpers inside the component**

Add these derived values before `requestLocation()`:

```ts
const activeCountries = activeContinent
  ? filterJourneyCountriesByContinent(COUNTRY_OPTIONS, activeContinent) as JourneyCountryOption[]
  : [];
const activeCities = activeCountryCode
  ? filterJourneyCitiesByCountry(CITY_OPTIONS, activeCountryCode) as JourneyCityOption[]
  : [];
const activeCountry = activeCountryCode
  ? COUNTRY_OPTIONS.find((country) => country.country_code === activeCountryCode) ?? null
  : null;
const selectedPoint = selectedCity ? projectJourneyPoint(selectedCity.lat, selectedCity.lng) : null;
```

Add these handlers:

```ts
function selectContinent(continent: JourneyContinentValue) {
  setActiveContinent(continent);
  setActiveCountryCode(null);
  setSelectedCityId(null);
  trackJourneyContinentSelect(continent);
}

function selectCountry(country: JourneyCountryOption) {
  setActiveCountryCode(country.country_code);
  setSelectedCityId(null);
  trackJourneyCountrySelect(country.country_code);
}

function selectCity(city: JourneyCityOption) {
  setSelectedCityId((current) => {
    const next = current === city.id ? null : city.id;
    if (next) trackJourneyCitySelect(city.id);
    return next;
  });
}
```

- [ ] **Step 5: Replace search UI with continent/country/city panels**

In the side/bottom panel, replace the current `깃발 꽂기` search card with:

```tsx
<div className="border border-[#d8d0c4] bg-white p-3">
  <p className="mb-1 text-sm font-semibold text-[#1D1D1F]">내 발자취 남기기</p>
  <p className="mb-3 text-xs leading-relaxed text-[#756c60]">
    내 발자취를 남기고 저장해서 나만의 디지털노마드 log를 완성해보세요.
  </p>
  <button type="button" onClick={requestLocation} className="mb-3 inline-flex h-10 w-full items-center gap-2 border border-[#d8d0c4] bg-[#f7f1e8] px-3 text-left text-sm font-medium text-[#1D1D1F] transition-colors hover:bg-[#efe4d4]">
    <LocateFixed className="size-4" />
    현재 위치로 도시 찾기
  </button>

  {activeContinent && (
    <button type="button" onClick={() => { setActiveContinent(null); setActiveCountryCode(null); setSelectedCityId(null); }} className="mb-2 text-xs font-semibold text-[#756c60] hover:text-[#1D1D1F]">
      ← 대륙 다시 선택
    </button>
  )}

  {activeCountry && (
    <button type="button" onClick={() => { setActiveCountryCode(null); setSelectedCityId(null); }} className="mb-2 ml-3 text-xs font-semibold text-[#756c60] hover:text-[#1D1D1F]">
      ← 국가 다시 선택
    </button>
  )}

  {!activeContinent && (
    <p className="text-xs leading-relaxed text-[#756c60]">지도에서 대륙을 먼저 선택하세요.</p>
  )}

  {activeContinent && !activeCountry && (
    <div className="grid grid-cols-2 gap-2">
      {activeCountries.map((country) => (
        <button key={country.country_code} type="button" onClick={() => selectCountry(country)} className="border border-[#eadfd1] bg-[#fffaf2] px-3 py-2 text-left text-sm hover:bg-[#f7f1e8]">
          <span className="block font-semibold">{country.country}</span>
          <span className="text-xs text-[#756c60]">지원 도시 {country.city_count}개</span>
        </button>
      ))}
    </div>
  )}

  {activeCountry && (
    <div className="space-y-2">
      <div className="bg-[#f7f1e8] px-3 py-2 text-sm font-semibold text-[#1D1D1F]">
        {activeCountry.country} · 지원 도시 {activeCountry.city_count}개
      </div>
      {activeCities.map((city) => (
        <button key={city.id} type="button" onClick={() => selectCity(city)} className={`flex w-full items-center justify-between border px-3 py-2.5 text-left text-sm transition-colors ${selectedCityId === city.id ? "border-[#d1842c] bg-[#f1e2cc]" : "border-[#eadfd1] bg-white hover:bg-[#f7f1e8]"}`} aria-label={selectedCityId === city.id ? `${city.city} 선택 해제` : `${city.city} 선택`}>
          <span>
            <span className="font-semibold">{city.city_kr}</span>
            <span className="ml-1 text-xs text-[#756c60]">{city.city}</span>
          </span>
          <span className="text-xs font-semibold text-[#d1842c]">{city.country_code}</span>
        </button>
      ))}
    </div>
  )}
</div>
```

Then render note and save button only when `selectedCity` exists.

- [ ] **Step 6: Replace map markers with drilldown buttons**

Inside the SVG, add continent buttons when no continent is active:

```tsx
{!activeContinent && CONTINENT_MARKERS.map((marker) => (
  <g key={marker.id} transform={`translate(${marker.x} ${marker.y})`}>
    <circle r={marker.size / 2} fill="currentColor" className="text-[#d1842c]" opacity="0.18" />
    <circle r={marker.size / 2 - 3} fill="none" stroke="currentColor" strokeWidth="2" className="text-[#fffaf2]" opacity="0.55" />
    <text textAnchor="middle" y="4" fontSize="13" fontWeight="800" fill="currentColor" className="text-[#fffaf2]">{marker.label}</text>
  </g>
))}
```

Because SVG `g` keyboard accessibility is weak, overlay matching absolutely positioned HTML buttons on top of the SVG for continent/country selection. Each button should use `projectJourneyPoint` or marker coordinates converted to percent:

```tsx
function markerStyle(point: { x: number; y: number }) {
  return {
    left: `${(point.x / 950) * 100}%`,
    top: `${(point.y / 620) * 100}%`,
  };
}
```

Use visually styled buttons with `aria-label` for continent and country clicks.

- [ ] **Step 7: Update save behavior**

Change `saveStop()` to guard against missing city and track click/success:

```ts
async function saveStop() {
  if (!selectedCity) {
    setStatus("도시를 먼저 선택해주세요.");
    return;
  }
  trackJourneySaveClick(auth.logged_in);
  if (!auth.logged_in) {
    window.location.assign(buildGoogleLoginUrl(API_BASE, window.location.href));
    return;
  }
  // existing POST body uses selectedCity
  trackJourneySaveSuccess(selectedCity.id);
}
```

Keep the existing request body fields and status handling.

- [ ] **Step 8: Run build and fix TypeScript/CSS issues**

Run:

```bash
cd frontend && npm run build
```

Expected: build passes.

- [ ] **Step 9: Commit Task 2**

Run:

```bash
git add frontend/src/components/journey/NomadJourneyModal.tsx frontend/src/lib/analytics/events.ts
git commit -m "feat: add journey map drilldown UI"
```

### Task 3: Final Verification and Documentation Check

**Files:**
- Verify: `docs/specs/2026-05-01-journey-map-drilldown-design.md`
- Verify: `frontend/src/components/journey/NomadJourneyModal.tsx`
- Verify: `frontend/src/lib/journey-map.mjs`
- Verify: `frontend/src/lib/journey-map.test.mjs`

- [ ] **Step 1: Run helper tests**

Run:

```bash
cd frontend && node --test src/lib/journey-map.test.mjs
```

Expected: all tests pass.

- [ ] **Step 2: Run frontend production build**

Run:

```bash
cd frontend && npm run build
```

Expected: build passes.

- [ ] **Step 3: Confirm backend docs are not required**

Run:

```bash
git diff --name-only HEAD~2..HEAD
```

Expected changed implementation files are frontend-only plus plan/spec docs. If `api/`, `server.py`, or `utils/db.py` changed, update cowork backend docs before finalizing.

- [ ] **Step 4: Commit any final fixes**

If verification fixes were needed, run:

```bash
git add frontend/src/components/journey/NomadJourneyModal.tsx frontend/src/lib/journey-map.mjs frontend/src/lib/journey-map.test.mjs frontend/src/lib/analytics/events.ts
git commit -m "fix: polish journey map drilldown"
```

If no fixes were needed, do not create an empty commit.
