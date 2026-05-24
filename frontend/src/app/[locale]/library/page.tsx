"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Columns2, Download, House, Image as ImageIcon, LockKeyhole, X } from "lucide-react";

import { CountryBriefingDocument } from "@/components/guide/CountryBriefingDocument";
import type { CityData } from "@/components/tarot/types";
import { PERSONAS, type PersonaType } from "@/data/personas";
import cityScoresData from "@/data/city_scores.json";
import type { BriefingData } from "@/lib/briefing-data";
import { briefingFromMarkdownWithFallback, briefingToMarkdown } from "@/lib/briefing-markdown";
import { countryFlagEmoji } from "@/lib/country-flag";
import { buildGuideExportFilename } from "@/lib/guide-export.mjs";
import {
  applyLibraryAuthScope,
  buildLibraryDisplayCards,
  calculateTemporaryCardOpacity,
  libraryCardsFromServerGuides,
  mergeLibraryCards,
  NOMAD_LIBRARY_CHANGE_EVENT,
  readLibraryCards,
  type DisplayLibraryCard,
  type LibraryCard,
  type LibraryGuideCacheEntry,
  writeLibraryCards,
} from "@/lib/library-storage";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";
const EMPTY_LIBRARY_CARDS: LibraryCard[] = [];
const BRIEFING_DOCUMENT_WIDTH = 1080;
type LibraryCitySource = Partial<CityData> & Pick<CityData, "city" | "country" | "country_id">;
const ALL_LIBRARY_CITIES = ((cityScoresData as unknown as { cities?: LibraryCitySource[] }).cities ?? []);

type AuthUser = {
  logged_in: boolean;
};

type LibraryGuidesResponse = {
  guides?: LibraryGuideCacheEntry[];
};

function subscribeLibraryCards(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(NOMAD_LIBRARY_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(NOMAD_LIBRARY_CHANGE_EVENT, onStoreChange);
  };
}

function getLibraryCardsSnapshot() {
  return readLibraryCards();
}

function getServerLibraryCardsSnapshot() {
  return EMPTY_LIBRARY_CARDS;
}

function downloadUrl(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function guideMarkdown(card: LibraryCard): string | null {
  if (card.guide_briefing) return briefingToMarkdown(card.guide_briefing);
  return card.guide_markdown ?? null;
}

function guideBriefing(card: LibraryCard): BriefingData | null {
  if (card.guide_briefing) return card.guide_briefing;
  if (!card.guide_markdown) return null;
  return briefingFromMarkdownWithFallback(card.guide_markdown, {
    cityName: card.city,
    cityKr: card.city_kr,
    country: card.country,
    countryId: card.country_id,
    visaType: card.visa_type,
    monthlyCostUsd: card.monthly_cost_usd,
  });
}

function cityExportLabel(card: LibraryCard): string {
  return card.city || card.city_kr || "guide";
}

function normalizeLibraryCityId(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, "-");
}

function guidePathForLibraryCard(card: LibraryCard, locale: string): string {
  return `/${locale}/guide/${encodeURIComponent(normalizeLibraryCityId(card.city))}`;
}

function isPersonaType(value: string | null): value is PersonaType {
  return Boolean(value && value in PERSONAS);
}

function readStoredPersonaType(): PersonaType | null {
  try {
    const value = localStorage.getItem("persona_type");
    return isPersonaType(value) ? value : null;
  } catch {
    return null;
  }
}

function LockedTextBar({
  source,
  maxWidth,
}: {
  source: string;
  maxWidth: number;
}) {
  const width = Math.min(maxWidth, Math.max(42, source.length * 8));

  return (
    <span
      aria-hidden="true"
      className="block h-3.5 rounded-sm bg-muted/55 opacity-70 blur-[1px]"
      style={{ width }}
    />
  );
}

function downloadMarkdown(card: LibraryCard) {
  const markdown = guideMarkdown(card);
  if (!markdown) return;
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  downloadUrl(url, buildGuideExportFilename(cityExportLabel(card), "md"));
  URL.revokeObjectURL(url);
}

