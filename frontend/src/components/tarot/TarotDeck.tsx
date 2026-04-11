"use client";

import { motion } from "framer-motion";
import TarotCard from "./TarotCard";
import type { CityData } from "./types";

interface TarotDeckProps {
  cities: CityData[];
  selectedIndices: number[];
  revealedCities: CityData[] | null;
  onToggleSelect: (index: number) => void;
  onConfirm: () => void;
  isLoading: boolean;
}

const MAX_SELECT = 3;

export default function TarotDeck({
  cities,
  selectedIndices,
  revealedCities,
  onToggleSelect,
  onConfirm,
  isLoading,
}: TarotDeckProps) {
  const isRevealed = revealedCities !== null;
  const count = cities.length;
  const allSelected = selectedIndices.length === MAX_SELECT;

  function getCardState(i: number): "back" | "front" | "locked" {
    if (!isRevealed) return "back";
    return selectedIndices.includes(i) ? "front" : "locked";
  }

  function getCityForCard(i: number): CityData | null {
    if (!isRevealed) return null; // 뒷면 — 데이터 불필요
    const pos = selectedIndices.indexOf(i);
    return pos >= 0 ? (revealedCities[pos] ?? null) : null; // locked — 데이터 차단
  }

  return (
    <div className="flex flex-col items-center gap-8">
      {/* 5-card layout: mobile 3+2, desktop 5-col */}
      {/* Desktop: single row */}
      <div className="hidden md:flex justify-center gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="w-[160px]">
            <TarotCard
              state={getCardState(i)}
              cityData={getCityForCard(i)}
              isSelected={selectedIndices.includes(i)}
              onClick={() => {
                if (isLoading || isRevealed) return;
                onToggleSelect(i);
              }}
            />
          </div>
        ))}
      </div>
      {/* Mobile: row of 3 + row of 2 centered */}
      <div className="flex flex-col items-center gap-3 md:hidden">
        <div className="flex justify-center gap-3">
          {Array.from({ length: Math.min(3, count) }).map((_, i) => (
            <div key={i} className="w-[calc((100vw-4rem)/3)] max-w-[120px]">
              <TarotCard
                state={getCardState(i)}
                cityData={getCityForCard(i)}
                isSelected={selectedIndices.includes(i)}
                onClick={() => {
                  if (isLoading || isRevealed) return;
                  onToggleSelect(i);
                }}
              />
            </div>
          ))}
        </div>
        {count > 3 && (
          <div className="flex justify-center gap-3">
            {Array.from({ length: count - 3 }).map((_, j) => {
              const i = j + 3;
              return (
                <div key={i} className="w-[calc((100vw-4rem)/3)] max-w-[120px]">
                  <TarotCard
                    state={getCardState(i)}
                    cityData={getCityForCard(i)}
                    isSelected={selectedIndices.includes(i)}
                    onClick={() => {
                      if (isLoading || isRevealed) return;
                      onToggleSelect(i);
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm CTA */}
      {!isRevealed && allSelected && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className="px-8 py-3 text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-50 transition-opacity"
        >
          {isLoading ? "도시를 불러오고 있어요..." : "카드 열기"}
        </motion.button>
      )}
    </div>
  );
}
