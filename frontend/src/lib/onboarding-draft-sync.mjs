const FORM_DRAFT_KEY = "onboarding_form_draft_v1";
const QUIZ_DRAFT_KEY = "onboarding_quiz_draft_v1";

function readJson(storage, key) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeJson(storage, key, value) {
  storage.setItem(key, JSON.stringify(value));
}

function resolveStorage(storage) {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function resolveFetch(fetchImpl) {
  if (fetchImpl) return fetchImpl;
  if (typeof fetch === "undefined") return null;
  return fetch;
}

export async function saveOnboardingDraftToServer({
  apiBase,
  storage,
  fetchImpl,
  formDraft,
  quizDraft,
} = {}) {
  const resolvedFetch = resolveFetch(fetchImpl);
  if (!resolvedFetch || !apiBase) return { status: "skipped" };

  const body = {};
  if (formDraft !== undefined) body.form_draft = formDraft;
  if (quizDraft !== undefined) body.quiz_draft = quizDraft;
  if (Object.keys(body).length === 0) return { status: "skipped" };

  const response = await resolvedFetch(`${apiBase}/api/onboarding/draft`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  if (response.status === 401) return { status: "anonymous" };
  if (!response.ok) return { status: "error", code: response.status };

  if (storage) {
    await response.json().catch(() => null);
  }
  return { status: "saved" };
}

export async function clearServerOnboardingDrafts({ apiBase, fetchImpl } = {}) {
  return saveOnboardingDraftToServer({
    apiBase,
    fetchImpl,
    formDraft: null,
    quizDraft: null,
  });
}

export async function clearServerOnboardingQuizDraft({ apiBase, fetchImpl } = {}) {
  return saveOnboardingDraftToServer({
    apiBase,
    fetchImpl,
    quizDraft: null,
  });
}

export async function syncOnboardingDraftsAfterLogin({
  apiBase,
  storage,
  fetchImpl,
} = {}) {
  const resolvedStorage = resolveStorage(storage);
  const resolvedFetch = resolveFetch(fetchImpl);
  if (!resolvedStorage || !resolvedFetch || !apiBase) return { status: "skipped" };

  const localFormDraft = readJson(resolvedStorage, FORM_DRAFT_KEY);
  const localQuizDraft = readJson(resolvedStorage, QUIZ_DRAFT_KEY);

  const response = await resolvedFetch(`${apiBase}/api/onboarding/draft`, {
    credentials: "include",
    cache: "no-store",
  });

  if (response.status === 401) return { status: "anonymous" };
  if (!response.ok) return { status: "error", code: response.status };

  const remote = await response.json().catch(() => ({}));
  const remoteFormDraft =
    remote?.form_draft && typeof remote.form_draft === "object" && !Array.isArray(remote.form_draft)
      ? remote.form_draft
      : null;
  const remoteQuizDraft =
    remote?.quiz_draft && typeof remote.quiz_draft === "object" && !Array.isArray(remote.quiz_draft)
      ? remote.quiz_draft
      : null;

  const formDraft = localFormDraft ?? remoteFormDraft;
  const quizDraft = localQuizDraft ?? remoteQuizDraft;

  if (!localFormDraft && remoteFormDraft) {
    writeJson(resolvedStorage, FORM_DRAFT_KEY, remoteFormDraft);
  }
  if (!localQuizDraft && remoteQuizDraft) {
    writeJson(resolvedStorage, QUIZ_DRAFT_KEY, remoteQuizDraft);
  }

  if (!localFormDraft && !localQuizDraft) {
    return remoteFormDraft || remoteQuizDraft ? { status: "restored" } : { status: "empty" };
  }

  return saveOnboardingDraftToServer({
    apiBase,
    fetchImpl: resolvedFetch,
    formDraft,
    quizDraft,
  });
}
