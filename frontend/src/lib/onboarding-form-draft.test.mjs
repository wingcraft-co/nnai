import test from "node:test";
import assert from "node:assert/strict";

import {
  ONBOARDING_FORM_DRAFT_KEY,
  clearOnboardingFormDraft,
  readOnboardingFormDraft,
  writeOnboardingFormDraft,
} from "./onboarding-form-draft.ts";

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

test("stores and restores onboarding form choices for anonymous retry", () => {
  const storage = createStorage();
  const draft = {
    currentStep: 4,
    form: {
      immigration_purpose: "원격 근무",
      timeline: "1년 장기 체류",
      travel_type: "혼자 (솔로)",
      lifestyle: ["해변"],
    },
  };

  writeOnboardingFormDraft(storage, draft);

  assert.equal(storage.getItem(ONBOARDING_FORM_DRAFT_KEY)?.includes("원격 근무"), true);
  assert.deepEqual(readOnboardingFormDraft(storage), draft);
});

test("ignores corrupted onboarding form drafts", () => {
  const storage = createStorage();
  storage.setItem(ONBOARDING_FORM_DRAFT_KEY, "{not-json");

  assert.equal(readOnboardingFormDraft(storage), null);
});

test("clears onboarding form draft after successful handoff", () => {
  const storage = createStorage();
  writeOnboardingFormDraft(storage, { currentStep: 5, form: { travel_type: "혼자 (솔로)" } });

  clearOnboardingFormDraft(storage);

  assert.equal(storage.getItem(ONBOARDING_FORM_DRAFT_KEY), null);
});
