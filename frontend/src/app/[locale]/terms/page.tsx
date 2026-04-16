import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { getLegalLabels } from "@/lib/legal-content.mjs";
import { readTermsBlocks } from "@/lib/legal-docs";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  const labels = getLegalLabels(locale);
  const blocks = await readTermsBlocks();

  return (
    <LegalPageShell locale={locale} title={labels.legal.termsTitle}>
      <div className="space-y-5 text-sm leading-7 text-foreground/90">
        {blocks.map((block, index) => {
          if (block.type === "h1") {
            return (
              <h2 key={index} className="font-serif text-2xl font-semibold text-foreground">
                {block.text}
              </h2>
            );
          }

          if (block.type === "h2") {
            return (
              <h3 key={index} className="pt-2 font-semibold text-foreground">
                {block.text}
              </h3>
            );
          }

          if (block.type === "h3") {
            return (
              <h4 key={index} className="font-medium text-foreground">
                {block.text}
              </h4>
            );
          }

          if (block.type === "ul") {
            const items = Array.isArray(block.items) ? block.items : [];
            return (
              <ul key={index} className="space-y-2 pl-5 text-muted-foreground">
                {items.map((item) => (
                  <li key={item} className="list-disc">
                    {item}
                  </li>
                ))}
              </ul>
            );
          }

          return (
            <p key={index} className="text-muted-foreground">
              {block.text}
            </p>
          );
        })}
      </div>
    </LegalPageShell>
  );
}
