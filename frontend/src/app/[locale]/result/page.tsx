"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import TarotReading from "@/components/tarot/TarotReading";
import CityCompare from "@/components/tarot/CityCompare";
import type { CityData, TarotSession } from "@/components/tarot/types";
import { TAROT_SESSION_KEY } from "@/components/tarot/types";
import { ShieldCheck, Wifi, Languages, Banknote, Lock } from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────

const RECOMMEND_PAYLOAD_KEY = "recommend_payload";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.nnai.app";

// ── Utility ────────────────────────────────────────────────────────

const USD_TO_KRW = 1400;

function toKRW(usd: number): string {
  return `약 ${Math.round((usd * USD_TO_KRW) / 10000)}만원`;
}

function visaBadge(city: CityData): string {
  if (city.visa_free_days > 0 && city.plan_b_trigger)
    return "🛂 무비자 90일 (셴겐)";
  if (city.visa_free_days > 0) return `🛂 무비자 ${city.visa_free_days}일`;
  return "🛂 비자 필요";
}

// ── Stage type ─────────────────────────────────────────────────────

type Stage = "loading" | "selecting" | "revealed" | "reading" | "comparing";

// ── SessionV2 stored in localStorage ──────────────────────────────

interface SessionV2 {
  session_id: string;
  allCities: CityData[];
  selectedIndices: number[];
  revealedCities: CityData[];
  readingCityIndex: number | null;
  readingMarkdown: string | null;
  parsedData: Record<string, unknown> | null;
  stage: Stage;
}

const SESSION_V2_KEY = "result_session_v2";

// ── Preview Card (Stage 1) ─────────────────────────────────────────

