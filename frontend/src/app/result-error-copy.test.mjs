import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "[locale]", "result", "page.tsx"), "utf8");

test("recommendation backend failures show a server instability message", () => {
  assert.match(source, /잠시 연결이 불안정합니다\.\\n문제가 계속되면 고객센터로 문의주세요\./);
  assert.doesNotMatch(source, /추천을 불러오지 못했어요\. 다시 시도해주세요\./);
  assert.doesNotMatch(source, /추천 도시를 불러오지 못했어요\. 다시 시도해주세요\./);
});

test("loading error retry actions show a pointer cursor", () => {
  assert.match(source, /className="[^"]*cursor-pointer[^"]*"[\s\S]*?>\s*다시 시도/);
  assert.match(source, /className="[^"]*cursor-pointer[^"]*"[\s\S]*?>\s*처음부터 다시하기/);
});

test("loading error message uses a subdued red warning tone", () => {
  assert.match(source, /<p className="[^"]*whitespace-pre-line[^"]*text-red-500\/80[^"]*">\{error\}<\/p>/);
  assert.doesNotMatch(source, /<p className="text-sm text-destructive">\{error\}<\/p>/);
});
