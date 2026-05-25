'use client';

import { useState } from 'react';
import type { PaymentRequest, PaymentResponse } from '@portone/browser-sdk/v2';
import {
  trackCheckoutClick,
  trackCheckoutSuccess,
  trackPricingSectionEngagement,
} from '@/lib/analytics/events';

type PolarCheckoutButtonProps = {
  locale: string;
  directCheckoutUrl?: string;
  planCode?: string;
  cityId?: string;
  returnPath?: string;
  idleLabel: string;
  loadingLabel: string;
  className?: string;
};

type CheckoutResponse = {
  checkout_url?: string;
  url?: string;
  provider?: string;
  payment_id?: string;
  client_payload?: Record<string, unknown>;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

function billingEndpoint(path: string): string {
  return API_BASE ? `${API_BASE}${path}` : path;
}

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

function pickPortOneErrorMessage(response: PaymentResponse | undefined, locale: string): string {
  const fallback = locale === 'en'
    ? 'Payment was not completed. Please try again.'
    : '결제가 완료되지 않았습니다. 다시 시도해주세요.';
  if (!response) return fallback;
  return response.message || response.pgMessage || fallback;
}

export function PolarCheckoutButton({
  locale,
  directCheckoutUrl,
  planCode = 'city_report',
  cityId,
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
    trackPricingSectionEngagement({ section: 'pro_plan', action: 'click' });

    function openCheckout(url: string) {
      const win = window.open(url, '_blank');
      if (win) {
        win.opener = null;
      } else {
        // 팝업 차단 시 fallback: 현재 탭 이동
        window.location.assign(url);
      }
    }

    if (directCheckoutUrl) {
      trackCheckoutClick('polar');
      openCheckout(directCheckoutUrl);
      return;
    }

    setLoading(true);
    try {
      const resolvedReturnPath = returnPath || `/${locale}/pricing?checkout=return`;
      const response = await fetch(billingEndpoint('/api/billing/checkout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          city_id: cityId,
          plan_code: planCode,
          locale,
          return_path: resolvedReturnPath,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as CheckoutResponse;

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

      if (payload.provider === 'portone') {
        const paymentRequest = payload.client_payload as PaymentRequest | undefined;
        if (!paymentRequest) {
          setError(
            locale === 'en'
              ? 'PortOne payment payload is missing.'
              : '포트원 결제 요청 정보가 없습니다.'
          );
          return;
        }

        trackCheckoutClick('portone');
        const PortOne = await import('@portone/browser-sdk/v2');
        const paymentResponse = await PortOne.requestPayment(paymentRequest);
        if (!paymentResponse || paymentResponse.code) {
          setError(pickPortOneErrorMessage(paymentResponse, locale));
          return;
        }

        const paymentId =
          paymentResponse.paymentId ||
          payload.payment_id ||
          (typeof payload.client_payload?.paymentId === 'string' ? payload.client_payload.paymentId : '');
        if (!paymentId) {
          setError(
            locale === 'en'
              ? 'PortOne payment ID is missing.'
              : '포트원 결제 ID가 없습니다.'
          );
          return;
        }

        const completeResponse = await fetch(billingEndpoint('/api/billing/complete'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ payment_id: paymentId }),
        });
        const completePayload = await completeResponse.json().catch(() => ({}));
        if (!completeResponse.ok) {
          setError(pickErrorMessage(completePayload, locale));
          return;
        }

        trackCheckoutSuccess('portone');
        const completedUrl = new URL(redirectUrl, window.location.origin);
        completedUrl.searchParams.set('checkout', 'complete');
        completedUrl.searchParams.set('paymentId', paymentId);
        window.location.assign(completedUrl.toString());
        return;
      }

      trackCheckoutClick('polar');
      openCheckout(redirectUrl);
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
