"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { useLocale } from "next-intl";
import { Download, Image as ImageIcon, Printer, X } from "lucide-react";

import { CountryBriefingDocument } from "@/components/guide/CountryBriefingDocument";
import type { BriefingData } from "@/lib/briefing-data";
import { briefingFromMarkdown, briefingToMarkdown } from "@/lib/briefing-markdown";
import { buildGuideExportFilename } from "@/lib/guide-export.mjs";
import {
  calculateTemporaryCardOpacity,
  libraryCardsFromServerGuides,
  mergeLibraryCards,
  NOMAD_LIBRARY_CHANGE_EVENT,
  readLibraryCards,
  type LibraryCard,
  type LibraryGuideCacheEntry,
  writeLibraryCards,
} from "@/lib/library-storage";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";
const EMPTY_LIBRARY_CARDS: LibraryCard[] = [];
const BRIEFING_DOCUMENT_WIDTH = 1080;

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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
  return briefingFromMarkdown(card.guide_markdown);
}

function cityExportLabel(card: LibraryCard): string {
  return card.city || card.city_kr || "guide";
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

async function printBriefingDocument(node: HTMLElement | null, card: LibraryCard) {
  if (node) {
    const url = await briefingNodeToPngUrl(node);
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      window.print();
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>${escapeHtml(card.city_kr || card.city)} 맞춤 가이드</title>
          <style>
            @page { margin: 0; }
            body { margin: 0; background: #FAF8F4; }
            img { width: 100%; display: block; }
          </style>
        </head>
        <body>
          <img src="${url}" alt="NomadNavigator AI Country Briefing" />
          <script>
            window.onload = () => {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    return;
  }

  const markdown = guideMarkdown(card);
  if (!markdown) return;
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) {
    window.print();
    return;
  }
  printWindow.document.write(`
    <html>
      <head>
        <title>${escapeHtml(card.city_kr || card.city)} 맞춤 가이드</title>
        <style>
          body { margin: 48px; background: #FAF8F4; color: #1A1A1A; font-family: Georgia, "Noto Serif KR", serif; line-height: 1.7; }
          pre { white-space: pre-wrap; font-family: inherit; }
        </style>
      </head>
      <body>
        <pre>${escapeHtml(markdown)}</pre>
        <script>window.print();</script>
      </body>
    </html>
  `);
  printWindow.document.close();
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

export default function LibraryPage() {
  const locale = useLocale();
  const isKorean = locale === "ko";
  const cards = useSyncExternalStore(
    subscribeLibraryCards,
    getLibraryCardsSnapshot,
    getServerLibraryCardsSnapshot,
  );
  const [auth, setAuth] = useState<AuthUser | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [selectedCard, setSelectedCard] = useState<LibraryCard | null>(null);
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
        if (!cancelled) setAuth({ logged_in: Boolean(payload?.logged_in) });
      })
      .catch(() => {
        if (!cancelled) setAuth({ logged_in: false });
      });

    return () => {
      cancelled = true;
    };
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
  const guideCount = useMemo(() => cards.filter((card) => card.guide_unlocked).length, [cards]);
  const text = {
    eyebrow: isKorean ? "보관함" : "Library",
    title: isKorean ? "내 노마드 카드" : "My Nomad Cards",
    loggedInCopy: isKorean
      ? "구매한 보고서를 프로필 보관함에서 다시 확인할 수 있습니다."
      : "Purchased reports can be reopened from your profile library.",
    temporaryCopy: isKorean
      ? "비로그인 임시 카드는 로그인하면 영구 보관됩니다."
      : "Guest cards become permanent after login.",
    empty: isKorean
      ? "아직 보관된 도시 카드가 없습니다."
      : "No saved city cards yet.",
    guideReady: isKorean ? "REPORT" : "REPORT",
    collected: isKorean ? "CARD" : "CARD",
    keepLogin: isKorean ? "로그인하면 영구 보관" : "Log in to keep",
    openGuide: isKorean ? "맞춤 가이드 열기" : "Open guide",
    lockedGuide: isKorean ? "가이드 없음" : "No guide",
    modalEyebrow: isKorean ? "저장된 맞춤 보고서" : "Saved Custom Report",
  };
  const modalMarkdown = selectedCard ? guideMarkdown(selectedCard) : null;
  const modalBriefing = selectedCard ? guideBriefing(selectedCard) : null;

  return (
    <main className="dark min-h-screen w-full min-w-0 flex-1 bg-background px-5 py-14 text-foreground">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-primary">{text.eyebrow}</p>
            <h1 className="mt-2 font-serif text-3xl font-bold">{text.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isLoggedIn ? text.loggedInCopy : text.temporaryCopy}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {cards.length} cards · {guideCount} reports
          </p>
        </header>

        {cards.length === 0 ? (
          <section className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            {text.empty}
          </section>
        ) : (
          <section className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {cards.map((card) => {
              const opacity = calculateTemporaryCardOpacity(card.collected_at, now, isLoggedIn);
              const isFaded = opacity <= 0.4 && !isLoggedIn;
              const hasGuide = card.guide_unlocked && Boolean(card.guide_markdown || card.guide_briefing);

              return (
                <article
                  key={card.key}
                  className="group relative flex aspect-[2/3] min-h-0 flex-col justify-between overflow-hidden rounded-md border border-border bg-card/80 p-3 text-left shadow-[0_18px_40px_rgba(0,0,0,0.25)] transition-transform hover:-translate-y-0.5"
                  style={{ opacity }}
                >
                  {/* 화투 크기처럼 작게 보이도록 정보 밀도를 낮춘 수집 카드 */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-normal text-primary/80">
                      {hasGuide ? text.guideReady : text.collected}
                    </p>
                    <h2 className="line-clamp-3 font-serif text-base font-bold leading-tight text-foreground">
                      {card.city_kr || card.city}
                    </h2>
                    <p className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                      {card.city}, {card.country}
                    </p>
                  </div>

                  <div className="space-y-2">
                    {isFaded && (
                      <p className="rounded border border-border/70 bg-muted/40 px-2 py-1 text-[10px] text-muted-foreground">
                        {text.keepLogin}
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={!hasGuide}
                      onClick={() => setSelectedCard(card)}
                      className="h-8 w-full cursor-pointer rounded-md bg-primary px-2 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                    >
                      {hasGuide ? text.openGuide : text.lockedGuide}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
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
                  onClick={() => void printBriefingDocument(briefingDocumentRef.current, selectedCard)}
                  className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="프린트"
                  title="프린트"
                >
                  <Printer className="size-4" />
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
    </main>
  );
}
