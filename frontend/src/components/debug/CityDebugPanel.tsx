"use client";

import { useMemo } from "react";
import cityScoresData from "@/data/city_scores.json";
import visaDbData from "@/data/visa_db.json";

// ── 백엔드 recommender.py 하드 필터 재현 ─────────────────────────

const TIMELINE_ALIASES: Record<string, string> = {
  "1~3개월 단기 체류": "90일 단기 체험",
  "6개월 중기 체류": "6개월 단기 체험",
  "1년 장기 체류": "1년 단기 체험",
  "영주권/이민 목표": "3년 장기 체류",
};

// [min_stay_months, require_renewable]
const TIMELINE_FILTER: Record<string, [number, boolean]> = {
  "90일 단기 체험": [1, false],
  "6개월 단기 체험": [6, false],
  "1년 단기 체험": [12, false],
  "3년 장기 체류": [12, true],
  "5년 이상 초장기 체류": [12, true],
};

const LONG_STAY_TIMELINES = new Set(["3년 장기 체류", "5년 이상 초장기 체류"]);
const SCHENGEN_LONG_STAY_INCOME_THRESHOLD = 2849;

const CONTINENT_TO_IDS: Record<string, Set<string>> = {
  아시아: new Set(["TH", "MY", "ID", "VN", "PH", "JP", "TW"]),
  유럽: new Set(["DE", "PT", "EE", "ES", "GR", "HR", "CZ", "HU", "SI", "MT", "CY", "AL", "RS", "MK"]),
  중남미: new Set(["CR", "MX", "CO", "AR", "BR"]),
  "중동/아프리카": new Set(["AE", "MA"]),
  북미: new Set(["CA"]),
};

const USD_RATE = 0.000714; // 만원 → USD: 1만원 * 10000 * 0.000714

// ── Types ────────────────────────────────────────────────────────

interface FilterResult {
  passed: boolean;
  failReasons: string[];
}

interface CityRow {
  cityId: string;
  cityKr: string;
  city: string;
  countryId: string;
  countryKr: string;
  monthlyCostUsd: number;
  filter: FilterResult;
}

interface Props {
  incomeRange: string;         // 만원 단위 문자열 (e.g., "400")
  timeline: string;            // 프론트 폼값 (e.g., "1년 장기 체류")
  preferredCountries: string[];// e.g., ["아시아", "유럽"]
}

// ── Filter logic ─────────────────────────────────────────────────

function applyFilters(
  country: Record<string, unknown>,
  incomeUsd: number,
  normalizedTimeline: string,
  preferredCountries: string[],
): FilterResult {
  const failReasons: string[] = [];

  // 1. Income filter
  const minIncome = (country.min_income_usd as number) ?? 0;
  if (incomeUsd < minIncome) {
    failReasons.push(`소득 부족 ($${minIncome.toLocaleString()} 필요)`);
  }

  // 2. Timeline filter
  if (normalizedTimeline && normalizedTimeline in TIMELINE_FILTER) {
    const [minMonths, requireRenewable] = TIMELINE_FILTER[normalizedTimeline];
    const stayMonths = (country.stay_months as number) ?? 0;
    if (stayMonths < minMonths) {
      failReasons.push(`체류 기간 부족 (${stayMonths}개월 < ${minMonths}개월)`);
    }
    if (requireRenewable && !country.renewable) {
      failReasons.push("갱신 불가 비자");
    }
  }

  // 3. Continent filter
  if (preferredCountries.length > 0) {
    const allowed = new Set<string>();
    for (const region of preferredCountries) {
      for (const id of CONTINENT_TO_IDS[region] ?? []) {
        allowed.add(id);
      }
    }
    if (allowed.size > 0 && !allowed.has(country.id as string)) {
      failReasons.push(`선호 지역 미포함`);
    }
  }

  // 4. Schengen long-stay income filter
  if (LONG_STAY_TIMELINES.has(normalizedTimeline) && country.schengen) {
    if (incomeUsd < SCHENGEN_LONG_STAY_INCOME_THRESHOLD) {
      failReasons.push(`솅겐 장기 소득 기준 미달 ($${SCHENGEN_LONG_STAY_INCOME_THRESHOLD})`);
    }
  }

  return { passed: failReasons.length === 0, failReasons };
}

