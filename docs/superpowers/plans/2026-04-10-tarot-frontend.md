# Tarot Card UX — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** result/page.tsx를 타로카드 4-Stage 플로우로 전면 재설계한다. 셔플 애니메이션, 카드 선택/플립, 리딩, 비교 뷰를 구현한다.

**Architecture:** result/page.tsx를 4개 Stage 컴포넌트로 분리한다. 부모(ResultPage)가 stage 상태를 관리하고 Stage 컴포넌트를 조건부 렌더링한다. localStorage로 OAuth 세션 복원을 지원한다.

**Tech Stack:** Next.js 16, TypeScript, Framer Motion, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-04-10-tarot-card-ux-design.md`

**Depends on:** `docs/superpowers/plans/2026-04-10-tarot-backend.md` (백엔드 /api/reveal 필요)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `frontend/src/app/[locale]/result/page.tsx` | 부모 컴포넌트 — stage 상태 관리, API 호출, localStorage 복원 |
| `frontend/src/components/tarot/TarotDeck.tsx` | **신규** — Stage 1+2: 부채꼴 배치, 선택, 플립, 잠금 |
| `frontend/src/components/tarot/TarotCard.tsx` | **신규** — 개별 카드: 뒷면/앞면, 플립 애니메이션, 글로우, 잠금 |
| `frontend/src/components/tarot/TarotReading.tsx` | **신규** — Stage 3: LLM 리딩 결과 마크다운 표시 |
| `frontend/src/components/tarot/CityCompare.tsx` | **신규** — Stage 4: 3장 비교 뷰 (기존 카드 정보 재활용) |
| `frontend/src/components/tarot/types.ts` | **신규** — 공유 타입 (CityData, TarotSession 등) |
| `frontend/src/app/api/reveal/route.ts` | **신규** — /api/reveal 프록시 |

---

### Task 1: 공유 타입 + TarotCard 컴포넌트

**Files:**
- Create: `frontend/src/components/tarot/types.ts`
- Create: `frontend/src/components/tarot/TarotCard.tsx`

- [ ] **Step 1: types.ts 생성**

```typescript
// frontend/src/components/tarot/types.ts
export interface CityData {
  city: string;
  city_kr: string;
  country: string;
  country_id: string;
  visa_type: string;
  visa_url: string;
  monthly_cost_usd: number;
  score: number;
  plan_b_trigger: boolean;
  visa_free_days: number;
  internet_mbps: number | null;
  safety_score: number | null;
  english_score: number | null;
  nomad_score: number | null;
  cowork_usd_month: number | null;
  community_size: string | null;
  korean_community_size: string | null;
  mid_term_rent_usd: number | null;
  flatio_search_url: string | null;
  anyplace_search_url: string | null;
  nomad_meetup_url: string | null;
  entry_tips: Record<string, unknown> | null;
  climate: string | null;
  data_verified_date: string | null;
  city_description: string | null;
  city_insight: string | null;
  stay_months: number | null;
  renewable: boolean | null;
  key_docs: string[] | null;
  visa_fee_usd: number | null;
  tax_note: string | null;
  double_tax_treaty_with_kr: boolean | null;
  visa_notes: string[] | null;
}

export type TarotStage = "loading" | "deck" | "selecting" | "revealed" | "reading" | "comparing";

export interface TarotSession {
  session_id: string;
  selectedIndices: number[];
  revealedCities: CityData[];
  readingCityIndex: number | null;
  readingMarkdown: string | null;
  stage: TarotStage;
}

export const TAROT_SESSION_KEY = "tarot_session";
```

- [ ] **Step 2: TarotCard.tsx 생성**

```tsx
// frontend/src/components/tarot/TarotCard.tsx
"use client";

import { motion } from "framer-motion";

