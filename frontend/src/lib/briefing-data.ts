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
  source: string; // 영문 통일
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

/** Mock briefing — Bangkok / 방콕 기준 */
export async function buildMockBriefing(input: {
  cityName?: string;
  cityKr?: string | null;
  countryId?: string;
  userProfile?: Record<string, unknown>;
}): Promise<BriefingData> {
  const cityName = input.cityName || "Bangkok";
  const cityKr = input.cityKr ?? "방콕";
  const countryId = (input.countryId || "TH").toUpperCase();
  const userProfile = input.userProfile ?? { persona_type: "free_spirit", travel_type: "혼자 (솔로)" };
  const issuedDate = new Date().toISOString().slice(0, 10);
  const documentId = await buildDocumentId(countryId, issuedDate, userProfile);

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
  };

  return {
    documentId,
    issuedDate,
    preparedFor: preparedForLabel(userProfile),
    classification: "Personal Briefing",
    cityName,
    cityKr,
    countryOfficial: COUNTRY_OFFICIAL[countryId] || cityName,
    countryId,
    quickFacts: {
      visa: "Visa-free 90 days",
      stay: "Up to 6 months",
      monthly: "USD 1,210",
      taxResidency: "180-day threshold",
    },
    sections: [
      {
        num: "1",
        title: "Executive Summary",
        body:
          `${cityName} 카드가 당신을 선택했네요. 이 도시는 무비자 90일 입국이 허용되며, ` +
          `생활비는 월 USD 1,200 안팎으로 동남아 노마드 평균에 부합합니다. ` +
          `한국 여권 기준 도착 비자/연장 옵션이 명확하고, 한인 커뮤니티와 코워킹 인프라가 자리잡혀 있어 ` +
          `초기 정착 마찰이 낮습니다. 다만 세무 거주지 180일 임계점 관리는 사전 계획이 필요합니다.`,
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
              "충분한 체류 자금 증빙은 비요구 (TH 무비자 입국 케이스)¹",
              "한국 외 입국 심사 시 원격근무 사실 발설 금지²",
            ],
          },
          {
            num: "2.2",
            title: "Long-Term Options",
            items: [
              "Destination Thailand Visa (DTV): 5년 멀티 엔트리, 매 입국 180일¹",
              "Long-Term Resident (LTR): 10년, 소득 USD 80,000+ 요건¹",
              "비자런은 권장하지 않음 (반복 시 입국 거부 사례)²",
            ],
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
                ["Rent", "600", "1BR mid-range, Sukhumvit"],
                ["Food", "300", "Mix of street and grocery"],
                ["Coworking", "100", "Hot desk monthly"],
                ["Insurance", "60", "SafetyWing nomad plan⁴"],
                ["Misc", "150", "Transport, leisure, SIM"],
                ["Total", "1,210", ""],
              ],
              sourceLabel: "Source: Numbeo Cost of Living, Bangkok³",
            },
          },
          {
            num: "3.2",
            title: "Tax Residency Notes",
            body:
              "TH 세무 거주지 임계점은 누적 체류 180일입니다. 동일 과세연도 내 임계 초과 시 " +
              "TH 거주자 신분으로 전환되어 글로벌 소득에 대한 과세 의무가 발생할 수 있습니다. " +
              "한국과 이중과세 협정이 적용되므로 사전 검토를 권장합니다.",
          },
        ],
      },
      {
        num: "4",
        title: "Action Plan (30 / 60 / 90)",
        subsections: [
          {
            num: "4.1",
            title: "First 30 Days",
            items: [
              "건강보험 임의계속가입 신청 (퇴직 후 2개월 이내, 기한 초과 시 영구 불가)¹",
              "Wise 또는 Revolut 국제 계좌 개설",
              "현지 SIM/eSIM 개통 + Grab/Bolt 앱 설정",
              "단기 숙소 1개월 예약 + 장기 임대 탐색",
            ],
          },
          {
            num: "4.2",
            title: "Days 31–60",
            items: [
              "코워킹 멤버십 1개월 (커뮤니티 합류)",
              "현지 병원 1곳 방문 (보험 처리 절차 사전 검증)",
              "한인회 또는 노마드 모임 등록²",
            ],
          },
          {
            num: "4.3",
            title: "Days 61–90",
            items: [
              "비자 갱신 또는 비자런 일정 검토 (90일 임박 전)",
              "세무 거주지 임계점 (180일) 카운트다운 시작",
              "장기 비자(DTV/LTR) 신청 자격 검토",
            ],
          },
        ],
      },
      {
        num: "5",
        title: "Risk Notes",
        items: [
          "원격근무 입국 발설 시 입국 거부 사례 보고됨²",
          "우기(5–10월) 도착 시 항공 지연 + 침수 리스크",
          "180일 누적 시 세무 거주지 자동 전환 — 예방적 출국 필요",
          "현금 위주 골목 상권 + 디지털 결제 인프라 격차 존재",
        ],
      },
    ],
    references: [
      { num: 1, source: "MFA Korea, Visa Waiver Program (consulate.go.kr)" },
      { num: 2, source: "Korean Embassy in Thailand, Travel Advisory" },
      { num: 3, source: "Numbeo, Cost of Living in Bangkok (numbeo.com)" },
      { num: 4, source: "SafetyWing Nomad Insurance (safetywing.com)" },
    ],
  };
}
