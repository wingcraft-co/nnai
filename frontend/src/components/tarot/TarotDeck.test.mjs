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
  assert.match(source, /className="[^"]*cursor-pointer[^"]*"[\s\S]*?>\s*맞춤 보고서 받기/);
  assert.doesNotMatch(source, />\s*상세 페이지 받기\s*</);
});

test("lightbox previous, next, and close controls show a pointer cursor", () => {
  assert.match(source, /aria-label=\{isEn \? "Previous" : "이전"\}\s+className="[^"]*cursor-pointer[^"]*"/);
  assert.match(source, /aria-label=\{isEn \? "Next" : "다음"\}\s+className="[^"]*cursor-pointer[^"]*"/);
  assert.match(source, /aria-label=\{isEn \? "Close" : "닫기"\}\s+className="[^"]*cursor-pointer[^"]*"/);
  assert.match(source, /style=\{\{ color: "rgba\(255,255,255,0\.8\)", cursor: "pointer" \}\}/);
});

test("locked card Korean copy uses neutral lock wording", () => {
  assert.match(source, /: `잠겨진 카드 #\$\{orderNumber\}`/);
  assert.match(source, /: "잠금 해제 \(\$1\)"/);
  assert.doesNotMatch(source, /Pro 전용 카드/);
  assert.doesNotMatch(source, /Pro로 모든 도시 보기/);
});
