import type { MetadataRoute } from "next";

const BASE_URL = "https://nnai.app";
const LOCALES = ["ko", "en"] as const;

const STATIC_PATHS = [
  "",
  "/onboarding/quiz",
  "/onboarding/form",
  "/pricing",
  "/library",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const path of STATIC_PATHS) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${BASE_URL}/${locale}${path}`,
        lastModified: new Date(),
        changeFrequency: path === "" ? "weekly" : "monthly",
        priority: path === "" ? 1.0 : 0.8,
        alternates: {
          languages: Object.fromEntries(
            LOCALES.map((l) => [l, `${BASE_URL}/${l}${path}`]),
          ),
        },
      });
    }
  }

  return entries;
}
