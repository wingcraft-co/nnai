export const ANALYTICS_CONSENT_KEY = "nnai_analytics_consent";
export const OPEN_ANALYTICS_SETTINGS_EVENT = "nnai:open-analytics-settings";

export type AnalyticsConsent = "unknown" | "essential" | "full";
export type PostHogDeploymentMode = "minimal" | "full";
export type EffectiveAnalyticsMode = "disabled" | "essential" | "full";

export function normalizeAnalyticsConsent(value: unknown): AnalyticsConsent {
  if (value === "essential" || value === "full" || value === "unknown") {
    return value;
  }
  return "unknown";
}

export function normalizePostHogDeploymentMode(
  value: unknown,
): PostHogDeploymentMode {
  return value === "full" ? "full" : "minimal";
}

export function resolveEffectiveAnalyticsMode({
  consent,
  deploymentMode,
}: {
  consent: AnalyticsConsent;
  deploymentMode: PostHogDeploymentMode;
}): EffectiveAnalyticsMode {
  if (consent === "unknown") return "disabled";
  if (consent === "essential") return "essential";
  return deploymentMode === "full" ? "full" : "essential";
}

export function shouldPostHogCaptureBeEnabled(
  mode: EffectiveAnalyticsMode,
): boolean {
  return mode !== "disabled";
}

export function readStoredAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === "undefined") return "unknown";
  return normalizeAnalyticsConsent(
    window.localStorage.getItem(ANALYTICS_CONSENT_KEY),
  );
}

export function persistAnalyticsConsent(consent: AnalyticsConsent): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ANALYTICS_CONSENT_KEY, consent);
}

export function openAnalyticsSettings(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_ANALYTICS_SETTINGS_EVENT));
}
