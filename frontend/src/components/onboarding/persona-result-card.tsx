"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { PersonaType } from "@/data/personas";
import { getOnboardingCopy } from "@/lib/onboarding-content";

const personaGif: Record<PersonaType, string> = {
  wanderer: "/wanderer.gif",
  local: "/local.gif",
  planner: "/planner.gif",
  free_spirit: "/free_spirit.gif",
  pioneer: "/pioneer.gif",
};

interface PersonaResultCardProps {
  locale: string;
  personaType: PersonaType;
  onFindCountry: () => void;
  onRetry: () => void;
}

export function PersonaResultCard({ locale, personaType, onFindCountry, onRetry }: PersonaResultCardProps) {
  const copy = getOnboardingCopy(locale);
  const persona = copy.result.personas[personaType];
  const showMascotLine = !["wanderer", "local", "pioneer"].includes(personaType);

  const fadeUp = (delay: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const, delay } },
  });

  const sections = [
    { label: copy.result.sections.city, lines: persona.city, delay: 0.3 },
    { label: copy.result.sections.work, lines: persona.work, delay: 0.6 },
    { label: copy.result.sections.moment, lines: persona.moment, delay: 0.9 },
    { label: copy.result.sections.value, lines: persona.value, delay: 1.2 },
  ];

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-8 px-4 py-12">
      {/* 헤더 */}
      <motion.div {...fadeUp(0)}>
        <p className="text-base text-muted-foreground mb-1">
          {copy.result.headerPrefix}
        </p>
        <div className="flex items-end justify-between mb-8">
          <h1 className="text-4xl font-bold text-primary">
            {persona.label}
          </h1>
          <div className="relative shrink-0" style={{ width: 36, height: 36 }}>
            <Image
              src={personaGif[personaType]}
              alt={persona.label}
              width={36}
              height={36}
              unoptimized
            />
            {showMascotLine && (
              <div className="absolute bottom-0 h-px bg-border" style={{ right: 0, width: 72 }} />
            )}
          </div>
        </div>
        <div className="space-y-1">
          {persona.description.map((line, i) => (
            <p key={i} className="text-sm text-muted-foreground leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      </motion.div>

      {/* 축 카드 */}
      <div className="flex flex-col gap-5">
        {sections.map((section) => (
          <motion.div
            key={section.label}
            {...fadeUp(section.delay)}
            className="rounded-lg border border-border border-l-4 border-l-primary bg-card p-5 pl-4"
          >
            <p className="text-sm font-semibold text-primary tracking-wide mb-3">
              {section.label}
            </p>
            <div className="space-y-1">
              {section.lines.map((line, i) => (
                <p key={i} className="text-sm text-foreground leading-relaxed">
                  {line}
                </p>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* CTA */}
      <motion.div {...fadeUp(1.5)} className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onFindCountry}
          className="w-full cursor-pointer rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {copy.result.actions.findCountry}
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="w-full cursor-pointer py-1.5 text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground"
        >
          {copy.result.actions.retry}
        </button>
      </motion.div>
    </div>
  );
}
