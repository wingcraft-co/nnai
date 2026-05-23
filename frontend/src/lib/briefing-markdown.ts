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
