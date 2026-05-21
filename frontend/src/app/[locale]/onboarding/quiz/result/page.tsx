"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { PersonaType } from "@/data/personas";
import { PersonaResultCard } from "@/components/onboarding/persona-result-card";

function subscribePersonaStore() {
  return () => {};
}

function getStoredPersona() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("persona_type") as PersonaType | null;
}

function getServerPersona() {
  return null;
}

export default function QuizResultPage() {
  const locale = useLocale();
  const router = useRouter();
  const personaType = useSyncExternalStore(subscribePersonaStore, getStoredPersona, getServerPersona);

  useEffect(() => {
    if (!personaType) {
      router.replace("/onboarding/quiz");
    }
  }, [personaType, router]);

  if (!personaType) return null;

  function handleRetry() {
    localStorage.removeItem("persona_type");
    router.push("/onboarding/quiz");
  }

  return (
    <PersonaResultCard
      locale={locale}
      personaType={personaType}
      onFindCountry={() => router.push("/onboarding/form")}
      onRetry={handleRetry}
    />
  );
}
