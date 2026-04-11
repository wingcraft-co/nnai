"use client";

import { motion } from "framer-motion";
import TarotCard from "./TarotCard";
import type { CityData } from "./types";

interface TarotDeckProps {
  cities: CityData[];
  selectedIndices: number[];
  revealedCities: CityData[] | null;
  flippedIndices: number[];
  onToggleSelect: (index: number) => void;
  onConfirm: () => void;
  isLoading: boolean;
}

const MAX_SELECT = 3;

export default function TarotDeck({
  cities,
  selectedIndices,
  revealedCities,
  flippedIndices,
  onToggleSelect,
  onConfirm,
  isLoading,
}: TarotDeckProps) {
  const isRevealed = revealedCities !== null;
  const count = cities.length;
  const allSelected = selectedIndices.length === MAX_SELECT;

  function getCityForCard(i: number): CityData | null {
    if (!isRevealed) return null;
    const pos = selectedIndices.indexOf(i);
    return pos >= 0 ? (revealedCities[pos] ?? null) : null;
  }

  function renderBackCard(i: number) {
    return (
      <TarotCard
        key={i}
        state="back"
        size="sm"
        isSelected={selectedIndices.includes(i)}
        onClick={() => {
          if (isLoading) return;
          onToggleSelect(i);
        }}
      />
    );
  }

  // ── Selecting: 5 cards (mobile 3+2, desktop 5-col) ──
  if (!isRevealed) {
    return (
      <div className="flex flex-col items-center gap-8">
        {/* Desktop: single row */}
        <div className="hidden md:flex justify-center gap-3">
          {Array.from({ length: count }, (_, i) => renderBackCard(i))}
        </div>
        {/* Mobile: 3 + 2 */}
        <div className="flex flex-col items-center gap-3 md:hidden">
          <div className="flex justify-center gap-3">
            {Array.from({ length: Math.min(3, count) }, (_, i) => renderBackCard(i))}
          </div>
          {count > 3 && (
            <div className="flex justify-center gap-3">
              {Array.from({ length: count - 3 }, (_, j) => renderBackCard(j + 3))}
            </div>
          )}
        </div>

        {/* Confirm CTA */}
        {allSelected && (
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
    );
  }

  // ── Revealed: selected 3 flip, locked 2 fade in ──
  const selectedCards = selectedIndices.map((idx) => ({
    idx,
    city: getCityForCard(idx),
  }));
  const lockedCards = Array.from({ length: count })
    .map((_, i) => i)
    .filter((i) => !selectedIndices.includes(i));
  const allFlipped = flippedIndices.length >= selectedIndices.length;

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Selected 3 cards — flip animation */}
      <div className="flex justify-center gap-3">
        {selectedCards.map(({ idx, city }, seqIdx) => (
          <TarotCard
            key={idx}
            state="front"
            size="sm"
            cityData={city}
            isFlipped={flippedIndices.includes(seqIdx)}
          />
        ))}
      </div>

      {/* Locked 2 cards — fade in after all flips done */}
      {allFlipped && lockedCards.length > 0 && (
        <motion.div
          className="flex justify-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.2 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          {lockedCards.map((idx) => (
            <TarotCard key={idx} state="locked" size="sm" />
          ))}
        </motion.div>
      )}
    </div>
  );
}
