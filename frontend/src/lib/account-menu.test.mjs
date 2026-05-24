import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { resolveAccountMenuDisplay } from "./account-menu.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const userAccountMenuSource = readFileSync(
  join(__dirname, "..", "components", "legal", "UserAccountMenu.tsx"),
  "utf8",
);
const googleLoginPanelSource = readFileSync(
  join(__dirname, "..", "components", "legal", "GoogleLoginPanel.tsx"),
  "utf8",
);

const labels = {
  fallbackName: "NNAI user",
  login: "login",
};

test("keeps the account menu visible for logged-in users", () => {
  const display = resolveAccountMenuDisplay(
    { logged_in: true, name: "case", picture: "https://example.com/me.png" },
    labels,
  );

  assert.deepEqual(display, {
    isLoggedIn: true,
    displayName: "case",
    picture: "https://example.com/me.png",
  });
});

test("keeps the account menu visible when auth is logged out or unavailable", () => {
  assert.deepEqual(resolveAccountMenuDisplay({ logged_in: false }, labels), {
    isLoggedIn: false,
    displayName: "login",
    picture: null,
  });
  assert.deepEqual(resolveAccountMenuDisplay(null, labels), {
    isLoggedIn: false,
    displayName: "login",
    picture: null,
  });
});

test("logout switches library storage back to guest scope before redirecting", () => {
  assert.match(userAccountMenuSource, /function startLogout\(\) \{[\s\S]*applyLibraryAuthScope\(null\);[\s\S]*window\.location\.assign\(buildLogoutUrl\(API_BASE, window\.location\.href\)\);[\s\S]*\}/);
  assert.match(googleLoginPanelSource, /function startLogout\(\) \{[\s\S]*applyLibraryAuthScope\(null\);[\s\S]*window\.location\.assign\(buildLogoutUrl\(API_BASE, window\.location\.href\)\);[\s\S]*\}/);
});

test("login controls render direct OAuth links so navigation does not depend on button handlers", () => {
  assert.match(userAccountMenuSource, /const loginHref = buildGoogleLoginUrl\(API_BASE, currentUrl \?\? undefined\)/);
  assert.match(userAccountMenuSource, /<a[\s\S]*href=\{loginHref\}[\s\S]*onClick=\{trackLoginIntent\}/);
  assert.match(userAccountMenuSource, /function trackLoginIntent\(\) \{/);
  assert.match(googleLoginPanelSource, /const loginHref = buildGoogleLoginUrl\(API_BASE, currentUrl \?\? undefined\)/);
  assert.match(googleLoginPanelSource, /<a[\s\S]*href=\{loginHref\}[\s\S]*onClick=\{trackLoginIntent\}/);
  assert.match(googleLoginPanelSource, /function trackLoginIntent\(\) \{/);
});
