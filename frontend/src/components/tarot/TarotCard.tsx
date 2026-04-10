"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Wifi, Languages, Banknote } from "lucide-react";
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
  city: CityData | null;
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
      style={{ width: 120, height: 180, perspective: 800, ...style }}
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
          className={`absolute inset-0 rounded-lg flex items-center justify-center border-2 ${
            isSelected
              ? "border-primary shadow-[0_0_16px_4px] shadow-primary/40"
              : "border-primary/30"
          }`}
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            background: "var(--card)",
          }}
        >
          <span className="text-2xl font-serif text-primary/60">
            ✦
          </span>
        </div>

        {/* Front face */}
        <div
          className={`absolute inset-0 rounded-lg flex flex-col items-center justify-center gap-1 p-2 overflow-hidden border-2 bg-card ${
            isSelected
              ? "border-primary shadow-[0_0_16px_4px] shadow-primary/40"
              : "border-border"
          }`}
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          {city && (
            <>
              <span className="text-3xl leading-none">{flag}</span>
              <p className="text-sm font-bold text-center text-foreground leading-tight line-clamp-2">
                {city.city_kr}
              </p>
              <div className="w-full border-t border-border mt-1.5 pt-1.5 space-y-1">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Banknote className="size-3 shrink-0" />
                  <span className="truncate">{toKRW(city.monthly_cost_usd)}</span>
                </div>
                {city.internet_mbps != null && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Wifi className="size-3 shrink-0" />
                    <span>{city.internet_mbps}Mbps</span>
                  </div>
                )}
                {city.english_score != null && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Languages className="size-3 shrink-0" />
                    <span>영어 {city.english_score}/10</span>
                  </div>
                )}
                {city.safety_score != null && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <ShieldCheck className="size-3 shrink-0" />
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
          className="absolute inset-0 rounded-lg pointer-events-none shadow-[0_0_20px_6px] shadow-primary/50"
        />
      )}
    </div>
  );
}
