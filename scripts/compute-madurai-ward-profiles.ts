/**
 * Compute Madurai ward profiles by spatially joining the data layers we
 * actually have for Madurai onto the 100 MMC wards. Mirrors the
 * structure of scripts/compute-ward-profiles.ts (Chennai) so the
 * downstream UI can consume both files through the same code path.
 *
 * Madurai gap-vs-Chennai (deliberate, per project_madurai_scope_decision):
 *   - No public flood hazard layer (CFLOWS is Chennai-only); we emit
 *     null on `flood` and mark `_data_status: "not_available"`.
 *   - No public drainage / sewerage GeoJSON; same null + status marker.
 *   - No industrial-zone polygons; same.
 *
 * What we DO compute:
 *   - water_bodies            from madurai-water-bodies-current.geojson +
 *                             restoration-priority-madurai.json
 *   - lost_bodies             from madurai-water-bodies-lost.geojson
 *   - rivers                  nearest CPCB station from river-quality-madurai.json
 *   - groundwater_assessment  CGWB block (PIP ward centroid -> 11 GWR
 *                             block polygons) + nearest CGWB Year Book
 *                             well (gated <=5 km). Replaces Chennai's
 *                             interpolated depth/risk: with only 21
 *                             sensor wells across the district, per-ward
 *                             IDW would be empty for most wards. Block
 *                             class gives 100% coverage; nearest-well
 *                             surfaces a real reading when one is
 *                             honestly close enough.
 *
 * Fully deterministic from repo contents - no Supabase calls, no live
 * data. Identical inputs produce byte-identical output.
 *
 * Run: npx tsx scripts/compute-madurai-ward-profiles.ts
 * Output: public/data/madurai-ward-profiles.json (committed)
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import centroid from "@turf/centroid";
import bbox from "@turf/bbox";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint } from "@turf/helpers";
import turfArea from "@turf/area";

// ── Types ────────────────────────────────────────────────────────────────────

interface Coord {
  lat: number;
  lng: number;
}

interface WardInfo {
  ward_number: number;
  zone_no: string;
  zone_name: string;
  centroid: [number, number]; // [lng, lat]
  feature: GeoJSON.Feature<GeoJSON.Polygon>;
  bbox: [number, number, number, number];
}

/** Sections we don't have data for in Madurai - rendered as honest
 *  "not yet collected" cards, not zero counts. */
type NotAvailable = { _data_status: "not_available"; _data_status_note: string };

interface WardProfile {
  ward_number: number;
  zone_no: string;
  zone_name: string;
  centroid: [number, number];
  area_sq_km: number;

  water_bodies: {
    current_count: number;
    census_records: number;
    restoration_critical: number;
    restoration_high: number;
    avg_restoration_score: number | null;
    top_bodies: { name: string; score: number; level: string }[];
  };

  lost_bodies: {
    count: number;
    names: string[];
  };

  // Madurai-specific: these layers don't exist publicly yet. Emitting
  // an explicit "not_available" status lets the UI render an honest
  // disclaimer card instead of fabricating zero counts.
  flood: NotAvailable;
  drainage: NotAvailable;
  sewerage: NotAvailable;
  industrial: NotAvailable;

  rivers: {
    nearest_station_id: string | null;
    nearest_river_id: string | null;
    nearest_km: number | null;
  };

  /** CGWB-assessment headline: every ward gets a `block` label (the 11
   *  GWR blocks tile the district), and optionally a nearest sensor
   *  well if there is one within 5 km. Marked optional on the type so
   *  cities that don't compute this (Chennai today) simply omit it. */
  groundwater_assessment?: GroundwaterAssessment;
}

