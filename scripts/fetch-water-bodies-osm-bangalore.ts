/**
 * One-time script: Fetch Bangalore water bodies from OpenStreetMap via Overpass.
 * Saves GeoJSON to public/geojson/bangalore-water-bodies-current.geojson
 *
 * Run: npx tsx scripts/fetch-water-bodies-osm-bangalore.ts
 *
 * Uses osmtogeojson to assemble OSM ways + multipolygon relations correctly
 * (matching the Madurai fetcher; the older Chennai script's hand-rolled
 * multipolygon chaining mishandles dam walls and outer-ring assembly).
 *
 * BBOX is wider than the GBA 369-ward bbox (which only covers 12.83-13.18 N,
 * 77.40-77.78 E) - we extend south into Anekal and north into rural Bangalore
 * Urban so the census's 718 bodies have full coverage. The /bangalore
 * frontend can still spatially-clip to GBA when rendering ward-level views.
 *
 * Captures Kannada (name:kn) names alongside English. Per neervazhvu's
 * regional-glosses pattern, Bangalore copy uses Kannada glosses where
 * Madurai/Chennai use Tamil.
 */

import { writeFileSync } from "fs";
import { join } from "path";
import osmtogeojson from "osmtogeojson";

// Wider than the GBA 369-ward bbox: extends south past Anekal, north past
// Yelahanka into Bangalore Rural for the Arkavathi headworks, and west to
// catch TG Halli (Tippagondanahalli / Chamaraja Sagar, BWSSB's 1933
// reservoir, the BWSSB-SUEZ IPR pilot). [south, west, north, east]
const BBOX = "12.65,77.20,13.40,77.90";

// Bangalore centroid latitude (~12.97 N) for the deg^2 -> m^2 conversion in
// polygonAreaHa.
const REF_LAT_DEG = 12.97;

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Note: no `>;` (recurse-down) - osmtogeojson needs full geometry, which
// "out body geom;" provides without pulling in unrelated nodes/ways that
// aren't members. Avoids the dam-wall / TIGER-roads pollution.
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
  name_kn: string;
  water_type: string;
  area_ha: number;
}

interface OutputFeature {
  type: "Feature";
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  properties: OutputProperties;
}

function ringAreaHa(ring: number[][]): number {
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
  const m = rawId.match(/^(node|way|relation)\/(\d+)$/);
  if (!m) return null;
  return { type: m[1], id: Number(m[2]) };
}

async function main() {
  console.log("Querying Overpass API for Bangalore water bodies...");

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "neer-vazhvu/bangalore-onboarding (https://neervazhvu.org; civic water dashboard)",
    },
    body: `data=${encodeURIComponent(QUERY)}`,
  });
  if (!res.ok) {
    throw new Error(`Overpass returned ${res.status}: ${await res.text()}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overpassJson = (await res.json()) as any;
  console.log(`Got ${overpassJson.elements?.length ?? 0} OSM elements`);

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
  let skippedDrain = 0;

  // OSM tags storm drains and sewage channels as natural=water + water=drain,
  // which leaks ~hundreds of pipe segments into the output if we don't
  // filter. These aren't water bodies in any civic-dashboard sense - they
  // are conveyance infrastructure. The /<city>/water-bodies map should
  // show stored water (lakes/tanks/reservoirs), not drains.
  const EXCLUDED_WATER_TYPES = new Set(["drain", "wastewater"]);

  const features: OutputFeature[] = [];
  for (const f of rawFeatures) {
    const geom = f.geometry;
    if (geom.type !== "Polygon" && geom.type !== "MultiPolygon") {
      skippedNonPolygon++;
      continue;
    }
    const tags = f.properties ?? {};
    const water_type = tags["water"] || tags["natural"] || tags["landuse"] || "water";
    if (EXCLUDED_WATER_TYPES.has(water_type)) {
      skippedDrain++;
      continue;
    }
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
        name_kn: tags["name:kn"] || "",
        water_type,
        area_ha,
      },
    });
  }

  console.log(`Converted ${features.length} polygon features`);
  console.log(
    `  named=${features.filter((f) => f.properties.name).length} ` +
    `unnamed=${features.filter((f) => !f.properties.name).length} ` +
    `kannada_named=${features.filter((f) => f.properties.name_kn).length} ` +
    `skipped_non_polygon=${skippedNonPolygon} skipped_tiny=${skippedTiny} ` +
    `skipped_drain_or_wastewater=${skippedDrain}`,
  );

  const geojson: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: features as unknown as GeoJSON.Feature[],
  };

  const outPath = join(process.cwd(), "public/geojson/bangalore-water-bodies-current.geojson");
  writeFileSync(outPath, JSON.stringify(geojson, null, 2));
  console.log(`\nSaved ${features.length} features to ${outPath}`);

  const totalAreaHa = features.reduce((sum, f) => sum + (f.properties.area_ha || 0), 0);
  console.log(`Total water surface area: ~${Math.round(totalAreaHa).toLocaleString()} ha`);

  // Size breakdown - useful for spotting if we got the famous Bangalore
  // lakes (Bellandur, Varthur, Ulsoor, Hebbal, Madivala, Sankey, Jakkur, Agara).
  const top10 = [...features]
    .sort((a, b) => (b.properties.area_ha || 0) - (a.properties.area_ha || 0))
    .slice(0, 10);
  console.log("\nTop 10 by area_ha:");
  for (const f of top10) {
    const name = f.properties.name || "(unnamed)";
    console.log(`  ${f.properties.area_ha.toFixed(2)} ha - ${name}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
