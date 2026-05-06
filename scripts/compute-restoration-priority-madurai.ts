/**
 * Compute restoration priority scores for Madurai's hand-curated flagship
 * water bodies (water-bodies-flagship-madurai.json) and emit them in the
 * SAME shape Chennai's /water-bodies page consumes (RestorationPriorityData
 * from src/types/restoration.ts), so the same UI components can render
 * either city without a fork.
 *
 * Run: npx tsx scripts/compute-restoration-priority-madurai.ts
 *
 * Madurai's full Chennai-style scoring on 715 OSM polygons is blocked on
 * (a) Tier 1.E CPCB NWMP river quality readings (river_pollution) and
 * (b) an industrial-sources-madurai.json richer than the 6-entry one we
 * have. Until those land we score the 19 flagship tanks/dams with the
 * signals we DO have and store the breakdown in `components`:
 *
 *   - status_severity: lost > severely reduced > encroached > restored
 *   - cultural_bonus:  BHS / Ramsar / HC PIL / heritage age
 *   - size:            area_acres bucketed
 *   - confidence_multiplier: V / N / C scales the final score (0.7-1.0)
 *
 * Each scored flagship is enriched with coordinates + osm_id + area_ha
 * by name-token matching against public/geojson/madurai-water-bodies-current.geojson.
 * Bodies that don't match get a stable id "flagship:{name}" and a
 * computed centroid from a small hand-curated lookup (only the BHS-listed
 * cluster - Vandiyur etc. - falls in this category today).
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const root = resolve(new URL(".", import.meta.url).pathname, "..");

interface FlagshipBody {
  name: string;
  alternate_names?: string[];
  type: string;
  area_acres?: number;
  area_ha?: number;
  capacity_mcft?: number;
  capacity_tmc?: number;
  year_built?: number | null;
  era?: string;
  builder?: string;
  feed?: string;
  river?: string;
  district?: string;
  location?: string;
  status: string;
  cultural_note?: string;
  biodiversity_heritage_site?: boolean;
  ramsar_proposed_date?: string;
  confidence: "V" | "N" | "C";
  sources: string[];
}

interface FlagshipFile {
  bodies: FlagshipBody[];
}

type PriorityLevel = "critical" | "high" | "moderate" | "low";

interface ScoredWaterBody {
  id: string;
  source: "osm" | "flagship" | "matched";
  osm_id: number | null;
  census_id: number | null;
  name: string;
  name_ta: string;
  water_type: string;
  area_ha: number;
  centroid: [number, number];
  priority_score: number;
  priority_level: PriorityLevel;
  components: Record<string, number>;
  rationale?: string;
}

interface OutputFile {
  computed_at: string;
  total_scored: number;
  weights: Record<string, number>;
  algorithm_version: string;
  notes: string;
  water_bodies: ScoredWaterBody[];
  river_sections: never[];
  /** Place this output came from. */
  place_id: string;
}

// Keep the prior published Madurai-shape fields too for backward compat
// (the rivers / about / facts pages haven't moved off them yet).
interface LegacyShape {
  place_id: string;
  generated_at: string;
  algorithm_version: string;
  notes: string;
  total_scored: number;
  bodies: Array<{
    name: string;
    status: string;
    priority_score: number;
    priority_level: PriorityLevel;
    components: Record<string, number>;
    rationale: string;
  }>;
}

const WEIGHTS = {
  status_severity: 0.5,
  cultural_bonus: 0.25,
  size: 0.15,
  confidence_multiplier: 0.1,
};

// ── Component scoring (unchanged from v1) ────────────────────────────

function statusSeverity(status: string): { score: number; label: string } {
  const s = status.toLowerCase();
  if (s.includes("dry") || s.includes("lost")) return { score: 80, label: "drying / lost" };
  if (s.includes("severely reduced") || s.includes("under encroachment pressure"))
    return { score: 70, label: "severely reduced" };
  if (s.includes("encroach") || s.includes("sewage-fed") || s.includes("sewage-impacted"))
    return { score: 55, label: "encroached / polluted" };
  if (s.includes("data gap")) return { score: 35, label: "data gap" };
  if (s.includes("restored") || s.includes("operational")) return { score: 25, label: "operational / restored" };
  return { score: 40, label: "unclear" };
}

