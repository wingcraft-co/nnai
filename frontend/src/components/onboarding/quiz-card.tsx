"use client";

import { useState } from "react";

interface QuizCardProps {
  question: string;
  options: string[];
  onSelect: (answerIndex: number) => void;
}

export function QuizCard({ question, options, onSelect }: QuizCardProps) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="flex flex-col">
      <h2 className="whitespace-pre-line text-xl font-medium leading-relaxed text-foreground mb-8">
        {question}
      </h2>
      <div className="grid gap-3">
        {options.map((option, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              setSelected(i);
              onSelect(i);
            }}
            className={`w-full rounded-lg px-4 py-4 text-left text-sm font-medium transition-colors ${
              selected === i
                ? "bg-primary/10 border border-primary text-primary"
                : "bg-muted text-foreground hover:bg-accent"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
