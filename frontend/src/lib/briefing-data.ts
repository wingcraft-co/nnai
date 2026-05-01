"use client";

/**
 * Country Briefing 양식 데이터 타입 + mock 팩토리.
 *
 * 양식 컨셉: IMF Country Report / Australian DFAT Country Brief / UN Policy Brief 합성.
 * - Document ID: NNAI-{country}-{date}-{userhash6}
 * - Classification: "Personal Briefing"
 * - Section numbering: 1. / 1.1. / 1.1.1.
 * - References: 영문 통일
 */

export type BriefingSection = {
  num: string; // "1" 또는 "2.1"
  title: string;
  body?: string;
  items?: string[]; // bullet list, footnote 마커 superscript는 본문에 직접 (e.g. "여권 사본¹")
  subsections?: BriefingSection[];
  table?: {
    headers: string[];
    rows: string[][];
    sourceLabel?: string; // "Source: Numbeo Bangkok³"
  };
};

export type BriefingReference = {
  num: number;
  issuer: string; // 발행 주체 e.g. "Ministry of Foreign Affairs, Republic of Korea"
  title: string;  // 문서/섹션 제목 e.g. "Consular Information & Visa Service"
  url: string;    // 호스트 또는 path e.g. "overseas.mofa.go.kr"
  year?: number;  // 발행/최종 갱신 연도
};

export type BriefingData = {
  documentId: string;
  issuedDate: string; // YYYY-MM-DD
  preparedFor: string;
  classification: string; // "Personal Briefing"
  cityName: string;
  cityKr: string | null;
  countryOfficial: string; // "Kingdom of Thailand"
  countryId: string;
  quickFacts: {
    visa: string;
    stay: string;
    monthly: string;
    taxResidency: string;
  };
  sections: BriefingSection[];
  references: BriefingReference[];
};

/** SHA-256 prefix 6자 hex — 개인화 표시용 */
async function hashUserProfile(userProfile: Record<string, unknown>): Promise<string> {
  const text = JSON.stringify(userProfile);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 6);
  }
  // fallback (SSR 또는 crypto.subtle 미지원)
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(hash).toString(16).padStart(6, "0").slice(0, 6);
}

export async function buildDocumentId(
  countryId: string,
  isoDate: string,
  userProfile: Record<string, unknown>,
): Promise<string> {
  const cc = (countryId || "XX").toUpperCase().slice(0, 2);
  const date = isoDate.replace(/[^0-9]/g, "").slice(0, 8); // 20260501
  const userHash = await hashUserProfile(userProfile);
  return `NNAI-${cc}-${date}-${userHash}`;
}

const PERSONA_LABEL_KR: Record<string, string> = {
  free_spirit: "Free Spirit",
  builder: "Builder",
  wanderer: "Wanderer",
  rooted: "Rooted",
  community: "Community",
};

export function preparedForLabel(userProfile: Record<string, unknown> | null | undefined): string {
  if (!userProfile) return "Independent Nomad";
  const persona = String(userProfile.persona_type || "");
  const personaLabel = PERSONA_LABEL_KR[persona] || "Independent Nomad";
  const travel = String(userProfile.travel_type || "");
  if (travel.includes("배우자") || travel.includes("파트너")) {
    return `${personaLabel} · With Partner`;
  }
  if (travel.includes("가족")) {
    return `${personaLabel} · With Family`;
  }
  return personaLabel;
}

