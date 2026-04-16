'use client';

import { useState } from 'react';

type PolarCheckoutButtonProps = {
  locale: string;
  directCheckoutUrl?: string;
  planCode?: string;
  returnPath?: string;
  idleLabel: string;
  loadingLabel: string;
  className?: string;
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

export function PolarCheckoutButton({
  locale,
  directCheckoutUrl,
  planCode = 'pro_monthly',
  returnPath,
  idleLabel,
  loadingLabel,
  className,
}: PolarCheckoutButtonProps) {
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
      const resolvedReturnPath = returnPath || `/${locale}/pricing?checkout=return`;
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_code: planCode,
          locale,
          return_path: resolvedReturnPath,
        }),
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
          locale === 'en'
            ? 'Checkout URL is missing from response.'
            : '응답에 checkout URL이 없습니다.'
        );
        return;
      }

      window.location.assign(redirectUrl);
    } catch {
      setError(
        locale === 'en'
          ? 'Network error while starting checkout.'
          : '결제 시작 중 네트워크 오류가 발생했습니다.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleCheckout}
        disabled={loading}
        className={className}
      >
        {loading ? loadingLabel : idleLabel}
      </button>

      {error && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
