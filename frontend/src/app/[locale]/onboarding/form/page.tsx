"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { PersonaType } from "@/data/personas";
import { House } from "lucide-react";
import { ProgressBar } from "@/components/onboarding/progress-bar";
import { SelectCard } from "@/components/onboarding/select-card";
import { getOnboardingCopy } from "@/lib/onboarding-content";
import {
  readOnboardingFormDraft,
  writeOnboardingFormDraft,
} from "@/lib/onboarding-form-draft";
import {
  trackFormAbandon,
  trackFormStepComplete,
  trackFormStepView,
  trackOnboardingStepDwell,
} from "@/lib/analytics/events";
import dynamic from "next/dynamic";

const IS_DEBUG = process.env.NEXT_PUBLIC_DEBUG_MODE === "1";

const CityDebugPanel = IS_DEBUG
  ? dynamic(() => import("@/components/debug/CityDebugPanel"), { ssr: false })
  : null;

// ── Types ────────────────────────────────────────────────────────

interface FormData {
  immigration_purpose: string;
  timeline: string;
  stay_style: string;
  income_range: string;
  tax_sensitivity: string;
  travel_type: string;
  children_ages: string[];
  has_spouse_income: string;
  spouse_income_krw: number;
  preferred_countries: string[];
  lifestyle: string[];
  total_budget: string;
}

const INITIAL_FORM: FormData = {
  immigration_purpose: "",
  timeline: "",
  stay_style: "",
  income_range: "",
  tax_sensitivity: "",
  travel_type: "",
  children_ages: [],
  has_spouse_income: "",
  spouse_income_krw: 0,
  preferred_countries: [],
  lifestyle: [],
  total_budget: "",
};

const TOTAL_STEPS = 5;

const personaGif: Record<string, string> = {
  wanderer: "/wanderer.gif",
  local: "/local.gif",
  planner: "/planner.gif",
  free_spirit: "/free_spirit.gif",
  pioneer: "/pioneer.gif",
};

// ── Helpers ──────────────────────────────────────────────────────

function hasChildren(travelType: string) {
  return travelType.includes("자녀") || travelType.includes("가족");
}

function hasSpouse(travelType: string) {
  return travelType.includes("배우자") || travelType.includes("가족") || travelType.includes("파트너");
}

// ── Component ────────────────────────────────────────────────────

