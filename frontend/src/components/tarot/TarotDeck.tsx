"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocale } from "next-intl";
import { Banknote, Stamp, Wifi, X } from "lucide-react";
import TarotCard from "./TarotCard";
import type { CityData } from "./types";
import {
  useKrwRate,
  formatMonthly,
  formatVisa,
  formatInternet,
} from "./format";
import { buildGoogleLoginUrl } from "@/lib/legal-content.mjs";
import { markLoginPending, trackLoginClick } from "@/lib/analytics/events";

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

function CityLightbox({
  city,
  onClose,
}: {
  city: CityData;
  onClose: () => void;
}) {
  const locale = useLocale();
  const krwRate = useKrwRate();
  const flag = FLAG_EMOJI[city.country_id] ?? "🌍";
  const monthly = formatMonthly(city.monthly_cost_usd, locale, krwRate);
  const visa = formatVisa(city.visa_free_days, locale);
  const internet = formatInternet(city.internet_mbps);

  // ESC key to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Personalized insight — read localStorage, compose one-liner (ko only)
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

  // Auth check — /auth/me (쿠키 세션). 로그인된 유저에겐 CTA 숨김
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled) setIsLoggedIn(Boolean(data?.logged_in)); })
      .catch(() => { if (!cancelled) setIsLoggedIn(false); });
    return () => { cancelled = true; };
  }, []);

  function handleGoogleLogin() {
    const returnTo = typeof window !== "undefined" ? window.location.href : "";
    markLoginPending();
    trackLoginClick("google");
    window.location.assign(buildGoogleLoginUrl(API_BASE, returnTo));
  }

  const showLoginCta = locale === "ko" && isLoggedIn === false;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="relative w-full max-w-sm max-h-[85vh] flex flex-col"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* X close button — fixed to panel top-right, outside scroll, 44px touch target */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-1 top-1 z-10 flex items-center justify-center transition-colors"
          style={{ width: 44, height: 44, color: "var(--muted-foreground)" }}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Scrollable content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Header */}
          <div className="flex flex-col items-center pt-8 pb-4 px-6">
            <span style={{ fontSize: 40 }}>{flag}</span>
            <h2 className="font-serif text-xl font-bold mt-2" style={{ color: "var(--foreground)" }}>
              {city.city_kr}
            </h2>
            <p className="font-mono text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {city.city}, {city.country}
            </p>
          </div>

          {/* Metrics — always 3 cells for layout consistency */}
          <div className="flex font-mono text-center px-6 py-4"
            style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}
          >
            <div className="flex-1 min-w-0 flex flex-col items-center gap-1">
              <Banknote className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
              <span className="text-xs uppercase" style={{ color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>MONTHLY</span>
              <span className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{monthly}</span>
            </div>
            <div className="flex-1 min-w-0 flex flex-col items-center gap-1">
              <Stamp className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
              <span className="text-xs uppercase" style={{ color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>{visa.label}</span>
              <span className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{visa.value}</span>
            </div>
            <div className="flex-1 min-w-0 flex flex-col items-center gap-1">
              <Wifi className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
              <span className="text-xs uppercase" style={{ color: "var(--muted-foreground)", letterSpacing: "0.05em" }}>INTERNET</span>
              <span className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{internet}</span>
            </div>
          </div>

          {/* Detail info */}
          <div className="px-6 pt-5 pb-8 space-y-4 text-sm" style={{ color: "var(--muted-foreground)" }}>
            {/* Personalized insight — one-liner above visa info */}
            {personalInsight && (
              <p className="font-serif text-sm" style={{ color: "var(--primary)" }}>
                ✦ {personalInsight}
              </p>
            )}

            {/* Visa detail */}
            <div className="space-y-1.5">
              <p className="font-mono text-xs uppercase" style={{ letterSpacing: "0.05em", color: "var(--foreground)" }}>비자 정보</p>
              <p>{city.visa_type}{city.stay_months != null && ` · ${city.stay_months}개월`}{` · ${city.renewable ? "갱신 가능" : "갱신 불가"}`}</p>
            </div>

            {/* Stats */}
            {(city.safety_score != null || city.english_score != null) && (
              <div className="flex gap-6">
                {city.safety_score != null && <p>치안 {city.safety_score}/10</p>}
                {city.english_score != null && <p>영어 {city.english_score}/10</p>}
              </div>
            )}

            {/* Insight */}
            {city.city_insight && (
              <div style={{ borderLeft: "2px solid var(--primary)", paddingLeft: 12 }}>
                <p className="text-sm italic" style={{ color: "var(--primary)" }}>{city.city_insight}</p>
              </div>
            )}

            {/* Description */}
            {city.city_description && (
              <p className="leading-relaxed">{city.city_description}</p>
            )}

            {/* Login CTA (ko only, logged-out only) */}
            {showLoginCta && (
              <div className="space-y-3">
                <div style={{ height: 1, background: "color-mix(in srgb, var(--border) 40%, transparent)" }} />
                <div className="space-y-2 pt-1">
                  <h3 className="font-serif text-sm font-medium" style={{ color: "var(--foreground)" }}>
                    {city.city_kr} 맞춤 이민 가이드 받기
                  </h3>
                  <p className="font-sans text-xs" style={{ color: "var(--muted-foreground)" }}>
                    비자 타임라인 · 세금 시뮬레이션 · 예산 로드맵을 AI가 생성해드려요.
                  </p>
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors hover:bg-primary/10"
                    style={{
                      border: "1px solid var(--border)",
                      background: "transparent",
                      color: "var(--foreground)",
                    }}
                  >
                    <GoogleLogo />
                    <span>Google로 계속하기 →</span>
                  </button>
                </div>
              </div>
            )}

            {/* Links */}
            <div className="flex flex-wrap gap-4 pt-2">
              {city.visa_url && (
                <a href={city.visa_url} target="_blank" rel="noopener noreferrer" className="text-sm" style={{ color: "var(--primary)" }}>비자 정보 →</a>
              )}
              {city.flatio_search_url && (
                <a href={city.flatio_search_url} target="_blank" rel="noopener noreferrer" className="text-sm" style={{ color: "var(--primary)" }}>숙소 찾기 →</a>
              )}
              {city.anyplace_search_url && (
                <a href={city.anyplace_search_url} target="_blank" rel="noopener noreferrer" className="text-sm" style={{ color: "var(--primary)" }}>Anyplace →</a>
              )}
              {city.nomad_meetup_url && (
                <a href={city.nomad_meetup_url} target="_blank" rel="noopener noreferrer" className="text-sm" style={{ color: "var(--primary)" }}>밋업 →</a>
              )}
            </div>

            {/* Data source */}
            {city.data_verified_date && (
              <p className="text-xs pt-2" style={{ color: "color-mix(in srgb, var(--muted-foreground) 50%, transparent)" }}>
                데이터 기준: {city.data_verified_date} · Numbeo, NomadList
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
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

  const [lightboxCity, setLightboxCity] = useState<CityData | null>(null);
  const [lockedOverlayIndex, setLockedOverlayIndex] = useState<number | null>(null);
  const locale = useLocale();
  const directCheckoutUrl = process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL ?? null;

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

  // ── Render card ─────────────────────────────────────────────────

  function renderCard(i: number) {
    const state = getCardState(i);
    const city = getCityForCard(i);
    const flipped = isCardFlipped(i);
    const isSelected = selectedIndices.includes(i);

    const handleClick = () => {
      if (isSelecting && !isLoading) {
        onToggleSelect(i);
      } else if (isDone && isSelected && city) {
        setLightboxCity(city);
      } else if (isDone && !isSelected) {
        setLockedOverlayIndex((prev) => (prev === i ? null : i));
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
        showLockedOverlay={lockedOverlayIndex === i}
        onCloseLockedOverlay={() => setLockedOverlayIndex(null)}
        checkoutUrl={directCheckoutUrl}
        locale={locale}
      />
    );
  }

  // ── Layout ──────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center" onClick={() => lockedOverlayIndex !== null && setLockedOverlayIndex(null)}>
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
        {lightboxCity && (
          <CityLightbox
            city={lightboxCity}
            onClose={() => setLightboxCity(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
