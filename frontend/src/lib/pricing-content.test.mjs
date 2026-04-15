import test from "node:test";
import assert from "node:assert/strict";

import { getPricingContent, resolvePricingLocale } from "./pricing-content.mjs";

test("returns Korean pricing content with free and pro plans", () => {
  const content = getPricingContent("ko");

  assert.equal(content.locale, "ko");
  assert.equal(content.plans.length, 2);
  assert.equal(content.plans[0].id, "free");
  assert.equal(content.plans[1].id, "pro");
  assert.equal(content.plans[1].cta.kind, "checkout");
  assert.match(content.plans[0].summary[1], /월 2회/);
  assert.match(content.plans[1].features[0], /무제한|제한 없이/);
  assert.match(content.payg.title, /PAYG/);
});

test("falls back to English content for unsupported locales", () => {
  const content = getPricingContent("fr");

  assert.equal(content.locale, "en");
  assert.equal(content.plans[1].name, "Pro");
  assert.match(content.hero.title, /Start free/i);
});

test("uses route locale even when browser prefers Korean", () => {
  const locale = resolvePricingLocale({
    routeLocale: "en",
    acceptLanguage: "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  });

  assert.equal(locale, "en");
});

test("falls back to route locale when browser preference is unknown", () => {
  const locale = resolvePricingLocale({
    routeLocale: "ko",
    acceptLanguage: "fr-FR,fr;q=0.9",
  });

  assert.equal(locale, "ko");
});
