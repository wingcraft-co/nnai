"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QUIZ_QUESTIONS, calculatePersona } from "@/data/quiz-questions";
import { QuizCard } from "@/components/onboarding/quiz-card";
import { ProgressBar } from "@/components/onboarding/progress-bar";

export default function QuizPage() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);

  const totalQuestions = QUIZ_QUESTIONS.length;
  const currentQuestion = QUIZ_QUESTIONS[currentIndex];

  function handleSelect(value: string) {
    const newAnswers = [...answers, value];
    setAnswers(newAnswers);

    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      const persona = calculatePersona(newAnswers);
      sessionStorage.setItem("persona_type", persona);
      router.push("/onboarding/quiz/result");
    }
  }

  if (!currentQuestion) return null;

  return (
    <div className="flex min-h-dvh flex-col px-5 py-8">
      <ProgressBar current={currentIndex + 1} total={totalQuestions} />
      <div className="flex flex-1 items-center">
        <div className="w-full">
          <QuizCard question={currentQuestion} onSelect={handleSelect} />
        </div>
      </div>
    </div>
  );
}
