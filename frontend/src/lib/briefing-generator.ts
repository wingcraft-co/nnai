"use client";

import type {
  BriefingData,
  BriefingReference,
  BriefingSection,
} from "./briefing-data";
import { buildMockBriefing } from "./briefing-data";

const GENERATE_URL = "/api/briefing/generate";
const MODEL_ID = "gemini-2.5-flash-preview-05-20";
const TIMEOUT_MS = 30_000;
const MAX_TOKENS = 4000;

const SYSTEM_PROMPT = `너는 디지털 노마드 이민 전문 애널리스트다.
한국 여권 소지자, 한국 세법 거주자 기준으로 분석한다.
응답은 반드시 JSON만 출력한다. 설명, 마크다운, 코드블록 없이 JSON만.

분석 품질 기준:
- 구글 검색으로 쉽게 찾을 수 있는 일반론 금지.
- 한국인 기준으로 재해석된 정보만 작성 (한국-해당국 이중과세협약, 한국 여권 무비자 일수, 한국 거주자 기준 183일 규칙 등).
- 수치에는 반드시 근거 출처 명시 (Numbeo / 대사관 / MOFA / 현지 규정 / 해당국 통계청 등).
- 단점과 주의사항을 반드시 포함. 긍정 일변도 금지.
- 불확실한 정보는 작성하지 말고 "현지 확인 필요" 표기.

페르소나 정의:
- wanderer: 이동 지향, 무비자·비자런 중심, 장기 정착 정보 불필요.
- local: 관계·커뮤니티 중심, 한인 사회·현지 편입 중심.
- planner: 합리성·수치 중심, 세금·재정 정보 상세하게.
- free_spirit: 일상 만족 중심, 날씨·카페·스트레스 없는 삶 중심.
- pioneer: 정착 탐색 중심, 장기비자·영주권·사업자 등록 중심.

출력은 단일 JSON 객체이며, 최상위 키는 "sections"와 "references" 두 가지다.
sections는 BriefingSection 배열, references는 BriefingReference 배열.
각 섹션·서브섹션의 num·title은 입력 스켈레톤을 그대로 사용하고 body/items/table만 도시 데이터로 채운다.`;

function buildUserPrompt(input: {
  cityName: string;
  cityKr: string | null;
  countryId: string;
  visaType: string | null;
  visaFreeDays: number | null;
  stayMonths: number | null;
  monthlyCostUsd: number | null;
  personaType: string;
  travelType: string;
}): string {
  const cityLabel = input.cityKr ? `${input.cityName} (${input.cityKr})` : input.cityName;
  const visaLine = `${input.visaType ?? "미정"}, 무비자: ${
    input.visaFreeDays ?? "미정"
  }일, 체류: ${input.stayMonths ?? "미정"}개월`;
  const monthlyLine =
    typeof input.monthlyCostUsd === "number"
      ? `USD ${input.monthlyCostUsd}`
      : "미정";

  const skeleton = {
    sections: [
      {
        num: "1",
        title: "Executive Summary",
        body:
          "3-4문장. 이 도시가 이 페르소나에게 왜 적합한지 또는 주의해야 하는지.",
      },
      {
        num: "2",
        title: "Visa Pathway",
        subsections: [
          {
            num: "2.1",
            title: "Entry & Documentation",
            items: ["항목1", "항목2", "항목3", "항목4"],
          },
          {
            num: "2.2",
            title: "Long-Term Options",
            body:
              "장기비자 경로 구체 설명. 소득 요건, 신청 절차, 갱신 조건 포함.",
          },
        ],
      },
      {
        num: "3",
        title: "Cost Profile",
        subsections: [
          {
            num: "3.1",
            title: "Monthly Breakdown",
            table: {
              headers: ["Category", "USD", "Notes"],
              rows: [
                ["Rent", "실제 수치", "기준 설명"],
                ["Food", "실제 수치", "기준 설명"],
                ["Coworking", "실제 수치", "기준 설명"],
                ["Insurance", "실제 수치", "SafetyWing 또는 현지 보험"],
                ["Misc", "실제 수치", "교통·여가·SIM"],
                ["Total", "합산 수치", ""],
              ],
              sourceLabel: `Source: Numbeo ${input.cityName} + 현지 조사`,
            },
          },
          {
            num: "3.2",
            title: "Tax Residency Notes",
            body:
              `한국-${input.countryId} 이중과세협약 적용 여부. 세무 거주지 임계점. 한국 거주자 판단 기준.`,
          },
        ],
      },
      {
        num: "4",
        title: "Action Plan",
        subsections: [
          {
            num: "4.1",
            title: "First 30 Days",
            items: [`${input.cityName} 맞춤 30일 액션 4-5개`],
          },
          {
            num: "4.2",
            title: "Days 31–60",
            items: [`${input.cityName} 맞춤 31-60일 액션 4-5개`],
          },
          {
            num: "4.3",
            title: "Days 61–90",
            items: [`${input.cityName} 맞춤 61-90일 액션 3-4개`],
          },
        ],
      },
      {
        num: "5",
        title: "Risk Notes",
        items: [`${input.cityName} 기준 실제 리스크 4-5개. 추상적 일반론 금지.`],
      },
    ],
    references: [
      {
        num: 1,
        issuer: "발행 주체",
        title: "문서명",
        url: "실제 URL",
        year: 2025,
      },
    ],
  };

  return [
    `도시: ${cityLabel}`,
    `국가코드: ${input.countryId}`,
    `비자: ${visaLine}`,
    `월 예상 비용: ${monthlyLine}`,
    `페르소나: ${input.personaType}`,
    `동행: ${input.travelType}`,
    "",
    "아래 JSON 구조로 섹션 데이터를 생성하라.",
    "각 섹션의 body와 items는 위 품질 기준을 충족해야 한다.",
    "",
    JSON.stringify(skeleton, null, 2),
  ].join("\n");
}

