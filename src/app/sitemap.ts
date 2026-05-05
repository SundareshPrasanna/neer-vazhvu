import type { MetadataRoute } from "next";
import { listEnabledPlaces } from "@/lib/cities";

const BASE = "https://neervazhvu.org";

// Per-feature default sitemap metadata. Keep in sync with the routes that
// exist under both / (Chennai) and /[cityId]/ (other cities).
interface FeatureMeta {
  feature: string; // empty string = home/index
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}

const FEATURES: FeatureMeta[] = [
  { feature: "",                 changeFrequency: "daily",   priority: 1.0 },
  { feature: "facts",            changeFrequency: "daily",   priority: 0.95 },
  { feature: "groundwater",      changeFrequency: "monthly", priority: 0.9 },
  { feature: "my-ward",          changeFrequency: "monthly", priority: 0.9 },
  { feature: "flood-risk",       changeFrequency: "monthly", priority: 0.8 },
  { feature: "rivers",           changeFrequency: "monthly", priority: 0.8 },
  { feature: "water-bodies",     changeFrequency: "monthly", priority: 0.8 },
  { feature: "lake-restoration", changeFrequency: "monthly", priority: 0.7 },
  { feature: "about",            changeFrequency: "monthly", priority: 0.5 },
];

// Per-city feature support: which features have been built for each city.
// Keep in sync with FEATURE_AVAILABILITY in components/layout/city-switcher.tsx.
const CITY_FEATURE_SUPPORT: Record<string, Set<string>> = {
  chennai: new Set(FEATURES.map((f) => f.feature)),
  madurai: new Set(FEATURES.map((f) => f.feature)),
};

function urlForCityFeature(cityId: string, feature: string): string {
  // Chennai uses flat URLs at the root; other cities use /[cityId]/<feature>.
  if (cityId === "chennai") {
    return feature === "" ? BASE : `${BASE}/${feature}`;
  }
  return feature === "" ? `${BASE}/${cityId}` : `${BASE}/${cityId}/${feature}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const places = listEnabledPlaces();
  const entries: MetadataRoute.Sitemap = [];

  for (const place of places) {
    const supported = CITY_FEATURE_SUPPORT[place.cityId];
    if (!supported) continue;
    for (const feat of FEATURES) {
      if (!supported.has(feat.feature)) continue;
      entries.push({
        url: urlForCityFeature(place.cityId, feat.feature),
        lastModified: now,
        changeFrequency: feat.changeFrequency,
        priority: feat.priority,
      });
    }
  }

  return entries;
}
