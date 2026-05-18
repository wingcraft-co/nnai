import test from "node:test";
import assert from "node:assert/strict";

import { getOnboardingCopy } from "./onboarding-content.ts";

test("returns localized onboarding quiz copy with stable persona mapping", () => {
  const ko = getOnboardingCopy("ko");
  const en = getOnboardingCopy("en");

  assert.equal(ko.quiz.questions.length, 7);
  assert.equal(en.quiz.questions.length, 7);
  assert.equal(en.quiz.questions[0].options.length, 5);
  assert.equal(en.quiz.questions[0].question.includes("떠나"), false);
  assert.equal(en.quiz.questions[0].question.includes("suddenly"), true);
  assert.equal(en.quiz.questions[0].options[0].persona, ko.quiz.questions[0].options[0].persona);
});

test("localizes onboarding form labels without changing backend values", () => {
  const en = getOnboardingCopy("en");

  assert.equal(en.form.preferredLanguage, "English");
  assert.equal(en.form.navigation.back, "Back");
  assert.equal(en.form.options.purpose[0].label, "Remote work");
  assert.equal(en.form.options.purpose[0].value, "원격 근무");
  assert.equal(en.form.options.travelType[0].label, "Solo");
  assert.equal(en.form.options.travelType[0].value, "혼자 (솔로)");
});

test("returns English persona result copy", () => {
  const en = getOnboardingCopy("en");
  const wanderer = en.result.personas.wanderer;

  assert.equal(en.result.headerPrefix, "Your nomad type is");
  assert.equal(wanderer.label, "The Boundless Wanderer");
  assert.equal(wanderer.description[0].includes("익숙"), false);
  assert.equal(en.result.sections.city, "Cities that fit you");
});
