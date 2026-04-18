function normalizeLegalLocale(locale) {
  return locale === "ko" ? "ko" : "en";
}

const legalLabels = {
  ko: {
    footer: {
      terms: "이용약관",
      privacy: "개인정보처리방침",
      support: "문의",
      privacySettings: "분석 설정",
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
      privacySettings: "Analytics settings",
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
