import Link from 'next/link';
import { headers } from 'next/headers';
import { BillingReturnNotice } from '@/components/pay/BillingReturnNotice';
import { PolarCheckoutButton } from '@/components/pay/PolarCheckoutButton';
import { getPricingContent, resolvePricingLocale } from '@/lib/pricing-content.mjs';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function LocalizedPricingPage({ params }: Props) {
  const { locale: routeLocale } = await params;
  const requestHeaders = await headers();
  const locale = resolvePricingLocale({
    routeLocale,
    acceptLanguage: requestHeaders.get('accept-language') ?? undefined,
  });
  const content = getPricingContent(locale);
  const directCheckoutUrl =
    process.env.POLAR_CHECKOUT_URL || process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col px-4 py-10">
      <BillingReturnNotice locale={content.locale} />

      <div className="mb-6">
        <img src="/earth_web.gif" alt="" width={96} height={96} className="mx-auto" />
      </div>

      <section className="text-center">
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground/70">
          {content.hero.eyebrow}
        </p>
        <h1 className="mt-3 text-2xl font-bold leading-snug text-foreground sm:text-3xl">
          {content.hero.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
          {content.hero.description}
        </p>
      </section>

      <section className="mt-8 space-y-4">
        {content.plans.map((plan) => {
          const isPro = plan.id === 'pro';

          return (
            <article
              key={plan.id}
              className={[
                'flex flex-col border p-5',
                isPro ? 'border-primary bg-accent/30' : 'border-border bg-background',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    {plan.badge}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-foreground">{plan.name}</h2>
                </div>
                {isPro && (
                  <span className="border border-primary px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-primary">
                    Polar
                  </span>
                )}
              </div>

              <div className="mt-5 flex items-end gap-1">
                <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                <span className="pb-0.5 text-xs text-muted-foreground">{plan.period}</span>
              </div>

              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {plan.description}
              </p>

              <div className="mt-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  {content.locale === 'ko' ? '포함 기능' : 'Included'}
                </p>
                <ul className="mt-3 space-y-2 text-sm text-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  {content.locale === 'ko' ? '제한 또는 차이점' : 'Limits or gaps'}
                </p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {plan.premiumGaps.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-border" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 pt-1">
                {plan.cta.kind === 'checkout' ? (
                  <PolarCheckoutButton
                    locale={content.locale}
                    directCheckoutUrl={directCheckoutUrl}
                    idleLabel={plan.cta.label}
                    loadingLabel={
                      content.locale === 'en'
                        ? 'Opening Polar checkout...'
                        : 'Polar 결제 페이지 여는 중...'
                    }
                    className="block w-full bg-primary py-3.5 text-center text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                ) : (
                  <Link
                    href={`/${content.locale}${plan.cta.href}`}
                    className="block w-full border border-border py-3.5 text-center text-sm font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    {plan.cta.label}
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <section className="mt-8 border border-border p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Pro Expansion
          </p>
        <h2 className="mt-2 text-lg font-semibold text-foreground">{content.payg.title}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {content.payg.description}
          </p>
        <ul className="mt-4 space-y-2 text-sm text-foreground">
            {content.payg.bullets.map((bullet) => (
              <li key={bullet} className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </section>

      <section className="mt-4 border border-border p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            FAQ
          </p>
          <h2 className="mt-2 text-lg font-semibold text-foreground">{content.faq.title}</h2>
          <div className="mt-4 space-y-4">
            {content.faq.items.map((item) => (
              <div key={item.question} className="border-t border-border pt-4 first:border-t-0 first:pt-0">
                <h3 className="text-sm font-medium text-foreground">{item.question}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>
    </main>
  );
}
