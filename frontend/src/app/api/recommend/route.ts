import { NextRequest, NextResponse } from "next/server";
import cityScoresData from "@/data/city_scores.json";
import visaDbData from "@/data/visa_db.json";
import cityDescriptions from "@/data/city_descriptions.json";
import cityInsights from "@/data/city_insights.json";

const cityScores = (cityScoresData as { cities: Record<string, unknown>[] }).cities;
const visaCountries = (visaDbData as { countries: Record<string, unknown>[] }).countries;

function enrichCities(cities: Record<string, unknown>[]) {
  const cityMap = new Map<string, Record<string, unknown>>();
  for (const c of cityScores) {
    cityMap.set(c.city as string, c);
  }

  const countryMap = new Map<string, Record<string, unknown>>();
  for (const c of visaCountries) {
    countryMap.set(c.id as string, c);
  }

  return cities.map((city) => {
    const cityName = city.city as string;
    const countryId = city.country_id as string;

    // Match by city name (exact → partial)
    let scores = cityMap.get(cityName);
    if (!scores) {
      for (const [key, val] of cityMap) {
        if (cityName.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(cityName.toLowerCase())) {
          scores = val;
          break;
        }
      }
    }

    const visa = countryMap.get(countryId);

    return {
      ...city,
      // city_scores fields
      internet_mbps: scores?.internet_mbps ?? null,
      safety_score: scores?.safety_score ?? null,
      english_score: scores?.english_score ?? null,
      nomad_score: scores?.nomad_score ?? null,
      cowork_usd_month: scores?.cowork_usd_month ?? null,
      community_size: scores?.community_size ?? null,
      korean_community_size: scores?.korean_community_size ?? null,
      mid_term_rent_usd: scores?.mid_term_rent_usd ?? null,
      flatio_search_url: scores?.flatio_search_url ?? null,
      anyplace_search_url: scores?.anyplace_search_url ?? null,
      nomad_meetup_url: scores?.nomad_meetup_url ?? null,
      entry_tips: scores?.entry_tips ?? null,
      climate: scores?.climate ?? null,
      data_verified_date: scores?.data_verified_date ?? null,
      // visa_db fields
      stay_months: visa?.stay_months ?? null,
      renewable: visa?.renewable ?? null,
      key_docs: visa?.key_docs ?? null,
      visa_fee_usd: visa?.visa_fee_usd ?? null,
      tax_note: visa?.tax_note ?? null,
      double_tax_treaty_with_kr: visa?.double_tax_treaty_with_kr ?? null,
      visa_notes: visa?.visa_notes ?? null,
      city_description: (() => {
        const slug = cityName.toUpperCase().replace(/ /g, "_").replace(/[()]/g, "");
        const key = `${countryId}_${slug}`;
        return (cityDescriptions as Record<string, string>)[key] ?? null;
      })(),
      city_insight: (() => {
        const slug = cityName.toUpperCase().replace(/ /g, "_").replace(/[()]/g, "");
        const key = `${countryId}_${slug}`;
        return (cityInsights as Record<string, string>)[key] ?? null;
      })(),
    };
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "https://api.nnai.app";
  const response = await fetch(`${apiBase}/api/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "API 호출 실패" },
      { status: response.status }
    );
  }

  const data = await response.json();

  // Enrich cities with city_scores + visa_db data
  data.cities = enrichCities(data.cities || []);
  if (data.parsed?.top_cities) {
    data.parsed.top_cities = enrichCities(data.parsed.top_cities);
  }

  return NextResponse.json(data);
}
