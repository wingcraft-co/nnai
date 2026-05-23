import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateTemporaryCardOpacity,
  libraryCardsFromServerGuides,
  mergeLibraryCards,
  toLibraryCard,
  unlockLibraryGuide,
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

const briefing = {
  documentId: "NNAI-TH-20260523-test",
  issuedDate: "2026-05-23",
  preparedFor: "Free Spirit",
  classification: "Personal Briefing",
  cityName: "Bangkok",
  cityKr: "방콕",
  countryOfficial: "Kingdom of Thailand",
  countryId: "TH",
  quickFacts: {
    visa: "DTV",
    stay: "180 days",
    monthly: "$1,300",
    taxResidency: "180 days",
  },
  sections: [],
  references: [],
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
    guide_briefing: briefing,
  };
  const merged = mergeLibraryCards([existing], [toLibraryCard(bangkok, 5000)]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].collected_at, 1000);
  assert.equal(merged[0].guide_unlocked, true);
  assert.equal(merged[0].guide_markdown, "# Bangkok guide");
  assert.deepEqual(merged[0].guide_briefing, briefing);
});

test("stores the formatted briefing snapshot when unlocking a guide", () => {
  const originalWindow = globalThis.window;
  const store = new Map();
  const listeners = [];
  globalThis.window = {
    localStorage: {
      getItem(key) {
        return store.get(key) ?? null;
      },
      setItem(key, value) {
        store.set(key, value);
      },
    },
    dispatchEvent(event) {
      listeners.push(event.type);
    },
  };
  globalThis.localStorage = globalThis.window.localStorage;

  try {
    const [card] = unlockLibraryGuide(bangkok, "# Bangkok guide", 1000, briefing);

    assert.equal(card.guide_unlocked, true);
    assert.equal(card.guide_markdown, "# Bangkok guide");
    assert.deepEqual(card.guide_briefing, briefing);
    assert.equal(listeners.at(-1), "nomad-library-change");
  } finally {
    globalThis.window = originalWindow;
    delete globalThis.localStorage;
  }
});

test("temporary cards fade every 10 seconds and stop at 30 percent opacity", () => {
  assert.equal(calculateTemporaryCardOpacity(0, 0, false), 1);
  assert.equal(calculateTemporaryCardOpacity(0, 10_000, false), 0.9);
  assert.equal(calculateTemporaryCardOpacity(0, 70_000, false), 0.3);
  assert.equal(calculateTemporaryCardOpacity(0, 120_000, false), 0.3);
  assert.equal(calculateTemporaryCardOpacity(0, 120_000, true), 1);
});

test("converts server saved markdown guides into unlocked library cards", () => {
  const [card] = libraryCardsFromServerGuides([
    {
      id: 7,
      markdown: "# Bangkok guide",
      city_snapshot: bangkok,
      parsed_snapshot: {},
      created_at: "2026-05-01T00:00:00+00:00",
      updated_at: "2026-05-02T00:00:00+00:00",
    },
  ], 1000);

  assert.equal(card.key, "bangkok-th");
  assert.equal(card.guide_unlocked, true);
  assert.equal(card.guide_markdown, "# Bangkok guide");
  assert.equal(card.updated_at, Date.parse("2026-05-02T00:00:00+00:00"));
});
