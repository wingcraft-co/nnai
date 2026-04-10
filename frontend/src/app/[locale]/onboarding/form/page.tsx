"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { PersonaType } from "@/data/personas";
import { PERSONAS } from "@/data/personas";
import { House } from "lucide-react";
import { ProgressBar } from "@/components/onboarding/progress-bar";
import { SelectCard } from "@/components/onboarding/select-card";
import dynamic from "next/dynamic";

const IS_DEBUG = process.env.NEXT_PUBLIC_DEBUG_MODE === "1";

const CityDebugPanel = IS_DEBUG
  ? dynamic(() => import("@/components/debug/CityDebugPanel"), { ssr: false })
  : null;

// ── Options ──────────────────────────────────────────────────────

const PURPOSE_OPTIONS = [
  { label: "원격 근무", value: "원격 근무" },
  { label: "프리랜서 활동", value: "프리랜서 활동" },
  { label: "온라인 비즈니스 운영", value: "온라인 비즈니스 운영" },
  { label: "장기 여행", value: "장기 여행" },
  { label: "은퇴 후 거주", value: "은퇴 후 거주" },
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

const BUDGET_RANGE_OPTIONS = [
  { label: "200 이하", value: "100" },
  { label: "200~400", value: "300" },
  { label: "400~600", value: "500" },
  { label: "600~800", value: "700" },
  { label: "800 이상", value: "900" },
  { label: "비공개", value: "0" },
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
  { label: "중요해요", value: "optimize" },
  { label: "크게 중요하지 않아요", value: "simple" },
  { label: "잘 모르겠어요", value: "unknown" },
];

const TRAVEL_TYPE_OPTIONS = [
  { label: "혼자", value: "혼자 (솔로)" },
  { label: "배우자 동반", value: "배우자/파트너 동반" },
  { label: "자녀 동반", value: "자녀 동반 (배우자 없이)" },
  { label: "가족 전체 동반", value: "가족 전체 동반" },
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
  timeline: string;
  stay_style: string;
  income_range: string;
  tax_sensitivity: string;
  travel_type: string;
  children_ages: string[];
  has_spouse_income: string;
  spouse_income_krw: number;
  preferred_countries: string[];
  lifestyle: string[];
  total_budget: string;
}

const INITIAL_FORM: FormData = {
  immigration_purpose: "",
  timeline: "",
  stay_style: "",
  income_range: "",
  tax_sensitivity: "",
  travel_type: "",
  children_ages: [],
  has_spouse_income: "없음",
  spouse_income_krw: 0,
  preferred_countries: [],
  lifestyle: [],
  total_budget: "",
};

const TOTAL_STEPS = 5;

const STEP_TITLES = [
  "어떤 목적으로 노마드를\n준비하고 있어요?",
  "어떻게 지낼 계획이에요?",
  "비자 조건 확인을 위해,\n소득 구간을 알려주세요.",
  "같이 가는 사람이 있어요?",
  "마지막으로,\n더 알아야 할게 있다면 알려주세요.",
];

const personaGif: Record<string, string> = {
  wanderer: "/wanderer.gif",
  local: "/local.gif",
  planner: "/planner.gif",
  free_spirit: "/free_spirit.gif",
  pioneer: "/pioneer.gif",
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
  const [personaVector, setPersonaVector] = useState<Record<string, number> | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("persona_type") as PersonaType | null;
    setPersonaType(stored);
    const vectorStr = localStorage.getItem("persona_vector");
    if (vectorStr) {
      try { setPersonaVector(JSON.parse(vectorStr)); } catch {}
    }
  }, []);

  const isShortStay = form.timeline === "1~3개월 단기 체류";

  function canProceed(): boolean {
    switch (currentStep) {
      case 1: return form.immigration_purpose !== "";
      case 2: return form.timeline !== "";
      case 3:
        if (isShortStay) {
          return form.total_budget !== "";
        }
        return form.income_range !== "";
      case 4: return form.travel_type !== "";
      case 5: return true;
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
        persona_type: personaType ?? null,
        persona_vector: personaVector,
        immigration_purpose: form.immigration_purpose,
        travel_type: form.travel_type,
        timeline: form.timeline,
        stay_style: isShortStay ? "" : form.stay_style,
        income_krw: isShortStay ? 0 : Number(form.income_range),
        total_budget_krw: isShortStay && form.total_budget ? Number(form.total_budget) : null,
        tax_sensitivity: isShortStay ? "" : form.tax_sensitivity,
        children_ages: hasChildren(form.travel_type) ? form.children_ages : null,
        has_spouse_income: hasSpouse(form.travel_type) ? form.has_spouse_income : "없음",
        spouse_income_krw: hasSpouse(form.travel_type) && form.has_spouse_income === "있음" ? form.spouse_income_krw : 0,
        income_type: "",
        lifestyle: form.lifestyle,
        preferred_countries: form.preferred_countries,
      };

      // Save payload so result page can call /api/recommend itself
      localStorage.setItem("recommend_payload", JSON.stringify(payload));
      // Clear any stale tarot session from a previous run
      localStorage.removeItem("tarot_session");

      router.push("/result");
    } catch {
      setError("뭔가 막혔어요. 다시 해볼까요?");
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

  function shouldAutoAdvance(): boolean {
    switch (currentStep) {
      case 1:
        return form.immigration_purpose !== "";
      case 2:
        if (form.timeline === "") return false;
        if (form.timeline === "1~3개월 단기 체류") return true; // no conditional
        return form.stay_style !== ""; // conditional filled
      case 3:
        if (form.timeline === "1~3개월 단기 체류") return form.total_budget !== "";
        if (form.income_range === "") return false;
        return form.tax_sensitivity !== ""; // conditional filled
      case 4: {
        if (form.travel_type === "") return false;
        const solo = form.travel_type === "혼자 (솔로)";
        if (solo) return true;
        const spouse = hasSpouse(form.travel_type);
        const children = hasChildren(form.travel_type);
        if (children) return false; // multi-select → needs button
        if (spouse) {
          if (!isShortStay) {
            if (form.has_spouse_income === "없음") return true;
            if (form.has_spouse_income === "있음") return form.spouse_income_krw > 0;
            return false;
          }
          return true; // short stay, no spouse income conditional
        }
        return false;
      }
      default:
        return false;
    }
  }

  useEffect(() => {
    if (currentStep >= 5) return;
    if (!shouldAutoAdvance()) return;

    const timer = setTimeout(() => {
      handleNext();
    }, 300);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentStep,
    form.immigration_purpose,
    form.timeline,
    form.stay_style,
    form.income_range,
    form.total_budget,
    form.tax_sensitivity,
    form.travel_type,
    form.has_spouse_income,
    form.spouse_income_krw,
  ]);

  function handleBack() {
    if (currentStep <= 1) return;
    const prev = currentStep - 1;

    // Reset fields belonging to the step we're going back to
    const resetFields: Partial<FormData> = {};
    switch (prev) {
      case 1: resetFields.immigration_purpose = ""; break;
      case 2: resetFields.timeline = ""; resetFields.stay_style = ""; break;
      case 3: resetFields.income_range = ""; resetFields.total_budget = ""; resetFields.tax_sensitivity = ""; break;
      case 4: resetFields.travel_type = ""; resetFields.has_spouse_income = "없음"; resetFields.spouse_income_krw = 0; resetFields.children_ages = []; break;
    }

    setForm((f) => ({ ...f, ...resetFields }));
    setCurrentStep(prev);
  }

  return (
    <>
    {CityDebugPanel && (
      <CityDebugPanel
        incomeRange={form.income_range}
        timeline={form.timeline}
        preferredCountries={form.preferred_countries}
      />
    )}
    <div className="mx-auto flex min-h-screen max-w-sm w-full flex-col">
      {/* 프로그레스바 */}
      <div className="flex items-center gap-3 pt-6 px-4">
        {currentStep === 1 ? (
          <button
            type="button"
            onClick={() => router.push("/")}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          >
            <House className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleBack}
            className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            이전
          </button>
        )}
        <ProgressBar current={currentStep} total={TOTAL_STEPS} />
      </div>

      {/* 콘텐츠 */}
      <div className="flex flex-1 flex-col justify-start pt-24 px-4">
        {/* 스텝 캐릭터 — 배지 바로 위, 스텝 간 슬라이드 이동 */}
        <div className="relative h-12">
          {personaType ? (
          <motion.img
            src={personaGif[personaType] ?? "/earth_64.gif"}
            alt=""
            width={40}
            height={40}
            className="absolute bottom-0 object-contain"
            style={{ imageRendering: "pixelated" }}
            animate={{
              left: `${((currentStep - 1) / (TOTAL_STEPS - 1)) * 100}%`,
              x: "-50%",
            }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
          />
          ) : (
          <motion.div
            className="absolute bottom-0 flex"
            animate={{
              left: `${((currentStep - 1) / (TOTAL_STEPS - 1)) * 100}%`,
              x: "-50%",
            }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
          >
            <img
              src="/grace_64.gif"
              alt=""
              width={40}
              height={40}
              className="object-contain"
              style={{ imageRendering: "pixelated" }}
            />
            <img
              src="/rocky_64.gif"
              alt=""
              width={40}
              height={40}
              className="object-contain -ml-4"
              style={{ imageRendering: "pixelated" }}
            />
          </motion.div>
          )}
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
              {currentStep === 3 && isShortStay
                ? "어울리는 도시 추천을 위해,\n이번 여정의 예산을 알려주세요."
                : STEP_TITLES[currentStep - 1]}
            </h2>

            {/* Step 1: 목적 */}
            {currentStep === 1 && (
              <div className="space-y-2">
                <SelectCard
                  options={PURPOSE_OPTIONS}
                  selected={form.immigration_purpose}
                  onSelect={(v) => setForm({ ...form, immigration_purpose: v })}
                  mode="single"
                />
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

            {/* Step 3: 소득 또는 총 예산 */}
            {currentStep === 3 && (
              <div className="space-y-6">
                {isShortStay ? (
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">
                      월 예산 (만원)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {BUDGET_RANGE_OPTIONS.map((option) => {
                        const isActive = form.total_budget === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setForm({ ...form, total_budget: option.value, income_range: option.value === "0" ? "0" : "" })}
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
                    {form.total_budget === "0" && (
                      <p className="text-xs text-destructive mt-1">비자 추천 정확도가 낮아질 수 있어요.</p>
                    )}
                  </div>
                ) : (
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
                      <p className="text-xs text-destructive mt-1">비자 추천 정확도가 낮아질 수 있어요.</p>
                    )}
                  </div>
                )}

                {!isShortStay && (
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">세금 혜택은 중요한가요?</label>
                    <SelectCard
                      options={TAX_SENSITIVITY_OPTIONS}
                      selected={form.tax_sensitivity}
                      onSelect={(v) => setForm({ ...form, tax_sensitivity: v })}
                      mode="single"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 4: 동행 유형 + 조건부 필드 */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <SelectCard
                    options={TRAVEL_TYPE_OPTIONS}
                    selected={form.travel_type}
                    onSelect={(v) => setForm({ ...form, travel_type: v })}
                    mode="single"
                  />
                </div>

                {hasSpouse(form.travel_type) && !isShortStay && (
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">배우자는 소득이 있나요?</label>
                    <SelectCard
                      options={SPOUSE_INCOME_OPTIONS}
                      selected={form.has_spouse_income}
                      onSelect={(v) => setForm({ ...form, has_spouse_income: v })}
                      mode="single"
                    />
                    {form.has_spouse_income === "있음" && (
                      <div className="mt-3 space-y-2">
                        <label className="text-sm text-muted-foreground">배우자의 월 소득 구간 (만원)</label>
                        <div className="grid grid-cols-2 gap-2">
                          {INCOME_RANGE_OPTIONS.filter(o => o.value !== "0").map((option) => {
                            const isActive = String(form.spouse_income_krw) === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => setForm({ ...form, spouse_income_krw: Number(option.value) })}
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
                      </div>
                    )}
                  </div>
                )}

                {hasChildren(form.travel_type) && (
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">아이들 나이대는 어떻게 돼요?</label>
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

            {/* Step 5: 선호 지역 + 라이프스타일 */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">가고 싶은 지역이 있어요?</label>
                  <SelectCard
                    options={REGION_OPTIONS}
                    selected={form.preferred_countries}
                    onSelect={(v) => toggleMulti("preferred_countries", v)}
                    mode="multi"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">노마드 선호 환경은요?</label>
                  <SelectCard
                    options={LIFESTYLE_OPTIONS}
                    selected={form.lifestyle}
                    onSelect={(v) => toggleMulti("lifestyle", v)}
                    mode="multi"
                  />
                </div>
              </div>
            )}

            {/* CTA 버튼 */}
            {(() => {
              const showNextButton = (() => {
                if (currentStep === 5) return true; // always show submit
                if (currentStep === 4 && hasChildren(form.travel_type)) return true; // multi-select
                return false; // auto-advance handles it
              })();

              return showNextButton ? (
                <div className="mt-10 space-y-3">
                  {error && (
                    <p className="mb-3 text-center text-sm text-destructive">{error}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!canProceed() || isLoading}
                    className="w-full bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {isLoading ? "당신에게 맞는 도시를 찾는 중이에요..." : currentStep === TOTAL_STEPS ? "도시 추천 받기" : "다음"}
                  </button>
                  {currentStep === 5 && !isLoading && (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="w-full py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      건너뛰기
                    </button>
                  )}
                </div>
              ) : null;
            })()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
    </>
  );
}
