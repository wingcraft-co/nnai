"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PERSONAS, type PersonaType } from "@/data/personas";
import {
  NATIONALITY_OPTIONS,
  LANGUAGE_OPTIONS,
  PURPOSE_OPTIONS,
  TIMELINE_OPTIONS,
  LIFESTYLE_OPTIONS,
  TRAVEL_TYPE_OPTIONS,
  INCOME_TYPE_OPTIONS,
  PREFERRED_REGION_OPTIONS,
  READINESS_OPTIONS,
  SPOUSE_INCOME_OPTIONS,
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

const STEP_TITLES = [
  "기본 정보를 알려주세요",
  "어떤 체류를 생각하고 계세요?",
  "선호하는 라이프스타일은?",
  "누구와 함께 하나요?",
  "경제 상황을 알려주세요",
  "마지막으로 몇 가지만 더!",
];

const TOTAL_STEPS = 6;

function hasChildren(travelType: string) {
  return travelType.includes("자녀");
}

function hasSpouse(travelType: string) {
  return travelType.includes("배우자") || travelType.includes("가족");
}

function incomeLabel(incomeType: string) {
  if (incomeType.includes("프리랜서")) return "월 평균 수입 (만원)";
  if (incomeType.includes("은퇴")) return "월 가용 예산 (만원)";
  return "월 소득 (만원)";
}

const INPUT_CLASS =
  "w-full rounded-lg border border-[var(--onboarding-card-border)] bg-[var(--onboarding-card-bg)] px-4 py-3 font-serif text-sm text-[var(--onboarding-text-primary)] placeholder:text-[var(--onboarding-text-secondary)]/40 focus:border-[var(--onboarding-card-border-active)] focus:outline-none";

export default function FormPage() {
  const router = useRouter();
  const [personaType, setPersonaType] = useState<PersonaType | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);

  useEffect(() => {
    const stored = sessionStorage.getItem("persona_type") as PersonaType | null;
    setPersonaType(stored);
  }, []);

  function canProceed(): boolean {
    switch (currentStep) {
      case 1:
        return form.nationality !== "" && form.languages.length > 0;
      case 2:
        return form.immigration_purpose !== "" && form.timeline !== "";
      case 3:
        return form.lifestyle.length > 0;
      case 4:
        return form.travel_type !== "";
      case 5:
        return form.income_type !== "" && form.income_krw > 0;
      case 6:
        return form.readiness_stage !== "";
      default:
        return false;
    }
  }

  function handleNext() {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    } else {
      const payload = { ...form, persona_type: personaType ?? "" };
      console.log("[FormPage] Submit payload:", payload);
      router.push("/result");
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

  return (
    <StepForm
      currentStep={currentStep}
      totalSteps={TOTAL_STEPS}
      stepTitle={STEP_TITLES[currentStep - 1]}
      onNext={handleNext}
      onBack={handleBack}
      canProceed={canProceed()}
    >
      {/* Persona badge */}
      {personaType && (
        <div className="mb-6 rounded-lg border border-[var(--onboarding-accent-dim)] bg-[var(--onboarding-accent-dim)] px-3 py-2 text-center font-serif text-xs text-[var(--onboarding-accent)]">
          {PERSONAS[personaType].label}으로 분석합니다
        </div>
      )}

      {/* Step 1: 기본 정보 */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="font-serif text-sm text-[var(--onboarding-text-secondary)]">
              국적
            </label>
            <SelectCard
              options={NATIONALITY_OPTIONS}
              selected={form.nationality}
              onSelect={(v) => setForm({ ...form, nationality: v })}
              mode="single"
            />
          </div>
          <div className="space-y-2">
            <label className="font-serif text-sm text-[var(--onboarding-text-secondary)]">
              복수국적
            </label>
            <button
              type="button"
              onClick={() =>
                setForm({ ...form, dual_nationality: !form.dual_nationality })
              }
              className={`w-full rounded-lg border px-4 py-3 text-left font-serif text-sm transition-colors ${
                form.dual_nationality
                  ? "border-[var(--onboarding-card-border-active)] bg-[var(--onboarding-card-bg-active)] text-[var(--onboarding-text-primary)]"
                  : "border-[var(--onboarding-card-border)] bg-[var(--onboarding-card-bg)] text-[var(--onboarding-text-secondary)]"
              }`}
            >
              {form.dual_nationality ? "예, 복수국적 보유" : "아니오"}
            </button>
          </div>
          <div className="space-y-2">
            <label className="font-serif text-sm text-[var(--onboarding-text-secondary)]">
              구사 언어 (복수 선택)
            </label>
            <SelectCard
              options={LANGUAGE_OPTIONS}
              selected={form.languages}
              onSelect={(v) => toggleMulti("languages", v)}
              mode="multi"
            />
          </div>
        </div>
      )}

      {/* Step 2: 체류 의도 */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="font-serif text-sm text-[var(--onboarding-text-secondary)]">
              체류 목적
            </label>
            <SelectCard
              options={PURPOSE_OPTIONS}
              selected={form.immigration_purpose}
              onSelect={(v) => setForm({ ...form, immigration_purpose: v })}
              mode="single"
            />
          </div>
          <div className="space-y-2">
            <label className="font-serif text-sm text-[var(--onboarding-text-secondary)]">
              체류 기간
            </label>
            <SelectCard
              options={TIMELINE_OPTIONS}
              selected={form.timeline}
              onSelect={(v) => setForm({ ...form, timeline: v })}
              mode="single"
            />
          </div>
        </div>
      )}

      {/* Step 3: 라이프스타일 */}
      {currentStep === 3 && (
        <div className="space-y-2">
          <label className="font-serif text-sm text-[var(--onboarding-text-secondary)]">
            라이프스타일 (최대 3개)
          </label>
          <SelectCard
            options={LIFESTYLE_OPTIONS}
            selected={form.lifestyle}
            onSelect={(v) => toggleMulti("lifestyle", v, 3)}
            mode="multi"
            maxSelect={3}
          />
        </div>
      )}

      {/* Step 4: 동행 조건 */}
      {currentStep === 4 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="font-serif text-sm text-[var(--onboarding-text-secondary)]">
              동행 유형
            </label>
            <SelectCard
              options={TRAVEL_TYPE_OPTIONS}
              selected={form.travel_type}
              onSelect={(v) => setForm({ ...form, travel_type: v })}
              mode="single"
            />
          </div>
          {hasChildren(form.travel_type) && (
            <div className="space-y-2">
              <label className="font-serif text-sm text-[var(--onboarding-text-secondary)]">
                자녀 나이 (쉼표로 구분)
              </label>
              <input
                type="text"
                placeholder="예: 5, 8"
                value={form.children_ages.join(", ")}
                onChange={(e) =>
                  setForm({
                    ...form,
                    children_ages: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                className={INPUT_CLASS}
              />
            </div>
          )}
          {hasSpouse(form.travel_type) && (
            <>
              <div className="space-y-2">
                <label className="font-serif text-sm text-[var(--onboarding-text-secondary)]">
                  배우자 소득
                </label>
                <SelectCard
                  options={SPOUSE_INCOME_OPTIONS}
                  selected={form.has_spouse_income}
                  onSelect={(v) => setForm({ ...form, has_spouse_income: v })}
                  mode="single"
                />
              </div>
              {form.has_spouse_income === "있음" && (
                <div className="space-y-2">
                  <label className="font-serif text-sm text-[var(--onboarding-text-secondary)]">
                    배우자 월 소득 (만원)
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={form.spouse_income_krw || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        spouse_income_krw: Number(e.target.value) || 0,
                      })
                    }
                    className={INPUT_CLASS}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 5: 경제 상황 */}
      {currentStep === 5 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="font-serif text-sm text-[var(--onboarding-text-secondary)]">
              소득 유형
            </label>
            <SelectCard
              options={INCOME_TYPE_OPTIONS}
              selected={form.income_type}
              onSelect={(v) => setForm({ ...form, income_type: v })}
              mode="single"
            />
          </div>
          <div className="space-y-2">
            <label className="font-serif text-sm text-[var(--onboarding-text-secondary)]">
              {incomeLabel(form.income_type)}
            </label>
            <input
              type="number"
              placeholder="0"
              value={form.income_krw || ""}
              onChange={(e) =>
                setForm({ ...form, income_krw: Number(e.target.value) || 0 })
              }
              className={INPUT_CLASS}
            />
          </div>
        </div>
      )}

      {/* Step 6: 마지막 조율 */}
      {currentStep === 6 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="font-serif text-sm text-[var(--onboarding-text-secondary)]">
              선호 지역 (선택 안 해도 됨)
            </label>
            <SelectCard
              options={PREFERRED_REGION_OPTIONS}
              selected={form.preferred_countries}
              onSelect={(v) => toggleMulti("preferred_countries", v)}
              mode="multi"
            />
          </div>
          <div className="space-y-2">
            <label className="font-serif text-sm text-[var(--onboarding-text-secondary)]">
              현재 준비 단계
            </label>
            <SelectCard
              options={READINESS_OPTIONS}
              selected={form.readiness_stage}
              onSelect={(v) => setForm({ ...form, readiness_stage: v })}
              mode="single"
            />
          </div>
        </div>
      )}
    </StepForm>
  );
}