export default function FormPage() {
  const locale = useLocale();
  const router = useRouter();
  const copy = getOnboardingCopy(locale);
  const [personaType, setPersonaType] = useState<PersonaType | null>(null);
  const [personaVector, setPersonaVector] = useState<Record<string, number> | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const previousStepRef = useRef<number | null>(null);
  const stepEnteredAtRef = useRef(Date.now());
  const currentStepRef = useRef(1);
  const submittedRef = useRef(false);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [reviewStep, setReviewStep] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("persona_type") as PersonaType | null;
    setPersonaType(stored);
    const vectorStr = localStorage.getItem("persona_vector");
    if (vectorStr) {
      try { setPersonaVector(JSON.parse(vectorStr)); } catch {}
    }

    const draft = readOnboardingFormDraft(localStorage);
    if (draft) {
      setForm({ ...INITIAL_FORM, ...draft.form });
      setCurrentStep(Math.min(Math.max(Math.trunc(draft.currentStep), 1), TOTAL_STEPS));
    }
    setDraftHydrated(true);
  }, []);

  useEffect(() => {
    if (!draftHydrated || submittedRef.current) return;
    writeOnboardingFormDraft(localStorage, { currentStep, form });
  }, [currentStep, draftHydrated, form]);

  useEffect(() => {
    const now = Date.now();
    const previousStep = previousStepRef.current;

    if (previousStep !== null && previousStep !== currentStep) {
      trackOnboardingStepDwell({
        flow: "form",
        stepNumber: previousStep,
        durationMs: now - stepEnteredAtRef.current,
      });
      stepEnteredAtRef.current = now;
    }

    previousStepRef.current = currentStep;
    currentStepRef.current = currentStep;
    trackFormStepView(currentStep);
  }, [currentStep]);

  useEffect(() => {
    return () => {
      if (submittedRef.current) return;

      trackOnboardingStepDwell({
        flow: "form",
        stepNumber: currentStepRef.current,
        durationMs: Date.now() - stepEnteredAtRef.current,
      });
      trackFormAbandon({
        flow: "form",
        stepNumber: currentStepRef.current,
      });
    };
  }, []);

  const isShortStay = form.timeline === "1~3개월 단기 체류";

  function canProceed(): boolean {
    switch (currentStep) {
      case 1: return form.immigration_purpose !== "";
      case 2: return form.timeline !== "";
      case 3:
        if (isShortStay) {
          return form.total_budget !== "";
        }
        return form.income_range !== "";
      case 4: return form.travel_type !== "";
      case 5: return true;
      default: return false;
    }
  }

  function toggleMulti(field: keyof FormData, value: string, max?: number) {
    setReviewStep(null);
    setForm((prev) => {
      const arr = prev[field] as string[];
      if (arr.includes(value)) {
        return { ...prev, [field]: arr.filter((v) => v !== value) };
      }
      if (max && arr.length >= max) return prev;
      return { ...prev, [field]: [...arr, value] };
    });
  }

  function updateForm(patch: Partial<FormData>) {
    setReviewStep(null);
    setForm((prev) => ({ ...prev, ...patch }));
  }

  async function handleSubmit() {
    setIsLoading(true);
    setError(null);

    try {
      if (!completedSteps.includes(currentStep)) {
        trackFormStepComplete(currentStep);
        setCompletedSteps((prev) => [...prev, currentStep]);
      }

      const payload = {
        nationality: "한국",
        languages: [],
        preferred_language: copy.form.preferredLanguage,
        dual_nationality: false,
        readiness_stage: "",
        persona_type: personaType ?? null,
        persona_vector: personaVector,
        immigration_purpose: form.immigration_purpose,
        travel_type: form.travel_type,
        timeline: form.timeline,
        stay_style: isShortStay ? "" : form.stay_style,
        income_krw: isShortStay ? 0 : Number(form.income_range),
        total_budget_krw: isShortStay && form.total_budget ? Number(form.total_budget) : null,
        tax_sensitivity: isShortStay ? "" : form.tax_sensitivity,
        children_ages: hasChildren(form.travel_type) ? form.children_ages : null,
        has_spouse_income: hasSpouse(form.travel_type) ? (form.has_spouse_income || "없음") : "없음",
        spouse_income_krw: hasSpouse(form.travel_type) && form.has_spouse_income === "있음" ? form.spouse_income_krw : 0,
        income_type: "",
        lifestyle: form.lifestyle,
        preferred_countries: form.preferred_countries,
      };

      // Save payload so result page can call /api/recommend itself
      localStorage.setItem("recommend_payload", JSON.stringify(payload));
      // Clear any stale tarot session from a previous run
      localStorage.removeItem("tarot_session");

      submittedRef.current = true;
      router.push("/result");
    } catch {
      setError(copy.form.navigation.error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleNext() {
    if (currentStep < TOTAL_STEPS) {
      if (!completedSteps.includes(currentStep)) {
        trackFormStepComplete(currentStep);
        setCompletedSteps((prev) => [...prev, currentStep]);
      }
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  }

  function shouldAutoAdvance(): boolean {
    switch (currentStep) {
      case 1:
        return form.immigration_purpose !== "";
      case 2:
        if (form.timeline === "") return false;
        if (form.timeline === "1~3개월 단기 체류") return true; // no conditional
        return form.stay_style !== ""; // conditional filled
      case 3:
        if (form.timeline === "1~3개월 단기 체류") return form.total_budget !== "";
        if (form.income_range === "") return false;
        return form.tax_sensitivity !== ""; // conditional filled
      case 4: {
        if (form.travel_type === "") return false;
        const solo = form.travel_type === "혼자 (솔로)";
        if (solo) return true;
        const spouse = hasSpouse(form.travel_type);
        const children = hasChildren(form.travel_type);
        if (children) return false; // multi-select → needs button
        if (spouse) {
          if (!isShortStay) {
            if (form.has_spouse_income === "") return false; // 아직 선택 안 함
            if (form.has_spouse_income === "없음") return true;
            if (form.has_spouse_income === "있음") return form.spouse_income_krw > 0;
            return false;
          }
          return true; // short stay, no spouse income conditional
        }
        return false;
      }
      default:
        return false;
    }
  }

  useEffect(() => {
    if (currentStep >= 5) return;
    if (reviewStep === currentStep) return;
    if (!shouldAutoAdvance()) return;

    const timer = setTimeout(() => {
      handleNext();
    }, 300);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentStep,
    form.immigration_purpose,
    form.timeline,
    form.stay_style,
    form.income_range,
    form.total_budget,
    form.tax_sensitivity,
    form.travel_type,
    form.has_spouse_income,
    form.spouse_income_krw,
    reviewStep,
  ]);

  function handleBack() {
    if (currentStep <= 1) return;
    const prev = currentStep - 1;
    setReviewStep(prev);
    setCurrentStep(prev);
  }

  return (
    <>
    {CityDebugPanel && (
      <CityDebugPanel
        incomeRange={form.income_range}
        timeline={form.timeline}
        preferredCountries={form.preferred_countries}
      />
    )}
    <div className="mx-auto flex min-h-screen max-w-sm w-full flex-col">
      {/* 프로그레스바 */}
      <div className="flex items-center gap-3 pt-6 px-4">
        {currentStep === 1 ? (
          <button
            type="button"
            onClick={() => router.push("/")}
            className="shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
          >
            <House className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleBack}
            className="shrink-0 cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {copy.form.navigation.back}
          </button>
        )}
        <ProgressBar current={currentStep} total={TOTAL_STEPS} />
      </div>

      {/* 콘텐츠 */}
      <div className="flex flex-1 flex-col justify-start pt-24 px-4">
        {/* 스텝 캐릭터 — 배지 바로 위, 스텝 간 슬라이드 이동 */}
        <div className="relative h-12">
          {personaType ? (
          <motion.img
            src={personaGif[personaType] ?? "/earth_64.gif"}
            alt=""
            width={40}
            height={40}
            className="absolute bottom-0 object-contain"
            style={{ imageRendering: "pixelated" }}
            animate={{
              left: `${((currentStep - 1) / (TOTAL_STEPS - 1)) * 100}%`,
              x: "-50%",
            }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
          />
          ) : (
          <motion.div
            className="absolute bottom-0 flex"
            animate={{
              left: `${((currentStep - 1) / (TOTAL_STEPS - 1)) * 100}%`,
              x: "-50%",
            }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
          >
            <img
              src="/grace_64.gif"
              alt=""
              width={40}
              height={40}
              className="object-contain"
              style={{ imageRendering: "pixelated" }}
            />
            <img
              src="/rocky_64.gif"
              alt=""
              width={40}
              height={40}
              className="object-contain -ml-4"
              style={{ imageRendering: "pixelated" }}
            />
          </motion.div>
          )}
        </div>

        {/* 페르소나 배지 */}
        {personaType && (() => {
          const label = copy.result.personas[personaType].label;
          const badgeText = locale === "ko"
            ? `${label}${(() => {
                const lastChar = label.slice(-1);
                const code = lastChar.charCodeAt(0) - 0xAC00;
                return code >= 0 && code % 28 > 0 ? "을" : "를";
              })()}${copy.form.personaBadge.suffix}`
            : `${copy.form.personaBadge.prefix}${label}${copy.form.personaBadge.suffix}`;

          return (
            <div className="mb-6 border border-primary/20 bg-primary/5 px-3 py-2 text-center text-xs text-primary">
              {badgeText}
            </div>
          );
        })()}

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.35 } }}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
          >
            <h2 className="whitespace-pre-line text-xl font-medium leading-relaxed text-foreground mb-8">
              {currentStep === 3 && isShortStay
                ? copy.form.shortStayBudgetTitle
                : copy.form.stepTitles[currentStep - 1]}
            </h2>

            {/* Step 1: 목적 */}
            {currentStep === 1 && (
              <div className="space-y-2">
                <SelectCard
                  options={copy.form.options.purpose}
                  selected={form.immigration_purpose}
                  onSelect={(v) => updateForm({ immigration_purpose: v })}
                  mode="single"
                />
              </div>
            )}

            {/* Step 2: 체류 기간 + 체류 형태 */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">{copy.form.labels.timeline}</label>
                  <SelectCard
                    options={copy.form.options.timeline}
                    selected={form.timeline}
                    onSelect={(v) => updateForm({ timeline: v })}
                    mode="single"
                  />
                </div>
                {!isShortStay && form.timeline !== "" && (
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">{copy.form.labels.stayStyle}</label>
                    <SelectCard
                      options={copy.form.options.stayStyle}
                      selected={form.stay_style}
                      onSelect={(v) => updateForm({ stay_style: v })}
                      mode="single"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 3: 소득 또는 총 예산 */}
            {currentStep === 3 && (
              <div className="space-y-6">
                {isShortStay ? (
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">
                      {copy.form.labels.monthlyBudget}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {copy.form.options.budgetRange.map((option) => {
                        const isActive = form.total_budget === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => updateForm({ total_budget: option.value, income_range: option.value === "0" ? "0" : "" })}
                            className={`w-full cursor-pointer border px-4 py-3.5 text-left text-sm font-medium transition-colors ${
                              isActive
                                ? "border-[#d97706] bg-[#d97706] text-white"
                                : "border-border bg-muted text-foreground hover:bg-accent"
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                    {form.total_budget === "0" && (
                      <p className="text-xs text-destructive mt-1">{copy.form.labels.visaAccuracyWarning}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">{copy.form.labels.monthlyIncome}</label>
                    <div className="grid grid-cols-2 gap-2">
                      {copy.form.options.incomeRange.map((option) => {
                        const isActive = form.income_range === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => updateForm({ income_range: option.value })}
                            className={`w-full cursor-pointer border px-4 py-3.5 text-left text-sm font-medium transition-colors ${
                              isActive
                                ? "border-[#d97706] bg-[#d97706] text-white"
                                : "border-border bg-muted text-foreground hover:bg-accent"
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                    {form.income_range === "0" && (
                      <p className="text-xs text-destructive mt-1">{copy.form.labels.visaAccuracyWarning}</p>
                    )}
                  </div>
                )}

                {!isShortStay && (
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">{copy.form.labels.taxSensitivity}</label>
                    <SelectCard
                      options={copy.form.options.taxSensitivity}
                      selected={form.tax_sensitivity}
                      onSelect={(v) => updateForm({ tax_sensitivity: v })}
                      mode="single"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 4: 동행 유형 + 조건부 필드 */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <SelectCard
                    options={copy.form.options.travelType}
                    selected={form.travel_type}
                    onSelect={(v) => updateForm({ travel_type: v })}
                    mode="single"
                  />
                </div>

                {hasSpouse(form.travel_type) && !isShortStay && (
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">{copy.form.labels.spouseIncome}</label>
                    <SelectCard
                      options={copy.form.options.spouseIncome}
                      selected={form.has_spouse_income}
                      onSelect={(v) => updateForm({ has_spouse_income: v })}
                      mode="single"
                    />
                    {form.has_spouse_income === "있음" && (
                      <div className="mt-3 space-y-2">
                        <label className="text-sm text-muted-foreground">{copy.form.labels.spouseIncomeRange}</label>
                        <div className="grid grid-cols-2 gap-2">
                          {copy.form.options.incomeRange.filter(o => o.value !== "0").map((option) => {
                            const isActive = String(form.spouse_income_krw) === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => updateForm({ spouse_income_krw: Number(option.value) })}
                                className={`w-full cursor-pointer border px-4 py-3.5 text-left text-sm font-medium transition-colors ${
                                  isActive
                                    ? "border-[#d97706] bg-[#d97706] text-white"
                                    : "border-border bg-muted text-foreground hover:bg-accent"
                                }`}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {hasChildren(form.travel_type) && (
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">{copy.form.labels.childrenAges}</label>
                    <SelectCard
                      options={copy.form.options.childrenAge}
                      selected={form.children_ages}
                      onSelect={(v) => toggleMulti("children_ages", v)}
                      mode="multi"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 5: 라이프스타일 */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">{copy.form.labels.lifestyle}</label>
                  <SelectCard
                    options={copy.form.options.lifestyle}
                    selected={form.lifestyle}
                    onSelect={(v) => toggleMulti("lifestyle", v)}
                    mode="multi"
                  />
                </div>
              </div>
            )}

            {/* CTA 버튼 */}
            {(() => {
              const showNextButton = (() => {
                if (currentStep === 5) return true; // always show submit
                if (currentStep === 4 && hasChildren(form.travel_type)) return true; // multi-select
                return false; // auto-advance handles it
              })();

              return showNextButton ? (
                <div className="mt-10 space-y-3">
                  {error && (
                    <p className="mb-3 text-center text-sm text-destructive">{error}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!canProceed() || isLoading}
                    className="w-full cursor-pointer bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    {isLoading ? copy.form.navigation.loading : currentStep === TOTAL_STEPS ? copy.form.navigation.submit : copy.form.navigation.next}
                  </button>
                  {currentStep === 5 && !isLoading && (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="w-full cursor-pointer py-1.5 text-xs font-medium text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                    >
                      {copy.form.navigation.skip}
                    </button>
                  )}
                </div>
              ) : null;
            })()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
    </>
  );
}
