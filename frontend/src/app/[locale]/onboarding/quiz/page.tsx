"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { QUIZ_QUESTIONS, calculatePersona } from "@/data/quiz-questions";
import type { PersonaType } from "@/data/personas";
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
      sessionStorage.setItem("persona_type", persona);
      router.push("/onboarding/quiz/result");
    }
  }

  return (
    <div className="flex min-h-dvh flex-col px-5 py-8">
      <ProgressBar current={currentIndex + 1} total={QUIZ_QUESTIONS.length} />
      <div className="flex flex-1 items-center">
        <div className="w-full">
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
    </div>
  );
}
