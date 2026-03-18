/**
 * Compute restoration priority scores for all 1,635 Chennai water bodies.
 *
 * Reads static GeoJSON/JSON data, scores each water body on 5 components,
 * and writes a ranked output to public/data/restoration-priority.json.
 *
 * Run: npx tsx scripts/compute-restoration-priority.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

// ── Types ────────────────────────────────────────────────────────────────────

interface Coord {
  lat: number;
  lng: number;
}

interface ScoredWaterBody {
  osm_id: number;
  name: string;
  name_ta: string;
  water_type: string;
  area_ha: number;
  centroid: [number, number]; // [lat, lng]
  priority_score: number;
  priority_level: "critical" | "high" | "moderate" | "low";
  components: {
    size: number;
    lost_proximity: number;
    river_pollution: number;
    industrial_proximity: number;
    type_bonus: number;
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

/** Haversine distance in km between two lat/lng points */
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

/** Compute simple centroid of a polygon (average of vertices) */
function polygonCentroid(coordinates: number[][][]): Coord {
  // coordinates[0] = outer ring as [[lng, lat], ...]
  const ring = coordinates[0];
  let latSum = 0;
  let lngSum = 0;
  for (const [lng, lat] of ring) {
    latSum += lat;
    lngSum += lng;
  }
  return { lat: latSum / ring.length, lng: lngSum / ring.length };
}

/** Find the nearest point and return { name, distKm } */
function findNearest(
  from: Coord,
  points: Array<{ name: string; coord: Coord }>
): { name: string; distKm: number } | null {
  let best: { name: string; distKm: number } | null = null;
  for (const p of points) {
    const d = haversine(from, p.coord);
    if (!best || d < best.distKm) {
      best = { name: p.name, distKm: d };
    }
  }
  return best;
}

// ── Scoring functions ────────────────────────────────────────────────────────

function sizeScore(areaHa: number): number {
  // Cap at 200 to prevent outliers from skewing
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
  return TYPE_SCORES[waterType] ?? 50;
}

function getPriorityLevel(score: number): "critical" | "high" | "moderate" | "low" {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "moderate";
  return "low";
}

// ── Main ─────────────────────────────────────────────────────────────────────

const root = resolve(new URL(".", import.meta.url).pathname, "..");

// 1. Load water bodies
const waterBodies = JSON.parse(
  readFileSync(resolve(root, "public/geojson/chennai-water-bodies-current.geojson"), "utf8")
) as GeoJSON.FeatureCollection;

// 2. Load lost water bodies
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

// 3. Load river quality stations
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

// 4. Load industrial sources
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

// 5. Score each water body
const WEIGHTS = {
  size: 0.25,
  lost_proximity: 0.2,
  river_pollution: 0.2,
  industrial_proximity: 0.15,
  type_bonus: 0.2,
};

const scored: ScoredWaterBody[] = [];

for (const feature of waterBodies.features) {
  const props = feature.properties as Record<string, unknown>;
  const geom = feature.geometry as GeoJSON.Polygon;

  const centroid = polygonCentroid(geom.coordinates);
  const areaHa = (props.area_ha as number) ?? 0;

  const sizeComp = sizeScore(areaHa);
  const lostComp = lostProximityScore(centroid, lostBodies);
  const riverComp = riverPollutionScore(centroid, riverStations);
  const indComp = industrialProximityScore(centroid, industrialSources);
  const typeComp = typeScore(props.water_type as string);

  const composite =
    sizeComp * WEIGHTS.size +
    lostComp.score * WEIGHTS.lost_proximity +
    riverComp.score * WEIGHTS.river_pollution +
    indComp.score * WEIGHTS.industrial_proximity +
    typeComp * WEIGHTS.type_bonus;

  const roundedScore = Math.round(composite * 10) / 10;

  scored.push({
    osm_id: props.osm_id as number,
    name: (props.name as string) || "",
    name_ta: (props.name_ta as string) || "",
    water_type: props.water_type as string,
    area_ha: areaHa,
    centroid: [centroid.lat, centroid.lng],
    priority_score: roundedScore,
    priority_level: getPriorityLevel(roundedScore),
    components: {
      size: sizeComp,
      lost_proximity: lostComp.score,
      river_pollution: riverComp.score,
      industrial_proximity: indComp.score,
      type_bonus: typeComp,
    },
    nearest_lost_body: lostComp.nearestName,
    nearest_lost_body_ta: lostComp.nearestNameTa,
    nearest_lost_km: lostComp.nearestKm,
    nearest_river_station: riverComp.nearestStation,
    nearest_river_station_ta: riverComp.nearestStationTa,
    nearest_river_km: riverComp.nearestKm,
    nearest_industrial: indComp.nearestName,
    nearest_industrial_ta: indComp.nearestNameTa,
    nearest_industrial_km: indComp.nearestKm,
  });
}

// Sort by priority score descending
scored.sort((a, b) => b.priority_score - a.priority_score);

const output = {
  computed_at: new Date().toISOString(),
  total_scored: scored.length,
  weights: WEIGHTS,
  water_bodies: scored,
};

const outPath = resolve(root, "public/data/restoration-priority.json");
writeFileSync(outPath, JSON.stringify(output, null, 2));

// Summary
const counts = { critical: 0, high: 0, moderate: 0, low: 0 };
for (const wb of scored) counts[wb.priority_level]++;

console.log(`Scored ${scored.length} water bodies → ${outPath}`);
console.log(`  Critical: ${counts.critical}`);
console.log(`  High:     ${counts.high}`);
console.log(`  Moderate: ${counts.moderate}`);
console.log(`  Low:      ${counts.low}`);
console.log(`  Top 5:`);
for (const wb of scored.slice(0, 5)) {
  console.log(`    ${wb.priority_score} — ${wb.name || `OSM#${wb.osm_id}`} (${wb.water_type}, ${wb.area_ha}ha)`);
}