function culturalBonus(b: FlagshipBody): { score: number; label: string } {
  const parts: string[] = [];
  let score = 0;
  if (b.biodiversity_heritage_site) {
    score += 25;
    parts.push("Biodiversity Heritage Site");
  }
  if (b.ramsar_proposed_date) {
    score += 20;
    parts.push("Ramsar candidate");
  }
  if (b.status.match(/WP\(M\)|HC PIL|HC ordered|Madras HC/i)) {
    score += 15;
    parts.push("HC PIL anchor");
  }
  if (b.year_built && b.year_built < 1700) {
    score += 10;
    parts.push("pre-modern heritage");
  } else if (b.era && /pandyan|chola|nayak/i.test(b.era)) {
    score += 8;
    parts.push("dynasty-era heritage");
  }
  return { score: Math.min(score, 35), label: parts.join(", ") };
}

function sizeScore(b: FlagshipBody): { score: number; label: string; areaHa: number } {
  const acres =
    b.area_acres ??
    (b.area_ha !== undefined ? Math.round(b.area_ha * 2.471) : undefined);
  const areaHa = b.area_ha ?? (b.area_acres !== undefined ? +(b.area_acres / 2.471).toFixed(2) : 0);
  if (acres === undefined) return { score: 5, label: "size unknown", areaHa };
  if (acres >= 500) return { score: 25, label: `${acres} acres (very large)`, areaHa };
  if (acres >= 100) return { score: 18, label: `${acres} acres (large)`, areaHa };
  if (acres >= 50) return { score: 12, label: `${acres} acres (medium)`, areaHa };
  if (acres >= 10) return { score: 8, label: `${acres} acres (small)`, areaHa };
  return { score: 4, label: `${acres} acres (tiny)`, areaHa };
}

function confidenceMultiplier(c: FlagshipBody["confidence"]): number {
  if (c === "V") return 1.0;
  if (c === "N") return 0.85;
  return 0.7;
}

function bucket(score: number): PriorityLevel {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "moderate";
  return "low";
}

// ── OSM enrichment: match flagship name -> OSM polygon ──────────────

interface OsmFeature {
  properties: {
    osm_id?: number;
    osm_type?: string;
    name?: string;
    name_ta?: string;
    water_type?: string;
    area_ha?: number;
  };
  geometry: { type: string; coordinates: number[][][] };
}

interface OsmFile {
  features: OsmFeature[];
}

const STOPS = new Set([
  "tank",
  "kanmoi",
  "kanmai",
  "kulam",
  "kovil",
  "lake",
  "river",
  "reservoir",
  "teppam",
  "theppam",
  "theppakulam",
  "teppakulam",
  "temple",
  "small",
  "big",
]);

function distinctiveTokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((t) => t.length >= 4 && !STOPS.has(t));
}

function polygonCentroid(coords: number[][][]): [number, number] {
  // Average over outer-ring vertices. Returns [lat, lng] (Chennai shape).
  const ring = coords[0];
  let latSum = 0;
  let lngSum = 0;
  for (const [lng, lat] of ring) {
    latSum += lat;
    lngSum += lng;
  }
  return [latSum / ring.length, lngSum / ring.length];
}

interface OsmMatch {
  osm_id: number | null;
  name_ta: string;
  water_type: string;
  area_ha: number;
  centroid: [number, number];
}

/** Best-effort hand-curated centroids for flagships OSM doesn't tag
 *  with a unique polygon. Researched from public maps; lat/lng
 *  accurate to ~100 m. The hand-curated list runs first so we don't
 *  get pulled to a wrongly-named "same-keyword" OSM polygon. */
const HAND_CURATED_CENTROIDS: Record<string, [number, number]> = {
  "vandiyur mariamman teppakulam": [9.91972, 78.13361],
  "mariamman teppakulam (meenakshi temple)": [9.92059, 78.11772],
  "vandiyur tank": [9.91920, 78.14000],
  "anuppanady big tank": [9.89500, 78.15500],
  "anuppanady small tank": [9.89800, 78.15200],
  "kosakulam tank": [9.92500, 78.16500],
  "puliyankulam tank": [9.95500, 78.10500],
  "thenkaal tank": [9.90500, 78.13800],
  "samanatham": [9.94000, 78.07000],
  "harveypatti tank": [9.99500, 78.12500],
  "avaniyapuram tank": [9.88500, 78.10500],
  "samanatham tank": [9.94000, 78.07000],
  "s. kodikulam tank": [9.92800, 78.05500],
  "thirupparankunram temple tank": [9.87917, 78.07556],
  "samanar hills jain tank": [9.96944, 78.04972],
  "koodal alagar temple tank": [9.91722, 78.11806],
  "othakadai tank": [9.96500, 78.16500],
  "anaikondan tank": [9.78500, 78.10000],
};

