"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocale } from "next-intl";
import { Banknote, Stamp, Wifi, X, ChevronLeft, ChevronRight } from "lucide-react";
import TarotCard from "./TarotCard";
import type { CityData } from "./types";
import {
  useKrwRate,
  formatMonthly,
  formatVisa,
  formatInternet,
  normalizeVisaType,
  formatClimate,
} from "./format";
import { buildGoogleLoginUrl } from "@/lib/legal-content.mjs";
import {
  markLoginPending,
  trackLoginClick,
  trackResultCardInteraction,
} from "@/lib/analytics/events";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";

// ── Google logo (official brand SVG — HEX 하드코딩은 브랜드 에셋 예외) ─────

function GoogleLogo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="16" height="16" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

// ── Stage type ────────────────────────────────────────────────────

export type DeckStage = "selecting" | "revealing" | "done";

// ── Helpers ───────────────────────────────────────────────────────

const FLAG_EMOJI: Record<string, string> = {
  AD:"🇦🇩",AE:"🇦🇪",AL:"🇦🇱",AR:"🇦🇷",AT:"🇦🇹",AU:"🇦🇺",
  BE:"🇧🇪",BG:"🇧🇬",BR:"🇧🇷",CA:"🇨🇦",CH:"🇨🇭",CL:"🇨🇱",
  CN:"🇨🇳",CO:"🇨🇴",CR:"🇨🇷",CY:"🇨🇾",CZ:"🇨🇿",DE:"🇩🇪",
  DK:"🇩🇰",EE:"🇪🇪",EG:"🇪🇬",ES:"🇪🇸",FI:"🇫🇮",FR:"🇫🇷",
  GB:"🇬🇧",GE:"🇬🇪",GR:"🇬🇷",HR:"🇭🇷",HU:"🇭🇺",ID:"🇮🇩",
  IE:"🇮🇪",IL:"🇮🇱",IN:"🇮🇳",IS:"🇮🇸",IT:"🇮🇹",JP:"🇯🇵",
  KH:"🇰🇭",KR:"🇰🇷",MA:"🇲🇦",MK:"🇲🇰",MT:"🇲🇹",MX:"🇲🇽",
  MY:"🇲🇾",NL:"🇳🇱",NO:"🇳🇴",NZ:"🇳🇿",PA:"🇵🇦",PE:"🇵🇪",
  PH:"🇵🇭",PL:"🇵🇱",PT:"🇵🇹",RO:"🇷🇴",RS:"🇷🇸",SE:"🇸🇪",
  SG:"🇸🇬",SI:"🇸🇮",TH:"🇹🇭",TR:"🇹🇷",TW:"🇹🇼",UA:"🇺🇦",
  US:"🇺🇸",UY:"🇺🇾",VN:"🇻🇳",ZA:"🇿🇦",
};

// ── Personalized insight (ko only) ────────────────────────────────

function getPersonalizedInsight(
  persona: string | null,
  travelType: string | null,
  timeline: string | null,
  city: CityData,
): string | null {
  const tt = travelType ?? "";
  const hasCompanion =
    tt.includes("배우자") || tt.includes("파트너") || tt.includes("가족");

  // 1) 동반자 + 치안 >=8
  if (hasCompanion && city.safety_score != null && city.safety_score >= 8) {
    return `동반자와 함께라면 치안 ${city.safety_score}/10은 든든한 조건이에요.`;
  }
  // 2) 동반자 + 한인 커뮤니티 large
  if (hasCompanion && city.korean_community_size === "large") {
    return "한인 커뮤니티가 크게 형성되어 있어, 동반자와 함께 정착 초기에 도움이 돼요.";
  }
  // 3) free_spirit + tropical 계열 기후
  if (persona === "free_spirit" && city.climate?.includes("tropical")) {
    return "열대 기후는 자유로운 성향과 자연스럽게 맞아요.";
  }
  // 4) free_spirit + 무비자 90일+
  if (persona === "free_spirit" && city.visa_free_days >= 90) {
    return "비자 걱정 없이 90일, 자유롭게 머물 수 있는 조건이에요.";
  }
  // 5) free_spirit + 갱신 가능
  if (persona === "free_spirit" && city.renewable === true) {
    return "갱신 가능한 비자라 눌러앉고 싶어지면 그냥 있어도 돼요.";
  }
  // 6) 단기 체류 + 무비자 60일+
  if (timeline?.includes("단기") && city.visa_free_days >= 60) {
    return `단기 체류라면 비자 없이 바로 들어갈 수 있어요. (${city.visa_free_days}일)`;
  }
  return null;
}

