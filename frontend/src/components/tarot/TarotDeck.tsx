"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TarotCard from "./TarotCard";
import type { CityData } from "./types";

interface TarotDeckProps {
  cardCount: number;
  revealedCities: CityData[] | null;
  onReveal: (indices: number[]) => Promise<void>;
  onSelectForReading: (cityIndex: number) => void;
  initialSelectedIndices?: number[];
}

const MAX_SELECT = 3;
const FAN_ANGLES = [-16, -8, 0, 8, 16];
const FAN_X = [-120, -60, 0, 60, 120];
const FAN_Y = [16, 5, 0, 5, 16];

export default function TarotDeck({
  cardCount,
  revealedCities,
  onReveal,
  onSelectForReading,
  initialSelectedIndices,
}: TarotDeckProps) {
  const hasRestoredReveal = revealedCities !== null && (initialSelectedIndices?.length ?? 0) > 0;

  const [selectedIndices, setSelectedIndices] = useState<number[]>(
    hasRestoredReveal ? (initialSelectedIndices ?? []) : []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [readingIndex, setReadingIndex] = useState<number | null>(null);

  const isRevealed = revealedCities !== null;
  const count = Math.min(cardCount || 5, 5);

  function handleCardClick(i: number) {
    if (isLoading) return;

    if (isRevealed) {
      // Reading selection — only flipped cards
      const pos = selectedIndices.indexOf(i);
      if (pos < 0) return;
      setReadingIndex(i);
      return;
    }

    // Card selection
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
    if (readingIndex === null || !revealedCities) return;
    const pos = selectedIndices.indexOf(readingIndex);
    if (pos < 0) return;
    onSelectForReading(pos);
  }

  function getCityForSlot(i: number): CityData | null {
    if (!revealedCities) return null;
    const pos = selectedIndices.indexOf(i);
    return pos >= 0 ? (revealedCities[pos] ?? null) : null;
  }

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Fan layout — cards appear sequentially */}
      <div
        className="relative flex items-end justify-center"
        style={{ width: 420, height: 260 }}
      >
        {Array.from({ length: count }).map((_, i) => {
          const angle = FAN_ANGLES[i] ?? 0;
          const xOffset = FAN_X[i] ?? 0;
          const yOffset = FAN_Y[i] ?? 0;
          const isSelected = selectedIndices.includes(i);
          const city = getCityForSlot(i);
          const isFlipped = isRevealed && city !== null;
          const isLocked = isRevealed && city === null;
          const isReadingSelected = readingIndex === i;

          return (
            <motion.div
              key={i}
              className="absolute"
              style={{
                bottom: yOffset,
                left: `calc(50% + ${xOffset}px)`,
                marginLeft: -60,
                transformOrigin: "bottom center",
                zIndex: isSelected || isReadingSelected ? 10 : 5 - Math.abs(i - 2),
              }}
              initial={hasRestoredReveal ? false : { opacity: 0, scale: 0, y: 40 }}
              animate={{
                opacity: 1,
                scale: isReadingSelected ? 1.15 : isSelected ? 1.08 : 1,
                rotate: angle,
                y: isReadingSelected ? -16 : isSelected ? -8 : 0,
              }}
              transition={{
                delay: hasRestoredReveal ? 0 : i * 0.15,
                type: "spring",
                stiffness: 260,
                damping: 22,
              }}
              whileHover={!isLocked ? { scale: 1.06, y: -4 } : undefined}
            >
              <TarotCard
                city={city}
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
            className="text-sm text-muted-foreground text-center"
          >
            {selectedIndices.length < MAX_SELECT
              ? `끌리는 카드 ${MAX_SELECT - selectedIndices.length}장을 골라보세요`
              : "준비되셨나요?"}
          </motion.p>
        )}
        {isRevealed && (
          <motion.p
            key="reading-hint"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-sm text-muted-foreground text-center"
          >
            {readingIndex === null
              ? "리딩받고 싶은 도시를 선택하세요"
              : `${revealedCities?.[selectedIndices.indexOf(readingIndex)]?.city_kr ?? ""} 리딩을 시작할게요`}
          </motion.p>
        )}
      </AnimatePresence>

      {/* CTA buttons */}
      {!isRevealed && selectedIndices.length === MAX_SELECT && (
        <button
          type="button"
          onClick={handleRevealClick}
          disabled={isLoading}
          className="px-8 py-3 text-sm font-semibold transition-all disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isLoading ? "도시를 불러오고 있어요..." : "카드 열기"}
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
