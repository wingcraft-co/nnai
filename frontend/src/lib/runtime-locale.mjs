export function resolveRuntimeLocale(acceptLanguage) {
  const header = typeof acceptLanguage === "string" ? acceptLanguage : "";
  const languages = header
    .split(",")
    .map((part) => part.trim().split(";")[0]?.toLowerCase())
    .filter(Boolean);

  return languages.some((language) => language === "ko" || language.startsWith("ko-"))
    ? "ko"
    : "en";
}

export function isDebugMode(value) {
  return value === "1";
}