function stripFences(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "");
  s = s.replace(/```\s*$/i, "");
  return s.trim();
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((x) => typeof x === "string");
}

function isStringMatrix(value: unknown): value is string[][] {
  return Array.isArray(value) && value.every(isStringArray);
}

function isBriefingTable(value: unknown): value is NonNullable<BriefingSection["table"]> {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (!isStringArray(v.headers)) return false;
  if (!isStringMatrix(v.rows)) return false;
  if (v.sourceLabel !== undefined && typeof v.sourceLabel !== "string") return false;
  return true;
}

function isBriefingSection(value: unknown): value is BriefingSection {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.num !== "string" || typeof v.title !== "string") return false;
  if (v.body !== undefined && typeof v.body !== "string") return false;
  if (v.items !== undefined && !isStringArray(v.items)) return false;
  if (
    v.subsections !== undefined &&
    !(Array.isArray(v.subsections) && v.subsections.every(isBriefingSection))
  ) {
    return false;
  }
  if (v.table !== undefined && !isBriefingTable(v.table)) return false;
  return true;
}

function isBriefingSections(value: unknown): value is BriefingSection[] {
  return Array.isArray(value) && value.every(isBriefingSection);
}

function isBriefingReference(value: unknown): value is BriefingReference {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.num !== "number") return false;
  if (typeof v.issuer !== "string") return false;
  if (typeof v.title !== "string") return false;
  if (typeof v.url !== "string") return false;
  if (v.year !== undefined && typeof v.year !== "number") return false;
  return true;
}

function isBriefingReferences(value: unknown): value is BriefingReference[] {
  return Array.isArray(value) && value.every(isBriefingReference);
}

export async function buildBriefing(input: {
  cityName?: string;
  cityKr?: string | null;
  countryId?: string;
  userProfile?: Record<string, unknown>;
  visaType?: string | null;
  visaFreeDays?: number | null;
  stayMonths?: number | null;
  monthlyCostUsd?: number | null;
}): Promise<BriefingData> {
  const fallback = await buildMockBriefing(input);

  const cityName = input.cityName || "Bangkok";
  const cityKr = input.cityKr ?? null;
  const countryId = (input.countryId || "TH").toUpperCase();
  const userProfile = input.userProfile ?? {};
  const personaType = String(userProfile.persona_type ?? "free_spirit");
  const travelType = String(userProfile.travel_type ?? "혼자 (솔로)");

  const userPrompt = buildUserPrompt({
    cityName,
    cityKr,
    countryId,
    visaType: input.visaType ?? null,
    visaFreeDays: typeof input.visaFreeDays === "number" ? input.visaFreeDays : null,
    stayMonths: typeof input.stayMonths === "number" ? input.stayMonths : null,
    monthlyCostUsd: typeof input.monthlyCostUsd === "number" ? input.monthlyCostUsd : null,
    personaType,
    travelType,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let raw: string;
  try {
    const response = await fetch(GENERATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: MAX_TOKENS,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(
        `[buildBriefing] upstream ${response.status} (city=${cityName}, persona=${personaType})`,
      );
      return fallback;
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    raw = json?.choices?.[0]?.message?.content ?? "";
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error(
        `[buildBriefing] timeout after ${TIMEOUT_MS}ms (city=${cityName}, persona=${personaType})`,
      );
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[buildBriefing] fetch error (city=${cityName}): ${msg}`);
    }
    return fallback;
  } finally {
    clearTimeout(timer);
  }

  const cleaned = stripFences(raw);
  if (!cleaned) {
    console.error(`[buildBriefing] empty LLM response (city=${cityName}, persona=${personaType})`);
    return fallback;
  }

  let parsed: { sections?: unknown; references?: unknown };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error(
      `[buildBriefing] JSON parse failed (city=${cityName}). Raw first 300: ${cleaned.slice(0, 300)}`,
    );
    return fallback;
  }

  if (!isBriefingSections(parsed.sections)) {
    console.error(
      `[buildBriefing] sections shape invalid (city=${cityName}). Falling back to mock.`,
    );
    return fallback;
  }

  if (!isBriefingReferences(parsed.references)) {
    console.error(
      `[buildBriefing] references shape invalid (city=${cityName}). Falling back to mock.`,
    );
    return fallback;
  }

  return {
    ...fallback,
    sections: parsed.sections,
    references: parsed.references,
  };
}
