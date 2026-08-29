import type { MetadataRoute } from "next";
import { blockHref, districtHref, listPublishedAtlasDistricts } from "@/lib/atlas/registry";
import { getDistrictDirectory } from "@/lib/atlas/district-directory";
import { listEnabledPlaces } from "@/lib/cities";
import { FEATURE_AVAILABILITY } from "@/lib/cities/routing";

const BASE = "https://neervazhvu.org";

// Per-feature sitemap hints. The set of features a city actually has is the
// single source of truth in FEATURE_AVAILABILITY (src/lib/cities/routing.ts);
// this map only supplies changeFrequency + priority. Unlisted features fall
// back to the default below.
const FEATURE_HINTS: Record<
  string,
  { changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }
> = {
  "": { changeFrequency: "daily", priority: 0.95 }, // city home
  facts: { changeFrequency: "daily", priority: 0.9 },
  groundwater: { changeFrequency: "monthly", priority: 0.85 },
  "my-ward": { changeFrequency: "monthly", priority: 0.85 },
  "flood-risk": { changeFrequency: "monthly", priority: 0.8 },
  rivers: { changeFrequency: "monthly", priority: 0.8 },
  "water-bodies": { changeFrequency: "monthly", priority: 0.8 },
  shoreline: { changeFrequency: "monthly", priority: 0.75 },
  tanker: { changeFrequency: "monthly", priority: 0.75 },
  cascades: { changeFrequency: "yearly", priority: 0.6 },
  origins: { changeFrequency: "yearly", priority: 0.6 },
  about: { changeFrequency: "monthly", priority: 0.5 },
};

const DEFAULT_HINT = { changeFrequency: "monthly" as const, priority: 0.6 };

// lake-restoration is a legacy redirect alias (-> water-bodies); never list it.
const EXCLUDED_FEATURES = new Set(["lake-restoration"]);

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  // The project landing page.
  entries.push({ url: BASE, lastModified: now, changeFrequency: "weekly", priority: 1.0 });

  for (const place of listEnabledPlaces()) {
    const features = FEATURE_AVAILABILITY[place.cityId];
    if (!features) continue;
    for (const feature of features) {
      if (EXCLUDED_FEATURES.has(feature)) continue;
      const hint = FEATURE_HINTS[feature] ?? DEFAULT_HINT;
      entries.push({
        url: feature === "" ? `${BASE}/${place.cityId}` : `${BASE}/${place.cityId}/${feature}`,
        lastModified: now,
        changeFrequency: hint.changeFrequency,
        priority: hint.priority,
      });
    }
  }

  // Atlas districts: published ones only, never preview-gated ones, the same
  // rule the route guard applies. District and block pages are listed; the
  // Gram Panchayat pages are reached through them and are not destinations.
  for (const district of listPublishedAtlasDistricts()) {
    entries.push({
      url: `${BASE}${districtHref(district)}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    });
    const directory = getDistrictDirectory(district.stateSlug, district.slug);
    for (const block of directory?.blocks ?? []) {
      entries.push({
        url: `${BASE}${blockHref(district, block.code)}`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  }

  return entries;
}
