"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { getLegalLabels, shouldHideLegalFooter } from "@/lib/legal-content.mjs";

type LegalFooterProps = {
  locale: string;
};

export function LegalFooter({ locale }: LegalFooterProps) {
  const pathname = usePathname();

  if (shouldHideLegalFooter(pathname)) {
    return null;
  }

  const labels = getLegalLabels(locale);

  return (
    <footer className="border-t border-border/60 bg-background/95 px-4 py-6 text-xs text-muted-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-3 sm:justify-between">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href={`/${locale}/terms`} className="transition-colors hover:text-foreground">
            {labels.footer.terms}
          </Link>
          <Link href={`/${locale}/privacy`} className="transition-colors hover:text-foreground">
            {labels.footer.privacy}
          </Link>
          <a
            href="mailto:nnai.support@gmail.com"
            className="transition-colors hover:text-foreground"
          >
            {labels.footer.support}
          </a>
        </div>
        <p className="text-center text-[11px] text-muted-foreground/80">
          NomadNavigator AI
        </p>
      </div>
    </footer>
  );
}
