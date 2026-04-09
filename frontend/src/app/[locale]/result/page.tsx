"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { ShieldCheck, Wifi, Languages } from "lucide-react";

// -- Types --

interface CityData {
  city: string;
  city_kr: string;
  country: string;
  country_id: string;
  visa_type: string;
  visa_url: string;
  monthly_cost_usd: number;
  score: number;
  plan_b_trigger: boolean;
  climate: string | null;
  data_verified_date: string | null;
  city_description: string | null;
  city_insight: string | null;
  internet_mbps: number | null;
  safety_score: number | null;
  english_score: number | null;
  nomad_score: number | null;
  cowork_usd_month: number | null;
  community_size: string | null;
  korean_community_size: string | null;
  mid_term_rent_usd: number | null;
  flatio_search_url: string | null;
  anyplace_search_url: string | null;
  nomad_meetup_url: string | null;
  entry_tips: Record<string, unknown> | null;
  visa_free_days: number;
  stay_months: number | null;
  renewable: boolean | null;
  key_docs: string[] | null;
  visa_fee_usd: number | null;
  tax_note: string | null;
  double_tax_treaty_with_kr: boolean | null;
  visa_notes: string[] | null;
}

interface UserProfile {
  persona_type?: string;
  travel_type?: string;
  lifestyle?: string[];
  timeline?: string;
  income_krw?: number;
  [key: string]: unknown;
}

interface RecommendResult {
  markdown: string;
  cities: CityData[];
  parsed: {
    top_cities: CityData[];
    overall_warning: string;
    _user_profile: UserProfile;
    debug_logs?: {
      score_model?: string;
      selected?: Array<{
        rank: number;
        city: string;
        city_kr?: string;
        country: string;
        country_id: string;
        final_score: number;
        blocks: {
          block_a: number;
          block_b: number;
          block_c: number;
          block_d: number;
        };
        wellbeing?: {
          total: number;
          safety: number;
          affordability: number;
          community: number;
          nomad_fit: number;
          english_env: number;
          stale_penalty: number;
        };
      }>;
      inputs?: Record<string, unknown>;
      selection_rule?: string;
    };
  };
}

const DEBUG_MODE = ["1", "true", "yes", "on"].includes(
  (process.env.NEXT_PUBLIC_DEBUG_MODE ?? "").toLowerCase()
);

// -- Persona Labels --

const personaLabel: Record<string, string> = {
  wanderer: "자유로운 유목민",
  local: "따뜻한 현지인",
  planner: "전략적 개척자",
  free_spirit: "자유로운 영혼",
  pioneer: "용감한 개척자",
};

// -- Currency Utils --

const USD_TO_KRW = 1400;

function toKRW(usd: number): string {
  const manwon = Math.round((usd * USD_TO_KRW) / 10000);
  return `약 ${manwon}만원`;
}

function costRatio(monthly_cost_usd: number, income_krw: number): number {
  const income_usd = (income_krw * 10000) / USD_TO_KRW;
  if (income_usd <= 0) return 0;
  return Math.round((monthly_cost_usd / income_usd) * 100);
}

// -- Insight (중복 방지) --

interface InsightRule {
  test: (c: CityData) => boolean;
  text: string;
}

const INSIGHT_RULES: InsightRule[] = [
  { test: (c) => c.korean_community_size === "large" && (c.nomad_score ?? 0) >= 8, text: "한국인 노마드가 많이 선택한 도시." },
  { test: (c) => c.korean_community_size === "large" && (c.english_score ?? 0) >= 7, text: "한인 커뮤니티와 영어 소통 모두 가능." },
  { test: (c) => (c.safety_score ?? 0) >= 8 && (c.mid_term_rent_usd ?? 9999) <= 800, text: "높은 치안, 합리적 임대료." },
  { test: (c) => (c.internet_mbps ?? 0) >= 150 && (c.cowork_usd_month ?? 9999) <= 200, text: "빠른 인터넷, 저렴한 코워킹." },
  { test: (c) => c.double_tax_treaty_with_kr === true, text: "한국과 이중과세 방지 협약 체결국." },
  { test: (c) => (c.nomad_score ?? 0) >= 9, text: "전 세계 노마드가 검증한 도시." },
  { test: (c) => (c.stay_months ?? 0) >= 12 && c.renewable === true, text: "장기 체류 + 비자 갱신 가능." },
  { test: (c) => c.visa_fee_usd === 0 && (c.stay_months ?? 0) >= 3, text: "무료 비자, 장기 체류 가능." },
];

