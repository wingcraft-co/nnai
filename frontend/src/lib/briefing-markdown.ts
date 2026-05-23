import type { BriefingData, BriefingSection } from "./briefing-data";

function sectionLines(section: BriefingSection, depth = 0): string[] {
  const headingPrefix = depth === 0 ? "##" : "###";
  const lines = [`${headingPrefix} ${section.num}${depth === 0 ? "." : ""} ${section.title}`];

  if (section.body) {
    lines.push("", section.body);
  }

  if (section.items?.length) {
    lines.push("");
    section.items.forEach((item, index) => {
      lines.push(`${String.fromCharCode(97 + (index % 26))}. ${item}`);
    });
  }

  if (section.table) {
    lines.push("");
    lines.push(`| ${section.table.headers.join(" | ")} |`);
    lines.push(`| ${section.table.headers.map(() => "---").join(" | ")} |`);
    section.table.rows.forEach((row) => {
      lines.push(`| ${row.join(" | ")} |`);
    });
    if (section.table.sourceLabel) {
      lines.push("", `_${section.table.sourceLabel}_`);
    }
  }

  section.subsections?.forEach((subsection) => {
    lines.push("", ...sectionLines(subsection, depth + 1));
  });

  return lines;
}

export function briefingToMarkdown(data: BriefingData): string {
  const titleHeading = data.cityKr
    ? `${data.cityKr} 정착 가이드`
    : `${data.cityName} Settlement Briefing`;
  const lines = [
    "# Country Briefing",
    "",
    "NomadNavigator AI · Wingcraft",
    `Classification: ${data.classification}`,
    `Document: ${data.documentId}`,
    `Issued: ${data.issuedDate}`,
    `Prepared for: ${data.preparedFor}`,
    "",
    `# ${titleHeading}`,
    "",
    data.countryOfficial,
    data.cityKr ? `City: ${data.cityKr} (${data.cityName})` : `City: ${data.cityName}`,
    `Country: ${data.countryId}`,
    "",
    "## Quick Facts",
    "",
    `- Visa: ${data.quickFacts.visa}`,
    `- Stay: ${data.quickFacts.stay}`,
    `- Monthly: ${data.quickFacts.monthly}`,
    `- Tax Res.: ${data.quickFacts.taxResidency}`,
  ];

  data.sections.forEach((section) => {
    lines.push("", ...sectionLines(section));
  });

  lines.push("", "## References", "");
  data.references.forEach((reference) => {
    const year = reference.year ? `, ${reference.year}` : "";
    lines.push(
      `[${reference.num}] ${reference.issuer}. ${reference.title}${year}. ${reference.url}`
    );
  });

  lines.push("", `NomadNavigator AI · ${data.classification}`, `Document ${data.documentId}`);

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

function valueAfter(line: string, label: string): string {
  return line.startsWith(label) ? line.slice(label.length).trim() : "";
}

function parseCityLine(line: string): { cityKr: string | null; cityName: string } {
  const value = valueAfter(line, "City:");
  const match = value.match(/^(.*?)\s+\((.*?)\)$/);
  if (match) {
    return {
      cityKr: match[1].trim() || null,
      cityName: match[2].trim(),
    };
  }
  return { cityKr: null, cityName: value };
}

function parseReference(line: string) {
  const match = line.match(/^\[(\d+)\]\s+(.+?)\.\s+(.+?)(?:,\s+(\d{4}))?\.\s+(.+)$/);
  if (!match) return null;
  return {
    num: Number(match[1]),
    issuer: match[2].trim(),
    title: match[3].trim(),
    year: match[4] ? Number(match[4]) : undefined,
    url: match[5].trim(),
  };
}

function isTableDivider(line: string): boolean {
  return /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line);
}

