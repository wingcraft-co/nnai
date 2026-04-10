"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { QUIZ_QUESTIONS, calculatePersona } from "@/data/quiz-questions";
import type { PersonaType } from "@/data/personas";
import { House } from "lucide-react";
import { QuizCard } from "@/components/onboarding/quiz-card";
import { ProgressBar } from "@/components/onboarding/progress-bar";

export default function QuizPage() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<PersonaType[]>([]);

  const currentQuestion = QUIZ_QUESTIONS[currentIndex];

  function handleSelect(answerIndex: number) {
    const newAnswers = [...answers, currentQuestion.options[answerIndex].persona];
    setAnswers(newAnswers);

    if (currentIndex < QUIZ_QUESTIONS.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      const persona = calculatePersona(newAnswers);
      localStorage.setItem("persona_type", persona);
      router.push("/onboarding/quiz/result");
    }
  }

  function handleBack() {
    if (currentIndex > 0) {
      setAnswers(answers.slice(0, -1));
      setCurrentIndex(currentIndex - 1);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm w-full flex-col">
      <div className="flex items-center gap-3 pt-6 px-4">
        {currentIndex === 0 ? (
          <button
            type="button"
            onClick={() => router.push("/")}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          >
            <House className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleBack}
            className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            이전
          </button>
        )}
        <ProgressBar current={currentIndex + 1} total={QUIZ_QUESTIONS.length} />
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
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
