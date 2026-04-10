"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { PERSONAS, type PersonaType } from "@/data/personas";

const personaGif: Record<PersonaType, string> = {
  wanderer: "/wanderer.gif",
  local: "/local.gif",
  planner: "/planner.gif",
  free_spirit: "/free_spirit.gif",
  pioneer: "/pioneer.gif",
};

interface PersonaResultCardProps {
  personaType: PersonaType;
  onFindCountry: () => void;
  onRetry: () => void;
}

export function PersonaResultCard({ personaType, onFindCountry, onRetry }: PersonaResultCardProps) {
  const persona = PERSONAS[personaType];

  const fadeUp = (delay: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const, delay } },
  });

  const sections = [
    { label: "이런 도시가 어울려요", lines: persona.city, delay: 0.3 },
    { label: "이렇게 일해요", lines: persona.work, delay: 0.6 },
    { label: "이런 순간이 행복해요", lines: persona.moment, delay: 0.9 },
    { label: "당신에게 중요한 건", lines: persona.value, delay: 1.2 },
  ];

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-8 px-4 py-12">
      {/* 헤더 — 캐릭터 + 타이틀 */}
      <motion.div {...fadeUp(0)}>
        <div className="flex items-center gap-5 mb-6">
          <Image
            src={personaGif[personaType]}
            alt={persona.label}
            width={80}
            height={80}
            unoptimized
            className="shrink-0"
          />
          <div>
            <p className="text-sm text-muted-foreground mb-1">
              당신의 노마드 타입은,
            </p>
            <h1 className="text-3xl font-bold text-primary">
              {persona.label}
            </h1>
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
          className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          나에게 맞는 국가 찾으러 가기
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="w-full py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          처음부터 다시하기
        </button>
      </motion.div>
    </div>
  );
}
