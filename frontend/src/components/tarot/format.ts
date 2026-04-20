"use client";

import { useEffect, useState } from "react";

const FALLBACK_KRW_RATE = 1400;

let cachedRate: number | null = null;
let pendingPromise: Promise<number> | null = null;

export function useKrwRate(): number {
  const [rate, setRate] = useState<number>(cachedRate ?? FALLBACK_KRW_RATE);

  useEffect(() => {
    if (cachedRate !== null) {
      setRate(cachedRate);
      return;
    }

    if (!pendingPromise) {
      pendingPromise = fetch("/api/currency")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const krw =
            data && typeof data.krw === "number" && data.krw > 0
              ? data.krw
              : FALLBACK_KRW_RATE;
          cachedRate = krw;
          return krw;
        })
        .catch(() => {
          cachedRate = FALLBACK_KRW_RATE;
          return FALLBACK_KRW_RATE;
        });
    }

    pendingPromise.then((r) => setRate(r));
  }, []);

  return rate;
}

export function formatMonthly(
  usd: number,
  locale: string,
  krwRate: number = FALLBACK_KRW_RATE
): string {
  if (locale === "en") {
    return `$${Math.round(usd).toLocaleString("en-US")}`;
  }
  const krw = Math.round((usd * krwRate) / 10000);
  return `약 ${krw}만원`;
}

export function formatVisa(
  days: number | null | undefined,
  locale: string
): { label: string; value: string } {
  const isEn = locale === "en";
  if (days != null && days > 0) {
    return {
      label: "VISA-FREE",
      value: isEn ? `${days} days` : `${days}일`,
    };
  }
  return {
    label: "VISA",
    value: isEn ? "Required" : "필요",
  };
}

export function formatInternet(mbps: number | null | undefined): string {
  if (mbps == null) return "—";
  return `${mbps}Mbps`;
}

/**
 * visa_type 정규화 — 2단계 정제:
 *   1) 국가 prefix 제거 ("Colombia Digital Nomad Visa" → "Digital Nomad Visa")
 *   2) 한글 제거 (공식 비자명 = 영문 원칙)
 *      - "임시거주비자 (Temporary Resident Visa)" → "Temporary Resident Visa"
 *      - "Freiberufler (프리랜서 비자)" → "Freiberufler"
 *      - "MVV Zelfstandige (자영업 비자)" → "MVV Zelfstandige"
 *      - "특정활동 디지털 노마드 비자 (Specified Visa)" → "Specified Visa"
 *      - 한글이 전혀 없는 경우 (대부분) → 원문 그대로
 *      - 영문 대응이 없는 경우 ("없음 (솅겐 90일)") → 원문 그대로 (best-effort)
 *
 * 모든 locale에서 동일하게 영문 비자명 노출 — 공식성/식별성 우선.
 */
export function normalizeVisaType(
  visaType: string | null | undefined,
  country: string | null | undefined,
): string {
  if (!visaType) return "";

  // Step 1 — country prefix 제거
  let result = visaType;
  if (country) {
    const primaryName = country.split(" (")[0].trim();
    if (primaryName) {
      const prefix = primaryName + " ";
      if (result.startsWith(prefix)) result = result.slice(prefix.length);
    }
  }

  // Step 2 — 한글 제거 (양방향 괄호 패턴)
  const HANGUL = /[가-힣]/;
  if (HANGUL.test(result)) {
    // Pattern A: "영어 (한국어)" — 뒷 괄호에 한글 → 괄호 블록 제거
    const parenKorean = /\s*\([^)]*[가-힣][^)]*\)\s*/g;
    const cleaned = result.replace(parenKorean, " ").trim();

    if (cleaned && !HANGUL.test(cleaned)) {
      // 성공: 괄호 제거만으로 영문만 남음
      result = cleaned;
    } else {
      // Pattern B: "한국어 (영어)" — 앞 부분에 한글, 괄호 안에 영문
      const leadingKorean = /^[가-힣\s·,]+\(([^)]+)\)\s*$/;
      const m = leadingKorean.exec(result);
      if (m && !HANGUL.test(m[1])) {
        result = m[1].trim();
      }
      // 그 외 (대응 영문 없음) → 원문 유지 (best-effort)
    }
  }

  return result.replace(/\s+/g, " ").trim();
}

/**
 * city.climate (tropical/mediterranean/... 등 9종) → locale별 표기.
 * 한국어는 "기후" 접미사로 문장 자연스러움 확보.
 */
const CLIMATE_KO: Record<string, string> = {
  tropical: "열대 기후",
  subtropical: "아열대 기후",
  mediterranean: "지중해성 기후",
  continental: "대륙성 기후",
  maritime: "해양성 기후",
  temperate: "온대 기후",
  desert: "사막 기후",
  "semi-arid": "반건조 기후",
  highland: "고산 기후",
};

