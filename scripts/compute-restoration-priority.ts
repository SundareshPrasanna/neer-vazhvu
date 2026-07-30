/**
 * Compute restoration priority scores for Chennai water bodies.
 *
 * Scores OSM polygon water bodies (~1,635) and census-only water bodies (~305),
 * deduplicating where census records match OSM polygons (within 200m).
 *
 * Run: npx tsx scripts/compute-restoration-priority.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
 */

import { readFileSync } from "fs";
import { writeArtifact } from "./lib/nvdm-write";
import { resolve } from "path";
import { config } from "dotenv";

// Load .env.local for Supabase credentials
config({ path: resolve(new URL(".", import.meta.url).pathname, "..", ".env.local") });

// ── Types ────────────────────────────────────────────────────────────────────

interface Coord {
  lat: number;
  lng: number;
}

interface CensusRow {
  id: number;
  name: string | null;
  water_body_type: string | null;
  latitude: number;
  longitude: number;
  encroachment_status: string | null;
  encroachment_pct: number | null;
  storage_capacity_original: number | null;
  storage_capacity_present: number | null;
  storage_loss_pct: number | null;
  max_depth_m: number | null;
  water_spread_area: number | null;
  is_in_use: boolean | null;
  ownership: string | null;
}

type PriorityLevel = "critical" | "high" | "moderate" | "low";

interface ScoredWaterBody {
  id: string;
  source: "osm" | "census" | "matched";
  osm_id: number | null;
  census_id: number | null;
  name: string;
  name_ta: string;
  water_type: string;
  area_ha: number;
  centroid: [number, number];
  priority_score: number;
  priority_level: PriorityLevel;
  components: {
    size: number;
    lost_proximity: number;
    river_pollution: number;
    industrial_proximity: number;
    type_bonus: number;
    census_condition: number;
  };
  nearest_lost_body: string | null;
  nearest_lost_body_ta: string | null;
  nearest_lost_km: number | null;
  nearest_river_station: string | null;
  nearest_river_station_ta: string | null;
  nearest_river_km: number | null;
  nearest_industrial: string | null;
  nearest_industrial_ta: string | null;
  nearest_industrial_km: number | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const R_EARTH_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversine(a: Coord, b: Coord): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R_EARTH_KM * Math.asin(Math.sqrt(h));
}

function haversineM(a: Coord, b: Coord): number {
  return haversine(a, b) * 1000;
}

function polygonCentroid(coordinates: number[][][]): Coord {
  const ring = coordinates[0];
  let latSum = 0;
  let lngSum = 0;
  for (const [lng, lat] of ring) {
    latSum += lat;
    lngSum += lng;
  }
  return { lat: latSum / ring.length, lng: lngSum / ring.length };
}

// ── Scoring functions ────────────────────────────────────────────────────────

function sizeScore(areaHa: number): number {
  const a = Math.min(areaHa, 200);
  if (a >= 50) return 100;
  if (a >= 20) return 85;
  if (a >= 10) return 70;
  if (a >= 5) return 55;
  if (a >= 1) return 40;
  if (a >= 0.5) return 20;
  return 10;
}

function lostProximityScore(
  centroid: Coord,
  lostBodies: Array<{ name: string; name_ta: string; coord: Coord; status: string }>
): { score: number; nearestName: string | null; nearestNameTa: string | null; nearestKm: number | null } {
  let minDist = Infinity;
  let nearestName: string | null = null;
  let nearestNameTa: string | null = null;
  let bestScore = 10;

  for (const lb of lostBodies) {
    const d = haversine(centroid, lb.coord);
    if (d < minDist) {
      minDist = d;
      nearestName = lb.name;
      nearestNameTa = lb.name_ta;
    }

    let s: number;
    if (d <= 2) {
      s = 100;
    } else if (d <= 5 && (lb.status === "fully_lost" || lb.status === "severely_reduced")) {
      s = 75;
    } else if (d <= 5 && lb.status === "partially_encroached") {
      s = 60;
    } else if (d <= 10) {
      s = 40;
    } else {
      s = 10;
    }
    if (s > bestScore) bestScore = s;
  }

  return {
    score: bestScore,
    nearestName,
    nearestNameTa,
    nearestKm: minDist === Infinity ? null : Math.round(minDist * 10) / 10,
  };
}

