"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CityData } from "./types";

const FLAG_EMOJI: Record<string, string> = {
  AD: "\u{1F1E6}\u{1F1E9}", AE: "\u{1F1E6}\u{1F1EA}", AR: "\u{1F1E6}\u{1F1F7}",
  AT: "\u{1F1E6}\u{1F1F9}", AU: "\u{1F1E6}\u{1F1FA}", BE: "\u{1F1E7}\u{1F1EA}",
  BG: "\u{1F1E7}\u{1F1EC}", BR: "\u{1F1E7}\u{1F1F7}", CA: "\u{1F1E8}\u{1F1E6}",
  CH: "\u{1F1E8}\u{1F1ED}", CL: "\u{1F1E8}\u{1F1F1}", CN: "\u{1F1E8}\u{1F1F3}",
  CO: "\u{1F1E8}\u{1F1F4}", CR: "\u{1F1E8}\u{1F1F7}", CY: "\u{1F1E8}\u{1F1FE}",
  CZ: "\u{1F1E8}\u{1F1FF}", DE: "\u{1F1E9}\u{1F1EA}", DK: "\u{1F1E9}\u{1F1F0}",
  EC: "\u{1F1EA}\u{1F1E8}", EE: "\u{1F1EA}\u{1F1EA}", EG: "\u{1F1EA}\u{1F1EC}",
  ES: "\u{1F1EA}\u{1F1F8}", FI: "\u{1F1EB}\u{1F1EE}", FR: "\u{1F1EB}\u{1F1F7}",
  GB: "\u{1F1EC}\u{1F1E7}", GE: "\u{1F1EC}\u{1F1EA}", GR: "\u{1F1EC}\u{1F1F7}",
  HR: "\u{1F1ED}\u{1F1F7}", HU: "\u{1F1ED}\u{1F1FA}", ID: "\u{1F1EE}\u{1F1E9}",
  IE: "\u{1F1EE}\u{1F1EA}", IL: "\u{1F1EE}\u{1F1F1}", IN: "\u{1F1EE}\u{1F1F3}",
  IS: "\u{1F1EE}\u{1F1F8}", IT: "\u{1F1EE}\u{1F1F9}", JP: "\u{1F1EF}\u{1F1F5}",
  KH: "\u{1F1F0}\u{1F1ED}", KR: "\u{1F1F0}\u{1F1F7}", MX: "\u{1F1F2}\u{1F1FD}",
  MY: "\u{1F1F2}\u{1F1FE}", NL: "\u{1F1F3}\u{1F1F1}", NO: "\u{1F1F3}\u{1F1F4}",
  NZ: "\u{1F1F3}\u{1F1FF}", PA: "\u{1F1F5}\u{1F1E6}", PE: "\u{1F1F5}\u{1F1EA}",
  PH: "\u{1F1F5}\u{1F1ED}", PL: "\u{1F1F5}\u{1F1F1}", PT: "\u{1F1F5}\u{1F1F9}",
  RO: "\u{1F1F7}\u{1F1F4}", RS: "\u{1F1F7}\u{1F1F8}", SE: "\u{1F1F8}\u{1F1EA}",
  SG: "\u{1F1F8}\u{1F1EC}", TH: "\u{1F1F9}\u{1F1ED}", TR: "\u{1F1F9}\u{1F1F7}",
  TW: "\u{1F1F9}\u{1F1FC}", UA: "\u{1F1FA}\u{1F1E6}", US: "\u{1F1FA}\u{1F1F8}",
  UY: "\u{1F1FA}\u{1F1FE}", VN: "\u{1F1FB}\u{1F1F3}", ZA: "\u{1F1FF}\u{1F1E6}",
};

const USD_TO_KRW = 1400;
function toKRW(usd: number): string {
  return `약 ${Math.round((usd * USD_TO_KRW) / 10000)}만원`;
}

interface TarotReadingProps {
  cities: CityData[];
  onComplete: () => void;
  onRequestDetail: (cityIndex: number) => void;
}

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

