import test from "node:test";
import assert from "node:assert/strict";

import { isDebugMode, resolveRuntimeLocale } from "./runtime-locale.mjs";

test("uses Korean only when the system language includes Korean", () => {
  assert.equal(resolveRuntimeLocale("ko-KR,ko;q=0.9,en-US;q=0.8"), "ko");
});

test("uses English for non-Korean system languages", () => {
  assert.equal(resolveRuntimeLocale("en-US,en;q=0.9"), "en");
  assert.equal(resolveRuntimeLocale("fr-FR,fr;q=0.9"), "en");
  assert.equal(resolveRuntimeLocale(""), "en");
});

test("debug mode is enabled only by explicit public flag", () => {
  assert.equal(isDebugMode("1"), true);
  assert.equal(isDebugMode("true"), false);
  assert.equal(isDebugMode(undefined), false);
});
