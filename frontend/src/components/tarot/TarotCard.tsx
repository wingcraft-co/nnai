"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Wifi, Languages } from "lucide-react";
import type { CityData } from "./types";

// Flag emoji mapping by country_id (ISO-2)
const FLAG_EMOJI: Record<string, string> = {
  AD: "🇦🇩", AE: "🇦🇪", AF: "🇦🇫", AG: "🇦🇬", AL: "🇦🇱",
  AM: "🇦🇲", AO: "🇦🇴", AR: "🇦🇷", AT: "🇦🇹", AU: "🇦🇺",
  AZ: "🇦🇿", BA: "🇧🇦", BB: "🇧🇧", BD: "🇧🇩", BE: "🇧🇪",
  BF: "🇧🇫", BG: "🇧🇬", BH: "🇧🇭", BI: "🇧🇮", BJ: "🇧🇯",
  BN: "🇧🇳", BO: "🇧🇴", BR: "🇧🇷", BS: "🇧🇸", BT: "🇧🇹",
  BW: "🇧🇼", BY: "🇧🇾", BZ: "🇧🇿", CA: "🇨🇦", CD: "🇨🇩",
  CF: "🇨🇫", CG: "🇨🇬", CH: "🇨🇭", CI: "🇨🇮", CL: "🇨🇱",
  CM: "🇨🇲", CN: "🇨🇳", CO: "🇨🇴", CR: "🇨🇷", CU: "🇨🇺",
  CV: "🇨🇻", CY: "🇨🇾", CZ: "🇨🇿", DE: "🇩🇪", DJ: "🇩🇯",
  DK: "🇩🇰", DM: "🇩🇲", DO: "🇩🇴", DZ: "🇩🇿", EC: "🇪🇨",
  EE: "🇪🇪", EG: "🇪🇬", ER: "🇪🇷", ES: "🇪🇸", ET: "🇪🇹",
  FI: "🇫🇮", FJ: "🇫🇯", FM: "🇫🇲", FR: "🇫🇷", GA: "🇬🇦",
  GB: "🇬🇧", GD: "🇬🇩", GE: "🇬🇪", GH: "🇬🇭", GM: "🇬🇲",
  GN: "🇬🇳", GQ: "🇬🇶", GR: "🇬🇷", GT: "🇬🇹", GW: "🇬🇼",
  GY: "🇬🇾", HN: "🇭🇳", HR: "🇭🇷", HT: "🇭🇹", HU: "🇭🇺",
  ID: "🇮🇩", IE: "🇮🇪", IL: "🇮🇱", IN: "🇮🇳", IQ: "🇮🇶",
  IR: "🇮🇷", IS: "🇮🇸", IT: "🇮🇹", JM: "🇯🇲", JO: "🇯🇴",
  JP: "🇯🇵", KE: "🇰🇪", KG: "🇰🇬", KH: "🇰🇭", KI: "🇰🇮",
  KM: "🇰🇲", KN: "🇰🇳", KP: "🇰🇵", KR: "🇰🇷", KW: "🇰🇼",
  KZ: "🇰🇿", LA: "🇱🇦", LB: "🇱🇧", LC: "🇱🇨", LI: "🇱🇮",
  LK: "🇱🇰", LR: "🇱🇷", LS: "🇱🇸", LT: "🇱🇹", LU: "🇱🇺",
  LV: "🇱🇻", LY: "🇱🇾", MA: "🇲🇦", MC: "🇲🇨", MD: "🇲🇩",
  ME: "🇲🇪", MG: "🇲🇬", MH: "🇲🇭", MK: "🇲🇰", ML: "🇲🇱",
  MM: "🇲🇲", MN: "🇲🇳", MR: "🇲🇷", MT: "🇲🇹", MU: "🇲🇺",
  MV: "🇲🇻", MW: "🇲🇼", MX: "🇲🇽", MY: "🇲🇾", MZ: "🇲🇿",
  NA: "🇳🇦", NE: "🇳🇪", NG: "🇳🇬", NI: "🇳🇮", NL: "🇳🇱",
  NO: "🇳🇴", NP: "🇳🇵", NR: "🇳🇷", NZ: "🇳🇿", OM: "🇴🇲",
  PA: "🇵🇦", PE: "🇵🇪", PG: "🇵🇬", PH: "🇵🇭", PK: "🇵🇰",
  PL: "🇵🇱", PT: "🇵🇹", PW: "🇵🇼", PY: "🇵🇾", QA: "🇶🇦",
  RO: "🇷🇴", RS: "🇷🇸", RU: "🇷🇺", RW: "🇷🇼", SA: "🇸🇦",
  SB: "🇸🇧", SC: "🇸🇨", SD: "🇸🇩", SE: "🇸🇪", SG: "🇸🇬",
  SI: "🇸🇮", SK: "🇸🇰", SL: "🇸🇱", SM: "🇸🇲", SN: "🇸🇳",
  SO: "🇸🇴", SR: "🇸🇷", SS: "🇸🇸", ST: "🇸🇹", SV: "🇸🇻",
  SY: "🇸🇾", SZ: "🇸🇿", TD: "🇹🇩", TG: "🇹🇬", TH: "🇹🇭",
  TJ: "🇹🇯", TL: "🇹🇱", TM: "🇹🇲", TN: "🇹🇳", TO: "🇹🇴",
  TR: "🇹🇷", TT: "🇹🇹", TV: "🇹🇻", TZ: "🇹🇿", UA: "🇺🇦",
  UG: "🇺🇬", US: "🇺🇸", UY: "🇺🇾", UZ: "🇺🇿", VA: "🇻🇦",
  VC: "🇻🇨", VE: "🇻🇪", VN: "🇻🇳", VU: "🇻🇺", WS: "🇼🇸",
  YE: "🇾🇪", ZA: "🇿🇦", ZM: "🇿🇲", ZW: "🇿🇼",
};

