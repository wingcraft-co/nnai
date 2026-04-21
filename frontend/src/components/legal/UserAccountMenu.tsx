"use client";

import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";

import { buildLogoutUrl, getLegalLabels } from "@/lib/legal-content.mjs";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";

type UserAccountMenuProps = {
  locale: string;
};

type AuthUser = {
  logged_in: boolean;
  name?: string | null;
  picture?: string | null;
};

export function UserAccountMenu({ locale }: UserAccountMenuProps) {
  const labels = getLegalLabels(locale).account;
  const [auth, setAuth] = useState<AuthUser | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchAuth() {
      try {
        const response = await fetch(`${API_BASE}/auth/me`, {
          credentials: "include",
        });
        const payload = await response.json();
        if (isMounted) setAuth(payload);
      } catch {
        if (isMounted) setAuth({ logged_in: false });
      }
    }

    void fetchAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!auth?.logged_in) {
    return null;
  }

  const displayName = auth.name || labels.fallbackName;
  const initial = displayName.trim().charAt(0).toUpperCase() || "N";

  function startLogout() {
    window.location.assign(buildLogoutUrl(API_BASE, window.location.href));
  }

  return (
    <div className="fixed right-16 top-4 z-50">
      <button
        type="button"
        aria-label={labels.menuLabel}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
        className="flex h-9 max-w-[180px] items-center gap-2 rounded-lg border border-[var(--onboarding-card-border)] bg-[var(--onboarding-card-bg)] px-2 pr-3 text-left font-serif text-xs text-[var(--onboarding-text-primary)] shadow-sm transition-colors hover:border-[var(--onboarding-card-border-active)]"
      >
        {auth.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={auth.picture}
            alt=""
            className="size-6 shrink-0 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--onboarding-accent)] text-[11px] font-semibold text-white">
            {initial}
          </span>
        )}
        <span className="min-w-0 truncate">{displayName}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-36 rounded-lg border border-[var(--onboarding-card-border)] bg-[var(--onboarding-card-bg)] p-1 shadow-lg">
          <button
            type="button"
            onClick={startLogout}
            className="flex h-8 w-full items-center gap-2 rounded-md px-2 font-serif text-xs text-[var(--onboarding-text-primary)] transition-colors hover:bg-white/10"
          >
            <LogOut className="size-3.5" aria-hidden="true" />
            <span>{labels.logout}</span>
          </button>
        </div>
      )}
    </div>
  );
}
