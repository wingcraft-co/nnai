"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { PersonaType } from "@/data/personas";
import { PERSONAS } from "@/data/personas";
import { ProgressBar } from "@/components/onboarding/progress-bar";
import { SelectCard } from "@/components/onboarding/select-card";

// ── Options ──────────────────────────────────────────────────────

const PURPOSE_OPTIONS = [
  { label: "원격 근무", value: "원격 근무" },
  { label: "프리랜서 활동", value: "프리랜서 활동" },
  { label: "온라인 비즈니스 운영", value: "온라인 비즈니스 운영" },
  { label: "장기 여행", value: "장기 여행" },
  { label: "은퇴 후 거주", value: "은퇴 후 거주" },
];

const TRAVEL_TYPE_OPTIONS = [
  { label: "혼자", value: "혼자 (솔로)" },
  { label: "배우자 동반", value: "배우자/파트너 동반" },
  { label: "자녀 동반", value: "자녀 동반 (배우자 없이)" },
  { label: "가족 전체 동반", value: "가족 전체 동반" },
];

const TIMELINE_OPTIONS = [
  { label: "1~3개월 단기 체류", value: "1~3개월 단기 체류" },
  { label: "6개월 중기 체류", value: "6개월 중기 체류" },
  { label: "1년 장기 체류", value: "1년 장기 체류" },
  { label: "영주권/이민 목표", value: "영주권/이민 목표" },
];

const STAY_STYLE_OPTIONS = [
  { label: "한 도시에 오래 머물기", value: "정착형" },
  { label: "2~3개 도시 순환하기", value: "순환형" },
  { label: "여러 나라 자유롭게 이동하기", value: "이동형" },
];

const INCOME_RANGE_OPTIONS = [
  { label: "200 이하", value: "150" },
  { label: "200~300", value: "250" },
  { label: "300~500", value: "400" },
  { label: "500~700", value: "600" },
  { label: "700 이상", value: "800" },
  { label: "비공개", value: "0" },
];

const TAX_SENSITIVITY_OPTIONS = [
  { label: "세금 혜택이 중요해요", value: "optimize" },
  { label: "크게 중요하지 않아요", value: "simple" },
  { label: "잘 모르겠어요", value: "unknown" },
];

const SPOUSE_INCOME_OPTIONS = [
  { label: "없음", value: "없음" },
  { label: "있음", value: "있음" },
];

const CHILDREN_AGE_OPTIONS = [
  { label: "영아 (0~2세)", value: "0~2" },
  { label: "미취학 (3~6세)", value: "3~6" },
  { label: "초등 (7~12세)", value: "7~12" },
  { label: "중고등 (13~18세)", value: "13~18" },
];

const REGION_OPTIONS = [
  { label: "아시아", value: "아시아" },
  { label: "유럽", value: "유럽" },
  { label: "중남미", value: "중남미" },
  { label: "중동/아프리카", value: "중동/아프리카" },
  { label: "북미", value: "북미" },
];

const LIFESTYLE_OPTIONS = [
  { label: "일하기 좋은 인프라", value: "일하기 좋은 인프라" },
  { label: "한인 커뮤니티 활성화", value: "한인 커뮤니티 활성화" },
  { label: "저렴한 물가와 생활비", value: "저렴한 물가와 생활비" },
  { label: "영어로 생활 가능", value: "영어로 생활 가능" },
];

// ── Types ────────────────────────────────────────────────────────

interface FormData {
  immigration_purpose: string;
  travel_type: string;
  timeline: string;
  stay_style: string;
  income_range: string;
  tax_sensitivity: string;
  children_ages: string[];
  has_spouse_income: string;
  spouse_income_krw: number;
  preferred_countries: string[];
  lifestyle: string[];
}

const INITIAL_FORM: FormData = {
  immigration_purpose: "",
  travel_type: "",
  timeline: "",
  stay_style: "",
  income_range: "",
  tax_sensitivity: "",
  children_ages: [],
  has_spouse_income: "없음",
  spouse_income_krw: 0,
  preferred_countries: [],
  lifestyle: [],
};

const TOTAL_STEPS = 4;

const STEP_TITLES = [
  "어떤 노마드가 되고 싶나요?",
  "얼마나 머물 계획인가요?",
  "경제 상황을 알려주세요",
  "마지막으로 몇 가지만 더!",
];

