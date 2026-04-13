'use client';

import { useState } from 'react';

type PayCheckoutCardProps = {
  locale: string;
  directCheckoutUrl?: string;
};

function pickErrorMessage(payload: unknown, locale: string): string {
  const fallback = locale === 'en'
    ? 'Could not start checkout. Please try again.'
    : '결제를 시작하지 못했습니다. 잠시 후 다시 시도해주세요.';

  if (!payload || typeof payload !== 'object') return fallback;

  const record = payload as Record<string, unknown>;
  for (const key of ['detail', 'error', 'message']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return fallback;
}

export function PayCheckoutCard({ locale, directCheckoutUrl }: PayCheckoutCardProps) {
  const isEn = locale === 'en';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    if (loading) return;
    setError(null);

    if (directCheckoutUrl) {
      window.location.assign(directCheckoutUrl);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        checkout_url?: string;
        url?: string;
      };

      if (!response.ok) {
        setError(pickErrorMessage(payload, locale));
        return;
      }

      const redirectUrl = payload.checkout_url || payload.url;
      if (!redirectUrl) {
        setError(
          isEn
            ? 'Checkout URL is missing from response.'
            : '응답에 checkout URL이 없습니다.'
        );
        return;
      }

      window.location.assign(redirectUrl);
    } catch {
      setError(
        isEn
          ? 'Network error while starting checkout.'
          : '결제 시작 중 네트워크 오류가 발생했습니다.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="w-full max-w-xl rounded-2xl border border-[#1e2330] bg-[#08090e] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)] sm:p-8">
      <p className="text-xs uppercase tracking-[0.2em] text-[#4a5568]">Polar Checkout</p>
      <h1 className="mt-3 font-serif text-2xl font-bold text-[#f8fafc] sm:text-3xl">
        {isEn ? 'Unlock Pro Guidance' : 'Pro 가이드를 열어보세요'}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[#9ca3af]">
        {isEn
          ? 'Complete payment to unlock full migration guidance, detailed execution steps, and expanded planning tools.'
          : '결제를 완료하면 전체 이민 가이드, 더 자세한 실행 단계, 확장 플래닝 도구를 이용할 수 있습니다.'}
      </p>

      <div className="mt-6 grid gap-3 rounded-xl border border-[#1e2330] bg-[#0d1018] p-4 text-xs text-[#cbd5e1]">
        <div className="flex items-start justify-between gap-3">
          <span>{isEn ? 'Plan' : '플랜'}</span>
          <span className="font-mono text-amber-300">{isEn ? 'NNAI Pro' : 'NNAI Pro 월간'}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span>{isEn ? 'Billing' : '결제'}</span>
          <span className="font-mono text-amber-300">{isEn ? 'Handled by Polar' : 'Polar 결제 연동'}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span>{isEn ? 'Support' : '문의'}</span>
          <span className="font-mono text-[#94a3b8]">nnai.support@gmail.com</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleCheckout}
        disabled={loading}
        className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-amber-400 px-4 py-3 font-mono text-sm font-semibold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? (isEn ? 'Starting checkout...' : '결제 페이지 여는 중...')
          : (isEn ? 'Pay With Polar' : 'Polar로 결제하기')}
      </button>

      {error && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {!directCheckoutUrl && (
        <p className="mt-4 text-[11px] leading-relaxed text-[#64748b]">
          {isEn
            ? 'This page calls /api/billing/checkout and expects checkout_url in response.'
            : '이 페이지는 /api/billing/checkout 호출 후 응답의 checkout_url로 이동합니다.'}
        </p>
      )}
    </section>
  );
}