function PreviewCard({
  city,
  rank,
  selected,
  onClick,
  disabled,
}: {
  city: CityData;
  rank: number;
  selected: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !selected}
      className={[
        "w-full text-left rounded-lg border p-4 transition-all",
        selected
          ? "border-2 border-primary bg-primary/5 shadow-sm"
          : disabled
          ? "border-border bg-card opacity-50 cursor-not-allowed"
          : "border-border bg-card hover:border-primary/50 hover:shadow-sm cursor-pointer",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground w-5">
            {rank + 1}.
          </span>
          <div>
            <p className="font-semibold text-foreground">{city.city_kr}</p>
            <p className="text-xs text-muted-foreground">{city.country}</p>
          </div>
        </div>
        {selected && (
          <span className="shrink-0 text-xs font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
            선택됨
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Banknote className="size-3 shrink-0" />
          {toKRW(city.monthly_cost_usd)}/월
        </span>
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="size-3 shrink-0" />
          {city.visa_free_days > 0
            ? `무비자 ${city.visa_free_days}일`
            : "비자 필요"}
        </span>
        {city.internet_mbps != null && (
          <span className="inline-flex items-center gap-1">
            <Wifi className="size-3 shrink-0" />
            {city.internet_mbps}Mbps
          </span>
        )}
      </div>
    </button>
  );
}

// ── Revealed City Card (Stage 2) ───────────────────────────────────

function RevealedCard({
  city,
  rank,
  selected,
  onClick,
}: {
  city: CityData;
  rank: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full text-left rounded-lg border p-5 transition-all",
        selected
          ? "border-2 border-primary bg-primary/5 shadow-md"
          : "border-border bg-card hover:border-primary/50 hover:shadow-sm",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-sm"
          style={{ background: "#c9a84c", color: "#1a1a2e" }}
        >
          {rank === 0 ? "1st" : rank === 1 ? "2nd" : "3rd"}
        </span>
        <span className="font-bold text-foreground">{city.city_kr}</span>
        <span className="text-sm text-muted-foreground">{city.country}</span>
        {selected && (
          <span className="ml-auto text-xs font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
            선택됨
          </span>
        )}
      </div>

      {/* Insight */}
      {city.city_insight && (
        <p className="text-sm italic text-muted-foreground mb-3 pl-3 border-l-2 border-primary/50">
          {city.city_insight}
        </p>
      )}

      {/* Visa badge */}
      <span className="inline-block rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground mb-2">
        {visaBadge(city)}
      </span>

      {/* Visa detail */}
      <p className="text-sm text-muted-foreground mb-1">
        비자: {city.visa_type}
        {city.stay_months != null && ` · ${city.stay_months}개월`}
        {` · ${city.renewable ? "갱신 가능" : "갱신 불가"}`}
      </p>

      {/* Budget */}
      <p className="text-sm font-medium text-foreground mb-3">
        예산: {toKRW(city.monthly_cost_usd)} / 월
      </p>

      {/* Stats */}
      {(city.safety_score != null ||
        city.internet_mbps != null ||
        city.english_score != null) && (
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
          {city.safety_score != null && (
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="size-3 shrink-0" />
              치안 {city.safety_score}/10
            </span>
          )}
          {city.internet_mbps != null && (
            <span className="inline-flex items-center gap-1">
              <Wifi className="size-3 shrink-0" />
              {city.internet_mbps}Mbps
            </span>
          )}
          {city.english_score != null && (
            <span className="inline-flex items-center gap-1">
              <Languages className="size-3 shrink-0" />
              영어 {city.english_score}/10
            </span>
          )}
        </div>
      )}

      {/* Description */}
      {city.city_description && (
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          {city.city_description}
        </p>
      )}

      {/* Links */}
      <div className="flex flex-wrap gap-3">
        {city.visa_url && (
          <a
            href={city.visa_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs hover:underline"
            style={{ color: "#c9a84c" }}
          >
            비자 정보 →
          </a>
        )}
        {city.flatio_search_url && (
          <a
            href={city.flatio_search_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs hover:underline"
            style={{ color: "#c9a84c" }}
          >
            숙소 찾기 →
          </a>
        )}
      </div>
    </button>
  );
}

// ── Locked Card (Stage 2) ─────────────────────────────────────────

function LockedCard({ city }: { city: CityData }) {
  return (
    <div className="rounded-lg border border-border bg-card/50 p-5 opacity-60 select-none">
      <div className="flex items-center gap-3">
        <Lock className="size-4 text-muted-foreground" />
        <div>
          <p className="font-semibold text-muted-foreground">{city.city_kr}</p>
          <p className="text-xs text-muted-foreground">{city.country}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        3장 중 선택되지 않은 카드
      </p>
    </div>
  );
}

// ── Result Page ────────────────────────────────────────────────────

export default function ResultPage() {
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("loading");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [allCities, setAllCities] = useState<CityData[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [revealedCities, setRevealedCities] = useState<CityData[] | null>(null);
  const [readingCity, setReadingCity] = useState<CityData | null>(null);
  const [readingMarkdown, setReadingMarkdown] = useState<string>("");
  const [parsedData, setParsedData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // ── Persist session ──────────────────────────────────────────────

  const saveSession = useCallback(
    (overrides: Partial<SessionV2> & { stage: Stage }) => {
      const session: SessionV2 = {
        session_id: overrides.session_id ?? sessionId ?? "",
        allCities: overrides.allCities ?? allCities,
        selectedIndices: overrides.selectedIndices ?? selectedIndices,
        revealedCities: overrides.revealedCities ?? revealedCities ?? [],
        readingCityIndex: overrides.readingCityIndex ?? null,
        readingMarkdown: overrides.readingMarkdown ?? readingMarkdown ?? null,
        parsedData: overrides.parsedData ?? parsedData ?? null,
        stage: overrides.stage,
      };
      localStorage.setItem(SESSION_V2_KEY, JSON.stringify(session));

      // Also keep legacy TarotSession key so OAuth redirect restore works
      const legacy: TarotSession = {
        session_id: session.session_id,
        selectedIndices: session.selectedIndices,
        revealedCities: session.revealedCities,
        readingCityIndex: session.readingCityIndex,
        readingMarkdown: session.readingMarkdown,
        stage:
          session.stage === "selecting"
            ? "deck"
            : session.stage === "revealed"
            ? "revealed"
            : session.stage === "reading"
            ? "reading"
            : session.stage === "comparing"
            ? "comparing"
            : "loading",
      };
      localStorage.setItem(TAROT_SESSION_KEY, JSON.stringify(legacy));
    },
    [sessionId, allCities, selectedIndices, revealedCities, readingMarkdown, parsedData]
  );

  // ── API: recommend ───────────────────────────────────────────────

  const startRecommend = useCallback(async () => {
    const payloadStr = localStorage.getItem(RECOMMEND_PAYLOAD_KEY);
    if (!payloadStr) {
      router.replace("/onboarding/form");
      return;
    }

    setStage("loading");
    setError(null);

    try {
      const payload = JSON.parse(payloadStr) as Record<string, unknown>;
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`recommend error: ${res.status}`);
      const data = (await res.json()) as {
        session_id: string;
        parsed: Record<string, unknown>;
      };

      const topCities = (data.parsed?.top_cities ?? []) as CityData[];

      setSessionId(data.session_id);
      setParsedData(data.parsed);
      setAllCities(topCities);
      setSelectedIndices([]);
      setRevealedCities(null);
      setReadingCity(null);
      setReadingMarkdown("");

      setStage("selecting");

      const session: SessionV2 = {
        session_id: data.session_id,
        allCities: topCities,
        selectedIndices: [],
        revealedCities: [],
        readingCityIndex: null,
        readingMarkdown: null,
        parsedData: data.parsed,
        stage: "selecting",
      };
      localStorage.setItem(SESSION_V2_KEY, JSON.stringify(session));
      // legacy key
      const legacy: TarotSession = {
        session_id: data.session_id,
        selectedIndices: [],
        revealedCities: [],
        readingCityIndex: null,
        readingMarkdown: null,
        stage: "deck",
      };
      localStorage.setItem(TAROT_SESSION_KEY, JSON.stringify(legacy));
    } catch {
      setError("추천을 불러오지 못했어요. 다시 시도해주세요.");
      setStage("loading");
    }
  }, [router]);

  // ── Mount: restore or start ──────────────────────────────────────

  useEffect(() => {
    // Try new session format first
    const savedV2Str = localStorage.getItem(SESSION_V2_KEY);
    if (savedV2Str) {
      try {
        const saved = JSON.parse(savedV2Str) as SessionV2;
        setSessionId(saved.session_id);
        setAllCities(saved.allCities ?? []);
        setSelectedIndices(saved.selectedIndices ?? []);
        setRevealedCities(saved.revealedCities?.length ? saved.revealedCities : null);
        setParsedData(saved.parsedData ?? null);
        setReadingMarkdown(saved.readingMarkdown ?? "");

        let resumeStage = saved.stage;
        if (resumeStage === "reading") {
          if (!saved.readingMarkdown) {
            resumeStage = "revealed";
          } else if (saved.readingCityIndex != null && saved.revealedCities) {
            setReadingCity(saved.revealedCities[saved.readingCityIndex] ?? null);
          }
        }
        setStage(resumeStage);
        return;
      } catch {
        localStorage.removeItem(SESSION_V2_KEY);
      }
    }

    // Fallback: try legacy tarot session (for OAuth redirect return)
    const legacyStr = localStorage.getItem(TAROT_SESSION_KEY);
    if (legacyStr) {
      try {
        const saved = JSON.parse(legacyStr) as TarotSession;
        if (saved.session_id) {
          setSessionId(saved.session_id);
          setRevealedCities(saved.revealedCities?.length ? saved.revealedCities : null);
          setReadingMarkdown(saved.readingMarkdown ?? "");

          // Map legacy stage
          let resumeStage: Stage = "selecting";
          if (saved.stage === "revealed") resumeStage = "revealed";
          else if (saved.stage === "reading") {
            if (saved.readingMarkdown && saved.readingCityIndex != null && saved.revealedCities) {
              setReadingCity(saved.revealedCities[saved.readingCityIndex] ?? null);
              resumeStage = "reading";
            } else {
              resumeStage = "revealed";
            }
          } else if (saved.stage === "comparing") resumeStage = "comparing";

          setStage(resumeStage);
          return;
        }
      } catch {
        localStorage.removeItem(TAROT_SESSION_KEY);
      }
    }

    // No saved session — start fresh
    const hasPayload = !!localStorage.getItem(RECOMMEND_PAYLOAD_KEY);
    if (!hasPayload) {
      router.replace("/onboarding/form");
      return;
    }
    startRecommend();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Select toggle (Stage 1) ──────────────────────────────────────

  function toggleSelect(i: number) {
    setSelectedIndices((prev) => {
      if (prev.includes(i)) return prev.filter((x) => x !== i);
      if (prev.length >= 3) return prev;
      return [...prev, i];
    });
  }

  // ── Confirm selection → /api/reveal ─────────────────────────────

  async function handleConfirmSelection() {
    if (!sessionId || selectedIndices.length !== 3) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          selected_indices: selectedIndices,
        }),
      });
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errData.error ?? `reveal error: ${res.status}`);
      }
      const data = (await res.json()) as { revealed_cities: CityData[] };

      setRevealedCities(data.revealed_cities);
      setStage("revealed");

      saveSession({
        selectedIndices,
        revealedCities: data.revealed_cities,
        readingCityIndex: null,
        readingMarkdown: null,
        stage: "revealed",
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "카드 열기에 실패했어요.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  // ── Select city for reading → /api/detail ───────────────────────

  const [selectedRevealedIndex, setSelectedRevealedIndex] = useState<
    number | null
  >(null);

  async function handleSelectForReading(cityIndex: number) {
    if (!revealedCities || !parsedData) return;
    setError(null);

    // Auth check
    try {
      const meRes = await fetch(`${API_URL}/auth/me`, {
        credentials: "include",
      });
      if (!meRes.ok) {
        // Save state and redirect to OAuth
        const v2: SessionV2 = {
          session_id: sessionId ?? "",
          allCities,
          selectedIndices,
          revealedCities,
          readingCityIndex: cityIndex,
          readingMarkdown: null,
          parsedData,
          stage: "revealed",
        };
        localStorage.setItem(SESSION_V2_KEY, JSON.stringify(v2));
        const legacy: TarotSession = {
          session_id: sessionId ?? "",
          selectedIndices,
          revealedCities,
          readingCityIndex: cityIndex,
          readingMarkdown: null,
          stage: "revealed",
        };
        localStorage.setItem(TAROT_SESSION_KEY, JSON.stringify(legacy));
        window.location.href = `${API_URL}/auth/google`;
        return;
      }
    } catch {
      const v2: SessionV2 = {
        session_id: sessionId ?? "",
        allCities,
        selectedIndices,
        revealedCities,
        readingCityIndex: cityIndex,
        readingMarkdown: null,
        parsedData,
        stage: "revealed",
      };
      localStorage.setItem(SESSION_V2_KEY, JSON.stringify(v2));
      window.location.href = `${API_URL}/auth/google`;
      return;
    }

    // Logged in
    const city = revealedCities[cityIndex];
    setReadingCity(city);
    setReadingMarkdown("");
    setStage("reading");

    saveSession({
      revealedCities,
      readingCityIndex: cityIndex,
      readingMarkdown: null,
      stage: "reading",
    });

    try {
      const res = await fetch("/api/detail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parsed_data: parsedData, city_index: cityIndex }),
      });
      if (!res.ok) throw new Error(`detail error: ${res.status}`);
      const data = (await res.json()) as { markdown: string };

      setReadingMarkdown(data.markdown);
      saveSession({
        revealedCities,
        readingCityIndex: cityIndex,
        readingMarkdown: data.markdown,
        stage: "reading",
      });
    } catch {
      setError("리딩을 불러오지 못했어요. 다시 시도해주세요.");
      setStage("revealed");
    }
  }

  function handleCompare() {
    setStage("comparing");
    saveSession({
      revealedCities: revealedCities ?? [],
      stage: "comparing",
    });
  }

  function handleRetry() {
    localStorage.removeItem(SESSION_V2_KEY);
    localStorage.removeItem(TAROT_SESSION_KEY);
    localStorage.removeItem(RECOMMEND_PAYLOAD_KEY);
    localStorage.removeItem("persona_type");
    router.push("/onboarding/quiz");
  }

  // ── Render ──────────────────────────────────────────────────────

  // Loading / Error
  if (stage === "loading") {
    if (error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
          <p className="text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={() => startRecommend()}
            className="px-6 py-2 text-sm font-medium bg-primary text-primary-foreground rounded"
          >
            다시 시도
          </button>
          <button
            type="button"
            onClick={handleRetry}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            처음부터 다시하기
          </button>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="animate-pulse text-sm text-muted-foreground">
          맞춤 도시를 분석하고 있어요...
        </p>
      </div>
    );
  }

  // Stage 1: selecting
  if (stage === "selecting") {
    const count = selectedIndices.length;
    const allSelected = count === 3;

    return (
      <div className="min-h-screen px-4 py-10">
        <div className="max-w-lg mx-auto flex flex-col gap-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground mb-1">
              도시를 선택하세요
            </h1>
            <p className="text-sm text-muted-foreground">
              3장을 선택하면 상세 정보를 열 수 있어요
            </p>
          </div>

          {/* Counter */}
          <div className="flex items-center justify-center gap-2">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={[
                    "w-2 h-2 rounded-full transition-colors",
                    i < count ? "bg-primary" : "bg-muted",
                  ].join(" ")}
                />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">
              {count}/3 선택됨
            </span>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          {/* City list */}
          <div className="flex flex-col gap-3">
            {allCities.map((city, i) => (
              <PreviewCard
                key={city.city}
                city={city}
                rank={i}
                selected={selectedIndices.includes(i)}
                onClick={() => toggleSelect(i)}
                disabled={allSelected && !selectedIndices.includes(i)}
              />
            ))}
          </div>

          {/* Confirm button */}
          {allSelected && (
            <button
              type="button"
              onClick={handleConfirmSelection}
              disabled={isLoading}
              className="w-full py-3 rounded-lg text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-60 transition-opacity"
            >
              {isLoading ? "열고 있어요..." : "선택 완료 →"}
            </button>
          )}


          <button
            type="button"
            onClick={handleRetry}
            className="text-sm text-muted-foreground hover:text-foreground text-center transition-colors"
          >
            처음부터 다시하기
          </button>
        </div>
      </div>
    );
  }

  // Stage 2: revealed
  if (stage === "revealed") {
    const lockedCities = allCities.filter(
      (_, i) => !selectedIndices.includes(i)
    );
    const canRead = selectedRevealedIndex !== null;

    return (
      <div className="min-h-screen px-4 py-10">
        <div className="max-w-lg mx-auto flex flex-col gap-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground mb-1">
              도시 상세 정보
            </h1>
            <p className="text-sm text-muted-foreground">
              자세히 알아보고 싶은 도시를 선택하세요
            </p>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          {/* Revealed cities */}
          <div className="flex flex-col gap-4">
            {(revealedCities ?? []).map((city, i) => (
              <RevealedCard
                key={city.city}
                city={city}
                rank={i}
                selected={selectedRevealedIndex === i}
                onClick={() =>
                  setSelectedRevealedIndex((prev) => (prev === i ? null : i))
                }
              />
            ))}
          </div>

          {/* Locked cities */}
          {lockedCities.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground text-center">
                선택되지 않은 도시
              </p>
              {lockedCities.map((city) => (
                <LockedCard key={city.city} city={city} />
              ))}
            </div>
          )}

          {/* Reading CTA */}
          <button
            type="button"
            onClick={() => {
              if (selectedRevealedIndex !== null)
                handleSelectForReading(selectedRevealedIndex);
            }}
            disabled={!canRead}
            className="w-full py-3 rounded-lg text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-40 transition-opacity"
          >
            리딩 받기 →
          </button>

          <button
            type="button"
            onClick={handleRetry}
            className="text-sm text-muted-foreground hover:text-foreground text-center transition-colors"
          >
            처음부터 다시하기
          </button>
        </div>
      </div>
    );
  }

  // Stage 3: reading
  if (stage === "reading") {
    if (!readingCity) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <p className="animate-pulse text-sm text-muted-foreground">
            도시 정보를 불러오는 중이에요...
          </p>
        </div>
      );
    }

    if (!readingMarkdown) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <p className="animate-pulse text-sm text-muted-foreground">
            {readingCity.city_kr} 리딩을 준비하고 있어요...
          </p>
        </div>
      );
    }

    return (
      <div className="min-h-screen px-4 py-10">
        <div className="max-w-lg mx-auto">
          {error && (
            <p className="text-sm text-destructive text-center mb-4">{error}</p>
          )}
          <TarotReading
            city={readingCity}
            markdown={readingMarkdown}
            onCompare={handleCompare}
          />
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setStage("revealed")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← 다른 도시 보기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Stage 4: comparing
  if (stage === "comparing") {
    return (
      <CityCompare cities={revealedCities ?? []} onRetry={handleRetry} />
    );
  }

  return null;
}
