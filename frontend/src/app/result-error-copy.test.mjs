import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { normalizeCompletedResultSession } from "../lib/result-session.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "[locale]", "result", "page.tsx"), "utf8");
const guideSource = readFileSync(join(__dirname, "[locale]", "guide", "[city_id]", "page.tsx"), "utf8");
const homeSource = readFileSync(join(__dirname, "[locale]", "page.tsx"), "utf8");
const dashboardSource = readFileSync(join(__dirname, "[locale]", "dashboard", "page.tsx"), "utf8");
const featureFlagSource = readFileSync(join(__dirname, "..", "lib", "feature-flags.ts"), "utf8");
const briefingSource = readFileSync(join(__dirname, "..", "lib", "briefing-generator.ts"), "utf8");
const briefingRouteSource = readFileSync(join(__dirname, "api", "briefing", "generate", "route.ts"), "utf8");
const briefingDocumentSource = readFileSync(join(__dirname, "..", "components", "guide", "CountryBriefingDocument.tsx"), "utf8");
const briefingPngPreviewSource = readFileSync(join(__dirname, "..", "components", "guide", "BriefingPngPreview.tsx"), "utf8");

test("recommendation backend failures show a server instability message", () => {
  assert.match(source, /서버가 불안정합니다\.\\n잠시 후 다시 시도해주세요\./);
  assert.doesNotMatch(source, /잠시 연결이 불안정합니다\.\\n문제가 계속되면 고객센터로 문의주세요\./);
  assert.doesNotMatch(source, /추천을 불러오지 못했어요\. 다시 시도해주세요\./);
  assert.doesNotMatch(source, /추천 도시를 불러오지 못했어요\. 다시 시도해주세요\./);
});

test("loading error retry actions show a pointer cursor", () => {
  assert.match(source, /className="[^"]*cursor-pointer[^"]*"[\s\S]*?>\s*카드 펼치기/);
  assert.match(source, /className="[^"]*cursor-pointer[^"]*"[\s\S]*?>\s*처음부터 다시하기/);
});

test("loading error message uses a subdued red warning tone", () => {
  assert.match(source, /<p className="[^"]*whitespace-pre-line[^"]*text-red-500\/80[^"]*">\{error\}<\/p>/);
  assert.doesNotMatch(source, /<p className="text-sm text-destructive">\{error\}<\/p>/);
});

test("completed result restore infers selected cards before rendering done state", () => {
  const allCities = [
    { city: "Lisbon", country_id: "PT" },
    { city: "Bangkok", country_id: "TH" },
    { city: "Taipei", country_id: "TW" },
    { city: "Porto", country_id: "PT" },
    { city: "Seoul", country_id: "KR" },
  ];
  const restored = normalizeCompletedResultSession({
    stage: "done",
    allCities,
    selectedIndices: [],
    revealedCities: [allCities[1], allCities[3], allCities[4]],
  });

  assert.deepEqual(restored?.selectedIndices, [1, 3, 4]);
});

test("guide loading copy says custom report and breathes while generating", () => {
  assert.match(guideSource, /맞춤 보고서를 생성하고 있어요\.\.\./);
  assert.match(guideSource, /animate-pulse/);
  assert.doesNotMatch(guideSource, /상세 가이드를 생성하고 있어요\.\.\./);
});

test("guide detail request forces preferred language from the route locale", () => {
  assert.match(guideSource, /function withRoutePreferredLanguage/);
  assert.match(guideSource, /locale === "ko" \? "한국어" : "English"/);
  assert.match(guideSource, /const localizedParsedData = withRoutePreferredLanguage\(session\.parsedData, locale\)/);
  assert.match(guideSource, /parsed_data: localizedParsedData/);
});

test("dashboard feature stays hidden for this release", () => {
  assert.match(featureFlagSource, /NEXT_PUBLIC_DASHBOARD_FEATURE_ENABLED === "true"/);
  assert.match(featureFlagSource, /NEXT_PUBLIC_DASHBOARD_FEATURE_ENABLED === "1"/);
  assert.doesNotMatch(featureFlagSource, /NEXT_PUBLIC_DASHBOARD_FEATURE_ENABLED \?\?/);
  assert.match(homeSource, /if \(!DASHBOARD_FEATURE_ENABLED\) \{\s*setChecking\(false\)/);
  assert.match(guideSource, /\{DASHBOARD_FEATURE_ENABLED && \(/);
  assert.match(dashboardSource, /router\.replace\("\/onboarding\/form"\)/);
  assert.match(dashboardSource, /준비 중인 기능입니다\./);
});

test("briefing fallback does not trigger a Next console error overlay", () => {
  assert.doesNotMatch(briefingSource, /console\.error/);
  assert.match(briefingSource, /console\.warn/);
});

test("briefing proxy upstream failures are warnings, not server errors", () => {
  assert.doesNotMatch(briefingRouteSource, /console\.error/);
  assert.match(briefingRouteSource, /console\.warn/);
});

test("free guide notice uses the quota card copy and neutral border style", () => {
  assert.doesNotMatch(guideSource, /무료 플랜에서는 Country Briefing이 Wingcraft 워터마크가 포함된 PNG 이미지로 표시됩니다/);
  assert.doesNotMatch(guideSource, /무료 플랜에서는 상세 가이드가 Wingcraft 워터마크가 포함된 PNG 이미지로 표시됩니다/);
  assert.match(guideSource, /function formatDetailQuotaLabel/);
  assert.match(guideSource, /무료 상세 가이드/);
  assert.match(guideSource, /className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground"/);
});

test("guide ends with a small disclaimer card", () => {
  assert.match(guideSource, /function ReportDisclaimer/);
  assert.match(guideSource, /맞춤형 보고서는 한눈에 나에게 맞는 정보를 모아서 보여주는 참고 자료입니다/);
  assert.match(guideSource, /비자 정보와 세무 규정/);
  assert.match(guideSource, /text-\[11px\]/);
  assert.match(guideSource, /<ReportDisclaimer \/>/);
});

test("pro guide outputs never include watermarks while free previews keep them", () => {
  assert.match(guideSource, /<CountryBriefingDocument data=\{briefing\} watermark=\{false\} \/>/);
  assert.match(guideSource, /<BriefingPngPreview data=\{briefing\} watermark=\{true\} \/>/);
  assert.match(guideSource, /renderGuidePngDataUrl\(markdown, `\$\{city\.city_kr \|\| city\.city\} 맞춤 가이드`, false\)/);
  assert.match(guideSource, /<GuideImagePreview[\s\S]*watermark=\{true\}/);
});

test("briefing reference urls render as external hyperlinks", () => {
  assert.match(briefingDocumentSource, /<a\s+href=\{r\.url\}/);
  assert.match(briefingDocumentSource, /target="_blank"/);
  assert.match(briefingDocumentSource, /rel="noopener noreferrer"/);
  assert.match(briefingDocumentSource, /\(\{r\.url\}\)/);
});

test("markdown guide urls render as external hyperlinks", () => {
  assert.match(guideSource, /function renderLinkedText/);
  assert.match(guideSource, /href=\{href\}/);
  assert.match(guideSource, /target="_blank"/);
  assert.match(guideSource, /rel="noopener noreferrer"/);
  assert.match(guideSource, /renderLinkedText\(text\)/);
});

test("free png guide previews block right click saving", () => {
  assert.match(guideSource, /onContextMenu=\{\(event\) => event\.preventDefault\(\)\}/);
  assert.match(briefingPngPreviewSource, /onContextMenu=\{\(event\) => event\.preventDefault\(\)\}/);
});
