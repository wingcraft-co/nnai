"use client";

import { captureAnalyticsEvent, sanitizePathname } from "@/lib/analytics/posthog";

export const LOGIN_PENDING_KEY = "nnai_posthog_login_pending";

export type Locale = "ko" | "en";
export type LandingCta = "quiz" | "form" | "preview";
export type EntryPoint = "quiz" | "direct";
export type ErrorStage = "recommend" | "reveal";
export type ErrorKind = "network" | "http" | "invalid_payload";
export type Provider = "google" | "polar";
export type PageKey =
  | "home"
  | "quiz"
  | "quiz_result"
  | "form"
  | "result"
  | "login"
  | "pricing";

const STEP_KEYS = [
  "purpose",
  "stay_plan",
  "budget_or_income",
  "companions",
  "preferences",
] as const;

export function getStepKey(stepNumber: number): string {
  return STEP_KEYS[stepNumber - 1] ?? `step_${stepNumber}`;
}

export function markLoginPending(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(LOGIN_PENDING_KEY, "1");
}

export function clearLoginPending(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(LOGIN_PENDING_KEY);
}

export function hasPendingLogin(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(LOGIN_PENDING_KEY) === "1";
}

export function normalizeLocale(locale?: string): Locale {
  return locale === "ko" ? "ko" : "en";
}

export function normalizeRoute(pathname: string): string {
  const clean = sanitizePathname(pathname);
  const withoutLocale = clean.replace(/^\/(ko|en)(?=\/|$)/, "");
  return withoutLocale || "/";
}

export function resolvePageKey(pathname: string): PageKey | null {
  switch (normalizeRoute(pathname)) {
    case "/":
      return "home";
    case "/onboarding/quiz":
      return "quiz";
    case "/onboarding/quiz/result":
      return "quiz_result";
    case "/onboarding/form":
      return "form";
    case "/result":
      return "result";
    case "/login":
      return "login";
    case "/pricing":
      return "pricing";
    default:
      return null;
  }
}

export function trackPageView({
  pathname,
  locale,
}: {
  pathname: string;
  locale: string;
}): void {
  const pageKey = resolvePageKey(pathname);
  if (!pageKey) return;

  captureAnalyticsEvent("page_view", {
    page_key: pageKey,
    pathname: sanitizePathname(pathname),
    locale: normalizeLocale(locale),
  });
}

export function trackLandingCtaClick(cta: LandingCta): void {
  captureAnalyticsEvent("landing_cta_click", { cta });
}

export function trackQuizStart(entryPage: "home"): void {
  captureAnalyticsEvent("quiz_start", { entry_page: entryPage });
}

export function trackQuizComplete(personaType: string): void {
  captureAnalyticsEvent("quiz_complete", { persona_type: personaType });
}

export function trackFormStepView(stepNumber: number): void {
  captureAnalyticsEvent("form_step_view", {
    step_number: stepNumber,
    step_key: getStepKey(stepNumber),
  });
}

export function trackFormStepComplete(stepNumber: number): void {
  captureAnalyticsEvent("form_step_complete", {
    step_number: stepNumber,
    step_key: getStepKey(stepNumber),
  });
}

export function trackRecommendSubmit({
  entry,
  hasPersona,
}: {
  entry: EntryPoint;
  hasPersona: boolean;
}): void {
  captureAnalyticsEvent("recommend_submit", {
    entry,
    has_persona: hasPersona,
  });
}

export function trackRecommendSuccess({
  cardCount,
  hasPersona,
}: {
  cardCount: number;
  hasPersona: boolean;
}): void {
  captureAnalyticsEvent("recommend_success", {
    card_count: cardCount,
    has_persona: hasPersona,
  });
}

export function trackRecommendFailure({
  stage,
  errorKind,
}: {
  stage: ErrorStage;
  errorKind: ErrorKind;
}): void {
  captureAnalyticsEvent("recommend_failure", {
    stage,
    error_kind: errorKind,
  });
}

export function trackResultRevealComplete(selectedCount: number): void {
  captureAnalyticsEvent("result_reveal_complete", {
    selected_count: selectedCount,
  });
}

export function trackGuideClick(cityId: string): void {
  captureAnalyticsEvent("guide_click", { city_id: cityId });
}

export function trackLoginView(locale: string): void {
  captureAnalyticsEvent("login_view", {
    locale: normalizeLocale(locale),
  });
}

export function trackLoginClick(provider: Provider): void {
  captureAnalyticsEvent("login_click", { provider });
}

export function trackLoginSuccess(provider: Provider): void {
  captureAnalyticsEvent("login_success", { provider });
}

export function trackPayView(locale: string): void {
  captureAnalyticsEvent("pay_view", {
    locale: normalizeLocale(locale),
  });
}

export function trackCheckoutClick(provider: Provider): void {
  captureAnalyticsEvent("checkout_click", { provider });
}

export function trackCheckoutSuccess(provider: Provider): void {
  captureAnalyticsEvent("checkout_success", { provider });
}
