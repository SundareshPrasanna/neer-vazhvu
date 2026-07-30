/**
 * Compute Madurai's ward-level risk composite (Tier 1.G).
 *
 * Madurai's risk composite is a 3-factor reduced version of Chennai's
 * 5-factor scoring. Drainage / sewerage / flood-hazard GeoJSON layers
 * don't exist publicly for Madurai yet, so we ship what we can with
 * the data already in the repo:
 *
 *   gw_depth      0.50  IDW from CGWB stations (deeper = stressed)
 *   wb_density    0.20  water-bodies-current geojson count per ward area
 *   wb_health     0.30  mean restoration_priority_score of flagships
 *                       within 3 km of ward centroid (higher = sicker)
 *
 * Each metric is converted to a city-wide percentile (0=best, 100=worst);
 * higherIsBetter flips the percentile when needed. The composite_score
 * is the weighted sum of percentiles (0-100, higher = greater risk).
 *
 * Letter grade buckets:
 *   <=20  A   (low risk)
 *   <=40  B
 *   <=60  C
 *   <=80  D
 *    >80  F   (high risk)
 *
 * Run:
 *   npx tsx scripts/compute-madurai-ward-risk.ts
 *
 * Inputs:
 *   public/geojson/madurai-wards-2022.geojson
 *   public/data/madurai-ward-profiles.json (centroids + area)
 *   public/data/water-bodies-flagship-madurai.json (for flagship coords)
 *   public/data/restoration-priority-madurai.json (priority_score per name)
 *   public/geojson/madurai-water-bodies-current.geojson (715 OSM polygons)
 *   Supabase groundwater_wris_latest filtered by district='Madurai'
 *   (WRIS-backed DB feed - the ONLY groundwater input; corrected 2026-07-30:
 *   an earlier header wrongly listed gw-stations-madurai.json)
 *
 * Output:
 *   public/data/ward-risk-madurai.json
 */

import { readFileSync } from "fs";
import { writeArtifact } from "./lib/nvdm-write";
import { resolve } from "path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import { idwInterpolate, polygonCentroid, type IdwStation } from "../src/lib/groundwater/idw";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const root = process.cwd();

interface WardProfileSeed {
  ward_number: number;
  zone_no: string;
  zone_name: string;
  centroid: [number, number]; // [lng, lat]
  area_sq_km: number;
}

interface FlagshipSeed {
  name: string;
  alternate_names?: string[];
  location?: string;
}

interface PriorityScore {
  name: string;
  priority_score: number;
}

interface WardFactor {
  ward_number: number;
  ward_name: string;
  zone: string;
  area_sq_km: number;
  centroid_latlng: [number, number];
  // raw factors
  gw_depth_m: number | null;
  gw_station_count: number;
  wb_count: number;
  wb_density_per_sqkm: number;
  wb_health_score: number | null;
  wb_health_sample_count: number;
}

interface WardRisk extends WardFactor {
  // percentiles 0-100 (100 = highest risk)
  pct_gw_depth: number | null;
  pct_wb_density: number | null;
  pct_wb_health: number | null;
  composite_score: number | null;
  grade: "A" | "B" | "C" | "D" | "F" | "incomplete";
}

const WEIGHTS = {
  gw_depth: 0.50,
  wb_density: 0.20,
  wb_health: 0.30,
};

// ── helpers ──────────────────────────────────────────────────────────

function loadJson<T>(rel: string): T {
  return JSON.parse(readFileSync(resolve(root, rel), "utf-8")) as T;
}

/** Returns percentile rank within sorted ascending values (0..100). 0 = smallest. */
function percentile(value: number, sorted: number[]): number {
  if (sorted.length === 0) return 50;
  // Binary-search the index of `value`.
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return Math.round((lo / sorted.length) * 100);
}

function gradeFor(score: number | null): WardRisk["grade"] {
  if (score === null) return "incomplete";
  if (score <= 20) return "A";
  if (score <= 40) return "B";
  if (score <= 60) return "C";
  if (score <= 80) return "D";
  return "F";
}

// ── factor computation ───────────────────────────────────────────────

interface GeoFile {
  features: Array<{
    properties: Record<string, unknown>;
    geometry: { type: string; coordinates: number[][][] | number[][][][] };
  }>;
}

function wardPolygonsByNumber(geo: GeoFile): Map<number, GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>> {
  const out = new Map<number, GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>>();
  for (const f of geo.features) {
    const wn = Number(f.properties.ward_no ?? f.properties.ward_number ?? 0);
    if (!wn) continue;
    out.set(wn, {
      type: "Feature",
      properties: f.properties,
      geometry: f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon,
    });
  }
  return out;
}

