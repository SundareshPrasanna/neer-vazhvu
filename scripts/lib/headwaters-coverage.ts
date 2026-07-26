/**
 * Headwaters coverage gate (P5-2).
 *
 * The onboarding gate in check-upstream-editions.ts asks only "does this city
 * have at least one registered source". That is a PRESENCE gate, not a coverage
 * gate, and it is why Bengaluru shipped 111 artifacts while watching one of
 * them. This module asks the real question instead: does every artifact the app
 * ships have a registered upstream, or an explicit reason why not?
 *
 * Reported, not enforced, by default. A hard failure today would block CI on
 * ~180 files at once, so the useful move is to make the number visible, drive it
 * down, and flip `--coverage --strict` on once the allowlist reflects reality.
 *
 * Design notes: docs/specs/headwaters-coverage-audit.md (local-only).
 */

import { existsSync, readdirSync, statSync } from "fs";
import { join, relative, sep } from "path";

/**
 * Directories collapsed to a single logical artifact. These are machine-generated
 * cohorts where per-file registry lineage would be noise: 129 rich-body folders
 * carry the same four upstreams (JRC GSW, Dynamic World, Overture, Open
 * Buildings), and per-basin atlas layers derive from one ingest manifest.
 */
const GROUPS = [
  "public/data/rich-bodies",
  "public/geojson/rich-bodies",
  "public/data/cascade",
  "public/data/basins",
];

/**
 * Artifacts with no registry entry and a reason on record. Every line here is a
 * decision, not a backlog item - anything genuinely pending belongs in the audit
 * doc's work order, not in this map.
 */
export const UNWATCHED: Record<string, string> = {
  // Self-computed from other artifacts already covered upstream. Watching the
  // derived file would double-alert on the same edition.
  "public/data/restoration-priority.json": "derived: scored from water-bodies + river layers already covered",
  "public/data/restoration-priority-bangalore.json": "derived: curated flagship set + scoring",
  "public/data/restoration-priority-madurai.json": "derived: flagship scorer",
  "public/data/restoration-priority-madurai-legacy.json": "superseded by restoration-priority-madurai.json",
  "public/data/restoration-priority-mumbai.json": "derived: flagship scorer",
  "public/data/ward-risk-bangalore.json": "derived composite (population, water bodies, density)",
  "public/data/ward-risk-madurai.json": "derived 3-factor composite",
  "public/data/ward-risk-mumbai.json": "derived: Praja supply hours + covered inputs",
  "public/data/ward-profiles.json": "derived join over covered ward-level layers",
  "public/data/bangalore-ward-profiles.json": "derived join",
  "public/data/madurai-ward-profiles.json": "derived join",
  "public/data/gee-phase1-water-body-targets.json": "our own GEE target manifest, not an upstream",
  "public/data/gee-phase1-water-body-targets-madurai.json": "our own GEE target manifest",

  // Platform-scope families. One registry entry each is the right shape and is
  // tracked as P5-6; until then they are declared here rather than per city.
  "public/geojson/chennai-rivers.geojson": "platform family: OSM/Overpass (P5-6)",
  "public/geojson/madurai-rivers.geojson": "platform family: OSM/Overpass (P5-6)",
  "public/geojson/mumbai-rivers.geojson": "platform family: OSM/Overpass (P5-6)",
  "public/geojson/bangalore-rivers.geojson": "platform family: OSM/Overpass (P5-6)",
  "public/geojson/chennai-water-bodies-current.geojson": "platform family: OSM/Overpass (P5-6)",
  "public/geojson/madurai-water-bodies-current.geojson": "platform family: OSM/Overpass (P5-6)",
  "public/geojson/mumbai-water-bodies-current.geojson": "platform family: OSM/Overpass (P5-6)",
  "public/geojson/chennai-industrial-zones.geojson": "platform family: OSM/Overpass (P5-6)",
  "public/geojson/mumbai-drainage.geojson": "platform family: OSM/Overpass (P5-6)",
  "public/geojson/mumbai-corporations-2024.geojson": "platform family: OSM/Overpass (P5-6)",
  "public/data/elevation-bands-chennai.geojson": "platform family: FABDEM via GEE (P5-6)",
  "public/data/elevation-bands-bangalore.geojson": "platform family: FABDEM via GEE (P5-6)",
  "public/data/elevation-bands-madurai.geojson": "platform family: FABDEM via GEE (P5-6)",
  "public/data/elevation-bands-mumbai.geojson": "platform family: FABDEM via GEE (P5-6)",
  "public/data/rich-bodies": "platform family: JRC GSW + Dynamic World + Overture + Open Buildings (P5-6)",
  "public/geojson/rich-bodies": "platform family: same GEE cohort (P5-6)",
  "public/data/cascade": "platform family: HydroSHEDS/MERIT via run_cascade.py (P5-6)",

  // Closed series. The upstream will not publish again; an edition watch would
  // be permanently silent, which is worse than an explicit note.
  "public/data/cooum-sewage-inlets.json": "closed series: Nethaji Mariappan et al. 2017, single study",
  "public/geojson/mumbai-flood-2005-hotspots.geojson": "closed series: 26/7/2005 reference layer",
  "public/data/water-bodies-lost-mumbai.json": "archival: Dwivedi & Mehrotra 1995",
  "public/geojson/mumbai-water-bodies-lost.geojson": "archival",
  "public/geojson/chennai-water-bodies-lost.geojson": "archival, per-feature sources",
  "public/geojson/madurai-water-bodies-lost.geojson": "archival, per-feature sources",
  "public/data/water-bodies-lost-bangalore.json": "archival",
  "public/data/water-bodies-lost-madurai.json": "archival",

  // Scheduled rebuilds. A workflow regenerates these on a cron, so the failure
  // mode is "the workflow stopped", not "upstream published". That belongs to
  // the freshness checker (P5-1), which does not cover them yet - the gap is
  // real but an edition watch is the wrong instrument for it.
  "public/data/imd-rainfall-monthly.json": "scheduled rebuild: imd-rainfall-refresh.yml quarterly; needs freshness coverage (P5-1)",
  "public/data/imd-rainfall-monthly-bangalore.json": "scheduled rebuild: imd-rainfall-refresh.yml (P5-1)",
  "public/data/imd-rainfall-monthly-madurai.json": "scheduled rebuild: imd-rainfall-refresh.yml (P5-1)",
  "public/data/imd-rainfall-monthly-mumbai.json": "scheduled rebuild: imd-rainfall-refresh.yml (P5-1)",
  "public/data/imd-rainfall-monthly-delhi.json": "scheduled rebuild: imd-rainfall-refresh.yml (P5-1)",
  "public/geojson/chennai-coastal-transects.geojson": "our own MNDWI/GEE computation, coastal-shoreline-refresh.yml annual (P5-1)",
  "public/geojson/mumbai-coastal-transects.geojson": "our own MNDWI/GEE computation, coastal-shoreline-refresh.yml annual (P5-1)",

  // Curated search indexes and label lookups. No upstream document exists.
  "public/data/chennai-localities.json": "curated search index, no upstream",
  "public/data/bangalore-localities.json": "curated search index, no upstream",
  "public/data/madurai-localities.json": "curated search index, no upstream",
  "public/data/delhi-localities.json": "curated search index, no upstream",
  "public/data/ward-names.json": "derived label lookup over the ward boundary layer",

  // Daily feeds. The freshness checker owns these; an edition watch on a page
  // that changes every day would alert every day.
  "public/data/rainfall-recent-chennai.json": "daily feed: owned by check-data-freshness.ts",
  "public/data/rainfall-recent-bangalore.json": "daily feed: owned by check-data-freshness.ts",
  "public/data/rainfall-recent-madurai.json": "daily feed: owned by check-data-freshness.ts",
  "public/data/rainfall-recent-mumbai.json": "daily feed: owned by check-data-freshness.ts",
  "public/data/mmr-dam-storage.json": "daily feed: owned by check-data-freshness.ts (EXTRA_FEEDS)",
  "public/data/mumbai-flood-hotspots.geojson": "weekly feed: owned by check-data-freshness.ts (EXTRA_FEEDS)",
};

