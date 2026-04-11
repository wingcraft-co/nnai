"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { motion, AnimatePresence } from "framer-motion";
import TarotDeck from "@/components/tarot/TarotDeck";
import type { DeckStage } from "@/components/tarot/TarotDeck";
import type { CityData, TarotSession } from "@/components/tarot/types";
import { TAROT_SESSION_KEY } from "@/components/tarot/types";

// ── Constants ──────────────────────────────────────────────────────

const RECOMMEND_PAYLOAD_KEY = "recommend_payload";

// ── Stage ──────────────────────────────────────────────────────────

type Stage = "loading" | DeckStage;
// DeckStage = "selecting" | "revealing" | "reading" | "done"

// ── Session persistence ────────────────────────────────────────────

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
  const [parsedData, setParsedData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [toastVisible, setToastVisible] = useState(false);

  // ── Save session ────────────────────────────────────────────────

  const saveSession = useCallback(
    (overrides: Partial<SessionV2> & { stage: Stage }) => {
      const session: SessionV2 = {
        session_id: overrides.session_id ?? sessionId ?? "",
        allCities: overrides.allCities ?? allCities,
        selectedIndices: overrides.selectedIndices ?? selectedIndices,
        revealedCities: overrides.revealedCities ?? revealedCities ?? [],
        readingCityIndex: overrides.readingCityIndex ?? null,
        readingMarkdown: overrides.readingMarkdown ?? null,
        parsedData: overrides.parsedData ?? parsedData ?? null,
        stage: overrides.stage,
      };
      localStorage.setItem(SESSION_V2_KEY, JSON.stringify(session));

      // Legacy key for OAuth redirect
      const legacy: TarotSession = {
        session_id: session.session_id,
        selectedIndices: session.selectedIndices,
        revealedCities: session.revealedCities,
        readingCityIndex: session.readingCityIndex,
        readingMarkdown: session.readingMarkdown,
        stage: session.stage === "selecting" ? "selecting" : "reading",
      };
      localStorage.setItem(TAROT_SESSION_KEY, JSON.stringify(legacy));
    },
    [sessionId, allCities, selectedIndices, revealedCities, parsedData]
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
      if ((data.card_count ?? topCities.length) < 5 || topCities.length < 5) {
        setError("추천 도시를 불러오지 못했어요. 다시 시도해주세요.");
        setStage("loading");
        return;
      }

      localStorage.removeItem(RECOMMEND_PAYLOAD_KEY);

      setSessionId(data.session_id);
      setParsedData(data.parsed);
      setAllCities(topCities);
      setSelectedIndices([]);
      setRevealedCities(null);
      setFlippedIndices([]);
      setStage("selecting");

      saveSession({
        session_id: data.session_id,
        allCities: topCities,
        selectedIndices: [],
        revealedCities: [],
        parsedData: data.parsed,
        stage: "selecting",
      });
    } catch {
      setError("추천을 불러오지 못했어요. 다시 시도해주세요.");
      setStage("loading");
    }
  }, [router, saveSession]);

  // ── Mount: restore or start ──────────────────────────────────────

  useEffect(() => {
    const hasNewPayload = !!localStorage.getItem(RECOMMEND_PAYLOAD_KEY);

    if (hasNewPayload) {
      localStorage.removeItem(SESSION_V2_KEY);
      localStorage.removeItem(TAROT_SESSION_KEY);
      startRecommend();
      return;
    }

    // Restore previous session
    const savedStr = localStorage.getItem(SESSION_V2_KEY);
    if (savedStr) {
      try {
        const saved = JSON.parse(savedStr) as SessionV2;
        if (saved.stage !== "selecting" && saved.revealedCities?.length) {
          setSessionId(saved.session_id);
          setAllCities(saved.allCities ?? []);
          setSelectedIndices(saved.selectedIndices ?? []);
          setRevealedCities(saved.revealedCities);
          setParsedData(saved.parsedData ?? null);
          setFlippedIndices([0, 1, 2]);
          setStage("done");
          return;
        }
      } catch {
        // corrupted
      }
      localStorage.removeItem(SESSION_V2_KEY);
    }

    // Legacy fallback
    const legacyStr = localStorage.getItem(TAROT_SESSION_KEY);
    if (legacyStr) {
      try {
        const saved = JSON.parse(legacyStr) as TarotSession;
        if (saved.session_id && saved.revealedCities?.length) {
          setSessionId(saved.session_id);
          setRevealedCities(saved.revealedCities);
          setFlippedIndices([0, 1, 2]);
          setStage("done");
          return;
        }
      } catch {
        // corrupted
      }
      localStorage.removeItem(TAROT_SESSION_KEY);
    }

    router.replace("/onboarding/form");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Card selection ──────────────────────────────────────────────

  function toggleSelect(i: number) {
    setSelectedIndices((prev) => {
      if (prev.includes(i)) return prev.filter((x) => x !== i);
      if (prev.length >= 3) return prev;
      return [...prev, i];
    });
  }

  // ── Confirm → reveal → reading → done ──────────────────────────

  async function handleConfirm() {
    if (!sessionId || selectedIndices.length !== 3) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, selected_indices: selectedIndices }),
      });
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errData.error ?? `reveal error: ${res.status}`);
      }
      const data = (await res.json()) as { revealed_cities: CityData[] };

      setRevealedCities(data.revealed_cities);
      setFlippedIndices([]);
      setStage("revealing");

      saveSession({ selectedIndices, revealedCities: data.revealed_cities, stage: "revealing" });
      runFullSequence(data.revealed_cities);
    } catch (err) {
      setError(err instanceof Error ? err.message : "카드 열기에 실패했어요.");
    } finally {
      setIsLoading(false);
    }
  }

  function runFullSequence(cities: CityData[]) {
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    (async () => {
      await delay(300);
      setFlippedIndices([0]);
      await delay(1800);
      setFlippedIndices([0, 1]);
      await delay(1800);
      setFlippedIndices([0, 1, 2]);
      await delay(2000);

      setStage("done");
      saveSession({ revealedCities: cities, stage: "done" });
    })();
  }

  // ── Guide / retry ──────────────────────────────────────────────

  function handleGuideClick() {
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  }

  function handleRetry() {
    setStage("loading");
    setSessionId(null);
    setAllCities([]);
    setSelectedIndices([]);
    setRevealedCities(null);
    setFlippedIndices([]);
    setParsedData(null);
    setError(null);
    setIsLoading(false);
    localStorage.removeItem(SESSION_V2_KEY);
    localStorage.removeItem(TAROT_SESSION_KEY);
    localStorage.removeItem(RECOMMEND_PAYLOAD_KEY);
    localStorage.removeItem("persona_type");
    router.push("/onboarding/quiz");
  }

  // ── Render ──────────────────────────────────────────────────────

  const isDeckStage = stage !== "loading";

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      {/* Loading */}
      {stage === "loading" && (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
          {error ? (
            <>
              <p className="text-sm text-destructive">{error}</p>
              <button type="button" onClick={() => startRecommend()} className="px-6 py-2 text-sm font-medium bg-primary text-primary-foreground">
                다시 시도
              </button>
              <button type="button" onClick={handleRetry} className="text-sm text-muted-foreground hover:text-foreground">
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

      {/* Deck: selecting → revealing → reading → done (5장 고정) */}
      {isDeckStage && (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 gap-6">
          {stage === "selecting" && (
            <div className="text-center">
              <h1 className="font-serif text-xl font-bold text-foreground mb-1">
                당신의 도시를 선택하세요
              </h1>
              <p className="text-sm text-muted-foreground">
                끌리는 카드 3장을 선택하면 도시가 열립니다
              </p>
            </div>
          )}

          {stage === "revealing" && (
            <div className="text-center">
              <h1 className="font-serif text-xl font-bold text-foreground mb-1">
                카드가 열립니다
              </h1>
            </div>
          )}

          {error && stage === "selecting" && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <TarotDeck
            stage={stage as DeckStage}
            cities={allCities}
            selectedIndices={selectedIndices}
            revealedCities={revealedCities}
            flippedIndices={flippedIndices}
            onToggleSelect={toggleSelect}
            onConfirm={handleConfirm}
            onRetry={handleRetry}
            onGuideClick={handleGuideClick}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Toast */}
      <AnimatePresence>
        {toastVisible && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-3 bg-card border border-border text-sm text-foreground z-50"
          >
            곧 오픈될 예정이에요 🔜
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
