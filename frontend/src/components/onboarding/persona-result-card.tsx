"use client";

import { motion } from "framer-motion";
import { PERSONAS, type PersonaType } from "@/data/personas";

interface PersonaResultCardProps {
  personaType: PersonaType;
}

export function PersonaResultCard({ personaType }: PersonaResultCardProps) {
  const persona = PERSONAS[personaType];

  const sections = [
    { label: "이런 도시가 어울려요", content: persona.city },
    { label: "이렇게 일해요", content: persona.work },
    { label: "당신에게 중요한 건", content: persona.value },
    { label: "이런 순간이 행복해요", content: persona.moment },
  ].filter((s) => s.content && s.content !== "TBD");

  const fadeUp = (delay: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const, delay } },
  });

  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <motion.div className="space-y-3" {...fadeUp(0)}>
        <p className="text-sm text-[var(--onboarding-text-secondary)]">
          당신은
        </p>
        <h1 className="font-serif text-3xl font-semibold text-[var(--onboarding-accent)]">
          {persona.label}
        </h1>
        <p className="font-serif text-sm text-[var(--onboarding-text-secondary)] leading-relaxed">
          {persona.description}
        </p>
      </motion.div>

      <div className="w-full space-y-3">
        {sections.map((section, i) => (
          <motion.div
            key={section.label}
            {...fadeUp(0.3 + i * 0.3)}
            className="rounded-lg border border-[var(--onboarding-card-border)] bg-[var(--onboarding-card-bg)] px-4 py-4 text-left"
          >
            <p className="text-xs text-[var(--onboarding-accent)] mb-2">
              {section.label}
            </p>
            <p className="font-serif text-sm text-[var(--onboarding-text-primary)] leading-relaxed">
              {section.content}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