async function briefingNodeToPngUrl(node: HTMLElement): Promise<string> {
  if (typeof document !== "undefined" && document.fonts) {
    await document.fonts.ready;
  }
  const { toPng } = await import("html-to-image");
  return toPng(node, {
    width: BRIEFING_DOCUMENT_WIDTH,
    pixelRatio: 2,
    backgroundColor: "#FAF8F4",
    cacheBust: true,
    style: {
      transform: "none",
      transformOrigin: "top left",
    },
  });
}

async function downloadBriefingPng(node: HTMLElement | null, card: LibraryCard) {
  if (!node) return;
  const url = await briefingNodeToPngUrl(node);
  downloadUrl(url, buildGuideExportFilename(cityExportLabel(card), "png"));
}

function FormattedBriefingPreview({
  data,
  documentRef,
}: {
  data: BriefingData;
  documentRef: RefObject<HTMLDivElement | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ scale: 1, height: 0 });

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;

    function updateLayout() {
      const containerWidth = containerRef.current?.offsetWidth ?? BRIEFING_DOCUMENT_WIDTH;
      const naturalHeight = documentRef.current?.offsetHeight ?? 0;
      const scale = Math.min(1, containerWidth / BRIEFING_DOCUMENT_WIDTH);
      setLayout({ scale, height: naturalHeight * scale });
    }

    updateLayout();
    const observer = new ResizeObserver(updateLayout);
    if (containerRef.current) observer.observe(containerRef.current);
    if (documentRef.current) observer.observe(documentRef.current);

    return () => observer.disconnect();
  }, [data, documentRef]);

  return (
    <div ref={containerRef} className="w-full overflow-hidden bg-[#FAF8F4]">
      <div style={{ height: layout.height || undefined }}>
        <div
          ref={documentRef}
          style={{
            width: `${BRIEFING_DOCUMENT_WIDTH}px`,
            transform: `scale(${layout.scale})`,
            transformOrigin: "top left",
          }}
        >
          <CountryBriefingDocument data={data} watermark={false} />
        </div>
      </div>
    </div>
  );
}

function MarkdownFallback({ markdown }: { markdown: string }) {
  const rows = markdown.split("\n").filter((line) => line.trim());
  return (
    <div className="bg-[#FAF8F4] px-7 py-8 text-[#1A1A1A] sm:px-10">
      <div className="mx-auto max-w-2xl space-y-3">
        {rows.map((line, index) => {
          if (line.startsWith("# ")) {
            return <h1 key={index} className="font-serif text-2xl font-bold">{line.slice(2)}</h1>;
          }
          if (line.startsWith("## ")) {
            return <h2 key={index} className="pt-5 font-serif text-lg font-bold">{line.slice(3)}</h2>;
          }
          if (line.startsWith("### ")) {
            return <h3 key={index} className="pt-3 font-serif text-base font-semibold italic">{line.slice(4)}</h3>;
          }
          if (line.startsWith("- ")) {
            return <p key={index} className="pl-4 text-sm leading-7">• {line.slice(2)}</p>;
          }
          return <p key={index} className="text-sm leading-7">{line}</p>;
        })}
      </div>
    </div>
  );
}

function ReportPreviewPane({ card }: { card: LibraryCard }) {
  const documentRef = useRef<HTMLDivElement>(null);
  const briefing = guideBriefing(card);
  const markdown = guideMarkdown(card);

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background">
      <header className="border-b border-border px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-normal text-primary">REPORT</p>
        <h3 className="truncate font-serif text-base font-bold text-foreground">
          {card.city_kr || card.city}
        </h3>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto bg-[#FAF8F4]">
        {briefing ? (
          <FormattedBriefingPreview data={briefing} documentRef={documentRef} />
        ) : markdown ? (
          <MarkdownFallback markdown={markdown} />
        ) : null}
      </div>
    </section>
  );
}

