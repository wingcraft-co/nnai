"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import {
  clearLoginPending,
  hasPendingLogin,
  trackLoginSuccess,
} from "@/lib/analytics/events";
import { initAnalytics } from "@/lib/analytics/posthog";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";

type Props = {
  children: React.ReactNode;
};

export function PostHogProvider({ children }: Props) {
  const pathname = usePathname();
  const checkingRef = useRef(false);

  useEffect(() => {
    initAnalytics();
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
          | { logged_in?: boolean }
          | null;

        if (response.ok && payload?.logged_in) {
          trackLoginSuccess("google");
          clearLoginPending();
        }
      } finally {
        checkingRef.current = false;
      }
    })();
  }, [pathname]);

  return children;
}
