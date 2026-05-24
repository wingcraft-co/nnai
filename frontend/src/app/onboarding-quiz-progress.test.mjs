import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(__dirname, "[locale]", "onboarding", "quiz", "page.tsx"), "utf8");
const cardSource = readFileSync(join(__dirname, "..", "components", "onboarding", "quiz-card.tsx"), "utf8");

test("quiz page advances immediately after storing the selected answer", () => {
  assert.match(pageSource, /selectedAnswerIndex/);
  assert.match(pageSource, /writeOnboardingQuizDraft\(localStorage, \{[\s\S]*?currentIndex: nextIndex/);
  assert.match(pageSource, /setCurrentIndex\(nextIndex\)/);
  assert.match(pageSource, /selectedIndex=\{selectedAnswerIndex\}/);
});

test("quiz page redirects users who already have a saved persona", () => {
  assert.match(pageSource, /localStorage\.getItem\("persona_type"\)/);
  assert.match(pageSource, /router\.replace\("\/onboarding\/form"\)/);
});

test("quiz card can render a controlled selected option", () => {
  assert.match(cardSource, /selectedIndex\?: number \| null/);
  assert.match(cardSource, /selectedIndex === i/);
});

test("quiz selected answer uses the same orange filled style as the direct form", () => {
  assert.match(cardSource, /bg-\[#d97706\]/);
  assert.doesNotMatch(cardSource, /bg-primary\/10 border border-primary text-primary/);
});

test("quiz back navigation restores the previous question selected option", () => {
  assert.match(pageSource, /answerIndices/);
  assert.match(pageSource, /setSelectedAnswerIndex\(previousAnswerIndices\[previousIndex\] \?\? null\)/);
  assert.match(pageSource, /selectedIndex=\{selectedAnswerIndex\}/);
});
