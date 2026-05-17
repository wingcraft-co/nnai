function normalizeLocale(locale) {
  return locale === "ko" ? "ko" : "en";
}

export function resolvePricingLocale({ routeLocale, acceptLanguage } = {}) {
  void acceptLanguage;
  return normalizeLocale(routeLocale);
}

const pricingContent = {
  en: {
    locale: "en",
    hero: {
      eyebrow: "NNAI Pricing",
      title: "Start free, upgrade when you need the full move plan.",
      description:
        "Free is for finding your top three cities and sampling detailed guidance. Pro is for people who want to keep iterating on visas, tax, Schengen planning, and city comparison without hitting the wall.",
    },
    plans: [
      {
        id: "free",
        name: "Free",
        price: "$0",
        period: "/month",
        description: "A lightweight entry plan for discovering where you could move next.",
        badge: "Default",
        summary: [
          "Top 3 city recommendations",
          "Step 2 detailed guide: 2 times per month",
          "Basic city comparison",
        ],
        features: [
          "See your top three recommended cities",
          "Open Step 2 detailed guidance twice each month",
          "Check base visa and lifestyle direction before paying",
          "Compare your recommended cities before paying",
        ],
        premiumGaps: [
          "No unlimited detail refreshes",
          "No Schengen visual calendar",
          "No detailed tax simulation",
          "No unlimited city comparison",
        ],
        cta: {
          kind: "link",
          label: "Start for free",
          href: "/onboarding/form",
        },
      },
      {
        id: "pro",
        name: "Pro",
        price: "$9.99",
        period: "/month",
        description: "For users actively designing a real relocation path, not just browsing destinations.",
        badge: "Recommended",
        summary: [
          "Unlimited Step 2 detailed guides",
          "Schengen visual calendar included",
          "Detailed tax simulation and unlimited compare",
        ],
        features: [
          "Unlimited Step 2 detailed guidance for repeated planning",
          "Schengen calculator with visual calendar workflow",
          "Detailed tax simulation beyond the basic warning layer",
          "Unlimited city comparison while refining your shortlist",
          "Nomad journey map for tracking verified stays",
        ],
        premiumGaps: [
          "Best fit once you are actively making a move",
        ],
        cta: {
          kind: "checkout",
          label: "Upgrade with Polar",
        },
      },
    ],
    payg: {
      title: "Optional PAYG after Pro",
      description:
        "PAYG is not a separate plan on this page. It is an optional extension that Pro users may enable later when they want more flexibility.",
      bullets: [
        "Available only after upgrading to Pro",
        "Default is OFF and must be turned on intentionally",
        "Protected by a monthly cap for cost control",
      ],
    },
    faq: {
      title: "Billing notes",
      items: [
        {
          question: "How many detailed guides are included on Free?",
          answer: "Free includes Step 2 detailed guidance up to 2 times per month.",
        },
        {
          question: "What becomes unlimited on Pro?",
          answer: "Pro unlocks unlimited Step 2 detailed guides, unlimited city comparison, and deeper planning workflows.",
        },
        {
          question: "How do payments work?",
          answer: "Pro checkout is handled securely through Polar.",
        },
      ],
    },
  },
  ko: {
    locale: "ko",
    hero: {
      eyebrow: "NNAI Pricing",
      title: "무료로 시작하고, 실제 이민 설계가 필요할 때 Pro로 확장하세요.",
      description:
        "Free는 TOP 3 도시 추천과 상세 가이드 맛보기에 적합합니다. Pro는 비자, 세금, 쉥겐 일정, 도시 비교를 반복하면서 실제 이동 계획을 구체화하려는 사용자를 위한 플랜입니다.",
    },
    plans: [
      {
        id: "free",
        name: "Free",
        price: "$0",
        period: "/월",
        description: "어디로 갈지 감을 잡는 탐색용 진입 플랜입니다.",
        badge: "기본 플랜",
        summary: [
          "TOP 3 도시 추천",
          "Step 2 상세 가이드 월 2회",
          "기본 도시 비교",
        ],
        features: [
          "내 조건에 맞는 TOP 3 추천 도시 확인",
          "Step 2 상세 가이드는 월 2회까지만 열람 가능",
          "결제 전에도 비자/생활 방향성은 먼저 점검 가능",
          "추천 도시를 결제 전 비교",
        ],
        premiumGaps: [
          "상세 가이드 무제한 재조회 불가",
          "쉥겐 시각화 캘린더 없음",
          "상세 세금 시뮬레이션 없음",
          "도시 무제한 비교 불가",
        ],
        cta: {
          kind: "link",
          label: "무료로 시작하기",
          href: "/onboarding/form",
        },
      },
      {
        id: "pro",
        name: "Pro",
        price: "$9.99",
        period: "/월",
        description: "탐색을 넘어 실제 이민 실행 계획을 계속 다듬어야 하는 사용자를 위한 플랜입니다.",
        badge: "추천 플랜",
        summary: [
          "Step 2 상세 가이드 무제한",
          "쉥겐 시각화 캘린더 포함",
          "세금 시뮬레이션 + 도시 무제한 비교",
        ],
        features: [
          "Step 2 상세 가이드를 횟수 제한 없이 반복 조회",
          "쉥겐 계산기를 시각화 캘린더 형태로 활용",
          "기본 세금 경고를 넘는 상세 세금 시뮬레이션 제공",
          "후보 도시를 제한 없이 계속 비교 가능",
          "인증한 체류 도시를 여정 지도로 기록",
        ],
        premiumGaps: [
          "실제 이민 설계 단계에서 가장 효율적인 플랜",
        ],
        cta: {
          kind: "checkout",
          label: "Polar로 업그레이드",
        },
      },
    ],
    payg: {
      title: "Pro 이후 선택형 PAYG",
      description:
        "PAYG는 별도 공개 플랜이 아니라 Pro 내부 확장 옵션입니다. Pro 사용자는 기본값 OFF로 시작하고, 더 많은 사용량이 필요할 때만 직접 ON 할 수 있습니다.",
      bullets: [
        "Pro 업그레이드 이후에만 활성화 가능",
        "기본값은 OFF이며 직접 켜야 함",
        "비용 통제를 위해 월 한도가 적용됨",
      ],
    },
    faq: {
      title: "결제 안내",
      items: [
        {
          question: "Free에서는 상세 가이드를 몇 번 볼 수 있나요?",
          answer: "Free는 Step 2 상세 가이드를 월 2회까지 볼 수 있습니다.",
        },
        {
          question: "Pro에서 무엇이 무제한이 되나요?",
          answer: "Pro는 Step 2 상세 가이드, 도시 비교, 더 깊은 이민 설계 흐름을 사실상 제한 없이 사용할 수 있습니다.",
        },
        {
          question: "결제는 어떻게 진행되나요?",
          answer: "Pro 결제는 Polar를 통해 안전하게 처리됩니다.",
        },
      ],
    },
  },
};

export function getPricingContent(locale) {
  return pricingContent[normalizeLocale(locale)];
}
