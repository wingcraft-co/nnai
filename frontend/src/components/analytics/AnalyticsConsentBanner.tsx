"use client";

import Link from "next/link";

import type {
  AnalyticsConsent,
  EffectiveAnalyticsMode,
} from "@/lib/analytics/consent";

type AnalyticsConsentBannerProps = {
  consent: AnalyticsConsent;
  effectiveMode: EffectiveAnalyticsMode;
  fullTrackingAvailable: boolean;
  locale: string;
  onSelect: (consent: Exclude<AnalyticsConsent, "unknown">) => void;
  onClose?: () => void;
};

function getConsentLabel(consent: AnalyticsConsent) {
  switch (consent) {
    case "essential":
      return "필수 분석만 허용";
    case "full":
      return "전체 허용";
    default:
      return "선택 전";
  }
}

export function AnalyticsConsentBanner({
  consent,
  effectiveMode,
  fullTrackingAvailable,
  locale,
  onSelect,
  onClose,
}: AnalyticsConsentBannerProps) {
  const showDismiss = consent !== "unknown" && typeof onClose === "function";
  const needsChoice = consent === "unknown";
  const effectiveLabel =
    effectiveMode === "full"
      ? "전체 분석"
      : effectiveMode === "essential"
        ? "필수 분석"
        : "대기";

  return (
    <aside className="fixed bottom-4 right-4 z-[60] w-[calc(100vw-2rem)] max-w-[330px]">
      <div className="overflow-hidden border border-border bg-background text-foreground shadow-[0_16px_40px_rgba(15,23,42,0.10)]">
        <div className="relative px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 pr-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-serif text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Cookie Settings
                </p>
                <Link
                  href={`/${locale === "en" ? "en" : "ko"}/privacy#analytics-consent`}
                  className="shrink-0 text-[11px] text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
                >
                  자세히 보기
                </Link>
              </div>
            </div>
            {showDismiss && (
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 cursor-pointer text-2xl leading-none text-muted-foreground transition-colors hover:text-foreground"
                aria-label="닫기"
              >
                ×
              </button>
            )}
          </div>

          <div className="mt-2 space-y-2 text-xs leading-5 text-muted-foreground">
            <p>
              더 나은 사용자 경험과 사이트 개선을 위해 분석을 사용합니다. 필수 분석은
              익명 최소 추적만, 전체 허용은 쿠키 기반 추적을 포함합니다.
            </p>
            {!fullTrackingAvailable && (
              <p className="text-[11px] leading-4 text-muted-foreground/80">
                현재 preview에서는 전체 허용도 필수 분석으로 동작합니다.
              </p>
            )}
            {!needsChoice && (
              <p className="text-[11px] leading-4 text-muted-foreground/80">
                현재 선택: {getConsentLabel(consent)} · {effectiveLabel}
              </p>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => onSelect("essential")}
              className="inline-flex min-h-9 flex-1 cursor-pointer items-center justify-center border border-border bg-background px-3 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
            >
              필수 분석만 허용
            </button>
            <button
              type="button"
              onClick={() => onSelect("full")}
              className="inline-flex min-h-9 flex-1 cursor-pointer items-center justify-center bg-primary px-3 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              전체 허용
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
