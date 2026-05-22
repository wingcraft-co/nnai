import test from "node:test";
import assert from "node:assert/strict";

import {
  ONBOARDING_QUIZ_DRAFT_KEY,
  clearOnboardingQuizDraft,
  readOnboardingQuizDraft,
  writeOnboardingQuizDraft,
} from "./onboarding-quiz-draft.ts";

function createStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

test("stores quiz progress so anonymous users can resume mid-flow", () => {
  const storage = createStorage();
  const draft = {
    currentIndex: 3,
    answers: ["wanderer", "planner", "local"],
    answerIndices: [2, 1, 4],
  };

  writeOnboardingQuizDraft(storage, draft);

  assert.equal(storage.getItem(ONBOARDING_QUIZ_DRAFT_KEY)?.includes("planner"), true);
  assert.deepEqual(readOnboardingQuizDraft(storage), draft);
});

test("ignores invalid quiz drafts", () => {
  const storage = createStorage();
  storage.setItem(ONBOARDING_QUIZ_DRAFT_KEY, JSON.stringify({ currentIndex: -1, answers: ["bad"], answerIndices: ["bad"] }));

  assert.equal(readOnboardingQuizDraft(storage), null);
});

test("clears quiz draft after persona is completed", () => {
  const storage = createStorage();
  writeOnboardingQuizDraft(storage, { currentIndex: 1, answers: ["local"], answerIndices: [2] });

  clearOnboardingQuizDraft(storage);

  assert.equal(storage.getItem(ONBOARDING_QUIZ_DRAFT_KEY), null);
});

test("stores selected option indices separately from persona answers", () => {
  const storage = createStorage();
  const draft = {
    currentIndex: 2,
    answers: ["free_spirit", "local"],
    answerIndices: [0, 3],
  };

  writeOnboardingQuizDraft(storage, draft);

  assert.deepEqual(readOnboardingQuizDraft(storage)?.answerIndices, [0, 3]);
});
