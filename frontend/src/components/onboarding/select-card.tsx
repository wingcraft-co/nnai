"use client";

import { cn } from "@/lib/utils";

interface SelectCardProps {
  options: { label: string; value: string }[];
  selected: string | string[];
  onSelect: (value: string) => void;
  mode: "single" | "multi";
  maxSelect?: number;
}

export function SelectCard({
  options,
  selected,
  onSelect,
  mode,
  maxSelect,
}: SelectCardProps) {
  const selectedArr = Array.isArray(selected) ? selected : selected ? [selected] : [];

  function handleSelect(value: string) {
    if (mode === "single") {
      onSelect(value);
      return;
    }
    const isSelected = selectedArr.includes(value);
    if (isSelected) {
      onSelect(value);
      return;
    }
    if (maxSelect && selectedArr.length >= maxSelect) return;
    onSelect(value);
  }

  return (
    <div className="grid gap-3">
      {options.map((option) => {
        const isActive = selectedArr.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleSelect(option.value)}
            className={cn(
              "w-full rounded-lg border px-4 py-3.5 text-left text-sm font-medium transition-colors",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-muted text-foreground hover:bg-accent"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
