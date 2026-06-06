/**
 * Compute Bangalore ward profiles by spatially joining the data layers we
 * have for Bangalore onto the 369 GBA wards (post 19-Nov-2025 notification).
 *
 * Mirrors scripts/compute-ward-profiles.ts (Chennai) so the UI consumes
 * both through the same code path; preserves the admin-only fields that
 * already live in public/data/bangalore-ward-profiles.json (ward_name,
 * ward_name_kn, corporation, zone, assembly_constituency, population,
 * voter ranges, etc.) by reading that file as the base and enriching
 * each entry with analytical sections in place.
 *
 * Layers joined:
 *   - water_bodies            from bangalore-water-bodies-current.geojson (OSM)
 *                             + bangalore-water-bodies-census.geojson
 *                             + restoration-priority-bangalore.json
 *   - lost_bodies             water-bodies-lost-bangalore.json is name-only
 *                             (no coords); emitted as zero per ward, with
 *                             totals exposed on /bangalore/water-bodies.
 *   - flood                   bangalore-flood-hotspots.geojson (398 Points,
 *                             3 categories). Treated like Chennai's hazard
 *                             zones; hotspot_2015/2020 sub-counts left 0
 *                             since Bangalore has no annual snapshot.
 *   - drainage                bangalore-swd-primary.geojson +
 *                             bangalore-swd-secondary.geojson (LineStrings,
 *                             midpoint count + length-by-ward distribution).
 *   - sewerage                bangalore-stps.geojson (39 Points, capacity_mld)
 *                             + bangalore-sewerage-trunks.geojson (14k
 *                             LineStrings as pumping mains). SPS count
 *                             stays 0 (no public SPS layer for BWSSB).
 *   - rivers                  nearest station from river-quality-bangalore.json
 *   - industrial              industrial-sources-bangalore.json (14 Points)
 *   - groundwater_assessment  CGWB block (PIP ward centroid -> 6 GWR
 *                             block polygons) + nearest CGWB well
 *                             (gated <=5 km) from bangalore-cgwb-stations.json.
 *
 * Fully deterministic from repo contents.
 *
 * Run: npx tsx scripts/compute-bangalore-ward-profiles.ts
 * Output: public/data/bangalore-ward-profiles.json (overwritten in place)
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import centroid from "@turf/centroid";
import bbox from "@turf/bbox";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint } from "@turf/helpers";
import turfArea from "@turf/area";
import along from "@turf/along";
import length from "@turf/length";

// ── Types ────────────────────────────────────────────────────────────────────

interface Coord {
  lat: number;
  lng: number;
}

interface WardInfo {
  ward_number: number;
  centroid: [number, number]; // [lng, lat]
  feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
  bbox: [number, number, number, number];
}

interface GroundwaterAssessment {
  block: {
    name: string;
    class: string;
    development_pct: number | null;
  } | null;
  nearest_well: {
    name: string;
    block: string;
    distance_km: number;
    latest: { year: number; month: number; depth_m_bgl: number } | null;
  } | null;
}

interface AnalyticalSections {
  water_bodies: {
    current_count: number;
    census_records: number;
    restoration_critical: number;
    restoration_high: number;
    avg_restoration_score: number | null;
    top_bodies: { name: string; score: number; level: string }[];
  };
  lost_bodies: { count: number; names: string[] };
  flood: {
    hazard_zone_count: number;
    by_category: Record<string, number>;
    dominant_hazard: string | null;
    hotspot_2015_count: number;
    hotspot_2020_count: number;
  };
  drainage: { line_count: number; total_length_km: number };
  sewerage: {
    stp_count: number;
    sps_count: number;
    pumping_main_count: number;
    pumping_main_length_km: number;
    total_stp_capacity_mld: number;
  };
  rivers: {
    nearest_station_id: string | null;
    nearest_river_id: string | null;
    nearest_km: number | null;
  };
  industrial: { zone_count: number };
  groundwater_assessment: GroundwaterAssessment;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const R_EARTH_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

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

function featureCentroid(feat: GeoJSON.Feature): Coord {
  const c = centroid(feat);
  return { lat: c.geometry.coordinates[1], lng: c.geometry.coordinates[0] };
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// ── Spatial grid index ───────────────────────────────────────────────────────

interface GridIndex {
  minLng: number;
  minLat: number;
  cellW: number;
  cellH: number;
  cols: number;
  rows: number;
  cells: Map<string, number[]>;
}

function buildGridIndex(wards: WardInfo[], gridSize = 20): GridIndex {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const w of wards) {
    if (w.bbox[0] < minLng) minLng = w.bbox[0];
    if (w.bbox[1] < minLat) minLat = w.bbox[1];
    if (w.bbox[2] > maxLng) maxLng = w.bbox[2];
    if (w.bbox[3] > maxLat) maxLat = w.bbox[3];
  }

  const cellW = (maxLng - minLng) / gridSize;
  const cellH = (maxLat - minLat) / gridSize;
  const cells = new Map<string, number[]>();

  for (let i = 0; i < wards.length; i++) {
    const [wMinX, wMinY, wMaxX, wMaxY] = wards[i].bbox;
    const colStart = Math.max(0, Math.floor((wMinX - minLng) / cellW));
    const colEnd = Math.min(gridSize - 1, Math.floor((wMaxX - minLng) / cellW));
    const rowStart = Math.max(0, Math.floor((wMinY - minLat) / cellH));
    const rowEnd = Math.min(gridSize - 1, Math.floor((wMaxY - minLat) / cellH));

    for (let col = colStart; col <= colEnd; col++) {
      for (let row = rowStart; row <= rowEnd; row++) {
        const key = `${col},${row}`;
        const arr = cells.get(key);
        if (arr) arr.push(i);
        else cells.set(key, [i]);
      }
    }
  }

  return { minLng, minLat, cellW, cellH, cols: gridSize, rows: gridSize, cells };
}

function findWard(
  lng: number,
  lat: number,
  wards: WardInfo[],
  grid: GridIndex,
): number | null {
  const col = Math.floor((lng - grid.minLng) / grid.cellW);
  const row = Math.floor((lat - grid.minLat) / grid.cellH);
  const key = `${Math.max(0, Math.min(grid.cols - 1, col))},${Math.max(0, Math.min(grid.rows - 1, row))}`;
  const candidates = grid.cells.get(key);
  if (!candidates) return null;

  const pt = turfPoint([lng, lat]);
  for (const idx of candidates) {
    if (booleanPointInPolygon(pt, wards[idx].feature)) {
      return wards[idx].ward_number;
    }
  }
  return null;
}

function distributeLineLengthByWard(
  geom: GeoJSON.LineString,
  wards: WardInfo[],
  grid: GridIndex,
  sampleStepKm = 0.05,
): Map<number, number> {
  const line = { type: "Feature" as const, properties: {}, geometry: geom };
  const lenKm = length(line, { units: "kilometers" });
  if (lenKm <= 0) return new Map();
  const sampleCount = Math.max(1, Math.ceil(lenKm / sampleStepKm));
  const contributionKm = lenKm / sampleCount;
  const byWard = new Map<number, number>();
  for (let i = 0; i < sampleCount; i++) {
    const distanceKm = ((i + 0.5) / sampleCount) * lenKm;
    const sample = along(line, distanceKm, { units: "kilometers" });
    const [lng, lat] = sample.geometry.coordinates;
    const ward = findWard(lng, lat, wards, grid);
    if (ward != null) {
      byWard.set(ward, (byWard.get(ward) ?? 0) + contributionKm);
    }
  }
  return byWard;
}

function midpointWard(
  geom: GeoJSON.LineString,
  wards: WardInfo[],
  grid: GridIndex,
): number | null {
  const line = { type: "Feature" as const, properties: {}, geometry: geom };
  const len = length(line, { units: "kilometers" });
  if (len === 0) return null;
  const mid = along(line, len / 2, { units: "kilometers" });
  const [lng, lat] = mid.geometry.coordinates;
  return findWard(lng, lat, wards, grid);
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const root = resolve(new URL(".", import.meta.url).pathname, "..");
  console.log("Computing Bangalore ward profiles (369 GBA wards)...");

  // 1. Load ward polygons
  const wardGeo = JSON.parse(
    readFileSync(resolve(root, "public/geojson/bangalore-wards-2025.geojson"), "utf8"),
  ) as GeoJSON.FeatureCollection;

  const wards: WardInfo[] = wardGeo.features.map((f) => {
    const props = f.properties as Record<string, unknown>;
    const wardNum = props.ward_no as number;
    const feat = f as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
    const c = centroid(feat);
    const b = bbox(feat);
    return {
      ward_number: wardNum,
      centroid: c.geometry.coordinates as [number, number],
      feature: feat,
      bbox: b as [number, number, number, number],
    };
  });
  wards.sort((a, b) => a.ward_number - b.ward_number);
  const grid = buildGridIndex(wards);

  // 2. Load existing admin profile (kept as base; we enrich in place)
  const existing = JSON.parse(
    readFileSync(resolve(root, "public/data/bangalore-ward-profiles.json"), "utf8"),
  ) as Array<Record<string, unknown> & { ward_number: number }>;
  const existingByWard = new Map<number, Record<string, unknown>>();
  for (const e of existing) existingByWard.set(e.ward_number, e);

  // Per-ward accumulators
  interface Accumulator {
    waterBodyCount: number;
    censusRecords: number;
    restorationCritical: number;
    restorationHigh: number;
    topBodies: { name: string; score: number; level: string }[];
    hazardZoneCount: number;
    hazardByCategory: Record<string, number>;
    drainageCount: number;
    drainageLengthKm: number;
    stpCount: number;
    pumpingMainCount: number;
    pumpingMainLengthKm: number;
    totalStpCapacityMld: number;
    industrialCount: number;
  }
  const acc = new Map<number, Accumulator>();
  for (const w of wards) {
    acc.set(w.ward_number, {
      waterBodyCount: 0,
      censusRecords: 0,
      restorationCritical: 0,
      restorationHigh: 0,
      topBodies: [],
      hazardZoneCount: 0,
      hazardByCategory: {},
      drainageCount: 0,
      drainageLengthKm: 0,
      stpCount: 0,
      pumpingMainCount: 0,
      pumpingMainLengthKm: 0,
      totalStpCapacityMld: 0,
      industrialCount: 0,
    });
  }

  // 3. Water bodies current (OSM polygons) - centroid PIP
  console.log("Processing water bodies (current)...");
  const waterBodies = JSON.parse(
    readFileSync(resolve(root, "public/geojson/bangalore-water-bodies-current.geojson"), "utf8"),
  ) as GeoJSON.FeatureCollection;
  let waterBodyAssigned = 0;
  for (const feat of waterBodies.features) {
    const c = featureCentroid(feat);
    const ward = findWard(c.lng, c.lat, wards, grid);
    if (ward != null) {
      acc.get(ward)!.waterBodyCount++;
      waterBodyAssigned++;
    }
  }
  console.log(`  ${waterBodyAssigned}/${waterBodies.features.length} current water bodies assigned`);

  // 4. Water bodies census (Points) - direct PIP for census_records count
  console.log("Processing water bodies (census)...");
  const censusGeo = JSON.parse(
    readFileSync(resolve(root, "public/geojson/bangalore-water-bodies-census.geojson"), "utf8"),
  ) as GeoJSON.FeatureCollection;
  let censusAssigned = 0;
  for (const feat of censusGeo.features) {
    const geom = feat.geometry as GeoJSON.Point;
    if (!geom || geom.type !== "Point") continue;
    const [lng, lat] = geom.coordinates;
    const ward = findWard(lng, lat, wards, grid);
    if (ward != null) {
      acc.get(ward)!.censusRecords++;
      censusAssigned++;
    }
  }
  console.log(`  ${censusAssigned}/${censusGeo.features.length} census records assigned`);

  // 5. Restoration priority - centroid PIP. Bangalore taxonomy: source =
  //    "osm" with priority_level "critical"|"high"|"moderate". Centroid
  //    arrives as [lat, lng] (matches Chennai/Madurai shape).
  console.log("Processing restoration priority...");
  const restorationData = JSON.parse(
    readFileSync(resolve(root, "public/data/restoration-priority-bangalore.json"), "utf8"),
  ) as {
    water_bodies: Array<{
      source: string;
      name: string;
      centroid: [number, number];
      priority_score: number;
      priority_level: string;
    }>;
  };
  let restorationAssigned = 0;
  for (const body of restorationData.water_bodies) {
    const [lat, lng] = body.centroid;
    const ward = findWard(lng, lat, wards, grid);
    if (ward != null) {
      const p = acc.get(ward)!;
      restorationAssigned++;
      if (body.priority_level === "critical") p.restorationCritical++;
      else if (body.priority_level === "high") p.restorationHigh++;
      p.topBodies.push({
        name: body.name || "(unnamed)",
        score: body.priority_score,
        level: body.priority_level,
      });
    }
  }
  console.log(`  ${restorationAssigned}/${restorationData.water_bodies.length} restoration records assigned`);

  // 6. Flood hotspots - Points with category (no annual breakdown)
  console.log("Processing flood hotspots...");
  const floodGeo = JSON.parse(
    readFileSync(resolve(root, "public/data/bangalore-flood-hotspots.geojson"), "utf8"),
  ) as GeoJSON.FeatureCollection;
  let floodAssigned = 0;
  for (const feat of floodGeo.features) {
    const geom = feat.geometry as GeoJSON.Point;
    if (!geom || geom.type !== "Point") continue;
    const [lng, lat] = geom.coordinates;
    const props = (feat.properties ?? {}) as Record<string, unknown>;
    const category = (props.category as string) || "unknown";
    const ward = findWard(lng, lat, wards, grid);
    if (ward != null) {
      const p = acc.get(ward)!;
      p.hazardZoneCount++;
      p.hazardByCategory[category] = (p.hazardByCategory[category] || 0) + 1;
      floodAssigned++;
    }
  }
  console.log(`  ${floodAssigned}/${floodGeo.features.length} flood hotspots assigned`);

  // 7. SWD drainage (primary + secondary, LineStrings)
  console.log("Processing SWD primary + secondary...");
  const swdPaths = [
    "public/geojson/bangalore-swd-primary.geojson",
    "public/geojson/bangalore-swd-secondary.geojson",
  ];
  let drainageTotal = 0, drainageAssigned = 0;
  for (const p of swdPaths) {
    const geo = JSON.parse(readFileSync(resolve(root, p), "utf8")) as GeoJSON.FeatureCollection;
    drainageTotal += geo.features.length;
    for (const feat of geo.features) {
      const geom = feat.geometry;
      if (!geom || geom.type !== "LineString") continue;
      const mid = midpointWard(geom as GeoJSON.LineString, wards, grid);
      if (mid != null) {
        acc.get(mid)!.drainageCount++;
        drainageAssigned++;
      }
      const distributed = distributeLineLengthByWard(geom as GeoJSON.LineString, wards, grid);
      for (const [w, km] of distributed) acc.get(w)!.drainageLengthKm += km;
    }
  }
  console.log(`  ${drainageAssigned}/${drainageTotal} SWD lines assigned`);

  // 8. Sewerage: STPs (Points) + trunks (LineStrings as pumping mains)
  console.log("Processing STPs...");
  const stpsGeo = JSON.parse(
    readFileSync(resolve(root, "public/geojson/bangalore-stps.geojson"), "utf8"),
  ) as GeoJSON.FeatureCollection;
  let stpAssigned = 0;
  for (const feat of stpsGeo.features) {
    const geom = feat.geometry as GeoJSON.Point;
    if (!geom || geom.type !== "Point") continue;
    const [lng, lat] = geom.coordinates;
    const props = (feat.properties ?? {}) as Record<string, unknown>;
    const capacityMld = (props.capacity_mld as number) ?? 0;
    const ward = findWard(lng, lat, wards, grid);
    if (ward != null) {
      const p = acc.get(ward)!;
      p.stpCount++;
      p.totalStpCapacityMld += capacityMld;
      stpAssigned++;
    }
  }
  console.log(`  ${stpAssigned}/${stpsGeo.features.length} STPs assigned`);

  console.log("Processing sewerage trunks (pumping mains)...");
  const trunksGeo = JSON.parse(
    readFileSync(resolve(root, "public/geojson/bangalore-sewerage-trunks.geojson"), "utf8"),
  ) as GeoJSON.FeatureCollection;
  let trunkAssigned = 0;
  for (const feat of trunksGeo.features) {
    const geom = feat.geometry;
    if (!geom || geom.type !== "LineString") continue;
    const mid = midpointWard(geom as GeoJSON.LineString, wards, grid);
    if (mid != null) {
      acc.get(mid)!.pumpingMainCount++;
      trunkAssigned++;
    }
    const distributed = distributeLineLengthByWard(geom as GeoJSON.LineString, wards, grid);
    for (const [w, km] of distributed) acc.get(w)!.pumpingMainLengthKm += km;
  }
  console.log(`  ${trunkAssigned}/${trunksGeo.features.length} trunk midpoints assigned`);

  // 9. Industrial sources (Points)
  console.log("Processing industrial sources...");
  const industrial = JSON.parse(
    readFileSync(resolve(root, "public/data/industrial-sources-bangalore.json"), "utf8"),
  ) as { sources: Array<{ id: string; name: string; lat: number; lng: number }> };
  let industrialAssigned = 0;
  for (const src of industrial.sources) {
    if (typeof src.lat !== "number" || typeof src.lng !== "number") continue;
    const ward = findWard(src.lng, src.lat, wards, grid);
    if (ward != null) {
      acc.get(ward)!.industrialCount++;
      industrialAssigned++;
    }
  }
  console.log(`  ${industrialAssigned}/${industrial.sources.length} industrial sources assigned`);

  // 10. Nearest river station per ward (haversine from centroid)
  console.log("Processing river stations...");
  const riverQuality = JSON.parse(
    readFileSync(resolve(root, "public/data/river-quality-bangalore.json"), "utf8"),
  ) as { rivers: Array<{ id: string; stations: Array<{ id: string; lat: number; lng: number }> }> };
  const stations: Array<{ id: string; riverId: string; coord: Coord }> = [];
  for (const river of riverQuality.rivers) {
    if (!Array.isArray(river.stations)) continue;
    for (const st of river.stations) {
      if (typeof st.lat !== "number" || typeof st.lng !== "number") continue;
      stations.push({ id: st.id, riverId: river.id, coord: { lat: st.lat, lng: st.lng } });
    }
  }
  const wardRivers = new Map<number, { stationId: string; riverId: string; km: number }>();
  for (const w of wards) {
    const wardC: Coord = { lat: w.centroid[1], lng: w.centroid[0] };
    let bestDist = Infinity;
    let best: { id: string; riverId: string } | null = null;
    for (const st of stations) {
      const d = haversine(wardC, st.coord);
      if (d < bestDist) { bestDist = d; best = { id: st.id, riverId: st.riverId }; }
    }
    if (best) {
      wardRivers.set(w.ward_number, {
        stationId: best.id,
        riverId: best.riverId,
        km: roundTo(bestDist, 1),
      });
    }
  }

  // 11. CGWB block assignment (PIP ward centroid -> 6 GWR blocks; fall
  //     back to nearest block centroid if PIP misses).
  console.log("Processing CGWB blocks...");
  const blocksGeo = JSON.parse(
    readFileSync(resolve(root, "public/geojson/bangalore-gwr-blocks.geojson"), "utf8"),
  ) as GeoJSON.FeatureCollection;
  interface BlockInfo {
    name: string;
    klass: string;
    devPct: number | null;
    feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
    centroid: Coord;
  }
  const blocks: BlockInfo[] = blocksGeo.features.map((f) => {
    const props = (f.properties ?? {}) as Record<string, unknown>;
    const c = centroid(f);
    return {
      name: String(props.block ?? props.name ?? ""),
      klass: String(props.class ?? ""),
      devPct: typeof props.sgw_dev_pe === "number"
        ? roundTo(props.sgw_dev_pe as number, 1)
        : null,
      feature: f as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
      centroid: { lat: c.geometry.coordinates[1], lng: c.geometry.coordinates[0] },
    };
  });

  function blockForWard(w: WardInfo): BlockInfo | null {
    const pt = turfPoint(w.centroid);
    for (const b of blocks) {
      if (booleanPointInPolygon(pt, b.feature)) return b;
    }
    let best: BlockInfo | null = null;
    let bestDist = Infinity;
    const wardC: Coord = { lat: w.centroid[1], lng: w.centroid[0] };
    for (const b of blocks) {
      const d = haversine(wardC, b.centroid);
      if (d < bestDist) { bestDist = d; best = b; }
    }
    return best;
  }

  // 12. CGWB nearest well per ward (<=5 km)
  console.log("Processing CGWB Year Book wells...");
  const cgwb = JSON.parse(
    readFileSync(resolve(root, "public/data/bangalore-cgwb-stations.json"), "utf8"),
  ) as {
    wells: Array<{
      name: string;
      block: string;
      lat: number;
      lng: number;
      readings: Array<{ year: number; month: number; depth_m_bgl: number }>;
    }>;
  };
  const NEAREST_WELL_MAX_KM = 5;
  function nearestWellForWard(w: WardInfo): AnalyticalSections["groundwater_assessment"]["nearest_well"] {
    const wardC: Coord = { lat: w.centroid[1], lng: w.centroid[0] };
    let best: { well: typeof cgwb.wells[number]; km: number } | null = null;
    for (const well of cgwb.wells) {
      if (typeof well.lat !== "number" || typeof well.lng !== "number") continue;
      const d = haversine(wardC, { lat: well.lat, lng: well.lng });
      if (best == null || d < best.km) best = { well, km: d };
    }
    if (!best || best.km > NEAREST_WELL_MAX_KM) return null;
    const readings = Array.isArray(best.well.readings) ? best.well.readings : [];
    const sorted = [...readings].sort((a, b) => b.year - a.year || b.month - a.month);
    const latest = sorted[0]
      ? { year: sorted[0].year, month: sorted[0].month, depth_m_bgl: sorted[0].depth_m_bgl }
      : null;
    return {
      name: best.well.name,
      block: best.well.block,
      distance_km: roundTo(best.km, 1),
      latest,
    };
  }

  // 13. Build merged output (admin fields + analytical sections)
  console.log("Building output...");
  const output: Array<Record<string, unknown>> = [];
  for (const w of wards) {
    const p = acc.get(w.ward_number)!;
    const river = wardRivers.get(w.ward_number);

    const topBodies = p.topBodies
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, 3)
      .map((b) => ({ name: b.name, score: b.score, level: b.level }));

    let dominantHazard: string | null = null;
    let maxCount = 0;
    const sortedCategories = Object.entries(p.hazardByCategory).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    for (const [cat, count] of sortedCategories) {
      if (count > maxCount) { maxCount = count; dominantHazard = cat; }
    }

    const block = blockForWard(w);
    const groundwater_assessment: GroundwaterAssessment = {
      block: block
        ? { name: block.name, class: block.klass, development_pct: block.devPct }
        : null,
      nearest_well: nearestWellForWard(w),
    };

    const analytical: AnalyticalSections = {
      water_bodies: {
        current_count: p.waterBodyCount,
        census_records: p.censusRecords,
        restoration_critical: p.restorationCritical,
        restoration_high: p.restorationHigh,
        avg_restoration_score: p.topBodies.length > 0
          ? roundTo(p.topBodies.reduce((s, b) => s + b.score, 0) / p.topBodies.length, 6)
          : null,
        top_bodies: topBodies,
      },
      lost_bodies: { count: 0, names: [] },
      flood: {
        hazard_zone_count: p.hazardZoneCount,
        by_category: Object.fromEntries(sortedCategories),
        dominant_hazard: dominantHazard,
        hotspot_2015_count: 0,
        hotspot_2020_count: 0,
      },
      drainage: {
        line_count: p.drainageCount,
        total_length_km: roundTo(p.drainageLengthKm, 6),
      },
      sewerage: {
        stp_count: p.stpCount,
        sps_count: 0,
        pumping_main_count: p.pumpingMainCount,
        pumping_main_length_km: roundTo(p.pumpingMainLengthKm, 6),
        total_stp_capacity_mld: Math.round(p.totalStpCapacityMld * 10) / 10,
      },
      rivers: {
        nearest_station_id: river?.stationId ?? null,
        nearest_river_id: river?.riverId ?? null,
        nearest_km: river?.km ?? null,
      },
      industrial: { zone_count: p.industrialCount },
      groundwater_assessment,
    };

    const existingRec = existingByWard.get(w.ward_number) ?? { ward_number: w.ward_number };
    output.push({ ...existingRec, ...analytical });
  }

  const outPath = resolve(root, "public/data/bangalore-ward-profiles.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2));

  const totalWB = output.reduce((s, w) => s + (w.water_bodies as AnalyticalSections["water_bodies"]).current_count, 0);
  const totalCensus = output.reduce((s, w) => s + (w.water_bodies as AnalyticalSections["water_bodies"]).census_records, 0);
  const totalDrainage = output.reduce((s, w) => s + (w.drainage as AnalyticalSections["drainage"]).line_count, 0);
  const totalDrainageKm = output.reduce((s, w) => s + (w.drainage as AnalyticalSections["drainage"]).total_length_km, 0);
  const totalSewerage = output.reduce(
    (s, w) => {
      const sew = w.sewerage as AnalyticalSections["sewerage"];
      return s + sew.stp_count + sew.pumping_main_count;
    },
    0,
  );
  const totalFlood = output.reduce((s, w) => s + (w.flood as AnalyticalSections["flood"]).hazard_zone_count, 0);
  const totalIndustrial = output.reduce((s, w) => s + (w.industrial as AnalyticalSections["industrial"]).zone_count, 0);
  const wardsWithBlock = output.filter(
    (w) => (w.groundwater_assessment as GroundwaterAssessment).block != null,
  ).length;
  const wardsWithWell = output.filter(
    (w) => (w.groundwater_assessment as GroundwaterAssessment).nearest_well != null,
  ).length;

  console.log(`\nWard profiles written to ${outPath}`);
  console.log(`  ${output.length} wards profiled`);
  console.log(`  Water bodies (current): ${totalWB} assigned`);
  console.log(`  Water bodies (census records): ${totalCensus} assigned`);
  console.log(`  Flood hotspots: ${totalFlood} assigned`);
  console.log(`  Drainage lines: ${totalDrainage} midpoint assignments, ${Math.round(totalDrainageKm)} km apportioned`);
  console.log(`  Sewerage features: ${totalSewerage} assigned`);
  console.log(`  Industrial sources: ${totalIndustrial} assigned`);
  console.log(`  Groundwater: ${wardsWithBlock}/${output.length} wards with block, ${wardsWithWell}/${output.length} wards with <=5km well`);
}

main();
