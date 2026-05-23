import test from "node:test";
import assert from "node:assert/strict";

import { countryFlagEmoji, FALLBACK_FLAG } from "./country-flag.ts";

test("renders flags for ISO-2 codes that previously fell back to the globe", () => {
  assert.equal(countryFlagEmoji("PY"), "\u{1F1F5}\u{1F1FE}");
  assert.equal(countryFlagEmoji("py"), "\u{1F1F5}\u{1F1FE}");
  assert.equal(countryFlagEmoji("KR"), "\u{1F1F0}\u{1F1F7}");
});

test("falls back to a globe for invalid input", () => {
  assert.equal(countryFlagEmoji(""), FALLBACK_FLAG);
  assert.equal(countryFlagEmoji(null), FALLBACK_FLAG);
  assert.equal(countryFlagEmoji("USA"), FALLBACK_FLAG);
  assert.equal(countryFlagEmoji("12"), FALLBACK_FLAG);
});