function CityReading({
  city,
  index,
  onNext,
  isLast,
}: {
  city: CityData;
  index: number;
  onNext: () => void;
  isLast: boolean;
}) {
  const flag = FLAG_EMOJI[city.country_id] ?? "\u{1F30D}";
  const readingText = city.reading_text ?? "";
  const { displayed, done } = useTypingEffect(readingText, 50);

  const visaDays =
    city.visa_free_days > 0
      ? `무비자 ${city.visa_free_days}일`
      : "비자 필요";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center gap-8 w-full max-w-md mx-auto px-4"
    >
      {/* Card number */}
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        Card {index + 1} of 3
      </span>

      {/* City header */}
      <div className="text-center">
        <span className="text-4xl">{flag}</span>
        <h2 className="font-serif text-2xl font-bold text-foreground mt-2">
          {city.city_kr}
        </h2>
        <p className="font-mono text-sm text-muted-foreground mt-1 tracking-wide">
          {city.city}, {city.country}
        </p>
      </div>

      {/* Reading text with typing effect */}
      {readingText && (
        <div className="w-full border-l-2 border-primary pl-4 min-h-[3rem]">
          <p className="font-serif text-base text-foreground leading-relaxed">
            {displayed}
            {!done && (
              <span className="animate-pulse text-primary">|</span>
            )}
          </p>
        </div>
      )}

      {/* Metrics fade in after typing completes */}
      {done && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full flex flex-col gap-3"
        >
          <div className="w-full h-px bg-border" />
          <div className="flex justify-around font-mono text-center">
            <div className="flex flex-col items-center gap-1">
              <span className="text-lg">💰</span>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                Monthly
              </span>
              <span className="text-sm font-medium text-foreground">
                {toKRW(city.monthly_cost_usd)}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-lg">🛂</span>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                Visa
              </span>
              <span className="text-sm font-medium text-foreground">
                {visaDays}
              </span>
            </div>
            {city.internet_mbps != null && (
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg">📶</span>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  Internet
                </span>
                <span className="text-sm font-medium text-foreground">
                  {city.internet_mbps} Mbps
                </span>
              </div>
            )}
          </div>
          <div className="w-full h-px bg-border" />
        </motion.div>
      )}

      {/* Next / Complete button */}
      {done && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          type="button"
          onClick={onNext}
          className="px-8 py-3 text-sm font-semibold bg-primary text-primary-foreground transition-opacity"
        >
          {isLast ? "리딩 완료" : "다음 카드 →"}
        </motion.button>
      )}
    </motion.div>
  );
}

export default function TarotReading({
  cities,
  onComplete,
  onRequestDetail,
}: TarotReadingProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [readingComplete, setReadingComplete] = useState(false);

  const handleNext = useCallback(() => {
    if (currentIndex < cities.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setReadingComplete(true);
    }
  }, [currentIndex, cities.length]);

  const [toastVisible, setToastVisible] = useState(false);

  function handleGuideClick() {
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  }

  // Reading complete: CTA screen
  if (readingComplete) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-8 w-full max-w-md mx-auto px-4 py-16"
      >
        <h2 className="font-serif text-xl font-bold text-foreground text-center">
          세 장의 카드가 모두 열렸습니다
        </h2>

        <button
          type="button"
          onClick={onComplete}
          className="w-full py-3.5 text-sm font-semibold bg-primary text-primary-foreground transition-opacity"
        >
          도시 비교 보기 →
        </button>

        <div className="flex flex-col items-center gap-3">
          <p className="text-xs text-muted-foreground">
            더 깊은 가이드가 필요하다면
          </p>
          <button
            type="button"
            onClick={handleGuideClick}
            className="px-6 py-2.5 text-sm font-medium border border-border text-foreground hover:border-primary transition-colors"
          >
            전체 가이드 받기
          </button>
        </div>

        {/* Toast */}
        <AnimatePresence>
          {toastVisible && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-3 bg-card border border-border text-sm text-foreground"
            >
              곧 오픈될 예정이에요 🔜
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  // Sequential reading
  return (
    <div className="min-h-[80vh] flex items-center justify-center py-16">
      <AnimatePresence mode="wait">
        <CityReading
          key={currentIndex}
          city={cities[currentIndex]}
          index={currentIndex}
          onNext={handleNext}
          isLast={currentIndex === cities.length - 1}
        />
      </AnimatePresence>
    </div>
  );
}