function countWaterBodiesPerWard(
  wbGeo: GeoFile,
  wardPolys: Map<number, GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>>,
): Map<number, number> {
  const counts = new Map<number, number>();
  for (const wn of wardPolys.keys()) counts.set(wn, 0);

  // Use water-body centroid as the join point.
  for (const f of wbGeo.features) {
    const coords = f.geometry.coordinates as number[][][];
    if (!coords || coords.length === 0) continue;
    const [lat, lng] = polygonCentroid(coords); // helper returns [lat, lng]
    const pt = point([lng, lat]); // turf point expects [lng, lat]
    for (const [wn, poly] of wardPolys) {
      if (booleanPointInPolygon(pt, poly)) {
        counts.set(wn, (counts.get(wn) ?? 0) + 1);
        break;
      }
    }
  }
  return counts;
}

interface FlagshipWithCoord {
  name: string;
  priority_score: number;
  lat: number;
  lng: number;
}

/**
 * Match flagships -> coords. The flagship JSON does NOT carry lat/lng;
 * we resolve them by matching flagship.name against water-bodies-current
 * geojson features (lots of misses expected — flagships are tanks, OSM
 * features are sometimes unnamed). Returns flagships we could place.
 */
function geocodeFlagships(
  flagships: { bodies: FlagshipSeed[] },
  priorities: { bodies: PriorityScore[] },
  wbGeo: GeoFile,
): FlagshipWithCoord[] {
  const priByName = new Map<string, number>();
  for (const p of priorities.bodies) priByName.set(p.name.toLowerCase(), p.priority_score);

  const wbByName = new Map<string, [number, number]>();
  for (const f of wbGeo.features) {
    const name = String(f.properties.name ?? "").trim().toLowerCase();
    if (!name) continue;
    const coords = f.geometry.coordinates as number[][][];
    const [lat, lng] = polygonCentroid(coords); // helper returns [lat, lng]
    wbByName.set(name, [lat, lng]);
  }

  // Treat tokens ≥4 chars (skipping common nouns) as identifying. e.g.
  // "Vandiyur tank" -> "vandiyur" matches "Vandiyur Mariamman Teppakulam"
  // and "Sellur tank" -> "sellur" matches "Sellur Kanmai".
  const STOPS = new Set(["tank", "kanmoi", "kanmai", "kulam", "kovil", "lake", "river", "reservoir", "teppam", "theppam", "theppakulam", "teppakulam"]);

  function distinctiveTokens(s: string): string[] {
    return s
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((t) => t.length >= 4 && !STOPS.has(t));
  }

  const out: FlagshipWithCoord[] = [];
  for (const f of flagships.bodies) {
    const score = priByName.get(f.name.toLowerCase());
    if (score === undefined) continue;

    const candidates = [f.name, ...(f.alternate_names ?? [])].map((n) => n.toLowerCase());
    let coord: [number, number] | undefined;
    for (const cand of candidates) {
      coord = wbByName.get(cand);
      if (coord) break;

      const candTokens = distinctiveTokens(cand);
      if (candTokens.length === 0) continue;
      for (const [wbName, c] of wbByName) {
        const wbTokens = distinctiveTokens(wbName);
        if (candTokens.some((t) => wbTokens.includes(t))) {
          coord = c;
          break;
        }
      }
      if (coord) break;
    }
    if (!coord) continue;
    out.push({ name: f.name, priority_score: score, lat: coord[0], lng: coord[1] });
  }
  return out;
}

