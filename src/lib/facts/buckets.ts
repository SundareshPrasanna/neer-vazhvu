/**
 * Facts page bucketing.
 *
 * Each fact has a free-form `category` string. To present facts in a
 * coherent way (rather than the historical "all jumbled by tier"
 * layout), this module maps categories to a small set of concept
 * buckets aligned with dashboard pages.
 *
 * Two cities use slightly different category vocabularies:
 *   - Chennai static-facts.ts uses lowercase, hyphenated categories
 *     ("water-bodies", "supply", "groundwater", ...)
 *   - Madurai facts JSON uses Title Case categories
 *     ("Water bodies", "Reservoirs", "Heritage", ...)
 *
 * The lookup is case-insensitive and handles both. Unknown categories
 * land in the "infrastructure" catch-all so a new category type
 * doesn't break the page; once the bucket assignment for the new type
 * is decided, add it here.
 *
 * Categories in EXCLUDED_FROM_FACTS_CATEGORIES never appear on /facts
 * - they belong to the Origins long-read narrative instead, where
 * they're surfaced as story prose rather than quotable numbers.
 */

import type { LanguageCode } from "@/lib/i18n/translations";

export type FactBucketId =
  | "reservoirs"
  | "groundwater"
  | "rivers"
  | "water-bodies"
  | "floods"
  | "infrastructure";

export interface FactBucketDef {
  id: FactBucketId;
  /** Bucket header label, per language. English required, others
   *  optional (English fallback at render time). */
  label: { en: string } & Partial<Record<LanguageCode, string>>;
  /** One-line description rendered under the header to anchor what
   *  this bucket covers. */
  description: { en: string } & Partial<Record<LanguageCode, string>>;
  /** Path suffix to the related dashboard page (without the cityId
   *  prefix). null when the bucket has no dedicated page. */
  pagePathSuffix: string | null;
  pageLabel: { en: string } & Partial<Record<LanguageCode, string>>;
}

/** Buckets in display order. Mirrors the city dashboard's nav order
 *  so a reader scanning facts encounters them in the same sequence
 *  they'd see on the live dashboard. */
