import test from "node:test";
import assert from "node:assert/strict";

import { resolveAccountMenuDisplay } from "./account-menu.mjs";

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
