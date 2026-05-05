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

interface RiverFeatureProperties {
  name?: string;
  name_ta?: string;
}

interface RiverFeature {
  geometry: GeoJSON.LineString | GeoJSON.MultiLineString;
  properties: RiverFeatureProperties;
}

interface RiverFile {
  features: RiverFeature[];
}

async function labelRiverPolygons(features: GeoJsonFeature[]): Promise<void> {
  const { promises: fsAsync } = await import("fs");
  const riversPath = join(process.cwd(), "public/geojson/madurai-rivers.geojson");
  let riversFile: RiverFile;
  try {
    riversFile = JSON.parse(await fsAsync.readFile(riversPath, "utf-8")) as RiverFile;
  } catch (e) {
    console.warn(`  (river-name post-process skipped: ${riversPath} not found - run fetch-rivers-osm-madurai.ts first)`);
    return;
  }

  // Sample river vertices into a flat array of {lat, lng, name, name_ta}.
  // No subsampling - we want the densest possible points for the matching.
  interface RiverPoint { lat: number; lng: number; name: string; name_ta: string }
  const riverPoints: RiverPoint[] = [];
  for (const feat of riversFile.features) {
    const name = feat.properties.name ?? "";
    const name_ta = feat.properties.name_ta ?? "";
    if (!name) continue;
    const lines: number[][][] =
      feat.geometry.type === "LineString"
        ? [feat.geometry.coordinates]
        : feat.geometry.coordinates;
    for (const line of lines) {
      for (const [lng, lat] of line) {
        riverPoints.push({ lat, lng, name, name_ta });
      }
    }
  }

  if (riverPoints.length === 0) {
    console.warn("  (river-name post-process: no usable river points found)");
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
    if (p.name) continue; // already named
    if (p.water_type !== "river") continue; // only river polygons

    // Compute centroid of outer ring.
    const coords =
      f.geometry.type === "Polygon"
        ? (f.geometry.coordinates as number[][][])[0]
        : (f.geometry.coordinates as number[][][][])[0][0];
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
    // No threshold: water_type=river polygons are river beds by definition,
    // and we just want to know which river. Centroid-to-nearest-vertex match
    // is correct unless rivers cross (they don't in our data).
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

  const osm: OsmResponse = await res.json();
  console.log(`Got ${osm.elements.length} OSM elements`);

  // Build node lookup map
  const nodeMap = new Map<number, OsmNode>();
  for (const el of osm.elements) {
    if (el.type === "node") nodeMap.set(el.id, el);
  }

  // Track way IDs that are members of a water multipolygon relation. Those
  // ways are emitted as part of the parent relation, not as standalone
  // polygons - skipping them avoids double-rendering and the long thin
  // dam-wall / inner-ring artifacts the original script produced.
  const memberWayIds = new Set<number>();
  for (const el of osm.elements) {
    if (el.type !== "relation") continue;
    if (el.tags?.["natural"] !== "water") continue;
    for (const m of el.members ?? []) {
      if (m.type === "way") memberWayIds.add(m.ref);
    }
  }

  function isWaterTaggedWay(tags: Record<string, string>): boolean {
    if (tags["natural"] === "water") return true;
    const water = tags["water"];
    if (water && ["lake", "reservoir", "pond", "tank"].includes(water)) return true;
    if (tags["landuse"] === "reservoir") return true;
    return false;
  }

  const features: GeoJsonFeature[] = [];
  let skippedNonWater = 0;
  let skippedRelationMember = 0;

  for (const el of osm.elements) {
    if (el.type !== "way" && el.type !== "relation") continue;

    const tags = el.tags || {};
    const name = tags["name"] || tags["name:en"] || "";
    const name_ta = tags["name:ta"] || "";
    const water_type =
      tags["water"] || tags["natural"] || tags["landuse"] || "water";

    if (el.type === "way") {
      // Skip if this way is a member of a water multipolygon - the relation
      // emits the geometry. Without this guard we double-render and pick up
      // dam-wall / inner-ring ways too.
      if (memberWayIds.has(el.id)) {
        skippedRelationMember++;
        continue;
      }
      // Skip ways that aren't themselves water-tagged. The Overpass query
      // also returns the union of relation member nodes/ways so untagged
      // ways and dam walls (waterway=dam, etc.) sneak in.
      if (!isWaterTaggedWay(tags)) {
        skippedNonWater++;
        continue;
      }

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
    `  named=${features.filter((f) => f.properties.name).length} ` +
    `unnamed=${features.filter((f) => !f.properties.name).length} ` +
    `skipped_non_water_ways=${skippedNonWater} ` +
    `skipped_relation_members=${skippedRelationMember}`,
  );

  // Post-process: water_type=river polygons (riverbeds) have no `name` tag in
  // OSM because the name lives on the waterway=river LINESTRING, not the
  // natural=water POLYGON. The shared UnifiedMap component does a 500m
  // proximity match, but for wide rivers like Vaigai the linestring follows
  // the thalweg while the polygon centroid sits in the broad floodplain -
  // routinely outside 500m. We bake the river name directly into the
  // polygon property here using a no-threshold "nearest river" match
  // restricted to water_type=river polygons.
  await labelRiverPolygons(features);

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
