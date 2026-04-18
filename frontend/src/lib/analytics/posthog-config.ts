import type { EffectiveAnalyticsMode } from "@/lib/analytics/consent";

export type AnalyticsModeConfig = {
  autocapture: boolean;
  capture_pageview: false | "history_change";
  capture_pageleave: false | "if_capture_pageview";
  capture_performance: boolean;
  capture_dead_clicks: boolean;
  capture_exceptions: boolean;
  disable_session_recording: boolean;
  persistence: "memory" | "localStorage+cookie";
};

export function buildAnalyticsModeConfig(
  mode: EffectiveAnalyticsMode,
): AnalyticsModeConfig {
  if (mode === "full") {
    return {
      autocapture: true,
      capture_pageview: "history_change",
      capture_pageleave: "if_capture_pageview",
      capture_performance: true,
      capture_dead_clicks: true,
      capture_exceptions: true,
      disable_session_recording: false,
      persistence: "localStorage+cookie",
    };
  }

  return {
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_performance: false,
    capture_dead_clicks: false,
    capture_exceptions: false,
    disable_session_recording: true,
    persistence: "memory",
  };
}
