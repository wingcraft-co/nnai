import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "CityCompare.tsx"), "utf8");

test("retry CTA shows a pointer cursor", () => {
  assert.match(source, /className="[^"]*cursor-pointer[^"]*"[\s\S]*?>\s*처음부터 다시하기/);
});
