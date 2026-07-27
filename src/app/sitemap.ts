import type { MetadataRoute } from "next";
import { listEnabledPlaces } from "@/lib/cities";
import { listCorridors } from "@/lib/corridors";
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

  // Industrial corridor pages (non-city page type; src/lib/corridors/).
  for (const corridor of listCorridors()) {
    entries.push({
      url: `${BASE}/corridors/${corridor.corridorId}`,
      lastModified: now,
      changeFrequency: "yearly", // assessment editions are annual
      priority: 0.8,
    });
  }

  return entries;
}