// ── Component ────────────────────────────────────────────────────

export default function CityDebugPanel({ incomeRange, timeline, preferredCountries }: Props) {
  const rows = useMemo<CityRow[]>(() => {
    const incomeKrwMan = Number(incomeRange) || 0;
    const incomeUsd = incomeKrwMan * 10000 * USD_RATE;
    const normalizedTimeline = TIMELINE_ALIASES[timeline] ?? timeline;

    const countryMap = new Map(
      (visaDbData.countries as Record<string, unknown>[]).map((c) => [c.id as string, c])
    );

    return (cityScoresData.cities as Record<string, unknown>[]).map((city) => {
      const countryId = city.country_id as string;
      const country = countryMap.get(countryId);
      const filter = country
        ? applyFilters(country, incomeUsd, normalizedTimeline, preferredCountries)
        : { passed: false, failReasons: ["국가 데이터 없음"] };

      return {
        cityId: city.id as string,
        cityKr: (city.city_kr as string) || (city.city as string),
        city: city.city as string,
        countryId,
        countryKr: (country?.name_kr as string) ?? countryId,
        monthlyCostUsd: city.monthly_cost_usd as number,
        filter,
      };
    });
  }, [incomeRange, timeline, preferredCountries]);

  const passCount = rows.filter((r) => r.filter.passed).length;

  // country code → flag emoji
  function toFlag(code: string) {
    return code
      .toUpperCase()
      .split("")
      .map((c) => String.fromCodePoint(c.charCodeAt(0) + 127397))
      .join("");
  }

  return (
    <div className="fixed top-0 right-0 h-screen w-72 overflow-y-auto border-l border-border/40 bg-background/30 backdrop-blur-sm text-xs z-50 flex flex-col pointer-events-none">
      {/* Header */}
      <div className="sticky top-0 bg-background/40 border-b border-border/40 px-3 py-2 font-mono">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">DEBUG MODE</div>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-foreground">도시 필터 현황</span>
          <span className="text-muted-foreground">
            <span className="text-green-500 font-bold">{passCount}</span>
            <span className="text-muted-foreground">/{rows.length}</span>
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {timeline ? `타임라인: ${timeline}` : "타임라인: 미선택"}
          {" · "}
          {incomeRange && incomeRange !== "0"
            ? `소득: ${incomeRange}만원/월 (~$${Math.round(Number(incomeRange) * 10000 * USD_RATE).toLocaleString()})`
            : "소득: 미선택"}
        </div>
      </div>

      {/* City list */}
      <ul className="flex-1 divide-y divide-border/50">
        {rows.map((row) => (
          <li
            key={row.cityId}
            className={`px-3 py-1.5 flex flex-col gap-0.5 ${
              row.filter.passed ? "opacity-100" : "opacity-40"
            }`}
          >
            <div className="flex items-center gap-1.5">
              {/* 상태 아이콘 */}
              <span className={row.filter.passed ? "text-green-500" : "text-red-500"}>
                {row.filter.passed ? "●" : "✕"}
              </span>

              {/* 도시명 */}
              <span
                className={`font-medium ${
                  row.filter.passed ? "text-foreground" : "line-through text-muted-foreground"
                }`}
              >
                {toFlag(row.countryId)} {row.cityKr}
              </span>

              {/* 월 비용 */}
              <span className="ml-auto text-muted-foreground shrink-0">
                ${row.monthlyCostUsd.toLocaleString()}
              </span>
            </div>

            {/* 탈락 사유 */}
            {row.filter.failReasons.length > 0 && (
              <div className="pl-4 space-y-0.5">
                {row.filter.failReasons.map((reason, i) => (
                  <div key={i} className="text-[10px] text-red-400/80 font-mono">
                    → {reason}
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
