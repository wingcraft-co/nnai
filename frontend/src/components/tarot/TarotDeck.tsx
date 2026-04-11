"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TarotCard from "./TarotCard";
import type { CityData } from "./types";

// ── Stage type (matches result/page.tsx) ──────────────────────────

type DeckStage = "selecting" | "revealing" | "reading" | "complete";

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

// ── Reading text overlay inside card ──────────────────────────────

function CardReadingText({
  text,
  onComplete,
}: {
  text: string;
  onComplete: () => void;
}) {
  const { displayed, done } = useTypingEffect(text, 50);
  const calledRef = useRef(false);

  useEffect(() => {
    if (done && !calledRef.current) {
      calledRef.current = true;
      const timer = setTimeout(onComplete, 1500);
      return () => clearTimeout(timer);
    }
  }, [done, onComplete]);

  // Empty text → immediately complete (handled by useTypingEffect done=true)
  if (!text) return null;

  return displayed;
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
  onCompare: () => void;
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
  onCompare,
  onGuideClick,
  isLoading,
}: TarotDeckProps) {
  const count = cities.length;
  const allSelected = selectedIndices.length === MAX_SELECT;
  const isSelecting = stage === "selecting";
  const isRevealing = stage === "revealing";
  const isReading = stage === "reading";
  const isComplete = stage === "complete";
  const isPostReveal = isRevealing || isReading || isComplete;

  // ── Per-card state ──────────────────────────────────────────────

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

  // ── Reading text for current card ───────────────────────────────

  const [readingDisplayText, setReadingDisplayText] = useState<string | null>(null);

  const currentReadingCity = isReading && revealedCities
    ? revealedCities[currentReadingIndex] ?? null
    : null;

  // Stable callback ref for onReadingCardComplete
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

    // Scale up the reading card
    const scale = reading ? 1.15 : 1;
    // Locked cards fade
    const opacity = locked && isPostReveal ? 0.15 : 1;

    return (
      <motion.div
        key={i}
        animate={{ scale, opacity }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative"
      >
        <TarotCard
          state={state}
          size="sm"
          cityData={city}
          isSelected={isSelecting && selectedIndices.includes(i)}
          isFlipped={flipped}
          readingText={reading ? undefined : undefined}
          onClick={isSelecting && !isLoading ? () => onToggleSelect(i) : undefined}
        />

        {/* Reading text typing — rendered inside card area */}
        {reading && currentReadingCity && (
          <CardReadingText
            key={`reading-${currentReadingIndex}`}
            text={currentReadingCity.reading_text ?? ""}
            onComplete={handleReadingDone}
          />
        )}
      </motion.div>
    );
  }

  // ── Layout ──────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center">
      {/* Cards — fixed position, never shifts */}
      <div>
        {/* Desktop: single row */}
        <div className="hidden md:flex justify-center gap-3">
          {Array.from({ length: count }, (_, i) => renderCard(i))}
        </div>
        {/* Mobile: 3 + 2 */}
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

      {/* CTA area — fixed height so cards don't shift */}
      <div className="h-20 flex items-center justify-center">
        {isSelecting && allSelected && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="px-8 py-3 text-sm font-semibold transition-opacity"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            {isLoading ? "도시를 불러오고 있어요..." : "카드 열기"}
          </motion.button>
        )}
      </div>

      {/* Complete CTA */}
      {isComplete && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center gap-6 mt-4"
        >
          <p className="font-serif text-base font-bold" style={{ color: "var(--foreground)" }}>
            세 장의 카드가 모두 열렸습니다
          </p>

          <button
            type="button"
            onClick={onCompare}
            className="px-8 py-3 text-sm font-semibold"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            도시 비교 보기 →
          </button>

          <div className="flex flex-col items-center gap-2">
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              더 깊은 가이드가 필요하다면
            </p>
            <button
              type="button"
              onClick={onGuideClick}
              className="px-6 py-2 text-sm font-medium transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              전체 가이드 받기
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
