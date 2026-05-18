import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { AnalyticsSettingsButton } from "@/components/analytics/AnalyticsSettingsButton";
import { getAnalyticsConsentCopy, getLegalLabels } from "@/lib/legal-content.mjs";
import { readPrivacyBodyHtml } from "@/lib/legal-docs";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  const labels = getLegalLabels(locale);
  const analyticsCopy = getAnalyticsConsentCopy(locale);
  const bodyHtml = await readPrivacyBodyHtml(locale);

  return (
    <LegalPageShell locale={locale} title={labels.legal.privacyTitle}>
      <div className="space-y-5">
        <section className="rounded-2xl border border-border bg-background/70 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Analytics
          </p>
          <h2 className="mt-2 text-lg font-semibold text-foreground">
            {analyticsCopy.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {analyticsCopy.description}
          </p>
          <AnalyticsSettingsButton
            label={labels.footer.privacySettings}
            className="mt-4 inline-flex rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          />
        </section>

        <div
          className="prose prose-slate max-w-none text-sm leading-7"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      </div>
    </LegalPageShell>
  );
}
