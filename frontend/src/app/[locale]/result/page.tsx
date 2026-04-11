"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import TarotDeck from "@/components/tarot/TarotDeck";
import TarotReading from "@/components/tarot/TarotReading";
import CityCompare from "@/components/tarot/CityCompare";
import type { CityData, TarotSession } from "@/components/tarot/types";
import { TAROT_SESSION_KEY } from "@/components/tarot/types";

// ── Constants ──────────────────────────────────────────────────────

const RECOMMEND_PAYLOAD_KEY = "recommend_payload";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.nnai.app";

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

// ── Result Page ────────────────────────────────────────────────────

export default function ResultPage() {
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("loading");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [allCities, setAllCities] = useState<CityData[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [revealedCities, setRevealedCities] = useState<CityData[] | null>(null);
  const [readingMarkdown, setReadingMarkdown] = useState<string>("");
  const [parsedData, setParsedData] = useState<Record<string, unknown> | null>(
    null
  );
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

      // Legacy TarotSession key for OAuth redirect restore
      const legacy: TarotSession = {
        session_id: session.session_id,
        selectedIndices: session.selectedIndices,
        revealedCities: session.revealedCities,
        readingCityIndex: session.readingCityIndex,
        readingMarkdown: session.readingMarkdown,
        stage:
          session.stage === "selecting"
            ? "selecting"
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
    [
      sessionId,
      allCities,
      selectedIndices,
      revealedCities,
      readingMarkdown,
      parsedData,
    ]
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
        card_count?: number;
        parsed: Record<string, unknown>;
      };

      const topCities = (data.parsed?.top_cities ?? []) as CityData[];
      const cardCount = data.card_count ?? topCities.length;

      if (cardCount < 5 || topCities.length < 5) {
        setError("추천 도시를 불러오지 못했어요. 다시 시도해주세요.");
        setStage("loading");
        return;
      }

      setSessionId(data.session_id);
      setParsedData(data.parsed);
      setAllCities(topCities);
      setSelectedIndices([]);
      setRevealedCities(null);
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
      const legacy: TarotSession = {
        session_id: data.session_id,
        selectedIndices: [],
        revealedCities: [],
        readingCityIndex: null,
        readingMarkdown: null,
        stage: "selecting",
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
        setRevealedCities(
          saved.revealedCities?.length ? saved.revealedCities : null
        );
        setParsedData(saved.parsedData ?? null);
        setReadingMarkdown(saved.readingMarkdown ?? "");

        let resumeStage = saved.stage;
        // If reading but no data, fall back to revealed
        if (resumeStage === "reading" && !saved.revealedCities?.length) {
          resumeStage = "revealed";
        }
        setStage(resumeStage);
        return;
      } catch {
        localStorage.removeItem(SESSION_V2_KEY);
      }
    }

    // Fallback: legacy tarot session (for OAuth redirect return)
    const legacyStr = localStorage.getItem(TAROT_SESSION_KEY);
    if (legacyStr) {
      try {
        const saved = JSON.parse(legacyStr) as TarotSession;
        if (saved.session_id) {
          setSessionId(saved.session_id);
          setRevealedCities(
            saved.revealedCities?.length ? saved.revealedCities : null
          );
          setReadingMarkdown(saved.readingMarkdown ?? "");

          let resumeStage: Stage = "selecting";
          if (saved.stage === "revealed") resumeStage = "revealed";
          else if (saved.stage === "reading") {
            resumeStage = saved.revealedCities?.length
              ? "reading"
              : "revealed";
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

  // ── Select toggle ────────────────────────────────────────────────

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

  // ── Auto-transition: revealed → reading after 2s ────────────────

  useEffect(() => {
    if (stage !== "revealed" || !revealedCities?.length) return;
    const timer = setTimeout(() => {
      setStage("reading");
      saveSession({
        revealedCities: revealedCities ?? [],
        stage: "reading",
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [stage, revealedCities, saveSession]);

  // ── Request detail → OAuth gate + /api/detail ───────────────────

  async function handleRequestDetail(cityIndex: number) {
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
          stage: "reading",
        };
        localStorage.setItem(SESSION_V2_KEY, JSON.stringify(v2));
        const legacy: TarotSession = {
          session_id: sessionId ?? "",
          selectedIndices,
          revealedCities,
          readingCityIndex: cityIndex,
          readingMarkdown: null,
          stage: "reading",
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
        stage: "reading",
      };
      localStorage.setItem(SESSION_V2_KEY, JSON.stringify(v2));
      window.location.href = `${API_URL}/auth/google`;
      return;
    }

    // Logged in — fetch detail
    setReadingMarkdown("");
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

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      {/* Loading */}
      {stage === "loading" && (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
          {error ? (
            <>
              <p className="text-sm text-destructive">{error}</p>
              <button
                type="button"
                onClick={() => startRecommend()}
                className="px-6 py-2 text-sm font-medium bg-primary text-primary-foreground"
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
            </>
          ) : (
            <p className="animate-pulse text-sm text-muted-foreground">
              맞춤 도시를 분석하고 있어요...
            </p>
          )}
        </div>
      )}

      {/* Selecting: 5-card deck with backs */}
      {stage === "selecting" && (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 gap-8">
          <div className="text-center">
            <h1 className="font-serif text-xl font-bold text-foreground mb-1">
              당신의 도시를 선택하세요
            </h1>
            <p className="text-sm text-muted-foreground">
              끌리는 카드 3장을 선택하면 도시가 열립니다
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <TarotDeck
            cities={allCities}
            selectedIndices={selectedIndices}
            revealedCities={null}
            onToggleSelect={toggleSelect}
            onConfirm={handleConfirmSelection}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Revealed: front faces shown, auto-transitions to reading */}
      {stage === "revealed" && (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 gap-8">
          <div className="text-center">
            <h1 className="font-serif text-xl font-bold text-foreground mb-1">
              카드가 열렸습니다
            </h1>
            <p className="text-sm text-muted-foreground">
              리딩을 준비하고 있어요...
            </p>
          </div>

          <TarotDeck
            cities={allCities}
            selectedIndices={selectedIndices}
            revealedCities={revealedCities}
            onToggleSelect={() => {}}
            onConfirm={() => {}}
            isLoading={false}
          />
        </div>
      )}

      {/* Reading: sequential 3-card reading */}
      {stage === "reading" && revealedCities && (
        <TarotReading
          cities={revealedCities}
          onComplete={handleCompare}
          onRequestDetail={handleRequestDetail}
        />
      )}

      {/* Comparing: side-by-side city comparison */}
      {stage === "comparing" && (
        <CityCompare cities={revealedCities ?? []} onRetry={handleRetry} />
      )}
    </div>
  );
}
