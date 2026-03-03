/**
 * One-time script: Fetch industrial zone polygons from OpenStreetMap via Overpass API.
 * Restricted to north Chennai (Ennore-Manali industrial corridor).
 * Filters out parcels smaller than 5 ha to keep only major industrial estates.
 *
 * Run: npx tsx scripts/fetch-industrial-zones-osm.ts
 * Output: public/geojson/chennai-industrial-zones.geojson
 */

import { writeFileSync } from "fs";
import { join } from "path";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// North Chennai only — captures Ennore, Manali, Ambattur corridors
// [south, west, north, east]
const BBOX = "13.0,80.1,13.4,80.4";

const QUERY = `
[out:json][timeout:90];
(
  way["landuse"="industrial"](${BBOX});
  relation["landuse"="industrial"]["type"="multipolygon"](${BBOX});
);
out body;
>;
out skel qt;
`.trim();

const MIN_AREA_HA = 5; // Exclude tiny parcels

interface OsmNode {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

interface OsmWay {
  type: "way";
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}

interface OsmRelation {
  type: "relation";
  id: number;
  members: Array<{ type: string; ref: number; role: string }>;
  tags?: Record<string, string>;
}

type OsmElement = OsmNode | OsmWay | OsmRelation;

interface GeoJsonFeature {
  type: "Feature";
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
  properties: {
    osm_id: number;
    osm_type: string;
    name: string;
    area_ha: number;
  };
}

function computePolygonAreaHa(coords: number[][]): number {
  // Shoelace formula → degrees² → hectares at Chennai latitude (13°N)
  let area = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    area += coords[i][0] * coords[i + 1][1];
    area -= coords[i + 1][0] * coords[i][1];
  }
  area = Math.abs(area) / 2;
  const m2 = area * 111320 * 111320 * Math.cos((13 * Math.PI) / 180);
  return Math.round((m2 / 10000) * 100) / 100;
}

function closedRing(coords: number[][]): number[][] {
  if (
    coords[0][0] !== coords[coords.length - 1][0] ||
    coords[0][1] !== coords[coords.length - 1][1]
  ) {
    return [...coords, coords[0]];
  }
  return coords;
}

async function main() {
  console.log("Querying Overpass API for Chennai industrial zones...");

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(QUERY)}`,
  });

  if (!res.ok) {
    throw new Error(`Overpass returned ${res.status}: ${await res.text()}`);
  }

  const osm: { elements: OsmElement[] } = await res.json();
  console.log(`Got ${osm.elements.length} OSM elements`);

  // Build node lookup
  const nodeMap = new Map<number, OsmNode>();
  for (const el of osm.elements) {
    if (el.type === "node") nodeMap.set(el.id, el);
  }

  const features: GeoJsonFeature[] = [];

  for (const el of osm.elements) {
    if (el.type !== "way" && el.type !== "relation") continue;

    const tags = el.tags || {};
    const name = tags["name"] || tags["name:en"] || "";

    if (el.type === "way") {
      if (el.nodes.length < 4) continue;

      const coords: number[][] = el.nodes
        .map((id) => {
          const n = nodeMap.get(id);
          return n ? [n.lon, n.lat] : null;
        })
        .filter((c): c is number[] => c !== null);

      if (coords.length < 4) continue;

      const ring = closedRing(coords);
      const area_ha = computePolygonAreaHa(ring);
      if (area_ha < MIN_AREA_HA) continue;

      features.push({
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [ring] },
        properties: { osm_id: el.id, osm_type: "way", name, area_ha },
      });
    }

    if (el.type === "relation") {
      const outerRings: number[][][] = [];

      for (const member of el.members) {
        if (member.type !== "way" || member.role !== "outer") continue;
        const way = osm.elements.find(
          (e) => e.type === "way" && e.id === member.ref
        ) as OsmWay | undefined;
        if (!way) continue;

        const coords: number[][] = way.nodes
          .map((id) => {
            const n = nodeMap.get(id);
            return n ? [n.lon, n.lat] : null;
          })
          .filter((c): c is number[] => c !== null);

        if (coords.length < 4) continue;
        outerRings.push(closedRing(coords));
      }

      if (outerRings.length === 0) continue;

      const area_ha = Math.round(
        outerRings.reduce((sum, ring) => sum + computePolygonAreaHa(ring), 0) * 100
      ) / 100;
      if (area_ha < MIN_AREA_HA) continue;

      features.push({
        type: "Feature",
        geometry: {
          type: "MultiPolygon",
          coordinates: outerRings.map((ring) => [ring]) as number[][][][],
        },
        properties: { osm_id: el.id, osm_type: "relation", name, area_ha },
      });
    }
  }

  console.log(`Converted ${features.length} industrial zone features (≥ ${MIN_AREA_HA} ha)`);
  console.log(
    `Named: ${features.filter((f) => f.properties.name).length} / Unnamed: ${features.filter((f) => !f.properties.name).length}`
  );

  const geojson = { type: "FeatureCollection", features };

  const outPath = join(process.cwd(), "public/geojson/chennai-industrial-zones.geojson");
  writeFileSync(outPath, JSON.stringify(geojson, null, 2));

  console.log(`\nSaved to ${outPath}`);
  const totalAreaHa = features.reduce((sum, f) => sum + f.properties.area_ha, 0);
  console.log(`Total industrial area: ~${Math.round(totalAreaHa).toLocaleString()} ha`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