function getInsight(city: CityData, used: Set<string>): string {
  for (const rule of INSIGHT_RULES) {
    if (rule.test(city) && !used.has(rule.text)) {
      used.add(rule.text);
      return rule.text;
    }
  }
  return "현실적으로 선택 가능한 노마드 거점.";
}

// -- Advice Generator (최대 2개) --

function getAdvice(city: CityData, profile: UserProfile, used: Set<string>): string[] {
  const sentences: string[] = [];
  const incomeKrw = profile.income_krw ?? 0;
  const travel = profile.travel_type || "";
  const lifestyle = profile.lifestyle || [];
  const persona = profile.persona_type || "";
  const timeline = profile.timeline || "";

  // 소득 대비 생활비 (항상 첫 번째, income_krw > 0일 때만)
  if (incomeKrw > 0) {
    const ratio = costRatio(city.monthly_cost_usd, incomeKrw);
    const comment = ratio <= 30
      ? "여유롭게 생활할 수 있는 수준이에요."
      : ratio <= 50
        ? "충분히 생활 가능한 수준이에요."
        : "빠듯할 수 있으니 예산 계획이 필요해요.";
    const s = `월 생활비는 소득의 약 ${ratio}%예요. ${comment}`;
    if (!used.has(s)) {
      used.add(s);
      sentences.push(s);
    }
  }

  // 나머지 조건 — 미사용 매칭을 순서대로 추가
  const extras: string[] = [];

  // 동행 유형
  if (travel.includes("혼자") && (city.safety_score ?? 0) >= 8)
    extras.push("치안이 좋아 혼자 처음 시작하기에 검증된 환경이에요.");
  if (travel.includes("배우자") && city.korean_community_size === "large")
    extras.push("한국인 커뮤니티가 커서 둘이 정착 초반에 도움받기 수월해요.");
  if (travel.includes("자녀") && (city.safety_score ?? 0) >= 8)
    extras.push("치안이 안정적이어서 자녀와 함께 생활하기에 무리 없어요.");
  // 라이프스타일
  if (lifestyle.includes("카페 문화") && (city.cowork_usd_month ?? 9999) <= 250)
    extras.push(`코워킹도 월 ${toKRW(city.cowork_usd_month ?? 0)}대면 좋은 공간을 쓸 수 있어요.`);
  if (lifestyle.includes("영어권") && (city.english_score ?? 0) >= 7)
    extras.push("영어로 일상 대부분을 해결할 수 있어요.");
  if (lifestyle.includes("영어권") && (city.english_score ?? 10) < 6)
    extras.push("영어 통용도가 낮은 편이에요. 현지 언어 기초가 도움이 될 수 있어요.");
  if (lifestyle.includes("코워킹 스페이스") && (city.cowork_usd_month ?? 9999) <= 200)
    extras.push(`코워킹 월 ${toKRW(city.cowork_usd_month ?? 0)}로 인프라가 잘 갖춰져 있어요.`);
  // 페르소나
  if (persona === "wanderer" && (city.stay_months ?? 99) <= 3)
    extras.push("짧게 머물고 이동하는 스타일에 맞는 비자 구조예요.");
  if (persona === "local" && city.korean_community_size === "large")
    extras.push("한국인 커뮤니티가 있어 천천히 정착하기 수월해요.");
  if (persona === "planner" && (city.cowork_usd_month ?? 9999) <= 200)
    extras.push("지출을 최소화하면서 일하기 좋은 환경이에요.");
  if (persona === "free_spirit" && (city.safety_score ?? 0) >= 8)
    extras.push("조용하고 안전한 환경에서 충분히 쉴 수 있어요.");
  if (persona === "pioneer" && city.renewable === true)
    extras.push("갱신 가능한 비자로 장기 루트를 설계할 수 있어요.");
  // 체류 기간
  if (timeline === "영주권/이민 목표" && city.renewable === true)
    extras.push("갱신을 반복하며 장기 체류 기반을 잡을 수 있어요.");
  if (timeline?.includes("단기") && city.visa_fee_usd === 0)
    extras.push("비자 비용 없이 단기 체험이 가능한 구조예요.");
  // 범용 보강 조건
  if (city.double_tax_treaty_with_kr === true)
    extras.push("한국과 이중과세 방지 협약이 체결돼 있어 세금 처리가 명확해요.");
  if (city.renewable === true && (city.stay_months ?? 0) >= 12)
    extras.push("갱신 가능한 비자로 장기 루트를 설계할 수 있어요.");
  if (city.cowork_usd_month != null && city.cowork_usd_month <= 250)
    extras.push(`코워킹도 월 ${toKRW(city.cowork_usd_month)}대면 좋은 공간을 쓸 수 있어요.`);
  if (city.mid_term_rent_usd != null && city.mid_term_rent_usd <= 700)
    extras.push(`중기 임대도 월 ${toKRW(city.mid_term_rent_usd)}대로 구할 수 있어요.`);

  for (const e of extras) {
    if (!used.has(e)) {
      used.add(e);
      sentences.push(e);
      if (sentences.length >= 3) break;
    }
  }

  return sentences.slice(0, 3);
}

