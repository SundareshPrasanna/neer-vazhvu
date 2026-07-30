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

  // Platform-scope families (P5-6, shipped 2026-07-26). The five that actually
  // version are registered once in scripts/source-registry/platform.json and
  // point back here; the two that do not version stay allowlisted with the
  // accurate reason. OpenStreetMap is continuously edited and Dynamic World is a
  // rolling GEE collection - neither has an "edition" to detect, so how often we
  // re-fetch them is a freshness question (P5-1), not an edition-watch question.
  "public/data/elevation-bands-chennai.geojson": "covered by the platform-scope entry fabdem-dem",
  "public/data/elevation-bands-bangalore.geojson": "covered by the platform-scope entry fabdem-dem",
  "public/data/elevation-bands-madurai.geojson": "covered by the platform-scope entry fabdem-dem",
  "public/data/elevation-bands-mumbai.geojson": "covered by the platform-scope entry fabdem-dem",
  "public/data/rich-bodies": "covered by the platform-scope entries jrc-global-surface-water / google-open-buildings / overture-buildings / google-dynamic-world / sentinel-2-l2a",
  "public/geojson/rich-bodies": "covered by the platform-scope GEE entries",
  "public/data/cascade": "covered by the platform-scope entries fabdem-dem / hydrosheds-basins / osm-overpass / google-dynamic-world / sentinel-2-l2a / overture-buildings",

  // Curated compilations (NVDM Madurai pilot, 2026-07-30). Each record carries
  // its own citation; the upstreams are episodic news/court/report documents
  // with no watchable listing page - the accountability lives per record, and
  // these reasons are the artifact-level decision on record.
  "public/data/restoration-projects-madurai.json": "curated compilation; per-record citations (court orders, MMC, press); no watchable listing",
  "public/data/river-events-madurai.json": "curated event timeline; per-record url citations; no watchable listing",
  "public/data/water-bodies-flagship-madurai.json": "curated flagship register; per-record citations (DHAN, MMC, press); no watchable listing",
  "public/data/industrial-sources-madurai.json": "qualitative one-off academic source (Columbia GSAPP studio book, spring 2016); statistics failed adversarial checks - see the file's _source_caveats",

  // Closed series. The upstream will not publish again; an edition watch would
  // be permanently silent, which is worse than an explicit note.
  "public/geojson/madurai-wards-2022.geojson": "closed edition: 2022 ward delimitation KML; boundaries change only at the next delimitation (term-expiry watch would be the upgrade)",
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

  // Delhi (audited 2026-07-26, after the city shipped in #184 - it was outside
  // the original sweep entirely).
  "public/data/restoration-priority-delhi.json": "derived: flagship scorer over covered inputs",
  "public/data/ward-risk-delhi.json": "derived composite",
  "public/data/delhi-ward-profiles.json": "derived join; the ward geometry is watched by opencity-delhi-mcd-wards",
  "public/data/water-bodies-lost-delhi.json": "archival",
  "public/data/rainfall-recent-delhi.json": "daily feed: owned by check-data-freshness.ts",
  "public/data/elevation-bands-delhi.geojson": "covered by the platform-scope entry fabdem-dem",
  "public/geojson/delhi-drainage.geojson":
    "OSM/Overpass: continuously edited, no editions (P5-1). No official Delhi drain GIS is public - the IFC " +
    "2018 Drainage Master Plan's 3,737 km across 11 agencies exists only as PDF maps, so these lengths are a floor.",
  "public/data/delhi-cgwb-stations.json":
    "historical series, not a live feed: WRIS telemetry across the Delhi network stops 2025-09-20 and the artifact " +
    "says so in _feed_status. Whether telemetry RESUMES is a feed question for P5-1, not an edition question.",

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
