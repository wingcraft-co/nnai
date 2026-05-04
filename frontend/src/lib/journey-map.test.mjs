import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import {
  buildJourneyCityOptions,
  buildJourneyCountryOptions,
  findJourneyCitySearchMatch,
  filterJourneyCities,
  filterJourneyCitiesByCountry,
  filterJourneyCountriesByContinent,
  getJourneyContinentCounts,
  projectJourneyPoint,
  resolveJourneyFlagColor,
  resolveJourneyLocation,
} from './journey-map.mjs';

const require = createRequire(import.meta.url);
const cityScores = require('../data/city_scores.json');

test('builds journey options from the full provided city list', () => {
  const options = buildJourneyCityOptions(cityScores);

  assert.equal(options.length, cityScores.cities.length);
  assert.equal(options.some((city) => city.city === 'Lisbon' && city.country_code === 'PT'), true);
  assert.equal(options.some((city) => city.city === 'Da Nang' && city.country_code === 'VN'), true);
  assert.equal(options.every((city) => Number.isFinite(city.lat) && Number.isFinite(city.lng)), true);
});

test('filters cities by fuzzy city, country, korean name, and iso code', () => {
  const options = buildJourneyCityOptions(cityScores);

  assert.deepEqual(filterJourneyCities(options, 'lis').map((city) => city.city).slice(0, 1), ['Lisbon']);
  assert.equal(filterJourneyCities(options, '포르투').some((city) => city.city === 'Porto'), true);
  assert.equal(filterJourneyCities(options, 'vnm').some((city) => city.city === 'Da Nang'), true);
  assert.equal(filterJourneyCities(options, 'th').some((city) => city.city === 'Bangkok'), true);
});

test('finds a strong city match while typing search text', () => {
  const options = buildJourneyCityOptions(cityScores);

  assert.equal(findJourneyCitySearchMatch(options, 'lis')?.city, 'Lisbon');
  assert.equal(findJourneyCitySearchMatch(options, '방콕')?.city, 'Bangkok');
  assert.equal(findJourneyCitySearchMatch(options, 'pt')?.country_code, 'PT');
  assert.equal(findJourneyCitySearchMatch(options, 'x')?.city, undefined);
});

test('projects city coordinates into the real world map view box', () => {
  const lisbon = projectJourneyPoint(38.7223, -9.1393);
  const tokyo = projectJourneyPoint(35.6762, 139.6503);

  assert.equal(lisbon.x > 0 && lisbon.x < 950, true);
  assert.equal(lisbon.y > 0 && lisbon.y < 620, true);
  assert.equal(tokyo.x > lisbon.x, true);
});

test('resolves gps location to a provided city while preserving actual coordinates', () => {
  const options = buildJourneyCityOptions(cityScores);
  const currentLisbon = resolveJourneyLocation(options, 38.73, -9.14);

  assert.equal(currentLisbon.city, 'Lisbon');
  assert.equal(currentLisbon.country_code, 'PT');
  assert.equal(currentLisbon.lat, 38.73);
  assert.equal(currentLisbon.lng, -9.14);
  assert.equal(currentLisbon.gps_confirmed, true);
});

test('does not guess a city when gps is far from every provided city', () => {
  const options = buildJourneyCityOptions(cityScores);

  assert.equal(resolveJourneyLocation(options, 64.1466, -21.9426), null);
});

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

test('resolves journey flag colors from supported and gps state', () => {
  assert.equal(resolveJourneyFlagColor({ supported: true, gpsVerified: true }), 'green');
  assert.equal(resolveJourneyFlagColor({ supported: true, gpsVerified: false }), 'red');
  assert.equal(resolveJourneyFlagColor({ supported: false, gpsVerified: true }), 'yellow');
});
