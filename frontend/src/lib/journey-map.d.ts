export type JourneyCityOption = {
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

export function projectJourneyPoint(lat: number, lng: number): { x: number; y: number };

export function buildJourneyCityOptions(cityScores: {
  cities?: Array<Record<string, unknown>>;
}): JourneyCityOption[];

export function filterJourneyCities(
  options: JourneyCityOption[],
  query: string,
  limit?: number,
): JourneyCityOption[];

export function resolveJourneyLocation(
  options: JourneyCityOption[],
  lat: number,
  lng: number,
  thresholdKm?: number,
): JourneyCityOption | null;
