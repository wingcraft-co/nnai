"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useLocale } from "next-intl";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle2, ChevronLeft, Download, Image as ImageIcon, LockKeyhole, MapPinned } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { PolarCheckoutButton } from "@/components/pay/PolarCheckoutButton";
import type { CityData } from "@/components/tarot/types";
import { buildGuideExportFilename, markdownToCanvasLines } from "@/lib/guide-export.mjs";
import { briefingToMarkdown } from "@/lib/briefing-markdown";
import {
  readDevPreview,
  mockBillingStatus,
  mockDetailQuota,
  mockDetailMarkdown,
  type BriefingData,
} from "@/lib/dev-preview";
import { buildBriefing } from "@/lib/briefing-generator";
import { CountryBriefingDocument } from "@/components/guide/CountryBriefingDocument";
import { BriefingPngPreview } from "@/components/guide/BriefingPngPreview";
import { DASHBOARD_FEATURE_ENABLED } from "@/lib/feature-flags";
import { readLibraryCards, unlockLibraryGuide, type LibraryCard } from "@/lib/library-storage";

const SESSION_V2_KEY = "result_session_v2";
const PAYWALL_BLOCKED_KEY = "nnai_guide_paywall_blocked_v1";
const GUIDE_FETCH_TIMEOUT_MS = 15_000;

function fetchWithTimeout(input: RequestInfo, init: RequestInit = {}, timeoutMs = GUIDE_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";
const GUIDE_RESULT_RESTORE_KEY = "guide_result_restore_requested";

type BillingStatus = {
  entitlement?: {
    plan_tier?: string;
    status?: string;
  };
};

type DetailQuota = {
  is_unlimited: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
};

type SessionV2 = {
  revealedCities?: CityData[];
  parsedData?: Record<string, unknown> | null;
  readingMarkdown?: string | null;
  readingBriefing?: BriefingData | null;
  readingCityId?: string | null;
  detailQuota?: DetailQuota | null;
  billingStatus?: BillingStatus | null;
};

function isPro(status: BillingStatus | null): boolean {
  const entitlement = status?.entitlement;
  return entitlement?.plan_tier === "pro" && ["active", "grace"].includes(entitlement?.status ?? "");
}

function normalizeCityId(value: unknown): string {
  return String(value ?? "").toLowerCase().replace(/\s+/g, "-");
}

function findCityIndex(parsedData: Record<string, unknown> | null, city: CityData | null): number {
  const topCities = Array.isArray(parsedData?.top_cities) ? parsedData.top_cities : [];
  if (!city) return 0;
  const index = topCities.findIndex((candidate) => {
    if (!candidate || typeof candidate !== "object") return false;
    const row = candidate as Record<string, unknown>;
    return row.city === city.city && row.country_id === city.country_id;
  });
  return index >= 0 ? index : 0;
}

function withRoutePreferredLanguage(parsedData: Record<string, unknown>, locale: string): Record<string, unknown> {
  const language = locale === "ko" ? "한국어" : "English";
  const profile =
    parsedData._user_profile && typeof parsedData._user_profile === "object" && !Array.isArray(parsedData._user_profile)
      ? (parsedData._user_profile as Record<string, unknown>)
      : {};

  return {
    ...parsedData,
    _user_profile: {
      ...profile,
      language,
    },
  };
}

function formatDetailQuotaLabel(quota: DetailQuota): string {
  if (quota.is_unlimited) {
    return "구매하신 보고서는 프로필의 보관함에서 다시 확인하실 수 있습니다.";
  }

  const remaining = quota.remaining ?? 0;
  return `무료 상세 가이드 ${quota.used}/${quota.limit ?? 0}회 사용 (${remaining}회 남음)`;
}

function libraryCardToCity(card: LibraryCard): CityData {
  return {
    id: card.guide_city_id ?? card.key,
    city: card.city,
    city_kr: card.city_kr ?? null,
    country: card.country,
    country_id: card.country_id,
    visa_type: card.visa_type ?? null,
    monthly_cost_usd: card.monthly_cost_usd ?? null,
    score: card.score ?? null,
  } as CityData;
}

function buildBriefingRequest(city: CityData, parsedData: Record<string, unknown>) {
  return {
    cityName: city.city,
    cityKr: city.city_kr ?? null,
    countryId: city.country_id,
    userProfile: (parsedData._user_profile as Record<string, unknown> | undefined) ?? {
      persona_type: "free_spirit",
      travel_type: "혼자 (솔로)",
    },
    visaType: city.visa_type ?? null,
    visaFreeDays: typeof city.visa_free_days === "number" ? city.visa_free_days : null,
    stayMonths: typeof city.stay_months === "number" ? city.stay_months : null,
    monthlyCostUsd: typeof city.monthly_cost_usd === "number" ? city.monthly_cost_usd : null,
    midTermRentUsd: typeof city.mid_term_rent_usd === "number" ? city.mid_term_rent_usd : null,
    coworkUsdMonth: typeof city.cowork_usd_month === "number" ? city.cowork_usd_month : null,
  };
}

function saveVisibleGuideToServer({
  cacheKey,
  markdown,
  parsedData,
  cityIndex,
}: {
  cacheKey: string | null | undefined;
  markdown: string;
  parsedData: Record<string, unknown>;
  cityIndex: number;
}) {
  if (!cacheKey) return;
  void fetch(`${API_BASE}/api/library/guides`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      cache_key: cacheKey,
      markdown,
      parsed_data: parsedData,
      city_index: cityIndex,
    }),
  }).catch(() => undefined);
}

