import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { getLegalLabels } from "@/lib/legal-content.mjs";
import { readPrivacyBodyHtml } from "@/lib/legal-docs";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  const labels = getLegalLabels(locale);
  const bodyHtml = await readPrivacyBodyHtml();

  return (
    <LegalPageShell locale={locale} title={labels.legal.privacyTitle}>
      <div
        className="prose prose-slate max-w-none text-sm leading-7"
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />
    </LegalPageShell>
  );
}
