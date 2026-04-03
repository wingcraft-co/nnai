import type { PersonaType } from "./personas";

export interface QuizOption {
  label: string;
  value: string;
  persona: PersonaType;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: QuizOption[];
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: "어느 날 갑자기 떠나고 싶은 생각이 들었어.\n그 순간 떠오른 건?",
    options: [
      { label: "비행기가 곧 이륙할거야", value: "A", persona: "schengen_loop" },
      { label: "외국인 친구들과 어울리는 내 모습", value: "B", persona: "slow_nomad" },
      { label: "글쎄, 일단 계획부터 세워야지", value: "C", persona: "fire_optimizer" },
      { label: "내 삶이 달라질 것 같아", value: "D", persona: "burnout_escape" },
      { label: "이제 한국은 돌아오지 않을거야", value: "E", persona: "expat_freedom" },
    ],
  },
  {
    id: 2,
    question: "숙소 체크인 완료.\n가방을 내려놓고 제일 먼저 할 일은?",
    options: [
      { label: "일단 나가서 뭐가 있는지 볼래", value: "A", persona: "schengen_loop" },
      { label: "동네 마트 먼저 가볼거야", value: "B", persona: "slow_nomad" },
      { label: "유심 구매하고 환전부터 해야해", value: "C", persona: "fire_optimizer" },
      { label: "창문 열고 바깥 풍경부터 볼래", value: "D", persona: "burnout_escape" },
      { label: "현지 식당 찾아서 로컬 음식 먹을거야", value: "E", persona: "expat_freedom" },
    ],
  },
  {
    id: 3,
    question: "노마드 시작 첫 날이야.\n오늘 아침에 뭘 하고 싶어?",
    options: [
      { label: "느긋하게 브런치 먹으러 갈거야", value: "A", persona: "burnout_escape" },
      { label: "미라클 모닝. 일어나서 운동부터 해야지", value: "B", persona: "expat_freedom" },
      { label: "미리 찾아둔 장소에 가볼거야", value: "C", persona: "schengen_loop" },
      { label: "짐 정리하고 밀린 일을 먼저 해치울래", value: "D", persona: "fire_optimizer" },
      { label: "골목 골목 동네를 둘러볼래", value: "E", persona: "slow_nomad" },
    ],
  },
  {
    id: 4,
    question: "노마드 생활 중 문제가 생겼어.\n피하고 싶은 최악의 상황은?",
    options: [
      { label: "바닥이 보이는 통장 잔고", value: "A", persona: "fire_optimizer" },
      { label: "내일이 비자 만료 하루 전날", value: "B", persona: "schengen_loop" },
      { label: "현지에서 당하는 인종차별", value: "C", persona: "slow_nomad" },
      { label: "이룬 것 없이 한국으로 가야할 때", value: "D", persona: "expat_freedom" },
      { label: "번아웃이 와버린 나 자신", value: "E", persona: "burnout_escape" },
    ],
  },
  {
    id: 5,
    question: "어느덧 노마드 6개월차,\n요즘 자주 하는 생각은?",
    options: [
      { label: "벌써 떠나야해? 아직 아쉬운데", value: "A", persona: "slow_nomad" },
      { label: "나 요즘 너무 행복한 것 같아", value: "B", persona: "burnout_escape" },
      { label: "여기 살아도 되겠는데?", value: "C", persona: "expat_freedom" },
      { label: "이제 여기도 떠날때가 된 것 같아", value: "D", persona: "schengen_loop" },
      { label: "내 계획대로 잘 지내고 있어", value: "E", persona: "fire_optimizer" },
    ],
  },
  {
    id: 6,
    question: "드디어 내 최애 도시 발견!\n이제 어떻게 할래?",
    options: [
      { label: "영주권 알아볼거야. 진지하게", value: "A", persona: "expat_freedom" },
      { label: "현지 시장 조사를 할거야", value: "B", persona: "fire_optimizer" },
      { label: "이 도시를 마음껏 즐겨볼래", value: "C", persona: "burnout_escape" },
      { label: "부동산 먼저 알아볼래", value: "D", persona: "slow_nomad" },
      { label: "그래도 더 좋은데가 있을걸?", value: "E", persona: "schengen_loop" },
    ],
  },
  {
    id: 7,
    question: "지금 이 순간,\n너한테 가장 끌리는 단어는?",
    options: [
      { label: "자유", value: "A", persona: "schengen_loop" },
      { label: "우정", value: "B", persona: "slow_nomad" },
      { label: "안정", value: "C", persona: "fire_optimizer" },
      { label: "행복", value: "D", persona: "burnout_escape" },
      { label: "의지", value: "E", persona: "expat_freedom" },
    ],
  },
];

export function calculatePersona(answers: PersonaType[]): PersonaType {
  const scores: Record<PersonaType, number> = {
    schengen_loop: 0,
    slow_nomad: 0,
    fire_optimizer: 0,
    burnout_escape: 0,
    expat_freedom: 0,
  };

  for (const answer of answers) {
    scores[answer]++;
  }

  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0] as PersonaType;
}
