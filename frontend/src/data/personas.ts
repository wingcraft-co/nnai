export type PersonaType =
  | "schengen_loop"
  | "slow_nomad"
  | "fire_optimizer"
  | "burnout_escape"
  | "expat_freedom";

export interface Persona {
  label: string;
  description: string;
  traits: [string, string, string];
}

export const PERSONAS: Record<PersonaType, Persona> = {
  schengen_loop: {
    label: "쉥겐 루프형",
    description: "유럽을 자유롭게 누비는 루트 최적화 노마드",
    traits: [
      "90일 체류 패턴에 익숙함",
      "이동 자체를 즐김",
      "유럽 중심 라이프스타일",
    ],
  },
  slow_nomad: {
    label: "거점 정착형",
    description: "한 도시에 깊이 스며드는 롱텀 노마드",
    traits: [
      "6개월 이상 한 곳에 체류",
      "현지 커뮤니티 중시",
      "장기비자 선호",
    ],
  },
  fire_optimizer: {
    label: "비용 최적화형",
    description: "적은 비용으로 높은 삶의 질을 설계하는 노마드",
    traits: [
      "월 $1,500 이하 생활 목표",
      "물가 대비 품질 최우선",
      "FIRE 지향",
    ],
  },
  burnout_escape: {
    label: "번아웃 탈출형",
    description: "자연과 느린 페이스로 회복을 찾는 노마드",
    traits: [
      "자연환경 우선",
      "심리적 회복이 목적",
      "느린 일상 지향",
    ],
  },
  expat_freedom: {
    label: "사회 이탈형",
    description: "영주권과 장기체류로 새로운 삶을 설계하는 노마드",
    traits: [
      "영주권 경로 탐색 중",
      "장기 체류 가능 도시 선호",
      "한국 외 거점 구축",
    ],
  },
};