function ReportDisclaimer() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-[11px] leading-5 text-muted-foreground">
      맞춤형 보고서는 한눈에 나에게 맞는 정보를 모아서 보여주는 참고 자료입니다. 비자 정보와 세무 규정은
      국가와 시점에 따라 달라질 수 있습니다. 실제 신청, 체류, 세무 판단 전에는 반드시 공식 기관 또는
      전문가를 통해 추가 확인을 진행하세요.
    </div>
  );
}

function renderLinkedText(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, index) => {
    if (!part.startsWith("http://") && !part.startsWith("https://")) return part;

    const match = part.match(/^(https?:\/\/[^\s]+?)([.,;:!?)]*)$/);
    const href = match?.[1] ?? part;
    const trailing = match?.[2] ?? "";
    return (
      <span key={index}>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
        >
          {href}
        </a>
        {trailing}
      </span>
    );
  });
}

function MarkdownBlock({ markdown }: { markdown: string }) {
  const nodes = markdown.split("\n").filter((line) => line.trim().length > 0);
  return (
    <div className="space-y-3">
      {nodes.map((line, index) => {
        const text = line.replace(/^[-*]\s+/, "").trim();
        if (line.startsWith("### ")) {
          return <h3 key={index} className="pt-3 font-serif text-lg font-bold text-primary">{renderLinkedText(line.slice(4))}</h3>;
        }
        if (line.startsWith("## ")) {
          return <h2 key={index} className="pt-5 font-serif text-xl font-bold text-foreground">{renderLinkedText(line.slice(3))}</h2>;
        }
        if (line.startsWith("# ")) {
          return <h1 key={index} className="font-serif text-2xl font-bold text-foreground">{renderLinkedText(line.slice(2))}</h1>;
        }
        if (/^[-*]\s+/.test(line)) {
          return <p key={index} className="pl-3 text-sm leading-7 text-foreground/90">• {renderLinkedText(text)}</p>;
        }
        return <p key={index} className="text-sm leading-7 text-foreground/90">{renderLinkedText(text)}</p>;
      })}
    </div>
  );
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function renderGuidePngDataUrl(markdown: string, title: string, watermark: boolean): string {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const width = 1080;
  const padding = 72;
  const maxWidth = width - padding * 2;
  const sourceLines = markdownToCanvasLines(markdown);
  ctx.font = "30px sans-serif";
  const wrapped = sourceLines.flatMap((line) => {
    if (line.length < 30) return [line];
    return wrapCanvasText(ctx, line, maxWidth);
  });
  const height = Math.max(1280, padding * 2 + 72 + wrapped.length * 46);

  canvas.width = width;
  canvas.height = height;

  ctx.fillStyle = "#fffdf7";
  ctx.fillRect(0, 0, width, height);

  if (watermark) {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.font = "700 72px sans-serif";
    ctx.fillStyle = "rgba(26, 26, 46, 0.08)";
    ctx.textAlign = "center";
    for (let y = -height; y < height; y += 220) {
      for (let x = -width; x < width; x += 520) {
        ctx.fillText("Wingcraft", x, y);
      }
    }
    ctx.restore();
  }

  ctx.fillStyle = "#1a1a2e";
  ctx.font = "700 42px serif";
  ctx.fillText(title || "NomadNavigator AI 상세 가이드", padding, padding);
  ctx.fillStyle = "#6b7280";
  ctx.font = "22px sans-serif";
  ctx.fillText("NomadNavigator AI", padding, padding + 42);

  let y = padding + 108;
  for (const line of wrapped) {
    const isHeading = !line.startsWith("•") && sourceLines.includes(line) && line.length < 34;
    ctx.fillStyle = isHeading ? "#1a1a2e" : "#303442";
    ctx.font = isHeading ? "700 30px serif" : "26px sans-serif";
    ctx.fillText(line, padding, y);
    y += isHeading ? 52 : 42;
  }

  return canvas.toDataURL("image/png");
}

function downloadUrl(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function GuideImagePreview({
  markdown,
  title,
  watermark,
}: {
  markdown: string;
  title: string;
  watermark: boolean;
}) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    setDataUrl(renderGuidePngDataUrl(markdown, title, watermark));
  }, [markdown, title, watermark]);

  if (!dataUrl) {
    return (
      <div className="flex min-h-80 items-center justify-center rounded-lg border border-border bg-card text-sm text-muted-foreground">
        이미지 가이드를 생성하는 중...
      </div>
    );
  }

  return (
    <div
      onContextMenu={(event) => event.preventDefault()}
      className="rounded-lg border border-border bg-card p-3"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt={title}
        draggable={false}
        className="w-full select-none rounded-md"
        style={{
          userSelect: "none",
          WebkitUserSelect: "none",
          pointerEvents: "none",
          WebkitTouchCallout: "none",
        }}
      />
    </div>
  );
}