interface TarotCardProps {
  index: number;
  rotation: number;       // 부채꼴 각도 (-20, -10, 0, 10, 20)
  offsetY: number;        // 부채꼴 Y 오프셋
  isFlipped: boolean;     // 앞면 공개 여부
  isSelected: boolean;    // 선택 글로우
  isLocked: boolean;      // 잠금 상태
  city?: {                // 앞면 데이터 (reveal 후)
    city_kr: string;
    country_id: string;
    monthly_cost_usd: number;
    visa_free_days: number;
    plan_b_trigger: boolean;
    internet_mbps: number | null;
  };
  onClick?: () => void;
}

const FLAG_EMOJI: Record<string, string> = {
  PT: "🇵🇹", TH: "🇹🇭", EE: "🇪🇪", ES: "🇪🇸", ID: "🇮🇩",
  DE: "🇩🇪", GE: "🇬🇪", CR: "🇨🇷", GR: "🇬🇷", PH: "🇵🇭",
  VN: "🇻🇳", HR: "🇭🇷", CZ: "🇨🇿", HU: "🇭🇺", SI: "🇸🇮",
  MT: "🇲🇹", CY: "🇨🇾", AL: "🇦🇱", RS: "🇷🇸", MK: "🇲🇰",
  MX: "🇲🇽", CO: "🇨🇴", AR: "🇦🇷", BR: "🇧🇷", AE: "🇦🇪",
  MA: "🇲🇦", CA: "🇨🇦", JP: "🇯🇵", MY: "🇲🇾", BG: "🇧🇬",
  NL: "🇳🇱", PA: "🇵🇦", RO: "🇷🇴", UY: "🇺🇾", TW: "🇹🇼",
  KE: "🇰🇪", CV: "🇨🇻", PY: "🇵🇾", QA: "🇶🇦",
};

function visaBadge(days: number, schengen: boolean): string {
  if (days > 0 && schengen) return "🛂 무비자 90일 (셴겐)";
  if (days > 0) return `🛂 무비자 ${days}일`;
  return "🛂 비자 필요";
}

export default function TarotCard({
  index, rotation, offsetY,
  isFlipped, isSelected, isLocked,
  city, onClick,
}: TarotCardProps) {
  const cardW = 80;
  const cardH = 120;

  return (
    <motion.div
      className="absolute cursor-pointer"
      style={{
        width: cardW,
        height: cardH,
        transformStyle: "preserve-3d",
        perspective: 800,
      }}
      initial={{ x: 0, y: 0, rotate: 0, opacity: 0 }}
      animate={{
        rotate: rotation,
        y: offsetY,
        opacity: isLocked ? 0.3 : 1,
      }}
      transition={{ delay: index * 0.3, duration: 0.6, ease: "easeOut" }}
      onClick={onClick}
    >
      <motion.div
        style={{
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          position: "relative",
        }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        {/* 뒷면 */}
        <div
          className="absolute inset-0 rounded-lg border-2 flex items-center justify-center"
          style={{
            backfaceVisibility: "hidden",
            background: "linear-gradient(135deg, #1a1a2e, #2a1a4e)",
            borderColor: isSelected ? "#c9a962" : "#4a3a6e",
            boxShadow: isSelected ? "0 0 12px #c9a96288" : "none",
          }}
        >
          <span className="text-2xl">✦</span>
        </div>

        {/* 앞면 */}
        <div
          className="absolute inset-0 rounded-lg border-2 border-[#c9a962] flex flex-col items-center justify-center gap-1 p-2"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            background: "linear-gradient(135deg, #1a1a2e, #2a1a4e)",
          }}
        >
          {city && (
            <>
              <span className="text-xl">{FLAG_EMOJI[city.country_id] ?? "🌍"}</span>
              <span className="text-xs font-bold text-white">{city.city_kr}</span>
              <div className="w-full border-t border-[#c9a96244] my-1" />
              <span className="text-[9px] text-gray-300">💰 ${city.monthly_cost_usd}/월</span>
              <span className="text-[9px] text-gray-300">{visaBadge(city.visa_free_days, city.plan_b_trigger)}</span>
              <span className="text-[9px] text-gray-300">📶 {city.internet_mbps ?? "?"}Mbps</span>
            </>
          )}
        </div>
      </motion.div>

      {/* 잠금 오버레이 */}
      {isLocked && (
        <div className="absolute inset-0 rounded-lg flex items-center justify-center bg-black/50">
          <span className="text-xl">🔒</span>
        </div>
      )}
    </motion.div>
  );
}
```

- [ ] **Step 3: 빌드 확인**

Run: `cd frontend && npm run build`
Expected: 빌드 성공 (컴포넌트가 아직 사용되지 않아도 타입 체크 통과)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/tarot/types.ts frontend/src/components/tarot/TarotCard.tsx
git commit -m "feat: add TarotCard component + shared types"
```

