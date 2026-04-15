"use client";

import { useEffect, useState } from "react";

const FALLBACK_KRW_RATE = 1400;

let cachedRate: number | null = null;
let pendingPromise: Promise<number> | null = null;

export function useKrwRate(): number {
  const [rate, setRate] = useState<number>(cachedRate ?? FALLBACK_KRW_RATE);

  useEffect(() => {
    if (cachedRate !== null) {
      setRate(cachedRate);
      return;
    }

    if (!pendingPromise) {
      pendingPromise = fetch("/api/currency")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const krw =
            data && typeof data.krw === "number" && data.krw > 0
              ? data.krw
              : FALLBACK_KRW_RATE;
          cachedRate = krw;
          return krw;
        })
        .catch(() => {
          cachedRate = FALLBACK_KRW_RATE;
          return FALLBACK_KRW_RATE;
        });
    }

    pendingPromise.then((r) => setRate(r));
  }, []);

  return rate;
}

export function formatMonthly(
  usd: number,
  locale: string,
  krwRate: number = FALLBACK_KRW_RATE
): string {
  if (locale === "en") {
    return `$${Math.round(usd).toLocaleString("en-US")}`;
  }
  const krw = Math.round((usd * krwRate) / 10000);
  return `약 ${krw}만원`;
}

export function formatVisa(
  days: number | null | undefined,
  locale: string
): { label: string; value: string } {
  const isEn = locale === "en";
  if (days != null && days > 0) {
    return {
      label: "VISA-FREE",
      value: isEn ? `${days} days` : `${days}일`,
    };
  }
  return {
    label: "VISA",
    value: isEn ? "Required" : "필요",
  };
}

export function formatInternet(mbps: number | null | undefined): string {
  if (mbps == null) return "—";
  return `${mbps}Mbps`;
}
