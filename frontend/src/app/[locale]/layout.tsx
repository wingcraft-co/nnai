import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { PageViewTracker } from "@/components/analytics/PageViewTracker";
import { routing } from "@/i18n/routing";
import { LocaleSwitcher } from "@/components/onboarding/locale-switcher";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { UserAccountMenu } from "@/components/legal/UserAccountMenu";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = (await import(`../../../messages/${locale}.json`)).default;

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="flex min-h-screen flex-col">
        <PageViewTracker locale={locale} />
        <UserAccountMenu locale={locale} />
        <LocaleSwitcher />
        <div className="flex-1">
          {children}
        </div>
        <LegalFooter locale={locale} />
      </div>
    </NextIntlClientProvider>
  );
}