const personaGif: Record<string, string> = {
  schengen_loop: "/wanderer.gif",
  slow_nomad: "/local.gif",
  fire_optimizer: "/planner.gif",
  burnout_escape: "/free_spirit.gif",
  expat_freedom: "/pioneer.gif",
};

// ── Helpers ──────────────────────────────────────────────────────

function hasChildren(travelType: string) {
  return travelType.includes("자녀") || travelType.includes("가족");
}

function hasSpouse(travelType: string) {
  return travelType.includes("배우자") || travelType.includes("가족") || travelType.includes("파트너");
}

const INPUT_CLASS =
  "w-full rounded-none border border-border bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-ring focus:outline-none";

// ── Component ────────────────────────────────────────────────────

export default function FormPage() {
  const router = useRouter();
  const [personaType, setPersonaType] = useState<PersonaType | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("persona_type") as PersonaType | null;
    setPersonaType(stored);
  }, []);

  const isShortStay = form.timeline === "1~3개월 단기 체류";

  function canProceed(): boolean {
    switch (currentStep) {
      case 1: return form.immigration_purpose !== "" && form.travel_type !== "";
      case 2: return form.timeline !== "";
      case 3: return form.income_range !== "";
      case 4: return true;
      default: return false;
    }
  }

  function toggleMulti(field: keyof FormData, value: string, max?: number) {
    setForm((prev) => {
      const arr = prev[field] as string[];
      if (arr.includes(value)) {
        return { ...prev, [field]: arr.filter((v) => v !== value) };
      }
      if (max && arr.length >= max) return prev;
      return { ...prev, [field]: [...arr, value] };
    });
  }

  async function handleSubmit() {
    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        nationality: "한국",
        languages: [],
        preferred_language: "한국어",
        dual_nationality: false,
        readiness_stage: "",
        persona_type: personaType ?? "",
        immigration_purpose: form.immigration_purpose,
        travel_type: form.travel_type,
        timeline: form.timeline,
        stay_style: isShortStay ? "" : form.stay_style,
        income_krw: Number(form.income_range),
        tax_sensitivity: isShortStay ? "" : form.tax_sensitivity,
        children_ages: hasChildren(form.travel_type) ? form.children_ages : null,
        has_spouse_income: hasSpouse(form.travel_type) ? form.has_spouse_income : "없음",
        spouse_income_krw: hasSpouse(form.travel_type) && form.has_spouse_income === "있음" ? form.spouse_income_krw : 0,
        income_type: "",
        lifestyle: form.lifestyle,
        preferred_countries: form.preferred_countries,
      };

      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data = await res.json();
      sessionStorage.setItem("nnai_result", JSON.stringify(data));
      router.push("/result");
    } catch {
      setError("잠시 후 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleNext() {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  }

  function handleBack() {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm w-full flex-col">
      {/* 프로그레스바 */}
      <div className="flex items-center gap-3 pt-6 px-4">
        <button
          type="button"
          onClick={handleBack}
          className={`shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground ${currentStep === 1 ? "invisible" : ""}`}
        >
          이전
        </button>
        <ProgressBar current={currentStep} total={TOTAL_STEPS} />
      </div>

      {/* 콘텐츠 */}
      <div className="flex flex-1 flex-col justify-start pt-24 px-4">
        {/* 스텝 캐릭터 — 배지 바로 위, 여백 0 */}
        <div className="grid grid-cols-4 h-12">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-end justify-center">
              {currentStep === step && (
                <motion.img
                  src={personaType ? personaGif[personaType] ?? "/earth_64.gif" : "/earth_64.gif"}
                  alt=""
                  width={40}
                  height={40}
                  className="object-contain"
                  style={{ imageRendering: "pixelated" }}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  key={`persona-${step}`}
                />
              )}
            </div>
          ))}
        </div>

        {/* 페르소나 배지 */}
        {personaType && (
          <div className="mb-6 border border-primary/20 bg-primary/5 px-3 py-2 text-center text-xs text-primary flex items-center justify-center gap-2">
            <span>{PERSONAS[personaType].label}으로 분석합니다</span>
            <button
              type="button"
              onClick={() => router.push("/onboarding/quiz")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              다시 하기
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.35 } }}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
          >
            <h2 className="whitespace-pre-line text-xl font-medium leading-relaxed text-foreground mb-8">
              {STEP_TITLES[currentStep - 1]}
            </h2>

            {/* Step 1: 목적 + 동행 유형 */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">노마드 목적</label>
                  <SelectCard
                    options={PURPOSE_OPTIONS}
                    selected={form.immigration_purpose}
                    onSelect={(v) => setForm({ ...form, immigration_purpose: v })}
                    mode="single"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">동행 유형</label>
                  <SelectCard
                    options={TRAVEL_TYPE_OPTIONS}
                    selected={form.travel_type}
                    onSelect={(v) => setForm({ ...form, travel_type: v })}
                    mode="single"
                  />
                </div>
              </div>
            )}

            {/* Step 2: 체류 기간 + 체류 형태 */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">체류 기간</label>
                  <SelectCard
                    options={TIMELINE_OPTIONS}
                    selected={form.timeline}
                    onSelect={(v) => setForm({ ...form, timeline: v })}
                    mode="single"
                  />
                </div>
                {!isShortStay && form.timeline !== "" && (
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">체류 형태</label>
                    <SelectCard
                      options={STAY_STYLE_OPTIONS}
                      selected={form.stay_style}
                      onSelect={(v) => setForm({ ...form, stay_style: v })}
                      mode="single"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 3: 소득 + 세금 민감도 + 동행 조건부 */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">월 소득 (만원)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {INCOME_RANGE_OPTIONS.map((option) => {
                      const isActive = form.income_range === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setForm({ ...form, income_range: option.value })}
                          className={`w-full border px-4 py-3.5 text-left text-sm font-medium transition-colors ${
                            isActive
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-muted text-foreground hover:bg-accent"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  {form.income_range === "0" && (
                    <p className="text-xs text-destructive mt-1">주의! 정확한 비자 추천이 제한됩니다.</p>
                  )}
                </div>

                {!isShortStay && (
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">세금 민감도</label>
                    <SelectCard
                      options={TAX_SENSITIVITY_OPTIONS}
                      selected={form.tax_sensitivity}
                      onSelect={(v) => setForm({ ...form, tax_sensitivity: v })}
                      mode="single"
                    />
                  </div>
                )}

                {hasSpouse(form.travel_type) && (
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">배우자 소득</label>
                    <SelectCard
                      options={SPOUSE_INCOME_OPTIONS}
                      selected={form.has_spouse_income}
                      onSelect={(v) => setForm({ ...form, has_spouse_income: v })}
                      mode="single"
                    />
                    {form.has_spouse_income === "있음" && (
                      <div className="mt-3">
                        <label className="text-sm text-muted-foreground">배우자 월 소득 (만원)</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={form.spouse_income_krw || ""}
                          onChange={(e) => setForm({ ...form, spouse_income_krw: Number(e.target.value) || 0 })}
                          className={INPUT_CLASS}
                        />
                      </div>
                    )}
                  </div>
                )}

                {hasChildren(form.travel_type) && (
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">자녀 연령대 (복수 선택)</label>
                    <SelectCard
                      options={CHILDREN_AGE_OPTIONS}
                      selected={form.children_ages}
                      onSelect={(v) => toggleMulti("children_ages", v)}
                      mode="multi"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 4: 선호 지역 + 라이프스타일 */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">선호 지역 (선택 안 해도 됨)</label>
                  <SelectCard
                    options={REGION_OPTIONS}
                    selected={form.preferred_countries}
                    onSelect={(v) => toggleMulti("preferred_countries", v)}
                    mode="multi"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">중요하게 생각하는 조건 (선택 안 해도 됨)</label>
                  <SelectCard
                    options={LIFESTYLE_OPTIONS}
                    selected={form.lifestyle}
                    onSelect={(v) => toggleMulti("lifestyle", v)}
                    mode="multi"
                  />
                </div>
              </div>
            )}

            {/* CTA 버튼 — 콘텐츠 흐름 안 */}
            <div className="mt-10">
              {error && (
                <p className="mb-3 text-center text-sm text-destructive">{error}</p>
              )}
              <button
                type="button"
                onClick={handleNext}
                disabled={!canProceed() || isLoading}
                className="w-full bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isLoading ? "분석 중..." : currentStep === TOTAL_STEPS ? "분석 시작" : "다음"}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
