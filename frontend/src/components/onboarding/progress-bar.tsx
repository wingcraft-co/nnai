"use client";

interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
}

export function ProgressBar({ current, total, label }: ProgressBarProps) {
  const percentage = Math.round((current / total) * 100);

  return (
    <div className="w-full space-y-2">
      {label && (
        <p className="font-serif text-sm text-[var(--onboarding-text-secondary)]">
          {label}
        </p>
      )}
      <div className="flex items-center gap-3">
        <div className="h-1 flex-1 rounded-full bg-[var(--onboarding-progress-track)]">
          <div
            className="h-full rounded-full bg-[var(--onboarding-progress-fill)] transition-[width] duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="font-serif text-xs tabular-nums text-[var(--onboarding-text-secondary)]">
          {current} / {total}
        </span>
      </div>
    </div>
  );
}