interface GroundwaterAssessment {
  block: {
    name: string;
    /** "Safe" | "Semi Critical" | "Critical" | "Over Exploited" */
    class: string;
    /** Stage of groundwater extraction, % */
    development_pct: number | null;
  } | null;
  nearest_well: {
    name: string;
    block: string;
    distance_km: number;
    latest: {
      year: number;
      month: number;
      depth_m_bgl: number;
    } | null;
  } | null;
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

// ── Main ─────────────────────────────────────────────────────────────────────

const NOT_AVAILABLE: NotAvailable = {
  _data_status: "not_available",
  _data_status_note:
    "Layer not yet sourced for Madurai. Tracked as RTI follow-up to MMC; see /madurai/about for the data-gap inventory.",
};

function main() {
  const root = resolve(new URL(".", import.meta.url).pathname, "..");
  console.log("Computing Madurai ward profiles...");

  // 1. Load Madurai ward GeoJSON (100 MMC wards)
  const wardGeo = JSON.parse(
    readFileSync(resolve(root, "public/geojson/madurai-wards-2022.geojson"), "utf8"),
  ) as GeoJSON.FeatureCollection;

  const wards: WardInfo[] = wardGeo.features.map((f) => {
    const props = f.properties as Record<string, unknown>;
    // Madurai's geojson uses different property keys than Chennai's; try
    // a few common ones.
    const wardNum =
      (props.ward_no as number) ??
      (props.Ward_No as number) ??
      (props.ward_number as number);
    const feat = f as GeoJSON.Feature<GeoJSON.Polygon>;
    const c = centroid(feat);
    const b = bbox(feat);
    return {
      ward_number: wardNum,
      zone_no: String(
        (props.zone_no as string | number | undefined) ??
          (props.Zone_No as string | number | undefined) ??
          "",
      ),
      // Madurai geojson uses the field name `zone` (e.g. "West Zone-V")
      // rather than Chennai's `zone_name`/`Zone_Name`. Try all three so
      // the same script handles both shapes.
      zone_name: (
        (props.zone_name as string) ||
        (props.Zone_Name as string) ||
        (props.zone as string) ||
        ""
      ).toString(),
      centroid: c.geometry.coordinates as [number, number],
      feature: feat,
      bbox: b as [number, number, number, number],
    };
  });

  wards.sort((a, b) => a.ward_number - b.ward_number);
  const grid = buildGridIndex(wards);

  // Per-ward accumulators - only the layers we have data for.
  interface Accumulator {
    waterBodyCount: number;
    censusRecords: number;
    restorationCritical: number;
    restorationHigh: number;
    topBodies: { name: string; score: number; level: string }[];
    lostCount: number;
    lostNames: string[];
  }
  const profiles = new Map<number, Accumulator>();
  for (const w of wards) {
    profiles.set(w.ward_number, {
      waterBodyCount: 0,
      censusRecords: 0,
      restorationCritical: 0,
      restorationHigh: 0,
      topBodies: [],
      lostCount: 0,
      lostNames: [],
    });
  }

  // 2. Water bodies (OSM) - centroid PIP
  console.log("Processing water bodies...");
  const waterBodies = JSON.parse(
    readFileSync(resolve(root, "public/geojson/madurai-water-bodies-current.geojson"), "utf8"),
  ) as GeoJSON.FeatureCollection;

  let waterBodyAssigned = 0;
  for (const feat of waterBodies.features) {
    const c = featureCentroid(feat);
    const ward = findWard(c.lng, c.lat, wards, grid);
    if (ward != null) {
      profiles.get(ward)!.waterBodyCount++;
      waterBodyAssigned++;
    }
  }
  console.log(`  ${waterBodyAssigned}/${waterBodies.features.length} water bodies assigned`);

  // 3. Restoration priority - centroid PIP. Madurai's source taxonomy
  //    uses "flagship", "osm", "matched" rather than Chennai's
  //    "census" / "matched" / "osm"; we treat the same heuristic as
  //    Chennai (count critical/high, build top_bodies) without trying
  //    to round-trip a "census_records" notion that doesn't really
  //    apply for Madurai.
  console.log("Processing restoration priority...");
  const restorationData = JSON.parse(
    readFileSync(resolve(root, "public/data/restoration-priority-madurai.json"), "utf8"),
  );
  const restorationBodies = restorationData.water_bodies as Array<{
    source: string;
    name: string;
    centroid: [number, number]; // [lat, lng]
    priority_score: number;
    priority_level: string;
  }>;

  let restorationAssigned = 0;
  for (const body of restorationBodies) {
    const [lat, lng] = body.centroid;
    const ward = findWard(lng, lat, wards, grid);
    if (ward != null) {
      const p = profiles.get(ward)!;
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
  console.log(`  ${restorationAssigned}/${restorationBodies.length} restoration records assigned`);

  // 4. Lost water bodies - Points
  console.log("Processing lost water bodies...");
  const lostGeo = JSON.parse(
    readFileSync(resolve(root, "public/geojson/madurai-water-bodies-lost.geojson"), "utf8"),
  ) as GeoJSON.FeatureCollection;

  for (const feat of lostGeo.features) {
    const geom = feat.geometry as GeoJSON.Point;
    if (!geom || geom.type !== "Point") continue;
    const [lng, lat] = geom.coordinates;
    const props = feat.properties as Record<string, unknown>;
    const ward = findWard(lng, lat, wards, grid);
    if (ward != null) {
      const p = profiles.get(ward)!;
      p.lostCount++;
      const name = (props.name as string) || "";
      if (name) p.lostNames.push(name);
    }
  }
  console.log(`  ${lostGeo.features.length} lost water bodies processed`);

  // 5. Nearest river station per ward (haversine from centroid)
  console.log("Processing river stations...");
  const riverQuality = JSON.parse(
    readFileSync(resolve(root, "public/data/river-quality-madurai.json"), "utf8"),
  );

  const stations: Array<{ id: string; riverId: string; coord: Coord }> = [];
  for (const river of riverQuality.rivers) {
    if (!Array.isArray(river.stations)) continue;
    for (const station of river.stations) {
      if (typeof station.lat !== "number" || typeof station.lng !== "number") continue;
      stations.push({
        id: station.id,
        riverId: river.id,
        coord: { lat: station.lat, lng: station.lng },
      });
    }
  }

  const wardRivers = new Map<number, { stationId: string; riverId: string; km: number }>();
  for (const w of wards) {
    const wardCentroid: Coord = { lat: w.centroid[1], lng: w.centroid[0] };
    let bestDist = Infinity;
    let bestStation: { id: string; riverId: string } | null = null;
    for (const st of stations) {
      const d = haversine(wardCentroid, st.coord);
      if (d < bestDist) {
        bestDist = d;
        bestStation = { id: st.id, riverId: st.riverId };
      }
    }
    if (bestStation) {
      wardRivers.set(w.ward_number, {
        stationId: bestStation.id,
        riverId: bestStation.riverId,
        km: roundTo(bestDist, 1),
      });
    }
  }

  // 6. CGWB block assignment (PIP ward centroid -> block polygon).
  //    Every Madurai ward should land in exactly one of the 11 GWR
  //    blocks, but if PIP misses (slight boundary offset between the
  //    ward and block sources) we fall back to nearest-block-centroid.
  console.log("Processing CGWB blocks...");
  const blocksGeo = JSON.parse(
    readFileSync(resolve(root, "public/geojson/madurai-gwr-blocks.geojson"), "utf8"),
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
      devPct: typeof props.sgw_dev_pe === "number" ? roundTo(props.sgw_dev_pe as number, 1) : null,
      feature: f as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
      centroid: { lat: c.geometry.coordinates[1], lng: c.geometry.coordinates[0] },
    };
  });

  function blockForWard(w: WardInfo): BlockInfo | null {
    const pt = turfPoint(w.centroid);
    for (const b of blocks) {
      if (booleanPointInPolygon(pt, b.feature)) return b;
    }
    // Fall back to nearest block centroid - keeps coverage at 100%
    // even if PIP misses by a few metres at a boundary.
    let best: BlockInfo | null = null;
    let bestDist = Infinity;
    const wardC: Coord = { lat: w.centroid[1], lng: w.centroid[0] };
    for (const b of blocks) {
      const d = haversine(wardC, b.centroid);
      if (d < bestDist) {
        bestDist = d;
        best = b;
      }
    }
    return best;
  }

  // 7. Nearest CGWB Year Book well per ward, gated <=5 km. Beyond that
  //    a single well isn't honestly representative of the ward.
  console.log("Processing CGWB Year Book wells...");
  const cgwb = JSON.parse(
    readFileSync(resolve(root, "public/data/madurai-cgwb-stations.json"), "utf8"),
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
  function nearestWellForWard(w: WardInfo): GroundwaterAssessment["nearest_well"] {
    const wardC: Coord = { lat: w.centroid[1], lng: w.centroid[0] };
    let best: { well: typeof cgwb.wells[number]; km: number } | null = null;
    for (const well of cgwb.wells) {
      const d = haversine(wardC, { lat: well.lat, lng: well.lng });
      if (best == null || d < best.km) best = { well, km: d };
    }
    if (!best || best.km > NEAREST_WELL_MAX_KM) return null;

    // Latest reading by (year, month) descending
    const sorted = [...best.well.readings].sort(
      (a, b) => b.year - a.year || b.month - a.month,
    );
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

  // 8. Build output
  console.log("Building output...");
  const output: WardProfile[] = [];

  for (const w of wards) {
    const p = profiles.get(w.ward_number)!;
    const river = wardRivers.get(w.ward_number);

    const topBodies = p.topBodies
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, 3)
      .map((b) => ({ name: b.name, score: b.score, level: b.level }));

    const lostNames = [...p.lostNames].sort();

    const areaSqM = turfArea(w.feature);
    const areaSqKm = roundTo(areaSqM / 1_000_000, 6);

    output.push({
      ward_number: w.ward_number,
      zone_no: w.zone_no,
      zone_name: w.zone_name,
      centroid: w.centroid,
      area_sq_km: areaSqKm,
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
      lost_bodies: {
        count: p.lostCount,
        names: lostNames,
      },
      flood: NOT_AVAILABLE,
      drainage: NOT_AVAILABLE,
      sewerage: NOT_AVAILABLE,
      industrial: NOT_AVAILABLE,
      rivers: {
        nearest_station_id: river?.stationId ?? null,
        nearest_river_id: river?.riverId ?? null,
        nearest_km: river?.km ?? null,
      },
      groundwater_assessment: ((): GroundwaterAssessment => {
        const b = blockForWard(w);
        return {
          block: b ? { name: b.name, class: b.klass, development_pct: b.devPct } : null,
          nearest_well: nearestWellForWard(w),
        };
      })(),
    });
  }

  // NVDM v1 wrapped form (schemas/nvdm/ward-profiles.schema.json): envelope +
  // wards[]. Loaders accept both shapes during migration. PRODUCED_AT is a
  // manual constant, bumped on regeneration, so identical inputs still
  // produce byte-identical output (no wall-clock in the artifact).
  const PRODUCED_AT = "2026-07-30";
  const wrapped = {
    nvdm: "1.0",
    dataset: "data-root/ward-profiles",
    scope: { kind: "city", id: "madurai" },
    provenance: {
      sources: [
        {
          title: "Madurai Corporation ward boundaries, 2022 delimitation (KML)",
          publisher: "GoTN / Madurai Municipal Corporation",
          role: "input",
          closed: true,
          as_of: "2022",
        },
        {
          title: "OpenStreetMap water bodies / rivers (Overpass extracts)",
          publisher: "OpenStreetMap contributors",
          license: "ODbL 1.0",
          role: "input",
          continuous: true,
        },
        {
          id: "cgwb-yearbook-tn",
          title: "CGWB Ground Water Year Book, Tamil Nadu & Puducherry",
          publisher: "Central Ground Water Board",
          license: "GoI publication, cited with attribution",
          role: "input",
        },
        {
          id: "ingres-gw-assessment-madurai",
          title: "IN-GRES dynamic groundwater assessment (Madurai firkas)",
          publisher: "CGWB / IN-GRES",
          license: "GoI publication, cited with attribution",
          role: "input",
        },
      ],
      method: "derived",
      produced_at: PRODUCED_AT,
      produced_by: "scripts/compute-madurai-ward-profiles.ts",
      note: "Deterministic join over committed ward-level layers (see script header). flood/drainage/sewerage/industrial are honest not-available placeholders pending sources.",
    },
    wards: output,
  };
  const outPath = resolve(root, "public/data/madurai-ward-profiles.json");
  writeFileSync(outPath, JSON.stringify(wrapped, null, 2));

  // Summary
  const totalWaterBodies = output.reduce((s, w) => s + w.water_bodies.current_count, 0);
  const totalLost = output.reduce((s, w) => s + w.lost_bodies.count, 0);
  const totalRestoration = output.reduce(
    (s, w) => s + w.water_bodies.restoration_critical + w.water_bodies.restoration_high,
    0,
  );

  console.log(`\nWard profiles written to ${outPath}`);
  console.log(`  ${output.length} wards profiled`);
  console.log(`  Water bodies: ${totalWaterBodies} assigned`);
  console.log(`  Lost bodies: ${totalLost} assigned`);
  console.log(`  Restoration high/critical: ${totalRestoration} flagship-or-above bodies`);

  const wardsWithBlock = output.filter((w) => w.groundwater_assessment?.block).length;
  const wardsWithNearWell = output.filter((w) => w.groundwater_assessment?.nearest_well).length;
  const blockClassCounts: Record<string, number> = {};
  for (const w of output) {
    const k = w.groundwater_assessment?.block?.class;
    if (k) blockClassCounts[k] = (blockClassCounts[k] ?? 0) + 1;
  }
  console.log(
    `  CGWB block: ${wardsWithBlock}/${output.length} wards assigned ` +
      `(${Object.entries(blockClassCounts).map(([k, v]) => `${k}: ${v}`).join(", ")})`,
  );
  console.log(
    `  Nearest CGWB well (<=5 km): ${wardsWithNearWell}/${output.length} wards`,
  );
  console.log(`  Sections marked not_available: flood, drainage, sewerage, industrial`);
}

main();
