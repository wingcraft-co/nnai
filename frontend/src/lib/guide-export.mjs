export function markdownToCanvasLines(markdown) {
  return String(markdown || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (/^#{1,6}\s+/.test(line)) return line.replace(/^#{1,6}\s+/, '').trim();
      if (/^[-*]\s+/.test(line)) return `• ${line.replace(/^[-*]\s+/, '').trim()}`;
      return line;
    });
}

export function buildGuideExportFilename(cityLabel, extension) {
  const ascii = String(cityLabel || '')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((part) => /^[a-z0-9-]+$/.test(part));
  if (!ascii.length) return `nnai-guide.${extension}`;
  return `nnai-${ascii.join('-')}-guide.${extension}`;
}
