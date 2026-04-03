"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { PersonaType } from "@/data/personas";
import { PERSONAS } from "@/data/personas";
import {
  NATIONALITY_VALUES,
  LANGUAGE_VALUES,
  PURPOSE_VALUES,
  TIMELINE_VALUES,
  LIFESTYLE_VALUES,
  TRAVEL_TYPE_VALUES,
  INCOME_TYPE_VALUES,
  PREFERRED_REGION_VALUES,
  READINESS_VALUES,
  SPOUSE_INCOME_VALUES,
} from "@/data/form-options";
import { StepForm } from "@/components/onboarding/step-form";
import { SelectCard } from "@/components/onboarding/select-card";

interface FormData {
  nationality: string;
  dual_nationality: boolean;
  languages: string[];
  immigration_purpose: string;
  timeline: string;
  lifestyle: string[];
  travel_type: string;
  children_ages: string[];
  has_spouse_income: string;
  spouse_income_krw: number;
  income_type: string;
  income_krw: number;
  preferred_countries: string[];
  readiness_stage: string;
}

const INITIAL_FORM: FormData = {
  nationality: "",
  dual_nationality: false,
  languages: [],
  immigration_purpose: "",
  timeline: "",
  lifestyle: [],
  travel_type: "",
  children_ages: [],
  has_spouse_income: "없음",
  spouse_income_krw: 0,
  income_type: "",
  income_krw: 0,
  preferred_countries: [],
  readiness_stage: "",
};

const TOTAL_STEPS = 6;
function hasChildren(travelType: string) {
  return travelType.includes("자녀");
}

function hasSpouse(travelType: string) {
  return travelType.includes("배우자") || travelType.includes("가족");
}

const INPUT_CLASS =
  "w-full rounded-lg border border-border bg-muted px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none";

function buildOptions(labels: string[], values: string[]) {
  return labels.map((label, i) => ({ label, value: values[i] }));
}

