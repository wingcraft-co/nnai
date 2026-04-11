"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TarotCard from "./TarotCard";
import type { CityData } from "./types";

interface CityCompareProps {
  cities: CityData[];
  onRetry: () => void;
}

const USD_TO_KRW = 1400;

function toKRW(usd: number): string {
  return `약 ${Math.round((usd * USD_TO_KRW) / 10000)}만원`;
}

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const, delay },
  },
});

function CityCardWithAccordion({ city }: { city: CityData }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col items-center">
      {/* TarotCard lg */}
      <TarotCard
        state="front"
        size="lg"
        cityData={city}
        isFlipped={true}
        onClick={() => setOpen((v) => !v)}
      />

      {/* Accordion detail */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="overflow-hidden w-[260px]"
          >
            <div
              className="px-4 py-4 space-y-3 text-sm"
              style={{
                background: "color-mix(in srgb, var(--muted) 30%, transparent)",
                borderRadius: "0 0 12px 12px",
                color: "var(--muted-foreground)",
              }}
            >
              {/* Visa info */}
              <div className="space-y-1">
                <p>
                  비자: {city.visa_type}
                  {city.stay_months != null && ` · ${city.stay_months}개월`}
                  {` · ${city.renewable ? "갱신 가능" : "갱신 불가"}`}
                </p>
                <p>예산: {toKRW(city.monthly_cost_usd)} / 월</p>
                {city.safety_score != null && <p>치안: {city.safety_score}/10</p>}
                {city.english_score != null && <p>영어: {city.english_score}/10</p>}
              </div>

              {/* Description */}
              {city.city_description && (
                <p className="text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                  {city.city_description}
                </p>
              )}

              {/* Links */}
              <div className="flex flex-wrap gap-3 text-xs">
                {city.visa_url && (
                  <a href={city.visa_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                    비자 정보 →
                  </a>
                )}
                {city.flatio_search_url && (
                  <a href={city.flatio_search_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                    숙소 찾기 →
                  </a>
                )}
                {city.anyplace_search_url && (
                  <a href={city.anyplace_search_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                    Anyplace →
                  </a>
                )}
                {city.nomad_meetup_url && (
                  <a href={city.nomad_meetup_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                    밋업 →
                  </a>
                )}
              </div>

              {/* Data source */}
              {city.data_verified_date && (
                <p className="text-xs" style={{ color: "color-mix(in srgb, var(--muted-foreground) 50%, transparent)" }}>
                  데이터 기준: {city.data_verified_date} · Numbeo, NomadList
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CityCompare({ cities, onRetry }: CityCompareProps) {
  const [toastVisible, setToastVisible] = useState(false);

  function handleGuideClick() {
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <motion.div {...fadeUp(0)} className="mb-8 text-center">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>도시 비교</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          카드를 탭하면 상세 정보를 볼 수 있어요
        </p>
        <button
          type="button"
          onClick={handleGuideClick}
          className="mt-4 px-6 py-2.5 text-sm font-medium transition-colors"
          style={{ border: "1px solid var(--border)", color: "var(--foreground)" }}
        >
          전체 가이드 받기
        </button>
      </motion.div>

      {/* Cards: desktop 3-col / mobile vertical */}
      <div className="flex flex-col md:flex-row justify-center items-start gap-6">
        {cities.map((city, i) => (
          <motion.div key={city.city} {...fadeUp(0.1 + i * 0.15)}>
            <CityCardWithAccordion city={city} />
          </motion.div>
        ))}
      </div>

      {/* Retry CTA */}
      <motion.div {...fadeUp(0.6)} className="mt-10 text-center">
        <button
          type="button"
          onClick={onRetry}
          className="text-sm transition-colors py-2"
          style={{ color: "var(--muted-foreground)" }}
        >
          처음부터 다시하기
        </button>
      </motion.div>

      {/* Toast */}
      <AnimatePresence>
        {toastVisible && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-3 text-sm z-50"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          >
            곧 오픈될 예정이에요 🔜
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