// -- Component --

const rankBadge = ["1st", "2nd", "3rd"];

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const, delay } },
});

export default function ResultPage() {
  const router = useRouter();
  const [result] = useState<RecommendResult | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = sessionStorage.getItem("nnai_result");
    if (!stored) return null;
    try {
      return JSON.parse(stored) as RecommendResult;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!result) {
      router.replace("/onboarding/quiz");
    }
  }, [result, router]);

  if (!result) return null;

  function handleRetry() {
    sessionStorage.removeItem("nnai_result");
    localStorage.removeItem("persona_type");
    router.push("/onboarding/quiz");
  }

  const citiesRaw = result.cities;
  const topCitiesRaw = result.parsed.top_cities;
  const cities = (citiesRaw?.[0]?.internet_mbps != null ? citiesRaw : topCitiesRaw) || [];
  const overallWarning = result.parsed.overall_warning;
  const userProfile = result.parsed._user_profile || {};
  const debugLogs = result.parsed.debug_logs;
  const personaType = (userProfile.persona_type as string) || "";
  const label = personaLabel[personaType] || "";

  const usedInsights = new Set<string>();
  const usedAdvice = new Set<string>();

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      {/* 헤더 */}
      <motion.div {...fadeUp(0)} className="mb-8">
        {label && (
          <p className="text-sm text-muted-foreground mb-1">
            {label}에게 어울리는 도시를 찾았어요.
          </p>
        )}
        <h1 className="text-2xl font-bold text-foreground">
          당신에게 맞는 도시 TOP 3
        </h1>
      </motion.div>

      {DEBUG_MODE && (
        <motion.aside
          {...fadeUp(0.05)}
          className="pointer-events-none fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:right-4 sm:w-[26rem]"
        >
          <details className="pointer-events-auto max-h-[65vh] overflow-hidden rounded-lg border border-white/25 bg-black/35 text-xs text-white shadow-2xl backdrop-blur-md">
            <summary className="cursor-pointer px-3 py-2 font-semibold">
              Developer Log Panel (Top3 Selection)
            </summary>
            <div className="max-h-[58vh] overflow-y-auto px-3 pb-3">
              {!debugLogs && (
                <p className="mt-2 text-white/75">
                  debug_logs가 없습니다. 백엔드 `DEBUG_MODE=1` 설정을 확인하세요.
                </p>
              )}
              {debugLogs && (
                <div className="mt-2 space-y-3">
                  <p className="text-white/70">
                    model: {debugLogs.score_model ?? "unknown"}
                  </p>
                  {(debugLogs.selected ?? []).map((row) => (
                    <div key={`${row.rank}-${row.country_id}-${row.city}`} className="rounded border border-white/20 bg-black/30 p-2">
                      <p className="font-medium">
                        #{row.rank} {row.city_kr || row.city} ({row.country_id}) - {row.final_score}/10
                      </p>
                      <p className="text-white/75">
                        A:{row.blocks.block_a.toFixed(2)} / B:{row.blocks.block_b.toFixed(2)} / C:{row.blocks.block_c.toFixed(2)} / D:{row.blocks.block_d.toFixed(2)}
                      </p>
                      {row.wellbeing && (
                        <p className="text-white/70">
                          W:{row.wellbeing.total.toFixed(2)} (S:{row.wellbeing.safety.toFixed(1)} A:{row.wellbeing.affordability.toFixed(1)} C:{row.wellbeing.community.toFixed(1)} N:{row.wellbeing.nomad_fit.toFixed(1)} E:{row.wellbeing.english_env.toFixed(1)} P:-{row.wellbeing.stale_penalty.toFixed(1)})
                        </p>
                      )}
                    </div>
                  ))}
                  {debugLogs.selection_rule && (
                    <p className="text-white/75">
                      rule: {debugLogs.selection_rule}
                    </p>
                  )}
                  {debugLogs.inputs && (
                    <pre className="overflow-x-auto rounded border border-white/20 bg-black/30 p-2 text-[11px] leading-4 text-white/85">
                      {JSON.stringify(debugLogs.inputs, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </details>
        </motion.aside>
      )}

      {/* 도시 카드 */}
      {cities.map((city, i) => {
        const advice = getAdvice(city, userProfile, usedAdvice);

        return (
          <motion.div
            key={city.city}
            {...fadeUp(0.2 + i * 0.2)}
            className="border border-border border-l-4 border-l-primary bg-card p-5 mb-6"
          >
            {/* 1. 순위 + 도시명 + 국가 */}
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {rankBadge[i]}
              </span>
              <span className="text-lg font-bold text-foreground">
                {city.city_kr}
              </span>
              <span className="text-sm text-muted-foreground">
                {city.country}
              </span>
            </div>

            {/* 2. 인사이트 */}
            <div className="border-l-2 border-primary pl-3 mt-3 mb-3">
              <p className="text-sm text-primary italic">
                {city.city_insight || getInsight(city, usedInsights)}
              </p>
            </div>

            <div className="border-t border-border my-3" />

            {/* 3. 정보 블록 */}
            <div className="space-y-2 text-sm text-muted-foreground">
              <span className="inline-block rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground mr-2">
                {city.visa_free_days > 0 && city.plan_b_trigger
                  ? `🛂 무비자 90일 (셴겐)`
                  : city.visa_free_days > 0
                  ? `🛂 무비자 ${city.visa_free_days}일`
                  : `🛂 비자 필요`}
              </span>
              <p>
                {"비자: "}{city.visa_type}
                {city.stay_months != null && ` · ${city.stay_months}개월`}
                {` · ${city.renewable ? "갱신 가능" : "갱신 불가"}`}
              </p>
              <p>{"예산: "}{toKRW(city.monthly_cost_usd)} / 월</p>

              {(city.safety_score != null || city.internet_mbps != null || city.english_score != null) && (<>
                <div className="border-t border-border my-3" />
                <div className="grid grid-cols-3 text-xs text-muted-foreground">
                  {city.safety_score != null && <span className="inline-flex items-center gap-1"><ShieldCheck className="size-3" />치안 {city.safety_score}/10</span>}
                  {city.internet_mbps != null && <span className="inline-flex items-center gap-1"><Wifi className="size-3" />{city.internet_mbps}Mbps</span>}
                  {city.english_score != null && <span className="inline-flex items-center gap-1"><Languages className="size-3" />영어 {city.english_score}/10</span>}
                </div>
              </>)}
            </div>

            <div className="border-t border-border my-3" />

            {/* 4. 서술 블록 */}
            {city.city_description && (
              <p className="text-sm text-foreground leading-relaxed indent-2">
                {city.city_description}
              </p>
            )}
            {advice.length > 0 && (
              <p className="text-sm text-foreground leading-relaxed indent-2 mt-2">
                {advice.join(" ")}
              </p>
            )}

            <div className="border-t border-border my-3" />

            {/* 5. 링크 */}
            <div className="flex gap-4">
              {city.visa_url && (
                <a
                  href={city.visa_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  비자 정보 →
                </a>
              )}
              {city.flatio_search_url && (
                <a
                  href={city.flatio_search_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  숙소 찾기 →
                </a>
              )}
              <button
                type="button"
                onClick={() => alert("준비 중이에요.")}
                className="text-sm font-medium text-foreground hover:underline"
              >
                더 알아보기 →
              </button>
            </div>

            {/* 7. 데이터 출처 */}
            {city.data_verified_date && (
              <p className="text-xs text-muted-foreground/50 mt-2">
                {"데이터 기준: "}{city.data_verified_date}{" · Numbeo, NomadList"}
              </p>
            )}
          </motion.div>
        );
      })}

      {/* 전체 경고 */}
      {overallWarning && (
        <motion.div {...fadeUp(0.8)} className="bg-muted p-3 text-xs text-muted-foreground mb-6">
          {overallWarning}
        </motion.div>
      )}

      {/* 하단 CTA */}
      <motion.div {...fadeUp(1.0)}>
        <button
          type="button"
          onClick={handleRetry}
          className="w-full py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          처음부터 다시하기
        </button>
      </motion.div>
    </div>
  );
}
