"use client";

import { useEffect, useState } from "react";

import type {
  AnalyticsConsent,
  EffectiveAnalyticsMode,
} from "@/lib/analytics/consent";
import {
  getAnalyticsConsentCopy,
  stripLeadingHtmlHeading,
} from "@/lib/legal-content.mjs";

type AnalyticsConsentBannerProps = {
  consent: AnalyticsConsent;
  effectiveMode: EffectiveAnalyticsMode;
  fullTrackingAvailable: boolean;
  locale: string;
  privacyBodyHtml: string;
  onSelect: (consent: Exclude<AnalyticsConsent, "unknown">) => void;
  onClose?: () => void;
};

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
  const copy = getAnalyticsConsentCopy(locale, consent, effectiveMode);
  const dialogPrivacyBodyHtml = stripLeadingHtmlHeading(privacyBodyHtml);

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
                  {copy.title}
                </p>
              </div>
              {showDismiss && (
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 cursor-pointer text-2xl leading-none text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={copy.closeLabel}
                >
                  ×
                </button>
              )}
            </div>

            <div className="mt-2 space-y-2 text-xs leading-5 text-muted-foreground">
              <div className="flex items-end justify-between gap-3">
                <p className="flex-1">
                  {copy.description}
                </p>
                <button
                  type="button"
                  onClick={() => setDetailsOpen(true)}
                  className="shrink-0 cursor-pointer text-[11px] text-primary underline underline-offset-4 transition-colors hover:text-primary/80"
                >
                  {copy.detailsLabel}
                </button>
              </div>
              {!fullTrackingAvailable && (
                <p className="text-[11px] leading-4 text-muted-foreground/80">
                  {copy.unavailableNotice}
                </p>
              )}
              {!needsChoice && copy.currentSelection && (
                <p className="text-[11px] leading-4 text-muted-foreground/80">
                  {copy.currentSelection}
                </p>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => onSelect("essential")}
                className="inline-flex min-h-9 flex-1 cursor-pointer items-center justify-center border border-border bg-background px-3 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
              >
                {copy.buttons.essential}
              </button>
              <button
                type="button"
                onClick={() => onSelect("full")}
                className="inline-flex min-h-9 flex-1 cursor-pointer items-center justify-center bg-primary px-3 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {copy.buttons.full}
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
                {copy.privacyTitle}
              </h2>
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="shrink-0 cursor-pointer text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {copy.closeLabel}
              </button>
            </div>
            <div
              className="prose prose-slate max-w-none text-xs leading-5 prose-headings:text-foreground prose-headings:font-serif prose-h1:text-base prose-h2:text-sm prose-h3:text-xs prose-p:text-muted-foreground prose-li:text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: dialogPrivacyBodyHtml }}
            />
          </div>
        </div>
      )}
    </>
  );
}
