"use client";

import { useEffect, useState } from "react";

import {
  buildGoogleLoginUrl,
  buildLogoutUrl,
  getLegalLabels,
} from "@/lib/legal-content.mjs";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";

type GoogleLoginPanelProps = {
  locale: string;
};

type AuthUser = {
  logged_in: boolean;
  name?: string;
  picture?: string;
};

export function GoogleLoginPanel({ locale }: GoogleLoginPanelProps) {
  const labels = getLegalLabels(locale);
  const [auth, setAuth] = useState<AuthUser | null>(null);

  useEffect(() => {
    async function fetchAuth() {
      try {
        const response = await fetch(`${API_BASE}/auth/me`, {
          credentials: "include",
        });
        const payload = await response.json();
        setAuth(payload);
      } catch {
        setAuth({ logged_in: false });
      }
    }

    void fetchAuth();
  }, []);

  function startLogin() {
    window.location.assign(buildGoogleLoginUrl(API_BASE, window.location.href));
  }

  function startLogout() {
    window.location.assign(buildLogoutUrl(API_BASE, window.location.href));
  }

  return (
    <section className="w-full max-w-xl rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {labels.login.eyebrow}
      </p>
      <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-foreground">
        {labels.login.title}
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {labels.login.description}
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-background/60 p-4">
        {auth === null ? (
          <p className="text-sm text-muted-foreground">{labels.login.loading}</p>
        ) : auth.logged_in ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">{labels.login.loggedIn}</p>
            <p className="text-sm text-muted-foreground">{auth.name ?? "NNAI user"}</p>
            <button
              type="button"
              onClick={startLogout}
              className="inline-flex rounded-xl border border-border px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              {labels.login.logout}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">{labels.login.loggedOut}</p>
            <button
              type="button"
              onClick={startLogin}
              className="inline-flex rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {labels.login.login}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
