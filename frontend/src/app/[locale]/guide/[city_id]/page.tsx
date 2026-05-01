"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useParams } from "next/navigation";
import { CheckCircle2, ChevronLeft, FileText, Image as ImageIcon, Loader2, LockKeyhole, MapPinned } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { PolarCheckoutButton } from "@/components/pay/PolarCheckoutButton";
import type { CityData } from "@/components/tarot/types";
import { buildGuideExportFilename, markdownToCanvasLines } from "@/lib/guide-export.mjs";
import {
  readDevPreview,
  mockBillingStatus,
  mockDetailQuota,
  mockDetailMarkdown,
  buildMockBriefing,
  type BriefingData,
} from "@/lib/dev-preview";
import { CountryBriefingDocument } from "@/components/guide/CountryBriefingDocument";
import { BriefingPngPreview } from "@/components/guide/BriefingPngPreview";

const SESSION_V2_KEY = "result_session_v2";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";

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

function MarkdownBlock({ markdown }: { markdown: string }) {
  const nodes = markdown.split("\n").filter((line) => line.trim().length > 0);
  return (
    <div className="space-y-3">
      {nodes.map((line, index) => {
        const text = line.replace(/^[-*]\s+/, "").trim();
        if (line.startsWith("### ")) {
          return <h3 key={index} className="pt-3 font-serif text-lg font-bold text-primary">{line.slice(4)}</h3>;
        }
        if (line.startsWith("## ")) {
          return <h2 key={index} className="pt-5 font-serif text-xl font-bold text-foreground">{line.slice(3)}</h2>;
        }
        if (line.startsWith("# ")) {
          return <h1 key={index} className="font-serif text-2xl font-bold text-foreground">{line.slice(2)}</h1>;
        }
        if (/^[-*]\s+/.test(line)) {
          return <p key={index} className="pl-3 text-sm leading-7 text-foreground/90">• {text}</p>;
        }
        return <p key={index} className="text-sm leading-7 text-foreground/90">{text}</p>;
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
    <div className="rounded-lg border border-border bg-card p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt={title}
        draggable={false}
        className="w-full select-none rounded-md"
        style={{ userSelect: "none" }}
      />
    </div>
  );
}

export default function GuidePage() {
  const router = useRouter();
  const locale = useLocale();
  const params = useParams();
  const cityId = normalizeCityId(params.city_id);

  const [city, setCity] = useState<CityData | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, unknown> | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [detailQuota, setDetailQuota] = useState<DetailQuota | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<BriefingData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadGuide() {
      setLoading(true);
      setError(null);
      try {
        const raw = localStorage.getItem(SESSION_V2_KEY);
        if (!raw) {
          router.replace("/result");
          return;
        }
        const session = JSON.parse(raw) as SessionV2;
        const selected =
          session.revealedCities?.find((candidate) => {
            return normalizeCityId(candidate.id ?? candidate.city) === cityId;
          }) ?? session.revealedCities?.[0] ?? null;
        if (!selected || !session.parsedData) {
          router.replace("/result");
          return;
        }

        if (cancelled) return;
        setCity(selected);
        setParsedData(session.parsedData);

        // Dev preview 단축 — 백엔드 호출 우회, Country Briefing mock 데이터 주입
        const devPreview = readDevPreview();
        if (devPreview.enabled) {
          setBillingStatus(mockBillingStatus(devPreview.plan));
          setDetailQuota(mockDetailQuota(devPreview.plan));
          setMarkdown(mockDetailMarkdown(selected.city_kr ?? "", selected.city ?? ""));
          setQuotaExceeded(false);
          const mockBriefing = await buildMockBriefing({
            cityName: selected.city,
            cityKr: selected.city_kr ?? null,
            countryId: selected.country_id,
            userProfile: (session.parsedData?._user_profile as Record<string, unknown> | undefined) ?? {
              persona_type: "free_spirit",
              travel_type: "혼자 (솔로)",
            },
          });
          if (!cancelled) setBriefing(mockBriefing);
          return;
        }

        const statusResponse = await fetch(`${API_BASE}/api/billing/status`, {
          cache: "no-store",
          credentials: "include",
        });
        if (!cancelled && statusResponse.ok) {
          setBillingStatus((await statusResponse.json()) as BillingStatus);
        }

        const selectedCityIndex = findCityIndex(session.parsedData, selected);
        const detailResponse = await fetch(`${API_BASE}/api/detail`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            parsed_data: session.parsedData,
            city_index: selectedCityIndex,
          }),
        });
        const detail = (await detailResponse.json().catch(() => ({}))) as {
          markdown?: string;
          quota?: DetailQuota;
        };
        if (detailResponse.status === 402 && detail.quota) {
          if (!cancelled) {
            setDetailQuota(detail.quota);
            setQuotaExceeded(true);
            setMarkdown(null);
          }
          return;
        }
        if (!detailResponse.ok) throw new Error(`detail ${detailResponse.status}`);
        if (!detail.markdown) throw new Error("empty detail");

        if (!cancelled) {
          setMarkdown(detail.markdown);
          setDetailQuota(detail.quota ?? null);
          setQuotaExceeded(false);
          localStorage.setItem(
            SESSION_V2_KEY,
            JSON.stringify({ ...session, readingMarkdown: detail.markdown, readingCityIndex: selectedCityIndex })
          );
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
  }, [cityId, router]);

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
    if (!markdown) return;
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    downloadUrl(url, buildGuideExportFilename(cityExportLabel(), "md"));
    URL.revokeObjectURL(url);
  }

  function downloadPng() {
    if (!markdown || !city) return;
    const url = renderGuidePngDataUrl(markdown, `${city.city_kr || city.city} 맞춤 가이드`, false);
    downloadUrl(url, buildGuideExportFilename(cityExportLabel(), "png"));
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <button
          type="button"
          onClick={() => router.push("/result")}
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          결과로 돌아가기
        </button>

        {loading && (
          <div className="flex min-h-[50vh] items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            상세 가이드를 생성하고 있어요...
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
                  <p className="mt-2 text-sm text-muted-foreground">
                    무료 플랜은 상세 가이드를 {detailQuota?.limit ?? 2}회까지 받을 수 있습니다. 현재 남은 횟수는 0회입니다.
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <PolarCheckoutButton
                  locale={locale}
                  returnPath={`/${locale}/guide/${cityId}?checkout=return`}
                  idleLabel="Pro로 무제한 상세 가이드 받기"
                  loadingLabel="결제 페이지 여는 중..."
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
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

            {briefing ? (
              isPro(billingStatus) ? (
                <article className="overflow-hidden rounded-lg border border-border bg-[#FAF8F4]">
                  <div className="flex flex-col gap-2 border-b border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">Pro 플랜: 워터마크 없이 텍스트와 내보내기를 사용할 수 있습니다.</p>
                  </div>
                  <div className="flex justify-center overflow-x-auto">
                    <CountryBriefingDocument data={briefing} watermark={false} />
                  </div>
                </article>
              ) : (
                <section className="space-y-3">
                  <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm text-muted-foreground">
                    무료 플랜에서는 Country Briefing이 Wingcraft 워터마크가 포함된 PNG 이미지로 표시됩니다. Pro 플랜에서는 워터마크 없이 보고, 텍스트·PNG로 내보낼 수 있습니다.
                  </div>
                  <div className="overflow-hidden rounded-lg border border-border bg-[#FAF8F4]">
                    <BriefingPngPreview data={briefing} watermark={true} />
                  </div>
                </section>
              )
            ) : isPro(billingStatus) ? (
              <article className="rounded-lg border border-border bg-card p-5">
                <div className="mb-4 flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">Pro 플랜: 워터마크 없이 텍스트와 내보내기를 사용할 수 있습니다.</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={downloadPng}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs hover:bg-muted"
                    >
                      <ImageIcon className="size-4" />
                      PNG로 저장
                    </button>
                    <button
                      type="button"
                      onClick={downloadMarkdown}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs hover:bg-muted"
                    >
                      <FileText className="size-4" />
                      MD로 저장
                    </button>
                  </div>
                </div>
                <MarkdownBlock markdown={markdown} />
              </article>
            ) : (
              <section className="space-y-3">
                <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm text-muted-foreground">
                  무료 플랜에서는 상세 가이드가 Wingcraft 워터마크가 포함된 PNG 이미지로 표시됩니다. Pro 플랜에서는 워터마크 없는 텍스트, PNG 저장, MD 저장을 사용할 수 있습니다.
                </div>
                <GuideImagePreview
                  markdown={markdown}
                  title={`${city.city_kr || city.city} 맞춤 가이드`}
                  watermark
                />
              </section>
            )}

            {detailQuota && (
              <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                {detailQuota.is_unlimited
                  ? "Pro 플랜: 상세 가이드 횟수 제한 없이 사용할 수 있습니다."
                  : `무료 플랜 상세 가이드: ${detailQuota.used}/${detailQuota.limit}회 사용, ${detailQuota.remaining}회 남음`}
              </div>
            )}

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
          </div>
        )}
      </div>
    </div>
  );
}
