import { NextRequest, NextResponse } from "next/server";
import cityScoresData from "@/data/city_scores.json";
import visaDbData from "@/data/visa_db.json";
import {
  GUIDE_SYSTEM_PROMPT,
  PERSONA_TYPES,
  type PersonaType,
} from "@/lib/guide-prompt";

const cities = (cityScoresData as { cities: Array<Record<string, unknown>> }).cities;
const countries = (visaDbData as { countries: Array<Record<string, unknown>> }).countries;

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const MODEL_ID = "gemini-2.5-flash";
const TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 8192;

function normalizeCityId(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

function isPersonaType(value: unknown): value is PersonaType {
  return typeof value === "string" && (PERSONA_TYPES as readonly string[]).includes(value);
}

function buildUserMessage(
  city_id: string,
  persona_type: PersonaType,
  city: Record<string, unknown> | undefined,
  country: Record<string, unknown> | undefined,
): string {
  const reference = city
    ? {
        city: city.city,
        city_kr: city.city_kr,
        country: city.country,
        country_id: city.country_id,
        city_scores_excerpt: {
          monthly_cost_usd: city.monthly_cost_usd,
          internet_mbps: city.internet_mbps,
          safety_score: city.safety_score,
          english_score: city.english_score,
          coworking_score: city.coworking_score,
          cowork_usd_month: city.cowork_usd_month,
          mid_term_rent_usd: city.mid_term_rent_usd,
          climate: city.climate,
          community_size: city.community_size,
          korean_community_size: city.korean_community_size,
          tax_residency_days: city.tax_residency_days,
          data_verified_date: city.data_verified_date,
          source_refs: city.source_refs,
        },
        visa_db_excerpt: country
          ? {
              visa_type: country.visa_type,
              stay_months: country.stay_months,
              renewable: country.renewable,
              visa_free_days: country.visa_free_days,
              tax_residency_days: country.tax_residency_days,
              double_tax_treaty_with_kr: country.double_tax_treaty_with_kr,
              tax_note: country.tax_note,
              schengen: country.schengen,
              source: country.source,
              data_verified_date: country.data_verified_date,
            }
          : null,
      }
    : null;

  const header = reference
    ? `대상 도시: ${city?.city} (${city?.city_kr ?? ""}), ${city?.country} [city_id=${city_id}]`
    : `대상 도시 식별자만 제공됨: city_id=${city_id} (서비스 내장 DB에 매칭되지 않음 — 도시명을 추론하되 모호하면 각 블록 caution에 명시).`;

  const ref = reference
    ? `참고 데이터 (검증·보완용 — 그대로 인용 금지):\n${JSON.stringify(reference, null, 2)}`
    : "";

  return `${header}

페르소나: ${persona_type}

${ref}

위 정보를 바탕으로 시스템 프롬프트의 스키마에 정확히 맞는 단일 JSON 객체를 출력하세요.`;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ city_id: string }> },
) {
  const { city_id } = await ctx.params;

  let body: { persona_type?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isPersonaType(body.persona_type)) {
    return NextResponse.json(
      { error: `persona_type must be one of: ${PERSONA_TYPES.join(", ")}` },
      { status: 400 },
    );
  }
  const persona_type: PersonaType = body.persona_type;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[guide] GEMINI_API_KEY not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const city = cities.find((c) => normalizeCityId(String(c.city ?? "")) === city_id);
  const country = city ? countries.find((c) => c.id === city.country_id) : undefined;

  const userMessage = buildUserMessage(city_id, persona_type, city, country);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let raw: string;
  try {
    const upstream = await fetch(`${GEMINI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [
          { role: "system", content: GUIDE_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: MAX_OUTPUT_TOKENS,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      console.error(
        `[guide] Gemini upstream ${upstream.status} (city=${city_id}, persona=${persona_type}): ${errText.slice(0, 500)}`,
      );
      return NextResponse.json(
        { error: "LLM upstream failed", upstream_status: upstream.status },
        { status: 502 },
      );
    }

    const json = (await upstream.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    raw = json?.choices?.[0]?.message?.content ?? "";
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`[guide] Gemini timeout after ${TIMEOUT_MS}ms (city=${city_id})`);
      return NextResponse.json({ error: "LLM timeout" }, { status: 504 });
    }
    console.error(`[guide] Fetch error (city=${city_id}): ${msg}`);
    return NextResponse.json({ error: "LLM call failed" }, { status: 500 });
  } finally {
    clearTimeout(timer);
  }

  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  if (!cleaned) {
    console.error(`[guide] Empty LLM response (city=${city_id}, persona=${persona_type})`);
    return NextResponse.json({ error: "Empty LLM response" }, { status: 500 });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error(
      `[guide] JSON parse failed (city=${city_id}, persona=${persona_type}). Raw first 500: ${cleaned.slice(0, 500)}`,
    );
    return NextResponse.json({ error: "LLM response not parseable" }, { status: 500 });
  }

  return NextResponse.json({
    ...parsed,
    city_id,
    persona_type,
    generated_at: new Date().toISOString(),
  });
}
