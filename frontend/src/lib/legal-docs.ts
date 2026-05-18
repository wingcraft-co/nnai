import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  extractHtmlBody,
  getLegalDocumentNames,
  parseMarkdownBlocks,
} from "@/lib/legal-content.mjs";

function resolveRepoPath(...segments: string[]) {
  return path.resolve(process.cwd(), "..", ...segments);
}

export async function readTermsBlocks(locale = "ko") {
  const filenames = getLegalDocumentNames(locale);
  const markdown = await readFile(resolveRepoPath(filenames.terms), "utf8");
  return parseMarkdownBlocks(markdown);
}

export async function readPrivacyBodyHtml(locale = "ko") {
  const filenames = getLegalDocumentNames(locale);
  const html = await readFile(resolveRepoPath("docs", filenames.privacy), "utf8");
  return extractHtmlBody(html);
}

export async function readPrivacyBodyHtmlByLocale() {
  const [ko, en] = await Promise.all([
    readPrivacyBodyHtml("ko"),
    readPrivacyBodyHtml("en"),
  ]);

  return { ko, en };
}