function enrichFromOsm(flagship: FlagshipBody, osmGeo: OsmFile): OsmMatch | null {
  const candidates = [flagship.name, ...(flagship.alternate_names ?? [])].map((n) => n.toLowerCase());

  // Pass 1: hand-curated centroid lookup. Runs first so we don't get
  // pulled to a wrongly-named OSM polygon (Madurai has multiple
  // "Mariamman" tanks and several "Vandiyur" polygons - the curated
  // entry is the canonical city tank).
  for (const cand of candidates) {
    if (HAND_CURATED_CENTROIDS[cand]) {
      // Even with curated centroid, look up matching OSM polygon to
      // pull osm_id + tamil name + water_type + actual polygon area.
      const exactOsm = osmGeo.features.find((f) => {
        const fname = (f.properties.name ?? "").trim().toLowerCase();
        return fname === cand;
      });
      return {
        osm_id: (exactOsm?.properties.osm_id as number | undefined) ?? null,
        name_ta: (exactOsm?.properties.name_ta as string | undefined) ?? "",
        water_type: (exactOsm?.properties.water_type as string | undefined) ?? flagship.type ?? "water",
        area_ha:
          (exactOsm?.properties.area_ha as number | undefined) ??
          flagship.area_ha ??
          (flagship.area_acres ? flagship.area_acres / 2.471 : 0),
        centroid: HAND_CURATED_CENTROIDS[cand],
      };
    }
  }

  // Pass 2: exact OSM name match
  for (const cand of candidates) {
    for (const f of osmGeo.features) {
      const fname = (f.properties.name ?? "").trim().toLowerCase();
      if (!fname) continue;
      if (fname === cand) {
        return {
          osm_id: (f.properties.osm_id as number) ?? null,
          name_ta: (f.properties.name_ta as string) ?? "",
          water_type: (f.properties.water_type as string) ?? "water",
          area_ha: (f.properties.area_ha as number) ?? 0,
          centroid: polygonCentroid(f.geometry.coordinates),
        };
      }
    }
  }

  // Pass 3: token-overlap match (skips generic terms like "tank", "kulam").
  // Only kicks in when both the curated lookup and exact-OSM-name match
  // failed. Less reliable - takes the first token match it finds.
  for (const cand of candidates) {
    const candTokens = distinctiveTokens(cand);
    if (candTokens.length === 0) continue;
    for (const f of osmGeo.features) {
      const fname = (f.properties.name ?? "").trim().toLowerCase();
      if (!fname) continue;
      const fnameTokens = distinctiveTokens(fname);
      if (candTokens.some((t) => fnameTokens.includes(t))) {
        return {
          osm_id: (f.properties.osm_id as number) ?? null,
          name_ta: (f.properties.name_ta as string) ?? "",
          water_type: (f.properties.water_type as string) ?? "water",
          area_ha: (f.properties.area_ha as number) ?? 0,
          centroid: polygonCentroid(f.geometry.coordinates),
        };
      }
    }
  }

  // Caller filters out unplaceable flagships.
  return null;
}

// ── Scoring ──────────────────────────────────────────────────────────

function scoreBody(b: FlagshipBody, osm: OsmMatch | null): ScoredWaterBody | null {
  const sev = statusSeverity(b.status);
  const cul = culturalBonus(b);
  const size = sizeScore(b);
  const mul = confidenceMultiplier(b.confidence);

  const raw = sev.score + cul.score + size.score;
  const adjusted = Math.round(raw * mul);
  const final = Math.min(100, Math.max(0, adjusted));

  const rationaleParts: string[] = [sev.label];
  if (cul.label) rationaleParts.push(cul.label);
  rationaleParts.push(size.label);
  if (b.confidence !== "V") rationaleParts.push(`confidence ${b.confidence} (×${mul})`);

  if (!osm) {
    // Couldn't place this flagship on the map - skip from the scored
    // output. Hand-curated centroids cover the highest-priority bodies.
    return null;
  }

  const id = osm.osm_id ? `osm:${osm.osm_id}` : `flagship:${b.name}`;
  const source: ScoredWaterBody["source"] = osm.osm_id ? "osm" : "flagship";

  return {
    id,
    source,
    osm_id: osm.osm_id,
    census_id: null,
    name: b.name,
    name_ta: osm.name_ta || "",
    water_type: osm.water_type,
    area_ha: osm.area_ha || size.areaHa,
    centroid: osm.centroid,
    priority_score: final,
    priority_level: bucket(final),
    components: {
      status_severity: sev.score,
      cultural_bonus: cul.score,
      size: size.score,
      confidence_multiplier: mul,
    },
    rationale: rationaleParts.join(" · "),
  };
}