function walk(dir: string, root: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, root, out);
    else if (/\.(json|geojson)$/.test(name)) out.push(relative(root, full).split(sep).join("/"));
  }
}

/** Collapse a path into its GROUPS prefix, if any. */
function collapse(path: string): string {
  return GROUPS.find((g) => path === g || path.startsWith(g + "/")) ?? path;
}

export interface CoverageResult {
  total: number;
  covered: string[];
  allowlisted: string[];
  uncovered: string[];
  /** Allowlist entries that no longer match any shipped artifact. */
  staleAllowlist: string[];
}

export function computeCoverage(root: string, dependsOn: string[]): CoverageResult {
  const files: string[] = [];
  walk(join(root, "public/data"), root, files);
  walk(join(root, "public/geojson"), root, files);

  const artifacts = [...new Set(files.map(collapse))].sort();
  const watched = new Set(
    dependsOn.filter((d) => !d.startsWith("supabase:")).map(collapse),
  );

  const covered: string[] = [];
  const allowlisted: string[] = [];
  const uncovered: string[] = [];
  for (const a of artifacts) {
    if (watched.has(a)) covered.push(a);
    else if (UNWATCHED[a]) allowlisted.push(a);
    else uncovered.push(a);
  }

  const known = new Set(artifacts);
  const staleAllowlist = Object.keys(UNWATCHED).filter((k) => !known.has(k)).sort();

  return { total: artifacts.length, covered, allowlisted, uncovered, staleAllowlist };
}

/** Bucket an artifact path by city, for a per-city readout. */
export function cityOf(path: string): string {
  const base = path.replace(/^public\/(data|geojson)\//, "");
  for (const c of ["chennai", "bangalore", "madurai", "mumbai", "delhi"]) {
    if (base.includes(c)) return c;
  }
  if (base.startsWith("basins/")) return "basin";
  if (/^(ward-|gw-|gwr-|imd-|river-quality|industrial-sources|restoration-|cooum-|mmr-)/.test(base))
    return "chennai"; // Chennai's legacy unprefixed names
  return "shared";
}
