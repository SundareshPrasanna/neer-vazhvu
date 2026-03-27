/**
 * One-time script: Fetch Chennai drainage network from OpenStreetMap via Overpass API.
 *
 * Queries waterway=drain, waterway=canal, waterway=ditch within the Chennai bounding box.
 * Each OSM way becomes a LineString feature with osm_id, name, and waterway_type properties.
 *
 * Run: npx tsx scripts/fetch-drainage-osm.ts
 * Output: public/geojson/chennai-drainage.geojson
 */

import { writeFileSync } from "fs";
import { join } from "path";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Chennai bounding box [south, west, north, east]
const BBOX = "12.75,80.0,13.35,80.35";

const QUERY = `
[out:json][timeout:120];
(
  way["waterway"="drain"](${BBOX});
  way["waterway"="canal"](${BBOX});
  way["waterway"="ditch"](${BBOX});
);
out body;
>;
out skel qt;
`.trim();

interface OsmNode {
  id: number;
  lat: number;
  lon: number;
}

interface OsmElement {
  type: "node" | "way";
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
}

interface DrainageFeature {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: number[][];
  };
  properties: {
    osm_id: number;
    name: string | null;
    waterway_type: string;
  };
}

async function fetchOverpass(): Promise<OsmElement[]> {
  console.log("Querying Overpass API for drainage network...");
  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(QUERY)}`,
  });

  if (!response.ok) {
    throw new Error(
      `Overpass API error: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as { elements: OsmElement[] };
  console.log(`Received ${data.elements.length} elements from Overpass`);
  return data.elements;
}

function buildGeoJSON(elements: OsmElement[]): DrainageFeature[] {
  // Build node lookup
  const nodeMap = new Map<number, OsmNode>();
  for (const el of elements) {
    if (el.type === "node" && el.lat !== undefined && el.lon !== undefined) {
      nodeMap.set(el.id, { id: el.id, lat: el.lat, lon: el.lon });
    }
  }

  const features: DrainageFeature[] = [];

  for (const el of elements) {
    if (el.type !== "way" || !el.nodes || !el.tags) continue;

    const waterwayType = el.tags.waterway;
    if (!waterwayType || !["drain", "canal", "ditch"].includes(waterwayType))
      continue;

    // Resolve node coordinates
    const coords = el.nodes
      .map((nid) => nodeMap.get(nid))
      .filter((n): n is OsmNode => n !== undefined)
      .map((n) => [n.lon, n.lat]);

    if (coords.length < 2) continue;

    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: coords,
      },
      properties: {
        osm_id: el.id,
        name: el.tags.name || el.tags["name:en"] || null,
        waterway_type: waterwayType,
      },
    });
  }

  return features;
}

async function main() {
  const elements = await fetchOverpass();
  const features = buildGeoJSON(elements);

  if (features.length === 0) {
    console.error(
      "No drainage features found - check the Overpass query or bounding box"
    );
    process.exit(1);
  }

  // Count by type
  const counts: Record<string, number> = {};
  for (const f of features) {
    const t = f.properties.waterway_type;
    counts[t] = (counts[t] || 0) + 1;
  }

  const geojson = {
    type: "FeatureCollection",
    features,
  };

  const outPath = join(
    process.cwd(),
    "public/geojson/chennai-drainage.geojson"
  );
  const jsonStr = JSON.stringify(geojson, null, 2);
  writeFileSync(outPath, jsonStr);

  const fileSizeKb = Math.round(Buffer.byteLength(jsonStr) / 1024);

  console.log(
    `\nWrote ${features.length} drainage features to public/geojson/chennai-drainage.geojson`
  );
  console.log(`File size: ${fileSizeKb} KB`);
  console.log("Counts by type:");
  for (const [type, count] of Object.entries(counts).sort()) {
    console.log(`  ${type}: ${count}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
