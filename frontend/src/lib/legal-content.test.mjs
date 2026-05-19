import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGoogleLoginUrl,
  buildLogoutUrl,
  extractHtmlBody,
  getAnalyticsConsentCopy,
  getLegalDocumentNames,
  getLegalLabels,
  parseMarkdownBlocks,
  shouldHideLegalFooter,
  shouldUseDarkLegalChrome,
  stripLeadingHeadingBlock,
  stripLeadingHtmlHeading,
} from "./legal-content.mjs";

test("returns Korean legal footer labels", () => {
  const labels = getLegalLabels("ko");

  assert.equal(labels.footer.terms, "이용약관");
  assert.equal(labels.footer.privacy, "개인정보처리방침");
  assert.equal(labels.footer.support, "문의");
  assert.equal(labels.footer.privacySettings, "쿠키설정");
  assert.equal(labels.footer.close, "닫기");
});

test("returns account menu labels", () => {
  assert.equal(getLegalLabels("ko").account.logout, "로그아웃");
  assert.equal(getLegalLabels("ko").account.login, "로그인");
  assert.equal(getLegalLabels("ko").account.loggedOutName, "Guest");
  assert.equal(getLegalLabels("en").account.logout, "Log out");
  assert.equal(getLegalLabels("en").account.login, "login");
  assert.equal(getLegalLabels("en").footer.privacySettings, "Cookie");
});

test("builds Google login URL with encoded return_to", () => {
  const url = buildGoogleLoginUrl(
    "https://api.nnai.app",
    "https://dev.nnai.app/ko/login?from=pricing",
  );

  assert.equal(
    url,
    "https://api.nnai.app/auth/google?return_to=https%3A%2F%2Fdev.nnai.app%2Fko%2Flogin%3Ffrom%3Dpricing",
  );
});

test("builds logout URL with encoded return_to", () => {
  const url = buildLogoutUrl(
    "https://api.nnai.app",
    "https://dev.nnai.app/en/login",
  );

  assert.equal(
    url,
    "https://api.nnai.app/auth/logout?return_to=https%3A%2F%2Fdev.nnai.app%2Fen%2Flogin",
  );
});

test("hides legal footer on onboarding routes", () => {
  assert.equal(shouldHideLegalFooter("/ko/onboarding/form"), true);
  assert.equal(shouldHideLegalFooter("/en/onboarding/quiz/result"), true);
});

test("shows legal footer on pricing and login routes", () => {
  assert.equal(shouldHideLegalFooter("/ko/pricing"), false);
  assert.equal(shouldHideLegalFooter("/en/login"), false);
});

test("uses dark legal chrome on card result and guide routes", () => {
  assert.equal(shouldUseDarkLegalChrome("/ko/result"), true);
  assert.equal(shouldUseDarkLegalChrome("/en/result"), true);
  assert.equal(shouldUseDarkLegalChrome("/ko/guide/chiang-mai"), true);
  assert.equal(shouldUseDarkLegalChrome("/en/guide/lisbon"), true);
  assert.equal(shouldUseDarkLegalChrome("/ko/result/lisbon"), false);
  assert.equal(shouldUseDarkLegalChrome("/ko/onboarding/quiz/result"), false);
  assert.equal(shouldUseDarkLegalChrome("/ko"), false);
});

test("parses markdown into headings, paragraphs, and lists", () => {
  const blocks = parseMarkdownBlocks(`# Terms

## Refund

NNAI supports fair refunds.

- Duplicate charges
- Failed service delivery
`);

  assert.deepEqual(blocks[0], { type: "h1", text: "Terms" });
  assert.deepEqual(blocks[1], { type: "h2", text: "Refund" });
  assert.deepEqual(blocks[2], { type: "p", text: "NNAI supports fair refunds." });
  assert.deepEqual(blocks[3], {
    type: "ul",
    items: ["Duplicate charges", "Failed service delivery"],
  });
});

test("extracts the body fragment from trusted html", () => {
  const body = extractHtmlBody(`<!DOCTYPE html><html><body><h1>Privacy</h1><p>Safe.</p></body></html>`);

  assert.equal(body, "<h1>Privacy</h1><p>Safe.</p>");
});

test("strips the document title before rendering legal popups", () => {
  const blocks = parseMarkdownBlocks(`# Terms of Service

Last updated: Today
`);

  assert.deepEqual(stripLeadingHeadingBlock(blocks), [
    { type: "p", text: "Last updated: Today" },
  ]);
  assert.equal(
    stripLeadingHtmlHeading(`<h1>Privacy Policy</h1><p>Last updated.</p>`),
    "<p>Last updated.</p>",
  );
});

test("selects localized legal document filenames", () => {
  assert.deepEqual(getLegalDocumentNames("ko"), {
    terms: "TERMS.md",
    privacy: "privacy.html",
  });
  assert.deepEqual(getLegalDocumentNames("en"), {
    terms: "TERMS.en.md",
    privacy: "privacy.en.html",
  });
});

test("returns English analytics consent popup copy", () => {
  const copy = getAnalyticsConsentCopy("en", "full", "full");
  const essentialCopy = getAnalyticsConsentCopy("en", "essential", "essential");

  assert.equal(copy.title, "Cookie Settings");
  assert.equal(copy.description.includes("분석"), false);
  assert.equal(copy.description.includes("cookies"), true);
  assert.equal(copy.buttons.essential, "Essential only");
  assert.equal(copy.buttons.full, "Allow all");
  assert.equal(copy.currentSelection, "Current choice: Allow all · Full analytics");
  assert.equal(
    essentialCopy.currentSelection,
    "Current choice: Essential only · Essential analytics",
  );
});
