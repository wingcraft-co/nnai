"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { calculatePersona, calculatePersonaVector } from "@/data/quiz-questions";
import type { PersonaType } from "@/data/personas";
import { House } from "lucide-react";
import { QuizCard } from "@/components/onboarding/quiz-card";
import { ProgressBar } from "@/components/onboarding/progress-bar";
import { getOnboardingCopy } from "@/lib/onboarding-content";
import { clearServerOnboardingQuizDraft } from "@/lib/onboarding-draft-sync.mjs";
import {
  buildQuizSelectionDebugPayload,
  type QuizSelectionDebugInput,
} from "@/lib/onboarding-quiz-debug";
import {
  clearOnboardingQuizDraft,
  readOnboardingQuizDraft,
  writeOnboardingQuizDraft,
} from "@/lib/onboarding-quiz-draft";
import { isDebugMode } from "@/lib/runtime-locale.mjs";
import {
  trackFormAbandon,
  trackOnboardingStepDwell,
  trackQuizComplete,
} from "@/lib/analytics/events";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";
const IS_DEBUG = isDebugMode(process.env.NEXT_PUBLIC_DEBUG_MODE);

function logQuizSelectionDebug(input: QuizSelectionDebugInput) {
  if (!IS_DEBUG) return;

  const payload = buildQuizSelectionDebugPayload(input);
  console.info(
    `[NNAI quiz] ${payload.questionNumber}/${payload.totalQuestions} selected #${payload.selectedAnswerIndex}: "${payload.selectedAnswerLabel}" -> ${payload.selectedPersona}, next=${payload.nextQuestionNumber ?? "result"}`,
    payload
  );
}

export default function QuizPage() {
  const locale = useLocale();
  const router = useRouter();
  const copy = getOnboardingCopy(locale);
  const quizQuestions = copy.quiz.questions;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<PersonaType[]>([]);
  const [answerIndices, setAnswerIndices] = useState<number[]>([]);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);
  const previousStepRef = useRef<number | null>(null);
  const stepEnteredAtRef = useRef<number | null>(null);
  const currentStepRef = useRef(1);
  const completedRef = useRef(false);

  const currentQuestion = quizQuestions[currentIndex];

  useEffect(() => {
    const draft = readOnboardingQuizDraft(localStorage);
    if (!draft) return;

    const maxIndex = Math.max(quizQuestions.length - 1, 0);
    queueMicrotask(() => {
      setAnswers(draft.answers.slice(0, quizQuestions.length));
      setAnswerIndices(draft.answerIndices.slice(0, quizQuestions.length));
      setCurrentIndex(Math.min(draft.currentIndex, maxIndex));
      setSelectedAnswerIndex(draft.answerIndices[Math.min(draft.currentIndex, maxIndex)] ?? null);
    });
  }, [quizQuestions.length]);

  useEffect(() => {
    const stepNumber = currentIndex + 1;
    const now = Date.now();
    const previousStep = previousStepRef.current;

    if (stepEnteredAtRef.current === null) {
      stepEnteredAtRef.current = now;
    }

    if (previousStep !== null && previousStep !== stepNumber) {
      trackOnboardingStepDwell({
        flow: "quiz",
        stepNumber: previousStep,
        durationMs: now - stepEnteredAtRef.current,
      });
      stepEnteredAtRef.current = now;
    }

    previousStepRef.current = stepNumber;
    currentStepRef.current = stepNumber;
  }, [currentIndex]);

  useEffect(() => {
    return () => {
      if (completedRef.current) return;

      trackOnboardingStepDwell({
        flow: "quiz",
        stepNumber: currentStepRef.current,
        durationMs: Date.now() - (stepEnteredAtRef.current ?? Date.now()),
      });
      trackFormAbandon({
        flow: "quiz",
        stepNumber: currentStepRef.current,
      });
    };
  }, []);

  function handleSelect(answerIndex: number) {
    setSelectedAnswerIndex(answerIndex);

    const selectedOption = currentQuestion.options[answerIndex];
    const newAnswers = [
      ...answers.slice(0, currentIndex),
      selectedOption.persona,
    ];
    const newAnswerIndices = [
      ...answerIndices.slice(0, currentIndex),
      answerIndex,
    ];
    setAnswers(newAnswers);
    setAnswerIndices(newAnswerIndices);

    if (currentIndex < quizQuestions.length - 1) {
      const nextIndex = currentIndex + 1;
      logQuizSelectionDebug({
        locale,
        currentIndex,
        totalQuestions: quizQuestions.length,
        question: currentQuestion.question,
        selectedAnswerIndex: answerIndex,
        selectedAnswerLabel: selectedOption.label,
        selectedPersona: selectedOption.persona,
        nextIndex,
        answers: newAnswers,
        answerIndices: newAnswerIndices,
      });
      writeOnboardingQuizDraft(localStorage, {
        currentIndex: nextIndex,
        answers: newAnswers,
        answerIndices: newAnswerIndices,
      });
      setCurrentIndex(nextIndex);
      setSelectedAnswerIndex(newAnswerIndices[nextIndex] ?? null);
    } else {
      logQuizSelectionDebug({
        locale,
        currentIndex,
        totalQuestions: quizQuestions.length,
        question: currentQuestion.question,
        selectedAnswerIndex: answerIndex,
        selectedAnswerLabel: selectedOption.label,
        selectedPersona: selectedOption.persona,
        nextIndex: null,
        answers: newAnswers,
        answerIndices: newAnswerIndices,
      });
      writeOnboardingQuizDraft(localStorage, {
        currentIndex,
        answers: newAnswers,
        answerIndices: newAnswerIndices,
      });
      const persona = calculatePersona(newAnswers);
      const personaVector = calculatePersonaVector(newAnswers);
      completedRef.current = true;
      trackQuizComplete(persona);
      try {
        localStorage.setItem("persona_type", persona);
        localStorage.setItem("persona_vector", JSON.stringify(personaVector));
      } catch {
        // Persona persistence is best-effort; navigation should still complete.
      }
      clearOnboardingQuizDraft(localStorage);
      void clearServerOnboardingQuizDraft({ apiBase: API_BASE }).catch(() => undefined);
      router.push("/onboarding/quiz/result");
    }
  }

  function handleBack() {
    if (currentIndex > 0) {
      const previousIndex = currentIndex - 1;
      const previousAnswers = answers.slice(0, currentIndex);
      const previousAnswerIndices = answerIndices.slice(0, currentIndex);
      setAnswers(previousAnswers);
      setAnswerIndices(previousAnswerIndices);
      setCurrentIndex(previousIndex);
      setSelectedAnswerIndex(previousAnswerIndices[previousIndex] ?? null);
      writeOnboardingQuizDraft(localStorage, {
        currentIndex: previousIndex,
        answers: previousAnswers,
        answerIndices: previousAnswerIndices,
      });
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm w-full flex-col">
      <div className="flex items-center gap-3 pt-6 px-4">
        {currentIndex === 0 ? (
          <button
            type="button"
            onClick={() => router.push("/?nav=home")}
            className="shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
          >
            <House className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleBack}
            className="shrink-0 cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {copy.form.navigation.back}
          </button>
        )}
        <ProgressBar current={currentIndex + 1} total={quizQuestions.length} />
      </div>
      <div className="flex flex-1 flex-col justify-start pt-24 px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={currentIndex === 0 ? false : { opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.35 } }}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
          >
            <QuizCard
              question={currentQuestion.question}
              options={currentQuestion.options.map((o) => o.label)}
              onSelect={handleSelect}
              selectedIndex={selectedAnswerIndex}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
