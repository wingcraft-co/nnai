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
}

const FAN_ANGLES = [-20, -10, 0, 10, 20];
const FAN_Y = [20, 8, 0, 8, 20];

export default function TarotDeck({
  cardCount,
  revealedCities,
  onReveal,
  onSelectForReading,
}: TarotDeckProps) {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // After reveal, track which card is selected for reading
  const [readingIndex, setReadingIndex] = useState<number | null>(null);

  const isRevealed = revealedCities !== null;
  const MAX_SELECT = Math.min(3, cardCount);

  function handleCardClick(i: number) {
    if (isRevealed) {
      // Stage 2: selecting for reading
      if (!revealedCities![i]) return; // locked card (shouldn't happen if revealedCities has all)
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
    onSelectForReading(readingIndex);
  }

  const count = Math.min(cardCount, 5);

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Fan layout */}
      <div
        className="relative flex items-end justify-center"
        style={{ width: 260, height: 180 }}
      >
        {Array.from({ length: count }).map((_, i) => {
          const angle = FAN_ANGLES[i] ?? 0;
          const yOffset = FAN_Y[i] ?? 0;
          const isSelected = selectedIndices.includes(i);

          // In revealed stage: map card slot to revealed city if selected
          const revealedCity = isRevealed
            ? (revealedCities[i] ?? null)
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
                left: "50%",
                transformOrigin: "bottom center",
              }}
              initial={{ rotate: angle, x: "-50%" }}
              animate={{
                rotate: angle,
                x: "-50%",
                scale: isSelected || isReadingSelected ? 1.08 : 1,
                y: isSelected || isReadingSelected ? -8 : 0,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              whileHover={{ scale: 1.05, y: -4 }}
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
              : `${revealedCities[readingIndex]?.city_kr ?? ""} 리딩을 시작할게요`}
          </motion.p>
        )}
      </AnimatePresence>

      {/* CTA button */}
      <AnimatePresence mode="wait">
        {!isRevealed && selectedIndices.length === MAX_SELECT && (
          <motion.button
            key="reveal-cta"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={handleRevealClick}
            disabled={isLoading}
            className="px-8 py-3 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #c9a84c, #e8c96e)",
              color: "#1a1a2e",
            }}
          >
            {isLoading ? "분석 중..." : "카드 열기"}
          </motion.button>
        )}
        {isRevealed && readingIndex !== null && (
          <motion.button
            key="reading-cta"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={handleReadingClick}
            className="px-8 py-3 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: "linear-gradient(135deg, #c9a84c, #e8c96e)",
              color: "#1a1a2e",
            }}
          >
            리딩 받기
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
