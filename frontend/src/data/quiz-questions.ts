import type { PersonaType } from "./personas";

export interface QuizOption {
  label: string;
  value: string;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: QuizOption[];
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: "노마드를 생각하게 된 가장 큰 이유는?",
    options: [
      { label: "자유롭게 여러 나라를 다니고 싶어서", value: "A" },
      { label: "한 곳에 오래 머물며 깊이 살아보고 싶어서", value: "B" },
      { label: "생활비를 줄이고 삶의 질을 높이고 싶어서", value: "C" },
      { label: "지금 환경에서 벗어나 쉬고 싶어서", value: "D" },
    ],
  },
  {
    id: 2,
    question: "이상적인 체류 기간은?",
    options: [
      { label: "1~2개월씩 자주 이동", value: "A" },
      { label: "3~6개월 한 도시에 정착", value: "B" },
      { label: "6개월 이상 깊이 체류", value: "C" },
      { label: "기간보다 비용이 중요", value: "D" },
    ],
  },
  {
    id: 3,
    question: "가장 중요하게 생각하는 조건은?",
    options: [
      { label: "비자 자유도와 이동 편의성", value: "A" },
      { label: "현지 커뮤니티와 문화 접근성", value: "B" },
      { label: "월 생활비 절감", value: "C" },
      { label: "자연환경과 느린 생활 페이스", value: "D" },
    ],
  },
  {
    id: 4,
    question: "어떤 환경에서 일할 때 가장 집중이 잘 되나요?",
    options: [
      { label: "카페나 코워킹 스페이스에서 사람들과 함께", value: "A" },
      { label: "조용한 숙소에서 혼자", value: "B" },
      { label: "비용 효율적인 공간이면 어디든", value: "C" },
      { label: "자연이 보이는 곳에서", value: "D" },
    ],
  },
  {
    id: 5,
    question: "노마드 생활에서 가장 걱정되는 점은?",
    options: [
      { label: "비자 기간 관리와 체류일 계산", value: "A" },
      { label: "외로움과 커뮤니티 부재", value: "B" },
      { label: "예산 초과와 생활비 관리", value: "C" },
      { label: "건강과 심리적 안정", value: "D" },
    ],
  },
  {
    id: 6,
    question: "유럽 체류 계획이 있나요?",
    options: [
      { label: "예, 쉥겐 90일 루트를 계획 중", value: "A" },
      { label: "유럽에 장기 정착하고 싶음", value: "B" },
      { label: "유럽보다 동남아/중남미 선호", value: "C" },
      { label: "아직 구체적 계획 없음", value: "D" },
    ],
  },
  {
    id: 7,
    question: "5년 후 이상적인 모습은?",
    options: [
      { label: "여러 나라에 거점을 두고 자유롭게 이동", value: "A" },
      { label: "마음에 드는 도시에서 영주권 취득", value: "B" },
      { label: "경제적 자유를 달성하고 원하는 곳에서 생활", value: "C" },
      { label: "번아웃 없이 건강한 라이프스타일 유지", value: "D" },
    ],
  },
];

export function calculatePersona(answers: string[]): PersonaType {
  const scores: Record<PersonaType, number> = {
    schengen_loop: 0,
    slow_nomad: 0,
    fire_optimizer: 0,
    burnout_escape: 0,
    expat_freedom: 0,
  };

  const ANSWER_MAP: Record<string, PersonaType> = {
    A: "schengen_loop",
    B: "slow_nomad",
    C: "fire_optimizer",
    D: "burnout_escape",
  };

  for (const answer of answers) {
    const persona = ANSWER_MAP[answer];
    if (persona) scores[persona]++;
  }

  // Q7 B(영주권) → expat_freedom 보정
  if (answers[6] === "B") scores.expat_freedom += 2;

  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0] as PersonaType;
}
