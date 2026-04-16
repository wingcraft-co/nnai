import Link from "next/link";

import { getLegalLabels } from "@/lib/legal-content.mjs";

type LegalPageShellProps = {
  locale: string;
  title: string;
  children: React.ReactNode;
};

export function LegalPageShell({ locale, title, children }: LegalPageShellProps) {
  const labels = getLegalLabels(locale);

  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground sm:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div className="space-y-3">
          <Link
            href={`/${locale}`}
            className="inline-flex text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
          >
            {labels.legal.back}
          </Link>
          <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h1>
        </div>

        <article className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
          {children}
        </article>
      </div>
    </main>
  );
}
