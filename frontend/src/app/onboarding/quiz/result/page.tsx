"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PersonaType } from "@/data/personas";
import { PersonaResultCard } from "@/components/onboarding/persona-result-card";

export default function QuizResultPage() {
  const router = useRouter();
  const [personaType, setPersonaType] = useState<PersonaType | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("persona_type") as PersonaType | null;
    if (!stored) {
      router.replace("/onboarding/quiz");
      return;
    }
    setPersonaType(stored);
  }, [router]);

  if (!personaType) return null;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-8">
      <PersonaResultCard personaType={personaType} />

      <div className="mt-10 flex w-full flex-col gap-3">
        <button
          type="button"
          onClick={() => router.push("/onboarding/form")}
          className="w-full rounded-lg border border-[var(--onboarding-accent)] bg-[var(--onboarding-accent-dim)] py-3.5 font-serif text-sm text-[var(--onboarding-accent)] transition-colors hover:bg-[var(--onboarding-accent)]/20"
        >
          나에게 맞는 국가 찾으러 가기
        </button>
        <button
          type="button"
          disabled
          className="w-full rounded-lg border border-[var(--onboarding-card-border)] py-3.5 font-serif text-sm text-[var(--onboarding-text-secondary)] opacity-40 cursor-not-allowed"
        >
          결과 공유하기 (준비 중)
        </button>
      </div>
    </div>
  );
}