function riverPollutionScore(
  centroid: Coord,
  stations: Array<{ name: string; name_ta: string; coord: Coord; latestDO: number }>
): { score: number; nearestStation: string | null; nearestStationTa: string | null; nearestKm: number | null } {
  let minDist = Infinity;
  let nearestStation: string | null = null;
  let nearestStationTa: string | null = null;
  let bestScore = 15;

  for (const st of stations) {
    const d = haversine(centroid, st.coord);
    if (d < minDist) {
      minDist = d;
      nearestStation = st.name;
      nearestStationTa = st.name_ta;
    }

    let s: number;
    if (d <= 3 && st.latestDO < 0.5) {
      s = 100;
    } else if (d <= 3 && st.latestDO < 1.0) {
      s = 85;
    } else if (d <= 5 && st.latestDO < 2.0) {
      s = 65;
    } else if (d <= 5 && st.latestDO < 3.0) {
      s = 45;
    } else if (d <= 5) {
      s = 25;
    } else {
      s = 15;
    }
    if (s > bestScore) bestScore = s;
  }

  return {
    score: bestScore,
    nearestStation,
    nearestStationTa,
    nearestKm: minDist === Infinity ? null : Math.round(minDist * 10) / 10,
  };
}

function industrialProximityScore(
  centroid: Coord,
  sources: Array<{ name: string; name_ta: string; coord: Coord }>
): { score: number; nearestName: string | null; nearestNameTa: string | null; nearestKm: number | null } {
  let best: { name: string; name_ta: string; distKm: number } | null = null;
  for (const p of sources) {
    const d = haversine(centroid, p.coord);
    if (!best || d < best.distKm) {
      best = { name: p.name, name_ta: p.name_ta, distKm: d };
    }
  }
  if (!best) return { score: 10, nearestName: null, nearestNameTa: null, nearestKm: null };

  let score: number;
  if (best.distKm <= 2) score = 100;
  else if (best.distKm <= 5) score = 70;
  else if (best.distKm <= 10) score = 40;
  else score = 10;

  return {
    score,
    nearestName: best.name,
    nearestNameTa: best.name_ta,
    nearestKm: Math.round(best.distKm * 10) / 10,
  };
}

const TYPE_SCORES: Record<string, number> = {
  reservoir: 100,
  lake: 95,
  tank: 70,
  water: 70,
  pond: 65,
  intermittent: 60,
  basin: 50,
  oxbow: 45,
  canal: 15,
  river: 10,
  wastewater: 5,
  ditch: 5,
  drain: 5,
};

function typeScore(waterType: string): number {
  return TYPE_SCORES[waterType.toLowerCase()] ?? 50;
}

/** Score based on census condition data (encroachment, storage loss, disuse, silting) */
function censusConditionScore(census: CensusRow | null): number {
  if (!census) return 25; // neutral default for OSM-only bodies
  let score = 0;
  // Encroachment: 0-40 points
  if (census.encroachment_pct != null && census.encroachment_pct > 0) {
    score += Math.min(census.encroachment_pct, 100) * 0.4;
  }
  // Storage loss: 0-30 points
  if (census.storage_loss_pct != null && census.storage_loss_pct > 0) {
    score += Math.min(census.storage_loss_pct, 100) * 0.3;
  }
  // Not in use: 20 points
  if (census.is_in_use === false) score += 20;
  // Shallow depth (silting indicator): 10 points
  if (census.max_depth_m != null && census.max_depth_m < 1) score += 10;
  return Math.min(Math.round(score), 100);
}

function getPriorityLevel(score: number): PriorityLevel {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "moderate";
  return "low";
}

// ── Supabase fetch ───────────────────────────────────────────────────────────

