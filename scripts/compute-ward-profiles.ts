/**
 * Compute ward profiles by spatially joining all data layers to Chennai's 200 wards.
 *
 * Fully deterministic from repo contents - no Supabase calls, no live data.
 * Identical inputs produce byte-identical output (no timestamps).
 *
 * Run: npx tsx scripts/compute-ward-profiles.ts
 * Output: public/data/ward-profiles.json (committed)
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
  zone_no: string;
  zone_name: string;
  centroid: [number, number]; // [lng, lat] for GeoJSON consistency
  feature: GeoJSON.Feature<GeoJSON.Polygon>;
  bbox: [number, number, number, number]; // [minX, minY, maxX, maxY]
}

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

  flood: {
    hazard_zone_count: number;
    by_category: Record<string, number>;
    dominant_hazard: string | null;
    hotspot_2015_count: number;
    hotspot_2020_count: number;
  };

  drainage: {
    line_count: number;
    total_length_km: number;
  };

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

// ── Spatial grid index ───────────────────────────────────────────────────────
// 20x20 grid over Chennai bounding box for fast candidate ward lookup

interface GridIndex {
  minLng: number;
  minLat: number;
  cellW: number;
  cellH: number;
  cols: number;
  rows: number;
  cells: Map<string, number[]>; // "col,row" -> ward indices
}

function buildGridIndex(wards: WardInfo[], gridSize = 20): GridIndex {
  // Find bounding box of all wards
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

function findWard(lng: number, lat: number, wards: WardInfo[], grid: GridIndex): number | null {
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

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const root = resolve(new URL(".", import.meta.url).pathname, "..");
  console.log("Computing ward profiles...");

  // 1. Load ward GeoJSON
  const wardGeo = JSON.parse(
    readFileSync(resolve(root, "public/geojson/chennai-wards-2022.geojson"), "utf8")
  ) as GeoJSON.FeatureCollection;

  const wards: WardInfo[] = wardGeo.features.map((f) => {
    const props = f.properties as Record<string, unknown>;
    const wardNum = (props.ward_number as number) ?? (props.Ward_No as number);
    const feat = f as GeoJSON.Feature<GeoJSON.Polygon>;
    const c = centroid(feat);
    const b = bbox(feat);
    return {
      ward_number: wardNum,
      zone_no: (props.Zone_No as string) || "",
      zone_name: (props.Zone_Name as string) || "",
      centroid: c.geometry.coordinates as [number, number],
      feature: feat,
      bbox: b as [number, number, number, number],
    };
  });

  // Sort wards by number for deterministic processing
  wards.sort((a, b) => a.ward_number - b.ward_number);

  const grid = buildGridIndex(wards);

  // Initialize profile accumulators per ward
  const profiles = new Map<number, {
    waterBodyCount: number;
    censusRecords: number;
    restorationCritical: number;
    restorationHigh: number;
    topBodies: { name: string; score: number; level: string }[];
    lostCount: number;
    lostNames: string[];
    hazardZoneCount: number;
    hazardByCategory: Record<string, number>;
    hotspot2015Count: number;
    hotspot2020Count: number;
    drainageCount: number;
    drainageLengthKm: number;
    stpCount: number;
    spsCount: number;
    pumpingMainCount: number;
    pumpingMainLengthKm: number;
    totalStpCapacityMld: number;
    industrialCount: number;
  }>();

  for (const w of wards) {
    profiles.set(w.ward_number, {
      waterBodyCount: 0,
      censusRecords: 0,
      restorationCritical: 0,
      restorationHigh: 0,
      topBodies: [],
      lostCount: 0,
      lostNames: [],
      hazardZoneCount: 0,
      hazardByCategory: {},
      hotspot2015Count: 0,
      hotspot2020Count: 0,
      drainageCount: 0,
      drainageLengthKm: 0,
      stpCount: 0,
      spsCount: 0,
      pumpingMainCount: 0,
      pumpingMainLengthKm: 0,
      totalStpCapacityMld: 0,
      industrialCount: 0,
    });
  }

  // 2. Water bodies (OSM) - centroid PIP
  console.log("Processing water bodies...");
  const waterBodies = JSON.parse(
    readFileSync(resolve(root, "public/geojson/chennai-water-bodies-current.geojson"), "utf8")
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

  // 3. Restoration priority - centroid PIP
  console.log("Processing restoration priority...");
  const restorationData = JSON.parse(
    readFileSync(resolve(root, "public/data/restoration-priority.json"), "utf8")
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

      // Census records count
      if (body.source === "census" || body.source === "matched") {
        p.censusRecords++;
      }

      const isCurrentBody = body.source === "osm" || body.source === "matched";
      if (isCurrentBody) {
        if (body.priority_level === "critical") p.restorationCritical++;
        else if (body.priority_level === "high") p.restorationHigh++;

        p.topBodies.push({
          name: body.name || "(unnamed)",
          score: body.priority_score,
          level: body.priority_level,
        });
      }
    }
  }
  console.log(`  ${restorationAssigned}/${restorationBodies.length} restoration records assigned`);

  // 4. Lost water bodies
  console.log("Processing lost water bodies...");
  const lostGeo = JSON.parse(
    readFileSync(resolve(root, "public/geojson/chennai-water-bodies-lost.geojson"), "utf8")
  ) as GeoJSON.FeatureCollection;

  for (const feat of lostGeo.features) {
    const geom = feat.geometry as GeoJSON.Point;
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

  // 5. Flood hazard zones - centroid PIP
  console.log("Processing flood hazard zones...");
  const hazardGeo = JSON.parse(
    readFileSync(resolve(root, "public/geojson/chennai-flood-hazard-zones.geojson"), "utf8")
  ) as GeoJSON.FeatureCollection;

  let hazardAssigned = 0;
  for (const feat of hazardGeo.features) {
    const c = featureCentroid(feat);
    const props = feat.properties as Record<string, unknown>;
    const category = (props.category as string) || "unknown";
    const ward = findWard(c.lng, c.lat, wards, grid);
    if (ward != null) {
      const p = profiles.get(ward)!;
      p.hazardZoneCount++;
      p.hazardByCategory[category] = (p.hazardByCategory[category] || 0) + 1;
      hazardAssigned++;
    }
  }
  console.log(`  ${hazardAssigned}/${hazardGeo.features.length} hazard zones assigned`);

  // 6. Flood hotspots 2015 - direct ward property
  console.log("Processing 2015 flood hotspots...");
  const hotspot2015Geo = JSON.parse(
    readFileSync(resolve(root, "public/geojson/chennai-flood-2015-hotspots.geojson"), "utf8")
  ) as GeoJSON.FeatureCollection;

  for (const feat of hotspot2015Geo.features) {
    const props = feat.properties as Record<string, unknown>;
    const ward = props.ward as number;
    if (ward != null && profiles.has(ward)) {
      profiles.get(ward)!.hotspot2015Count++;
    }
  }
  console.log(`  ${hotspot2015Geo.features.length} hotspots processed`);

  // 7. Flood hotspots 2020 - PIP
  console.log("Processing 2020 flood hotspots...");
  const hotspot2020Geo = JSON.parse(
    readFileSync(resolve(root, "public/geojson/chennai-flood-2020-hotspots.geojson"), "utf8")
  ) as GeoJSON.FeatureCollection;

  let hotspot2020Assigned = 0;
  for (const feat of hotspot2020Geo.features) {
    const geom = feat.geometry as GeoJSON.Point;
    const [lng, lat] = geom.coordinates;
    const ward = findWard(lng, lat, wards, grid);
    if (ward != null) {
      profiles.get(ward)!.hotspot2020Count++;
      hotspot2020Assigned++;
    }
  }
  console.log(`  ${hotspot2020Assigned}/${hotspot2020Geo.features.length} hotspots assigned`);

  // 8. Drainage lines - true midpoint via @turf/along at half length
  console.log("Processing drainage lines...");
  const drainageGeo = JSON.parse(
    readFileSync(resolve(root, "public/geojson/chennai-drainage.geojson"), "utf8")
  ) as GeoJSON.FeatureCollection;

  let drainageAssigned = 0;
  for (const feat of drainageGeo.features) {
    const geom = feat.geometry as GeoJSON.LineString;
    const line = { type: "Feature" as const, properties: {}, geometry: geom };
    const len = length(line, { units: "kilometers" });
    if (len === 0) continue;
    const midpoint = along(line, len / 2, { units: "kilometers" });
    const [lng, lat] = midpoint.geometry.coordinates;
    const ward = findWard(lng, lat, wards, grid);
    if (ward != null) {
      profiles.get(ward)!.drainageCount++;
      drainageAssigned++;
    }

    const distributed = distributeLineLengthByWard(geom, wards, grid);
    for (const [distributedWard, lengthKm] of distributed) {
      profiles.get(distributedWard)!.drainageLengthKm += lengthKm;
    }
  }
  console.log(`  ${drainageAssigned}/${drainageGeo.features.length} drainage lines assigned`);

  // 9. Sewerage - STPs/SPS are Points (direct PIP), pumping mains are LineStrings (midpoint)
  console.log("Processing sewerage...");
  const sewerageGeo = JSON.parse(
    readFileSync(resolve(root, "public/geojson/chennai-sewerage.geojson"), "utf8")
  ) as GeoJSON.FeatureCollection;

  let sewerageAssigned = 0;
  for (const feat of sewerageGeo.features) {
    const props = feat.properties as Record<string, unknown>;
    const layer = (props.layer as string) || "";

    let lng: number, lat: number;
    if (feat.geometry.type === "Point") {
      [lng, lat] = (feat.geometry as GeoJSON.Point).coordinates;
    } else if (feat.geometry.type === "LineString") {
      // Pumping mains - true midpoint
      const geom = feat.geometry as GeoJSON.LineString;
      const line = { type: "Feature" as const, properties: {}, geometry: geom };
      const len = length(line, { units: "kilometers" });
      if (len === 0) continue;
      const midpoint = along(line, len / 2, { units: "kilometers" });
      [lng, lat] = midpoint.geometry.coordinates;
    } else {
      continue;
    }

    const ward = findWard(lng, lat, wards, grid);
    if (ward != null) {
      const p = profiles.get(ward)!;
      if (layer === "stp") {
        p.stpCount++;
        const capacity = (props.capacity_mld as number) ?? 0;
        p.totalStpCapacityMld += capacity;
      } else if (layer === "sps") {
        p.spsCount++;
      } else if (layer === "pumping_main") {
        p.pumpingMainCount++;
      }
      sewerageAssigned++;
    }

    if (layer === "pumping_main" && feat.geometry.type === "LineString") {
      const distributed = distributeLineLengthByWard(
        feat.geometry as GeoJSON.LineString,
        wards,
        grid,
      );
      for (const [distributedWard, lengthKm] of distributed) {
        profiles.get(distributedWard)!.pumpingMainLengthKm += lengthKm;
      }
    }
  }
  console.log(`  ${sewerageAssigned}/${sewerageGeo.features.length} sewerage features assigned`);

  // 10. Industrial zones - centroid PIP
  console.log("Processing industrial zones...");
  const industrialGeo = JSON.parse(
    readFileSync(resolve(root, "public/geojson/chennai-industrial-zones.geojson"), "utf8")
  ) as GeoJSON.FeatureCollection;

  let industrialAssigned = 0;
  for (const feat of industrialGeo.features) {
    const c = featureCentroid(feat);
    const ward = findWard(c.lng, c.lat, wards, grid);
    if (ward != null) {
      profiles.get(ward)!.industrialCount++;
      industrialAssigned++;
    }
  }
  console.log(`  ${industrialAssigned}/${industrialGeo.features.length} industrial zones assigned`);

  // 11. River stations - nearest station per ward centroid (haversine)
  console.log("Processing river stations...");
  const riverQuality = JSON.parse(
    readFileSync(resolve(root, "public/data/river-quality.json"), "utf8")
  );

  const stations: Array<{ id: string; riverId: string; coord: Coord }> = [];
  for (const river of riverQuality.rivers) {
    for (const station of river.stations) {
      stations.push({
        id: station.id,
        riverId: river.id,
        coord: { lat: station.lat, lng: station.lng },
      });
    }
  }

  // Map ward -> nearest river info
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
        km: Math.round(bestDist * 10) / 10,
      });
    }
  }

  // 12. Build output
  console.log("Building output...");
  const output: WardProfile[] = [];

  for (const w of wards) {
    const p = profiles.get(w.ward_number)!;
    const river = wardRivers.get(w.ward_number);

    // Top 3 bodies: sort by score desc, then name asc for ties
    const topBodies = p.topBodies
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, 3)
      .map((b) => ({ name: b.name, score: b.score, level: b.level }));

    // Lost body names sorted alphabetically
    const lostNames = [...p.lostNames].sort();

    // Dominant hazard: highest count, alphabetical tie-break
    let dominantHazard: string | null = null;
    let maxCount = 0;
    const sortedCategories = Object.entries(p.hazardByCategory).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    for (const [cat, count] of sortedCategories) {
      if (count > maxCount) {
        maxCount = count;
        dominantHazard = cat;
      }
    }

    // Ward area in sq km from polygon geometry
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
      flood: {
        hazard_zone_count: p.hazardZoneCount,
        by_category: Object.fromEntries(sortedCategories),
        dominant_hazard: dominantHazard,
        hotspot_2015_count: p.hotspot2015Count,
        hotspot_2020_count: p.hotspot2020Count,
      },
      drainage: {
        line_count: p.drainageCount,
        total_length_km: roundTo(p.drainageLengthKm, 6),
      },
      sewerage: {
        stp_count: p.stpCount,
        sps_count: p.spsCount,
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
    });
  }

  // NVDM v1 wrapped form (schemas/nvdm/ward-profiles.schema.json): envelope +
  // wards[]. Loaders accept both shapes during migration. PRODUCED_AT is a
  // manual constant, bumped on regeneration, so identical inputs still
  // produce byte-identical output (no wall-clock in the artifact - the CI
  // determinism gate reruns this script and diffs the file).
  const PRODUCED_AT = "2026-07-30";
  const wrapped = {
    nvdm: "1.0",
    dataset: "data-root/ward-profiles",
    scope: { kind: "city", id: "chennai" },
    provenance: {
      sources: [
        {
          id: "osm-overpass",
          title: "OpenStreetMap water bodies / industrial zones (Overpass extracts)",
          publisher: "OpenStreetMap contributors",
          license: "ODbL 1.0",
          role: "input",
        },
        {
          id: "opencity-gcc-swd-survey",
          title: "GCC 2023 storm-water-drain survey (via OpenCity)",
          publisher: "Greater Chennai Corporation (via OpenCity)",
          license: "open (per OpenCity dataset page)",
          role: "input",
          as_of: "2023",
        },
        {
          id: "opencity-chennai-flood",
          title: "Chennai flooding data - NCCR C-FLOWS model outputs (via OpenCity)",
          publisher: "OpenCity / NCCR",
          license: "open (per OpenCity dataset page)",
          role: "input",
        },
        {
          id: "opencity-cmwssb-sewerage",
          title: "CMWSSB sewerage network datasets (via OpenCity)",
          publisher: "CMWSSB (via OpenCity)",
          license: "open (per OpenCity dataset page)",
          role: "input",
        },
      ],
      method: "derived",
      produced_at: PRODUCED_AT,
      produced_by: "scripts/compute-ward-profiles.ts",
      note:
        "Deterministic spatial join over committed ward-level layers (see script header). " +
        "Internal artifact inputs carry their own envelopes and are lineage, not sources: " +
        "chennai-wards-2022.geojson (GCC 2022 delimitation geometry; the boundary file's " +
        "own provenance record is still pending), restoration-priority.json, " +
        "river-quality.json, chennai-water-bodies-lost.geojson, " +
        "chennai-flood-2020-hotspots.geojson (closed Cyclone Nivar reference layer).",
    },
    wards: output,
  };
  const outPath = resolve(root, "public/data/ward-profiles.json");
  writeFileSync(outPath, JSON.stringify(wrapped, null, 2));

  // Summary
  const totalWaterBodies = output.reduce((s, w) => s + w.water_bodies.current_count, 0);
  const totalDrainageSegments = output.reduce((s, w) => s + w.drainage.line_count, 0);
  const totalDrainageLengthKm = output.reduce((s, w) => s + w.drainage.total_length_km, 0);
  const totalSewerage = output.reduce(
    (s, w) => s + w.sewerage.stp_count + w.sewerage.sps_count + w.sewerage.pumping_main_count,
    0
  );
  const totalPumpingMainLengthKm = output.reduce(
    (s, w) => s + w.sewerage.pumping_main_length_km,
    0,
  );

  console.log(`\nWard profiles written to ${outPath}`);
  console.log(`  ${output.length} wards profiled`);
  console.log(`  Water bodies: ${totalWaterBodies} assigned`);
  console.log(`  Drainage lines: ${totalDrainageSegments} midpoint assignments, ${Math.round(totalDrainageLengthKm)} km apportioned`);
  console.log(`  Sewerage features: ${totalSewerage} assigned, ${Math.round(totalPumpingMainLengthKm)} km pumping mains apportioned`);
}

main();
