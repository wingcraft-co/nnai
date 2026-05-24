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
const libraryPageSource = readFileSync(join(__dirname, "[locale]", "library", "page.tsx"), "utf8");
const onboardingFormSource = readFileSync(join(__dirname, "[locale]", "onboarding", "form", "page.tsx"), "utf8");
const onboardingQuizSource = readFileSync(join(__dirname, "[locale]", "onboarding", "quiz", "page.tsx"), "utf8");
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

test("guide result return restores completed cards instead of starting recommendation again", () => {
  assert.match(guideSource, /const GUIDE_RESULT_RESTORE_KEY = "guide_result_restore_requested"/);
  assert.match(guideSource, /localStorage\.setItem\(GUIDE_RESULT_RESTORE_KEY, "1"\)/);
  assert.match(guideSource, /router\.push\(`\/\$\{locale\}\/result`\)/);
  assert.doesNotMatch(guideSource, /window\.history\.back\(\)/);

  assert.match(source, /const GUIDE_RESULT_RESTORE_KEY = "guide_result_restore_requested"/);
  assert.match(source, /const shouldRestoreFromGuide = localStorage\.getItem\(GUIDE_RESULT_RESTORE_KEY\) === "1"/);
  assert.match(source, /if \(shouldRestoreFromGuide\) \{[\s\S]*?if \(restoreCompletedSession\(\)\) return;/);
  assert.match(source, /const hasNewPayload = !!localStorage\.getItem\(RECOMMEND_PAYLOAD_KEY\)/);
});

test("guide restores cached briefing when returning from the library", () => {
  assert.match(guideSource, /readingBriefing\?: BriefingData \| null/);
  assert.match(guideSource, /session\.readingMarkdown &&\s*session\.readingBriefing/);
  assert.match(guideSource, /setBriefing\(session\.readingBriefing\)/);
  assert.match(guideSource, /readingMarkdown: visibleMarkdown/);
  assert.match(guideSource, /readingBriefing: generated/);
  assert.match(guideSource, /billingStatus: currentBillingStatus/);
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
  assert.match(guideSource, /구매하신 보고서는 프로필의 보관함에서 다시 확인하실 수 있습니다\./);
  assert.doesNotMatch(guideSource, /Pro 플랜: 상세 가이드 횟수 제한 없이 사용할 수 있습니다\./);
  assert.match(guideSource, /무료 상세 가이드/);
  assert.match(guideSource, /className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground"/);
});

test("library loads saved markdown reports from the server for logged in users", () => {
  assert.match(libraryPageSource, /fetch\(`\$\{API_BASE\}\/api\/library\/guides`, \{ credentials: "include" \}\)/);
  assert.match(libraryPageSource, /libraryCardsFromServerGuides\(payload\.guides\)/);
  assert.match(libraryPageSource, /writeLibraryCards\(mergeLibraryCards\(readLibraryCards\(\), serverCards\)\)/);
});

test("guide ends with a small disclaimer card", () => {
  assert.match(guideSource, /function ReportDisclaimer/);
  assert.match(guideSource, /맞춤형 보고서는 한눈에 나에게 맞는 정보를 모아서 보여주는 참고 자료입니다/);
  assert.match(guideSource, /비자 정보와 세무 규정/);
  assert.match(guideSource, /text-\[11px\]/);
  assert.match(guideSource, /<ReportDisclaimer \/>/);
});

test("pro guide outputs never include watermarks while free previews keep them", () => {
  assert.match(guideSource, /<CountryBriefingDocument data=\{data\} watermark=\{false\} \/>/);
  assert.match(guideSource, /<ProBriefingPreview data=\{briefing\} documentRef=\{briefingDocumentRef\} \/>/);
  assert.match(guideSource, /<BriefingPngPreview data=\{briefing\} watermark=\{true\} \/>/);
  assert.match(guideSource, /<GuideImagePreview[\s\S]*watermark=\{true\}/);
});

test("pro guide export controls use icon buttons without explanatory copy", () => {
  assert.doesNotMatch(guideSource, /Pro 플랜: 워터마크 없이 텍스트와 내보내기를 사용할 수 있습니다\./);
  assert.match(guideSource, /aria-label="PNG로 저장"/);
  assert.match(guideSource, /aria-label="MD로 저장"/);
  assert.doesNotMatch(guideSource, /aria-label="프린트"/);
  assert.match(guideSource, /<ImageIcon className="size-4" \/>/);
  assert.match(guideSource, /<Download className="size-4" \/>/);
  assert.doesNotMatch(guideSource, /<Save className="size-4" \/>/);
  assert.doesNotMatch(guideSource, /<Printer className="size-4" \/>/);
  assert.doesNotMatch(guideSource, /FileText/);
  assert.match(guideSource, /async function downloadBriefingPng/);
  assert.doesNotMatch(guideSource, /async function printBriefingDocument/);
  assert.match(guideSource, /const \{ toPng \} = await import\("html-to-image"\)/);
  assert.match(guideSource, /briefingToMarkdown\(briefing\)/);
  assert.match(guideSource, /unlockLibraryGuide\(selected, briefingToMarkdown\(generated\), Date\.now\(\), generated\)/);
  assert.match(guideSource, /function saveVisibleGuideToServer/);
  assert.match(guideSource, /fetch\(`\$\{API_BASE\}\/api\/library\/guides`/);
  assert.match(guideSource, /cache_key: cacheKey/);
});

test("library page matches the dark card system and reopens the formatted briefing", () => {
  assert.match(libraryPageSource, /className="dark min-h-screen[^"]*w-full[^"]*flex-1[^"]*bg-background/);
  assert.match(libraryPageSource, /aspect-\[2\/3\]/);
  assert.match(libraryPageSource, /화투/);
  assert.doesNotMatch(libraryPageSource, /bg-\[#F5F5F7\]/);
  assert.doesNotMatch(libraryPageSource, /text\.score/);
  assert.doesNotMatch(libraryPageSource, /text\.monthly/);
  assert.doesNotMatch(libraryPageSource, /text\.visa/);
  assert.match(libraryPageSource, /CountryBriefingDocument/);
  assert.match(libraryPageSource, /function guideBriefing\(card: LibraryCard\)/);
  assert.match(libraryPageSource, /briefingToMarkdown\([^)]*\.guide_briefing\)/);
  assert.match(libraryPageSource, /briefingFromMarkdownWithFallback\(card\.guide_markdown/);
  assert.match(libraryPageSource, /aria-label="PNG로 저장"/);
  assert.match(libraryPageSource, /aria-label="MD로 저장"/);
  assert.doesNotMatch(libraryPageSource, /aria-label="프린트"/);
  assert.match(libraryPageSource, /<Download className="size-4" \/>/);
  assert.doesNotMatch(libraryPageSource, /<Printer className="size-4" \/>/);
  assert.match(libraryPageSource, /href="\/"/);
  assert.match(libraryPageSource, /import \{ Columns2, Download, House, Image as ImageIcon, LockKeyhole, X \} from "lucide-react"/);
  assert.match(libraryPageSource, /<House className="size-4" \/>/);
  assert.match(libraryPageSource, /href=\{`\/\$\{locale\}\?nav=home`\}/);
  assert.match(libraryPageSource, /aria-label=\{isKorean \? "홈으로" : "Go home"\}/);
  assert.doesNotMatch(libraryPageSource, /<Home className="size-6"/);
  assert.match(libraryPageSource, /\{reportCards\.length\} reports, \{cardCount\} cards, \{lockedCount\} locked cards/);
  assert.doesNotMatch(libraryPageSource, /\{displayCards\.length\} cards · \{guideCount\} reports/);
  assert.match(libraryPageSource, /buyGuide: isKorean \? "가이드 구매" : "Buy guide"/);
  assert.match(libraryPageSource, /href=\{guidePathForLibraryCard\(card, locale\)\}/);
  assert.match(libraryPageSource, /\{text\.buyGuide\}/);
  assert.doesNotMatch(libraryPageSource, /가이드 없음/);
  assert.match(libraryPageSource, /function countryFlagEmoji/);
  assert.match(libraryPageSource, /\{"\\u00A0"\}/);
  assert.match(libraryPageSource, /<span className="align-baseline text-sm" aria-hidden="true">\{countryFlagEmoji\(card\.country_id\)\}<\/span>/);
  assert.doesNotMatch(libraryPageSource, /<span className="ml-1[^"]*" aria-hidden="true">\{countryFlagEmoji\(card\.country_id\)\}<\/span>/);
  assert.match(libraryPageSource, /const showCompareButton = hasGuide && reportCards\.length > 1/);
  assert.match(libraryPageSource, /className=\{`space-y-1 \$\{showCompareButton \? "pr-7" : ""\}`\}/);
  assert.doesNotMatch(libraryPageSource, /<div className="space-y-1 pr-7">/);
  assert.doesNotMatch(libraryPageSource, /<p className="line-clamp-2[^"]*">\s*<span aria-hidden="true">\{countryFlagEmoji\(card\.country_id\)\}<\/span>/);
  assert.match(libraryPageSource, /collected: isKorean \? "CARD" : "CARD"/);
  assert.match(libraryPageSource, /locked: isKorean \? "LOCKED" : "LOCKED"/);
  assert.match(libraryPageSource, /display_status === "locked"/);
  assert.match(libraryPageSource, /buildLibraryDisplayCards\(cards, ALL_LIBRARY_CITIES\)/);
  assert.match(libraryPageSource, /LockKeyhole/);
  assert.match(libraryPageSource, /function closeCompareModal/);
  assert.match(libraryPageSource, /setCompareKeys\(\[\]\)/);
  assert.doesNotMatch(libraryPageSource, /onClick=\{\(\) => setCompareOpen\(false\)\}/);
  assert.match(libraryPageSource, /tipComparePrefix: isKorean \? "구매한 보고서들은" : "Purchased reports can be compared with"/);
  assert.match(libraryPageSource, /tipCompareSuffix: isKorean \? "버튼을 사용해 비교가 가능합니다\." : "button\."/);
  assert.match(libraryPageSource, /aria-label=\{text\.compareIconLabel\}/);
  assert.match(libraryPageSource, /<Columns2 className="size-3\.5" \/>/);
  assert.match(libraryPageSource, /function LockedTextBar/);
  assert.match(libraryPageSource, /isLocked \? \(\s*<div className="space-y-2 pt-2"/);
  assert.match(libraryPageSource, /<LockedTextBar source=\{card\.city_kr \|\| card\.city\} maxWidth=\{110\} \/>/);
  assert.match(libraryPageSource, /const opacity = isLocked \? 0\.48 : calculateTemporaryCardOpacity/);
  assert.match(libraryPageSource, /<p className="text-\[10px\] font-semibold uppercase tracking-normal text-primary\/70">\s*\{text\.locked\}\s*<\/p>/);
  assert.match(libraryPageSource, /absolute left-1\/2 top-1\/2/);
  assert.match(libraryPageSource, /<LockKeyhole className="size-9" \/>/);
  assert.doesNotMatch(libraryPageSource, /isLocked && <LockKeyhole className="size-3" \/>/);
  assert.match(libraryPageSource, /href=\{`\/\$\{locale\}\/onboarding\/form`\}/);
  assert.match(libraryPageSource, /findCity: isKorean \? "나에게 맞는 도시 찾기" : "Find my city"/);
  assert.doesNotMatch(libraryPageSource, /비교 아이콘 버튼을 사용해 비교가 가능합니다\./);
  assert.doesNotMatch(libraryPageSource, /lockedCard: isKorean \? "잠겨 있음" : "Locked"/);
});

test("explicit home buttons bypass auto-redirect and force the landing page", () => {
  assert.match(onboardingFormSource, /onClick=\{\(\) => router\.push\("\/\?nav=home"\)\}/);
  assert.match(onboardingQuizSource, /onClick=\{\(\) => router\.push\("\/\?nav=home"\)\}/);
  assert.match(homeSource, /const forceHome = searchParams\?\.get\("nav"\) === "home"/);
  assert.match(homeSource, /const HOME_PREFLIGHT_TIMEOUT_MS = 1500/);
  assert.match(homeSource, /controller\.abort\(\)/);
  assert.match(homeSource, /await fetchWithTimeout\(`\$\{API_BASE\}\/auth\/me`/);
  assert.match(homeSource, /if \(forceHome\) return;/);
  assert.doesNotMatch(homeSource, /animate-pulse rounded-full bg-primary\/20/);
  assert.doesNotMatch(homeSource, /initial: \{ opacity: 0, y: 16 \}/);
  assert.doesNotMatch(homeSource, /motion\.div/);
});

test("library page can compare two unlocked reports side by side", () => {
  assert.match(libraryPageSource, /Columns2/);
  assert.match(libraryPageSource, /const \[compareKeys, setCompareKeys\] = useState<string\[\]>\(\[\]\)/);
  assert.match(libraryPageSource, /const \[compareOpen, setCompareOpen\] = useState\(false\)/);
  assert.match(libraryPageSource, /function ReportPreviewPane/);
  assert.match(libraryPageSource, /function toggleCompareCard/);
  assert.match(libraryPageSource, /setCompareOpen\(true\)/);
  assert.match(libraryPageSource, /lg:grid-cols-2/);
  assert.match(libraryPageSource, /absolute right-2 top-2/);
  assert.match(libraryPageSource, /비교/);
});

test("briefing reference urls render as external hyperlinks", () => {
  assert.match(briefingDocumentSource, /function normalizeReferenceUrl/);
  assert.match(briefingDocumentSource, /<a\s+href=\{normalizeReferenceUrl\(r\.url\)\}/);
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

test("real guide loading prepares the formatted briefing without blocking detail loading", () => {
  assert.equal((guideSource.match(/await buildBriefing/g) ?? []).length, 1);
  assert.match(guideSource, /void buildBriefing/);
  assert.match(guideSource, /setBriefingLoading\(true\)/);
  assert.match(guideSource, /setBriefingLoading\(false\)/);
  assert.match(guideSource, /맞춤 보고서 서식을 준비하고 있어요\.\.\./);
});

test("pro briefing preview scales the 1080px document like the free png preview", () => {
  assert.match(guideSource, /const BRIEFING_DOCUMENT_WIDTH = 1080/);
  assert.match(guideSource, /function ProBriefingPreview/);
  assert.match(guideSource, /Math\.min\(1, containerWidth \/ BRIEFING_DOCUMENT_WIDTH\)/);
  assert.match(guideSource, /new ResizeObserver\(updateLayout\)/);
  assert.match(guideSource, /transform: `scale\(\$\{layout\.scale\}\)`/);
  assert.match(guideSource, /height: layout\.height \|\| undefined/);
  assert.match(guideSource, /<ProBriefingPreview data=\{briefing\} documentRef=\{briefingDocumentRef\} \/>/);
});

test("quota exceeded guide screen uses a purchase CTA instead of a free guide CTA", () => {
  assert.match(guideSource, /무료 상세 가이드 횟수를 모두 사용했습니다\./);
  assert.match(guideSource, /idleLabel="맞춤 가이드 구매"/);
  assert.doesNotMatch(guideSource, /idleLabel="맞춤 가이드 받기"/);
});