/** Mock briefing — country/city agnostic 본문 + 실제 도시 데이터 plug-in Quick Facts */
export async function buildMockBriefing(input: {
  cityName?: string;
  cityKr?: string | null;
  countryId?: string;
  userProfile?: Record<string, unknown>;
  visaType?: string | null;
  visaFreeDays?: number | null;
  stayMonths?: number | null;
  monthlyCostUsd?: number | null;
}): Promise<BriefingData> {
  const cityName = input.cityName || "Bangkok";
  const cityKr = input.cityKr ?? null;
  const countryId = (input.countryId || "TH").toUpperCase();
  const userProfile = input.userProfile ?? { persona_type: "free_spirit", travel_type: "혼자 (솔로)" };
  const issuedDate = new Date().toISOString().slice(0, 10);
  const documentId = await buildDocumentId(countryId, issuedDate, userProfile);

  // 세무 거주지 임계점 — 대부분 OECD 183일, 일부 국가 차등
  const TAX_RESIDENCY_DAYS: Record<string, number> = {
    TH: 180,
    JP: 183,
    SG: 183,
    AE: 183,
    PT: 183,
  };
  const taxDays = TAX_RESIDENCY_DAYS[countryId] ?? 183;

  const COUNTRY_OFFICIAL: Record<string, string> = {
    TH: "Kingdom of Thailand",
    PT: "Portuguese Republic",
    JP: "Japan",
    MY: "Malaysia",
    VN: "Socialist Republic of Vietnam",
    ID: "Republic of Indonesia",
    GE: "Georgia",
    EE: "Republic of Estonia",
    ES: "Kingdom of Spain",
    GR: "Hellenic Republic",
    MX: "United Mexican States",
    CO: "Republic of Colombia",
    DE: "Federal Republic of Germany",
    FR: "French Republic",
    NL: "Kingdom of the Netherlands",
    BR: "Federative Republic of Brazil",
    AR: "Argentine Republic",
    PE: "Republic of Peru",
    UY: "Oriental Republic of Uruguay",
    CR: "Republic of Costa Rica",
    PA: "Republic of Panama",
    HR: "Republic of Croatia",
    CZ: "Czech Republic",
    HU: "Hungary",
    PL: "Republic of Poland",
    RO: "Romania",
    RS: "Republic of Serbia",
    TR: "Republic of Türkiye",
    AE: "United Arab Emirates",
    PH: "Republic of the Philippines",
    TW: "Taiwan",
    SG: "Republic of Singapore",
  };

  const COUNTRY_NAME: Record<string, string> = {
    TH: "Thailand", PT: "Portugal", JP: "Japan", MY: "Malaysia",
    VN: "Vietnam", ID: "Indonesia", GE: "Georgia", EE: "Estonia",
    ES: "Spain", GR: "Greece", MX: "Mexico", CO: "Colombia",
    DE: "Germany", FR: "France", NL: "Netherlands", BR: "Brazil",
    AR: "Argentina", PE: "Peru", UY: "Uruguay", CR: "Costa Rica",
    PA: "Panama", HR: "Croatia", CZ: "Czech Republic", HU: "Hungary",
    PL: "Poland", RO: "Romania", RS: "Serbia", TR: "Türkiye",
    AE: "UAE", PH: "Philippines", TW: "Taiwan", SG: "Singapore",
  };

  const countryOfficial = COUNTRY_OFFICIAL[countryId] || cityName;
  const countryName = COUNTRY_NAME[countryId] || countryOfficial;
  const mofaCountryUrl = `overseas.mofa.go.kr/${countryId.toLowerCase()}-ko`;
  const numbeoSlug = cityName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[()]/g, "")
    .replace(/\s+/g, "-")
    .trim();
  const numbeoUrl = `numbeo.com/cost-of-living/in/${numbeoSlug}`;
  const currentYear = new Date().getFullYear();

  return {
    documentId,
    issuedDate,
    preparedFor: preparedForLabel(userProfile),
    classification: "Personal Briefing",
    cityName,
    cityKr,
    countryOfficial,
    countryId,
    quickFacts: {
      visa: input.visaType || (input.visaFreeDays
        ? `Visa-free ${input.visaFreeDays}d`
        : "—"),
      stay: input.stayMonths
        ? `Up to ${input.stayMonths} months`
        : input.visaFreeDays
          ? `${input.visaFreeDays} days max`
          : "—",
      monthly: typeof input.monthlyCostUsd === "number"
        ? `USD ${input.monthlyCostUsd.toLocaleString()}`
        : "—",
      taxResidency: `${taxDays}-day threshold`,
    },
    sections: [
      {
        num: "1",
        title: "Executive Summary",
        body:
          `본 브리핑은 ${cityName}에서 한국 여권 보유자가 디지털 노마드로 정착할 때 ` +
          `필요한 비자 경로, 비용 구조, 30·60·90일 액션 플랜, 주요 리스크를 정리합니다. ` +
          `세부 수치와 권장 일정은 본문 각 절을 참고하시기 바랍니다.`,
      },
      {
        num: "2",
        title: "Visa Pathway",
        subsections: [
          {
            num: "2.1",
            title: "Entry & Documentation",
            items: [
              "여권 사본 (유효기간 6개월 이상)¹",
              "왕복 항공권 또는 출국 증빙¹",
              "거주 증명 (호텔 예약 또는 임대 계약서)²",
              "재정 능력 증빙 (요청 시 제출)²",
            ],
          },
          {
            num: "2.2",
            title: "Long-Term Options",
            body:
              "장기 체류 옵션은 디지털 노마드 비자, 거주자 비자, 투자 이민 비자 등의 경로가 있습니다. " +
              "비자별 소득 요건·신청 절차·갱신 가능성은 영사관 공식 안내를 참조하시기 바랍니다.²",
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
                ["Rent", "—", "Mid-range 1BR, central district"],
                ["Food", "—", "Mix of local and grocery"],
                ["Coworking", "—", "Hot desk, monthly"],
                ["Insurance", "—", "Nomad plan⁴"],
                ["Misc", "—", "Transport, leisure, SIM"],
                ["Total", "—", ""],
              ],
              sourceLabel: `Source: Numbeo Cost of Living, ${cityName}³`,
            },
          },
          {
            num: "3.2",
            title: "Tax Residency Notes",
            body:
              "거주국 세무 규정에 따라 누적 체류 일수가 임계점을 초과하면 해당국 세무 거주자 " +
              "신분으로 전환될 수 있습니다. 글로벌 소득에 대한 과세 의무, 한국과의 이중과세 협정 " +
              "적용 여부는 출국 전 사전 검토를 권장합니다.²",
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
            items: [
              "건강보험 임의계속가입 신청 (퇴직 후 2개월 이내, 기한 초과 시 영구 불가)³",
              "Wise 또는 Revolut 국제 계좌 개설",
              "현지 SIM/eSIM 개통 및 결제 앱 설정",
              "단기 숙소 1개월 확보 + 장기 임대 탐색",
            ],
          },
          {
            num: "4.2",
            title: "Days 31–60",
            items: [
              "코워킹 멤버십 1개월 (커뮤니티 합류)",
              "현지 병원 1곳 방문 (보험 처리 절차 사전 검증)⁵",
              "한인회 또는 노마드 모임 등록²",
              "은행 계좌 개설 (외국인 등록증 요건 확인)",
            ],
          },
          {
            num: "4.3",
            title: "Days 61–90",
            items: [
              "비자 갱신 또는 출국 일정 검토",
              "세무 거주지 임계점 도달 여부 확인",
              "장기 비자 옵션 신청 자격 검토",
            ],
          },
        ],
      },
      {
        num: "5",
        title: "Risk Notes",
        items: [
          "입국 심사 시 원격근무 사실 발설 시 일부 국가에서 입국 거부 사례 보고됨²",
          "기후·계절 영향 (도시별 우기·태풍·혹서·혹한 시기 사전 확인)",
          "세무 거주지 자동 전환 위험 — 누적 체류일 사전 관리",
          "현지 결제 인프라 격차 (현금 의존도 및 신용카드 수용도)",
        ],
      },
    ],
    references: [
      {
        num: 1,
        issuer: "Ministry of Foreign Affairs, Republic of Korea",
        title: "Consular Information & Visa Service",
        url: "overseas.mofa.go.kr",
        year: currentYear,
      },
      {
        num: 2,
        issuer: `Embassy of the Republic of Korea in ${countryName}`,
        title: "Country Notices & Travel Advisory",
        url: mofaCountryUrl,
        year: currentYear,
      },
      {
        num: 3,
        issuer: "National Health Insurance Service of Korea",
        title: "Voluntary Continuation Enrollment Guide",
        url: "nhis.or.kr",
        year: currentYear,
      },
      {
        num: 4,
        issuer: "Numbeo",
        title: `Cost of Living in ${cityName}`,
        url: numbeoUrl,
        year: currentYear,
      },
      {
        num: 5,
        issuer: "SafetyWing",
        title: "Nomad Insurance — Plan Specifications",
        url: "safetywing.com/nomad-insurance",
        year: currentYear,
      },
    ],
  };
}
