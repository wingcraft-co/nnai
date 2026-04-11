"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "@/i18n/navigation";
import { motion, AnimatePresence } from "framer-motion";
import TarotDeck from "@/components/tarot/TarotDeck";
import TarotCard from "@/components/tarot/TarotCard";
import CityCompare from "@/components/tarot/CityCompare";
import type { CityData, TarotSession } from "@/components/tarot/types";
import { TAROT_SESSION_KEY } from "@/components/tarot/types";

// ── Constants ──────────────────────────────────────────────────────

const RECOMMEND_PAYLOAD_KEY = "recommend_payload";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.nnai.app";

// ── Stage type ─────────────────────────────────────────────────────

type Stage = "loading" | "selecting" | "revealed" | "reading" | "complete" | "comparing";

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

// ── Typing effect hook ────────────────────────────────────────────

function useTypingEffect(text: string, speed: number = 50) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    if (!text) {
      setDone(true);
      return;
    }

    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return { displayed, done };
}

// ── Reading text component (typing under card) ────────────────────

function ReadingText({
  text,
  onComplete,
}: {
  text: string;
  onComplete: () => void;
}) {
  const { displayed, done } = useTypingEffect(text, 50);
  const calledRef = useRef(false);

  useEffect(() => {
    if (done && !calledRef.current) {
      calledRef.current = true;
      const timer = setTimeout(onComplete, 1500);
      return () => clearTimeout(timer);
    }
  }, [done, onComplete]);

  if (!text) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-xs border-l-2 border-primary pl-4 mt-4"
    >
      <p className="font-serif text-sm text-foreground leading-relaxed">
        {displayed}
        {!done && <span className="animate-pulse text-primary">|</span>}
      </p>
    </motion.div>
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
  const [readingMarkdown, setReadingMarkdown] = useState<string>("");
  const [parsedData, setParsedData] = useState<Record<string, unknown> | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [currentReadingIndex, setCurrentReadingIndex] = useState(0);
  const [toastVisible, setToastVisible] = useState(false);

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
            : session.stage === "reading" || session.stage === "complete"
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
      setFlippedIndices([]);
      setReadingMarkdown("");
      setCurrentReadingIndex(0);

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

        // If saved stage is "selecting", don't restore — start fresh
        if (saved.stage === "selecting") {
          localStorage.removeItem(SESSION_V2_KEY);
          localStorage.removeItem(TAROT_SESSION_KEY);
        } else {
          setSessionId(saved.session_id);
          setAllCities(saved.allCities ?? []);
          setSelectedIndices(saved.selectedIndices ?? []);
          setRevealedCities(
            saved.revealedCities?.length ? saved.revealedCities : null
          );
          setParsedData(saved.parsedData ?? null);
          setReadingMarkdown(saved.readingMarkdown ?? "");

          let resumeStage: Stage = saved.stage;
          if (resumeStage === "reading" && !saved.revealedCities?.length) {
            resumeStage = "selecting";
          }
          // Cards already flipped for post-reveal stages
          if (resumeStage === "revealed" || resumeStage === "reading" || resumeStage === "complete" || resumeStage === "comparing") {
            setFlippedIndices([0, 1, 2]);
          }
          setStage(resumeStage);
          return;
        }
      } catch {
        localStorage.removeItem(SESSION_V2_KEY);
      }
    }

    // Fallback: legacy tarot session (for OAuth redirect return only)
    const legacyStr = localStorage.getItem(TAROT_SESSION_KEY);
    if (legacyStr) {
      try {
        const saved = JSON.parse(legacyStr) as TarotSession;
        if (saved.session_id && saved.stage !== "selecting") {
          setSessionId(saved.session_id);
          setRevealedCities(
            saved.revealedCities?.length ? saved.revealedCities : null
          );
          setReadingMarkdown(saved.readingMarkdown ?? "");
          setFlippedIndices([0, 1, 2]);

          let resumeStage: Stage = "complete";
          if (saved.stage === "revealed") resumeStage = "complete";
          else if (saved.stage === "reading") {
            resumeStage = saved.revealedCities?.length ? "complete" : "selecting";
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
      setFlippedIndices([]);
      setCurrentReadingIndex(0);
      setStage("revealed");

      saveSession({
        selectedIndices,
        revealedCities: data.revealed_cities,
        readingCityIndex: null,
        readingMarkdown: null,
        stage: "revealed",
      });

      // Sequential flip → reading sequence
      startRevealAndReadingSequence(data.revealed_cities);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "카드 열기에 실패했어요.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  // ── Sequential flip → reading (card stays, text below) ──────────

  function startRevealAndReadingSequence(cities: CityData[]) {
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    (async () => {
      // Phase 1: Sequential flip
      await delay(400);
      setFlippedIndices([0]);
      await delay(2000);
      setFlippedIndices([0, 1]);
      await delay(2000);
      setFlippedIndices([0, 1, 2]);
      await delay(2500);

      // Phase 2: Reading — card stays, text types below
      setStage("reading");
      setCurrentReadingIndex(0);

      saveSession({
        revealedCities: cities,
        stage: "reading",
      });
    })();
  }

  // ── Reading: advance to next card (called by ReadingText onComplete)

  const handleReadingComplete = useCallback(() => {
    if (!revealedCities) return;
    const nextIndex = currentReadingIndex + 1;
    if (nextIndex < revealedCities.length) {
      setCurrentReadingIndex(nextIndex);
    } else {
      setStage("complete");
      saveSession({
        revealedCities,
        stage: "complete" as Stage,
      });
    }
  }, [currentReadingIndex, revealedCities, saveSession]);

  function handleCompare() {
    setStage("comparing");
    saveSession({
      revealedCities: revealedCities ?? [],
      stage: "comparing",
    });
  }

  function handleGuideClick() {
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  }

  function handleRetry() {
    // Full state reset
    setStage("loading");
    setSessionId(null);
    setAllCities([]);
    setSelectedIndices([]);
    setRevealedCities(null);
    setFlippedIndices([]);
    setReadingMarkdown("");
    setParsedData(null);
    setError(null);
    setIsLoading(false);
    setCurrentReadingIndex(0);

    // Clear all localStorage
    localStorage.removeItem(SESSION_V2_KEY);
    localStorage.removeItem(TAROT_SESSION_KEY);
    localStorage.removeItem(RECOMMEND_PAYLOAD_KEY);
    localStorage.removeItem("persona_type");

    router.push("/onboarding/quiz");
  }

  // ── Current reading city ─────────────────────────────────────────

  const currentReadingCity = revealedCities?.[currentReadingIndex] ?? null;

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
            flippedIndices={[]}
            onToggleSelect={toggleSelect}
            onConfirm={handleConfirmSelection}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Revealed: sequential flip animation */}
      {stage === "revealed" && (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 gap-8">
          <div className="text-center">
            <h1 className="font-serif text-xl font-bold text-foreground mb-1">
              카드가 열립니다
            </h1>
          </div>

          <TarotDeck
            cities={allCities}
            selectedIndices={selectedIndices}
            revealedCities={revealedCities}
            flippedIndices={flippedIndices}
            onToggleSelect={() => {}}
            onConfirm={() => {}}
            isLoading={false}
          />
        </div>
      )}

      {/* Reading: card + typing text below */}
      {stage === "reading" && currentReadingCity && (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 gap-6">
          {/* Card number */}
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Card {currentReadingIndex + 1} of {revealedCities?.length ?? 3}
          </span>

          {/* Card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentReadingIndex}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
              className="w-[180px] md:w-[200px]"
            >
              <TarotCard
                state="front"
                cityData={currentReadingCity}
                isFlipped={true}
              />
            </motion.div>
          </AnimatePresence>

          {/* Typing text below card */}
          <ReadingText
            key={currentReadingIndex}
            text={currentReadingCity.reading_text ?? ""}
            onComplete={handleReadingComplete}
          />
        </div>
      )}

      {/* Complete: all cards read */}
      {stage === "complete" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="min-h-screen flex flex-col items-center justify-center gap-8 px-4 py-16"
        >
          <h2 className="font-serif text-xl font-bold text-foreground text-center">
            세 장의 카드가 모두 열렸습니다
          </h2>

          <button
            type="button"
            onClick={handleCompare}
            className="w-full max-w-xs py-3.5 text-sm font-semibold bg-primary text-primary-foreground transition-opacity"
          >
            도시 비교 보기 →
          </button>

          <div className="flex flex-col items-center gap-3">
            <p className="text-xs text-muted-foreground">
              더 깊은 가이드가 필요하다면
            </p>
            <button
              type="button"
              onClick={handleGuideClick}
              className="px-6 py-2.5 text-sm font-medium border border-border text-foreground hover:border-primary transition-colors"
            >
              전체 가이드 받기
            </button>
          </div>
        </motion.div>
      )}

      {/* Comparing: side-by-side city comparison */}
      {stage === "comparing" && (
        <CityCompare cities={revealedCities ?? []} onRetry={handleRetry} />
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
