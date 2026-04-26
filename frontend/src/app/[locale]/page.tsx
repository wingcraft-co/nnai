"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter } from "@/i18n/navigation";
import { trackLandingCtaClick, trackQuizStart } from "@/lib/analytics/events";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const, delay } },
});

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkPlan() {
      try {
        const response = await fetch(`${API_BASE}/api/dashboard`, {
          cache: "no-store",
          credentials: "include",
        });
        if (response.ok) {
          const payload = await response.json();
          if (payload.plan) {
            router.replace("/dashboard");
            return;
          }
        }
      } catch {
        // ignore errors, show landing
      } finally {
        setChecking(false);
      }
    }
    checkPlan();
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="size-8 animate-pulse rounded-full bg-primary/20" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm w-full flex-col items-center justify-center px-4">
      {/* 지구본 */}
      <motion.div {...fadeUp(0.2)} className="mb-6">
        <img src="/earth_web.gif" alt="" width={96} height={96} className="mx-auto" />
      </motion.div>

      {/* 헤드라인 */}
      <motion.div {...fadeUp(0.4)} className="text-center mb-8">
        <h1 className="text-2xl font-bold text-foreground leading-snug mb-3">
          나는 어떤 노마드일까?
        </h1>
        <p className="text-sm text-muted-foreground">
          5분 유형 테스트로 내 유형을 찾고,<br />나에게 맞는 도시를 만나보세요.
        </p>
      </motion.div>

      {/* CTA */}
      <div className="w-full space-y-4">
        <motion.div {...fadeUp(0.6)}>
          <Link
            href="/onboarding/quiz"
            onClick={() => {
              trackLandingCtaClick("quiz");
              trackQuizStart("home");
            }}
            className="block w-full bg-primary py-3.5 text-center text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            내 유형 찾아보기
          </Link>
        </motion.div>

        <motion.div {...fadeUp(0.8)}>
          <Link
            href="/onboarding/form"
            onClick={() => {
              trackLandingCtaClick("form");
            }}
            className="block w-full border border-border py-3.5 text-center text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            도시 추천 바로 받기
          </Link>
          <p className="text-xs text-muted-foreground text-center mt-2 opacity-50">
            유형 테스트를 먼저 하면 추천이 더 정확해져요
          </p>
        </motion.div>

        {/* Demo: skip form, go straight to card flow */}
        <motion.div {...fadeUp(1.0)}>
          <button
            type="button"
            onClick={() => {
              trackLandingCtaClick("preview");
              localStorage.setItem("recommend_payload", JSON.stringify({
                nationality: "한국",
                income_krw: 400,
                immigration_purpose: "원격 근무",
                lifestyle: ["일하기 좋은 인프라"],
                languages: [],
                timeline: "6개월 중기 체류",
                preferred_countries: [],
                preferred_language: "한국어",
                persona_type: null,
                income_type: "",
                travel_type: "혼자 (솔로)",
                children_ages: null,
                dual_nationality: false,
                readiness_stage: "",
                has_spouse_income: "없음",
                spouse_income_krw: 0,
              }));
              window.location.href = "/result";
            }}
            className="block w-full py-2.5 text-center text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            카드 플로우 미리보기
          </button>
        </motion.div>
      </div>
    </div>
  );
}
