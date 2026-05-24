import test from "node:test";
import assert from "node:assert/strict";

import {
  applyLibraryAuthScope,
  buildLibraryDisplayCards,
  calculateTemporaryCardOpacity,
  libraryCardsFromServerGuides,
  libraryCardKey,
  mergeLibraryCards,
  readLibraryCards,
  setLibraryStorageOwner,
  toLibraryCard,
  unlockLibraryGuide,
  writeLibraryCards,
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

test("uses a stable city-country key so short dataset ids do not duplicate cards", () => {
  assert.equal(libraryCardKey({ id: "KL", city: "Kuala Lumpur", country_id: "MY" }), "kuala-lumpur-my");
  assert.equal(libraryCardKey({ id: "bangkok-th", city: "Bangkok", country_id: "TH" }), "bangkok-th");
});

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

test("promotes an existing collected card to unlocked when a guide is purchased", () => {
  const existing = {
    ...toLibraryCard(bangkok, 1000),
    guide_unlocked: false,
    guide_markdown: null,
    guide_briefing: null,
  };
  const unlocked = {
    ...toLibraryCard(bangkok, 5000),
    guide_unlocked: true,
    guide_markdown: "# Bangkok guide",
    guide_briefing: briefing,
    guide_city_id: "bangkok-th",
  };

  const merged = mergeLibraryCards([existing], [unlocked]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].guide_unlocked, true);
  assert.equal(merged[0].guide_markdown, "# Bangkok guide");
  assert.deepEqual(merged[0].guide_briefing, briefing);
});

test("dedupes report and card entries for the same city when legacy keys differ", () => {
  const report = {
    ...toLibraryCard({ ...bangkok, id: "BKK" }, 1000),
    key: "bkk",
    guide_unlocked: true,
    guide_markdown: "# Bangkok guide",
    guide_city_id: "bkk",
  };
  const card = {
    ...toLibraryCard(bangkok, 5000),
    guide_unlocked: false,
  };

  const merged = mergeLibraryCards([report], [card]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].key, "bangkok-th");
  assert.equal(merged[0].guide_unlocked, true);
  assert.equal(merged[0].guide_markdown, "# Bangkok guide");
});

test("orders unlocked guide cards before collected-only cards", () => {
  const unlockedOlder = {
    ...toLibraryCard(bangkok, 1000),
    guide_unlocked: true,
    guide_markdown: "# Bangkok guide",
    guide_city_id: "bangkok-th",
  };
  const collectedNewer = toLibraryCard({
    id: "tokyo-jp",
    city: "Tokyo",
    city_kr: "도쿄",
    country: "Japan",
    country_id: "JP",
  }, 5000);

  const merged = mergeLibraryCards([unlockedOlder], [collectedNewer]);

  assert.deepEqual(merged.map((card) => card.key), ["bangkok-th", "tokyo-jp"]);
});

test("builds library display cards as report, card, then locked full catalog entries", () => {
  const tokyo = {
    id: "TYO",
    city: "Tokyo",
    city_kr: "도쿄",
    country: "Japan",
    country_id: "JP",
  };
  const lisbon = {
    id: "LIS",
    city: "Lisbon",
    city_kr: "리스본",
    country: "Portugal",
    country_id: "PT",
  };
  const report = {
    ...toLibraryCard({ ...bangkok, id: "BKK" }, 1000),
    key: "bkk",
    guide_unlocked: true,
    guide_markdown: "# Bangkok guide",
    guide_city_id: "bkk",
  };
  const collected = toLibraryCard(tokyo, 2000);

  const displayCards = buildLibraryDisplayCards([collected, report], [bangkok, tokyo, lisbon]);

  assert.deepEqual(displayCards.map((card) => [card.key, card.display_status]), [
    ["bangkok-th", "report"],
    ["tokyo-jp", "card"],
    ["lisbon-pt", "locked"],
  ]);
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

test("keeps library cards isolated per authenticated user", () => {
  const originalWindow = globalThis.window;
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem(key) {
        return store.get(key) ?? null;
      },
      setItem(key, value) {
        store.set(key, value);
      },
      removeItem(key) {
        store.delete(key);
      },
    },
    dispatchEvent() {},
  };
  globalThis.localStorage = globalThis.window.localStorage;

  try {
    applyLibraryAuthScope({ logged_in: true, uid: "rosiewingit@gmail.com" });
    writeLibraryCards([toLibraryCard(bangkok, 1000)]);

    applyLibraryAuthScope({ logged_in: true, uid: "casewingit@gmail.com" });
    assert.deepEqual(readLibraryCards(), []);

    writeLibraryCards([
      toLibraryCard({
        id: "lisbon-pt",
        city: "Lisbon",
        city_kr: "리스본",
        country: "Portugal",
        country_id: "PT",
      }, 2000),
    ]);

    applyLibraryAuthScope({ logged_in: true, uid: "rosiewingit@gmail.com" });
    assert.deepEqual(readLibraryCards().map((card) => card.key), ["bangkok-th"]);

    setLibraryStorageOwner(null);
    assert.deepEqual(readLibraryCards(), []);
  } finally {
    globalThis.window = originalWindow;
    delete globalThis.localStorage;
  }
});
