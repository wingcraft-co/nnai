"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { PERSONAS, type PersonaType } from "@/data/personas";

// ── Mock data (회의 시연용 — 방콕 고정) ─────────────────────────────

const MOCK_GUIDE = {
  country_flag: "🇹🇭",
  city_kr: "방콕",
  persona_type: "free_spirit" as PersonaType,
  travel_type: "배우자/파트너 동반",
  generated_at: "2026-04-17",
  sections: [
    {
      title: "비자 타임라인",
      body:
        "입국 후 90일 무비자로 시작하고, 60일 전에 DTV 신청을 준비하세요. 잔고 증명 500,000THB는 미리 3개월치 거래 내역으로 준비하는 게 안전해요.",
    },
    {
      title: "예산 시뮬레이션",
      body:
        "파트너와 함께라면 월 $2,200~$2,600 예산을 기준으로 잡아요. 통로/아리 지역 월세 $900, 식비 $600, 교통 $150, 코워킹 $120, 여유 $400 내외예요.",
    },
    {
      title: "세금 체크리스트",
      body:
        "한국 거주자 요건(183일)을 넘기면 한국 세금 신고 의무가 발생해요. 단기 체류라면 외국 소득 비과세 조건 그대로 유지돼요. 한-태 조세조약이 체결되어 있어 이중과세 위험은 낮아요.",
    },
    {
      title: "파트너와 함께라면",
      body:
        "실롬·아리 지역은 한인 커뮤니티가 활발하고, 파트너가 한국어 환경이 필요하다면 첫 거점으로 추천해요. BTS 아리역 주변 코워킹이 집에서 도보권인 숙소를 찾는 게 퀄리티 오브 라이프에 핵심이에요.",
    },
  ],
  disclaimer:
    "이 가이드는 AI가 생성한 정보예요. 비자·세금 결정 전 반드시 전문가 상담을 받으세요.",
};

// ── Label helpers ──────────────────────────────────────────────────

const TRAVEL_TYPE_LABEL: Record<string, string> = {
  "혼자 (솔로)": "솔로",
  "배우자/파트너 동반": "파트너 동반",
  "자녀 동반 (배우자 없이)": "자녀 동반",
  "가족 전체 동반": "가족 동반",
};

function personaKrLabel(type: string): string {
  if (type in PERSONAS) return PERSONAS[type as PersonaType].label;
  return "노마드";
}

function travelKrLabel(value: string): string {
  return TRAVEL_TYPE_LABEL[value] ?? value;
}

// ── Page ───────────────────────────────────────────────────────────

export default function GuideDemoPage() {
  const router = useRouter();

  const [personaType, setPersonaType] = useState<string>(MOCK_GUIDE.persona_type);
  const [travelType, setTravelType] = useState<string>(MOCK_GUIDE.travel_type);

  useEffect(() => {
    try {
      const p = localStorage.getItem("persona_type");
      if (p) setPersonaType(p);

      const sessionRaw = localStorage.getItem("result_session_v2");
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);
        const profile = session?.parsedData?._user_profile ?? {};
        if (typeof profile.travel_type === "string") {
          setTravelType(profile.travel_type);
        }
      }
    } catch {
      /* silent — MOCK 기본값 유지 */
    }
  }, []);

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/result");
    }
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      {/* Demo banner */}
      <div
        className="w-full py-2 text-center text-xs bg-primary/15"
        style={{ color: "var(--primary)" }}
      >
        🛠 데모 페이지입니다. 실제 AI 생성 결과가 아니에요.
      </div>

      <div className="max-w-lg mx-auto px-6 py-10">
        {/* Back */}
        <button
          type="button"
          onClick={handleBack}
          className="text-sm mb-6 text-muted-foreground hover:text-foreground transition-colors"
        >
          ← 결과로 돌아가기
        </button>

        {/* Header */}
        <header className="mb-8">
          <h1
            className="font-serif text-2xl font-bold"
            style={{ color: "var(--foreground)" }}
          >
            {MOCK_GUIDE.country_flag} {MOCK_GUIDE.city_kr} 맞춤 가이드
          </h1>
          <p
            className="font-mono text-xs mt-2"
            style={{ color: "var(--muted-foreground)", letterSpacing: "0.05em" }}
          >
            {personaKrLabel(personaType)} · {travelKrLabel(travelType)} · {MOCK_GUIDE.generated_at} 생성
          </p>
        </header>

        {/* Sections */}
        <section className="space-y-4">
          {MOCK_GUIDE.sections.map((s, i) => (
            <article
              key={i}
              className="rounded p-5"
              style={{ border: "1px solid var(--border)" }}
            >
              <h2
                className="font-serif text-base font-bold"
                style={{ color: "var(--primary)" }}
              >
                {s.title}
              </h2>
              <p
                className="font-sans text-sm mt-2 leading-relaxed"
                style={{ color: "var(--foreground)" }}
              >
                {s.body}
              </p>
            </article>
          ))}
        </section>

        {/* Disclaimer */}
        <p
          className="text-xs mt-6"
          style={{ color: "var(--muted-foreground)" }}
        >
          {MOCK_GUIDE.disclaimer}
        </p>
      </div>
    </div>
  );
}