const USD_TO_KRW = 1400;

function toKRW(usd: number): string {
  const manwon = Math.round((usd * USD_TO_KRW) / 10000);
  return `약 ${manwon}만원`;
}

interface TarotCardProps {
  city: CityData | null; // null = face-down (back only)
  isSelected?: boolean;
  isLocked?: boolean;
  isFlipped?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export default function TarotCard({
  city,
  isSelected = false,
  isLocked = false,
  isFlipped = false,
  onClick,
  style,
}: TarotCardProps) {
  const flag = city ? (FLAG_EMOJI[city.country_id] ?? "🌍") : null;

  return (
    <div
      className="relative cursor-pointer select-none"
      style={{ width: 80, height: 120, perspective: 800, ...style }}
      onClick={onClick}
    >
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      >
        {/* Back face */}
        <div
          className="absolute inset-0 rounded-lg flex items-center justify-center"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            background: "#1a1a2e",
            border: isSelected
              ? "2px solid #c9a84c"
              : "2px solid rgba(201,168,76,0.4)",
            boxShadow: isSelected
              ? "0 0 16px 4px rgba(201,168,76,0.55)"
              : undefined,
          }}
        >
          <span
            className="text-2xl font-serif"
            style={{ color: "rgba(201,168,76,0.7)" }}
          >
            ✦
          </span>
        </div>

        {/* Front face */}
        <div
          className="absolute inset-0 rounded-lg flex flex-col items-center justify-center gap-1 p-2 overflow-hidden"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            background: "#ffffff",
            border: isSelected
              ? "2px solid #c9a84c"
              : "2px solid #e5e7eb",
            boxShadow: isSelected
              ? "0 0 16px 4px rgba(201,168,76,0.55)"
              : undefined,
          }}
        >
          {city && (
            <>
              <span className="text-2xl leading-none">{flag}</span>
              <p className="text-[10px] font-bold text-center text-gray-800 leading-tight line-clamp-2">
                {city.city_kr}
              </p>
              <div className="w-full border-t border-gray-100 mt-1 pt-1 space-y-0.5">
                <div className="flex items-center gap-0.5 text-[8px] text-gray-500">
                  <span>💰</span>
                  <span className="truncate">{toKRW(city.monthly_cost_usd)}</span>
                </div>
                {city.internet_mbps != null && (
                  <div className="flex items-center gap-0.5 text-[8px] text-gray-500">
                    <Wifi className="size-2 shrink-0" />
                    <span>{city.internet_mbps}Mbps</span>
                  </div>
                )}
                {city.english_score != null && (
                  <div className="flex items-center gap-0.5 text-[8px] text-gray-500">
                    <Languages className="size-2 shrink-0" />
                    <span>영어 {city.english_score}/10</span>
                  </div>
                )}
                {city.safety_score != null && (
                  <div className="flex items-center gap-0.5 text-[8px] text-gray-500">
                    <ShieldCheck className="size-2 shrink-0" />
                    <span>치안 {city.safety_score}/10</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Lock overlay */}
          {isLocked && (
            <div className="absolute inset-0 rounded-lg flex items-center justify-center bg-black/60">
              <span className="text-xl">🔒</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Selection glow ring (back face) — shown when selected and not flipped */}
      {isSelected && !isFlipped && (
        <div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            boxShadow: "0 0 20px 6px rgba(201,168,76,0.6)",
          }}
        />
      )}
    </div>
  );
}
