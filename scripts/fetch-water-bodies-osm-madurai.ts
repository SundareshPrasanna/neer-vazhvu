/**
 * One-time script: Fetch Madurai water bodies from OpenStreetMap via Overpass.
 * Saves GeoJSON to public/geojson/madurai-water-bodies-current.geojson
 *
 * Run: npx tsx scripts/fetch-water-bodies-osm-madurai.ts
 *
 * Mirror of fetch-water-bodies-osm.ts; M4 will fold both into a place-aware
 * script. Bbox expanded past MMC to capture peri-urban tanks (Anaikondan,
 * Tirumangalam) and Theni-side dams (Vaigai, Sothuparai, Manjalar).
 */

import { writeFileSync } from "fs";
import { join } from "path";

// Madurai bbox - expanded past MMC. [south, west, north, east]
const BBOX = "9.5,77.4,10.2,78.4";

// Madurai latitude (~9.93N) for the deg² -> m² conversion in computePolygonAreaHa.
const REF_LAT_DEG = 9.93;

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

const QUERY = `
[out:json][timeout:90];
(
  way["natural"="water"](${BBOX});
  relation["natural"="water"]["type"="multipolygon"](${BBOX});
  way["water"~"lake|reservoir|pond|tank"](${BBOX});
  way["landuse"="reservoir"](${BBOX});
);
out body;
>;
out skel qt;
`.trim();

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

interface OsmResponse {
  elements: OsmElement[];
}

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
    name_ta: string;
    water_type: string;
    area_ha: number | null;
  };
}

interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

function computePolygonAreaHa(coords: number[][]): number {
  // Shoelace formula for approximate area in degrees², then convert to ha
  let area = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    area += coords[i][0] * coords[i + 1][1];
    area -= coords[i + 1][0] * coords[i][1];
  }
  area = Math.abs(area) / 2;
  // 1 degree² in m² at the reference latitude.
  const m2 = area * 111320 * 111320 * Math.cos((REF_LAT_DEG * Math.PI) / 180);
  return Math.round((m2 / 10000) * 100) / 100;
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

  const osm: OsmResponse = await res.json();
  console.log(`Got ${osm.elements.length} OSM elements`);

  // Build node lookup map
  const nodeMap = new Map<number, OsmNode>();
  for (const el of osm.elements) {
    if (el.type === "node") nodeMap.set(el.id, el);
  }

  const features: GeoJsonFeature[] = [];

  for (const el of osm.elements) {
    if (el.type !== "way" && el.type !== "relation") continue;

    const tags = el.tags || {};
    const name = tags["name"] || tags["name:en"] || "";
    const name_ta = tags["name:ta"] || "";
    const water_type =
      tags["water"] || tags["natural"] || tags["landuse"] || "water";

    if (el.type === "way") {
      const nodeIds = el.nodes;
      if (nodeIds.length < 4) continue; // Not a closed polygon

      const coords: number[][] = nodeIds
        .map((id) => {
          const n = nodeMap.get(id);
          return n ? [n.lon, n.lat] : null;
        })
        .filter((c): c is number[] => c !== null);

      if (coords.length < 4) continue;

      // Ensure closed ring
      if (
        coords[0][0] !== coords[coords.length - 1][0] ||
        coords[0][1] !== coords[coords.length - 1][1]
      ) {
        coords.push(coords[0]);
      }

      const area_ha = computePolygonAreaHa(coords);

      // Skip very tiny features (< 0.1 ha = 1000 m²)
      if (area_ha < 0.1) continue;

      features.push({
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [coords] },
        properties: { osm_id: el.id, osm_type: "way", name, name_ta, water_type, area_ha },
      });
    }

    // Relations (multipolygons) — use outer members
    if (el.type === "relation") {
      const outerRings: number[][][] = [];

      for (const member of el.members) {
        if (member.type !== "way" || member.role !== "outer") continue;
        // Find way in elements
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
        if (
          coords[0][0] !== coords[coords.length - 1][0] ||
          coords[0][1] !== coords[coords.length - 1][1]
        ) {
          coords.push(coords[0]);
        }
        outerRings.push(coords);
      }

      if (outerRings.length === 0) continue;

      const area_ha = outerRings.reduce(
        (sum, ring) => sum + computePolygonAreaHa(ring),
        0
      );
      if (area_ha < 0.1) continue;

      features.push({
        type: "Feature",
        geometry: {
          type: "MultiPolygon",
          coordinates: outerRings.map((ring) => [ring]) as number[][][][],
        },
        properties: {
          osm_id: el.id,
          osm_type: "relation",
          name,
          name_ta,
          water_type,
          area_ha: Math.round(area_ha * 100) / 100,
        },
      });
    }
  }

  console.log(`Converted ${features.length} polygon features`);
  console.log(
    `Named: ${features.filter((f) => f.properties.name).length} / Unnamed: ${features.filter((f) => !f.properties.name).length}`
  );

  const geojson: GeoJsonFeatureCollection = {
    type: "FeatureCollection",
    features,
  };

  const outPath = join(
    process.cwd(),
    "public/geojson/madurai-water-bodies-current.geojson"
  );
  writeFileSync(outPath, JSON.stringify(geojson, null, 2));
  console.log(`\nSaved ${features.length} features to ${outPath}`);

  // Summary stats
  const totalAreaHa = features.reduce(
    (sum, f) => sum + (f.properties.area_ha || 0),
    0
  );
  console.log(`Total water surface area: ~${Math.round(totalAreaHa).toLocaleString()} ha`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
