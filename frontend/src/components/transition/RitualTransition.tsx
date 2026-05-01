"use client";

/**
 * RitualTransition — 페이지 mount 시 짧은 black overlay가 fade-out.
 *
 * /result 진입: dark 페이지 위 black overlay가 사라지며 "무대 조명 켜짐" 느낌.
 * /dashboard 진입: light 페이지 위 black overlay가 사라지며 "어둠이 걷힘" 느낌.
 *
 * 같은 컴포넌트 / 같은 모션이지만 페이지 톤에 따라 의미가 갈림.
 */
export function RitualTransition() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        pointerEvents: "none",
        background: "#000",
        opacity: 1,
        animation: "ritual-transition-fade 600ms ease-out 50ms forwards",
      }}
    />
  );
}
