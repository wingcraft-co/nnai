"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { NomadJourneyModal } from "@/components/journey/NomadJourneyModal";
import { trackLandingCtaClick, trackQuizStart } from "@/lib/analytics/events";
import { DEV_PREVIEW_PAYLOAD, type DevPreviewPlan } from "@/lib/dev-preview";
import { isDebugMode } from "@/lib/runtime-locale.mjs";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";
const IS_DEBUG = isDebugMode(process.env.NEXT_PUBLIC_DEBUG_MODE);

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const, delay } },
});

export default function Home() {
  const locale = useLocale();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const isEn = locale === "en";
  const copy = isEn
    ? {
        journeyLabel: "Open nomad journey map",
        title: "What kind of nomad are you?",
        subtitle: (
          <>
            Take a 5-minute type test,<br />then meet the cities that fit you.
          </>
        ),
        quizCta: "Find my type",
        formCta: "Get city recommendations",
        hint: "Recommendations get sharper after the type test",
        cardPreview: "Preview card flow",
        postLoginFlow: "Post-login flow",
      }
    : {
        journeyLabel: "노마드 여정 지도 열기",
        title: "나는 어떤 노마드일까?",
        subtitle: (
          <>
            5분 유형 테스트로 내 유형을 찾고,<br />나에게 맞는 도시를 만나보세요.
          </>
        ),
        quizCta: "내 유형 찾아보기",
        formCta: "도시 추천 바로 받기",
        hint: "유형 테스트를 먼저 하면 추천이 더 정확해져요",
        cardPreview: "카드 플로우 미리보기",
        postLoginFlow: "로그인 후 플로우",
      };

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
      <div className="flex min-h-full flex-1 items-center justify-center">
        <div className="size-8 animate-pulse rounded-full bg-primary/20" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full max-w-sm w-full flex-col items-center justify-center px-4">
      {/* 지구본 */}
      <motion.div {...fadeUp(0.2)} className="mb-6">
        <button
          type="button"
          onClick={() => setJourneyOpen(true)}
          aria-label={copy.journeyLabel}
          className="block transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <img src="/earth_web.gif" alt="" width={96} height={96} className="mx-auto" />
        </button>
      </motion.div>

      {/* 헤드라인 */}
      <motion.div {...fadeUp(0.4)} className="text-center mb-8">
        <h1 className="text-2xl font-bold text-foreground leading-snug mb-3">
          {copy.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {copy.subtitle}
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
            {copy.quizCta}
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
            {copy.formCta}
          </Link>
          <p className="text-xs text-muted-foreground text-center mt-2 opacity-50">
            {copy.hint}
          </p>
        </motion.div>

        {IS_DEBUG && (
          <>
            {/* Demo: skip form, go straight to card flow */}
            <motion.div {...fadeUp(1.0)}>
              <button
                type="button"
                onClick={() => {
                  trackLandingCtaClick("preview");
                  localStorage.setItem("recommend_payload", JSON.stringify(DEV_PREVIEW_PAYLOAD));
                  window.location.href = `/${locale}/result`;
                }}
                className="block w-full py-2.5 text-center text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                {copy.cardPreview}
              </button>
            </motion.div>

            {/* Dev: post-login flow preview (Free / Pro 토글) */}
            <motion.div {...fadeUp(1.1)}>
              <div className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground/40">
                <span className="uppercase tracking-widest">{copy.postLoginFlow}</span>
                {(["free", "pro"] as const).map((plan: DevPreviewPlan) => (
                  <button
                    key={plan}
                    type="button"
                    onClick={() => {
                      localStorage.setItem("recommend_payload", JSON.stringify(DEV_PREVIEW_PAYLOAD));
                      window.location.href = `/${locale}/result?dev_preview=1&plan=${plan}`;
                    }}
                    className="hover:text-muted-foreground transition-colors uppercase tracking-widest"
                  >
                    {plan}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </div>
      <NomadJourneyModal open={journeyOpen} onClose={() => setJourneyOpen(false)} />
    </div>
  );
}
