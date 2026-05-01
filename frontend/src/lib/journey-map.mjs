const WORLD_MAP_WIDTH = 950;
const WORLD_MAP_HEIGHT = 620;
const GPS_CITY_THRESHOLD_KM = 60;

const CITY_COORDINATES = {
  KL: [3.139, 101.6869],
  PG: [5.4141, 100.3288],
  LIS: [38.7223, -9.1393],
  PTO: [41.1579, -8.6291],
  CNX: [18.7883, 98.9853],
  BKK: [13.7563, 100.5018],
  TLL: [59.437, 24.7536],
  BCN: [41.3874, 2.1686],
  MAD: [40.4168, -3.7038],
  DPS: [-8.65, 115.138],
  BLN: [52.52, 13.405],
  TBS: [41.7151, 44.8271],
  SJO: [9.9281, -84.0907],
  SJD: [10.2993, -85.8371],
  ATH: [37.9838, 23.7275],
  HER: [35.3387, 25.1442],
  MNL: [14.5995, 120.9842],
  CEU: [10.3157, 123.8854],
  HAN: [21.0278, 105.8342],
  SGN: [10.8231, 106.6297],
  VLC: [39.4699, -0.3763],
  PRG: [50.0755, 14.4378],
  BUD: [47.4979, 19.0402],
  AMS: [52.3676, 4.9041],
  VIE: [48.2082, 16.3738],
  WAW: [52.2297, 21.0122],
  KRK: [50.0647, 19.945],
  MUC: [48.1351, 11.582],
  MIL: [45.4642, 9.19],
  DBV: [42.6507, 18.0944],
  BEG: [44.7866, 20.4489],
  SKP: [41.9981, 21.4254],
  NIC: [35.1856, 33.3823],
  IST: [41.0082, 28.9784],
  CEI: [19.9105, 99.8406],
  USM: [9.512, 100.0136],
  OSA: [34.6937, 135.5023],
  TYO: [35.6762, 139.6503],
  FUK: [33.5902, 130.4017],
  MEX: [19.4326, -99.1332],
  OAX: [17.0732, -96.7266],
  LIM: [-12.0464, -77.0428],
  EZE: [-34.6037, -58.3816],
  MDE: [6.2442, -75.5812],
  MIA: [25.7617, -80.1918],
  RAK: [31.6295, -7.9811],
  DXB: [25.2048, 55.2708],
  DAD: [16.0544, 108.2022],
  TPE: [25.033, 121.5654],
  HKT: [7.8804, 98.3923],
  ASU: [-25.2637, -57.5759],
  DOH: [25.2854, 51.531],
};

const ISO3_ALIAS = {
  AR: "arg argentina",
  AT: "aut austria",
  AE: "are uae emirates",
  CO: "col colombia",
  CR: "cri costa rica",
  CY: "cyp cyprus",
  CZ: "cze czech",
  DE: "deu germany",
  EE: "est estonia",
  ES: "esp spain",
  GE: "geo georgia",
  GR: "grc greece",
  HR: "hrv croatia",
  HU: "hun hungary",
  ID: "idn indonesia bali",
  IT: "ita italy",
  JP: "jpn japan",
  MA: "mar morocco",
  MK: "mkd north macedonia",
  MX: "mex mexico",
  MY: "mys malaysia",
  NL: "nld netherlands",
  PE: "per peru",
  PH: "phl philippines",
  PL: "pol poland",
  PT: "prt portugal",
  PY: "pry paraguay",
  QA: "qat qatar",
  RS: "srb serbia",
  TH: "tha thailand",
  TR: "tur turkey",
  TW: "twn taiwan",
  US: "usa united states",
  VN: "vnm vietnam",
};

function normalizeSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "");
}

function compactSearchParts(parts) {
  return parts
    .filter(Boolean)
    .map((part) => normalizeSearch(part))
    .filter(Boolean)
    .join(" ");
}

function distanceKm(aLat, aLng, bLat, bLng) {
  const radiusKm = 6371;
  const toRad = (value) => (Number(value) * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * radiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function projectJourneyPoint(lat, lng) {
  return {
    x: ((Number(lng) + 180) / 360) * WORLD_MAP_WIDTH,
    y: ((90 - Number(lat)) / 180) * WORLD_MAP_HEIGHT,
  };
}

export function buildJourneyCityOptions(cityScores) {
  return (cityScores?.cities ?? []).map((city) => {
    const coordinate = CITY_COORDINATES[city.id];
    if (!coordinate) {
      throw new Error(`Missing journey map coordinate for ${city.id}`);
    }

    const [lat, lng] = coordinate;
    const countryCode = String(city.country_id ?? "").toUpperCase();

    return {
      id: String(city.id),
      city: String(city.city),
      city_kr: String(city.city_kr ?? city.city),
      country: String(city.country),
      country_code: countryCode,
      lat,
      lng,
      search_index: compactSearchParts([
        city.id,
        city.city,
        city.city_kr,
        city.country,
        countryCode,
        ISO3_ALIAS[countryCode],
      ]),
    };
  });
}

export function filterJourneyCities(options, query, limit = 7) {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return options.slice(0, limit);

  return options
    .map((city) => {
      const index = city.search_index;
      const compactIndex = index.replace(/\s+/g, "");
      const startsAt = compactIndex.indexOf(normalizedQuery);
      const wordStartsAt = index
        .split(" ")
        .filter(Boolean)
        .findIndex((word) => word.startsWith(normalizedQuery));

      if (startsAt === -1 && wordStartsAt === -1) return null;

      return {
        city,
        rank: wordStartsAt === 0 ? 0 : wordStartsAt > 0 ? 1 : startsAt,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank || a.city.city.localeCompare(b.city.city))
    .slice(0, limit)
    .map((entry) => entry.city);
}

export function resolveJourneyLocation(options, lat, lng, thresholdKm = GPS_CITY_THRESHOLD_KM) {
  const currentLat = Number(lat);
  const currentLng = Number(lng);
  if (!Number.isFinite(currentLat) || !Number.isFinite(currentLng)) return null;

  const nearest = options.reduce((best, city) => {
    const distance = distanceKm(currentLat, currentLng, city.lat, city.lng);
    return distance < best.distance ? { city, distance } : best;
  }, { city: null, distance: Number.POSITIVE_INFINITY });

  if (!nearest.city || nearest.distance > thresholdKm) return null;

  return {
    ...nearest.city,
    lat: currentLat,
    lng: currentLng,
    gps_confirmed: true,
    gps_distance_km: nearest.distance,
  };
}
