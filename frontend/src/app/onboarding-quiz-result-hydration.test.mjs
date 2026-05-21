import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "[locale]", "onboarding", "quiz", "result", "page.tsx"), "utf8");

test("quiz result page does not read localStorage during the initial render", () => {
  assert.doesNotMatch(source, /useState<PersonaType \| null>\(\(\) =>[\s\S]*localStorage\.getItem/);
});
