"use client";

import { useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Building2,
  CalendarDays,
  CloudSun,
  ExternalLink,
  HeartPulse,
  Home,
  Landmark,
  MapPin,
  Plane,
  ShieldAlert,
  WalletCards,
} from "lucide-react";
import {
  computeStayDay,
  formatCurrencyAmount,
  resolveCurrencyCode,
} from "@/lib/dashboard-content.mjs";
import { WidgetCard } from "./WidgetCard";
import type { DashboardPlan } from "./types";

type PlanPatch = {
  arrived_at?: string | null;
  visa_type?: string | null;
  visa_expires_at?: string | null;
  coworking_space?: DashboardPlan["coworking_space"];
  tax_profile?: DashboardPlan["tax_profile"];
};

const VISA_OFFICIAL_URL: Record<string, string> = {
  TH: "https://www.thaievisa.go.th/",
  MY: "https://mdec.my/en/derantau",
  PT: "https://vistos.mne.gov.pt/",
  ES: "https://www.exteriores.gob.es/",
  GR: "https://www.migration.gov.gr/en/",
  EE: "https://www.e-resident.gov.ee/nomadvisa/",
  GE: "https://www.evisa.gov.ge/",
};

function DashboardInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary ${props.className ?? ""}`}
    />
  );
}

export function DashboardWidgets({
  plan,
  orderedWidgetIds,
  onPatchPlan,
}: {
  plan: DashboardPlan;
  orderedWidgetIds: string[];
  onPatchPlan: (patch: PlanPatch) => Promise<void>;
}) {
  const [localAmount, setLocalAmount] = useState(1000);
  const [krwPerUsd] = useState(1400);
  const [arrivedAt, setArrivedAt] = useState(plan.arrived_at ?? new Date().toISOString().slice(0, 10));
  const [visaType, setVisaType] = useState(plan.visa_type || "관광비자");
  const [visaExpiresAt, setVisaExpiresAt] = useState(plan.visa_expires_at ?? "");
  const [coworkName, setCoworkName] = useState(plan.coworking_space?.name ?? "");
  const [coworkCost, setCoworkCost] = useState(String(plan.coworking_space?.monthly_cost_usd ?? plan.city_payload?.cowork_usd_month ?? ""));
  const [monthlyIncome, setMonthlyIncome] = useState(String(plan.tax_profile?.monthly_income_usd ?? ""));

  const currencyCode = resolveCurrencyCode(plan.country_id);
  const stayDay = computeStayDay(plan.arrived_at);
  const usdPerLocal = currencyCode === "USD" ? 1 : 1 / Math.max(1, Number(plan.city_payload.monthly_cost_usd ?? 1400));
  const krwConverted = currencyCode === "KRW" ? localAmount : Math.round(localAmount * usdPerLocal * krwPerUsd);
  const visaUrl = plan.city_payload.visa_url || VISA_OFFICIAL_URL[String(plan.country_id ?? "").toUpperCase()];
  const taxDays = plan.city_payload.tax_residency_days;
  const monthlyCost = Number(plan.city_payload.monthly_cost_usd ?? 0);

  const actions = useMemo(
    () => [
      "비자 상태와 만료일 확인",
      "이번 달 해외소득 입력",
      "숙소 갱신 일정 점검",
      "비상 연락처와 보험 보장 범위 확인",
    ],
    []
  );

  function renderWidget(widgetId: string) {
    switch (widgetId) {
      case "weather":
        return (
          <WidgetCard key={widgetId} title="날씨" subtitle="도시 기후 기반 요약">
            <div className="flex items-center gap-3">
              <CloudSun className="size-9 text-primary" />
              <div>
                <p className="text-2xl font-semibold">{plan.city_payload.climate === "tropical" ? "덥고 습함" : "온화"}</p>
                <p className="text-xs text-muted-foreground">실시간 날씨 API 연결 전까지 도시 기후 데이터로 표시됩니다.</p>
              </div>
            </div>
          </WidgetCard>
        );
      case "exchange":
        return (
          <WidgetCard key={widgetId} title="환율 변환" subtitle={`${currencyCode} → KRW`}>
            <div className="space-y-3">
              <DashboardInput
                type="number"
                value={localAmount}
                onChange={(event) => setLocalAmount(Number(event.target.value))}
              />
              <p className="text-lg font-semibold">{formatCurrencyAmount(krwConverted, "KRW", "ko-KR")}</p>
              <p className="text-xs text-muted-foreground">현재는 USD/KRW 기준 보수적 환산값입니다.</p>
            </div>
          </WidgetCard>
        );
      case "stay":
        return (
          <WidgetCard key={widgetId} title="체류 일자" subtitle={`${stayDay}일차`}>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <CalendarDays className="size-8 text-primary" />
                <p className="text-3xl font-semibold">{stayDay}일차</p>
              </div>
              <DashboardInput type="date" value={arrivedAt} onChange={(event) => setArrivedAt(event.target.value)} />
              <button
                type="button"
                onClick={() => onPatchPlan({ arrived_at: arrivedAt })}
                className="text-xs text-primary"
              >
                입국일 저장
              </button>
            </div>
          </WidgetCard>
        );
      case "visa":
        return (
          <WidgetCard key={widgetId} title="비자 정보" subtitle="관광비자 기본값, 수령 후 업데이트">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Plane className="size-4 text-primary" />
                <span>{visaType}</span>
              </div>
              <DashboardInput value={visaType} onChange={(event) => setVisaType(event.target.value)} />
              <DashboardInput type="date" value={visaExpiresAt} onChange={(event) => setVisaExpiresAt(event.target.value)} />
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => onPatchPlan({ visa_type: visaType, visa_expires_at: visaExpiresAt || null })}
                  className="text-xs text-primary"
                >
                  비자 상태 저장
                </button>
                {visaUrl && (
                  <a href={String(visaUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary">
                    공식 신청 페이지 <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </div>
          </WidgetCard>
        );
      case "action_plan":
        return (
          <WidgetCard key={widgetId} title="이번 주 실행 플랜" subtitle="확정 도시 기준 기본 체크리스트" className="lg:col-span-2">
            <div className="grid gap-2 sm:grid-cols-2">
              {actions.map((action) => (
                <label key={action} className="flex items-center gap-2 rounded-lg border border-border bg-background/60 p-3 text-sm">
                  <input type="checkbox" className="size-4 accent-primary" />
                  {action}
                </label>
              ))}
            </div>
          </WidgetCard>
        );
      case "coworking":
        return (
          <WidgetCard key={widgetId} title="공유오피스" subtitle="위치와 월 비용">
            <div className="space-y-3">
              <Building2 className="size-7 text-primary" />
              <DashboardInput placeholder="공유오피스 이름" value={coworkName} onChange={(event) => setCoworkName(event.target.value)} />
              <DashboardInput type="number" placeholder="월 비용 USD" value={coworkCost} onChange={(event) => setCoworkCost(event.target.value)} />
              <button
                type="button"
                onClick={() => onPatchPlan({ coworking_space: { name: coworkName, monthly_cost_usd: Number(coworkCost || 0) } })}
                className="text-xs text-primary"
              >
                공유오피스 저장
              </button>
            </div>
          </WidgetCard>
        );
      case "tax":
        return (
          <WidgetCard key={widgetId} title="세금 관리" subtitle="현지/본국 거주자 리스크">
            <div className="space-y-3">
              <Landmark className="size-7 text-primary" />
              <p className="text-sm">세금 거주 기준: {taxDays ? `${taxDays}일` : "국가별 확인 필요"}</p>
              <DashboardInput type="number" placeholder="이번 달 해외소득 USD" value={monthlyIncome} onChange={(event) => setMonthlyIncome(event.target.value)} />
              <button
                type="button"
                onClick={() => onPatchPlan({ tax_profile: { monthly_income_usd: Number(monthlyIncome || 0), home_country: "KR" } })}
                className="text-xs text-primary"
              >
                소득 입력 저장
              </button>
            </div>
          </WidgetCard>
        );
      case "disaster":
        return (
          <WidgetCard key={widgetId} title="재난 현황" subtitle="기상 · 지진 · 안전 공지">
            <div className="flex items-center gap-3">
              <ShieldAlert className="size-8 text-primary" />
              <div>
                <p className="font-semibold text-emerald-400">현재 등록된 특보 없음</p>
                <p className="text-xs text-muted-foreground">공식 재난 API 연동 전까지 수동 확인용 상태로 표시됩니다.</p>
              </div>
            </div>
          </WidgetCard>
        );
      case "budget":
        return (
          <WidgetCard key={widgetId} title="월 예산" subtitle="도시 예상 생활비">
            <WalletCards className="mb-3 size-7 text-primary" />
            <p className="text-2xl font-semibold">${monthlyCost.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">중기 숙소와 생활비를 포함한 기준값입니다.</p>
          </WidgetCard>
        );
      case "housing":
        return (
          <WidgetCard key={widgetId} title="숙소 갱신" subtitle="중기 숙소 후보 관리">
            <Home className="mb-3 size-7 text-primary" />
            <p className="text-sm">다음 숙소 갱신일을 추가하고 후보 링크를 저장하세요.</p>
            {plan.city_payload.flatio_search_url && (
              <a href={String(plan.city_payload.flatio_search_url)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-primary">
                Flatio 후보 보기 <ExternalLink className="size-3" />
              </a>
            )}
          </WidgetCard>
        );
      case "insurance":
        return (
          <WidgetCard key={widgetId} title="보험/의료" subtitle="긴급 상황 대비">
            <HeartPulse className="mb-3 size-7 text-primary" />
            <p className="text-sm">해외 보험 증권, 병원, 긴급 연락처를 이 위젯에 저장하도록 확장할 수 있습니다.</p>
          </WidgetCard>
        );
      case "local_events":
        return (
          <WidgetCard key={widgetId} title="로컬 이벤트" subtitle="노마드 커뮤니티">
            <MapPin className="mb-3 size-7 text-primary" />
            <p className="text-sm">저장한 현지 이벤트와 노마드 밋업을 모아볼 수 있습니다.</p>
            {plan.city_payload.nomad_meetup_url && (
              <a href={String(plan.city_payload.nomad_meetup_url)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-primary">
                Meetup 보기 <ExternalLink className="size-3" />
              </a>
            )}
          </WidgetCard>
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-primary/40 bg-primary/10 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-serif text-xl font-bold">체류 타임라인</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {plan.city_kr || plan.city} {stayDay}일차 · 현재 비자: {plan.visa_type}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <BadgeDollarSign className="size-4 text-primary" />
            {currencyCode} 기준 환율/예산 관리
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-background">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, stayDay)}%` }} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {orderedWidgetIds.map((widgetId) => renderWidget(widgetId))}
      </div>
    </div>
  );
}
