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
import { LOCKED_WIDGET_IDS } from "@/lib/dashboard-content.mjs";

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
      className={`h-11 w-full rounded-xl border border-black/10 bg-white/50 px-4 text-sm outline-none transition-all focus:border-primary focus:bg-white ${props.className ?? ""}`}
    />
  );
}

function SaveButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg bg-[#0071E3] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#0077ED] active:scale-95"
    >
      {children}
    </button>
  );
}

export function DashboardWidgets({
  plan,
  orderedWidgetIds,
  onPatchPlan,
  onRemoveWidget,
}: {
  plan: DashboardPlan;
  orderedWidgetIds: string[];
  onPatchPlan: (patch: PlanPatch) => Promise<void>;
  onRemoveWidget: (widgetId: string) => void;
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
    const isLocked = LOCKED_WIDGET_IDS.includes(widgetId);
    const handleRemove = () => onRemoveWidget(widgetId);

    switch (widgetId) {
      case "weather":
        return (
          <WidgetCard key={widgetId} title="날씨" subtitle="도시 기후 기반 요약" locked={isLocked} onRemove={handleRemove}>
            <div className="flex items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-500 shadow-inner">
                <CloudSun className="size-8" />
              </div>
              <div>
                <p className="text-3xl font-bold tracking-tight">{plan.city_payload.climate === "tropical" ? "덥고 습함" : "온화"}</p>
                <p className="text-[11px] font-medium text-muted-foreground/70">도시 기후 데이터를 표시 중입니다</p>
              </div>
            </div>
          </WidgetCard>
        );
      case "exchange":
        return (
          <WidgetCard key={widgetId} title="환율 변환" subtitle={`${currencyCode} → KRW`} locked={isLocked} onRemove={handleRemove}>
            <div className="space-y-4">
              <DashboardInput
                type="number"
                value={localAmount}
                onChange={(event) => setLocalAmount(Number(event.target.value))}
              />
              <div className="rounded-xl bg-emerald-50/50 p-4 border border-emerald-100/50">
                <p className="text-sm font-semibold text-emerald-700 mb-1">변환 금액</p>
                <p className="text-2xl font-bold text-emerald-900">{formatCurrencyAmount(krwConverted, "KRW", "ko-KR")}</p>
              </div>
            </div>
          </WidgetCard>
        );
      case "stay":
        return (
          <WidgetCard key={widgetId} title="체류 일자" subtitle={`${stayDay}일차`} locked={isLocked} onRemove={handleRemove}>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 shadow-inner">
                  <CalendarDays className="size-8" />
                </div>
                <p className="text-4xl font-bold tracking-tight">{stayDay}<span className="text-lg font-semibold">일차</span></p>
              </div>
              <div className="flex flex-col gap-3">
                <DashboardInput type="date" value={arrivedAt} onChange={(event) => setArrivedAt(event.target.value)} />
                <div className="flex justify-end">
                  <SaveButton onClick={() => onPatchPlan({ arrived_at: arrivedAt })}>
                    입국일 저장
                  </SaveButton>
                </div>
              </div>
            </div>
          </WidgetCard>
        );
      case "visa":
        return (
          <WidgetCard key={widgetId} title="비자 정보" subtitle="현재 비자 상태" locked={isLocked} onRemove={handleRemove}>
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-xl bg-orange-50 px-3 py-2 text-xs font-bold text-orange-700">
                <Plane className="size-3.5" />
                <span>{visaType}</span>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 ml-1">비자 종류</p>
                  <DashboardInput value={visaType} onChange={(event) => setVisaType(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 ml-1">만료 예정일</p>
                  <DashboardInput type="date" value={visaExpiresAt} onChange={(event) => setVisaExpiresAt(event.target.value)} />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 pt-1">
                <SaveButton onClick={() => onPatchPlan({ visa_type: visaType, visa_expires_at: visaExpiresAt || null })}>
                  비자 상태 저장
                </SaveButton>
                {visaUrl && (
                  <a href={String(visaUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0071E3] hover:underline">
                    공식 신청 페이지 <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </div>
          </WidgetCard>
        );
      case "action_plan":
        return (
          <WidgetCard key={widgetId} title="이번 주 실행 플랜" subtitle="체크리스트" className="lg:col-span-2" locked={isLocked} onRemove={handleRemove}>
            <div className="grid gap-3 sm:grid-cols-2">
              {actions.map((action) => (
                <label key={action} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-black/5 bg-white/40 p-4 transition-all hover:bg-white/60">
                  <input type="checkbox" className="size-5 accent-[#0071E3] rounded-lg" />
                  <span className="text-sm font-medium text-[#1D1D1F]">{action}</span>
                </label>
              ))}
            </div>
          </WidgetCard>
        );
      case "coworking":
        return (
          <WidgetCard key={widgetId} title="공유오피스" subtitle="업무 환경 정보" locked={isLocked} onRemove={handleRemove}>
            <div className="space-y-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-500 shadow-inner">
                <Building2 className="size-8" />
              </div>
              <div className="space-y-3">
                <DashboardInput placeholder="공유오피스 이름" value={coworkName} onChange={(event) => setCoworkName(event.target.value)} />
                <DashboardInput type="number" placeholder="월 비용 USD" value={coworkCost} onChange={(event) => setCoworkCost(event.target.value)} />
              </div>
              <div className="flex justify-end">
                <SaveButton onClick={() => onPatchPlan({ coworking_space: { name: coworkName, monthly_cost_usd: Number(coworkCost || 0) } })}>
                  공유오피스 저장
                </SaveButton>
              </div>
            </div>
          </WidgetCard>
        );
      case "tax":
        return (
          <WidgetCard key={widgetId} title="세금 관리" subtitle="거주자 리스크 추적" locked={isLocked} onRemove={handleRemove}>
            <div className="space-y-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 shadow-inner">
                <Landmark className="size-8" />
              </div>
              <div className="rounded-xl bg-black/5 p-4">
                <p className="text-xs font-medium text-muted-foreground/80 mb-1">세금 거주 기준</p>
                <p className="text-sm font-bold">{taxDays ? `${taxDays}일` : "국가별 확인 필요"}</p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 ml-1">이번 달 해외소득 USD</p>
                  <DashboardInput type="number" placeholder="금액 입력" value={monthlyIncome} onChange={(event) => setMonthlyIncome(event.target.value)} />
                </div>
              </div>
              <div className="flex justify-end">
                <SaveButton onClick={() => onPatchPlan({ tax_profile: { monthly_income_usd: Number(monthlyIncome || 0), home_country: "KR" } })}>
                  소득 입력 저장
                </SaveButton>
              </div>
            </div>
          </WidgetCard>
        );
      case "disaster":
        return (
          <WidgetCard key={widgetId} title="재난 현황" subtitle="안전 알림" locked={isLocked} onRemove={handleRemove}>
            <div className="flex items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 shadow-inner">
                <ShieldAlert className="size-8" />
              </div>
              <div>
                <p className="font-bold text-emerald-600">현재 특보 없음</p>
                <p className="text-[11px] font-medium text-muted-foreground/70 leading-relaxed">공식 재난 API 대기 중</p>
              </div>
            </div>
          </WidgetCard>
        );
      case "budget":
        return (
          <WidgetCard key={widgetId} title="월 예산" subtitle="예상 생활비" locked={isLocked} onRemove={handleRemove}>
            <div className="space-y-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500 shadow-inner">
                <WalletCards className="size-8" />
              </div>
              <div>
                <p className="text-4xl font-bold tracking-tight">${monthlyCost.toLocaleString()}</p>
                <p className="mt-2 text-[11px] font-medium text-muted-foreground/70 leading-relaxed">중기 숙소와 생활비를 포함한 기준값입니다</p>
              </div>
            </div>
          </WidgetCard>
        );
      case "housing":
        return (
          <WidgetCard key={widgetId} title="숙소 갱신" subtitle="다음 숙소 관리" locked={isLocked} onRemove={handleRemove}>
            <div className="space-y-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-purple-50 text-purple-500 shadow-inner">
                <Home className="size-8" />
              </div>
              <p className="text-sm font-medium leading-relaxed text-[#1D1D1F]">다음 숙소 갱신일을 추가하고 후보 링크를 저장하세요</p>
              {plan.city_payload.flatio_search_url && (
                <a href={String(plan.city_payload.flatio_search_url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0071E3] hover:underline">
                  Flatio 후보 보기 <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          </WidgetCard>
        );
      case "insurance":
        return (
          <WidgetCard key={widgetId} title="보험/의료" subtitle="긴급 상황 대비" locked={isLocked} onRemove={handleRemove}>
            <div className="space-y-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 shadow-inner">
                <HeartPulse className="size-8" />
              </div>
              <p className="text-sm font-medium leading-relaxed text-[#1D1D1F]">해외 보험 증권과 긴급 연락처를 저장하도록 확장할 수 있습니다</p>
            </div>
          </WidgetCard>
        );
      case "local_events":
        return (
          <WidgetCard key={widgetId} title="로컬 이벤트" subtitle="노마드 커뮤니티" locked={isLocked} onRemove={handleRemove}>
            <div className="space-y-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-500 shadow-inner">
                <MapPin className="size-8" />
              </div>
              <p className="text-sm font-medium leading-relaxed text-[#1D1D1F]">저장한 현지 이벤트와 노마드 밋업을 모아볼 수 있습니다</p>
              {plan.city_payload.nomad_meetup_url && (
                <a href={String(plan.city_payload.nomad_meetup_url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0071E3] hover:underline">
                  Meetup 보기 <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          </WidgetCard>
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-white/50 bg-white/40 p-8 shadow-sm backdrop-blur-md">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-serif text-2xl font-bold tracking-tight">체류 타임라인</h2>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              {plan.city_kr || plan.city} {stayDay}일차 · 현재 비자: {plan.visa_type}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-black/5 px-4 py-2 text-sm font-semibold">
            <BadgeDollarSign className="size-4 text-[#1D1D1F]" />
            {currencyCode} 기준 예산 관리 중
          </div>
        </div>
        <div className="mt-8 relative h-3 overflow-hidden rounded-full bg-black/5">
          <div 
            className="h-full rounded-full bg-[#0071E3] transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(0,113,227,0.4)]" 
            style={{ width: `${Math.min(100, stayDay)}%` }} 
          />
        </div>
      </section>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {orderedWidgetIds.map((widgetId) => renderWidget(widgetId))}
      </div>
    </div>
  );
}
