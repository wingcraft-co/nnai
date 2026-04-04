"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const, delay } },
});

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm w-full flex-col items-center justify-center px-4">
      {/* 헤드라인 */}
      <motion.div {...fadeUp(0.4)} className="text-center mb-12">
        <h1 className="text-2xl font-bold text-foreground leading-snug mb-3">
          어떤 노마드가 될지,<br />같이 찾아볼게요.
        </h1>
        <p className="text-sm text-muted-foreground">
          도시 추천부터 비자, 예산까지 — AI가 설계해드립니다.
        </p>
      </motion.div>

      {/* CTA */}
      <div className="w-full space-y-4">
        <motion.div {...fadeUp(0.6)}>
          <Link
            href="/onboarding/quiz"
            className="block w-full bg-primary py-3.5 text-center text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            내 노마드 유형 알아보기
          </Link>
          <p className="text-xs text-muted-foreground text-center mt-2">
            처음이라면 여기서 시작하세요 · 5분 소요
          </p>
        </motion.div>

        <motion.div {...fadeUp(0.8)}>
          <Link
            href="/onboarding/form"
            className="block w-full border border-border py-3.5 text-center text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            도시 추천 바로 받기
          </Link>
          <p className="text-xs text-muted-foreground text-center mt-2">
            노마드 유형 없이 진행하면 조언이 제한될 수 있어요
          </p>
        </motion.div>
      </div>
    </div>
  );
}