async function fetchCensusData(): Promise<CensusRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn("  Supabase credentials not found, skipping census data");
    return [];
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key);

  const { data, error } = await supabase
    .from("water_bodies_census")
    .select(
      "id, name, water_body_type, latitude, longitude, " +
        "encroachment_status, encroachment_pct, " +
        "storage_capacity_original, storage_capacity_present, storage_loss_pct, " +
        "max_depth_m, water_spread_area, is_in_use, ownership"
    )
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  if (error) {
    console.warn(`  Supabase error: ${error.message}, skipping census data`);
    return [];
  }

  return (data ?? []) as unknown as CensusRow[];
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const root = resolve(new URL(".", import.meta.url).pathname, "..");

  // 1. Load static data
  const waterBodies = JSON.parse(
    readFileSync(resolve(root, "public/geojson/chennai-water-bodies-current.geojson"), "utf8")
  ) as GeoJSON.FeatureCollection;

  const lostGeo = JSON.parse(
    readFileSync(resolve(root, "public/geojson/chennai-water-bodies-lost.geojson"), "utf8")
  ) as GeoJSON.FeatureCollection;

  const lostBodies = lostGeo.features.map((f) => ({
    name: (f.properties as Record<string, unknown>).name as string,
    name_ta: ((f.properties as Record<string, unknown>).name_ta as string) || "",
    coord: {
      lat: (f.geometry as GeoJSON.Point).coordinates[1],
      lng: (f.geometry as GeoJSON.Point).coordinates[0],
    },
    status: (f.properties as Record<string, unknown>).status as string,
  }));

  const riverQuality = JSON.parse(
    readFileSync(resolve(root, "public/data/river-quality.json"), "utf8")
  );

  const riverStations: Array<{ name: string; name_ta: string; coord: Coord; latestDO: number }> = [];
  for (const river of riverQuality.rivers) {
    for (const station of river.stations) {
      const readings = station.readings as Array<{ do_mgl: number }>;
      const latestDO = readings[readings.length - 1].do_mgl;
      riverStations.push({
        name: station.name,
        name_ta: station.name_ta || "",
        coord: { lat: station.lat, lng: station.lng },
        latestDO,
      });
    }
  }

  const industrialData = JSON.parse(
    readFileSync(resolve(root, "public/data/industrial-sources.json"), "utf8")
  );

  const industrialSources = industrialData.sources.map(
    (s: { name: string; name_ta: string; lat: number; lng: number }) => ({
      name: s.name,
      name_ta: s.name_ta || "",
      coord: { lat: s.lat, lng: s.lng },
    })
  );

  // 2. Load river lines for filtering river-section polygons
  const riversGeo = JSON.parse(
    readFileSync(resolve(root, "public/geojson/chennai-rivers.geojson"), "utf8")
  ) as GeoJSON.FeatureCollection;

  interface RiverLinePoint extends Coord {
    riverName: string;
    riverNameTa: string;
  }
  const riverLinePoints: RiverLinePoint[] = [];
  for (const feat of riversGeo.features) {
    const rProps = feat.properties as Record<string, unknown>;
    const riverName = (rProps.name as string) || "";
    const riverNameTa = (rProps.name_ta as string) || "";
    const geom = feat.geometry;
    const extractCoords = (coords: number[][]) => {
      for (const c of coords) riverLinePoints.push({ lat: c[1], lng: c[0], riverName, riverNameTa });
    };
    if (geom.type === "LineString") {
      extractCoords((geom as GeoJSON.LineString).coordinates);
    } else if (geom.type === "MultiLineString") {
      for (const line of (geom as GeoJSON.MultiLineString).coordinates) extractCoords(line);
    }
  }

  /** Detect if an unnamed polygon is likely a river section.
   *  Heuristic: unnamed + area > 20ha + (elongated aspect ratio > 3.5 OR any vertex within 50m of a river line) */
  function isLikelyRiverSection(feat: GeoJSON.Feature): boolean {
    const props = feat.properties as Record<string, unknown>;
    const name = (props.name as string) || "";
    const area = (props.area_ha as number) ?? 0;
    const wtype = (props.water_type as string) || "";

    // Already typed as river/canal/drain
    if (["river", "canal", "drain", "ditch"].includes(wtype)) return true;
    // Only filter unnamed large bodies
    if (name || area < 20) return false;
    // Unnamed "water" bodies over 200ha are river floodplains/estuaries
    if (!name && wtype === "water" && area > 200) return true;

    const geom = feat.geometry as GeoJSON.Polygon;
    const ring = geom.coordinates[0];
    const lngs = ring.map((c) => c[0]);
    const lats = ring.map((c) => c[1]);
    const lngSpan = Math.max(...lngs) - Math.min(...lngs);
    const latSpan = Math.max(...lats) - Math.min(...lats);
    const ratio = Math.max(lngSpan, latSpan) / Math.max(Math.min(lngSpan, latSpan), 0.0001);

    if (ratio > 3.5) return true;

    // Check if any vertex is within 50m of a river line
    const sampleVerts = ring.slice(0, 20);
    for (const [lng, lat] of sampleVerts) {
      const pt: Coord = { lat, lng };
      for (const rp of riverLinePoints) {
        if (haversineM(pt, rp) < 50) return true;
      }
    }

    return false;
  }

  /** Find the nearest river name for a polygon by checking vertex proximity to river line points */
  function nearestRiverName(feat: GeoJSON.Feature): { name: string; name_ta: string } {
    const geom = feat.geometry as GeoJSON.Polygon;
    const ring = geom.coordinates[0];
    const sampleVerts = ring.slice(0, 20);
    let bestDist = Infinity;
    let bestName = "";
    let bestNameTa = "";
    for (const [lng, lat] of sampleVerts) {
      const pt: Coord = { lat, lng };
      for (const rp of riverLinePoints) {
        const d = haversineM(pt, rp);
        if (d < bestDist) {
          bestDist = d;
          bestName = rp.riverName;
          bestNameTa = rp.riverNameTa;
        }
      }
    }
    // Also check the polygon's own name/water_type
    const props = feat.properties as Record<string, unknown>;
    const ownName = (props.name as string) || "";
    if (ownName && !bestName) return { name: ownName, name_ta: (props.name_ta as string) || "" };
    return bestDist < 5000 ? { name: bestName, name_ta: bestNameTa } : { name: ownName || "River section", name_ta: "" };
  }

  // 2b. Fetch census data from Supabase
  console.log("Fetching census data from Supabase...");
  const censusRows = await fetchCensusData();
  console.log(`  ${censusRows.length} census records loaded`);

  // 3. Build OSM centroids, filtering out river sections
  const osmCentroids: { osmId: number; centroid: Coord; areaHa: number; name: string; nameTa: string; waterType: string }[] = [];
  const riverSections: { osm_id: number; name: string; name_ta: string; water_type: string; area_ha: number }[] = [];
  let riverSectionCount = 0;
  for (const feat of waterBodies.features) {
    if (isLikelyRiverSection(feat)) {
      riverSectionCount++;
      const props = feat.properties as Record<string, unknown>;
      const rn = nearestRiverName(feat);
      riverSections.push({
        osm_id: props.osm_id as number,
        name: rn.name,
        name_ta: rn.name_ta,
        water_type: (props.water_type as string) || "water",
        area_ha: (props.area_ha as number) ?? 0,
      });
      continue;
    }
    const props = feat.properties as Record<string, unknown>;
    const geom = feat.geometry as GeoJSON.Polygon;
    const centroid = polygonCentroid(geom.coordinates);
    osmCentroids.push({
      osmId: props.osm_id as number,
      centroid,
      areaHa: (props.area_ha as number) ?? 0,
      name: (props.name as string) || "",
      nameTa: (props.name_ta as string) || "",
      waterType: props.water_type as string,
    });
  }
  console.log(`  Filtered ${riverSectionCount} likely river sections from OSM polygons`);

  const MATCH_THRESHOLD_M = 200;
  const censusByOsmId = new Map<number, CensusRow>();
  const unmatchedCensus: CensusRow[] = [];
  const matchedCensusIds = new Set<number>();

  for (const census of censusRows) {
    let bestDist = Infinity;
    let bestOsmId = -1;
    const censusPt: Coord = { lat: census.latitude, lng: census.longitude };

    for (const osm of osmCentroids) {
      const d = haversineM(censusPt, osm.centroid);
      if (d < bestDist) {
        bestDist = d;
        bestOsmId = osm.osmId;
      }
    }

    if (bestDist <= MATCH_THRESHOLD_M && bestOsmId >= 0) {
      const existing = censusByOsmId.get(bestOsmId);
      if (!existing) {
        censusByOsmId.set(bestOsmId, census);
        matchedCensusIds.add(census.id);
      } else {
        // Keep the closer match
        const existingPt: Coord = { lat: existing.latitude, lng: existing.longitude };
        const osmCentroid = osmCentroids.find((o) => o.osmId === bestOsmId)!.centroid;
        const existingDist = haversineM(existingPt, osmCentroid);
        if (bestDist < existingDist) {
          censusByOsmId.set(bestOsmId, census);
          matchedCensusIds.delete(existing.id);
          matchedCensusIds.add(census.id);
          unmatchedCensus.push(existing);
        } else {
          unmatchedCensus.push(census);
        }
      }
    } else {
      unmatchedCensus.push(census);
    }
  }

  console.log(`  ${censusByOsmId.size} census records matched to OSM polygons`);
  console.log(`  ${unmatchedCensus.length} census-only records`);

  // 4. Score with new weights
  const WEIGHTS = {
    size: 0.20,
    lost_proximity: 0.18,
    river_pollution: 0.18,
    industrial_proximity: 0.14,
    type_bonus: 0.15,
    census_condition: 0.15,
  };

  function computeScore(
    centroid: Coord,
    areaHa: number,
    waterType: string,
    census: CensusRow | null
  ) {
    const sizeComp = sizeScore(areaHa);
    const lostComp = lostProximityScore(centroid, lostBodies);
    const riverComp = riverPollutionScore(centroid, riverStations);
    const indComp = industrialProximityScore(centroid, industrialSources);
    const typeComp = typeScore(waterType);
    const censusComp = censusConditionScore(census);

    const composite =
      sizeComp * WEIGHTS.size +
      lostComp.score * WEIGHTS.lost_proximity +
      riverComp.score * WEIGHTS.river_pollution +
      indComp.score * WEIGHTS.industrial_proximity +
      typeComp * WEIGHTS.type_bonus +
      censusComp * WEIGHTS.census_condition;

    return {
      score: Math.round(composite * 10) / 10,
      components: {
        size: sizeComp,
        lost_proximity: lostComp.score,
        river_pollution: riverComp.score,
        industrial_proximity: indComp.score,
        type_bonus: typeComp,
        census_condition: censusComp,
      },
      lostComp,
      riverComp,
      indComp,
    };
  }

  const scored: ScoredWaterBody[] = [];

  // 5a. Score OSM polygon water bodies
  for (const osm of osmCentroids) {
    const census = censusByOsmId.get(osm.osmId) ?? null;
    const result = computeScore(osm.centroid, osm.areaHa, osm.waterType, census);

    scored.push({
      id: census ? `matched:${osm.osmId}` : `osm:${osm.osmId}`,
      source: census ? "matched" : "osm",
      osm_id: osm.osmId,
      census_id: census?.id ?? null,
      name: osm.name,
      name_ta: osm.nameTa,
      water_type: osm.waterType,
      area_ha: osm.areaHa,
      centroid: [osm.centroid.lat, osm.centroid.lng],
      priority_score: result.score,
      priority_level: getPriorityLevel(result.score),
      components: result.components,
      nearest_lost_body: result.lostComp.nearestName,
      nearest_lost_body_ta: result.lostComp.nearestNameTa,
      nearest_lost_km: result.lostComp.nearestKm,
      nearest_river_station: result.riverComp.nearestStation,
      nearest_river_station_ta: result.riverComp.nearestStationTa,
      nearest_river_km: result.riverComp.nearestKm,
      nearest_industrial: result.indComp.nearestName,
      nearest_industrial_ta: result.indComp.nearestNameTa,
      nearest_industrial_km: result.indComp.nearestKm,
    });
  }

  // 5b. Score census-only water bodies
  for (const census of unmatchedCensus) {
    const centroid: Coord = { lat: census.latitude, lng: census.longitude };
    const waterType = census.water_body_type || "water";
    // Use water_spread_area as rough proxy for size (assume hectares, fallback to 0)
    const areaHa = census.water_spread_area ?? 0;
    const result = computeScore(centroid, areaHa, waterType, census);

    scored.push({
      id: `census:${census.id}`,
      source: "census",
      osm_id: null,
      census_id: census.id,
      name: census.name || "",
      name_ta: "",
      water_type: waterType,
      area_ha: areaHa,
      centroid: [centroid.lat, centroid.lng],
      priority_score: result.score,
      priority_level: getPriorityLevel(result.score),
      components: result.components,
      nearest_lost_body: result.lostComp.nearestName,
      nearest_lost_body_ta: result.lostComp.nearestNameTa,
      nearest_lost_km: result.lostComp.nearestKm,
      nearest_river_station: result.riverComp.nearestStation,
      nearest_river_station_ta: result.riverComp.nearestStationTa,
      nearest_river_km: result.riverComp.nearestKm,
      nearest_industrial: result.indComp.nearestName,
      nearest_industrial_ta: result.indComp.nearestNameTa,
      nearest_industrial_km: result.indComp.nearestKm,
    });
  }

  // Sort by priority score descending
  scored.sort((a, b) => b.priority_score - a.priority_score);

  const output = {
    computed_at: new Date().toISOString(),
    total_scored: scored.length,
    weights: WEIGHTS,
    water_bodies: scored,
    river_sections: riverSections,
  };

  const outPath = resolve(root, "public/data/restoration-priority.json");
  writeArtifact(outPath, output);

  // Summary
  const counts = { critical: 0, high: 0, moderate: 0, low: 0 };
  const sourceCounts = { osm: 0, census: 0, matched: 0 };
  for (const wb of scored) {
    counts[wb.priority_level]++;
    sourceCounts[wb.source]++;
  }

  console.log(`\nScored ${scored.length} water bodies -> ${outPath}`);
  console.log(`  Sources: ${sourceCounts.osm} OSM-only, ${sourceCounts.matched} matched, ${sourceCounts.census} census-only`);
  console.log(`  Critical: ${counts.critical}`);
  console.log(`  High:     ${counts.high}`);
  console.log(`  Moderate: ${counts.moderate}`);
  console.log(`  Low:      ${counts.low}`);
  console.log(`  Top 5:`);
  for (const wb of scored.slice(0, 5)) {
    console.log(`    ${wb.priority_score} - ${wb.name || wb.id} (${wb.water_type}, ${wb.area_ha}ha)`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