const BRIEFING_DOCUMENT_WIDTH = 1080;

function ProBriefingPreview({
  data,
  documentRef,
}: {
  data: BriefingData;
  documentRef: RefObject<HTMLDivElement | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ scale: 1, height: 0 });

  useEffect(() => {
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
  }, [data]);

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

async function downloadBriefingPng(
  node: HTMLElement | null,
  cityLabel: string,
  setExporting: (value: boolean) => void
) {
  if (!node) return;
  setExporting(true);
  try {
    const url = await briefingNodeToPngUrl(node);
    downloadUrl(url, buildGuideExportFilename(cityLabel, "png"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[GuidePage] briefing png export failed: ${msg}`);
  } finally {
    setExporting(false);
  }
}

export default function GuidePage() {
  const router = useRouter();
  const locale = useLocale();
  const params = useParams();
  const searchParams = useSearchParams();
  const cityId = normalizeCityId(params.city_id);
  const fromLibrary = searchParams?.get("from") === "library";
  const checkoutReturned = searchParams?.get("checkout") === "return";

  const [city, setCity] = useState<CityData | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, unknown> | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [detailQuota, setDetailQuota] = useState<DetailQuota | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const briefingDocumentRef = useRef<HTMLDivElement>(null);
  const [exportingBriefingPng, setExportingBriefingPng] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        setReloadTick((t) => t + 1);
      }
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadGuide() {
      setLoading(true);
      setBriefingLoading(false);
      setBriefing(null);
      setError(null);
      try {
        const raw = localStorage.getItem(SESSION_V2_KEY);
        const session = raw ? (JSON.parse(raw) as SessionV2) : ({} as SessionV2);

        let selected: CityData | null = null;
        let baseParsedData: Record<string, unknown> | null = session.parsedData ?? null;

        if (fromLibrary) {
          const libraryCard = readLibraryCards().find(
            (card) => normalizeCityId(card.city) === cityId
          );
          if (libraryCard) {
            selected = libraryCardToCity(libraryCard);
            const profileFromSession =
              session.parsedData &&
              typeof session.parsedData === "object" &&
              session.parsedData._user_profile &&
              typeof session.parsedData._user_profile === "object"
                ? session.parsedData._user_profile
                : { persona_type: "free_spirit", travel_type: "혼자 (솔로)" };
            baseParsedData = {
              top_cities: [selected],
              _user_profile: profileFromSession,
            };
          } else {
            router.replace("/library");
            return;
          }
        } else {
          if (!raw) {
            router.replace("/result");
            return;
          }
          selected =
            session.revealedCities?.find((candidate) => {
              return normalizeCityId(candidate.id ?? candidate.city) === cityId;
            }) ?? session.revealedCities?.[0] ?? null;
        }

        if (!selected || !baseParsedData) {
          router.replace(fromLibrary ? "/library" : "/result");
          return;
        }
        const localizedParsedData = withRoutePreferredLanguage(baseParsedData, locale);

        if (cancelled) return;
        setCity(selected);
        setParsedData(localizedParsedData);

        const cachedQuota = session.detailQuota ?? null;
        const cachedQuotaExhausted = Boolean(
          cachedQuota && !cachedQuota.is_unlimited && (cachedQuota.remaining ?? 0) <= 0
        );
        const paywallBlockedForCity = localStorage.getItem(PAYWALL_BLOCKED_KEY) === cityId;
        if (checkoutReturned || cachedQuotaExhausted || paywallBlockedForCity) {
          setDetailQuota(cachedQuota);
          setBillingStatus(session.billingStatus ?? null);
          setMarkdown(null);
          setBriefing(null);
          setQuotaExceeded(true);
          return;
        }

        const restoredCityId = normalizeCityId(session.readingCityId ?? selected.id ?? selected.city);
        if (
          session.readingMarkdown &&
          session.readingBriefing &&
          restoredCityId === cityId
        ) {
          const restoredQuota = session.detailQuota ?? null;
          setMarkdown(session.readingMarkdown);
          setBriefing(session.readingBriefing);
          setDetailQuota(restoredQuota);
          setQuotaExceeded(false);
          setBillingStatus(
            session.billingStatus ??
              (restoredQuota?.is_unlimited
                ? { entitlement: { plan_tier: "pro", status: "active" } }
                : null)
          );
          return;
        }

        // Dev preview 단축 — 백엔드 호출 우회, Country Briefing mock 데이터 주입
        const devPreview = readDevPreview();
        if (devPreview.enabled) {
          setBillingStatus(mockBillingStatus(devPreview.plan));
          setDetailQuota(mockDetailQuota(devPreview.plan));
          setMarkdown(mockDetailMarkdown(selected.city_kr ?? "", selected.city ?? ""));
          setQuotaExceeded(false);
          const generated = await buildBriefing(buildBriefingRequest(selected, localizedParsedData));
          if (!cancelled) {
            setBriefing(generated);
            unlockLibraryGuide(selected, briefingToMarkdown(generated), Date.now(), generated);
          }
          return;
        }

        let currentBillingStatus: BillingStatus | null = null;
        try {
          const statusResponse = await fetchWithTimeout(`${API_BASE}/api/billing/status`, {
            cache: "no-store",
            credentials: "include",
          });
          if (!cancelled && statusResponse.ok) {
            currentBillingStatus = (await statusResponse.json()) as BillingStatus;
            setBillingStatus(currentBillingStatus);
          }
        } catch {
          // billing status는 실패해도 detail로 진행
        }

        const selectedCityIndex = findCityIndex(localizedParsedData, selected);
        const detailResponse = await fetchWithTimeout(`${API_BASE}/api/detail`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            parsed_data: localizedParsedData,
            city_index: selectedCityIndex,
          }),
        });
        const detail = (await detailResponse.json().catch(() => ({}))) as {
          markdown?: string;
          quota?: DetailQuota;
          cache_key?: string;
        };
        if (detailResponse.status === 402) {
          if (!cancelled) {
            setDetailQuota(detail.quota ?? null);
            setQuotaExceeded(true);
            setMarkdown(null);
            try {
              localStorage.setItem(PAYWALL_BLOCKED_KEY, cityId);
              localStorage.setItem(
                SESSION_V2_KEY,
                JSON.stringify({
                  ...session,
                  parsedData: localizedParsedData,
                  detailQuota: detail.quota ?? null,
                  billingStatus: currentBillingStatus,
                })
              );
            } catch {
              // ignore persist failures
            }
          }
          return;
        }
        if (!detailResponse.ok) throw new Error(`detail ${detailResponse.status}`);
        if (!detail.markdown) throw new Error("empty detail");

        if (!cancelled) {
          setMarkdown(detail.markdown);
          setDetailQuota(detail.quota ?? null);
          setQuotaExceeded(false);
          try {
            if (localStorage.getItem(PAYWALL_BLOCKED_KEY) === cityId) {
              localStorage.removeItem(PAYWALL_BLOCKED_KEY);
            }
          } catch {
            // ignore
          }
          localStorage.setItem(
            SESSION_V2_KEY,
            JSON.stringify({
              ...session,
              parsedData: localizedParsedData,
              readingMarkdown: detail.markdown,
              readingCityIndex: selectedCityIndex,
            })
          );
          setBriefingLoading(true);
          void buildBriefing(buildBriefingRequest(selected, localizedParsedData))
            .then((generated) => {
              if (!cancelled) {
                setBriefing(generated);
                const visibleMarkdown = briefingToMarkdown(generated);
                unlockLibraryGuide(selected, visibleMarkdown, Date.now(), generated);
                localStorage.setItem(
                  SESSION_V2_KEY,
                  JSON.stringify({
                    ...session,
                    parsedData: localizedParsedData,
                    readingMarkdown: visibleMarkdown,
                    readingBriefing: generated,
                    readingCityId: selected.id ?? selected.city,
                    readingCityIndex: selectedCityIndex,
                    detailQuota: detail.quota ?? null,
                    billingStatus: currentBillingStatus,
                  })
                );
                saveVisibleGuideToServer({
                  cacheKey: detail.cache_key,
                  markdown: visibleMarkdown,
                  parsedData: localizedParsedData,
                  cityIndex: selectedCityIndex,
                });
              }
            })
            .catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              console.warn(`[GuidePage] briefing format fallback failed: ${msg}`);
            })
            .finally(() => {
              if (!cancelled) setBriefingLoading(false);
            });
        }
      } catch {
        if (!cancelled) setError("상세 가이드를 불러오지 못했습니다. 결과 화면에서 다시 시도해주세요.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadGuide();
    return () => {
      cancelled = true;
    };
  }, [cityId, locale, router, fromLibrary, checkoutReturned, reloadTick]);

  async function confirmCity() {
    if (!city || confirming) return;
    setConfirming(true);
    setError(null);
    try {
      // Dev preview 단축
      const devPreview = readDevPreview();
      if (devPreview.enabled) {
        if (devPreview.plan === "free") {
          setBillingStatus(mockBillingStatus("free"));
          return;
        }
        router.push(`/dashboard?dev_preview=1&plan=${devPreview.plan}`);
        return;
      }

      const response = await fetch(`${API_BASE}/api/dashboard/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          city,
          user_profile: parsedData?._user_profile ?? {},
          arrived_at: new Date().toISOString().slice(0, 10),
        }),
      });
      if (!response.ok) {
        if (response.status === 403) {
          setBillingStatus({ entitlement: { plan_tier: "free", status: "active" } });
          return;
        }
        throw new Error(`confirm ${response.status}`);
      }
      router.push("/dashboard");
    } catch {
      setError("도시 확정에 실패했습니다. 로그인 상태와 Pro 권한을 확인해주세요.");
    } finally {
      setConfirming(false);
    }
  }

  function cityExportLabel(): string {
    return city?.city || city?.city_kr || "guide";
  }

  function downloadMarkdown() {
    const source = briefing ? briefingToMarkdown(briefing) : markdown;
    if (!source) return;
    const blob = new Blob([source], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    downloadUrl(url, buildGuideExportFilename(cityExportLabel(), "md"));
    URL.revokeObjectURL(url);
  }

  function backToResult() {
    if (fromLibrary) {
      router.push("/library");
      return;
    }

    try {
      localStorage.setItem(GUIDE_RESULT_RESTORE_KEY, "1");
    } catch {
      // Storage can be unavailable; still navigate back to the result route.
    }

    router.push("/result");
  }

  return (
    <div className="dark relative flex min-h-0 w-full min-w-0 flex-1 flex-col bg-background text-foreground">
      <button
        type="button"
        onClick={backToResult}
        className="fixed left-5 top-6 z-20 inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:left-8"
      >
        <ChevronLeft className="size-4" />
        {fromLibrary ? "보관함으로 돌아가기" : "결과로 돌아가기"}
      </button>
      <div className="mx-auto w-full max-w-3xl px-5 py-8">
        {loading && (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-sm text-muted-foreground">
            <p className="animate-pulse">맞춤 보고서를 생성하고 있어요...</p>
            <div className="flex items-center gap-2">
              <a
                href={`/${locale}/guide/${cityId}?retry=1`}
                className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                다시 시도
              </a>
              <a
                href={`/${locale}/guide/${cityId}?checkout=return`}
                className="cursor-pointer rounded-md border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20"
              >
                구매 페이지로
              </a>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && city && quotaExceeded && (
          <div className="space-y-6">
            <header className="border-b border-border pb-6">
              <p className="mb-2 text-xs text-muted-foreground">Step 2 상세 가이드</p>
              <h1 className="font-serif text-3xl font-bold">
                {city.city_kr || city.city} 맞춤 가이드
              </h1>
            </header>
            <section className="rounded-lg border border-primary/40 bg-primary/10 p-5">
              <div className="flex items-start gap-3">
                <LockKeyhole className="mt-0.5 size-5 text-primary" />
                <div>
                  <h2 className="font-serif text-lg font-bold">무료 상세 가이드 횟수를 모두 사용했습니다.</h2>
                  <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                    {`나만의 맞춤 상세 가이드를 ${detailQuota?.limit ?? 2}회까지 무료로 받을 수 있습니다.\n현재 남은 횟수는 0회입니다.`}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex w-full justify-end">
                <PolarCheckoutButton
                  locale={locale}
                  returnPath={`/${locale}/guide/${cityId}?checkout=return`}
                  idleLabel="맞춤 가이드 구매"
                  loadingLabel="결제 페이지 여는 중..."
                  className="ml-auto flex h-10 cursor-pointer items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </section>
          </div>
        )}

        {!loading && !error && city && markdown && (
          <div className="space-y-6">
            {!briefing && (
              <header className="border-b border-border pb-6">
                <p className="mb-2 text-xs text-muted-foreground">Step 2 상세 가이드</p>
                <h1 className="font-serif text-3xl font-bold">
                  {city.city_kr || city.city} 정착 가이드
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {city.country} · {city.visa_type || "비자 정보"} · 월 예상 비용 ${city.monthly_cost_usd?.toLocaleString?.() ?? "-"}
                </p>
              </header>
            )}

            {detailQuota && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                <span>{formatDetailQuotaLabel(detailQuota)}</span>
                {isPro(billingStatus) && briefing && (
                  <div className="-mr-1 flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void downloadBriefingPng(
                        briefingDocumentRef.current,
                        cityExportLabel(),
                        setExportingBriefingPng
                      )}
                      disabled={exportingBriefingPng}
                      className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="PNG로 저장"
                      title="PNG로 저장"
                    >
                      <ImageIcon className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={downloadMarkdown}
                      className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="MD로 저장"
                      title="MD로 저장"
                    >
                      <Download className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {briefing ? (
              isPro(billingStatus) ? (
                <article className="overflow-hidden rounded-lg bg-[#FAF8F4]">
                  <ProBriefingPreview data={briefing} documentRef={briefingDocumentRef} />
                </article>
              ) : (
                <section className="space-y-3">
                  <div className="overflow-hidden rounded-lg border border-border bg-[#FAF8F4]">
                    <BriefingPngPreview data={briefing} watermark={true} />
                  </div>
                </section>
              )
            ) : briefingLoading ? (
              <div className="flex min-h-80 items-center justify-center rounded-lg border border-border bg-card text-sm text-muted-foreground">
                <p className="animate-pulse">맞춤 보고서 서식을 준비하고 있어요...</p>
              </div>
            ) : isPro(billingStatus) ? (
              <article className="rounded-lg border border-border bg-card p-5">
                <MarkdownBlock markdown={markdown} />
              </article>
            ) : (
              <section className="space-y-3">
                <GuideImagePreview
                  markdown={markdown}
                  title={`${city.city_kr || city.city} 맞춤 가이드`}
                  watermark={true}
                />
              </section>
            )}

            {DASHBOARD_FEATURE_ENABLED && (
              <section className="rounded-lg border border-primary/40 bg-primary/10 p-5">
                {isPro(billingStatus) ? (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 font-serif text-lg font-bold">
                        <CheckCircle2 className="size-5 text-primary" />
                        이 도시로 내 디지털노마드 플랜을 시작하세요
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        확정하면 날씨, 환율, 체류 일자, 비자, 세금, 공유오피스, 재난 현황이 한 페이지 대시보드로 저장됩니다.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={confirmCity}
                      disabled={confirming}
                      className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      <MapPinned className="size-4" />
                      {confirming ? "확정 중..." : "이 도시로 확정"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <LockKeyhole className="mt-0.5 size-5 text-primary" />
                      <div>
                        <h2 className="font-serif text-lg font-bold">
                          해당 국가로 확정하고 내 디지털노마드 플랜을 설계하세요.
                        </h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Pro 플랜에서 도시 확정, 개인 대시보드, 위젯 저장, 세금/비자 관리가 열립니다.
                        </p>
                      </div>
                    </div>
                    <PolarCheckoutButton
                      locale={locale}
                      returnPath={`/${locale}/guide/${cityId}?checkout=return`}
                      idleLabel="확정하러가기"
                      loadingLabel="결제 페이지 여는 중..."
                      className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                    />
                  </div>
                )}
              </section>
            )}

            <ReportDisclaimer />
          </div>
        )}
      </div>
    </div>
  );
}
