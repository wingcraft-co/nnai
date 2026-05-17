"use client";

import { useEffect, useState } from "react";

import type {
  AnalyticsConsent,
  EffectiveAnalyticsMode,
} from "@/lib/analytics/consent";

type AnalyticsConsentBannerProps = {
  consent: AnalyticsConsent;
  effectiveMode: EffectiveAnalyticsMode;
  fullTrackingAvailable: boolean;
  locale: string;
  privacyBodyHtml: string;
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
  privacyBodyHtml,
  onSelect,
  onClose,
}: AnalyticsConsentBannerProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const showDismiss = consent !== "unknown" && typeof onClose === "function";
  const needsChoice = consent === "unknown";
  const effectiveLabel =
    effectiveMode === "full"
      ? "전체 분석"
      : effectiveMode === "essential"
        ? "필수 분석"
        : "대기";
  const isEn = locale === "en";
  const title = isEn ? "Cookie Settings" : "쿠키 설정";
  const detailsLabel = isEn ? "Details" : "자세히 보기";
  const closeLabel = isEn ? "Close" : "닫기";
  const privacyTitle = isEn ? "Privacy Policy" : "개인정보처리방침";

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (detailsOpen) {
          setDetailsOpen(false);
        } else if (showDismiss) {
          onClose?.();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [detailsOpen, onClose, showDismiss]);

  return (
    <>
      <aside className="fixed bottom-4 right-4 z-[60] w-[calc(100vw-2rem)] max-w-[330px]">
        <div className="overflow-hidden border border-border bg-background text-foreground shadow-[0_16px_40px_rgba(15,23,42,0.10)]">
          <div className="relative px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 pr-4">
                <p className="font-serif text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {title}
                </p>
              </div>
              {showDismiss && (
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 cursor-pointer text-2xl leading-none text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={closeLabel}
                >
                  ×
                </button>
              )}
            </div>

            <div className="mt-2 space-y-2 text-xs leading-5 text-muted-foreground">
              <div className="flex items-end justify-between gap-3">
                <p className="flex-1">
                  더 나은 사용자 경험과 사이트 개선을 위해 분석을 사용합니다. 필수 분석은
                  익명 최소 추적만, 전체 허용은 쿠키 기반 추적을 포함합니다.
                </p>
                <button
                  type="button"
                  onClick={() => setDetailsOpen(true)}
                  className="shrink-0 cursor-pointer text-[11px] text-primary underline underline-offset-4 transition-colors hover:text-primary/80"
                >
                  {detailsLabel}
                </button>
              </div>
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

      {detailsOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/20 px-4 py-6 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-details-title"
          onClick={() => setDetailsOpen(false)}
        >
          <div
            className="max-h-[72vh] w-full max-w-xl overflow-y-auto rounded-md bg-background p-5 text-left shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 id="cookie-details-title" className="font-serif text-base font-semibold text-foreground">
                {privacyTitle}
              </h2>
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="shrink-0 cursor-pointer text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {closeLabel}
              </button>
            </div>
            <div
              className="prose prose-slate max-w-none text-xs leading-5 prose-headings:text-foreground prose-headings:font-serif prose-h1:text-base prose-h2:text-sm prose-h3:text-xs prose-p:text-muted-foreground prose-li:text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: privacyBodyHtml }}
            />
          </div>
        </div>
      )}
    </>
  );
}