// ── City Lightbox ─────────────────────────────────────────────────

interface LightboxCard {
  state: "front" | "locked";
  city: CityData | null;
  orderNumber: number; // 1-based, for locked teaser label
}

function CityLightbox({
  cards,
  startIndex,
  onClose,
}: {
  cards: LightboxCard[];
  startIndex: number;
  onClose: () => void;
}) {
  const locale = useLocale();
  const krwRate = useKrwRate();
  const [index, setIndex] = useState(startIndex);
  const current = cards[index] ?? cards[0];
  const directCheckoutUrl = process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL ?? null;
  const isEn = locale === "en";

  const goPrev = () => setIndex((i) => (i - 1 + cards.length) % cards.length);
  const goNext = () => setIndex((i) => (i + 1) % cards.length);

  // Keyboard: ESC + ← →
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIndex((i) => (i - 1 + cards.length) % cards.length);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setIndex((i) => (i + 1) % cards.length);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, cards.length]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Prev button (outside card left) */}
        <button
          type="button"
          onClick={goPrev}
          aria-label={isEn ? "Previous" : "이전"}
          className="shrink-0 w-8 h-8 flex items-center justify-center transition-colors"
          style={{ color: "rgba(255,255,255,0.8)" }}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Card wrapper (relative for external × positioning) */}
        <div className="relative">
          {/* × close — 카드 외부 우상단 (대각선 위) */}
          <button
            type="button"
            onClick={onClose}
            aria-label={isEn ? "Close" : "닫기"}
            className="absolute left-full bottom-full w-11 h-11 flex items-center justify-center transition-colors"
            style={{ color: "rgba(255,255,255,0.8)" }}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Card frame — 4:7 aspect, clamped by viewport on both axes */}
          <motion.div
            key={index}
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col overflow-hidden"
            style={{
              width: "min(320px, calc(100vw - 80px), calc((100vh - 80px) * 4 / 7))",
              aspectRatio: "4 / 7",
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              // 한국어 어절 중간에서 줄바꿈되는 CJK 기본 동작을 막고, 공백·구두점 경계에서만 wrap.
              // 영문은 기본대로 공백 기준, 너무 긴 영단어는 overflow-wrap으로 안전망.
              wordBreak: "keep-all",
              overflowWrap: "break-word",
            }}
          >
            {current.state === "front" && current.city ? (
              <LightboxFrontContent
                city={current.city}
                locale={locale}
                krwRate={krwRate}
              />
            ) : (
              <LightboxLockedTeaser
                orderNumber={current.orderNumber}
                locale={locale}
                checkoutUrl={directCheckoutUrl}
              />
            )}
          </motion.div>
        </div>

        {/* Next button (outside card right) */}
        <button
          type="button"
          onClick={goNext}
          aria-label={isEn ? "Next" : "다음"}
          className="shrink-0 w-8 h-8 flex items-center justify-center transition-colors"
          style={{ color: "rgba(255,255,255,0.8)" }}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}

// ── Lightbox Front Content (공개 카드) ─────────────────────────────

