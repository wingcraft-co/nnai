import type { PersonaType } from "./personas";
import { getOnboardingCopy, type OnboardingQuizQuestion } from "@/lib/onboarding-content";

export type QuizOption = OnboardingQuizQuestion["options"][number];
export type QuizQuestion = OnboardingQuizQuestion;

export const QUIZ_QUESTIONS: QuizQuestion[] = getOnboardingCopy("ko").quiz.questions;

export type PersonaVector = Record<PersonaType, number>;

export function calculatePersonaVector(answers: PersonaType[]): PersonaVector {
  const counts: Record<PersonaType, number> = {
    wanderer: 0, local: 0, planner: 0, free_spirit: 0, pioneer: 0,
  };
  for (const answer of answers) {
    counts[answer]++;
  }
  const total = answers.length || 1;
  return {
    wanderer: counts.wanderer / total,
    local: counts.local / total,
    planner: counts.planner / total,
    free_spirit: counts.free_spirit / total,
    pioneer: counts.pioneer / total,
  };
}

export function calculatePersona(answers: PersonaType[]): PersonaType {
  const scores: Record<PersonaType, number> = {
    wanderer: 0,
    local: 0,
    planner: 0,
    free_spirit: 0,
    pioneer: 0,
  };

  for (const answer of answers) {
    scores[answer]++;
  }

  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0] as PersonaType;
}
