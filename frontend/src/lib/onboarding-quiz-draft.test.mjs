import test from "node:test";
import assert from "node:assert/strict";

import {
  ONBOARDING_QUIZ_DRAFT_KEY,
  clearOnboardingQuizDraft,
  readOnboardingQuizDraft,
  writeOnboardingQuizDraft,
} from "./onboarding-quiz-draft.ts";
import { buildQuizSelectionDebugPayload } from "./onboarding-quiz-debug.ts";

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

test("does not throw when quiz draft storage is unavailable", () => {
  const storage = {
    getItem() {
      return null;
    },
    setItem() {
      throw new Error("storage unavailable");
    },
    removeItem() {
      throw new Error("storage unavailable");
    },
  };

  assert.doesNotThrow(() => {
    writeOnboardingQuizDraft(storage, {
      currentIndex: 1,
      answers: ["wanderer"],
      answerIndices: [0],
    });
  });
  assert.doesNotThrow(() => clearOnboardingQuizDraft(storage));
});

test("builds a readable debug payload for selected quiz answers", () => {
  const payload = buildQuizSelectionDebugPayload({
    locale: "ko",
    currentIndex: 1,
    totalQuestions: 7,
    question: "숙소 체크인 완료.\n가방을 내려놓고 제일 먼저 할 일은?",
    selectedAnswerIndex: 2,
    selectedAnswerLabel: "유심 구매하고 환전부터 해야해.",
    selectedPersona: "planner",
    nextIndex: 2,
    answers: ["wanderer", "planner"],
    answerIndices: [0, 2],
  });

  assert.deepEqual(payload, {
    event: "quiz_answer_selected",
    locale: "ko",
    questionNumber: 2,
    totalQuestions: 7,
    question: "숙소 체크인 완료.\n가방을 내려놓고 제일 먼저 할 일은?",
    selectedAnswerIndex: 2,
    selectedAnswerLabel: "유심 구매하고 환전부터 해야해.",
    selectedPersona: "planner",
    nextIndex: 2,
    nextQuestionNumber: 3,
    answers: ["wanderer", "planner"],
    answerIndices: [0, 2],
  });
});