function parseTableRow(line: string): string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function briefingFromMarkdown(markdown: string): BriefingData | null {
  const lines = markdown.split("\n").map((line) => line.trim()).filter(Boolean);
  const classification = valueAfter(lines.find((line) => line.startsWith("Classification:")) ?? "", "Classification:");
  const documentId = valueAfter(lines.find((line) => line.startsWith("Document:")) ?? "", "Document:");
  const issuedDate = valueAfter(lines.find((line) => line.startsWith("Issued:")) ?? "", "Issued:");
  const preparedFor = valueAfter(lines.find((line) => line.startsWith("Prepared for:")) ?? "", "Prepared for:");
  const cityLine = lines.find((line) => line.startsWith("City:")) ?? "";
  const countryOfficialIndex = lines.findIndex((line) => line.startsWith("City:"));
  const countryOfficial = countryOfficialIndex > 0 ? lines[countryOfficialIndex - 1] : "";
  const countryId = valueAfter(lines.find((line) => line.startsWith("Country:")) ?? "", "Country:");
  const city = parseCityLine(cityLine);
  const quickFacts = {
    visa: valueAfter(lines.find((line) => line.startsWith("- Visa:")) ?? "", "- Visa:"),
    stay: valueAfter(lines.find((line) => line.startsWith("- Stay:")) ?? "", "- Stay:"),
    monthly: valueAfter(lines.find((line) => line.startsWith("- Monthly:")) ?? "", "- Monthly:"),
    taxResidency: valueAfter(lines.find((line) => line.startsWith("- Tax Res.:")) ?? "", "- Tax Res.:"),
  };

  if (!documentId || !issuedDate || !preparedFor || !classification || !city.cityName || !countryOfficial || !countryId) {
    return null;
  }

  const sections: BriefingSection[] = [];
  const references = [];
  let currentSection: BriefingSection | null = null;
  let currentSubsection: BriefingSection | null = null;
  let mode: "body" | "references" | "skip" = "skip";

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const sectionMatch = line.match(/^##\s+(\d+)\.\s+(.+)$/);
    const subsectionMatch = line.match(/^###\s+([\d.]+)\s+(.+)$/);

    if (line === "## References") {
      mode = "references";
      currentSection = null;
      currentSubsection = null;
      continue;
    }

    if (mode === "references") {
      const parsed = parseReference(line);
      if (parsed) references.push(parsed);
      continue;
    }

    if (sectionMatch) {
      currentSection = {
        num: sectionMatch[1],
        title: sectionMatch[2],
      };
      sections.push(currentSection);
      currentSubsection = null;
      mode = "body";
      continue;
    }

    if (subsectionMatch && currentSection) {
      currentSubsection = {
        num: subsectionMatch[1],
        title: subsectionMatch[2],
      };
      currentSection.subsections = [...(currentSection.subsections ?? []), currentSubsection];
      mode = "body";
      continue;
    }

    if (mode !== "body" || !currentSection) continue;
    const target = currentSubsection ?? currentSection;

    if (line.startsWith("|") && lines[index + 1] && isTableDivider(lines[index + 1])) {
      const headers = parseTableRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].startsWith("|")) {
        rows.push(parseTableRow(lines[index]));
        index += 1;
      }
      let sourceLabel: string | undefined;
      if (lines[index]?.startsWith("_") && lines[index]?.endsWith("_")) {
        sourceLabel = lines[index].slice(1, -1);
      } else {
        index -= 1;
      }
      target.table = { headers, rows, sourceLabel };
      continue;
    }

    if (/^[a-z]\.\s+/.test(line)) {
      target.items = [...(target.items ?? []), line.replace(/^[a-z]\.\s+/, "")];
      continue;
    }

    if (line.startsWith("# ") || line.startsWith("NomadNavigator AI") || line.startsWith("Classification:") || line.startsWith("Document ") || line.startsWith("Document:") || line.startsWith("Issued:") || line.startsWith("Prepared for:") || line.startsWith("Country:") || line.startsWith("City:") || line.startsWith("- ")) {
      continue;
    }

    target.body = target.body ? `${target.body}\n${line}` : line;
  }

  return {
    documentId,
    issuedDate,
    preparedFor,
    classification,
    cityName: city.cityName,
    cityKr: city.cityKr,
    countryOfficial,
    countryId,
    quickFacts,
    sections,
    references,
  };
}
