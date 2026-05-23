function normalizeLegalLocale(locale) {
  return locale === "ko" ? "ko" : "en";
}

const legalLabels = {
  ko: {
    footer: {
      terms: "이용약관",
      privacy: "개인정보처리방침",
      support: "문의",
      privacySettings: "쿠키설정",
      close: "닫기",
    },
    login: {
      eyebrow: "NNAI Account",
      title: "Google 로그인",
      description:
        "로그인하면 저장 기능과 유료 기능 상태를 계정에 연결할 수 있습니다.",
      login: "Google로 로그인",
      logout: "로그아웃",
      loading: "로그인 상태 확인 중...",
      loggedIn: "현재 로그인됨",
      loggedOut: "현재 로그아웃됨",
    },
    account: {
      fallbackName: "NNAI user",
      loggedOutName: "Guest",
      menuLabel: "계정 메뉴",
      login: "로그인",
      library: "보관함",
      logout: "로그아웃",
    },
    legal: {
      back: "홈으로",
      termsTitle: "이용약관",
      privacyTitle: "개인정보처리방침",
    },
  },
  en: {
    footer: {
      terms: "Terms",
      privacy: "Privacy",
      support: "Support",
      privacySettings: "Cookie",
      close: "Close",
    },
    login: {
      eyebrow: "NNAI Account",
      title: "Google Login",
      description:
        "Sign in to connect saved items and paid access to your account.",
      login: "Continue with Google",
      logout: "Log out",
      loading: "Checking session...",
      loggedIn: "Signed in",
      loggedOut: "Signed out",
    },
    account: {
      fallbackName: "NNAI user",
      loggedOutName: "Guest",
      menuLabel: "Account menu",
      login: "login",
      library: "Library",
      logout: "Log out",
    },
    legal: {
      back: "Back home",
      termsTitle: "Terms of Service",
      privacyTitle: "Privacy Policy",
    },
  },
};

export function getLegalLabels(locale) {
  return legalLabels[normalizeLegalLocale(locale)];
}

export function getLegalDocumentNames(locale) {
  return normalizeLegalLocale(locale) === "en"
    ? { terms: "TERMS.en.md", privacy: "privacy.en.html" }
    : { terms: "TERMS.md", privacy: "privacy.html" };
}

const analyticsConsentCopy = {
  ko: {
    title: "쿠키 설정",
    detailsLabel: "자세히 보기",
    closeLabel: "닫기",
    privacyTitle: "개인정보처리방침",
    description:
      "더 나은 사용자 경험과 사이트 개선을 위해 분석을 사용합니다. 필수 분석은 익명 최소 추적만, 전체 허용은 쿠키 기반 추적을 포함합니다.",
    unavailableNotice: "현재 preview에서는 전체 허용도 필수 분석으로 동작합니다.",
    currentPrefix: "현재 선택",
    buttons: {
      essential: "필수 분석만 허용",
      full: "전체 허용",
    },
    consentLabels: {
      essential: "필수 분석만 허용",
      full: "전체 허용",
      unknown: "선택 전",
    },
    modeLabels: {
      full: "전체 분석",
      essential: "필수 분석",
      pending: "대기",
    },
  },
  en: {
    title: "Cookie Settings",
    detailsLabel: "Details",
    closeLabel: "Close",
    privacyTitle: "Privacy Policy",
    description:
      "We use analytics to improve the product experience. Essential analytics uses minimal anonymous tracking, while full consent may use cookies for persistent tracking.",
    unavailableNotice: "In preview, full consent currently behaves as essential analytics.",
    currentPrefix: "Current choice",
    buttons: {
      essential: "Essential only",
      full: "Allow all",
    },
    consentLabels: {
      essential: "Essential only",
      full: "Allow all",
      unknown: "Not selected",
    },
    modeLabels: {
      full: "Full analytics",
      essential: "Essential analytics",
      pending: "Pending",
    },
  },
};

export function getAnalyticsConsentCopy(locale, consent = "unknown", effectiveMode = "pending") {
  const copy = analyticsConsentCopy[normalizeLegalLocale(locale)];
  const consentLabel = copy.consentLabels[consent] ?? copy.consentLabels.unknown;
  const modeLabel = copy.modeLabels[effectiveMode] ?? copy.modeLabels.pending;

  return {
    title: copy.title,
    detailsLabel: copy.detailsLabel,
    closeLabel: copy.closeLabel,
    privacyTitle: copy.privacyTitle,
    description: copy.description,
    unavailableNotice: copy.unavailableNotice,
    buttons: copy.buttons,
    currentSelection:
      consent === "unknown" ? null : `${copy.currentPrefix}: ${consentLabel} · ${modeLabel}`,
  };
}

export function buildGoogleLoginUrl(apiBase, returnTo) {
  const base = apiBase.replace(/\/$/, "");
  if (!returnTo) return `${base}/auth/google`;
  return `${base}/auth/google?return_to=${encodeURIComponent(returnTo)}`;
}

export function buildLogoutUrl(apiBase, returnTo) {
  const base = apiBase.replace(/\/$/, "");
  if (!returnTo) return `${base}/auth/logout`;
  return `${base}/auth/logout?return_to=${encodeURIComponent(returnTo)}`;
}

export function shouldHideLegalFooter(pathname = "") {
  return /(^|\/)onboarding(\/|$)/.test(pathname);
}

export function shouldUseDarkLegalChrome(pathname = "") {
  return /^\/(?:ko|en)\/result\/?$/.test(pathname)
    || /^\/(?:ko|en)\/library\/?$/.test(pathname)
    || /^\/(?:ko|en)\/guide\/[^/]+\/?$/.test(pathname);
}

export function parseMarkdownBlocks(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let index = 0;

  function pushParagraph(text) {
    if (text) blocks.push({ type: "p", text });
  }

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push({ type: "h1", text: line.slice(2).trim() });
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3).trim() });
      index += 1;
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push({ type: "h3", text: line.slice(4).trim() });
      index += 1;
      continue;
    }

    if (line.startsWith("- ")) {
      const items = [];
      while (index < lines.length && lines[index].trim().startsWith("- ")) {
        items.push(lines[index].trim().slice(2).trim());
        index += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    const paragraph = [];
    while (index < lines.length) {
      const value = lines[index].trim();
      if (!value) break;
      if (/^(#|##|###)\s/.test(value) || value.startsWith("- ")) break;
      paragraph.push(value.startsWith("> ") ? value.slice(2).trim() : value);
      index += 1;
    }
    pushParagraph(paragraph.join(" "));
  }

  return blocks;
}

export function extractHtmlBody(html) {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!match) return html.trim();
  return match[1].trim();
}

export function stripLeadingHeadingBlock(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return blocks;
  return blocks[0]?.type === "h1" ? blocks.slice(1) : blocks;
}

export function stripLeadingHtmlHeading(html) {
  return html.trim().replace(/^<h1\b[^>]*>[\s\S]*?<\/h1>\s*/i, "");
}
