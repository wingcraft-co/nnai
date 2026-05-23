export const FALLBACK_FLAG = "\u{1F30D}";

export function countryFlagEmoji(countryId: string | null | undefined): string {
  const code = (countryId ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return FALLBACK_FLAG;
  return Array.from(code)
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
}
