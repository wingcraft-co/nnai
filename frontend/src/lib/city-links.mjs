const ANYPLACE_CITY_SLUGS = new Set([
  "irvine",
  "jersey-city",
  "los-angeles",
  "manhattan-new-york-city",
  "san-francisco",
  "santa-clara",
  "tokyo",
]);

function asciiWords(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .match(/[A-Za-z0-9]+/g) ?? [];
}

function titleUnderscore(value = "") {
  return asciiWords(value)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("_");
}

function titleHyphen(value = "") {
  return asciiWords(value)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("-");
}

function kebab(value = "") {
  return asciiWords(value)
    .map((word) => word.toLowerCase())
    .join("-");
}

export function buildFlatioUrl(city) {
  const citySlug = titleUnderscore(city?.city);
  if (!citySlug) return null;
  return `https://www.flatio.com/s/${citySlug}`;
}

export function buildAnyplaceUrl(city) {
  const citySlug = kebab(city?.city);
  if (!ANYPLACE_CITY_SLUGS.has(citySlug)) return null;
  return `https://www.anyplace.com/furnished-apartments/${citySlug}`;
}

export function buildCoworkerUrl(city) {
  const countrySlug = kebab(city?.country);
  const citySlug = kebab(city?.city);
  if (!countrySlug || !citySlug) return null;
  return `https://www.coworker.com/${countrySlug}/${citySlug}?view=list`;
}

export function buildNumbeoUrl(city) {
  const citySlug = titleHyphen(city?.city);
  if (!citySlug) return null;
  return `https://www.numbeo.com/cost-of-living/in/${citySlug}`;
}

export function buildCityResourceLinks(city, locale = "ko") {
  const isEn = locale === "en";
  const links = [];
  const flatioUrl = buildFlatioUrl(city);
  const coworkerUrl = buildCoworkerUrl(city);
  const numbeoUrl = buildNumbeoUrl(city);

  if (flatioUrl) {
    links.push({
      url: flatioUrl,
      label: isEn ? "Monthly stay" : "월세 숙소 찾기",
    });
  }

  if (coworkerUrl) {
    links.push({
      url: coworkerUrl,
      label: isEn ? "Coworking space" : "공유오피스 찾기",
    });
  }

  if (numbeoUrl) {
    links.push({
      url: numbeoUrl,
      label: isEn ? "Local cost info" : "현지 물가 정보",
    });
  }

  return links;
}
