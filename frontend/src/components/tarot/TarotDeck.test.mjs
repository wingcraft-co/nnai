import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "TarotDeck.tsx"), "utf8");

test("card open CTA shows a pointer cursor when actionable", () => {
  assert.match(source, /className="[^"]*cursor-pointer[^"]*"/);
  assert.match(source, /disabled:cursor-not-allowed/);
});

test("detail CTA does not repeat the city-specific guide label above the button", () => {
  assert.doesNotMatch(source, /\{city\.city_kr \|\| city\.city\} 상세 페이지 받기/);
});

test("detail CTA shows a pointer cursor when actionable", () => {
  assert.match(source, /className="[^"]*cursor-pointer[^"]*"[\s\S]*?>\s*상세 페이지 받기/);
});

test("lightbox previous and next controls show a pointer cursor", () => {
  assert.match(source, /aria-label=\{isEn \? "Previous" : "이전"\}\s+className="[^"]*cursor-pointer[^"]*"/);
  assert.match(source, /aria-label=\{isEn \? "Next" : "다음"\}\s+className="[^"]*cursor-pointer[^"]*"/);
});