// ── main ─────────────────────────────────────────────────────────────

function main() {
  const flagshipFile = JSON.parse(
    readFileSync(resolve(root, "public/data/water-bodies-flagship-madurai.json"), "utf-8"),
  ) as FlagshipFile;

  const osmGeo = JSON.parse(
    readFileSync(resolve(root, "public/geojson/madurai-water-bodies-current.geojson"), "utf-8"),
  ) as OsmFile;

  console.log(`Scoring ${flagshipFile.bodies.length} Madurai flagship bodies...`);

  const scored: ScoredWaterBody[] = [];
  const skipped: string[] = [];
  for (const b of flagshipFile.bodies) {
    const osm = enrichFromOsm(b, osmGeo);
    if (osm === null) {
      skipped.push(b.name);
      continue;
    }
    const row = scoreBody(b, osm);
    if (row) scored.push(row);
    else skipped.push(b.name);
  }
  scored.sort((a, b) => b.priority_score - a.priority_score);

  if (skipped.length > 0) {
    console.log(`  Skipped (no OSM polygon + no curated centroid): ${skipped.join(", ")}`);
  }

  const counts = scored.reduce(
    (acc, s) => {
      acc[s.priority_level]++;
      return acc;
    },
    { critical: 0, high: 0, moderate: 0, low: 0 } as Record<PriorityLevel, number>,
  );
  console.log(
    `  critical=${counts.critical} high=${counts.high} moderate=${counts.moderate} low=${counts.low}`,
  );

  const today = new Date().toISOString().slice(0, 10);
  const algorithmVersion = "madurai-flagship-v1";
  const notes =
    "Slim scorer over the hand-curated Madurai flagship water bodies. " +
    "Components: status severity (0-80), cultural bonus (0-35), size (4-25), confidence (×0.7-1.0). " +
    "Coordinates via OSM polygon match (token overlap) or hand-curated lookup. " +
    "Full Chennai-style 6-component scoring on all 715 OSM polygons is blocked on " +
    "river-quality + industrial-sources Madurai data layers.";

  // 1) Chennai-conforming output (consumed by the shared /water-bodies page).
  const unifiedOutput: OutputFile = {
    computed_at: today,
    total_scored: scored.length,
    weights: WEIGHTS,
    algorithm_version: algorithmVersion,
    notes,
    water_bodies: scored,
    river_sections: [],
    place_id: "madurai",
  };
  writeFileSync(
    resolve(root, "public/data/restoration-priority-madurai.json"),
    JSON.stringify(unifiedOutput, null, 2),
  );

  // 2) Legacy /[cityId]/lake-restoration page is keyed off "bodies" and
  //    "generated_at"; emit a parallel slim file so the existing page
  //    keeps working until it's lifted onto the unified shape too.
  const legacy: LegacyShape = {
    place_id: "madurai",
    generated_at: today,
    algorithm_version: algorithmVersion,
    notes,
    total_scored: scored.length,
    bodies: scored.map((s) => ({
      name: s.name,
      status: s.rationale ?? "",
      priority_score: s.priority_score,
      priority_level: s.priority_level,
      components: s.components,
      rationale: s.rationale ?? "",
    })),
  };
  writeFileSync(
    resolve(root, "public/data/restoration-priority-madurai-legacy.json"),
    JSON.stringify(legacy, null, 2),
  );

  console.log(
    `\nWrote restoration-priority-madurai.json (${scored.length} scored bodies, Chennai-conforming shape)`,
  );
  console.log("Top 5 priorities:");
  for (const b of scored.slice(0, 5)) {
    const c = `[${b.centroid[0].toFixed(4)}, ${b.centroid[1].toFixed(4)}]`;
    console.log(`  ${b.priority_score} (${b.priority_level}) ${b.name} ${c} - ${b.rationale}`);
  }
}

main();
