"use client";

import { PERSONAS, type PersonaType } from "@/data/personas";

interface PersonaResultCardProps {
  personaType: PersonaType;
}

export function PersonaResultCard({ personaType }: PersonaResultCardProps) {
  const persona = PERSONAS[personaType];

  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <div className="space-y-3">
        <p className="text-sm text-[var(--onboarding-text-secondary)]">
          당신의 노마드 유형
        </p>
        <h1 className="font-serif text-3xl font-semibold text-[var(--onboarding-accent)]">
          {persona.label}
        </h1>
        <p className="font-serif text-base text-[var(--onboarding-text-primary)]">
          {persona.description}
        </p>
      </div>

      <div className="w-full space-y-3">
        {persona.traits.map((trait, i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--onboarding-card-border)] bg-[var(--onboarding-card-bg)] px-4 py-3 text-center font-serif text-sm text-[var(--onboarding-text-primary)]"
          >
            {trait}
          </div>
        ))}
      </div>
    </div>
  );
}
