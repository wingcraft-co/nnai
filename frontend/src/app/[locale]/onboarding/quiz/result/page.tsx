"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import type { PersonaType } from "@/data/personas";
import { PersonaResultCard } from "@/components/onboarding/persona-result-card";

export default function QuizResultPage() {
  const router = useRouter();
  const [personaType, setPersonaType] = useState<PersonaType | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("persona_type") as PersonaType | null;
    if (!stored) {
      router.replace("/onboarding/quiz");
      return;
    }
    setPersonaType(stored);
  }, [router]);

  if (!personaType) return null;

  function handleRetry() {
    localStorage.removeItem("persona_type");
    router.push("/onboarding/quiz");
  }

  return (
    <PersonaResultCard
      personaType={personaType}
      onFindCountry={() => router.push("/onboarding/form")}
      onRetry={handleRetry}
    />
  );
}