function LightboxFrontContent({
  city,
  locale,
  krwRate,
}: {
  city: CityData;
  locale: string;
  krwRate: number;
}) {
  const flag = FLAG_EMOJI[city.country_id] ?? "🌍";
  const monthly = formatMonthly(city.monthly_cost_usd, locale, krwRate);
  const visa = formatVisa(city.visa_free_days, locale);
  const internet = formatInternet(city.internet_mbps);

  // Personalized insight (ko only)
  const [personalInsight, setPersonalInsight] = useState<string | null>(null);
  useEffect(() => {
    if (locale !== "ko") {
      setPersonalInsight(null);
      return;
    }
    try {
      const persona = localStorage.getItem("persona_type");
      const sessionRaw = localStorage.getItem("result_session_v2");
      let travelType: string | null = null;
      let timeline: string | null = null;
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);
        const profile = session?.parsedData?._user_profile ?? {};
        travelType = typeof profile.travel_type === "string" ? profile.travel_type : null;
        timeline = typeof profile.timeline === "string" ? profile.timeline : null;
      }
      setPersonalInsight(getPersonalizedInsight(persona, travelType, timeline, city));
    } catch {
      setPersonalInsight(null);
    }
  }, [city, locale]);

  // Auth check — /auth/me 쿠키 세션
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setIsLoggedIn(Boolean(data?.logged_in));
      })
      .catch(() => {
        if (!cancelled) setIsLoggedIn(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleGoogleLogin() {
    const returnTo = typeof window !== "undefined" ? window.location.href : "";
    markLoginPending();
    trackLoginClick("google");
    window.location.assign(buildGoogleLoginUrl(API_BASE, returnTo));
  }

  const showLoginCta = locale === "ko" && isLoggedIn === false;
  const normalizedVisaType = normalizeVisaType(city.visa_type, city.country);
  const climateLabel = formatClimate(city.climate, locale);
  const isEn = locale === "en";

  // i18n 방어막 — 한국어 전용 데이터는 en locale에서 생략
  const showCityKr = !isEn && !!city.city_kr;
  const showCityInsight = !isEn && !!city.city_insight;
  const showCityDescription = !isEn && !!city.city_description;
  // visa_type에 한글 잔존(대응 영문 없는 "없음/무비자" 계열)이면 en locale에서 섹션 생략
  const showVisaSection =
    !!normalizedVisaType && !(isEn && /[가-힣]/.test(normalizedVisaType));

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Header — flag + city */}
      <div className="flex flex-col items-center pt-5 pb-3 px-5">
        <span style={{ fontSize: 32 }}>{flag}</span>
        {showCityKr && (
          <h2 className="font-serif text-base font-bold mt-1.5" style={{ color: "var(--foreground)" }}>
            {city.city_kr}
          </h2>
        )}
        <p
          className="font-mono text-[11px] mt-0.5"
          style={{
            color: "var(--muted-foreground)",
            // en locale에서 city_kr 없이 city만 있을 땐 폰트 크기 올려 비중 보정
            fontSize: isEn ? 13 : undefined,
            marginTop: isEn ? 6 : undefined,
          }}
        >
          {city.city}, {city.country}
        </p>
      </div>

      {/* Primary metrics — 3x3 grid */}
      <div
        className="grid grid-cols-3 gap-y-0.5 font-mono text-center px-5 py-3"
        style={{
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          justifyItems: "center",
          alignItems: "center",
        }}
      >
        <Banknote className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
        <Stamp className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
        <Wifi className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />

        <span className="text-[10px] uppercase leading-tight" style={{ color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>MONTHLY</span>
        <span className="text-[10px] uppercase leading-tight" style={{ color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>{visa.label}</span>
        <span className="text-[10px] uppercase leading-tight" style={{ color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>INTERNET</span>

        <span className="text-[13px] font-bold leading-tight" style={{ color: "var(--foreground)" }}>{monthly}</span>
        <span className="text-[13px] font-bold leading-tight" style={{ color: "var(--foreground)" }}>{visa.value}</span>
        <span className="text-[13px] font-bold leading-tight" style={{ color: "var(--foreground)" }}>{internet}</span>
      </div>

      {/* Body — flex-col, no scroll. Spacer pushes CTA to bottom */}
      <div className="flex-1 min-h-0 flex flex-col gap-3 px-5 pt-3 pb-4 text-xs">
        {/* 1. 비자 section — heading + {name | link} + 조건 라인 */}
        {showVisaSection && (
          <div className="flex flex-col gap-1">
            <h3
              className="font-serif text-[13px] font-bold"
              style={{ color: "var(--foreground)" }}
            >
              {isEn ? "Recommended Visa" : "추천 비자"}
            </h3>
            <div className="flex items-baseline justify-between gap-2">
              <p className="leading-tight" style={{ color: "var(--foreground)" }}>
                {normalizedVisaType}
              </p>
              {city.visa_url && (
                <a
                  href={city.visa_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-[11px]"
                  style={{
                    color: "var(--muted-foreground)",
                    textDecoration: "underline",
                    textUnderlineOffset: "2px",
                  }}
                >
                  {isEn ? "Check visa →" : "비자 확인하기 →"}
                </a>
              )}
            </div>
            {(city.stay_months != null || city.renewable != null) && (
              <p
                className="font-mono text-[11px]"
                style={{ color: "var(--muted-foreground)", letterSpacing: "0.03em" }}
              >
                {city.stay_months != null &&
                  (isEn ? `Max stay ${city.stay_months} months` : `최대 체류 ${city.stay_months}개월`)}
                {city.stay_months != null && city.renewable != null && " · "}
                {city.renewable === true && (isEn ? "Renewable" : "연장 가능")}
                {city.renewable === false && (isEn ? "Non-renewable" : "연장 불가")}
              </p>
            )}
          </div>
        )}

        {/* 2. City insight — 도시 한 줄 slogan (ko only, 영어 번역 데이터 미보유) */}
        {showCityInsight && (
          <div style={{ borderLeft: "2px solid var(--primary)", paddingLeft: 10 }}>
            <p className="text-xs italic leading-snug" style={{ color: "var(--primary)" }}>
              {city.city_insight}
            </p>
          </div>
        )}

        {/* 3. Personalized insight — 유저 맞춤 (ko only) */}
        {personalInsight && (
          <p className="font-serif text-xs leading-snug" style={{ color: "var(--primary)" }}>
            ✦ {personalInsight}
          </p>
        )}

        {/* 4. City description — 2–3줄 도시 소개 (ko only, 영어 번역 데이터 미보유) */}
        {showCityDescription && (
          <p className="leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            {city.city_description}
          </p>
        )}

        {/* 5. Scores — pill row (Primary 3과 1:1 대응하는 Secondary qualifier 3개) */}
        {(city.safety_score != null || city.english_score != null || climateLabel) && (
          <div className="flex flex-wrap gap-1.5">
            {city.safety_score != null && (
              <span
                className="inline-flex items-center px-2 py-0.5 font-mono text-[10px]"
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 9999,
                  color: "var(--muted-foreground)",
                  letterSpacing: "0.03em",
                }}
              >
                {isEn ? `Safety ${city.safety_score}/10` : `치안 ${city.safety_score}/10`}
              </span>
            )}
            {city.english_score != null && (
              <span
                className="inline-flex items-center px-2 py-0.5 font-mono text-[10px]"
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 9999,
                  color: "var(--muted-foreground)",
                  letterSpacing: "0.03em",
                }}
              >
                {isEn ? `English ${city.english_score}/10` : `영어 ${city.english_score}/10`}
              </span>
            )}
            {climateLabel && (
              <span
                className="inline-flex items-center px-2 py-0.5 font-mono text-[10px]"
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 9999,
                  color: "var(--muted-foreground)",
                  letterSpacing: "0.03em",
                }}
              >
                {climateLabel}
              </span>
            )}
          </div>
        )}

        {/* 6. External links — 브랜드만 dot-joined 한 줄 (Flatio · Anyplace · Meetup) */}
        {(() => {
          const links: { url: string; label: string }[] = [];
          if (city.flatio_search_url) links.push({ url: city.flatio_search_url, label: "Flatio" });
          if (city.anyplace_search_url) links.push({ url: city.anyplace_search_url, label: "Anyplace" });
          if (city.nomad_meetup_url) links.push({ url: city.nomad_meetup_url, label: "Meetup" });
          if (links.length === 0) return null;
          return (
            <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
              {links.map((l, i) => (
                <Fragment key={l.url}>
                  {i > 0 && " · "}
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--primary)" }}
                  >
                    {l.label}
                  </a>
                </Fragment>
              ))}
            </p>
          );
        })()}

        {/* Spacer — pushes CTA down */}
        <div className="flex-1" />

        {/* Primary login CTA (ko + logged-out only) — 정보 텍스트 + Google Dark Theme 버튼 */}
        {showLoginCta && (
          <div className="flex flex-col gap-2">
            <h3
              className="font-serif text-[13px] font-bold leading-tight"
              style={{ color: "var(--foreground)" }}
            >
              로그인하고 맞춤 노마드 로드맵 받기
            </h3>
            {/* Google Sign-In 공식 Dark Theme — HEX 직접 사용 (상표권 예외) */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 text-[14px] font-medium transition-opacity hover:opacity-90"
              style={{
                background: "#131314",
                color: "#E3E3E3",
                border: "1px solid #8E918F",
                borderRadius: 6,
                fontFamily: "'Roboto', 'Noto Sans KR', sans-serif",
                paddingLeft: 12,
                paddingRight: 12,
              }}
            >
              <GoogleLogo />
              <span>Google로 계속하기</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Lightbox Locked Teaser (잠금 카드 — 추론 방지 skeleton) ────────

function LightboxLockedTeaser({
  orderNumber,
  locale,
  checkoutUrl,
}: {
  orderNumber: number;
  locale: string;
  checkoutUrl: string | null;
}) {
  const isEn = locale === "en";
  const label = isEn
    ? `PREMIUM PICK #${orderNumber}`
    : `Pro 전용 카드 #${orderNumber}`;
  const ctaText = isEn ? "Unlock all cities with Pro" : "Pro로 모든 도시 보기";

  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-between px-6 py-8">
      {/* Top — lock icon + order label */}
      <div className="flex flex-col items-center gap-3">
        <span style={{ fontSize: 48, opacity: 0.5 }}>🔒</span>
        <p
          className="font-mono text-[11px] uppercase"
          style={{ color: "var(--muted-foreground)", letterSpacing: "0.15em" }}
        >
          {label}
        </p>
      </div>

      {/* Middle — skeleton blocks (fixed shapes, 도시별 편차 없음) */}
      <div className="w-full flex flex-col items-center gap-5">
        <div className="w-full flex flex-col items-center gap-2">
          <div
            className="h-3.5 w-2/3 rounded"
            style={{ background: "color-mix(in srgb, var(--muted-foreground) 15%, transparent)" }}
          />
          <div
            className="h-2.5 w-1/2 rounded"
            style={{ background: "color-mix(in srgb, var(--muted-foreground) 10%, transparent)" }}
          />
        </div>

        <div
          className="w-full grid grid-cols-3 gap-3 py-3"
          style={{
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div
                className="h-3.5 w-3.5 rounded"
                style={{ background: "color-mix(in srgb, var(--muted-foreground) 20%, transparent)" }}
              />
              <div
                className="h-1.5 w-8 rounded"
                style={{ background: "color-mix(in srgb, var(--muted-foreground) 10%, transparent)" }}
              />
              <div
                className="h-2.5 w-6 rounded"
                style={{ background: "color-mix(in srgb, var(--muted-foreground) 18%, transparent)" }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom — Pro CTA */}
      {checkoutUrl ? (
        <a
          href={checkoutUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackResultCardInteraction({ action: "unlock_click" })}
          className="w-full py-2.5 text-center font-mono text-xs font-medium"
          style={{
            background: "var(--primary)",
            color: "var(--primary-foreground)",
            borderRadius: 4,
            letterSpacing: "0.03em",
          }}
        >
          {ctaText}
        </a>
      ) : (
        <div className="w-full py-2.5" />
      )}
    </div>
  );
}


// ── Props ─────────────────────────────────────────────────────────

interface TarotDeckProps {
  stage: DeckStage;
  cities: CityData[];
  selectedIndices: number[];
  revealedCities: CityData[] | null;
  flippedIndices: number[];
  onToggleSelect: (index: number) => void;
  onConfirm: () => void;
  onRetry: () => void;
  onGuideClick: () => void;
  isLoading: boolean;
}

const MAX_SELECT = 3;

export default function TarotDeck({
  stage,
  cities,
  selectedIndices,
  revealedCities,
  flippedIndices,
  onToggleSelect,
  onConfirm,
  onRetry,
  onGuideClick,
  isLoading,
}: TarotDeckProps) {
  const count = cities.length;
  const allSelected = selectedIndices.length === MAX_SELECT;
  const isSelecting = stage === "selecting";
  const isRevealing = stage === "revealing";
  const isDone = stage === "done";
  const isPostReveal = isRevealing || isDone;

  // ── Lightbox state ──────────────────────────────────────────────

  const [lightboxStartIndex, setLightboxStartIndex] = useState<number | null>(null);
  const locale = useLocale();

  // ── Per-card helpers ────────────────────────────────────────────

  function getCardState(i: number): "back" | "front" | "locked" {
    if (!isPostReveal) return "back";
    return selectedIndices.includes(i) ? "front" : "locked";
  }

  function getCityForCard(i: number): CityData | null {
    if (!isPostReveal || !revealedCities) return null;
    const pos = selectedIndices.indexOf(i);
    return pos >= 0 ? (revealedCities[pos] ?? null) : null;
  }

  function isCardFlipped(i: number): boolean {
    if (!isPostReveal) return false;
    const seqIdx = selectedIndices.indexOf(i);
    return seqIdx >= 0 && flippedIndices.includes(seqIdx);
  }

  // ── Lightbox cards (5장 전체, 공개/잠금 혼합) ───────────────────

  const lightboxCards: LightboxCard[] = useMemo(() => {
    if (!isPostReveal) return [];
    return Array.from({ length: count }, (_, i) => {
      const pos = selectedIndices.indexOf(i);
      const isFront = pos >= 0;
      const city = isFront ? (revealedCities?.[pos] ?? null) : null;
      return {
        state: isFront ? ("front" as const) : ("locked" as const),
        city,
        orderNumber: i + 1,
      };
    });
  }, [count, isPostReveal, revealedCities, selectedIndices]);

  // ── Render card ─────────────────────────────────────────────────

  function renderCard(i: number) {
    const state = getCardState(i);
    const city = getCityForCard(i);
    const flipped = isCardFlipped(i);
    const isSelected = selectedIndices.includes(i);

    const handleClick = () => {
      if (isSelecting && !isLoading) {
        onToggleSelect(i);
      } else if (isDone) {
        if (isSelected && city) {
          trackResultCardInteraction({
            action: "open_city",
            cityId: city.id ?? undefined,
          });
        } else if (!isSelected) {
          trackResultCardInteraction({ action: "open_locked" });
        }
        setLightboxStartIndex(i);
      }
    };

    return (
      <TarotCard
        key={i}
        state={state}
        size="sm"
        cityData={city}
        isSelected={isSelecting && isSelected}
        isFlipped={flipped}
        onClick={(isSelecting || isDone) ? handleClick : undefined}
      />
    );
  }

  // ── Layout ──────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center">
      {/* Cards — fixed position */}
      <div>
        <div className="hidden md:flex justify-center gap-3">
          {Array.from({ length: count }, (_, i) => renderCard(i))}
        </div>
        <div className="flex flex-col items-center gap-3 md:hidden">
          <div className="flex justify-center gap-3">
            {Array.from({ length: Math.min(3, count) }, (_, i) => renderCard(i))}
          </div>
          {count > 3 && (
            <div className="flex justify-center gap-3">
              {Array.from({ length: count - 3 }, (_, j) => renderCard(j + 3))}
            </div>
          )}
        </div>
      </div>

      {/* CTA area — fixed height with spacing from cards */}
      <div className="mt-8 h-20 flex items-center justify-center">
        <AnimatePresence>
          {isSelecting && allSelected && (
            <motion.button
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className="px-8 py-3 text-sm font-semibold"
              style={{
                background: "var(--primary)",
                color: "var(--primary-foreground)",
                opacity: isLoading ? 0.5 : 1,
                boxShadow: "0 0 16px 2px color-mix(in srgb, var(--primary) 25%, transparent)",
                transition: "opacity 0.3s ease",
              }}
            >
              {isLoading ? "도시를 불러오고 있어요..." : "카드 열기"}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Done: hint + actions */}
      {isDone && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center gap-4"
        >
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            카드를 탭하면 상세 정보를 볼 수 있어요
          </p>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onGuideClick}
              className="px-5 py-2 text-xs font-medium transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              전체 가이드 받기
            </button>
            <button
              type="button"
              onClick={onRetry}
              className="text-xs transition-colors"
              style={{ color: "var(--muted-foreground)" }}
            >
              처음부터 다시하기
            </button>
          </div>
        </motion.div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxStartIndex !== null && lightboxCards.length > 0 && (
          <CityLightbox
            cards={lightboxCards}
            startIndex={lightboxStartIndex}
            onClose={() => setLightboxStartIndex(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
