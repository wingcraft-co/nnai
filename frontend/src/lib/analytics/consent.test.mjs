import test from "node:test";
import assert from "node:assert/strict";

import {
  ANALYTICS_CONSENT_KEY,
  normalizeAnalyticsConsent,
  normalizePostHogDeploymentMode,
  resolveEffectiveAnalyticsMode,
} from "./consent.ts";

test("keeps the analytics consent storage key stable", () => {
  assert.equal(ANALYTICS_CONSENT_KEY, "nnai_analytics_consent");
});

test("normalizes stored consent values", () => {
  assert.equal(normalizeAnalyticsConsent("unknown"), "unknown");
  assert.equal(normalizeAnalyticsConsent("essential"), "essential");
  assert.equal(normalizeAnalyticsConsent("full"), "full");
  assert.equal(normalizeAnalyticsConsent("bogus"), "unknown");
  assert.equal(normalizeAnalyticsConsent(null), "unknown");
});

test("normalizes deployment mode values", () => {
  assert.equal(normalizePostHogDeploymentMode("minimal"), "minimal");
  assert.equal(normalizePostHogDeploymentMode("full"), "full");
  assert.equal(normalizePostHogDeploymentMode("bogus"), "minimal");
  assert.equal(normalizePostHogDeploymentMode(undefined), "minimal");
});

test("blocks analytics before consent is chosen", () => {
  assert.equal(
    resolveEffectiveAnalyticsMode({
      consent: "unknown",
      deploymentMode: "full",
    }),
    "disabled",
  );
});

test("keeps essential consent in cookieless mode regardless of deployment", () => {
  assert.equal(
    resolveEffectiveAnalyticsMode({
      consent: "essential",
      deploymentMode: "minimal",
    }),
    "essential",
  );
  assert.equal(
    resolveEffectiveAnalyticsMode({
      consent: "essential",
      deploymentMode: "full",
    }),
    "essential",
  );
});

test("only enables full tracking when both consent and deployment allow it", () => {
  assert.equal(
    resolveEffectiveAnalyticsMode({
      consent: "full",
      deploymentMode: "minimal",
    }),
    "essential",
  );
  assert.equal(
    resolveEffectiveAnalyticsMode({
      consent: "full",
      deploymentMode: "full",
    }),
    "full",
  );
});
