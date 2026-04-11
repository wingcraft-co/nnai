"use client";

import { motion } from "framer-motion";
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
  return `약 ${Math.round((usd * USD_TO_KRW) / 10000)}만원`;
}

interface TarotCardProps {
  state: "back" | "front" | "locked";
  cityData?: CityData | null;
  isSelected?: boolean;
  onClick?: () => void;
}

/* ── Corner L-shaped flourish ── */
function CornerFlourish({
  position,
}: {
  position: "tl" | "tr" | "bl" | "br";
}) {
  const base = "absolute bg-border";
  const arm = 20; // px length of each arm
  const t = 2; // px thickness

  // Each L has a horizontal and a vertical arm
  const posMap: Record<string, { h: string; v: string }> = {
    tl: {
      h: `top-0 left-0 rounded-tl-sm`,
      v: `top-0 left-0 rounded-tl-sm`,
    },
    tr: {
      h: `top-0 right-0 rounded-tr-sm`,
      v: `top-0 right-0 rounded-tr-sm`,
    },
    bl: {
      h: `bottom-0 left-0 rounded-bl-sm`,
      v: `bottom-0 left-0 rounded-bl-sm`,
    },
    br: {
      h: `bottom-0 right-0 rounded-br-sm`,
      v: `bottom-0 right-0 rounded-br-sm`,
    },
  };

  const p = posMap[position];

  return (
    <>
      {/* horizontal arm */}
      <div
        className={`${base} ${p.h}`}
        style={{ width: arm, height: t }}
      />
      {/* vertical arm */}
      <div
        className={`${base} ${p.v}`}
        style={{ width: t, height: arm }}
      />
    </>
  );
}

/* ── Compass Rose (all CSS) ── */
function CompassRose() {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
      {/* Outer circle */}
      <div
        className="absolute rounded-full border border-border"
        style={{ width: 80, height: 80 }}
      />

      {/* Cardinal rays — horizontal */}
      <div
        className="absolute bg-border"
        style={{ width: 80, height: 1, top: "50%", left: 0, transform: "translateY(-50%)" }}
      />
      {/* Cardinal rays — vertical */}
      <div
        className="absolute bg-border"
        style={{ width: 1, height: 80, left: "50%", top: 0, transform: "translateX(-50%)" }}
      />

      {/* Diagonal rays — 45deg */}
      <div
        className="absolute bg-border"
        style={{
          width: 80,
          height: 1,
          top: "50%",
          left: 0,
          transform: "translateY(-50%) rotate(45deg)",
        }}
      />
      {/* Diagonal rays — -45deg */}
      <div
        className="absolute bg-border"
        style={{
          width: 80,
          height: 1,
          top: "50%",
          left: 0,
          transform: "translateY(-50%) rotate(-45deg)",
        }}
      />

      {/* Inner circle */}
      <div
        className="absolute rounded-full border border-primary"
        style={{ width: 40, height: 40 }}
      />

      {/* Center dot */}
      <div
        className="absolute rounded-full bg-primary"
        style={{ width: 8, height: 8 }}
      />
    </div>
  );
}

/* ── Back Face ── */
function BackFace({ isSelected }: { isSelected: boolean }) {
  return (
    <div
      className={`relative w-full h-full rounded-lg flex flex-col items-center justify-center gap-4 bg-card border-[1.5px] ${
        isSelected ? "border-primary" : "border-border"
      }`}
      style={
        isSelected
          ? { boxShadow: "0 0 16px 4px var(--ring)" }
          : undefined
      }
    >
      {/* Inner border */}
      <div
        className={`absolute rounded border ${
          isSelected ? "border-primary" : "border-border"
        } pointer-events-none`}
        style={{ inset: 6 }}
      />

      {/* Corner flourishes (inside inner border) */}
      <div className="absolute pointer-events-none" style={{ inset: 6 }}>
        <CornerFlourish position="tl" />
        <CornerFlourish position="tr" />
        <CornerFlourish position="bl" />
        <CornerFlourish position="br" />
      </div>

      {/* Compass rose */}
      <CompassRose />

      {/* NNAI text */}
      <span className="font-mono text-[10px] tracking-[0.35em] text-border">
        NNAI
      </span>
    </div>
  );
}

/* ── Front Face ── */
function FrontFace({ cityData }: { cityData: CityData }) {
  const flag = FLAG_EMOJI[cityData.country_id] ?? "🌍";
  const visaText =
    cityData.visa_free_days > 0
      ? `무비자 ${cityData.visa_free_days}일`
      : "비자 필요";

  return (
    <motion.div
      className="w-full h-full rounded-lg flex flex-col items-center justify-center px-4 py-5 bg-card border-[1.5px] border-border"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Flag */}
      <span className="leading-none" style={{ fontSize: 32 }}>
        {flag}
      </span>

      {/* City name EN */}
      <p className="font-mono text-sm font-medium text-foreground mt-2 text-center leading-tight">
        {cityData.city}
      </p>

      {/* City name KR */}
      <p className="font-serif text-lg font-bold text-foreground text-center leading-tight">
        {cityData.city_kr}
      </p>

      {/* Gold divider */}
      <div className="w-full h-px bg-border my-3.5" />

      {/* Metrics */}
      <div className="w-full space-y-2">
        {/* Monthly cost */}
        <MetricRow icon="💰" label="MONTHLY" value={toKRW(cityData.monthly_cost_usd)} />

        {/* Visa-free */}
        <MetricRow icon="🛂" label="VISA-FREE" value={visaText} />

        {/* Internet */}
        {cityData.internet_mbps != null && (
          <MetricRow icon="📶" label="INTERNET" value={`${cityData.internet_mbps} Mbps`} />
        )}
      </div>

      {/* Bottom divider */}
      <div className="w-full h-px bg-border mt-3.5" />
    </motion.div>
  );
}

/* ── Metric Row ── */
function MetricRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
      <div className="flex flex-col">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground leading-tight">
          {label}
        </span>
        <span className="font-mono text-[13px] font-medium text-foreground leading-tight">
          {value}
        </span>
      </div>
    </div>
  );
}

/* ── Main Component ── */
export default function TarotCard({
  state,
  cityData,
  isSelected = false,
  onClick,
}: TarotCardProps) {
  const isLocked = state === "locked";

  return (
    <motion.div
      className={`relative select-none aspect-[2/3] ${isLocked ? "" : "cursor-pointer"}`}
      whileTap={isLocked ? undefined : { scale: 1.02 }}
      transition={{ duration: 0.1 }}
      onClick={isLocked ? undefined : onClick}
    >
      {state === "front" && cityData ? (
        <FrontFace cityData={cityData} />
      ) : (
        <BackFace isSelected={isSelected} />
      )}

      {/* Lock overlay */}
      {isLocked && (
        <div className="absolute inset-0 rounded-lg flex items-center justify-center bg-card/60">
          <span style={{ fontSize: 32 }}>🔒</span>
        </div>
      )}
    </motion.div>
  );
}
