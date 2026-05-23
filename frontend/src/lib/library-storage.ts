import type { CityData } from "@/components/tarot/types";
import type { BriefingData } from "@/lib/briefing-data";

export const NOMAD_LIBRARY_KEY = "nomad_library_v1";
export const NOMAD_LIBRARY_CHANGE_EVENT = "nomad-library-change";

export type LibraryCard = {
  key: string;
  city: string;
  city_kr?: string | null;
  country: string;
  country_id: string;
  visa_type?: string | null;
  monthly_cost_usd?: number | null;
  score?: number | null;
  collected_at: number;
  updated_at: number;
  guide_unlocked: boolean;
  guide_markdown?: string | null;
  guide_briefing?: BriefingData | null;
  guide_city_id?: string | null;
};

export type LibraryGuideCacheEntry = {
  id: string | number;
  markdown: string;
  parsed_snapshot?: Record<string, unknown> | null;
  city_snapshot?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

let cachedRawLibraryCards: string | null = null;
let cachedLibraryCards: LibraryCard[] = [];

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

export function libraryCardKey(city: Pick<CityData, "id" | "city" | "country_id">): string {
  if (city.id) return normalizeKey(city.id);
  return `${normalizeKey(city.city)}-${normalizeKey(city.country_id)}`;
}

export function toLibraryCard(city: Partial<CityData> & Pick<CityData, "city" | "country" | "country_id">, now = Date.now()): LibraryCard {
  return {
    key: libraryCardKey({
      id: city.id ?? null,
      city: city.city,
      country_id: city.country_id,
    }),
    city: city.city,
    city_kr: city.city_kr ?? null,
    country: city.country,
    country_id: city.country_id,
    visa_type: city.visa_type ?? null,
    monthly_cost_usd: city.monthly_cost_usd ?? null,
    score: city.score ?? null,
    collected_at: now,
    updated_at: now,
    guide_unlocked: false,
    guide_markdown: null,
    guide_briefing: null,
    guide_city_id: null,
  };
}

export function mergeLibraryCards(existing: LibraryCard[], incoming: LibraryCard[]): LibraryCard[] {
  const byKey = new Map<string, LibraryCard>();

  for (const card of existing) {
    byKey.set(card.key, card);
  }

  for (const card of incoming) {
    const previous = byKey.get(card.key);
    byKey.set(card.key, {
      ...previous,
      ...card,
      collected_at: previous?.collected_at ?? card.collected_at,
      guide_unlocked: previous?.guide_unlocked ?? card.guide_unlocked,
      guide_markdown: previous?.guide_markdown ?? card.guide_markdown ?? null,
      guide_briefing: previous?.guide_briefing ?? card.guide_briefing ?? null,
      guide_city_id: previous?.guide_city_id ?? card.guide_city_id ?? null,
      updated_at: Math.max(previous?.updated_at ?? 0, card.updated_at),
    });
  }

  return Array.from(byKey.values()).sort((a, b) => b.updated_at - a.updated_at);
}

function stringValue(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function firstParsedCity(parsed: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const cities = Array.isArray(parsed?.top_cities) ? parsed.top_cities : [];
  const first = cities[0];
  return first && typeof first === "object" && !Array.isArray(first)
    ? first as Record<string, unknown>
    : {};
}

function timestampFromServer(value: string | null | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function libraryCardsFromServerGuides(
  guides: LibraryGuideCacheEntry[],
  fallbackNow = Date.now()
): LibraryCard[] {
  return guides.flatMap((guide) => {
    const citySnapshot = guide.city_snapshot && typeof guide.city_snapshot === "object"
      ? guide.city_snapshot
      : {};
    const parsedCity = firstParsedCity(guide.parsed_snapshot);
    const cityData = { ...parsedCity, ...citySnapshot };
    const city = stringValue(cityData, "city");
    const countryId = stringValue(cityData, "country_id");
    if (!city || !countryId || !guide.markdown) return [];

    const updatedAt = timestampFromServer(guide.updated_at, fallbackNow);
    const collectedAt = timestampFromServer(guide.created_at, updatedAt);
    const key = libraryCardKey({
      id: stringValue(cityData, "id") ?? undefined,
      city,
      country_id: countryId,
    });

    return [{
      key,
      city,
      city_kr: stringValue(cityData, "city_kr"),
      country: stringValue(cityData, "country") ?? countryId,
      country_id: countryId,
      visa_type: stringValue(cityData, "visa_type"),
      monthly_cost_usd: numberValue(cityData, "monthly_cost_usd"),
      score: numberValue(cityData, "score"),
      collected_at: collectedAt,
      updated_at: updatedAt,
      guide_unlocked: true,
      guide_markdown: guide.markdown,
      guide_briefing: null,
      guide_city_id: key,
    }];
  });
}

export function calculateTemporaryCardOpacity(collectedAt: number, now: number, isLoggedIn: boolean): number {
  if (isLoggedIn) return 1;
  const elapsed = Math.max(0, now - collectedAt);
  const fadeSteps = Math.floor(elapsed / 10_000);
  return Math.max(0.3, Number((1 - fadeSteps * 0.1).toFixed(1)));
}

export function readLibraryCards(): LibraryCard[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(NOMAD_LIBRARY_KEY);
    if (!raw) {
      cachedRawLibraryCards = null;
      cachedLibraryCards = [];
      return cachedLibraryCards;
    }
    if (raw === cachedRawLibraryCards) return cachedLibraryCards;
    const parsed = JSON.parse(raw);
    cachedRawLibraryCards = raw;
    cachedLibraryCards = Array.isArray(parsed) ? parsed : [];
    return cachedLibraryCards;
  } catch {
    cachedRawLibraryCards = null;
    cachedLibraryCards = [];
    return cachedLibraryCards;
  }
}

export function writeLibraryCards(cards: LibraryCard[]): void {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(cards);
  cachedRawLibraryCards = serialized;
  cachedLibraryCards = cards;
  try {
    localStorage.setItem(NOMAD_LIBRARY_KEY, serialized);
    window.dispatchEvent(new Event(NOMAD_LIBRARY_CHANGE_EVENT));
  } catch {
    cachedRawLibraryCards = null;
    cachedLibraryCards = [];
  }
}

export function collectLibraryCities(cities: CityData[], now = Date.now()): LibraryCard[] {
  const incoming = cities.map((city) => toLibraryCard(city, now));
  const merged = mergeLibraryCards(readLibraryCards(), incoming);
  writeLibraryCards(merged);
  return merged;
}

export function unlockLibraryGuide(
  city: CityData,
  markdown: string,
  now = Date.now(),
  briefing: BriefingData | null = null
): LibraryCard[] {
  const card = {
    ...toLibraryCard(city, now),
    guide_unlocked: true,
    guide_markdown: markdown,
    guide_briefing: briefing,
    guide_city_id: libraryCardKey(city),
  };
  const merged = mergeLibraryCards(readLibraryCards(), [card]);
  writeLibraryCards(merged);
  return merged;
}
