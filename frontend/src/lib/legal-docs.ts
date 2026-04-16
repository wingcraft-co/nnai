import { readFile } from "node:fs/promises";
import path from "node:path";

import { extractHtmlBody, parseMarkdownBlocks } from "@/lib/legal-content.mjs";

function resolveRepoPath(...segments: string[]) {
  return path.resolve(process.cwd(), "..", ...segments);
}

export async function readTermsBlocks() {
  const markdown = await readFile(resolveRepoPath("TERMS.md"), "utf8");
  return parseMarkdownBlocks(markdown);
}

export async function readPrivacyBodyHtml() {
  const html = await readFile(resolveRepoPath("docs", "privacy.html"), "utf8");
  return extractHtmlBody(html);
}
