"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useParams } from "next/navigation";
import { CheckCircle2, ChevronLeft, Loader2, LockKeyhole, MapPinned } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { PolarCheckoutButton } from "@/components/pay/PolarCheckoutButton";
import type { CityData } from "@/components/tarot/types";

const SESSION_V2_KEY = "result_session_v2";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";

type BillingStatus = {
  entitlement?: {
    plan_tier?: string;
    status?: string;
  };
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

export default function GuidePage() {
  const router = useRouter();
  const locale = useLocale();
  const params = useParams();
  const cityId = normalizeCityId(params.city_id);

  const [city, setCity] = useState<CityData | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, unknown> | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

        const statusResponse = await fetch(`${API_BASE}/api/billing/status`, {
          cache: "no-store",
          credentials: "include",
        });
        if (!cancelled && statusResponse.ok) {
          setBillingStatus((await statusResponse.json()) as BillingStatus);
        }

        const selectedCityIndex = findCityIndex(session.parsedData, selected);
        const detailResponse = await fetch("/api/detail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parsed_data: session.parsedData,
            city_index: selectedCityIndex,
          }),
        });
        if (!detailResponse.ok) throw new Error(`detail ${detailResponse.status}`);
        const detail = (await detailResponse.json()) as { markdown?: string };
        if (!detail.markdown) throw new Error("empty detail");

        if (!cancelled) {
          setMarkdown(detail.markdown);
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

        {!loading && !error && city && markdown && (
          <div className="space-y-6">
            <header className="border-b border-border pb-6">
              <p className="mb-2 text-xs text-muted-foreground">Step 2 상세 가이드</p>
              <h1 className="font-serif text-3xl font-bold">
                {city.city_kr || city.city} 맞춤 가이드
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {city.country} · {city.visa_type || "비자 정보"} · 월 예상 비용 ${city.monthly_cost_usd?.toLocaleString?.() ?? "-"}
              </p>
            </header>

            <article className="rounded-lg border border-border bg-card p-5">
              <MarkdownBlock markdown={markdown} />
            </article>

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
