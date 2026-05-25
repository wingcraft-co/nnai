"use client";

import { Archive, LogOut, RotateCcw } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { markLoginPending, trackLoginClick } from "@/lib/analytics/events";
import { resolveAccountMenuDisplay } from "@/lib/account-menu.mjs";
import { applyLibraryAuthScope } from "@/lib/library-storage";
import { clearOnboardingQuizDraft } from "@/lib/onboarding-quiz-draft";
import { syncOnboardingDraftsAfterLogin } from "@/lib/onboarding-draft-sync.mjs";
import { ONBOARDING_DRAFT_UPDATED_EVENT } from "@/lib/onboarding-form-draft";
import {
  buildGoogleLoginUrl,
  buildLogoutUrl,
  getLegalLabels,
  shouldUseDarkLegalChrome,
} from "@/lib/legal-content.mjs";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";

type UserAccountMenuProps = {
  locale: string;
  hasLocaleSwitcher?: boolean;
};

type AuthUser = {
  logged_in: boolean;
  name?: string | null;
  picture?: string | null;
  uid?: string | null;
};

export function UserAccountMenu({ locale, hasLocaleSwitcher = false }: UserAccountMenuProps) {
  const pathname = usePathname();
  const labels = getLegalLabels(locale).account;
  const [auth, setAuth] = useState<AuthUser | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const isDarkChrome = shouldUseDarkLegalChrome(pathname);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncOnboardingDrafts = useCallback(() => {
    void syncOnboardingDraftsAfterLogin({
      apiBase: API_BASE,
      storage: localStorage,
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function fetchAuth() {
      try {
        const response = await fetch(`${API_BASE}/auth/me`, {
          credentials: "include",
        });
        const payload = await response.json();
        applyLibraryAuthScope(payload);
        if (isMounted) setAuth(payload);
        if (payload?.logged_in) syncOnboardingDrafts();
      } catch {
        applyLibraryAuthScope(null);
        if (isMounted) setAuth({ logged_in: false });
      }
    }

    void fetchAuth();

    return () => {
      isMounted = false;
    };
  }, [syncOnboardingDrafts]);

  useEffect(() => {
    if (!auth?.logged_in) return;

    function handleDraftUpdated() {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
      syncTimerRef.current = setTimeout(syncOnboardingDrafts, 250);
    }

    window.addEventListener(ONBOARDING_DRAFT_UPDATED_EVENT, handleDraftUpdated);
    return () => {
      window.removeEventListener(ONBOARDING_DRAFT_UPDATED_EVENT, handleDraftUpdated);
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
    };
  }, [auth?.logged_in, syncOnboardingDrafts]);

  useEffect(() => {
    setCurrentUrl(window.location.href);
  }, []);

  const display = resolveAccountMenuDisplay(auth, labels);
  const displayName = display.displayName;
  const initial = displayName.trim().charAt(0).toUpperCase() || "N";
  const loginHref = buildGoogleLoginUrl(API_BASE, currentUrl ?? undefined);

  function trackLoginIntent() {
    try {
      markLoginPending();
    } catch {
      // Keep OAuth navigation working even if session storage is unavailable.
    }
    try {
      trackLoginClick("google");
    } catch {
      // Analytics should never block login.
    }
  }

  function startLogout() {
    applyLibraryAuthScope(null);
    try {
      localStorage.removeItem("persona_type");
      localStorage.removeItem("persona_vector");
    } catch {
      // best-effort cleanup
    }
    window.location.assign(buildLogoutUrl(API_BASE, window.location.href));
  }

  function openLibrary() {
    window.location.assign(`/${locale}/library`);
  }

  function retakePersonaQuiz() {
    try {
      localStorage.removeItem("persona_type");
      localStorage.removeItem("persona_vector");
      clearOnboardingQuizDraft(localStorage);
    } catch {
      // Reset is best-effort; navigation still lets the quiz recover.
    }
    window.location.assign(`/${locale}/onboarding/quiz`);
  }

  const positionClass = hasLocaleSwitcher ? "right-20" : "right-4";
  const triggerTextClass = isDarkChrome
    ? "text-white/70 hover:text-white/85"
    : "text-[var(--onboarding-text-primary)] hover:text-muted-foreground";

  if (!display.isLoggedIn) {
    return (
      <a
        href={loginHref}
        onClick={trackLoginIntent}
        className={`fixed ${positionClass} top-4 z-50 h-9 cursor-pointer bg-transparent px-2 font-serif text-xs transition-colors hover:bg-transparent ${triggerTextClass}`}
      >
        {displayName}
      </a>
    );
  }

  return (
    <div className={`fixed ${positionClass} top-4 z-50`}>
      <button
        type="button"
        aria-label={labels.menuLabel}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
        className={`flex h-9 max-w-[180px] cursor-pointer items-center gap-2 rounded-md bg-transparent px-2 pr-3 text-left font-serif text-xs transition-colors hover:bg-transparent ${triggerTextClass}`}
      >
        {display.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={display.picture}
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
        <div className="absolute right-0 mt-2 w-40 rounded-md bg-white p-1 shadow-lg">
          <button
            type="button"
            onClick={retakePersonaQuiz}
            className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 font-serif text-xs text-[var(--onboarding-text-primary)] transition-colors hover:bg-black/5"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            <span>{locale === "ko" ? "유형 다시 찾기" : "Retake type quiz"}</span>
          </button>
          <button
            type="button"
            onClick={openLibrary}
            className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 font-serif text-xs text-[var(--onboarding-text-primary)] transition-colors hover:bg-black/5"
          >
            <Archive className="size-3.5" aria-hidden="true" />
            <span>{labels.library}</span>
          </button>
          <button
            type="button"
            onClick={startLogout}
            className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 font-serif text-xs text-[var(--onboarding-text-primary)] transition-colors hover:bg-black/5"
          >
            {display.isLoggedIn && <LogOut className="size-3.5" aria-hidden="true" />}
            <span>{display.isLoggedIn ? labels.logout : labels.login}</span>
          </button>
        </div>
      )}
    </div>
  );
}
