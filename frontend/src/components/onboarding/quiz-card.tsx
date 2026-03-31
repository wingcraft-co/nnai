"use client";

import type { QuizQuestion } from "@/data/quiz-questions";

interface QuizCardProps {
  question: QuizQuestion;
  onSelect: (value: string) => void;
}

export function QuizCard({ question, onSelect }: QuizCardProps) {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-serif text-xl font-medium leading-relaxed text-[var(--onboarding-text-primary)]">
        {question.question}
      </h2>
      <div className="grid gap-3">
        {question.options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            className="w-full rounded-lg border border-[var(--onboarding-card-border)] bg-[var(--onboarding-card-bg)] px-4 py-3.5 text-left font-serif text-sm text-[var(--onboarding-text-secondary)] transition-colors hover:border-[var(--onboarding-card-border-active)] hover:bg-[var(--onboarding-card-bg-active)] hover:text-[var(--onboarding-text-primary)]"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
