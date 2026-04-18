"use client";

import { openAnalyticsSettings } from "@/lib/analytics/consent";

type AnalyticsSettingsButtonProps = {
  label: string;
  className?: string;
};

export function AnalyticsSettingsButton({
  label,
  className,
}: AnalyticsSettingsButtonProps) {
  return (
    <button
      type="button"
      onClick={openAnalyticsSettings}
      className={className}
    >
      {label}
    </button>
  );
}
