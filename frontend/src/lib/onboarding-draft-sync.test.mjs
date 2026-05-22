import test from "node:test";
import assert from "node:assert/strict";

import {
  clearServerOnboardingDrafts,
  syncOnboardingDraftsAfterLogin,
} from "./onboarding-draft-sync.mjs";

function createStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
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

function createJsonResponse(body, status = 200) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async json() {
      return body;
    },
  };
}

test("sync uploads anonymous local onboarding drafts after login", async () => {
  const storage = createStorage({
    onboarding_form_draft_v1: JSON.stringify({ currentStep: 5, form: { travel_type: "혼자" } }),
    onboarding_quiz_draft_v1: JSON.stringify({ currentIndex: 2, answers: ["local"], answerIndices: [1] }),
  });
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (!options.method) {
      return createJsonResponse({ form_draft: null, quiz_draft: null });
    }
    return createJsonResponse({ form_draft: {}, quiz_draft: {} });
  };

  const result = await syncOnboardingDraftsAfterLogin({
    apiBase: "http://localhost:7860",
    storage,
    fetchImpl,
  });

  assert.equal(result.status, "saved");
  assert.equal(calls[0].options.credentials, "include");
  assert.equal(calls[1].options.method, "PUT");
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    form_draft: { currentStep: 5, form: { travel_type: "혼자" } },
    quiz_draft: { currentIndex: 2, answers: ["local"], answerIndices: [1] },
  });
});

test("sync restores server onboarding drafts when local storage is empty", async () => {
  const storage = createStorage();
  const fetchImpl = async () =>
    createJsonResponse({
      form_draft: { currentStep: 3, form: { timeline: "1년" } },
      quiz_draft: { currentIndex: 1, answers: ["planner"], answerIndices: [0] },
    });

  const result = await syncOnboardingDraftsAfterLogin({
    apiBase: "http://localhost:7860",
    storage,
    fetchImpl,
  });

  assert.equal(result.status, "restored");
  assert.deepEqual(JSON.parse(storage.getItem("onboarding_form_draft_v1")), {
    currentStep: 3,
    form: { timeline: "1년" },
  });
  assert.deepEqual(JSON.parse(storage.getItem("onboarding_quiz_draft_v1")), {
    currentIndex: 1,
    answers: ["planner"],
    answerIndices: [0],
  });
});

test("clearServerOnboardingDrafts clears both draft sections", async () => {
  let body = null;
  const fetchImpl = async (_url, options = {}) => {
    body = JSON.parse(options.body);
    return createJsonResponse({});
  };

  const result = await clearServerOnboardingDrafts({
    apiBase: "http://localhost:7860",
    fetchImpl,
  });

  assert.equal(result.status, "saved");
  assert.deepEqual(body, { form_draft: null, quiz_draft: null });
});
