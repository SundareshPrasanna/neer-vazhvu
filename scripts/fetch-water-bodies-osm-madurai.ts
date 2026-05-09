/**
 * One-time script: Fetch Madurai water bodies from OpenStreetMap via Overpass.
 * Saves GeoJSON to public/geojson/madurai-water-bodies-current.geojson
 *
 * Run: npx tsx scripts/fetch-water-bodies-osm-madurai.ts
 *
 * Uses the osmtogeojson library to assemble OSM ways and multipolygon
 * relations into proper GeoJSON. Hand-rolled OSM-to-GeoJSON (as the
 * Chennai script does) gets multipolygon outer-ring chaining wrong and
 * emits dam walls / disconnected rings as separate "weird shape"
 * polygons. M4 will eventually fold both fetchers into a single
 * place-aware script using this same library.
 */

import { writeFileSync, promises as fsAsync } from "fs";
import { join } from "path";
import osmtogeojson from "osmtogeojson";

// Madurai bbox - expanded past MMC. [south, west, north, east]
const BBOX = "9.5,77.4,10.2,78.4";

// Madurai latitude (~9.93N) for the deg² -> m² conversion in
// computePolygonAreaHa. The original Chennai script uses 13°N.
const REF_LAT_DEG = 9.93;

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Note: no `>;` (recurse-down) here. osmtogeojson needs full geometry,
// which "out body geom;" provides without pulling in unrelated nodes/ways
// that aren't members. This avoids the dam-wall / TIGER-roads pollution
// the previous query produced.
const QUERY = `
[out:json][timeout:90];
(
  way["natural"="water"](${BBOX});
  relation["natural"="water"]["type"="multipolygon"](${BBOX});
  way["water"~"lake|reservoir|pond|tank"](${BBOX});
  way["landuse"="reservoir"](${BBOX});
);
out body geom;
`.trim();

interface OutputProperties {
  osm_id: number;
  osm_type: string;
  name: string;
  name_ta: string;
  water_type: string;
  area_ha: number;
}

interface OutputFeature {
  type: "Feature";
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  properties: OutputProperties;
}

function ringAreaHa(ring: number[][]): number {
  // Shoelace area in degrees², converted to ha at the reference latitude.
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    area += ring[i][0] * ring[i + 1][1];
    area -= ring[i + 1][0] * ring[i][1];
  }
  area = Math.abs(area) / 2;
  const m2 = area * 111320 * 111320 * Math.cos((REF_LAT_DEG * Math.PI) / 180);
  return m2 / 10000;
}

function polygonAreaHa(geom: GeoJSON.Polygon | GeoJSON.MultiPolygon): number {
  if (geom.type === "Polygon") {
    if (geom.coordinates.length === 0) return 0;
    // Outer ring minus inner rings (holes).
    let total = ringAreaHa(geom.coordinates[0]);
    for (let i = 1; i < geom.coordinates.length; i++) total -= ringAreaHa(geom.coordinates[i]);
    return Math.max(0, total);
  }
  let total = 0;
  for (const poly of geom.coordinates) {
    if (poly.length === 0) continue;
    let p = ringAreaHa(poly[0]);
    for (let i = 1; i < poly.length; i++) p -= ringAreaHa(poly[i]);
    total += Math.max(0, p);
  }
  return total;
}

function parseOsmFeatureId(rawId: string): { type: string; id: number } | null {
  // osmtogeojson sets feature.id like "way/12345" or "relation/67890".
  const m = rawId.match(/^(node|way|relation)\/(\d+)$/);
  if (!m) return null;
  return { type: m[1], id: Number(m[2]) };
}

interface RiverFile {
  features: Array<{
    geometry: GeoJSON.LineString | GeoJSON.MultiLineString;
    properties: { name?: string; name_ta?: string };
  }>;
}

