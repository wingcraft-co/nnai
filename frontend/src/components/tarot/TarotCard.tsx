"use client";

import { motion } from "framer-motion";
import type { CityData } from "./types";

// ── Flag emoji lookup ─────────────────────────────────────────────

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

// ── Size variant config ───────────────────────────────────────────

export type CardSize = "sm" | "md" | "lg";

const SIZE_CONFIG = {
  sm:  { w: 140, h: 245, pad: 16, flag: 24, cityKr: 14, cityEn: 9,  metricLabel: 7,  metricVal: 10, readingFs: 10, compassD: 56 },
  md:  { w: 200, h: 350, pad: 20, flag: 28, cityKr: 18, cityEn: 11, metricLabel: 8,  metricVal: 11, readingFs: 12, compassD: 80 },
  lg:  { w: 260, h: 455, pad: 20, flag: 28, cityKr: 18, cityEn: 11, metricLabel: 8,  metricVal: 11, readingFs: 12, compassD: 80 },
} as const;

const USD_TO_KRW = 1400;

function toKRW(usd: number): string {
  return `${Math.round((usd * USD_TO_KRW) / 10000)}만원`;
}

// ── Props ─────────────────────────────────────────────────────────

export interface TarotCardProps {
  state: "back" | "front" | "locked";
  size?: CardSize;
  cityData?: CityData | null;
  isSelected?: boolean;
  isFlipped?: boolean;
  readingText?: string | null;
  onClick?: () => void;
}

// ── Compass Rose SVG ──────────────────────────────────────────────

function CompassRose({ diameter }: { diameter: number }) {
  const r = diameter / 2;
  const ir = r * 0.5;
  const dotR = r * 0.1;

  return (
    <svg width={diameter} height={diameter} viewBox={`0 0 ${diameter} ${diameter}`} fill="none">
      {/* Outer circle */}
      <circle cx={r} cy={r} r={r - 1} stroke="var(--accent)" strokeWidth={1} />
      {/* Cross */}
      <line x1={0} y1={r} x2={diameter} y2={r} stroke="var(--accent)" strokeWidth={0.8} />
      <line x1={r} y1={0} x2={r} y2={diameter} stroke="var(--accent)" strokeWidth={0.8} />
      {/* Diagonals */}
      <line x1={r - r * 0.707} y1={r - r * 0.707} x2={r + r * 0.707} y2={r + r * 0.707} stroke="var(--accent)" strokeWidth={0.5} />
      <line x1={r + r * 0.707} y1={r - r * 0.707} x2={r - r * 0.707} y2={r + r * 0.707} stroke="var(--accent)" strokeWidth={0.5} />
      {/* Inner circle */}
      <circle cx={r} cy={r} r={ir} stroke="var(--accent)" strokeWidth={0.8} />
      {/* Center dot */}
      <circle cx={r} cy={r} r={dotR} fill="var(--accent)" />
    </svg>
  );
}

// ── Back Face ─────────────────────────────────────────────────────

function BackFace({ isSelected, size }: { isSelected: boolean; size: CardSize }) {
  const cfg = SIZE_CONFIG[size];

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden pointer-events-none"
      style={{
        borderRadius: 12,
        background: "var(--card)",
        border: isSelected
          ? "2px solid #c9a84c"
          : "1px solid var(--border)",
        boxShadow: isSelected ? "0 0 20px 4px rgba(201,168,76,0.35), 0 0 60px 8px rgba(201,168,76,0.12)" : "none",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
      }}
    >
      {/* Inset border */}
      <div
        className="absolute pointer-events-none"
        style={{
          inset: 4,
          borderRadius: 8,
          border: "1px solid color-mix(in srgb, var(--border) 40%, transparent)",
        }}
      />

      {/* Compass rose */}
      <CompassRose diameter={cfg.compassD} />

      {/* NNAI */}
      <span
        className="absolute font-mono text-[10px]"
        style={{
          bottom: 16,
          letterSpacing: "0.2em",
          color: "var(--muted-foreground)",
        }}
      >
        NNAI
      </span>
    </div>
  );
}

// ── Front Face ────────────────────────────────────────────────────

