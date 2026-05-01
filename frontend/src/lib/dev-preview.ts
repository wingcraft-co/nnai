"use client";

import type {
  DashboardPlan,
  DashboardWidgetCatalogItem,
  DashboardWidgetSettings,
} from "@/components/dashboard/types";
import { buildMockBriefing, type BriefingData } from "./briefing-data";

export { buildMockBriefing };
export type { BriefingData };

export type DevPreviewPlan = "free" | "pro";

export type DevPreviewState = {
  enabled: boolean;
  plan: DevPreviewPlan;
};

export function readDevPreview(): DevPreviewState {
  if (typeof window === "undefined") return { enabled: false, plan: "free" };
  const params = new URLSearchParams(window.location.search);
  const enabled = params.get("dev_preview") === "1";
  const plan: DevPreviewPlan = params.get("plan") === "pro" ? "pro" : "free";
  return { enabled, plan };
}

export function devPreviewQuery(state: DevPreviewState): string {
  if (!state.enabled) return "";
  return `?dev_preview=1&plan=${state.plan}`;
}

export function appendDevPreviewQuery(path: string, state: DevPreviewState): string {
  if (!state.enabled) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}dev_preview=1&plan=${state.plan}`;
}

export function mockBillingStatus(plan: DevPreviewPlan) {
  return {
    entitlement: {
      plan_tier: plan,
      status: "active",
    },
  };
}

export function mockDetailQuota(plan: DevPreviewPlan) {
  if (plan === "pro") {
    return { is_unlimited: true, limit: null, used: 0, remaining: null };
  }
  return { is_unlimited: false, limit: 2, used: 1, remaining: 1 };
}

export function mockDetailMarkdown(cityKr: string, city: string): string {
  const title = cityKr || city || "이 도시";
  return `# ${title} 상세 이민 가이드 (미리보기)

## 출국 전 준비사항

### 비자 신청
- 영사관 사이트에서 신청서 다운로드
- 재직증명서 + 급여명세서 3개월치 준비
- 무범죄증명서 발급 (발급일 3개월 이내)
- 의료보험 증명서

### 항공권 & 짐
- 편도 vs 왕복: 비자 종류에 따라 다름
- 출국 2~3개월 전 예약 권장
- 노트북 + 어댑터 + 백업 장비 체크리스트

## 도착 후 30일

### 거주지 등록
- 시청 또는 구청 방문해 거주증 신청
- 임대 계약서 + 여권 + 비자 사본 지참
- 발급까지 1~2주 소요

### 통신·금융
- 현지 SIM 또는 e-SIM 개통
- 은행 계좌 개설 (외국인 등록증 필수)
- 송금 한도 확인

## 첫 3개월

### 세무 거주지 임계점
- 누적 체류 90일 / 183일 임계점 사전 확인
- 한국과 이중과세 협정 적용 여부 검토
- 거주국 세무 신고 시점 정리

### 커뮤니티
- 한인회 / 동포 모임 등록
- 노마드 코워킹 1개월 멤버십으로 네트워킹 시작

## 장기 계획

### 비자 갱신
- 만료 2~3개월 전 갱신 신청
- 소득 증빙 / 거주 증빙 미리 준비

### 영주권 경로
- 일정 기간 거주 후 신청 자격
- 현지 변호사 상담 권장
`;
}

export function mockDashboardPlan(input: {
  city: string;
  cityKr: string | null;
  country: string;
  countryId: string;
  userProfile?: Record<string, unknown>;
}): DashboardPlan {
  const now = new Date().toISOString();
  return {
    id: 9999,
    city_id: input.city.toLowerCase(),
    city: input.city,
    city_kr: input.cityKr,
    country: input.country,
    country_id: input.countryId,
    city_payload: {},
    user_profile: input.userProfile ?? {},
    arrived_at: new Date().toISOString().slice(0, 10),
    visa_type: "관광비자",
    visa_expires_at: null,
    coworking_space: {},
    tax_profile: {},
    status: "active",
    created_at: now,
    updated_at: now,
  };
}

export function mockDashboardWidgets(): DashboardWidgetSettings {
  return {
    enabled_widgets: [
      "weather",
      "exchange",
      "stay",
      "visa",
      "action_plan",
      "coworking",
      "tax",
      "budget",
    ],
    widget_order: [
      "weather",
      "exchange",
      "stay",
      "visa",
      "action_plan",
      "coworking",
      "tax",
      "budget",
    ],
    widget_settings: {},
    updated_at: null,
  };
}

export function mockDashboardCatalog(): DashboardWidgetCatalogItem[] {
  return [
    { id: "weather", title: "날씨", description: "현재 날씨와 일기예보", locked: true },
    { id: "exchange", title: "환율", description: "원화 ↔ 현지 통화", locked: true },
    { id: "stay", title: "체류일", description: "도착일 기준 누적 일수", locked: true },
    { id: "visa", title: "비자 만료", description: "비자 만료까지 D-day", locked: true },
    { id: "action_plan", title: "액션 플랜", description: "30일 정착 체크리스트", locked: false },
    { id: "coworking", title: "코워킹 스페이스", description: "현지 코워킹 추천", locked: false },
    { id: "tax", title: "세무", description: "세무 거주지 임계점 추적", locked: false },
    { id: "disaster", title: "재난 알림", description: "현지 재해/안전 알림", locked: false },
    { id: "budget", title: "예산", description: "월 지출 추적", locked: false },
    { id: "housing", title: "주거", description: "임대 정보 관리", locked: false },
    { id: "insurance", title: "보험", description: "현지 의료보험 정보", locked: false },
    { id: "local_events", title: "현지 이벤트", description: "노마드/한인 모임", locked: false },
  ];
}

export const DEV_PREVIEW_PAYLOAD = {
  nationality: "한국",
  income_krw: 400,
  immigration_purpose: "원격 근무",
  lifestyle: ["일하기 좋은 인프라"],
  languages: [],
  timeline: "6개월 중기 체류",
  preferred_countries: [],
  preferred_language: "한국어",
  persona_type: null,
  income_type: "",
  travel_type: "혼자 (솔로)",
  children_ages: null,
  dual_nationality: false,
  readiness_stage: "",
  has_spouse_income: "없음",
  spouse_income_krw: 0,
};
