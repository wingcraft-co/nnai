import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAnyplaceUrl,
  buildCityResourceLinks,
  buildCoworkerUrl,
  buildFlatioUrl,
  buildNumbeoUrl,
} from "./city-links.mjs";

test("builds Flatio city search URLs with title case and underscores", () => {
  assert.equal(buildFlatioUrl({ city: "Lisbon" }), "https://www.flatio.com/s/Lisbon");
  assert.equal(buildFlatioUrl({ city: "Chiang Mai" }), "https://www.flatio.com/s/Chiang_Mai");
  assert.equal(
    buildFlatioUrl({ city: "Ho Chi Minh City" }),
    "https://www.flatio.com/s/Ho_Chi_Minh_City",
  );
});

test("builds Anyplace URLs only for supported city slugs", () => {
  assert.equal(
    buildAnyplaceUrl({ city: "Los Angeles" }),
    "https://www.anyplace.com/furnished-apartments/los-angeles",
  );
  assert.equal(
    buildAnyplaceUrl({ city: "Tokyo" }),
    "https://www.anyplace.com/furnished-apartments/tokyo",
  );
  assert.equal(buildAnyplaceUrl({ city: "Chiang Mai" }), null);
});

test("builds Coworker URLs from lowercase country and kebab city names", () => {
  assert.equal(
    buildCoworkerUrl({ city: "Kuala Lumpur", country: "Malaysia" }),
    "https://www.coworker.com/malaysia/kuala-lumpur?view=list",
  );
  assert.equal(
    buildCoworkerUrl({ city: "San Francisco", country: "United States" }),
    "https://www.coworker.com/united-states/san-francisco?view=list",
  );
});

test("builds Numbeo cost of living URLs with title case and hyphens", () => {
  assert.equal(
    buildNumbeoUrl({ city: "Honolulu" }),
    "https://www.numbeo.com/cost-of-living/in/Honolulu",
  );
  assert.equal(
    buildNumbeoUrl({ city: "Kuala Lumpur" }),
    "https://www.numbeo.com/cost-of-living/in/Kuala-Lumpur",
  );
  assert.equal(
    buildNumbeoUrl({ city: "Chiang Mai" }),
    "https://www.numbeo.com/cost-of-living/in/Chiang-Mai",
  );
});

test("builds localized city resource links with housing, coworking, and cost info", () => {
  const koLinks = buildCityResourceLinks({ city: "Chiang Mai", country: "Thailand" }, "ko");
  assert.deepEqual(koLinks, [
    { url: "https://www.flatio.com/s/Chiang_Mai", label: "월세 숙소 찾기" },
    { url: "https://www.coworker.com/thailand/chiang-mai?view=list", label: "공유오피스 찾기" },
    { url: "https://www.numbeo.com/cost-of-living/in/Chiang-Mai", label: "현지 물가 정보" },
  ]);

  const enLinks = buildCityResourceLinks({ city: "Tokyo", country: "Japan" }, "en");
  assert.deepEqual(enLinks, [
    { url: "https://www.flatio.com/s/Tokyo", label: "Monthly stay" },
    { url: "https://www.coworker.com/japan/tokyo?view=list", label: "Coworking space" },
    { url: "https://www.numbeo.com/cost-of-living/in/Tokyo", label: "Local cost info" },
  ]);
});
