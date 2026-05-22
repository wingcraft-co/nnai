export const ONBOARDING_FORM_DRAFT_KEY = "onboarding_form_draft_v1";
export const ONBOARDING_DRAFT_UPDATED_EVENT = "nnai:onboarding-draft-updated";

export interface OnboardingFormDraft {
  currentStep: number;
  form: object;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function isDraft(value: unknown): value is OnboardingFormDraft {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { currentStep?: unknown }).currentStep === "number" &&
      (value as { currentStep: number }).currentStep >= 1 &&
      (value as { form?: unknown }).form &&
      typeof (value as { form?: unknown }).form === "object" &&
      !Array.isArray((value as { form?: unknown }).form)
  );
}

export function readOnboardingFormDraft(storage: StorageLike): OnboardingFormDraft | null {
  try {
    const raw = storage.getItem(ONBOARDING_FORM_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeOnboardingFormDraft(storage: StorageLike, draft: OnboardingFormDraft) {
  storage.setItem(ONBOARDING_FORM_DRAFT_KEY, JSON.stringify(draft));
  notifyOnboardingDraftUpdated();
}

export function clearOnboardingFormDraft(storage: StorageLike) {
  storage.removeItem(ONBOARDING_FORM_DRAFT_KEY);
  notifyOnboardingDraftUpdated();
}

function notifyOnboardingDraftUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ONBOARDING_DRAFT_UPDATED_EVENT));
}
