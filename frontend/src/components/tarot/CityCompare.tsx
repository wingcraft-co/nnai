"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Wifi, Languages } from "lucide-react";
import type { CityData } from "./types";

interface CityCompareProps {
  cities: CityData[];
  onRetry: () => void;
}

const USD_TO_KRW = 1400;

function toKRW(usd: number): string {
  const manwon = Math.round((usd * USD_TO_KRW) / 10000);
  return `약 ${manwon}만원`;
}

const rankBadge = ["1st", "2nd", "3rd"];

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const, delay },
  },
});

function CityCard({ city, rank }: { city: CityData; rank: number }) {
  const visaBadgeText =
    city.visa_free_days > 0 && city.plan_b_trigger
      ? "🛂 무비자 90일 (셴겐)"
      : city.visa_free_days > 0
      ? `🛂 무비자 ${city.visa_free_days}일`
      : "🛂 비자 필요";

  return (
    <div
      className="border border-gray-200 border-l-4 bg-white p-5 flex flex-col gap-3 rounded-sm"
      style={{ borderLeftColor: "#c9a84c" }}
    >
      {/* Rank + city name */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-sm"
          style={{ background: "#c9a84c", color: "#1a1a2e" }}
        >
          {rankBadge[rank] ?? `#${rank + 1}`}
        </span>
        <span className="text-base font-bold text-gray-900">{city.city_kr}</span>
        <span className="text-sm text-gray-400">{city.country}</span>
      </div>

      {/* Insight */}
      {city.city_insight && (
        <div
          className="border-l-2 pl-3 py-0.5"
          style={{ borderColor: "#c9a84c" }}
        >
          <p className="text-sm italic" style={{ color: "#c9a84c" }}>
            {city.city_insight}
          </p>
        </div>
      )}

      <div className="border-t border-gray-100" />

      {/* Visa + budget info */}
      <div className="space-y-1.5 text-sm text-gray-500">
        <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {visaBadgeText}
        </span>
        <p>
          비자: {city.visa_type}
          {city.stay_months != null && ` · ${city.stay_months}개월`}
          {` · ${city.renewable ? "갱신 가능" : "갱신 불가"}`}
        </p>
        <p>예산: {toKRW(city.monthly_cost_usd)} / 월</p>
      </div>

      {/* Stats grid */}
      {(city.safety_score != null ||
        city.internet_mbps != null ||
        city.english_score != null) && (
        <>
          <div className="border-t border-gray-100" />
          <div className="grid grid-cols-3 text-xs text-gray-500 gap-1">
            {city.safety_score != null && (
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="size-3 shrink-0" />
                치안 {city.safety_score}/10
              </span>
            )}
            {city.internet_mbps != null && (
              <span className="inline-flex items-center gap-1">
                <Wifi className="size-3 shrink-0" />
                {city.internet_mbps}Mbps
              </span>
            )}
            {city.english_score != null && (
              <span className="inline-flex items-center gap-1">
                <Languages className="size-3 shrink-0" />
                영어 {city.english_score}/10
              </span>
            )}
          </div>
        </>
      )}

      {/* Description */}
      {city.city_description && (
        <>
          <div className="border-t border-gray-100" />
          <p className="text-sm text-gray-700 leading-relaxed indent-2">
            {city.city_description}
          </p>
        </>
      )}

      <div className="border-t border-gray-100" />

      {/* Links */}
      <div className="flex flex-wrap gap-4">
        {city.visa_url && (
          <a
            href={city.visa_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm hover:underline"
            style={{ color: "#c9a84c" }}
          >
            비자 정보 →
          </a>
        )}
        {city.flatio_search_url && (
          <a
            href={city.flatio_search_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm hover:underline"
            style={{ color: "#c9a84c" }}
          >
            숙소 찾기 →
          </a>
        )}
        {city.anyplace_search_url && (
          <a
            href={city.anyplace_search_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm hover:underline"
            style={{ color: "#c9a84c" }}
          >
            Anyplace →
          </a>
        )}
        {city.nomad_meetup_url && (
          <a
            href={city.nomad_meetup_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm hover:underline"
            style={{ color: "#c9a84c" }}
          >
            밋업 →
          </a>
        )}
      </div>

      {/* Data source */}
      {city.data_verified_date && (
        <p className="text-xs text-gray-300 mt-1">
          데이터 기준: {city.data_verified_date} · Numbeo, NomadList
        </p>
      )}
    </div>
  );
}

export default function CityCompare({ cities, onRetry }: CityCompareProps) {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <motion.div {...fadeUp(0)} className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">도시 비교</h1>
        <p className="text-sm text-gray-400 mt-1">
          추천된 {cities.length}개 도시를 나란히 비교해보세요
        </p>
      </motion.div>

      {/* Desktop: 3-col grid / Mobile: vertical scroll */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cities.map((city, i) => (
          <motion.div key={city.city} {...fadeUp(0.1 + i * 0.15)}>
            <CityCard city={city} rank={i} />
          </motion.div>
        ))}
      </div>

      {/* Retry CTA */}
      <motion.div {...fadeUp(0.6)} className="mt-10 text-center">
        <button
          type="button"
          onClick={onRetry}
          className="text-sm text-gray-400 hover:text-gray-700 transition-colors py-2"
        >
          처음부터 다시하기
        </button>
      </motion.div>
    </div>
  );
}
