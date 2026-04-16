'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import {
  resolveBillingReturnNotice,
  shouldHandleBillingReturn,
  stripCheckoutReturnParam,
} from '@/lib/billing-return.mjs';

type BillingReturnNoticeProps = {
  locale: string;
};

type Notice = {
  tone: 'success' | 'pending' | 'error';
  title: string;
  body: string;
};

const toneClasses: Record<Notice['tone'], string> = {
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
  error: 'border-red-500/30 bg-red-500/10 text-red-200',
};

export function BillingReturnNotice({ locale }: BillingReturnNoticeProps) {
  const searchParams = useSearchParams();
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!shouldHandleBillingReturn(searchParams)) {
      setNotice(null);
      return;
    }

    let cancelled = false;
    setNotice(
      resolveBillingReturnNotice({
        locale,
        restored: false,
        entitlement: { plan_tier: 'free', status: 'active' },
        error: false,
      }) as Notice
    );

    void (async () => {
      try {
        const response = await fetch('/api/billing/restore', {
          method: 'POST',
          cache: 'no-store',
        });
        const payload = (await response.json().catch(() => ({}))) as {
          restored?: boolean;
          entitlement?: { plan_tier?: string; status?: string };
        };
        if (cancelled) return;

        setNotice(
          resolveBillingReturnNotice({
            locale,
            restored: payload.restored === true,
            entitlement: payload.entitlement,
            error: !response.ok,
          }) as Notice
        );
      } catch {
        if (cancelled) return;
        setNotice(
          resolveBillingReturnNotice({
            locale,
            restored: false,
            entitlement: { plan_tier: 'free', status: 'active' },
            error: true,
          }) as Notice
        );
      } finally {
        if (!cancelled) {
          window.history.replaceState(window.history.state, '', stripCheckoutReturnParam(window.location.href));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [locale, searchParams]);

  if (!notice) return null;

  return (
    <section className={`mb-6 border px-4 py-3 ${toneClasses[notice.tone]}`}>
      <p className="text-[11px] uppercase tracking-[0.18em] opacity-80">
        {locale === 'en' ? 'Billing Status' : '결제 상태'}
      </p>
      <h2 className="mt-2 text-sm font-semibold">{notice.title}</h2>
      <p className="mt-2 text-sm leading-6 opacity-90">{notice.body}</p>
    </section>
  );
}
