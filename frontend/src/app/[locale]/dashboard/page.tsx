"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Loader2, Settings2, Map } from "lucide-react";
import { PolarCheckoutButton } from "@/components/pay/PolarCheckoutButton";
import { DashboardWidgets } from "@/components/dashboard/DashboardWidgets";
import type {
  DashboardPlan,
  DashboardWidgetCatalogItem,
  DashboardWidgetSettings,
} from "@/components/dashboard/types";
import {
  LOCKED_WIDGET_IDS,
  coerceDashboardWidgets,
} from "@/lib/dashboard-content.mjs";
import {
  readDevPreview,
  mockDashboardPlan,
  mockDashboardWidgets,
  mockDashboardCatalog,
} from "@/lib/dev-preview";
import { RitualTransition } from "@/components/transition/RitualTransition";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";

type DashboardResponse = {
  plan: DashboardPlan | null;
  widgets: DashboardWidgetSettings;
  catalog: DashboardWidgetCatalogItem[];
};

export default function DashboardPage() {
  const locale = useLocale();
  const router = useRouter();
  const [plan, setPlan] = useState<DashboardPlan | null>(null);
  const [widgets, setWidgets] = useState<DashboardWidgetSettings | null>(null);
  const [catalog, setCatalog] = useState<DashboardWidgetCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [accessError, setAccessError] = useState<"login" | "pro" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [personaType, setPersonaType] = useState<string | null>(null);
  const [devPreviewEnabled, setDevPreviewEnabled] = useState(false);

  const orderedWidgetIds = useMemo(() => {
    return coerceDashboardWidgets(widgets).widget_order;
  }, [widgets]);

  useEffect(() => {
    // Try to get persona from localStorage first
    const localPersona = localStorage.getItem("persona_type");
    if (localPersona) {
      setPersonaType(localPersona);
    }

    // Dev preview 단축 — 백엔드 호출 우회
    const devPreview = readDevPreview();
    if (devPreview.enabled) {
      setDevPreviewEnabled(true);
      if (devPreview.plan === "free") {
        setAccessError("pro");
        setLoading(false);
        return;
      }
      // Pro: localStorage의 가장 최근 도시(있으면) 또는 방콕 fallback
      let mockedCity = { city: "Bangkok", cityKr: "방콕" as string | null, country: "Thailand", countryId: "TH" };
      try {
        const raw = localStorage.getItem("result_session_v2");
        if (raw) {
          const session = JSON.parse(raw);
          const last = session?.revealedCities?.[session?.readingCityIndex ?? 0] ?? session?.revealedCities?.[0];
          if (last?.city) {
            mockedCity = {
              city: String(last.city),
              cityKr: last.city_kr ?? null,
              country: last.country ?? "",
              countryId: last.country_id ?? "",
            };
          }
        }
      } catch {
        // fallback to default mock
      }
      setPlan(mockDashboardPlan(mockedCity));
      setWidgets(coerceDashboardWidgets(mockDashboardWidgets()));
      setCatalog(mockDashboardCatalog());
      setLoading(false);
      return;
    }

    async function loadDashboard() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/api/dashboard`, {
          cache: "no-store",
          credentials: "include",
        });
        if (response.status === 401) {
          setAccessError("login");
          return;
        }
        if (response.status === 403) {
          setAccessError("pro");
          return;
        }
        if (!response.ok) throw new Error(`dashboard ${response.status}`);
        const payload = (await response.json()) as DashboardResponse;
        setPlan(payload.plan);
        setWidgets(coerceDashboardWidgets(payload.widgets));
        setCatalog(payload.catalog);

        // If persona not in localStorage, try plan.user_profile
        if (!localPersona && payload.plan?.user_profile?.persona_type) {
          setPersonaType(String(payload.plan.user_profile.persona_type));
        }
      } catch {
        setError("대시보드를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  async function saveWidgets(nextWidgets: DashboardWidgetSettings) {
    setSaving(true);
    setWidgets(nextWidgets);
    if (devPreviewEnabled) {
      setSaving(false);
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/dashboard/widgets`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(nextWidgets),
      });
      if (!response.ok) throw new Error(`widgets ${response.status}`);
      const payload = (await response.json()) as { widgets: DashboardWidgetSettings };
      setWidgets(coerceDashboardWidgets(payload.widgets));
    } catch {
      setError("위젯 설정 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function patchPlan(patch: Record<string, unknown>) {
    if (devPreviewEnabled) {
      setPlan((prev) => (prev ? ({ ...prev, ...patch } as DashboardPlan) : prev));
      return;
    }
    const response = await fetch(`${API_BASE}/api/dashboard/plan`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      setError("대시보드 값을 저장하지 못했습니다.");
      return;
    }
    const payload = (await response.json()) as { plan: DashboardPlan };
    setPlan(payload.plan);
  }

  function toggleWidget(widgetId: string) {
    if (!widgets || LOCKED_WIDGET_IDS.includes(widgetId)) return;
    const isEnabled = widgets.enabled_widgets.includes(widgetId);
    const enabled = isEnabled
      ? widgets.enabled_widgets.filter((id) => id !== widgetId)
      : [...widgets.enabled_widgets, widgetId];
    
    const nextOrder = isEnabled 
      ? widgets.widget_order.filter((id) => id !== widgetId)
      : [...widgets.widget_order, widgetId];

    const next = coerceDashboardWidgets({
      ...widgets,
      enabled_widgets: enabled,
      widget_order: nextOrder,
    });
    saveWidgets(next);
  }

  function removeWidget(widgetId: string) {
    if (!widgets || LOCKED_WIDGET_IDS.includes(widgetId)) return;
    const enabled = widgets.enabled_widgets.filter((id) => id !== widgetId);
    const nextOrder = widgets.widget_order.filter((id) => id !== widgetId);
    const next = coerceDashboardWidgets({
      ...widgets,
      enabled_widgets: enabled,
      widget_order: nextOrder,
    });
    saveWidgets(next);
  }

  const personaGif = personaType ? `/${personaType}.gif` : null;

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F]">
      <RitualTransition />
      <div className="mx-auto max-w-6xl px-5 py-12">
        {loading && (
          <div className="flex min-h-[60vh] items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            대시보드를 불러오는 중...
          </div>
        )}

        {!loading && accessError && (
          <div className="mx-auto max-w-lg rounded-2xl border border-border bg-white/80 p-8 shadow-sm backdrop-blur-md">
            <h1 className="font-serif text-2xl font-bold">Pro 대시보드</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {accessError === "login"
                ? "도시 확정 대시보드는 로그인 후 사용할 수 있습니다."
                : "도시 확정 대시보드는 Pro 플랜에서 사용할 수 있습니다."}
            </p>
            <div className="mt-6">
              <PolarCheckoutButton
                locale={locale}
                returnPath={`/${locale}/dashboard`}
                idleLabel="Pro로 시작하기"
                loadingLabel="결제 페이지 여는 중..."
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[#0071E3] px-6 text-sm font-semibold text-white transition-all hover:bg-[#0077ED] disabled:opacity-50"
              />
            </div>
          </div>
        )}

        {!loading && !accessError && !plan && (
          <div className="mx-auto max-w-lg rounded-2xl border border-border bg-white/80 p-8 shadow-sm backdrop-blur-md">
            <h1 className="font-serif text-2xl font-bold">아직 확정된 도시가 없습니다</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              상세 가이드에서 Pro 도시 확정을 완료하면 이곳에 개인 대시보드가 생성됩니다.
            </p>
          </div>
        )}

        {!loading && !accessError && plan && widgets && (
          <div className="space-y-10">
            <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex items-start gap-5">
                {personaGif && (
                  <div className="relative shrink-0 rounded-2xl bg-white p-2 shadow-sm border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={personaGif} alt="Persona" className="size-16 object-contain" />
                  </div>
                )}
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pro City Dashboard</p>
                  <h1 className="font-serif text-4xl font-bold tracking-tight">{plan.city_kr || plan.city} 노마드 플랜</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {plan.country} · {plan.status === "active" ? "활성 플랜" : "보관됨"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/onboarding/quiz")}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-white px-5 text-sm font-medium shadow-sm transition-all hover:bg-[#F5F5F7]"
                >
                  <Map className="size-4" />
                  다른 도시로 이동하기
                </button>
                <button
                  type="button"
                  onClick={() => setEditorOpen((value) => !value)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-white px-5 text-sm font-medium shadow-sm transition-all hover:bg-[#F5F5F7]"
                >
                  <Settings2 className="size-4" />
                  위젯 편집
                </button>
              </div>
            </header>

            {error && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {editorOpen && (
              <section className="rounded-2xl border border-border bg-white/50 p-6 backdrop-blur-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-serif text-xl font-bold">위젯 라이브러리</h2>
                  {saving && <span className="text-xs text-muted-foreground animate-pulse">설정 적용 중...</span>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {catalog.map((item) => {
                    const enabled = widgets.enabled_widgets.includes(item.id);
                    const locked = item.locked || LOCKED_WIDGET_IDS.includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className={`flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-all ${
                          enabled 
                            ? "border-primary/20 bg-primary/5 shadow-sm" 
                            : "border-border bg-white/40 hover:bg-white/60"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={enabled}
                          disabled={locked || saving}
                          onChange={() => toggleWidget(item.id)}
                          className="mt-1 size-4 accent-primary disabled:opacity-50"
                        />
                        <span>
                          <span className="block font-semibold">{item.title} {locked ? "· 고정" : ""}</span>
                          <span className="mt-1 block text-xs text-muted-foreground leading-relaxed">{item.description}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            )}

            <DashboardWidgets 
              plan={plan} 
              orderedWidgetIds={orderedWidgetIds} 
              onPatchPlan={patchPlan}
              onRemoveWidget={removeWidget}
            />
          </div>
        )}
      </div>
    </div>
  );
}

