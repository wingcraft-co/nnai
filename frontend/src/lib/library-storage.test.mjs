import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateTemporaryCardOpacity,
  mergeLibraryCards,
  toLibraryCard,
} from "./library-storage.ts";

const bangkok = {
  id: "bangkok-th",
  city: "Bangkok",
  city_kr: "방콕",
  country: "Thailand",
  country_id: "TH",
  visa_type: "Destination Thailand Visa",
  monthly_cost_usd: 1300,
  score: 9,
};

test("converts a revealed city into a collectible library card", () => {
  const card = toLibraryCard(bangkok, 1000);

  assert.equal(card.key, "bangkok-th");
  assert.equal(card.city, "Bangkok");
  assert.equal(card.city_kr, "방콕");
  assert.equal(card.collected_at, 1000);
  assert.equal(card.guide_unlocked, false);
});

test("merges duplicate collected cards without losing unlocked guide data", () => {
  const existing = {
    ...toLibraryCard(bangkok, 1000),
    guide_unlocked: true,
    guide_markdown: "# Bangkok guide",
    guide_city_id: "bangkok-th",
  };
  const merged = mergeLibraryCards([existing], [toLibraryCard(bangkok, 5000)]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].collected_at, 1000);
  assert.equal(merged[0].guide_unlocked, true);
  assert.equal(merged[0].guide_markdown, "# Bangkok guide");
});

test("temporary cards fade every 10 seconds and stop at 30 percent opacity", () => {
  assert.equal(calculateTemporaryCardOpacity(0, 0, false), 1);
  assert.equal(calculateTemporaryCardOpacity(0, 10_000, false), 0.9);
  assert.equal(calculateTemporaryCardOpacity(0, 70_000, false), 0.3);
  assert.equal(calculateTemporaryCardOpacity(0, 120_000, false), 0.3);
  assert.equal(calculateTemporaryCardOpacity(0, 120_000, true), 1);
});
