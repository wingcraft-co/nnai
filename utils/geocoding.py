"""City geocoding helpers for Nomad Journey."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import math
import re
import secrets
import time
import unicodedata
from typing import Callable, TypedDict
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from utils.data_paths import resolve_data_path

ATTRIBUTION = "Geocoding data from OpenStreetMap contributors"
SUPPORTED_SOURCE = "nnai_supported"
NOMINATIM_SOURCE = "nominatim"
GEOCODE_RESULT_TTL_SECONDS = 15 * 60

_NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
_LAST_PROVIDER_CALL = 0.0
_SUPPORTED_CITIES_CACHE: list[dict] | None = None
_QUERY_CACHE: dict[tuple[str, str], tuple[datetime, list[dict]]] = {}
_RESULT_CACHE: dict[str, dict] = {}

SUPPORTED_CITY_COORDINATES = {
    "KL": (3.139, 101.6869),
    "PG": (5.4141, 100.3288),
    "LIS": (38.7223, -9.1393),
    "PTO": (41.1579, -8.6291),
    "CNX": (18.7883, 98.9853),
    "BKK": (13.7563, 100.5018),
    "TLL": (59.437, 24.7536),
    "BCN": (41.3874, 2.1686),
    "MAD": (40.4168, -3.7038),
    "DPS": (-8.65, 115.138),
    "BLN": (52.52, 13.405),
    "TBS": (41.7151, 44.8271),
    "SJO": (9.9281, -84.0907),
    "SJD": (10.2993, -85.8371),
    "ATH": (37.9838, 23.7275),
    "HER": (35.3387, 25.1442),
    "MNL": (14.5995, 120.9842),
    "CEU": (10.3157, 123.8854),
    "HAN": (21.0278, 105.8342),
    "SGN": (10.8231, 106.6297),
    "VLC": (39.4699, -0.3763),
    "PRG": (50.0755, 14.4378),
    "BUD": (47.4979, 19.0402),
    "AMS": (52.3676, 4.9041),
    "VIE": (48.2082, 16.3738),
    "WAW": (52.2297, 21.0122),
    "KRK": (50.0647, 19.945),
    "MUC": (48.1351, 11.582),
    "MIL": (45.4642, 9.19),
    "DBV": (42.6507, 18.0944),
    "BEG": (44.7866, 20.4489),
    "SKP": (41.9981, 21.4254),
    "NIC": (35.1856, 33.3823),
    "IST": (41.0082, 28.9784),
    "CEI": (19.9105, 99.8406),
    "USM": (9.512, 100.0136),
    "OSA": (34.6937, 135.5023),
    "TYO": (35.6762, 139.6503),
    "FUK": (33.5902, 130.4017),
    "MEX": (19.4326, -99.1332),
    "OAX": (17.0732, -96.7266),
    "LIM": (-12.0464, -77.0428),
    "EZE": (-34.6037, -58.3816),
    "MDE": (6.2442, -75.5812),
    "MIA": (25.7617, -80.1918),
    "RAK": (31.6295, -7.9811),
    "DXB": (25.2048, 55.2708),
    "DAD": (16.0544, 108.2022),
    "TPE": (25.033, 121.5654),
    "HKT": (7.8804, 98.3923),
    "ASU": (-25.2637, -57.5759),
    "DOH": (25.2854, 51.531),
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


def finite_coordinate(value: object, low: float, high: float) -> float:
    number = float(value)
    if not math.isfinite(number) or number < low or number > high:
        raise ValueError("invalid coordinate")
    return number


def load_supported_cities() -> list[dict]:
    global _SUPPORTED_CITIES_CACHE
    if _SUPPORTED_CITIES_CACHE is None:
        with open(resolve_data_path("city_scores.json"), encoding="utf-8") as handle:
            _SUPPORTED_CITIES_CACHE = json.load(handle).get("cities", [])
    return _SUPPORTED_CITIES_CACHE


def supported_city_by_id(city_id: str) -> dict | None:
    normalized = str(city_id or "").upper()
    return next(
        (row for row in load_supported_cities() if str(row.get("id", "")).upper() == normalized),
        None,
    )


def supported_city_coordinate(city_id: str) -> tuple[float, float] | None:
    return SUPPORTED_CITY_COORDINATES.get(str(city_id or "").upper())


def _supported_city_rows(query: str, country_code: str) -> list[dict]:
    needle = query.casefold()
    rows = []
    for city in load_supported_cities():
        if str(city.get("country_id", "")).upper() != country_code:
            continue
        names = {
            str(city.get("id", "")),
            str(city.get("city", "")),
            str(city.get("city_kr", "")),
        }
        if needle not in {name.casefold() for name in names if name}:
            continue
        coordinate = supported_city_coordinate(str(city["id"]))
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
        try:
            result_country = normalize_country_code(str(raw.get("country_code", "")))
        except ValueError:
            continue
        if result_country != normalized_country:
            continue
        try:
            lat = finite_coordinate(raw.get("lat"), -90, 90)
            lng = finite_coordinate(raw.get("lng"), -180, 180)
        except (TypeError, ValueError):
            continue

        row = {
            "city": str(raw.get("city") or normalized_query),
            "country": str(raw.get("country") or ""),
            "country_code": normalized_country,
            "lat": lat,
            "lng": lng,
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
