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
