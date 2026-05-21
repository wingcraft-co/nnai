import type { CityData } from "@/components/tarot/types";

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
  guide_city_id?: string | null;
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
      guide_city_id: previous?.guide_city_id ?? card.guide_city_id ?? null,
      updated_at: Math.max(previous?.updated_at ?? 0, card.updated_at),
    });
  }

  return Array.from(byKey.values()).sort((a, b) => b.updated_at - a.updated_at);
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

export function unlockLibraryGuide(city: CityData, markdown: string, now = Date.now()): LibraryCard[] {
  const card = {
    ...toLibraryCard(city, now),
    guide_unlocked: true,
    guide_markdown: markdown,
    guide_city_id: libraryCardKey(city),
  };
  const merged = mergeLibraryCards(readLibraryCards(), [card]);
  writeLibraryCards(merged);
  return merged;
}