export default function LibraryPage() {
  const locale = useLocale();
  const router = useRouter();

  function handleHomeClick() {
    let hasPersona = false;
    try {
      hasPersona = Boolean(localStorage.getItem("persona_type"));
    } catch {
      hasPersona = false;
    }
    if (hasPersona) {
      router.push("/onboarding/form");
    } else {
      router.push("/?nav=home");
    }
  }

  const isKorean = locale === "ko";
  const cards = useSyncExternalStore(
    subscribeLibraryCards,
    getLibraryCardsSnapshot,
    getServerLibraryCardsSnapshot,
  );
  const [auth, setAuth] = useState<AuthUser | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [selectedCard, setSelectedCard] = useState<LibraryCard | null>(null);
  const [compareKeys, setCompareKeys] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [personaType, setPersonaType] = useState<PersonaType | null>(null);
  const briefingDocumentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 10_000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/auth/me`, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        applyLibraryAuthScope(payload);
        if (!cancelled) setAuth({ logged_in: Boolean(payload?.logged_in) });
      })
      .catch(() => {
        applyLibraryAuthScope(null);
        if (!cancelled) setAuth({ logged_in: false });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPersonaType(readStoredPersonaType());
  }, []);

  useEffect(() => {
    if (!auth?.logged_in) return;
    let cancelled = false;

    fetch(`${API_BASE}/api/library/guides`, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: LibraryGuidesResponse | null) => {
        if (cancelled || !Array.isArray(payload?.guides)) return;
        const serverCards = libraryCardsFromServerGuides(payload.guides);
        if (!serverCards.length) return;
        writeLibraryCards(mergeLibraryCards(readLibraryCards(), serverCards));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [auth?.logged_in]);

  const isLoggedIn = Boolean(auth?.logged_in);
  const displayCards = useMemo(() => buildLibraryDisplayCards(cards, ALL_LIBRARY_CITIES), [cards]);
  const reportCards = useMemo(
    () => displayCards.filter((card) => card.display_status === "report"),
    [displayCards]
  );
  const collectedCards = useMemo(
    () => displayCards.filter((card) => card.display_status === "card"),
    [displayCards]
  );
  const lockedCards = useMemo(
    () => displayCards.filter((card) => card.display_status === "locked"),
    [displayCards]
  );
  const text = {
    eyebrow: isKorean ? "보관함" : "Library",
    title: isKorean ? "내 노마드 카드" : "My Nomad Cards",
    tipComparePrefix: isKorean ? "구매한 보고서들은" : "Purchased reports can be compared with",
    tipCompareSuffix: isKorean ? "버튼을 사용해 비교가 가능합니다." : "button.",
    compareIconLabel: isKorean ? "비교 아이콘 예시" : "Compare icon example",
    empty: isKorean
      ? "아직 보관된 도시 카드가 없습니다."
      : "No saved city cards yet.",
    guideReady: isKorean ? "REPORT" : "REPORT",
    collected: isKorean ? "CARD" : "CARD",
    locked: isKorean ? "LOCKED" : "LOCKED",
    openGuide: isKorean ? "맞춤 가이드 열기" : "Open guide",
    buyGuide: isKorean ? "가이드 구매" : "Buy guide",
    findCity: isKorean ? "나에게 맞는 도시 찾기" : "Find my city",
    compare: isKorean ? "비교" : "Compare",
    compareTitle: isKorean ? "맞춤 보고서 비교" : "Compare Reports",
    modalEyebrow: isKorean ? "저장된 맞춤 보고서" : "Saved Custom Report",
    sectionReports: "REPORTS",
    sectionCards: "CARDS",
    sectionLocked: "LOCKED CARDS",
  };
  const persona = personaType ? PERSONAS[personaType] : null;
  const personaLabel = persona ? (isKorean ? persona.label : persona.labelEn) : null;
  const modalMarkdown = selectedCard ? guideMarkdown(selectedCard) : null;
  const modalBriefing = selectedCard ? guideBriefing(selectedCard) : null;
  const compareCards = compareKeys
    .map((key) => displayCards.find((card) => card.key === key))
    .filter((card): card is DisplayLibraryCard => Boolean(card));

  function closeCompareModal() {
    setCompareOpen(false);
    setCompareKeys([]);
  }

  function toggleCompareCard(card: LibraryCard) {
    setCompareKeys((current) => {
      if (current.includes(card.key)) return current.filter((key) => key !== card.key);
      const next = [...current.slice(-1), card.key];
      if (next.length === 2) setCompareOpen(true);
      return next;
    });
  }

  return (
    <main className="dark min-h-screen w-full min-w-0 flex-1 bg-background px-5 py-14 text-foreground">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <div>
            <button
              type="button"
              onClick={handleHomeClick}
              className="mb-4 inline-flex shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
              aria-label={isKorean ? "홈으로" : "Go home"}
            >
              <House className="size-4" />
            </button>
            <p className="text-xs font-semibold uppercase tracking-normal text-primary">{text.eyebrow}</p>
            <div className="mt-2 flex items-center justify-between gap-4">
              <h1 className="min-w-0 font-serif text-3xl font-bold leading-none">{text.title}</h1>
              {persona && personaLabel && (
                <div className="inline-flex h-9 max-w-[52vw] shrink-0 items-center gap-2 rounded-full bg-card/80 px-2.5 shadow-[0_14px_32px_rgba(0,0,0,0.22)] sm:max-w-xs">
                  <span className="truncate font-serif text-sm font-bold leading-none text-foreground">
                    {personaLabel}
                  </span>
                  <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-background/70">
                    <img
                      src={`/${personaType}.gif`}
                      alt={personaLabel}
                      className="size-8 object-contain"
                    />
                  </span>
                </div>
              )}
            </div>
            {isLoggedIn && (
              <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                <span>{text.tipComparePrefix}</span>
                <span
                  className="inline-flex size-7 items-center justify-center rounded-full border border-border/60 bg-background/80 text-muted-foreground"
                  aria-label={text.compareIconLabel}
                  role="img"
                >
                  <Columns2 className="size-3.5" />
                </span>
                <span>{text.tipCompareSuffix}</span>
              </p>
            )}
          </div>
        </header>

        {displayCards.length === 0 ? (
          <section className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            {text.empty}
          </section>
        ) : (
          (() => {
            const renderCard = (card: DisplayLibraryCard) => {
              const hasGuide = card.display_status === "report";
              const isCollected = card.display_status === "card";
              const isLocked = card.display_status === "locked";
              const showCompareButton = hasGuide && reportCards.length > 1;
              const opacity = isLocked ? 0.48 : calculateTemporaryCardOpacity(card.collected_at, now, isLoggedIn);

              return (
                <article
                  key={card.key}
                  className="group relative flex aspect-[2/3] min-h-0 flex-col justify-between overflow-hidden rounded-md border border-border bg-card/80 p-3 text-left shadow-[0_18px_40px_rgba(0,0,0,0.25)] transition-transform hover:-translate-y-0.5"
                  style={{ opacity }}
                >
                  {showCompareButton && (
                    <button
                      type="button"
                      onClick={() => toggleCompareCard(card)}
                      className={`absolute right-2 top-2 z-10 inline-flex size-7 cursor-pointer items-center justify-center rounded-full border border-border/60 text-[10px] font-semibold transition-colors ${
                        compareKeys.includes(card.key)
                          ? "bg-primary text-primary-foreground"
                          : "bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                      aria-label={`${card.city_kr || card.city} ${text.compare}`}
                      title={text.compare}
                    >
                      <Columns2 className="size-3.5" />
                    </button>
                  )}
                  {/* 화투 크기처럼 작게 보이도록 정보 밀도를 낮춘 수집 카드 */}
                  <div className={`space-y-1 ${showCompareButton ? "pr-4" : ""}`}>
                    {isLocked ? (
                      <p className="text-[10px] font-semibold uppercase tracking-normal text-primary/70">
                        {text.locked}
                      </p>
                    ) : (
                      <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-normal text-primary/80">
                        {hasGuide ? text.guideReady : text.collected}
                      </p>
                    )}
                    {isLocked ? (
                      <div className="space-y-2 pt-2">
                        <LockedTextBar source={card.city_kr || card.city} maxWidth={110} />
                        <LockedTextBar source={`${card.city}, ${card.country}`} maxWidth={86} />
                      </div>
                    ) : (
                      <>
                        <h2 className="line-clamp-3 whitespace-pre-line break-keep font-serif text-base font-bold leading-tight text-foreground">
                          {((card.city_kr || card.city) ?? "").replace(/\s*\(/, "\n(")}
                          {" "}
                          <span className="align-baseline font-sans text-base font-normal leading-normal" aria-hidden="true">
                            {countryFlagEmoji(card.country_id)}
                          </span>
                        </h2>
                        <p className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                          {card.city}, {card.country}
                        </p>
                      </>
                    )}
                  </div>

                  {isLocked && (
                    <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-background/70 p-4 text-muted-foreground shadow-[0_0_24px_rgba(0,0,0,0.28)]">
                      <LockKeyhole className="size-9" />
                    </div>
                  )}

                  <div className="space-y-2">
                    {isLocked ? (
                      <Link
                        href={`/${locale}/onboarding/form`}
                        className="flex h-8 w-full cursor-pointer items-center justify-center rounded-md bg-primary px-2 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        {text.findCity}
                      </Link>
                    ) : isCollected ? (
                      <Link
                        href={`${guidePathForLibraryCard(card, locale)}?from=library`}
                        className="flex h-8 w-full cursor-pointer items-center justify-center rounded-md bg-primary px-2 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        {text.buyGuide}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={!hasGuide}
                        onClick={() => setSelectedCard(card)}
                        className="h-8 w-full cursor-pointer rounded-md bg-primary px-2 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                      >
                        {text.openGuide}
                      </button>
                    )}
                  </div>
                </article>
              );
            };

            const groups: Array<{ key: string; label: string; count: number; cards: DisplayLibraryCard[] }> = [
              { key: "report", label: text.sectionReports, count: reportCards.length, cards: reportCards },
              { key: "card", label: text.sectionCards, count: collectedCards.length, cards: collectedCards },
              { key: "locked", label: text.sectionLocked, count: lockedCards.length, cards: lockedCards },
            ];

            return (
              <div className="space-y-8">
                {groups.map((group) => (
                  group.cards.length > 0 ? (
                    <section key={group.key} className="space-y-3">
                      <header className="border-b border-border/60 pb-2">
                        <h2 className="text-xs font-semibold uppercase tracking-normal text-primary">
                          {group.count} {group.label}
                        </h2>
                      </header>
                      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                        {group.cards.map(renderCard)}
                      </div>
                    </section>
                  ) : null
                ))}
              </div>
            );
          })()
        )}
      </div>

      {selectedCard && (
        <div className="fixed inset-0 z-50 bg-black/75 px-3 py-5 backdrop-blur-sm sm:px-6">
          <section className="mx-auto flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl">
            <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-normal text-primary">{text.modalEyebrow}</p>
                <h2 className="truncate font-serif text-lg font-bold">
                  {selectedCard.city_kr || selectedCard.city} 맞춤 가이드
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {modalBriefing && (
                  <button
                    type="button"
                    onClick={() => void downloadBriefingPng(briefingDocumentRef.current, selectedCard)}
                    className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="PNG로 저장"
                    title="PNG로 저장"
                  >
                    <ImageIcon className="size-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => downloadMarkdown(selectedCard)}
                  className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="MD로 저장"
                  title="MD로 저장"
                >
                  <Download className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCard(null)}
                  className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={isKorean ? "닫기" : "Close"}
                >
                  <X className="size-4" />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto bg-[#FAF8F4]">
              {modalBriefing ? (
                <FormattedBriefingPreview data={modalBriefing} documentRef={briefingDocumentRef} />
              ) : modalMarkdown ? (
                <MarkdownFallback markdown={modalMarkdown} />
              ) : null}
            </div>
          </section>
        </div>
      )}

      {compareOpen && compareCards.length === 2 && (
        <div className="fixed inset-0 z-50 bg-black/80 px-3 py-5 backdrop-blur-sm sm:px-6">
          <section className="mx-auto flex max-h-full w-full max-w-[1400px] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl">
            <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-normal text-primary">COMPARE</p>
                <h2 className="truncate font-serif text-lg font-bold">{text.compareTitle}</h2>
              </div>
              <button
                type="button"
                onClick={closeCompareModal}
                className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={isKorean ? "닫기" : "Close"}
              >
                <X className="size-4" />
              </button>
            </header>
            <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 lg:grid-cols-2 lg:overflow-hidden">
              {compareCards.map((card) => (
                <ReportPreviewPane key={card.key} card={card} />
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
