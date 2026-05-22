import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(join(__dirname, "[locale]", "onboarding", "form", "page.tsx"), "utf8");
const selectCardSource = readFileSync(join(__dirname, "..", "components", "onboarding", "select-card.tsx"), "utf8");

test("form back navigation preserves previous selections for review", () => {
  assert.doesNotMatch(formSource, /resetFields/);
  assert.match(formSource, /reviewStep/);
});

test("form selected options use the confirmed orange selection color", () => {
  assert.match(selectCardSource, /bg-\[#d97706\]/);
  assert.match(formSource, /bg-\[#d97706\]/);
});
