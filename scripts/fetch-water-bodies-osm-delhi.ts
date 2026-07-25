/**
 * One-time script: Fetch Delhi (NCT) water bodies from OpenStreetMap via
 * Overpass. Saves GeoJSON to public/geojson/delhi-water-bodies-current.geojson
 *
 * Run: npx tsx scripts/fetch-water-bodies-osm-delhi.ts
 *
 * Clone of the Bangalore fetcher (osmtogeojson assembly, drain/wastewater
 * exclusion, 0.1 ha floor). BBOX is the NCT extent from the Delhi audit -
 * it already contains the remnant Najafgarh Jheel on the Delhi-Haryana
 * border (~28.5 N, 76.9 E), Bhalswa, Sanjay Lake, Hauz Khas tank and the
 * Yamuna floodplain ox-bows. The 893-body Jal Dharohar census layer
 * (OpenCity KML) is a separate file; this OSM layer is the polygon base
 * the census points join onto.
 *
 * Captures Hindi (name:hi) names alongside English - Delhi copy uses
 * Hindi/Urdu glosses (talab / hauz / baoli / jheel) where TN cities use
 * Tamil, per the Origins style guide.
 */

import { writeFileSync } from "fs";
import { join } from "path";
import osmtogeojson from "osmtogeojson";

// NCT Delhi bbox per src/lib/cities/delhi.ts. [south, west, north, east]
const BBOX = "28.40,76.85,28.90,77.40";

// Delhi centroid latitude (~28.65 N) for the deg^2 -> m^2 conversion in
// polygonAreaHa.
const REF_LAT_DEG = 28.65;

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Note: no `>;` (recurse-down) - osmtogeojson needs full geometry, which
// "out body geom;" provides without pulling in unrelated nodes/ways that
// aren't members.
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
  name_hi: string;
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
  console.log("Querying Overpass API for Delhi water bodies...");

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "neer-vazhvu/delhi-onboarding (https://neervazhvu.org; civic water dashboard)",
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

  // Delhi's 3,700-km engineered drain network is tagged water=drain /
  // water=wastewater in OSM. Conveyance infrastructure is the flood-risk
  // page's layer, not a water body; excluding it here matters even more
  // for Delhi than Bangalore.
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
        name_hi: tags["name:hi"] || "",
        water_type,
        area_ha,
      },
    });
  }

  console.log(`Converted ${features.length} polygon features`);
  console.log(
    `  named=${features.filter((f) => f.properties.name).length} ` +
    `unnamed=${features.filter((f) => !f.properties.name).length} ` +
    `hindi_named=${features.filter((f) => f.properties.name_hi).length} ` +
    `skipped_non_polygon=${skippedNonPolygon} skipped_tiny=${skippedTiny} ` +
    `skipped_drain_or_wastewater=${skippedDrain}`,
  );

  const geojson: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: features as unknown as GeoJSON.Feature[],
  };

  const outPath = join(process.cwd(), "public/geojson/delhi-water-bodies-current.geojson");
  writeFileSync(outPath, JSON.stringify(geojson, null, 2));
  console.log(`\nSaved ${features.length} features to ${outPath}`);

  const totalAreaHa = features.reduce((sum, f) => sum + (f.properties.area_ha || 0), 0);
  console.log(`Total water surface area: ~${Math.round(totalAreaHa).toLocaleString()} ha`);

  // Size breakdown - useful for spotting the flagship bodies (Najafgarh
  // Jheel remnant, Bhalswa, Sanjay Lake, Hauz Khas, Naini, Yamuna ox-bows,
  // Okhla barrage pond).
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
