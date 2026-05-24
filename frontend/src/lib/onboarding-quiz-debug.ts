import type { PersonaType } from "@/data/personas";

export interface QuizSelectionDebugInput {
  locale: string;
  currentIndex: number;
  totalQuestions: number;
  question: string;
  selectedAnswerIndex: number;
  selectedAnswerLabel: string;
  selectedPersona: PersonaType;
  nextIndex: number | null;
  answers: PersonaType[];
  answerIndices: number[];
}

export interface QuizSelectionDebugPayload {
  event: "quiz_answer_selected";
  locale: string;
  questionNumber: number;
  totalQuestions: number;
  question: string;
  selectedAnswerIndex: number;
  selectedAnswerLabel: string;
  selectedPersona: PersonaType;
  nextIndex: number | null;
  nextQuestionNumber: number | null;
  answers: PersonaType[];
  answerIndices: number[];
}

export function buildQuizSelectionDebugPayload(
  input: QuizSelectionDebugInput
): QuizSelectionDebugPayload {
  return {
    event: "quiz_answer_selected",
    locale: input.locale,
    questionNumber: input.currentIndex + 1,
    totalQuestions: input.totalQuestions,
    question: input.question,
    selectedAnswerIndex: input.selectedAnswerIndex,
    selectedAnswerLabel: input.selectedAnswerLabel,
    selectedPersona: input.selectedPersona,
    nextIndex: input.nextIndex,
    nextQuestionNumber: input.nextIndex === null ? null : input.nextIndex + 1,
    answers: input.answers,
    answerIndices: input.answerIndices,
  };
}
