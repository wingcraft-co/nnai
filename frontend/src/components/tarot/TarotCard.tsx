"use client";

import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useLocale } from "next-intl";
import { trackResultCardInteraction } from "@/lib/analytics/events";
import { Banknote, Stamp, Wifi } from "lucide-react";
import type { CityData } from "./types";
import {
  useKrwRate,
  formatMonthly,
  formatVisa,
  formatInternet,
} from "./format";

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

// ── Props ─────────────────────────────────────────────────────────

export interface TarotCardProps {
  state: "back" | "front" | "locked";
  size?: CardSize;
  cityData?: CityData | null;
  isSelected?: boolean;
  isFlipped?: boolean;
  readingText?: string | null;
  onClick?: () => void;
  /** Locked overlay visible (card-size inline) */
  showLockedOverlay?: boolean;
  onCloseLockedOverlay?: () => void;
  /** Polar checkout URL for locked CTA */
  checkoutUrl?: string | null;
  locale?: string;
}

// ── Compass Rose SVG ──────────────────────────────────────────────

function CompassRose({ diameter, active }: { diameter: number; active: boolean }) {
  const r = diameter / 2;
  const ir = r * 0.5;
  const dotR = r * 0.1;
  const color = active ? "var(--primary)" : "var(--border)";

  return (
    <svg width={diameter} height={diameter} viewBox={`0 0 ${diameter} ${diameter}`} fill="none" style={{ transition: "all 0.3s ease" }}>
      <circle cx={r} cy={r} r={r - 1} stroke={color} strokeWidth={1} />
      <line x1={0} y1={r} x2={diameter} y2={r} stroke={color} strokeWidth={0.8} />
      <line x1={r} y1={0} x2={r} y2={diameter} stroke={color} strokeWidth={0.8} />
      <line x1={r - r * 0.707} y1={r - r * 0.707} x2={r + r * 0.707} y2={r + r * 0.707} stroke={color} strokeWidth={0.5} />
      <line x1={r + r * 0.707} y1={r - r * 0.707} x2={r - r * 0.707} y2={r + r * 0.707} stroke={color} strokeWidth={0.5} />
      <circle cx={r} cy={r} r={ir} stroke={color} strokeWidth={0.8} />
      <circle cx={r} cy={r} r={dotR} fill={color} />
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
          ? "2px solid var(--primary)"
          : "1px solid var(--border)",
        boxShadow: isSelected
          ? "0 0 24px 6px var(--ring), 0 0 48px 12px color-mix(in srgb, var(--primary) 15%, transparent)"
          : "0 0 0px 0px transparent",
        transition: "border 0.35s ease, box-shadow 0.45s ease",
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
          border: isSelected
            ? "1px solid color-mix(in srgb, var(--primary) 30%, transparent)"
            : "1px solid color-mix(in srgb, var(--border) 40%, transparent)",
          transition: "border 0.35s ease",
        }}
      />

      {/* Compass rose */}
      <CompassRose diameter={cfg.compassD} active={isSelected} />

      {/* NNAI */}
      <span
        className="absolute font-mono text-[10px]"
        style={{
          bottom: 16,
          letterSpacing: "0.2em",
          color: isSelected ? "var(--primary)" : "var(--muted-foreground)",
          transition: "color 0.35s ease",
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
  isHovered = false,
  locale,
  krwRate,
}: {
  cityData: CityData;
  size: CardSize;
  readingText?: string | null;
  isHovered?: boolean;
  locale: string;
  krwRate: number;
}) {
  const cfg = SIZE_CONFIG[size];
  const flag = FLAG_EMOJI[cityData.country_id] ?? "🌍";
  const monthly = formatMonthly(cityData.monthly_cost_usd, locale, krwRate);
  const visa = formatVisa(cityData.visa_free_days, locale);
  const internet = formatInternet(cityData.internet_mbps);

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden pointer-events-none"
      style={{
        borderRadius: 12,
        background: "var(--card)",
        border: isHovered
          ? "1px solid color-mix(in srgb, var(--primary) 22%, var(--border))"
          : "1px solid var(--border)",
        padding: cfg.pad,
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: "rotateY(180deg)",
        transition: "border 0.2s ease",
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

      {/* Metrics — fixed bottom (always 3 cells for layout consistency) */}
      <div className="flex justify-around items-center font-mono text-center pt-2.5 pb-1">
        <MetricCell icon={<Banknote className="w-4 h-4" />} label="MONTHLY" value={monthly} labelFs={cfg.metricLabel} valueFs={cfg.metricVal} />
        <MetricCell icon={<Stamp className="w-4 h-4" />} label={visa.label} value={visa.value} labelFs={cfg.metricLabel} valueFs={cfg.metricVal} />
        <MetricCell icon={<Wifi className="w-4 h-4" />} label="INTERNET" value={internet} labelFs={cfg.metricLabel} valueFs={cfg.metricVal} />
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
  icon: ReactNode;
  label: string;
  value: string;
  labelFs: number;
  valueFs: number;
}) {
  return (
    <div className="flex-1 min-w-0 flex flex-col items-center gap-0.5">
      <div className="flex items-center justify-center" style={{ width: 16, height: 16, color: "var(--muted-foreground)" }}>
        {icon}
      </div>
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
  showLockedOverlay = false,
  onCloseLockedOverlay,
  checkoutUrl,
  locale: localeProp,
}: TarotCardProps) {
  const cfg = SIZE_CONFIG[size];
  const isLocked = state === "locked";
  const isFront = state === "front";
  const [isHovered, setIsHovered] = useState(false);
  const clickable = !!onClick;
  const localeHook = useLocale();
  const locale = localeProp ?? localeHook;
  const krwRate = useKrwRate();
  const isEn = locale === "en";

  return (
    <motion.div
      className={`relative select-none ${clickable ? "cursor-pointer" : ""}`}
      style={{ perspective: 1200, width: cfg.w, height: cfg.h, borderRadius: 12 }}
      animate={{
        opacity: !isLocked
          ? 1
          : showLockedOverlay
          ? 1
          : isHovered
          ? 0.65
          : 0.15,
      }}
      whileHover={
        clickable
          ? {
              scale: 1.025,
              boxShadow:
                "0 6px 18px color-mix(in srgb, var(--background) 70%, transparent)",
            }
          : undefined
      }
      transition={{
        opacity: { duration: 0.4, ease: "easeOut" },
        scale: { duration: 0.2, ease: "easeOut" },
        boxShadow: { duration: 0.2, ease: "easeOut" },
      }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
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
          <FrontFace
            cityData={cityData}
            size={size}
            readingText={readingText}
            isHovered={isFront && isHovered}
            locale={locale}
            krwRate={krwRate}
          />
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

      {/* Lock dim (default locked state) */}
      {isLocked && !showLockedOverlay && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ borderRadius: 12, background: "color-mix(in srgb, var(--card) 60%, transparent)" }}
        >
          <span
            style={{
              fontSize: size === "sm" ? 24 : 32,
              transform: `scale(${isHovered ? 1.08 : 1})`,
              transition: "transform 0.25s ease-out",
              display: "inline-block",
            }}
          >
            🔒
          </span>
        </div>
      )}

      {/* Lock upgrade inline overlay (card-sized) */}
      {isLocked && showLockedOverlay && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2"
          style={{
            borderRadius: 12,
            background: "color-mix(in srgb, var(--card) 85%, transparent)",
            border: "1px solid var(--border)",
            backdropFilter: "blur(4px)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* X close */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCloseLockedOverlay?.(); }}
            aria-label={isEn ? "Close" : "닫기"}
            className="absolute right-2 top-2 px-1.5 py-0.5 text-xs leading-none"
            style={{ color: "var(--muted-foreground)" }}
          >
            ✕
          </button>

          <span style={{ fontSize: size === "sm" ? 28 : 36 }}>🔒</span>
          <p
            className="font-serif text-center leading-snug px-3"
            style={{ fontSize: size === "sm" ? 11 : 13, color: "var(--foreground)" }}
          >
            {isEn ? "See more cities" : "추가 도시 보기"}
          </p>
          {checkoutUrl && (
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 px-3 py-1.5 text-center font-mono font-medium"
              style={{
                fontSize: size === "sm" ? 9 : 11,
                background: "var(--primary)",
                color: "var(--primary-foreground)",
                borderRadius: 4,
                letterSpacing: "0.03em",
              }}
              onClick={(e) => {
                e.stopPropagation();
                trackResultCardInteraction({ action: "unlock_click" });
              }}
            >
              {isEn ? "Unlock with Pro" : "Pro 잠금 해제"}
            </a>
          )}
        </div>
      )}
    </motion.div>
  );
}