export const BUCKETS: readonly FactBucketDef[] = [
  {
    id: "reservoirs",
    label: { en: "Reservoirs & supply", ta: "நீர்த்தேக்கங்கள் & வழங்கல்" },
    description: {
      en: "Live reservoir storage, refill rates, monsoon catchment context, and the urban supply chain that draws from them.",
      ta: "நேரடி நீர்த்தேக்க சேமிப்பு, நிரப்பு விகிதங்கள், பருவமழை நீர்வழிப் பின்னணி, மற்றும் இவற்றிலிருந்து எடுக்கப்படும் நகர வழங்கல் சங்கிலி.",
    },
    pagePathSuffix: "",
    pageLabel: { en: "dashboard", ta: "டாஷ்போர்டு" },
  },
  {
    id: "groundwater",
    label: { en: "Groundwater", ta: "நிலத்தடி நீர்" },
    description: {
      en: "Block-level CGWB exploitation, station depths, and the structural pressure on aquifers.",
      ta: "வட்ட அளவில் CGWB சுரண்டல், நிலையங்களின் ஆழம், மற்றும் நிலத்தடி நீர்த் தொட்டிகளில் கட்டமைப்பு அழுத்தம்.",
    },
    pagePathSuffix: "/groundwater",
    pageLabel: { en: "groundwater map", ta: "நிலத்தடி நீர் வரைபடம்" },
  },
  {
    id: "rivers",
    label: { en: "Rivers", ta: "ஆறுகள்" },
    description: {
      en: "River basin context, water-quality stations, and the operational state of the rivers that feed (or used to feed) the city.",
      ta: "ஆற்றுப் படுகை பின்னணி, நீர் தர நிலையங்கள், மற்றும் நகரத்திற்கு நீர் வழங்கும் (அல்லது வழங்கிய) ஆறுகளின் நிலை.",
    },
    pagePathSuffix: "/rivers",
    pageLabel: { en: "rivers", ta: "ஆறுகள்" },
  },
  {
    id: "water-bodies",
    label: { en: "Water bodies & restoration", ta: "நீர்நிலைகள் & மறுசீரமைப்பு" },
    description: {
      en: "Surviving and lost tanks, restoration programmes, and the flagship water-body inventory.",
      ta: "உள்ள மற்றும் இழந்த ஏரிகள், மறுசீரமைப்புத் திட்டங்கள், மற்றும் முக்கிய நீர்நிலை பட்டியல்.",
    },
    pagePathSuffix: "/water-bodies",
    pageLabel: { en: "water bodies map", ta: "நீர்நிலை வரைபடம்" },
  },
  {
    id: "floods",
    label: { en: "Floods & monsoon", ta: "வெள்ளம் & பருவமழை" },
    description: {
      en: "Flood-risk infrastructure, hazard mapping vintage, and rainfall-driven flooding context.",
      ta: "வெள்ள ஆபத்து உள்கட்டமைப்பு, ஆபத்து வரைபடத்தின் காலப்பகுதி, மற்றும் மழை தூண்டிய வெள்ளப் பின்னணி.",
    },
    pagePathSuffix: "/flood-risk",
    pageLabel: { en: "flood risk", ta: "வெள்ள ஆபத்து" },
  },
  {
    id: "infrastructure",
    label: { en: "Infrastructure & governance", ta: "உள்கட்டமைப்பு & நிர்வாகம்" },
    description: {
      en: "Sewage treatment capacity, governance authorities, transparency notes, and other supply-chain infrastructure.",
      ta: "கழிவுநீர் சுத்திகரிப்புத் திறன், நிர்வாக அதிகாரிகள், வெளிப்படைத்தன்மை குறிப்புகள், மற்றும் பிற வழங்கல்-சங்கிலி உள்கட்டமைப்பு.",
    },
    pagePathSuffix: null,
    pageLabel: { en: "", ta: "" },
  },
] as const;

/** Lowercase-normalized category -> bucket. Add a new category here
 *  when one shows up; the catch-all for unknown categories is
 *  "infrastructure". */
const CATEGORY_TO_BUCKET: Record<string, FactBucketId> = {
  // Reservoirs / supply
  supply: "reservoirs",
  rainfall: "reservoirs",
  reservoirs: "reservoirs",

  // Groundwater
  groundwater: "groundwater",

  // Rivers
  rivers: "rivers",

  // Water bodies / restoration / heritage tanks
  "water-bodies": "water-bodies",
  "water bodies": "water-bodies",
  restoration: "water-bodies",
  heritage: "water-bodies",

  // Floods
  flood: "floods",
  floods: "floods",

  // Infrastructure & governance (catch-all bucket)
  sewage: "infrastructure",
  sewerage: "infrastructure",
  transparency: "infrastructure",
  governance: "infrastructure",
  administration: "infrastructure",
  infrastructure: "infrastructure",
};

/** Categories that should NOT render on /facts. Their content lives in
 *  the city's Origins long-read narrative instead. The /facts page
 *  shows a banner pointing readers there when one or more excluded
 *  facts exist. */
export const EXCLUDED_FROM_FACTS_CATEGORIES: ReadonlySet<string> = new Set([
  "events", // historical narrative milestones (Day Zero, 2015 floods, etc.)
]);

/** Returns the bucket for a category, or null if the category is
 *  excluded from the facts page entirely. */
export function bucketForCategory(category: string): FactBucketId | null {
  const normalized = category.trim().toLowerCase();
  if (EXCLUDED_FROM_FACTS_CATEGORIES.has(normalized)) return null;
  return CATEGORY_TO_BUCKET[normalized] ?? "infrastructure";
}
