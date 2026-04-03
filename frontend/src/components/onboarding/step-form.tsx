"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ProgressBar } from "./progress-bar";

interface StepFormProps {
  currentStep: number;
  totalSteps: number;
  stepTitle: string;
  stepLabel: string;
  onNext: () => void;
  onBack: () => void;
  canProceed: boolean;
  isLoading?: boolean;
  error?: string | null;
  children: ReactNode;
}

export function StepForm({
  currentStep,
  totalSteps,
  stepTitle,
  stepLabel,
  onNext,
  onBack,
  canProceed,
  isLoading,
  error,
  children,
}: StepFormProps) {
  const t = useTranslations("common");
  const isLast = currentStep === totalSteps;
  const isFirst = currentStep === 1;

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm w-full flex-col px-4 py-8">
      <div className="space-y-4">
        <ProgressBar
          current={currentStep}
          total={totalSteps}
          label={`Step ${currentStep}: ${stepLabel}`}
        />
        <h1 className="text-xl font-medium text-foreground">
          {stepTitle}
        </h1>
      </div>

      <div className="flex-1 py-8">{children}</div>

      {error && (
        <p className="mb-3 text-center text-sm text-destructive">{error}</p>
      )}

      <div className="flex gap-3 pb-4">
        {!isFirst && (
          <button
            type="button"
            onClick={onBack}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-border py-3 text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground disabled:opacity-30"
          >
            {t("back")}
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={!canProceed || isLoading}
          className="flex-1 rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isLoading ? "분석 중..." : isLast ? t("startAnalysis") : t("next")}
        </button>
      </div>
    </div>
  );
}
