"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { AnalyticsSettingsButton } from "@/components/analytics/AnalyticsSettingsButton";
import {
  BUSINESS_INFO,
  getLegalLabels,
  shouldHideLegalFooter,
  shouldUseDarkLegalChrome,
  stripLeadingHeadingBlock,
  stripLeadingHtmlHeading,
} from "@/lib/legal-content.mjs";

type LegalBlock = {
  type: string;
  text?: string;
  items?: string[];
};

type LegalFooterProps = {
  locale: string;
  termsBlocks: LegalBlock[];
  privacyBodyHtml: string;
};

type ActiveDialog = "terms" | "privacy" | null;

export function LegalFooter({ locale, termsBlocks, privacyBodyHtml }: LegalFooterProps) {
  const pathname = usePathname();
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const labels = getLegalLabels(locale);
  const dialogTitle =
    activeDialog === "terms" ? labels.legal.termsTitle : labels.legal.privacyTitle;
  const dialogTermsBlocks = stripLeadingHeadingBlock(termsBlocks) as LegalBlock[];
  const dialogPrivacyBodyHtml = stripLeadingHtmlHeading(privacyBodyHtml);
  const isDarkChrome = shouldUseDarkLegalChrome(pathname);
  const footerClass = isDarkChrome
    ? "border-t border-transparent bg-[oklch(0.1450_0_0)] px-4 py-6 text-xs text-white/24"
    : "border-t border-border/60 bg-background/95 px-4 py-6 text-xs text-muted-foreground";
  const footerLinkClass = isDarkChrome
    ? "cursor-pointer transition-colors hover:text-white/55"
    : "cursor-pointer transition-colors hover:text-foreground";
  const footerBrandClass = isDarkChrome
    ? "cursor-pointer text-center text-[11px] text-white/22 transition-colors hover:text-white/45"
    : "cursor-pointer text-center text-[11px] text-muted-foreground/80 transition-colors hover:text-foreground";
  const businessBlockClass = isDarkChrome
    ? "mx-auto mt-3 w-full max-w-5xl border-t border-white/10 pt-3 text-[10.5px] leading-relaxed text-white/24"
    : "mx-auto mt-3 w-full max-w-5xl border-t border-border/40 pt-3 text-[10.5px] leading-relaxed text-muted-foreground/80";
  const businessLabel = labels.footer.business;

  useEffect(() => {
    if (!activeDialog) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveDialog(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeDialog]);

  if (shouldHideLegalFooter(pathname)) {
    return null;
  }

  return (
    <>
      <footer className={footerClass}>
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-3 sm:justify-between">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setActiveDialog("terms")}
              className={footerLinkClass}
            >
              {labels.footer.terms}
            </button>
            <button
              type="button"
              onClick={() => setActiveDialog("privacy")}
              className={footerLinkClass}
            >
              {labels.footer.privacy}
            </button>
            <a
              href="mailto:nnai.support@gmail.com"
              className={footerLinkClass}
            >
              {labels.footer.support}
            </a>
            <AnalyticsSettingsButton
              label={labels.footer.privacySettings}
              className={footerLinkClass}
            />
          </div>
          <a
            href="https://wingcraft.co"
            target="_blank"
            rel="noreferrer"
            className={footerBrandClass}
          >
            Wingcraft Co
          </a>
        </div>

        <div className={businessBlockClass}>
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:justify-start">
            <span>
              <span className="font-medium">{businessLabel.companyName}</span>{" "}
              {BUSINESS_INFO.companyName}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <span className="font-medium">{businessLabel.ceo}</span>{" "}
              {BUSINESS_INFO.ceo}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <span className="font-medium">{businessLabel.businessNumber}</span>{" "}
              {BUSINESS_INFO.businessNumber}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <span className="font-medium">{businessLabel.email}</span>{" "}
              <a
                href={`mailto:${BUSINESS_INFO.email}`}
                className="underline-offset-2 hover:underline"
              >
                {BUSINESS_INFO.email}
              </a>
            </span>
          </p>
          <p className="mt-1 text-center sm:text-left">
            <span className="font-medium">{businessLabel.address}</span>{" "}
            {BUSINESS_INFO.address}
          </p>
        </div>
      </footer>

      {activeDialog && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/20 px-4 py-6 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="legal-dialog-title"
          onClick={() => setActiveDialog(null)}
        >
          <div
            className="max-h-[72vh] w-full max-w-xl overflow-y-auto rounded-md bg-background p-5 text-left shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 id="legal-dialog-title" className="font-serif text-base font-semibold text-foreground">
                {dialogTitle}
              </h2>
              <button
                type="button"
                onClick={() => setActiveDialog(null)}
                className="shrink-0 cursor-pointer text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {labels.footer.close}
              </button>
            </div>

            {activeDialog === "terms" ? (
              <div className="space-y-3 text-xs leading-5 text-muted-foreground">
                {dialogTermsBlocks.map((block, index) => {
                  if (block.type === "h1" || block.type === "h2") {
                    return (
                      <h3 key={index} className="pt-2 text-sm font-semibold text-foreground">
                        {block.text ?? ""}
                      </h3>
                    );
                  }

                  if (block.type === "h3") {
                    return (
                      <h4 key={index} className="text-xs font-semibold text-foreground">
                        {block.text ?? ""}
                      </h4>
                    );
                  }

                  if (block.type === "ul") {
                    return (
                      <ul key={index} className="space-y-1 pl-4">
                        {(block.items ?? []).map((item) => (
                          <li key={item} className="list-disc">
                            {item}
                          </li>
                        ))}
                      </ul>
                    );
                  }

                  return <p key={index}>{block.text ?? ""}</p>;
                })}
              </div>
            ) : (
              <div
                className="prose prose-slate max-w-none text-xs leading-5 prose-headings:text-foreground prose-headings:font-serif prose-h1:text-base prose-h2:text-sm prose-h3:text-xs prose-p:text-muted-foreground prose-li:text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: dialogPrivacyBodyHtml }}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