---

### Task 2: TarotDeck 컴포넌트 (Stage 1+2)

**Files:**
- Create: `frontend/src/components/tarot/TarotDeck.tsx`

- [ ] **Step 1: TarotDeck.tsx 생성**

```tsx
// frontend/src/components/tarot/TarotDeck.tsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TarotCard from "./TarotCard";
import type { CityData } from "./types";

interface TarotDeckProps {
  cardCount: number;
  revealedCities: CityData[] | null;
  onReveal: (indices: number[]) => Promise<void>;
  onSelectForReading: (cityIndex: number) => void;
}

const FAN_ROTATIONS = [-20, -10, 0, 10, 20];
const FAN_OFFSETS_Y = [20, 8, 0, 8, 20];

export default function TarotDeck({
  cardCount,
  revealedCities,
  onReveal,
  onSelectForReading,
}: TarotDeckProps) {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isRevealing, setIsRevealing] = useState(false);
  const [revealedIndices, setRevealedIndices] = useState<number[]>([]);
  const [readingSelection, setReadingSelection] = useState<number | null>(null);

  const isRevealed = revealedCities !== null;

  function handleCardClick(index: number) {
    if (isRevealing) return;

    if (isRevealed) {
      // Stage 2: 리딩 선택
      if (!revealedIndices.includes(index)) return; // 잠긴 카드
      setReadingSelection(index === readingSelection ? null : index);
      return;
    }

    // Stage 1: 카드 선택
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter((i) => i !== index));
    } else if (selectedIndices.length < 3) {
      setSelectedIndices([...selectedIndices, index]);
    }
  }

  async function handleRevealClick() {
    setIsRevealing(true);
    setRevealedIndices(selectedIndices);
    await onReveal(selectedIndices);
    setIsRevealing(false);
  }

  function handleReadingClick() {
    if (readingSelection !== null) {
      onSelectForReading(readingSelection);
    }
  }

  // 카드 reveal 후 → revealedCities에서 해당 인덱스의 도시 데이터 찾기
  function getCityForIndex(index: number): CityData | undefined {
    if (!revealedCities) return undefined;
    const pos = revealedIndices.indexOf(index);
    if (pos === -1) return undefined;
    return revealedCities[pos];
  }

  return (
    <div className="flex flex-col items-center gap-8">
      {/* 부채꼴 카드 영역 */}
      <div className="relative" style={{ width: 320, height: 200 }}>
        {Array.from({ length: cardCount }).map((_, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${50 + (i - 2) * 55}px`,
              top: "20px",
            }}
          >
            <TarotCard
              index={i}
              rotation={FAN_ROTATIONS[i] ?? 0}
              offsetY={FAN_OFFSETS_Y[i] ?? 0}
              isFlipped={revealedIndices.includes(i)}
              isSelected={selectedIndices.includes(i) || readingSelection === i}
              isLocked={isRevealed && !revealedIndices.includes(i)}
              city={getCityForIndex(i)}
              onClick={() => handleCardClick(i)}
            />
          </div>
        ))}
      </div>

      {/* 안내 텍스트 + CTA */}
      <AnimatePresence mode="wait">
        {!isRevealed && (
          <motion.div
            key="select-phase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center"
          >
            <p className="text-sm text-muted-foreground mb-4">
              {selectedIndices.length < 3
                ? `끌리는 카드 ${3 - selectedIndices.length}장을 더 골라보세요`
                : "준비되셨나요?"}
            </p>
            {selectedIndices.length === 3 && (
              <button
                type="button"
                onClick={handleRevealClick}
                disabled={isRevealing}
                className="border border-[#c9a962] px-6 py-2 text-sm text-[#c9a962] hover:bg-[#c9a962]/10 transition-colors disabled:opacity-50"
              >
                {isRevealing ? "카드를 열고 있어요..." : "카드 열기"}
              </button>
            )}
          </motion.div>
        )}

        {isRevealed && (
          <motion.div
            key="reading-phase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center"
          >
            <p className="text-sm text-muted-foreground mb-4">
              끌리는 도시를 하나 골라보세요
            </p>
            {readingSelection !== null && (
              <button
                type="button"
                onClick={handleReadingClick}
                className="border border-[#c9a962] px-6 py-2 text-sm text-[#c9a962] hover:bg-[#c9a962]/10 transition-colors"
              >
                리딩 받기
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인**

Run: `cd frontend && npm run build`
Expected: 빌드 성공

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/tarot/TarotDeck.tsx
git commit -m "feat: add TarotDeck component — fan layout, selection, flip"
```

---

### Task 3: TarotReading + CityCompare 컴포넌트

**Files:**
- Create: `frontend/src/components/tarot/TarotReading.tsx`
- Create: `frontend/src/components/tarot/CityCompare.tsx`

- [ ] **Step 1: TarotReading.tsx 생성**

```tsx
// frontend/src/components/tarot/TarotReading.tsx
"use client";

import { motion } from "framer-motion";
import type { CityData } from "./types";

interface TarotReadingProps {
  city: CityData;
  markdown: string;
  onCompare: () => void;
}

export default function TarotReading({ city, markdown, onCompare }: TarotReadingProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-2xl mx-auto"
    >
      <div className="border-l-4 border-[#c9a962] pl-4 mb-6">
        <h2 className="text-lg font-bold text-foreground">{city.city_kr}</h2>
        <p className="text-sm text-muted-foreground">{city.country}</p>
      </div>

      <div
        className="prose prose-sm max-w-none text-foreground leading-relaxed"
        dangerouslySetInnerHTML={{ __html: markdown }}
      />

      <div className="mt-8 text-center">
        <button
          type="button"
          onClick={onCompare}
          className="border border-border px-6 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          다른 카드도 살펴볼까요?
        </button>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: CityCompare.tsx 생성**

```tsx
// frontend/src/components/tarot/CityCompare.tsx
"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Wifi, Languages } from "lucide-react";
import type { CityData } from "./types";

interface CityCompareProps {
  cities: CityData[];
  onRetry: () => void;
}

const USD_TO_KRW = 1400;
function toKRW(usd: number): string {
  return `약 ${Math.round((usd * USD_TO_KRW) / 10000)}만원`;
}

function visaBadge(city: CityData): string {
  if (city.visa_free_days > 0 && city.plan_b_trigger) return "🛂 무비자 90일 (셴겐)";
  if (city.visa_free_days > 0) return `🛂 무비자 ${city.visa_free_days}일`;
  return "🛂 비자 필요";
}

export default function CityCompare({ cities, onRetry }: CityCompareProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-lg font-bold text-foreground mb-6 text-center">
        공개된 도시 비교
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cities.map((city, i) => (
          <motion.div
            key={city.city}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.15 }}
            className="border border-border bg-card p-4"
          >
            <div className="text-center mb-3">
              <span className="text-lg font-bold text-foreground">{city.city_kr}</span>
              <p className="text-xs text-muted-foreground">{city.country}</p>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <span className="inline-block rounded bg-muted px-2 py-0.5 text-xs font-medium">
                {visaBadge(city)}
              </span>
              <p>비자: {city.visa_type}</p>
              <p>{city.stay_months != null && `${city.stay_months}개월`} · {city.renewable ? "갱신 가능" : "갱신 불가"}</p>
              <p>예산: {toKRW(city.monthly_cost_usd)} / 월</p>

              <div className="border-t border-border my-2" />

              <div className="grid grid-cols-3 text-xs">
                {city.safety_score != null && (
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="size-3" />치안 {city.safety_score}
                  </span>
                )}
                {city.internet_mbps != null && (
                  <span className="inline-flex items-center gap-1">
                    <Wifi className="size-3" />{city.internet_mbps}Mbps
                  </span>
                )}
                {city.english_score != null && (
                  <span className="inline-flex items-center gap-1">
                    <Languages className="size-3" />영어 {city.english_score}
                  </span>
                )}
              </div>
            </div>

            {city.city_description && (
              <>
                <div className="border-t border-border my-2" />
                <p className="text-xs text-foreground leading-relaxed">
                  {city.city_description}
                </p>
              </>
            )}

            <div className="border-t border-border my-2" />
            <div className="flex gap-3">
              {city.flatio_search_url && (
                <a href={city.flatio_search_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline">숙소 찾기 →</a>
              )}
              {city.visa_url && (
                <a href={city.visa_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline">비자 정보 →</a>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <button
          type="button"
          onClick={onRetry}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          처음부터 다시하기
        </button>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 3: 빌드 확인**

Run: `cd frontend && npm run build`
Expected: 빌드 성공

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/tarot/TarotReading.tsx frontend/src/components/tarot/CityCompare.tsx
git commit -m "feat: add TarotReading + CityCompare components"
```

---

### Task 4: /api/reveal 프록시 라우트

**Files:**
- Create: `frontend/src/app/api/reveal/route.ts`

- [ ] **Step 1: reveal 프록시 생성**

```typescript
// frontend/src/app/api/reveal/route.ts
import { NextRequest, NextResponse } from "next/server";
import cityScoresData from "@/data/city_scores.json";
import visaDbData from "@/data/visa_db.json";
import cityDescriptions from "@/data/city_descriptions.json";
import cityInsights from "@/data/city_insights.json";

const cityScores = (cityScoresData as { cities: Record<string, unknown>[] }).cities;
const visaCountries = (visaDbData as { countries: Record<string, unknown>[] }).countries;

function enrichCity(city: Record<string, unknown>) {
  const cityName = city.city as string;
  const countryId = city.country_id as string;

  let scores = new Map(cityScores.map(c => [c.city as string, c])).get(cityName);
  if (!scores) {
    for (const c of cityScores) {
      const key = c.city as string;
      if (cityName.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(cityName.toLowerCase())) {
        scores = c;
        break;
      }
    }
  }

  const visa = new Map(visaCountries.map(c => [c.id as string, c])).get(countryId);

  const slug = cityName.toUpperCase().replace(/ /g, "_").replace(/[()]/g, "");
  const descKey = `${countryId}_${slug}`;

  return {
    ...city,
    internet_mbps: scores?.internet_mbps ?? null,
    safety_score: scores?.safety_score ?? null,
    english_score: scores?.english_score ?? null,
    nomad_score: scores?.nomad_score ?? null,
    cowork_usd_month: scores?.cowork_usd_month ?? null,
    community_size: scores?.community_size ?? null,
    korean_community_size: scores?.korean_community_size ?? null,
    mid_term_rent_usd: scores?.mid_term_rent_usd ?? null,
    flatio_search_url: scores?.flatio_search_url ?? null,
    anyplace_search_url: scores?.anyplace_search_url ?? null,
    nomad_meetup_url: scores?.nomad_meetup_url ?? null,
    entry_tips: scores?.entry_tips ?? null,
    climate: scores?.climate ?? null,
    data_verified_date: scores?.data_verified_date ?? null,
    stay_months: visa?.stay_months ?? null,
    renewable: visa?.renewable ?? null,
    key_docs: visa?.key_docs ?? null,
    visa_fee_usd: visa?.visa_fee_usd ?? null,
    tax_note: visa?.tax_note ?? null,
    double_tax_treaty_with_kr: visa?.double_tax_treaty_with_kr ?? null,
    visa_notes: visa?.visa_notes ?? null,
    visa_free_days: visa?.visa_free_days ?? 0,
    city_description: (cityDescriptions as Record<string, string>)[descKey] ?? null,
    city_insight: (cityInsights as Record<string, string>)[descKey] ?? null,
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const cookie = req.headers.get("cookie") ?? "";
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "https://api.nnai.app";

  const response = await fetch(`${apiBase}/api/reveal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return NextResponse.json({ error: "API 호출 실패" }, { status: response.status });
  }

  const data = await response.json();

  if (data.revealed_cities) {
    data.revealed_cities = data.revealed_cities.map(enrichCity);
  }

  return NextResponse.json(data);
}
```

- [ ] **Step 2: 빌드 확인**

Run: `cd frontend && npm run build`
Expected: 빌드 성공

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/api/reveal/route.ts
git commit -m "feat: add /api/reveal proxy route"
```

---

### Task 5: result/page.tsx 전면 재설계

**Files:**
- Modify: `frontend/src/app/[locale]/result/page.tsx` — 전면 교체

- [ ] **Step 1: result/page.tsx 재작성**

기존 파일을 전면 교체. 부모 컴포넌트로서 stage 상태 관리, API 호출, localStorage 세션 복원을 담당:

```tsx
// frontend/src/app/[locale]/result/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import TarotDeck from "@/components/tarot/TarotDeck";
import TarotReading from "@/components/tarot/TarotReading";
import CityCompare from "@/components/tarot/CityCompare";
import type { CityData, TarotStage, TarotSession, TAROT_SESSION_KEY } from "@/components/tarot/types";

export default function ResultPage() {
  const router = useRouter();
  const [stage, setStage] = useState<TarotStage>("loading");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cardCount, setCardCount] = useState(5);
  const [revealedCities, setRevealedCities] = useState<CityData[] | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [readingCity, setReadingCity] = useState<CityData | null>(null);
  const [readingMarkdown, setReadingMarkdown] = useState<string>("");
  const [parsedData, setParsedData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // localStorage 세션 복원 또는 신규 추천
  useEffect(() => {
    const saved = localStorage.getItem("tarot_session");
    if (saved) {
      try {
        const session: TarotSession = JSON.parse(saved);
        setSessionId(session.session_id);
        setSelectedIndices(session.selectedIndices);
        setRevealedCities(session.revealedCities);
        setStage(session.stage);
        if (session.readingMarkdown) setReadingMarkdown(session.readingMarkdown);
        return;
      } catch { /* fall through to fresh recommend */ }
    }

    // 신규 추천
    const recommendData = localStorage.getItem("recommend_payload");
    if (!recommendData) {
      router.push("/onboarding/form");
      return;
    }

    fetchRecommendation(JSON.parse(recommendData));
  }, []);

  // stage 변경 시 localStorage 갱신
  useEffect(() => {
    if (sessionId && stage !== "loading") {
      const session: TarotSession = {
        session_id: sessionId,
        selectedIndices,
        revealedCities: revealedCities ?? [],
        readingCityIndex: readingCity ? revealedCities?.indexOf(readingCity) ?? null : null,
        readingMarkdown,
        stage,
      };
      localStorage.setItem("tarot_session", JSON.stringify(session));
    }
  }, [stage, sessionId, selectedIndices, revealedCities, readingCity, readingMarkdown]);

  async function fetchRecommendation(payload: Record<string, unknown>) {
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setSessionId(data.session_id);
      setCardCount(data.card_count);
      setParsedData(data.parsed);
      setStage("deck");
    } catch (e) {
      setError("뭔가 막혔어요. 다시 해볼까요?");
    }
  }

  async function handleReveal(indices: number[]) {
    if (!sessionId) return;
    setSelectedIndices(indices);
    try {
      const res = await fetch("/api/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, selected_indices: indices }),
      });
      if (!res.ok) throw new Error(`Reveal error: ${res.status}`);
      const data = await res.json();
      setRevealedCities(data.revealed_cities);
      setStage("revealed");
    } catch (e) {
      setError("카드를 열지 못했어요. 다시 시도해주세요.");
    }
  }

  async function handleSelectForReading(cityIndex: number) {
    // OAuth 체크 — /auth/me 호출
    try {
      const authRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "https://api.nnai.app"}/auth/me`,
        { credentials: "include" }
      );
      const authData = await authRes.json();
      if (!authData.logged_in) {
        // 세션 저장 후 OAuth 리다이렉트
        localStorage.setItem("tarot_session", JSON.stringify({
          session_id: sessionId,
          selectedIndices,
          revealedCities,
          readingCityIndex: cityIndex,
          readingMarkdown: null,
          stage: "revealed",
        } as TarotSession));
        window.location.href = `${process.env.NEXT_PUBLIC_API_URL || "https://api.nnai.app"}/auth/google`;
        return;
      }
    } catch { /* proceed — auth check failed, try detail anyway */ }

    // 리딩 요청
    if (!revealedCities || !parsedData) return;
    const city = revealedCities[revealedCities.findIndex((_, i) => i === cityIndex)] ?? revealedCities[0];
    setReadingCity(city);
    setStage("reading");

    try {
      const res = await fetch("/api/detail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parsed_data: parsedData,
          city_index: selectedIndices[cityIndex],
        }),
      });
      if (!res.ok) throw new Error(`Detail error: ${res.status}`);
      const data = await res.json();
      setReadingMarkdown(data.markdown);
    } catch (e) {
      setError("리딩을 불러오지 못했어요.");
    }
  }

  function handleCompare() {
    setStage("comparing");
  }

  function handleRetry() {
    localStorage.removeItem("tarot_session");
    localStorage.removeItem("recommend_payload");
    router.push("/onboarding/form");
  }

  // -- Render --

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-sm text-destructive mb-4">{error}</p>
        <button onClick={handleRetry} className="text-sm text-muted-foreground hover:text-foreground">
          처음부터 다시하기
        </button>
      </div>
    );
  }

  if (stage === "loading") {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-sm text-muted-foreground animate-pulse">
          당신의 카드를 준비하고 있어요...
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {(stage === "deck" || stage === "selecting" || stage === "revealed") && (
        <TarotDeck
          cardCount={cardCount}
          revealedCities={revealedCities}
          onReveal={handleReveal}
          onSelectForReading={handleSelectForReading}
        />
      )}

      {stage === "reading" && readingCity && (
        <TarotReading
          city={readingCity}
          markdown={readingMarkdown || "<p class='animate-pulse text-muted-foreground'>카드를 읽고 있어요...</p>"}
          onCompare={handleCompare}
        />
      )}

      {stage === "comparing" && revealedCities && (
        <CityCompare
          cities={revealedCities}
          onRetry={handleRetry}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: form/page.tsx에서 payload를 localStorage에 저장**

`frontend/src/app/[locale]/onboarding/form/page.tsx`의 `handleSubmit()` 함수에서, API 호출 전에 payload를 localStorage에 저장:

```typescript
// handleSubmit() 내부, fetch 호출 직전에 추가
localStorage.setItem("recommend_payload", JSON.stringify(payload));
```

그리고 result 페이지로의 라우팅 방식 변경 — API 응답 데이터를 URL query가 아닌 localStorage에서 읽도록.

- [ ] **Step 3: 빌드 확인**

Run: `cd frontend && npm run build`
Expected: 빌드 성공

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/[locale]/result/page.tsx frontend/src/app/[locale]/onboarding/form/page.tsx
git commit -m "feat: rewrite result page as 4-stage tarot card flow"
```

---

### Task 6: 전체 통합 테스트 + 문서

**Files:**
- Modify: `cowork/backend/api-reference.md` (이미 백엔드 플랜 Task 5에서 처리)

- [ ] **Step 1: 프론트엔드 빌드 최종 확인**

Run: `cd frontend && npm run build`
Expected: 빌드 성공

- [ ] **Step 2: 백엔드 테스트 최종 확인**

Run: `SKIP_RAG_INIT=1 python3 -m pytest tests/ -v`
Expected: 모든 테스트 PASS

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: final integration — tarot card UX complete"
```
