import { PayCheckoutCard } from '@/components/pay/PayCheckoutCard';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function LocalizedPayPage({ params }: Props) {
  const { locale } = await params;
  const isEn = locale === 'en';
  const directCheckoutUrl =
    process.env.POLAR_CHECKOUT_URL || process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL;

  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground sm:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-[#4a5568]">NNAI Billing</p>
          <h2 className="mt-3 font-serif text-3xl font-bold text-[#f8fafc] sm:text-4xl">
            {isEn ? 'Complete Your Upgrade' : '업그레이드를 완료하세요'}
          </h2>
          <p className="mt-3 text-sm text-[#94a3b8]">
            {isEn
              ? 'Secure checkout for NNAI Pro is powered by Polar.'
              : 'NNAI Pro 결제는 Polar를 통해 안전하게 진행됩니다.'}
          </p>
        </div>

        <PayCheckoutCard locale={locale} directCheckoutUrl={directCheckoutUrl} />
      </div>
    </main>
  );
}