function meanFlagshipHealthNearWard(
  wardCentroidLatLng: [number, number],
  flagshipCoords: FlagshipWithCoord[],
  radiusKm = 3,
): { score: number | null; count: number } {
  const EARTH_KM = 6371;
  function distKm(a: [number, number], b: [number, number]) {
    const [lat1, lng1] = a;
    const [lat2, lng2] = b;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const lat1r = (lat1 * Math.PI) / 180;
    const lat2r = (lat2 * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1r) * Math.cos(lat2r);
    return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  const within = flagshipCoords.filter((f) => distKm(wardCentroidLatLng, [f.lat, f.lng]) <= radiusKm);
  if (within.length === 0) return { score: null, count: 0 };
  const mean = within.reduce((s, f) => s + f.priority_score, 0) / within.length;
  return { score: +mean.toFixed(1), count: within.length };
}

// ── main ─────────────────────────────────────────────────────────────

async function main() {
  console.log("Loading inputs...");
  const wardProfiles = loadJson<WardProfileSeed[]>("public/data/madurai-ward-profiles.json");
  const wardGeo = loadJson<GeoFile>("public/geojson/madurai-wards-2022.geojson");
  const wbGeo = loadJson<GeoFile>("public/geojson/madurai-water-bodies-current.geojson");
  const flagships = loadJson<{ bodies: FlagshipSeed[] }>("public/data/water-bodies-flagship-madurai.json");
  const priorities = loadJson<{ bodies: PriorityScore[] }>("public/data/restoration-priority-madurai.json");

  const wardPolys = wardPolygonsByNumber(wardGeo);
  console.log(`  ${wardProfiles.length} ward profiles, ${wardPolys.size} ward polygons`);

  console.log("Pulling CGWB station readings...");
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: rows, error } = await supabase
    .from("groundwater_wris_latest")
    .select("station_code, latitude, longitude, depth_to_water_m")
    .eq("district", "Madurai");
  if (error) {
    console.error("Supabase error:", error.message);
    process.exit(1);
  }
  const stations: IdwStation[] = (rows ?? [])
    .filter((r) => typeof r.latitude === "number" && typeof r.longitude === "number" && typeof r.depth_to_water_m === "number")
    .map((r) => ({
      lat: r.latitude as number,
      lng: r.longitude as number,
      depthM: Math.abs(r.depth_to_water_m as number),
    }));
  console.log(`  ${stations.length} stations with usable depth`);

  console.log("Counting water bodies per ward (centroid PIP)...");
  const wbCounts = countWaterBodiesPerWard(wbGeo, wardPolys);
  console.log(`  Total water bodies placed: ${[...wbCounts.values()].reduce((a, b) => a + b, 0)} of ${wbGeo.features.length}`);

  console.log("Geocoding flagships against current water-bodies...");
  const flagshipCoords = geocodeFlagships(flagships, priorities, wbGeo);
  console.log(`  Placed ${flagshipCoords.length} of ${flagships.bodies.length} flagships`);

  // ── per-ward factors ──
  // ward-profile centroids are stored [lng, lat] (GeoJSON convention).
  const factors: WardFactor[] = wardProfiles.map((wp) => {
    const [lng, lat] = wp.centroid;
    const idw = idwInterpolate([lat, lng], stations, { k: 4, maxKm: 15, power: 2 });
    const count = wbCounts.get(wp.ward_number) ?? 0;
    const density = wp.area_sq_km > 0 ? +(count / wp.area_sq_km).toFixed(2) : 0;
    const health = meanFlagshipHealthNearWard([lat, lng], flagshipCoords, 3);
    return {
      ward_number: wp.ward_number,
      ward_name: `Ward ${wp.ward_number}`,
      zone: wp.zone_name,
      area_sq_km: wp.area_sq_km,
      centroid_latlng: [lat, lng],
      gw_depth_m: idw.depthM,
      gw_station_count: idw.stationCount,
      wb_count: count,
      wb_density_per_sqkm: density,
      wb_health_score: health.score,
      wb_health_sample_count: health.count,
    };
  });

  // ── percentiles ──
  const sortedDepth = factors.filter((f) => f.gw_depth_m !== null).map((f) => f.gw_depth_m as number).sort((a, b) => a - b);
  const sortedDensity = factors.map((f) => f.wb_density_per_sqkm).sort((a, b) => a - b);
  const sortedHealth = factors.filter((f) => f.wb_health_score !== null).map((f) => f.wb_health_score as number).sort((a, b) => a - b);

  const ranked: WardRisk[] = factors.map((f) => {
    const pctDepth = f.gw_depth_m !== null ? percentile(f.gw_depth_m, sortedDepth) : null; // higher depth = higher risk -> already correct direction
    const pctDensityRaw = percentile(f.wb_density_per_sqkm, sortedDensity);
    const pctDensity = 100 - pctDensityRaw; // higher density = LOWER risk
    const pctHealth = f.wb_health_score !== null ? percentile(f.wb_health_score, sortedHealth) : null; // higher score = sicker = higher risk

    const parts: { weight: number; pct: number }[] = [];
    if (pctDepth !== null) parts.push({ weight: WEIGHTS.gw_depth, pct: pctDepth });
    parts.push({ weight: WEIGHTS.wb_density, pct: pctDensity });
    if (pctHealth !== null) parts.push({ weight: WEIGHTS.wb_health, pct: pctHealth });

    let composite: number | null = null;
    if (parts.length >= 2) {
      const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
      composite = +(parts.reduce((s, p) => s + p.pct * p.weight, 0) / totalWeight).toFixed(1);
    }

    return {
      ...f,
      pct_gw_depth: pctDepth,
      pct_wb_density: pctDensity,
      pct_wb_health: pctHealth,
      composite_score: composite,
      grade: gradeFor(composite),
    };
  });
  ranked.sort((a, b) => a.ward_number - b.ward_number);

  const counts = ranked.reduce(
    (acc, r) => {
      acc[r.grade]++;
      return acc;
    },
    { A: 0, B: 0, C: 0, D: 0, F: 0, incomplete: 0 } as Record<WardRisk["grade"], number>,
  );

  const output = {
    place_id: "madurai",
    generated_at: new Date().toISOString().slice(0, 10),
    algorithm_version: "madurai-risk-v1-3factor",
    weights: WEIGHTS,
    notes:
      "3-factor reduced composite. Drainage/sewerage/flood-hazard layers " +
      "are not yet published for Madurai; this composite uses GW depth " +
      "(IDW from CGWB stations), water-body density, and water-body " +
      "health (mean restoration priority within 3 km of ward centroid).",
    grade_counts: counts,
    wards: ranked,
  };

  const outPath = resolve(root, "public/data/ward-risk-madurai.json");
  writeArtifact(outPath, output);
  console.log(`\nWrote ${outPath}`);
  console.log(`  Grades: A=${counts.A} B=${counts.B} C=${counts.C} D=${counts.D} F=${counts.F} incomplete=${counts.incomplete}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
