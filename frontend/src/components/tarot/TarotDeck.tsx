"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TarotCard from "./TarotCard";
import type { CityData } from "./types";

interface TarotDeckProps {
  cardCount: number;
  revealedCities: CityData[] | null; // null = not yet revealed
  onReveal: (indices: number[]) => Promise<void>;
  onSelectForReading: (cityIndex: number) => void;
  initialSelectedIndices?: number[];
}

const FAN_ANGLES = [-16, -8, 0, 8, 16];
const FAN_X = [-120, -60, 0, 60, 120];  // px offset from center
const FAN_Y = [16, 5, 0, 5, 16];

export default function TarotDeck({
  cardCount,
  revealedCities,
  onReveal,
  onSelectForReading,
  initialSelectedIndices,
}: TarotDeckProps) {
  const [selectedIndices, setSelectedIndices] = useState<number[]>(initialSelectedIndices ?? []);
  const [isLoading, setIsLoading] = useState(false);
  // After reveal, track which card is selected for reading
  const [readingIndex, setReadingIndex] = useState<number | null>(null);

  const isRevealed = revealedCities !== null;
  const MAX_SELECT = Math.min(3, cardCount);

  function handleCardClick(i: number) {
    if (isRevealed) {
      // Stage 2: selecting for reading — only revealed (selected) cards are clickable
      const pos = selectedIndices.indexOf(i);
      if (pos < 0 || !revealedCities![pos]) return; // locked card
      setReadingIndex(i);
      return;
    }

    // Stage 1: selecting cards
    if (selectedIndices.includes(i)) {
      setSelectedIndices((prev) => prev.filter((x) => x !== i));
    } else if (selectedIndices.length < MAX_SELECT) {
      setSelectedIndices((prev) => [...prev, i]);
    }
  }

  async function handleRevealClick() {
    if (selectedIndices.length < MAX_SELECT || isLoading) return;
    setIsLoading(true);
    try {
      await onReveal(selectedIndices);
    } finally {
      setIsLoading(false);
    }
  }

  function handleReadingClick() {
    if (readingIndex === null) return;
    // Convert card slot index to revealedCities array position
    const pos = selectedIndices.indexOf(readingIndex);
    if (pos < 0) return;
    onSelectForReading(pos);
  }

  const count = Math.min(cardCount, 5);

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Fan layout */}
      <div
        className="relative flex items-end justify-center"
        style={{ width: 420, height: 260 }}
      >
        {Array.from({ length: count }).map((_, i) => {
          const angle = FAN_ANGLES[i] ?? 0;
          const xOffset = FAN_X[i] ?? 0;
          const yOffset = FAN_Y[i] ?? 0;
          const isSelected = selectedIndices.includes(i);

          // In revealed stage: map card slot to revealed city via selectedIndices order
          const revealedCity = isRevealed
            ? (() => {
                const pos = selectedIndices.indexOf(i);
                return pos >= 0 ? (revealedCities[pos] ?? null) : null;
              })()
            : null;
          const isLocked = isRevealed && revealedCity === null;
          const isFlipped = isRevealed && revealedCity !== null;
          const isReadingSelected = readingIndex === i;

          return (
            <motion.div
              key={i}
              className="absolute"
              style={{
                bottom: yOffset,
                left: `calc(50% + ${xOffset}px)`,
                marginLeft: -60, // half card width
                transformOrigin: "bottom center",
                zIndex: isSelected || isReadingSelected ? 10 : 5 - Math.abs(i - 2),
              }}
              animate={{
                rotate: angle,
                scale: isSelected || isReadingSelected ? 1.12 : 1,
                y: isSelected || isReadingSelected ? -12 : 0,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              whileHover={{ scale: 1.08, y: -6 }}
            >
              <TarotCard
                city={revealedCity}
                isSelected={isSelected || isReadingSelected}
                isLocked={isLocked}
                isFlipped={isFlipped}
                onClick={() => handleCardClick(i)}
              />
            </motion.div>
          );
        })}
      </div>

      {/* Status text */}
      <AnimatePresence mode="wait">
        {!isRevealed && (
          <motion.p
            key="select-hint"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-sm text-gray-400 text-center"
          >
            {selectedIndices.length < MAX_SELECT
              ? `카드를 ${MAX_SELECT - selectedIndices.length}장 더 선택하세요`
              : "선택 완료! 카드를 열어볼까요?"}
          </motion.p>
        )}
        {isRevealed && (
          <motion.p
            key="reading-hint"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-sm text-gray-400 text-center"
          >
            {readingIndex === null
              ? "리딩받고 싶은 도시 카드를 선택하세요"
              : `${revealedCities[selectedIndices.indexOf(readingIndex)]?.city_kr ?? ""} 리딩을 시작할게요`}
          </motion.p>
        )}
      </AnimatePresence>

      {/* CTA button */}
      {!isRevealed && selectedIndices.length === MAX_SELECT && (
        <button
          type="button"
          onClick={handleRevealClick}
          disabled={isLoading}
          className="px-8 py-3 text-sm font-semibold transition-all disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isLoading ? "분석 중..." : "카드 열기"}
        </button>
      )}
      {isRevealed && readingIndex !== null && (
        <button
          type="button"
          onClick={handleReadingClick}
          className="px-8 py-3 text-sm font-semibold transition-all bg-primary text-primary-foreground hover:bg-primary/90"
        >
          리딩 받기
        </button>
      )}
    </div>
  );
}
