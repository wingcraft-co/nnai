"use client";

import posthog from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
const POSTHOG_UI_HOST = process.env.NEXT_PUBLIC_POSTHOG_UI_HOST ?? "https://eu.posthog.com";
const POSTHOG_ENABLED = process.env.NEXT_PUBLIC_POSTHOG_ENABLED === "1";

let initialized = false;

type AnalyticsPrimitive = string | number | boolean | null | undefined;
export type AnalyticsProperties = Record<string, AnalyticsPrimitive>;

type EventPayload = {
  event: string;
  uuid?: string;
  properties?: Record<string, unknown>;
};

function sanitizePathname(pathname: string): string {
  const withoutOrigin = pathname.replace(/^https?:\/\/[^/]+/i, "");
  const [pathOnly] = withoutOrigin.split(/[?#]/, 1);
  return pathOnly || "/";
}

function sanitizeProperties(properties: AnalyticsProperties = {}): AnalyticsProperties {
  const sanitized: AnalyticsProperties = {};

  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined) continue;
    if (typeof value === "string") {
      sanitized[key] = key === "pathname" ? sanitizePathname(value) : value;
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean" || value === null) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function sanitizeEvent(event: EventPayload | null): EventPayload | null {
  if (!event) return event;
  return {
    ...event,
    properties: sanitizeProperties((event.properties ?? {}) as AnalyticsProperties),
  };
}

export function isAnalyticsEnabled(): boolean {
  return POSTHOG_ENABLED && POSTHOG_KEY.length > 0;
}

export function initAnalytics(): void {
  if (initialized || !isAnalyticsEnabled() || typeof window === "undefined") {
    return;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    ui_host: POSTHOG_UI_HOST,
    cookieless_mode: "always",
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: true,
    persistence: "memory",
    person_profiles: "identified_only",
    before_send: (event) => {
      return sanitizeEvent(event as EventPayload | null) as typeof event;
    },
  });

  initialized = true;
}

export function captureAnalyticsEvent(event: string, properties?: AnalyticsProperties): void {
  if (!isAnalyticsEnabled()) return;
  initAnalytics();
  posthog.capture(event, sanitizeProperties(properties));
}

export { sanitizePathname, sanitizeProperties };
