"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TarotCard from "./TarotCard";
import type { CityData } from "./types";

// ── Stage type ────────────────────────────────────────────────────

export type DeckStage = "selecting" | "revealing" | "reading" | "done";

// ── Typing hook ───────────────────────────────────────────────────

function useTypingEffect(text: string, speed: number = 50) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    if (!text) {
      setDone(true);
      return;
    }
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return { displayed, done };
}

// ── Reading text (invisible renderer, triggers onComplete) ────────

function CardReadingText({
  text,
  onComplete,
}: {
  text: string;
  onComplete: () => void;
}) {
  const { done } = useTypingEffect(text, 50);
  const calledRef = useRef(false);

  useEffect(() => {
    if (done && !calledRef.current) {
      calledRef.current = true;
      const timer = setTimeout(onComplete, 1500);
      return () => clearTimeout(timer);
    }
  }, [done, onComplete]);

  return null;
}

// ── City detail accordion ─────────────────────────────────────────

const USD_TO_KRW = 1400;
function toKRW(usd: number): string {
  return `약 ${Math.round((usd * USD_TO_KRW) / 10000)}만원`;
}

function CityAccordion({ city }: { city: CityData }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="overflow-hidden"
      style={{ width: 140 }}
    >
      <div
        className="px-3 py-3 space-y-2 text-xs"
        style={{
          background: "color-mix(in srgb, var(--muted) 30%, transparent)",
          borderRadius: "0 0 12px 12px",
          color: "var(--muted-foreground)",
        }}
      >
        <p>
          {city.visa_type}
          {city.stay_months != null && ` · ${city.stay_months}개월`}
          {` · ${city.renewable ? "갱신 가능" : "갱신 불가"}`}
        </p>
        <p>{toKRW(city.monthly_cost_usd)} / 월</p>
        {city.safety_score != null && <p>치안 {city.safety_score}/10</p>}
        {city.english_score != null && <p>영어 {city.english_score}/10</p>}
        {city.city_description && (
          <p className="leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            {city.city_description}
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {city.visa_url && (
            <a href={city.visa_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>비자 →</a>
          )}
          {city.flatio_search_url && (
            <a href={city.flatio_search_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>숙소 →</a>
          )}
          {city.nomad_meetup_url && (
            <a href={city.nomad_meetup_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>밋업 →</a>
          )}
        </div>
      </div>
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
  currentReadingIndex: number;
  onToggleSelect: (index: number) => void;
  onConfirm: () => void;
  onReadingCardComplete: () => void;
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
  currentReadingIndex,
  onToggleSelect,
  onConfirm,
  onReadingCardComplete,
  onRetry,
  onGuideClick,
  isLoading,
}: TarotDeckProps) {
  const count = cities.length;
  const allSelected = selectedIndices.length === MAX_SELECT;
  const isSelecting = stage === "selecting";
  const isRevealing = stage === "revealing";
  const isReading = stage === "reading";
  const isDone = stage === "done";
  const isPostReveal = isRevealing || isReading || isDone;

  // ── Accordion state (done stage) ────────────────────────────────

  const [expandedCardIndex, setExpandedCardIndex] = useState<number | null>(null);

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

  function isReadingActive(i: number): boolean {
    if (!isReading) return false;
    const seqIdx = selectedIndices.indexOf(i);
    return seqIdx === currentReadingIndex;
  }

  // ── Reading text ────────────────────────────────────────────────

  const currentReadingCity = isReading && revealedCities
    ? revealedCities[currentReadingIndex] ?? null
    : null;

  const onReadingCompleteRef = useRef(onReadingCardComplete);
  onReadingCompleteRef.current = onReadingCardComplete;

  const handleReadingDone = useCallback(() => {
    onReadingCompleteRef.current();
  }, []);

  // ── Render card ─────────────────────────────────────────────────

  function renderCard(i: number) {
    const state = getCardState(i);
    const city = getCityForCard(i);
    const flipped = isCardFlipped(i);
    const reading = isReadingActive(i);
    const locked = state === "locked";
    const isSelected = selectedIndices.includes(i);

    const scale = reading ? 1.15 : 1;
    const opacity = locked && isPostReveal ? 0.15 : 1;

    // Done stage: tappable revealed cards
    const handleClick = () => {
      if (isSelecting && !isLoading) {
        onToggleSelect(i);
      } else if (isDone && isSelected) {
        setExpandedCardIndex((prev) => (prev === i ? null : i));
      }
    };

    return (
      <div key={i} className="flex flex-col items-center">
        <motion.div
          animate={{ scale, opacity }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <TarotCard
            state={state}
            size="sm"
            cityData={city}
            isSelected={isSelecting && isSelected}
            isFlipped={flipped}
            onClick={(isSelecting || (isDone && isSelected)) ? handleClick : undefined}
          />

          {reading && currentReadingCity && (
            <CardReadingText
              key={`reading-${currentReadingIndex}`}
              text={currentReadingCity.reading_text ?? ""}
              onComplete={handleReadingDone}
            />
          )}
        </motion.div>

        {/* Accordion detail — done stage */}
        <AnimatePresence>
          {isDone && expandedCardIndex === i && city && (
            <CityAccordion city={city} />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Layout ──────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center">
      {/* Cards — fixed position */}
      <div>
        {/* Desktop: single row */}
        <div className="hidden md:flex justify-center items-start gap-3">
          {Array.from({ length: count }, (_, i) => renderCard(i))}
        </div>
        {/* Mobile: 3 + 2 */}
        <div className="flex flex-col items-center gap-3 md:hidden">
          <div className="flex justify-center items-start gap-3">
            {Array.from({ length: Math.min(3, count) }, (_, i) => renderCard(i))}
          </div>
          {count > 3 && (
            <div className="flex justify-center items-start gap-3">
              {Array.from({ length: count - 3 }, (_, j) => renderCard(j + 3))}
            </div>
          )}
        </div>
      </div>

      {/* CTA area — fixed height */}
      <div className="h-20 flex items-center justify-center">
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

      {/* Done: guide + retry */}
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
    </div>
  );
}
