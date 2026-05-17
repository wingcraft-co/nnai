import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { PageViewTracker } from "@/components/analytics/PageViewTracker";
import { routing } from "@/i18n/routing";
import { LocaleSwitcher } from "@/components/onboarding/locale-switcher";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { UserAccountMenu } from "@/components/legal/UserAccountMenu";
import { readPrivacyBodyHtml, readTermsBlocks } from "@/lib/legal-docs";
import { isDebugMode } from "@/lib/runtime-locale.mjs";

const IS_DEBUG = isDebugMode(process.env.NEXT_PUBLIC_DEBUG_MODE);

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const [messages, termsBlocks, privacyBodyHtml] = await Promise.all([
    import(`../../../messages/${locale}.json`).then((module) => module.default),
    readTermsBlocks(),
    readPrivacyBodyHtml(),
  ]);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="flex min-h-screen flex-col">
        <PageViewTracker locale={locale} />
        <UserAccountMenu locale={locale} hasLocaleSwitcher={IS_DEBUG} />
        {IS_DEBUG && <LocaleSwitcher />}
        <div className="flex flex-1">
          {children}
        </div>
        <LegalFooter
          locale={locale}
          termsBlocks={termsBlocks}
          privacyBodyHtml={privacyBodyHtml}
        />
      </div>
    </NextIntlClientProvider>
  );
}
