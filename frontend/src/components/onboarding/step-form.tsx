"use client";

import type { ReactNode } from "react";
import { ProgressBar } from "./progress-bar";

interface StepFormProps {
  currentStep: number;
  totalSteps: number;
  stepTitle: string;
  onNext: () => void;
  onBack: () => void;
  canProceed: boolean;
  children: ReactNode;
}

const STEP_LABELS = [
  "기본 정보",
  "체류 의도",
  "라이프스타일",
  "동행 조건",
  "경제 상황",
  "마지막 조율",
];

export function StepForm({
  currentStep,
  totalSteps,
  stepTitle,
  onNext,
  onBack,
  canProceed,
  children,
}: StepFormProps) {
  const isLast = currentStep === totalSteps;
  const isFirst = currentStep === 1;

  return (
    <div className="flex min-h-dvh flex-col px-5 py-8">
      {/* Header */}
      <div className="space-y-4">
        <ProgressBar
          current={currentStep}
          total={totalSteps}
          label={`Step ${currentStep}: ${STEP_LABELS[currentStep - 1] ?? stepTitle}`}
        />
        <h1 className="font-serif text-xl font-medium text-[var(--onboarding-text-primary)]">
          {stepTitle}
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 py-8">{children}</div>

      {/* Navigation */}
      <div className="flex gap-3 pb-4">
        {!isFirst && (
          <button
            type="button"
            onClick={onBack}
            className="flex-1 rounded-lg border border-[var(--onboarding-card-border)] py-3 font-serif text-sm text-[var(--onboarding-text-secondary)] transition-colors hover:border-[var(--onboarding-card-border-active)] hover:text-[var(--onboarding-text-primary)]"
          >
            이전
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={!canProceed}
          className="flex-1 rounded-lg border border-[var(--onboarding-accent)] bg-[var(--onboarding-accent-dim)] py-3 font-serif text-sm text-[var(--onboarding-accent)] transition-colors hover:bg-[var(--onboarding-accent)]/20 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isLast ? "분석 시작" : "다음"}
        </button>
      </div>
    </div>
  );
}
