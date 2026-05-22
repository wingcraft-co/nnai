import type { PersonaType } from "@/data/personas";

export const ONBOARDING_QUIZ_DRAFT_KEY = "onboarding_quiz_draft_v1";
const ONBOARDING_DRAFT_UPDATED_EVENT = "nnai:onboarding-draft-updated";

const PERSONA_TYPES = new Set(["wanderer", "local", "planner", "free_spirit", "pioneer"]);

export interface OnboardingQuizDraft {
  currentIndex: number;
  answers: PersonaType[];
  answerIndices: number[];
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function isPersonaType(value: unknown): value is PersonaType {
  return typeof value === "string" && PERSONA_TYPES.has(value);
}

function isDraft(value: unknown): value is OnboardingQuizDraft {
  return Boolean(
    value &&
      typeof value === "object" &&
      Number.isInteger((value as { currentIndex?: unknown }).currentIndex) &&
      (value as { currentIndex: number }).currentIndex >= 0 &&
      Array.isArray((value as { answers?: unknown }).answers) &&
      (value as { answers: unknown[] }).answers.every(isPersonaType) &&
      Array.isArray((value as { answerIndices?: unknown }).answerIndices) &&
      (value as { answerIndices: unknown[] }).answerIndices.every(
        (index) => Number.isInteger(index) && Number(index) >= 0
      )
  );
}

export function readOnboardingQuizDraft(storage: StorageLike): OnboardingQuizDraft | null {
  try {
    const raw = storage.getItem(ONBOARDING_QUIZ_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeOnboardingQuizDraft(storage: StorageLike, draft: OnboardingQuizDraft) {
  storage.setItem(ONBOARDING_QUIZ_DRAFT_KEY, JSON.stringify(draft));
  notifyOnboardingDraftUpdated();
}

export function clearOnboardingQuizDraft(storage: StorageLike) {
  storage.removeItem(ONBOARDING_QUIZ_DRAFT_KEY);
  notifyOnboardingDraftUpdated();
}

function notifyOnboardingDraftUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ONBOARDING_DRAFT_UPDATED_EVENT));
}