export function formatClimate(
  climate: string | null | undefined,
  locale: string,
): string | null {
  if (!climate) return null;
  if (locale === "ko") {
    return CLIMATE_KO[climate] ?? `${climate} 기후`;
  }
  // English: "tropical" → "Tropical", "semi-arid" → "Semi-arid"
  return climate.charAt(0).toUpperCase() + climate.slice(1);
}

// ── City tag system ────────────────────────────────────────────────
// 점수 산정 기준의 이질성(치안=외부지표 / 영어=내부판단)을 숫자로 병치하는
// 대신, 임계값 통과 시 qualitative 태그만 노출. 수치는 recommender 내부
// sort/filter에 그대로 사용. Method B: 임계 초과 폭 기준 top 3.

interface TagInput {
  safety_score?: number | null;
  english_score?: number | null;
  nomad_score?: number | null;
  coworking_score?: number | null;
  cowork_usd_month?: number | null;
  community_size?: string | null;
  korean_community_size?: string | null;
}

type TagKey =
  | "safety"
  | "nomad"
  | "english"
  | "coworking"
  | "community"
  | "korean_community"
  | "cowork_cheap";

interface TagCandidate {
  key: TagKey;
  margin: number; // 임계 초과 폭 (tie-break 보조)
  priority: number; // 낮을수록 우선
}

const TAG_PRIORITY: Record<TagKey, number> = {
  safety: 0,
  nomad: 1,
  english: 2,
  coworking: 3,
  community: 4,
  korean_community: 5,
  cowork_cheap: 6,
};

const TAG_LABELS: Record<TagKey, { ko: string; en: string }> = {
  safety: { ko: "안전", en: "Safe" },
  english: { ko: "영어권", en: "English OK" },
  nomad: { ko: "노마드 친화", en: "Nomad hub" },
  coworking: { ko: "코워킹 허브", en: "Cowork hub" },
  community: { ko: "커뮤니티 탄탄", en: "Big community" },
  korean_community: { ko: "한인 커뮤니티", en: "Korean hub" },
  cowork_cheap: { ko: "저렴한 코워킹", en: "Cheap cowork" },
};

const SAFETY_THRESHOLD = 7;
const ENGLISH_THRESHOLD = 9;
const NOMAD_THRESHOLD = 8;
const COWORKING_THRESHOLD = 8;
const COWORK_CHEAP_THRESHOLD_USD = 150;
const MAX_TAGS = 3;

export function computeCityTags(city: TagInput, locale: string): string[] {
  const candidates: TagCandidate[] = [];

  if ((city.safety_score ?? 0) >= SAFETY_THRESHOLD) {
    candidates.push({
      key: "safety",
      margin: (city.safety_score ?? 0) - SAFETY_THRESHOLD,
      priority: TAG_PRIORITY.safety,
    });
  }
  if ((city.english_score ?? 0) >= ENGLISH_THRESHOLD) {
    candidates.push({
      key: "english",
      margin: (city.english_score ?? 0) - ENGLISH_THRESHOLD,
      priority: TAG_PRIORITY.english,
    });
  }
  if ((city.nomad_score ?? 0) >= NOMAD_THRESHOLD) {
    candidates.push({
      key: "nomad",
      margin: (city.nomad_score ?? 0) - NOMAD_THRESHOLD,
      priority: TAG_PRIORITY.nomad,
    });
  }
  if ((city.coworking_score ?? 0) >= COWORKING_THRESHOLD) {
    candidates.push({
      key: "coworking",
      margin: (city.coworking_score ?? 0) - COWORKING_THRESHOLD,
      priority: TAG_PRIORITY.coworking,
    });
  }
  if (city.community_size === "large") {
    candidates.push({ key: "community", margin: 0, priority: TAG_PRIORITY.community });
  }
  if (city.korean_community_size === "large") {
    candidates.push({
      key: "korean_community",
      margin: 0,
      priority: TAG_PRIORITY.korean_community,
    });
  }
  if (
    city.cowork_usd_month != null &&
    city.cowork_usd_month <= COWORK_CHEAP_THRESHOLD_USD
  ) {
    candidates.push({
      key: "cowork_cheap",
      margin: COWORK_CHEAP_THRESHOLD_USD - city.cowork_usd_month,
      priority: TAG_PRIORITY.cowork_cheap,
    });
  }

  // 정렬: margin 내림차순, tie면 priority 오름차순
  candidates.sort((a, b) => b.margin - a.margin || a.priority - b.priority);

  const isEn = locale === "en";
  return candidates
    .slice(0, MAX_TAGS)
    .map((c) => (isEn ? TAG_LABELS[c.key].en : TAG_LABELS[c.key].ko));
}
