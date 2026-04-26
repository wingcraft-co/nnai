"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { Loader2, Settings2 } from "lucide-react";
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

type DashboardResponse = {
  plan: DashboardPlan | null;
  widgets: DashboardWidgetSettings;
  catalog: DashboardWidgetCatalogItem[];
};

export default function DashboardPage() {
  const locale = useLocale();
  const [plan, setPlan] = useState<DashboardPlan | null>(null);
  const [widgets, setWidgets] = useState<DashboardWidgetSettings | null>(null);
  const [catalog, setCatalog] = useState<DashboardWidgetCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [accessError, setAccessError] = useState<"login" | "pro" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const orderedWidgetIds = useMemo(() => {
    return coerceDashboardWidgets(widgets).widget_order;
  }, [widgets]);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/dashboard", { cache: "no-store" });
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
    try {
      const response = await fetch("/api/dashboard/widgets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
    const response = await fetch("/api/dashboard/plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
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
    const enabled = widgets.enabled_widgets.includes(widgetId)
      ? widgets.enabled_widgets.filter((id) => id !== widgetId)
      : [...widgets.enabled_widgets, widgetId];
    const next = coerceDashboardWidgets({
      ...widgets,
      enabled_widgets: enabled,
      widget_order: widgets.widget_order.filter((id) => enabled.includes(id)).concat(enabled.filter((id) => !widgets.widget_order.includes(id))),
    });
    saveWidgets(next);
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-5 py-8">
        {loading && (
          <div className="flex min-h-[60vh] items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            대시보드를 불러오는 중...
          </div>
        )}

        {!loading && accessError && (
          <div className="mx-auto max-w-lg rounded-lg border border-border bg-card p-6">
            <h1 className="font-serif text-2xl font-bold">Pro 대시보드</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {accessError === "login"
                ? "도시 확정 대시보드는 로그인 후 사용할 수 있습니다."
                : "도시 확정 대시보드는 Pro 플랜에서 사용할 수 있습니다."}
            </p>
            <div className="mt-5">
              <PolarCheckoutButton
                locale={locale}
                returnPath={`/${locale}/dashboard`}
                idleLabel="Pro로 시작하기"
                loadingLabel="결제 페이지 여는 중..."
                className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              />
            </div>
          </div>
        )}

        {!loading && !accessError && !plan && (
          <div className="mx-auto max-w-lg rounded-lg border border-border bg-card p-6">
            <h1 className="font-serif text-2xl font-bold">아직 확정된 도시가 없습니다</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              상세 가이드에서 Pro 도시 확정을 완료하면 이곳에 개인 대시보드가 생성됩니다.
            </p>
          </div>
        )}

        {!loading && !accessError && plan && widgets && (
          <div className="space-y-6">
            <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Pro City Dashboard</p>
                <h1 className="font-serif text-3xl font-bold">{plan.city_kr || plan.city} 노마드 플랜</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {plan.country} · {plan.status === "active" ? "활성 플랜" : "보관됨"} · 설정은 계정에 저장됩니다
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen((value) => !value)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm hover:bg-muted"
              >
                <Settings2 className="size-4" />
                위젯 편집
              </button>
            </header>

            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {editorOpen && (
              <section className="rounded-lg border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-serif text-lg font-bold">위젯 설정</h2>
                  {saving && <span className="text-xs text-muted-foreground">저장 중...</span>}
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {catalog.map((item) => {
                    const enabled = widgets.enabled_widgets.includes(item.id);
                    const locked = item.locked || LOCKED_WIDGET_IDS.includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background/60 p-3 text-sm"
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
                          <span className="mt-1 block text-xs text-muted-foreground">{item.description}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            )}

            <DashboardWidgets plan={plan} orderedWidgetIds={orderedWidgetIds} onPatchPlan={patchPlan} />
          </div>
        )}
      </div>
    </div>
  );
}
