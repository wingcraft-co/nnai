"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useLocale } from "next-intl";
import { Download, Printer, X } from "lucide-react";

import {
  calculateTemporaryCardOpacity,
  NOMAD_LIBRARY_CHANGE_EVENT,
  readLibraryCards,
  type LibraryCard,
} from "@/lib/library-storage";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";
const EMPTY_LIBRARY_CARDS: LibraryCard[] = [];

type AuthUser = {
  logged_in: boolean;
};

function downloadMarkdown(card: LibraryCard) {
  if (!card.guide_markdown) return;
  const blob = new Blob([card.guide_markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `nnai-${card.key}-guide.md`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function printGuide(card: LibraryCard) {
  if (!card.guide_markdown) return;
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) {
    window.print();
    return;
  }

  const title = escapeHtml(`${card.city_kr || card.city} 맞춤 가이드`);
  const escaped = escapeHtml(card.guide_markdown);

  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 48px; line-height: 1.7; color: #1d1d1f; }
          pre { white-space: pre-wrap; font-family: inherit; }
        </style>
      </head>
      <body>
        <pre>${escaped}</pre>
        <script>window.print();</script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

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

  const isLoggedIn = Boolean(auth?.logged_in);
  const guideCount = useMemo(() => cards.filter((card) => card.guide_unlocked).length, [cards]);
  const text = {
    eyebrow: isKorean ? "노마드 컬렉션" : "Nomad Collection",
    title: isKorean ? "내 노마드 카드 컬렉션" : "My Nomad Card Collection",
    loggedInCopy: isKorean
      ? "로그인된 컬렉션입니다. 구매한 카드는 맞춤 가이드를 다시 열 수 있습니다."
      : "This collection is saved to your account. Purchased cards can reopen custom guides.",
    temporaryCopy: isKorean
      ? "비로그인 임시 카드는 10초마다 흐려집니다. 로그인하면 영구 보관돼요."
      : "Temporary guest cards fade every 10 seconds. Log in to keep them permanently.",
    collectedCount: isKorean ? "수집한 도시" : "Cities",
    guideCount: isKorean ? "맞춤 가이드" : "Guides",
    empty: isKorean
      ? "아직 수집한 카드가 없습니다. 결과 화면에서 도시 카드를 열면 이곳에 보관됩니다."
      : "No cards collected yet. Open city cards from the result screen to keep them here.",
    unlocked: isKorean ? "가이드 보관됨" : "Guide unlocked",
    collected: isKorean ? "수집됨" : "Collected",
    score: isKorean ? "점수" : "Score",
    monthly: isKorean ? "월 비용" : "Monthly",
    visa: isKorean ? "비자" : "Visa",
    visaAvailable: isKorean ? "있음" : "Yes",
    keepLogin: isKorean ? "로그인하면 카드가 영구 보관돼요" : "Log in to keep this card permanently",
    openGuide: isKorean ? "맞춤 가이드 열기" : "Open custom guide",
    lockedGuide: isKorean ? "가이드 미구매" : "Guide not purchased",
    modalEyebrow: isKorean ? "저장된 가이드" : "Saved Guide",
    download: isKorean ? "다운로드" : "Download",
    print: isKorean ? "인쇄" : "Print",
  };

  return (
    <main className="min-h-screen bg-[#F5F5F7] px-5 py-16 text-[#1D1D1F]">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-[#8A6A00]">{text.eyebrow}</p>
            <h1 className="mt-1 font-serif text-4xl font-bold tracking-tight">{text.title}</h1>
            <p className="mt-2 text-sm text-[#6E6E73]">
              {isLoggedIn ? text.loggedInCopy : text.temporaryCopy}
            </p>
          </div>
          <div className="rounded-lg bg-white px-4 py-3 text-sm shadow-sm">
            {text.collectedCount} <strong>{cards.length}</strong> · {text.guideCount} <strong>{guideCount}</strong>
          </div>
        </header>

        {cards.length === 0 ? (
          <section className="rounded-lg border border-black/5 bg-white p-8 text-sm text-[#6E6E73] shadow-sm">
            {text.empty}
          </section>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => {
              const opacity = calculateTemporaryCardOpacity(card.collected_at, now, isLoggedIn);
              const isFaded = opacity <= 0.4 && !isLoggedIn;
              return (
                <article
                  key={card.key}
                  className="relative overflow-hidden rounded-lg border border-black/5 bg-white p-5 shadow-sm transition-transform hover:-translate-y-0.5"
                  style={{ opacity }}
                >
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-normal text-[#8A6A00]">{card.country_id}</p>
                      <h2 className="mt-1 font-serif text-2xl font-bold">{card.city_kr || card.city}</h2>
                      <p className="text-sm text-[#6E6E73]">{card.city}, {card.country}</p>
                    </div>
                    <span className="rounded-full bg-[#F5E6B8] px-2.5 py-1 text-xs font-semibold text-[#7A5600]">
                      {card.guide_unlocked ? text.unlocked : text.collected}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-[#6E6E73]">
                    <div className="rounded-md bg-[#F5F5F7] p-3">
                      <p>{text.score}</p>
                      <strong className="text-[#1D1D1F]">{card.score ?? "-"}</strong>
                    </div>
                    <div className="rounded-md bg-[#F5F5F7] p-3">
                      <p>{text.monthly}</p>
                      <strong className="text-[#1D1D1F]">${card.monthly_cost_usd ?? "-"}</strong>
                    </div>
                    <div className="rounded-md bg-[#F5F5F7] p-3">
                      <p>{text.visa}</p>
                      <strong className="text-[#1D1D1F]">{card.visa_type ? text.visaAvailable : "-"}</strong>
                    </div>
                  </div>
                  {isFaded && (
                    <p className="mt-4 rounded-md bg-black/5 px-3 py-2 text-xs font-medium text-[#1D1D1F]">
                      {text.keepLogin}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={!card.guide_unlocked}
                    onClick={() => setSelectedCard(card)}
                    className="mt-5 h-10 w-full cursor-pointer rounded-xl bg-[#1D1D1F] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#D2D2D7] disabled:text-[#6E6E73]"
                  >
                    {card.guide_unlocked ? text.openGuide : text.lockedGuide}
                  </button>
                </article>
              );
            })}
          </section>
        )}
      </div>

      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <section className="max-h-[84vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-black/10 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-normal text-[#8A6A00]">{text.modalEyebrow}</p>
                <h2 className="font-serif text-xl font-bold">{selectedCard.city_kr || selectedCard.city} 맞춤 가이드</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCard(null)}
                className="rounded-full p-2 text-[#6E6E73] hover:bg-black/5"
                aria-label={locale === "ko" ? "닫기" : "Close"}
              >
                <X className="size-5" />
              </button>
            </header>
            <div className="flex gap-2 border-b border-black/10 px-5 py-3">
              <button
                type="button"
                onClick={() => downloadMarkdown(selectedCard)}
                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-black/10 px-3 text-xs font-semibold hover:bg-black/5"
              >
                <Download className="size-4" />
                {text.download}
              </button>
              <button
                type="button"
                onClick={() => printGuide(selectedCard)}
                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-black/10 px-3 text-xs font-semibold hover:bg-black/5"
              >
                <Printer className="size-4" />
                {text.print}
              </button>
            </div>
            <div className="max-h-[58vh] overflow-y-auto px-5 py-4">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-[#1D1D1F]">
                {selectedCard.guide_markdown}
              </pre>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