async function labelRiverPolygons(features: OutputFeature[]): Promise<void> {
  const riversPath = join(process.cwd(), "public/geojson/madurai-rivers.geojson");
  let riversFile: RiverFile;
  try {
    riversFile = JSON.parse(await fsAsync.readFile(riversPath, "utf-8")) as RiverFile;
  } catch {
    console.warn(`  (river-name post-process skipped: ${riversPath} not found)`);
    return;
  }

  interface RiverPoint { lat: number; lng: number; name: string; name_ta: string }
  const riverPoints: RiverPoint[] = [];
  for (const feat of riversFile.features) {
    const name = feat.properties.name ?? "";
    const name_ta = feat.properties.name_ta ?? "";
    if (!name) continue;
    const lines: number[][][] =
      feat.geometry.type === "LineString" ? [feat.geometry.coordinates] : feat.geometry.coordinates;
    for (const line of lines) {
      for (const [lng, lat] of line) {
        riverPoints.push({ lat, lng, name, name_ta });
      }
    }
  }
  if (riverPoints.length === 0) {
    console.warn("  (river-name post-process: no usable river points)");
    return;
  }

  const haversineM = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dlat = toRad(lat2 - lat1);
    const dlng = toRad(lng2 - lng1);
    const a =
      Math.sin(dlat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dlng / 2) ** 2;
    return 6371000 * 2 * Math.asin(Math.sqrt(a));
  };

  let labeled = 0;
  for (const f of features) {
    const p = f.properties;
    if (p.name) continue;
    if (p.water_type !== "river") continue;
    const coords =
      f.geometry.type === "Polygon"
        ? f.geometry.coordinates[0]
        : f.geometry.coordinates[0][0];
    if (!coords || coords.length === 0) continue;
    let latSum = 0;
    let lngSum = 0;
    for (const [lng, lat] of coords) {
      latSum += lat;
      lngSum += lng;
    }
    const cLat = latSum / coords.length;
    const cLng = lngSum / coords.length;
    let bestDist = Infinity;
    let bestName = "";
    let bestNameTa = "";
    for (const rp of riverPoints) {
      const d = haversineM(cLat, cLng, rp.lat, rp.lng);
      if (d < bestDist) {
        bestDist = d;
        bestName = rp.name;
        bestNameTa = rp.name_ta;
      }
    }
    if (bestName) {
      p.name = bestName;
      p.name_ta = bestNameTa;
      labeled++;
    }
  }
  console.log(`  river-name post-process: labelled ${labeled} unnamed water_type=river polygons`);
}

async function main() {
  console.log("Querying Overpass API for Madurai water bodies...");

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "neer-vazhvu/madurai-onboarding (https://neervazhvu.org; civic water dashboard)",
    },
    body: `data=${encodeURIComponent(QUERY)}`,
  });
  if (!res.ok) {
    throw new Error(`Overpass returned ${res.status}: ${await res.text()}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overpassJson = (await res.json()) as any;
  console.log(`Got ${overpassJson.elements?.length ?? 0} OSM elements`);

  // osmtogeojson handles all the multipolygon assembly correctly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = osmtogeojson(overpassJson) as any;
  const rawFeatures = (raw.features ?? []) as Array<{
    type: "Feature";
    id?: string;
    geometry: GeoJSON.Geometry;
    properties: Record<string, string> | null;
  }>;

  let skippedNonPolygon = 0;
  let skippedTiny = 0;

  const features: OutputFeature[] = [];
  for (const f of rawFeatures) {
    const geom = f.geometry;
    if (geom.type !== "Polygon" && geom.type !== "MultiPolygon") {
      skippedNonPolygon++;
      continue;
    }
    const tags = f.properties ?? {};
    const water_type = tags["water"] || tags["natural"] || tags["landuse"] || "water";
    const area_ha = Math.round(polygonAreaHa(geom) * 100) / 100;
    if (area_ha < 0.1) {
      skippedTiny++;
      continue;
    }
    const idInfo = f.id ? parseOsmFeatureId(f.id) : null;
    features.push({
      type: "Feature",
      geometry: geom,
      properties: {
        osm_id: idInfo?.id ?? -1,
        osm_type: idInfo?.type ?? "",
        name: tags["name"] || tags["name:en"] || "",
        name_ta: tags["name:ta"] || "",
        water_type,
        area_ha,
      },
    });
  }

  console.log(`Converted ${features.length} polygon features`);
  console.log(
    `  named=${features.filter((f) => f.properties.name).length} ` +
    `unnamed=${features.filter((f) => !f.properties.name).length} ` +
    `skipped_non_polygon=${skippedNonPolygon} skipped_tiny=${skippedTiny}`,
  );

  await labelRiverPolygons(features);

  const geojson: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: features as unknown as GeoJSON.Feature[],
  };

  const outPath = join(process.cwd(), "public/geojson/madurai-water-bodies-current.geojson");
  writeFileSync(outPath, JSON.stringify(geojson, null, 2));
  console.log(`\nSaved ${features.length} features to ${outPath}`);

  const totalAreaHa = features.reduce((sum, f) => sum + (f.properties.area_ha || 0), 0);
  console.log(`Total water surface area: ~${Math.round(totalAreaHa).toLocaleString()} ha`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
