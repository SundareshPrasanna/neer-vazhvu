import type { NewsDomain } from "@/types/news";

/** Keywords that classify an article into a specific page domain. */
export const DOMAIN_KEYWORDS: Record<NewsDomain, string[]> = {
  reservoirs: [
    "reservoir", "storage", "inflow", "metro water", "cmwssb",
    "desalination", "poondi", "red hills", "veeranam",
    "chembarambakkam", "puzhal", "water supply", "water cut",
    "water shortage", "water crisis",
  ],
  groundwater: [
    "borewell", "bore well", "groundwater", "ground water",
    "water table", "cgwb", "hand pump", "tube well",
  ],
  flood: [
    "flood", "waterlogging", "water logging", "drainage",
    "monsoon", "cyclone", "storm water", "stormwater",
    "ndma", "water stagnation", "inundation",
  ],
  rivers: [
    "adyar", "cooum", "kosasthalaiyar", "buckingham canal",
    "river pollution", "stp", "sewage", "river cleaning",
    "river restoration",
  ],
  water_bodies: [
    "lake", "tank", "pond", "pallikaranai", "marshland",
    "water body", "water bodies", "lake restoration",
    "encroachment", "wetland",
  ],
};

/**
 * Chennai-specific place names and entities used as a locality signal.
 * An article must match at least one of these (case-insensitive) to be
 * considered Chennai-relevant. "Tamil Nadu" is intentionally excluded
 * as it's too broad.
 */
export const LOCALITY_TERMS: string[] = [
  "chennai", "cmwssb", "gcc",
  // Rivers
  "adyar", "cooum", "kosasthalaiyar", "buckingham canal",
  // Reservoirs
  "chembarambakkam", "puzhal", "red hills", "poondi", "veeranam",
  "cholavaram", "redhills",
  // Areas
  "pallikaranai", "sholinganallur", "porur", "velachery", "omr",
  "tambaram", "perungudi", "kodambakkam", "anna nagar", "t nagar",
  "mylapore", "royapuram", "tondiarpet", "ambattur", "madhavaram",
  "manali", "thiruvanmiyur", "nungambakkam", "teynampet",
  // Entities
  "greater chennai", "metro water", "chennai corporation",
];

/** The Google News RSS query. Fully Chennai-scoped. */
export const NEWS_RSS_QUERY =
  "(Chennai water OR Chennai flood OR Chennai groundwater OR Chennai river OR Chennai lake OR Chennai reservoir OR \"Chennai water supply\" OR Chennai desalination) when:7d";

export const NEWS_RSS_URL = `https://news.google.com/rss/search?q=${encodeURIComponent(NEWS_RSS_QUERY)}&hl=en-IN&gl=IN&ceid=IN:en`;
