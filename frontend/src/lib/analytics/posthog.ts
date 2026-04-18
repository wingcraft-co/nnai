"use client";

import posthog from "posthog-js";
import type { CaptureResult, PostHogConfig } from "posthog-js";

import {
  normalizePostHogDeploymentMode,
  readStoredAnalyticsConsent,
  resolveEffectiveAnalyticsMode,
  type AnalyticsConsent,
  type EffectiveAnalyticsMode,
  type PostHogDeploymentMode,
} from "@/lib/analytics/consent";
import { buildAnalyticsModeConfig } from "@/lib/analytics/posthog-config";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
const POSTHOG_UI_HOST = process.env.NEXT_PUBLIC_POSTHOG_UI_HOST ?? "https://eu.posthog.com";
const POSTHOG_ENABLED = process.env.NEXT_PUBLIC_POSTHOG_ENABLED === "1";
const POSTHOG_DEPLOYMENT_MODE = normalizePostHogDeploymentMode(
  process.env.NEXT_PUBLIC_POSTHOG_MODE,
);

let initialized = false;
let activeAnalyticsMode: EffectiveAnalyticsMode = "disabled";

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

export function getPostHogDeploymentMode(): PostHogDeploymentMode {
  return POSTHOG_DEPLOYMENT_MODE;
}

export function getActiveAnalyticsMode(): EffectiveAnalyticsMode {
  return activeAnalyticsMode;
}

export function isFullTrackingAvailable(): boolean {
  return POSTHOG_DEPLOYMENT_MODE === "full";
}

function buildBaseConfig(): Partial<PostHogConfig> {
  return {
    api_host: POSTHOG_HOST,
    ui_host: POSTHOG_UI_HOST,
    cookieless_mode: "on_reject" as const,
    ...buildAnalyticsModeConfig("disabled"),
    before_send: (event: CaptureResult | null) => {
      return sanitizeEvent(event as EventPayload | null) as CaptureResult | null;
    },
  };
}

export function initAnalytics(): void {
  if (initialized || !isAnalyticsEnabled() || typeof window === "undefined") {
    return;
  }

  posthog.init(POSTHOG_KEY, buildBaseConfig());

  initialized = true;
}

export function applyAnalyticsConsent(
  consent: AnalyticsConsent,
): EffectiveAnalyticsMode {
  if (!isAnalyticsEnabled()) {
    activeAnalyticsMode = "disabled";
    return activeAnalyticsMode;
  }

  initAnalytics();

  const nextMode = resolveEffectiveAnalyticsMode({
    consent,
    deploymentMode: POSTHOG_DEPLOYMENT_MODE,
  });

  if (nextMode === activeAnalyticsMode) {
    return nextMode;
  }

  if (nextMode === "disabled") {
    posthog.set_config(buildAnalyticsModeConfig("disabled"));
    posthog.stopSessionRecording();
    activeAnalyticsMode = nextMode;
    return nextMode;
  }

  if (nextMode === "essential") {
    posthog.set_config(buildAnalyticsModeConfig("essential"));
    posthog.stopSessionRecording();
    posthog.opt_out_capturing();
    activeAnalyticsMode = nextMode;
    return nextMode;
  }

  posthog.set_config(buildAnalyticsModeConfig("full"));
  posthog.opt_in_capturing({ captureEventName: false });
  posthog.startSessionRecording();
  activeAnalyticsMode = nextMode;
  return nextMode;
}

function ensureAnalyticsConsentApplied(): void {
  if (activeAnalyticsMode !== "disabled" || typeof window === "undefined") {
    return;
  }

  applyAnalyticsConsent(readStoredAnalyticsConsent());
}

export function captureAnalyticsEvent(event: string, properties?: AnalyticsProperties): void {
  if (!isAnalyticsEnabled()) return;
  initAnalytics();
  ensureAnalyticsConsentApplied();
  if (activeAnalyticsMode === "disabled") return;
  posthog.capture(event, sanitizeProperties(properties));
}

export function captureFullAnalyticsEvent(
  event: string,
  properties?: AnalyticsProperties,
): void {
  if (!isAnalyticsEnabled()) return;
  initAnalytics();
  ensureAnalyticsConsentApplied();
  if (activeAnalyticsMode !== "full") return;
  posthog.capture(event, sanitizeProperties(properties));
}

export { sanitizePathname, sanitizeProperties };
