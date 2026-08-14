/**
 * One-time script: Fetch Hyderabad (Core Urban Region) water bodies from OpenStreetMap via
 * Overpass. Saves GeoJSON to public/geojson/hyderabad-water-bodies-current.geojson
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
import { writeArtifact } from "./lib/nvdm-write";

// Core Urban Region bbox per src/lib/cities/hyderabad.ts. [south, west, north, east]
const BBOX = "17.15,78.10,17.70,78.75";

// Hyderabad centroid latitude (~17.43 N) for the deg^2 -> m^2 conversion in
// polygonAreaHa. Matters more here than in Delhi: cos(17.43) = 0.954 vs
// cos(28.65) = 0.878, so reusing Delhi's constant would undercount area ~8%.
const REF_LAT_DEG = 17.43;

// Overpass rate-limits and 504s under load - the pan-India playbook calls
// this out and the Delhi/Bangalore originals do not handle it. Try the
// mirrors in turn with backoff, and allow an env override.
const OVERPASS_ENDPOINTS = process.env.OVERPASS_URL
  ? [process.env.OVERPASS_URL]
  : [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
      "https://overpass.osm.jp/api/interpreter",
    ];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function queryOverpass(query: string): Promise<unknown> {
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of OVERPASS_ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent":
              "neer-vazhvu/hyderabad-onboarding (https://neervazhvu.org; civic water dashboard)",
          },
          body: `data=${encodeURIComponent(query)}`,
        });
        if (res.ok) {
          const json = await res.json();
          console.log(`  (via ${new URL(url).host}, attempt ${attempt + 1})`);
          return json;
        }
        lastErr = `${new URL(url).host} -> HTTP ${res.status}`;
        console.log(`  ${lastErr}, trying next...`);
      } catch (e) {
        lastErr = `${new URL(url).host} -> ${String(e).slice(0, 80)}`;
        console.log(`  ${lastErr}, trying next...`);
      }
    }
    const backoff = 15_000 * (attempt + 1);
    console.log(`  all endpoints failed; backing off ${backoff / 1000}s`);
    await sleep(backoff);
  }
  throw new Error(`Overpass unavailable after retries. Last: ${lastErr}`);
}

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
  name_te: string;
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
  console.log("Querying Overpass for Hyderabad water bodies...");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overpassJson = (await queryOverpass(QUERY)) as any;
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

  // Hyderabad's nala network is tagged water=drain / water=wastewater in
  // OSM. Conveyance infrastructure belongs to the flood-risk page, not the
  // water-bodies layer - and in Hyderabad the distinction is politically
  // loaded, because encroachment cases turn on whether a channel is a nala
  // or a lake bed.
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
        name_te: tags["name:te"] || "",
        water_type,
        area_ha,
      },
    });
  }

  console.log(`Converted ${features.length} polygon features`);
  console.log(
    `  named=${features.filter((f) => f.properties.name).length} ` +
    `unnamed=${features.filter((f) => !f.properties.name).length} ` +
    `telugu_named=${features.filter((f) => f.properties.name_te).length} ` +
    `skipped_non_polygon=${skippedNonPolygon} skipped_tiny=${skippedTiny} ` +
    `skipped_drain_or_wastewater=${skippedDrain}`,
  );

  const geojson: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: features as unknown as GeoJSON.Feature[],
  };

  const outPath = join(process.cwd(), "public/geojson/hyderabad-water-bodies-current.geojson");
  writeArtifact(outPath, geojson as unknown as Record<string, unknown>);
  console.log(`\nSaved ${features.length} features to ${outPath}`);

  const totalAreaHa = features.reduce((sum, f) => sum + (f.properties.area_ha || 0), 0);
  console.log(`Total water surface area: ~${Math.round(totalAreaHa).toLocaleString()} ha`);

  // Size breakdown - useful for spotting the flagship bodies (Osman Sagar,
  // Himayat Sagar, Hussain Sagar, Shamirpet, Durgam Cheruvu, and the large
  // Serilingampally/Kukatpally tanks).
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