function FrontFace({
  cityData,
  size,
  readingText,
}: {
  cityData: CityData;
  size: CardSize;
  readingText?: string | null;
}) {
  const cfg = SIZE_CONFIG[size];
  const flag = FLAG_EMOJI[cityData.country_id] ?? "🌍";
  const visaText =
    cityData.visa_free_days > 0
      ? `${cityData.visa_free_days}일`
      : "비자 필요";

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden pointer-events-none"
      style={{
        borderRadius: 12,
        background: "var(--card)",
        border: "1px solid var(--border)",
        padding: cfg.pad,
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: "rotateY(180deg)",
      }}
    >
      {/* Top section — flex-1 */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <span className="leading-none" style={{ fontSize: cfg.flag }}>{flag}</span>
        <p
          className="font-serif font-bold text-center leading-tight mt-1.5"
          style={{ fontSize: cfg.cityKr, color: "var(--foreground)" }}
        >
          {cityData.city_kr}
        </p>
        <p
          className="font-mono text-center leading-tight mt-0.5"
          style={{ fontSize: cfg.cityEn, color: "var(--muted-foreground)", letterSpacing: "0.03em" }}
        >
          {cityData.city}, {cityData.country_id}
        </p>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "color-mix(in srgb, var(--border) 40%, transparent)" }} />

      {/* Metrics — fixed bottom */}
      <div className="flex justify-around items-center font-mono text-center pt-2.5 pb-1">
        <MetricCell icon="💰" label="MONTHLY" value={toKRW(cityData.monthly_cost_usd)} labelFs={cfg.metricLabel} valueFs={cfg.metricVal} />
        <MetricCell icon="🛂" label="VISA" value={visaText} labelFs={cfg.metricLabel} valueFs={cfg.metricVal} />
        {cityData.internet_mbps != null && (
          <MetricCell icon="📶" label="INTERNET" value={`${cityData.internet_mbps}Mbps`} labelFs={cfg.metricLabel} valueFs={cfg.metricVal} />
        )}
      </div>

      {/* Reading text area — only when provided */}
      {readingText && (
        <>
          <div style={{ height: 1, background: "color-mix(in srgb, var(--border) 40%, transparent)", marginTop: 4 }} />
          <p
            className="font-serif leading-snug mt-2 overflow-hidden"
            style={{
              fontSize: cfg.readingFs,
              color: "var(--muted-foreground)",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical" as const,
            }}
          >
            {readingText}
          </p>
        </>
      )}
    </div>
  );
}

// ── Metric Cell ───────────────────────────────────────────────────

function MetricCell({
  icon,
  label,
  value,
  labelFs,
  valueFs,
}: {
  icon: string;
  label: string;
  value: string;
  labelFs: number;
  valueFs: number;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span style={{ fontSize: valueFs + 2, lineHeight: 1 }}>{icon}</span>
      <span
        className="font-mono uppercase"
        style={{ fontSize: labelFs, color: "var(--muted-foreground)", letterSpacing: "0.05em" }}
      >
        {label}
      </span>
      <span
        className="font-mono font-bold"
        style={{ fontSize: valueFs, color: "var(--foreground)" }}
      >
        {value}
      </span>
    </div>
  );
}

// ── 540deg exponential flip ───────────────────────────────────────

const FLIP_KEYFRAMES = [0, 180, 360, 450, 540];
const FLIP_TIMES = [0, 0.15, 0.4, 0.7, 1.0];

// ── Main Component ────────────────────────────────────────────────

export default function TarotCard({
  state,
  size = "md",
  cityData,
  isSelected = false,
  isFlipped = false,
  readingText,
  onClick,
}: TarotCardProps) {
  const cfg = SIZE_CONFIG[size];
  const isLocked = state === "locked";

  return (
    <div
      className={`select-none ${isLocked ? "" : "cursor-pointer"}`}
      style={{ perspective: 1200, width: cfg.w, height: cfg.h }}
      onClick={isLocked ? undefined : onClick}
    >
      <motion.div
        className="relative w-full h-full pointer-events-none"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: isFlipped ? FLIP_KEYFRAMES : 0 }}
        transition={
          isFlipped
            ? { duration: 1.1, times: FLIP_TIMES, ease: ["easeIn", "linear", "easeOut", "easeOut"] }
            : { duration: 0 }
        }
      >
        {/* Back face */}
        <BackFace isSelected={isSelected} size={size} />

        {/* Front face */}
        {cityData ? (
          <FrontFace cityData={cityData} size={size} readingText={readingText} />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              borderRadius: 12,
              background: "var(--card)",
              border: "1px solid var(--border)",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          />
        )}
      </motion.div>

      {/* Lock overlay */}
      {isLocked && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ borderRadius: 12, background: "color-mix(in srgb, var(--card) 60%, transparent)" }}
        >
          <span style={{ fontSize: size === "sm" ? 24 : 32 }}>🔒</span>
        </div>
      )}
    </div>
  );
}
