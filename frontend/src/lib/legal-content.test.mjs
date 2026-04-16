import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGoogleLoginUrl,
  buildLogoutUrl,
  extractHtmlBody,
  getLegalLabels,
  parseMarkdownBlocks,
  shouldHideLegalFooter,
} from "./legal-content.mjs";

test("returns Korean legal footer labels", () => {
  const labels = getLegalLabels("ko");

  assert.equal(labels.footer.terms, "이용약관");
  assert.equal(labels.footer.privacy, "개인정보처리방침");
  assert.equal(labels.footer.support, "문의");
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
