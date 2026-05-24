"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { AnalyticsConsentBanner } from "@/components/analytics/AnalyticsConsentBanner";
import {
  clearLoginPending,
  hasPendingLogin,
  identifyUser,
  trackLoginSuccess,
} from "@/lib/analytics/events";
import {
  OPEN_ANALYTICS_SETTINGS_EVENT,
  persistAnalyticsConsent,
  readStoredAnalyticsConsent,
  type AnalyticsConsent,
} from "@/lib/analytics/consent";
import {
  applyAnalyticsConsent,
  getActiveAnalyticsMode,
  initAnalytics,
  isFullTrackingAvailable,
} from "@/lib/analytics/posthog";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";

type Props = {
  children: React.ReactNode;
  privacyBodyHtmlByLocale: Record<"ko" | "en", string>;
};

export function PostHogProvider({ children, privacyBodyHtmlByLocale }: Props) {
  const pathname = usePathname();
  const checkingRef = useRef(false);
  const [consent, setConsent] = useState<AnalyticsConsent>("unknown");
  const [bannerOpen, setBannerOpen] = useState(false);

  const locale = useMemo<"ko" | "en">(() => {
    const match = pathname?.match(/^\/(ko|en)(?=\/|$)/);
    return match?.[1] === "en" ? "en" : "ko";
  }, [pathname]);

  useEffect(() => {
    initAnalytics();
    const storedConsent = readStoredAnalyticsConsent();
    setConsent(storedConsent);
    setBannerOpen(storedConsent === "unknown");
    applyAnalyticsConsent(storedConsent);
  }, []);

  useEffect(() => {
    if (!hasPendingLogin() || checkingRef.current) return;

    checkingRef.current = true;
    void (async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/me`, {
          credentials: "include",
        });
        const payload = (await response.json().catch(() => null)) as
          | { logged_in?: boolean; uid?: string; entitlement?: { plan_tier?: string } }
          | null;

        if (response.ok && payload?.logged_in) {
          if (payload.uid) {
            identifyUser(payload.uid, payload.entitlement?.plan_tier ?? "free");
          }
          trackLoginSuccess("google");
          clearLoginPending();
        }
      } finally {
        checkingRef.current = false;
      }
    })();
  }, [pathname]);

  useEffect(() => {
    function handleOpenSettings() {
      setBannerOpen(true);
    }

    window.addEventListener(OPEN_ANALYTICS_SETTINGS_EVENT, handleOpenSettings);
    return () => {
      window.removeEventListener(OPEN_ANALYTICS_SETTINGS_EVENT, handleOpenSettings);
    };
  }, []);

  function handleConsentSelect(nextConsent: Exclude<AnalyticsConsent, "unknown">) {
    persistAnalyticsConsent(nextConsent);
    setConsent(nextConsent);
    applyAnalyticsConsent(nextConsent);
    setBannerOpen(false);
  }

  return (
    <>
      {children}
      {bannerOpen && (
        <AnalyticsConsentBanner
          consent={consent}
          effectiveMode={getActiveAnalyticsMode()}
          fullTrackingAvailable={isFullTrackingAvailable()}
          locale={locale}
          privacyBodyHtml={privacyBodyHtmlByLocale[locale]}
          onSelect={handleConsentSelect}
          onClose={consent === "unknown" ? undefined : () => setBannerOpen(false)}
        />
      )}
    </>
  );
}
