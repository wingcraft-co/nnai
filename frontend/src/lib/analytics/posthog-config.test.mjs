import test from "node:test";
import assert from "node:assert/strict";

import { buildAnalyticsModeConfig } from "./posthog-config.ts";

test("keeps disabled mode fully off", () => {
  assert.deepEqual(buildAnalyticsModeConfig("disabled"), {
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_performance: false,
    capture_dead_clicks: false,
    capture_exceptions: false,
    disable_session_recording: true,
    persistence: "memory",
  });
});

test("keeps essential mode limited to minimal tracking", () => {
  assert.deepEqual(buildAnalyticsModeConfig("essential"), {
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_performance: false,
    capture_dead_clicks: false,
    capture_exceptions: false,
    disable_session_recording: true,
    persistence: "memory",
  });
});

test("enables broad automatic analytics in full mode", () => {
  assert.deepEqual(buildAnalyticsModeConfig("full"), {
    autocapture: true,
    capture_pageview: "history_change",
    capture_pageleave: "if_capture_pageview",
    capture_performance: true,
    capture_dead_clicks: true,
    capture_exceptions: true,
    disable_session_recording: false,
    persistence: "localStorage+cookie",
  });
});