export default function FormPage() {
  const router = useRouter();
  const t = useTranslations("form");
  const [personaType, setPersonaType] = useState<PersonaType | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("persona_type") as PersonaType | null;
    setPersonaType(stored);
  }, []);

  function canProceed(): boolean {
    switch (currentStep) {
      case 1: return form.nationality !== "" && form.languages.length > 0;
      case 2: return form.immigration_purpose !== "" && form.timeline !== "";
      case 3: return form.lifestyle.length > 0;
      case 4: return form.travel_type !== "";
      case 5: return form.income_type !== "" && form.income_krw > 0;
      case 6: return form.readiness_stage !== "";
      default: return false;
    }
  }

  async function handleSubmit() {
    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        nationality: form.nationality,
        income_krw: form.income_krw,
        immigration_purpose: form.immigration_purpose,
        lifestyle: form.lifestyle,
        languages: form.languages,
        timeline: form.timeline,
        preferred_countries: form.preferred_countries,
        preferred_language: "한국어",
        persona_type: personaType ?? "",
        income_type: form.income_type,
        travel_type: form.travel_type,
        children_ages: form.children_ages.length > 0 ? form.children_ages : null,
        dual_nationality: form.dual_nationality,
        readiness_stage: form.readiness_stage,
        has_spouse_income: form.has_spouse_income,
        spouse_income_krw: form.spouse_income_krw,
      };

      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data = await res.json();
      sessionStorage.setItem("nnai_result", JSON.stringify(data));
      router.push("/result");
    } catch {
      setError("잠시 후 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleNext() {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  }

  function handleBack() {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  }

  function toggleMulti(field: keyof FormData, value: string, max?: number) {
    setForm((prev) => {
      const arr = prev[field] as string[];
      if (arr.includes(value)) {
        return { ...prev, [field]: arr.filter((v) => v !== value) };
      }
      if (max && arr.length >= max) return prev;
      return { ...prev, [field]: [...arr, value] };
    });
  }

  function incomeLabel(): string {
    if (form.income_type.includes("프리랜서")) return t("labels.incomeFreelancer");
    if (form.income_type.includes("은퇴")) return t("labels.incomeRetired");
    return t("labels.incomeDefault");
  }

  const stepLabels = t.raw("stepLabels") as string[];
  const stepTitles = t.raw("stepTitles") as string[];

  return (
    <StepForm
      currentStep={currentStep}
      totalSteps={TOTAL_STEPS}
      stepTitle={stepTitles[currentStep - 1]}
      stepLabel={stepLabels[currentStep - 1]}
      onNext={handleNext}
      onBack={handleBack}
      canProceed={canProceed()}
      isLoading={isLoading}
      error={error}
    >
      {personaType && (
        <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-center text-xs text-primary">
          {PERSONAS[personaType].label}으로 분석합니다
        </div>
      )}

      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">{t("labels.nationality")}</label>
            <SelectCard options={buildOptions(t.raw("options.nationality") as string[], NATIONALITY_VALUES)} selected={form.nationality} onSelect={(v) => setForm({ ...form, nationality: v })} mode="single" />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">{t("labels.dualNationality")}</label>
            <button type="button" onClick={() => setForm({ ...form, dual_nationality: !form.dual_nationality })} className={`w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors ${form.dual_nationality ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted text-foreground"}`}>
              {form.dual_nationality ? t("labels.dualYes") : t("labels.dualNo")}
            </button>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">{t("labels.languages")}</label>
            <SelectCard options={buildOptions(t.raw("options.languages") as string[], LANGUAGE_VALUES)} selected={form.languages} onSelect={(v) => toggleMulti("languages", v)} mode="multi" />
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">{t("labels.purpose")}</label>
            <SelectCard options={buildOptions(t.raw("options.purpose") as string[], PURPOSE_VALUES)} selected={form.immigration_purpose} onSelect={(v) => setForm({ ...form, immigration_purpose: v })} mode="single" />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">{t("labels.timeline")}</label>
            <SelectCard options={buildOptions(t.raw("options.timeline") as string[], TIMELINE_VALUES)} selected={form.timeline} onSelect={(v) => setForm({ ...form, timeline: v })} mode="single" />
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">{t("labels.lifestyle")}</label>
          <SelectCard options={buildOptions(t.raw("options.lifestyle") as string[], LIFESTYLE_VALUES)} selected={form.lifestyle} onSelect={(v) => toggleMulti("lifestyle", v, 3)} mode="multi" maxSelect={3} />
        </div>
      )}

      {currentStep === 4 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">{t("labels.travelType")}</label>
            <SelectCard options={buildOptions(t.raw("options.travelType") as string[], TRAVEL_TYPE_VALUES)} selected={form.travel_type} onSelect={(v) => setForm({ ...form, travel_type: v })} mode="single" />
          </div>
          {hasChildren(form.travel_type) && (
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">{t("labels.childrenAges")}</label>
              <input type="text" placeholder={t("labels.childrenPlaceholder")} value={form.children_ages.join(", ")} onChange={(e) => setForm({ ...form, children_ages: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} className={INPUT_CLASS} />
            </div>
          )}
          {hasSpouse(form.travel_type) && (
            <>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">{t("labels.spouseIncome")}</label>
                <SelectCard options={buildOptions(t.raw("options.spouseIncome") as string[], SPOUSE_INCOME_VALUES)} selected={form.has_spouse_income} onSelect={(v) => setForm({ ...form, has_spouse_income: v })} mode="single" />
              </div>
              {form.has_spouse_income === "있음" && (
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">{t("labels.spouseIncomeAmount")}</label>
                  <input type="number" placeholder="0" value={form.spouse_income_krw || ""} onChange={(e) => setForm({ ...form, spouse_income_krw: Number(e.target.value) || 0 })} className={INPUT_CLASS} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {currentStep === 5 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">{t("labels.incomeType")}</label>
            <SelectCard options={buildOptions(t.raw("options.incomeType") as string[], INCOME_TYPE_VALUES)} selected={form.income_type} onSelect={(v) => setForm({ ...form, income_type: v })} mode="single" />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">{incomeLabel()}</label>
            <input type="number" placeholder="0" value={form.income_krw || ""} onChange={(e) => setForm({ ...form, income_krw: Number(e.target.value) || 0 })} className={INPUT_CLASS} />
          </div>
        </div>
      )}

      {currentStep === 6 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">{t("labels.preferredRegion")}</label>
            <SelectCard options={buildOptions(t.raw("options.preferredRegion") as string[], PREFERRED_REGION_VALUES)} selected={form.preferred_countries} onSelect={(v) => toggleMulti("preferred_countries", v)} mode="multi" />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">{t("labels.readiness")}</label>
            <SelectCard options={buildOptions(t.raw("options.readiness") as string[], READINESS_VALUES)} selected={form.readiness_stage} onSelect={(v) => setForm({ ...form, readiness_stage: v })} mode="single" />
          </div>
        </div>
      )}
    </StepForm>
  );
}
