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
  clearOnboardingQuizDraft,
  readOnboardingQuizDraft,
  writeOnboardingQuizDraft,
} from "@/lib/onboarding-quiz-draft";
import {
  trackFormAbandon,
  trackOnboardingStepDwell,
  trackQuizComplete,
} from "@/lib/analytics/events";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";

export default function QuizPage() {
  const locale = useLocale();
  const router = useRouter();
  const copy = getOnboardingCopy(locale);
  const quizQuestions = copy.quiz.questions;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<PersonaType[]>([]);
  const [answerIndices, setAnswerIndices] = useState<number[]>([]);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const previousStepRef = useRef<number | null>(null);
  const stepEnteredAtRef = useRef<number | null>(null);
  const currentStepRef = useRef(1);
  const completedRef = useRef(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
      }
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
    if (isAdvancing) return;
    setSelectedAnswerIndex(answerIndex);
    setIsAdvancing(true);

    const newAnswers = [
      ...answers.slice(0, currentIndex),
      currentQuestion.options[answerIndex].persona,
    ];
    const newAnswerIndices = [
      ...answerIndices.slice(0, currentIndex),
      answerIndex,
    ];
    setAnswers(newAnswers);
    setAnswerIndices(newAnswerIndices);

    if (currentIndex < quizQuestions.length - 1) {
      const nextIndex = currentIndex + 1;
      writeOnboardingQuizDraft(localStorage, {
        currentIndex: nextIndex,
        answers: newAnswers,
        answerIndices: newAnswerIndices,
      });
      advanceTimerRef.current = setTimeout(() => {
        setCurrentIndex(nextIndex);
        setSelectedAnswerIndex(newAnswerIndices[nextIndex] ?? null);
        setIsAdvancing(false);
      }, 220);
    } else {
      writeOnboardingQuizDraft(localStorage, {
        currentIndex,
        answers: newAnswers,
        answerIndices: newAnswerIndices,
      });
      const persona = calculatePersona(newAnswers);
      const personaVector = calculatePersonaVector(newAnswers);
      advanceTimerRef.current = setTimeout(() => {
        completedRef.current = true;
        trackQuizComplete(persona);
        localStorage.setItem("persona_type", persona);
        localStorage.setItem("persona_vector", JSON.stringify(personaVector));
        clearOnboardingQuizDraft(localStorage);
        void clearServerOnboardingQuizDraft({ apiBase: API_BASE }).catch(() => undefined);
        router.push("/onboarding/quiz/result");
      }, 220);
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
      setIsAdvancing(false);
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
            onClick={() => router.push("/")}
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
              disabled={isAdvancing}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
