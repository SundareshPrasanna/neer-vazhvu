/**
 * Resolves names for unnamed water bodies in chennai-water-bodies-current.geojson.
 *
 * Strategy:
 * 1. Query Overpass for all *named* water features (nodes + ways + relations) in the
 *    GCC bounding box. In OSM it's common for a water polygon to be unnamed while a
 *    separate named node sits inside it — this step captures those.
 * 2. Point-in-polygon: for each named OSM centroid, find which unnamed polygon
 *    in our GeoJSON contains it and assign its name.
 * 3. Nominatim reverse geocoding fallback for any significant (>= 2 ha) bodies
 *    still unnamed after step 2.
 *
 * Run: npx tsx scripts/resolve-unnamed-water-bodies.ts
 * Writes updated GeoJSON in place.
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
// GCC bounding box only
const BBOX = "12.90,80.09,13.26,80.36";

// Named water features query — nodes with names inside water areas,
// plus named ways/relations that may cover unnamed polygons in our file
const NAMED_QUERY = `
[out:json][timeout:90];
(
  node["name"]["natural"~"^(water|wetland)$"](${BBOX});
  node["name"]["water"](${BBOX});
  node["name"]["place"~"^(sea|lake|reservoir|pond)$"](${BBOX});
  way["name"]["natural"="water"](${BBOX});
  way["name"]["water"](${BBOX});
  relation["name"]["natural"="water"](${BBOX});
  relation["name"]["water"](${BBOX});
);
out center tags;
`.trim();

interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface GeoJsonFeature {
  type: "Feature";
  geometry: {
    type: string;
    coordinates: unknown;
  };
  properties: {
    osm_id: number;
    osm_type: string;
    name: string;
    name_ta: string;
    water_type: string;
    area_ha: number | null;
    [key: string]: unknown;
  };
}

function getCenter(el: OsmElement): [number, number] | null {
  if (el.type === "node" && el.lat != null && el.lon != null) return [el.lon, el.lat];
  if (el.center) return [el.center.lon, el.center.lat];
  return null;
}

function polygonCentroid(geom: GeoJsonFeature["geometry"]): [number, number] {
  let coords: number[][];
  if (geom.type === "Polygon") coords = (geom.coordinates as number[][][])[0];
  else if (geom.type === "MultiPolygon") coords = (geom.coordinates as number[][][][])[0][0];
  else return [0, 0];
  const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  return [lng, lat];
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function nominatimReverse(lat: number, lng: number): Promise<{ name: string; name_ta: string } | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&zoom=17&format=jsonv2&accept-language=en,ta`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "neer-vazhvu/1.0" } });
    if (!res.ok) return null;
    const data = await res.json();
    // Only use if it's a water feature name
    const waterTypes = new Set(["water", "reservoir", "lake", "pond", "wetland", "river", "stream"]);
    const cls = data.category || data.type || "";
    const name = (data.name || data.display_name?.split(",")[0] || "").trim();
    if (waterTypes.has(cls) && name) {
      return { name, name_ta: "" };
    }
    // Also accept if the OSM type points to a natural/water feature
    if ((data.osm_type === "way" || data.osm_type === "relation") && name) {
      const addr = data.address || {};
      // Prefer the feature name over the street address
      if (!addr.road && !addr.suburb) {
        return { name, name_ta: "" };
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  const geojsonPath = join(process.cwd(), "public/geojson/chennai-water-bodies-current.geojson");
  const geojson = JSON.parse(readFileSync(geojsonPath, "utf-8"));
  const features: GeoJsonFeature[] = geojson.features;

  // GCC bounding box filter
  const GCC = { minLat: 12.90, maxLat: 13.26, minLng: 80.09, maxLng: 80.36 };
  function insideGCC(lng: number, lat: number) {
    return lat >= GCC.minLat && lat <= GCC.maxLat && lng >= GCC.minLng && lng <= GCC.maxLng;
  }

  const unnamedInGCC = features.filter((f) => {
    if (f.properties.name) return false;
    const [lng, lat] = polygonCentroid(f.geometry);
    return insideGCC(lng, lat);
  });

  console.log(`Total features: ${features.length}`);
  console.log(`Unnamed inside GCC: ${unnamedInGCC.length}`);
  console.log();

  // ── Step 1: Overpass named features ────────────────────────────────────────
  console.log("Step 1: Fetching named water features from Overpass...");
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    body: new URLSearchParams({ data: NAMED_QUERY }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!res.ok) throw new Error(`Overpass error: ${res.status}`);
  const osmData: { elements: OsmElement[] } = await res.json();
  console.log(`Got ${osmData.elements.length} named OSM elements`);

  // Build list of (center, name, name_ta) for named features
  const namedPoints: { lng: number; lat: number; name: string; name_ta: string }[] = [];
  for (const el of osmData.elements) {
    const center = getCenter(el);
    if (!center) continue;
    const tags = el.tags || {};
    const name = (tags["name"] || tags["name:en"] || "").trim();
    const name_ta = (tags["name:ta"] || "").trim();
    if (!name) continue;
    namedPoints.push({ lng: center[0], lat: center[1], name, name_ta });
  }
  console.log(`Named points usable: ${namedPoints.length}`);

  // Point-in-polygon: for each named OSM point, find containing unnamed polygon
  let overpassHits = 0;
  for (const np of namedPoints) {
    const pt = point([np.lng, np.lat]);
    for (const f of unnamedInGCC) {
      if (f.properties.name) continue; // already resolved
      try {
        if (booleanPointInPolygon(pt, f as Parameters<typeof booleanPointInPolygon>[1])) {
          f.properties.name = np.name;
          if (np.name_ta) f.properties.name_ta = np.name_ta;
          overpassHits++;
          break;
        }
      } catch { /* skip malformed */ }
    }
  }
  console.log(`Resolved via Overpass point-in-polygon: ${overpassHits}`);

  // ── Step 2: Nominatim fallback for significant remaining unnamed ───────────
  const stillUnnamed = unnamedInGCC.filter((f) => !f.properties.name && (f.properties.area_ha || 0) >= 2);
  console.log(`\nStep 2: Nominatim fallback for ${stillUnnamed.length} unnamed bodies >= 2 ha...`);

  let nominatimHits = 0;
  let nominatimSkipped = 0;
  for (let i = 0; i < stillUnnamed.length; i++) {
    const f = stillUnnamed[i];
    const [lng, lat] = polygonCentroid(f.geometry);
    await sleep(1100); // Nominatim: 1 req/sec limit
    const result = await nominatimReverse(lat, lng);
    if (result) {
      f.properties.name = result.name;
      if (result.name_ta) f.properties.name_ta = result.name_ta;
      nominatimHits++;
      console.log(`  [${i + 1}/${stillUnnamed.length}] osm_id=${f.properties.osm_id} → "${result.name}"`);
    } else {
      nominatimSkipped++;
      if (i < 5 || nominatimSkipped <= 3) {
        console.log(`  [${i + 1}/${stillUnnamed.length}] osm_id=${f.properties.osm_id} → no name found`);
      }
    }
  }
  console.log(`\nNominatim resolved: ${nominatimHits}, still unnamed: ${nominatimSkipped}`);

  // ── Summary ─────────────────────────────────────────────────────────────────
  const totalNamed = features.filter((f) => f.properties.name).length;
  const totalUnnamed = features.filter((f) => !f.properties.name).length;
  const unnamedInGCCFinal = features.filter((f) => {
    if (f.properties.name) return false;
    const [lng, lat] = polygonCentroid(f.geometry);
    return insideGCC(lng, lat);
  });

  console.log(`\n── Final counts ─────────────────────────────`);
  console.log(`  Named:   ${totalNamed} (was 276)`);
  console.log(`  Unnamed: ${totalUnnamed} (was 1359)`);
  console.log(`  Unnamed inside GCC: ${unnamedInGCCFinal.length} (was ${unnamedInGCC.length})`);

  writeFileSync(geojsonPath, JSON.stringify(geojson, null, 2));
  console.log(`\nWrote updated GeoJSON to ${geojsonPath}`);

  if (unnamedInGCCFinal.length > 0) {
    console.log(`\nRemaining unnamed inside GCC (${unnamedInGCCFinal.length}):`);
    const sorted = unnamedInGCCFinal.sort(
      (a, b) => (b.properties.area_ha || 0) - (a.properties.area_ha || 0)
    );
    for (const f of sorted.slice(0, 20)) {
      const [lng, lat] = polygonCentroid(f.geometry);
      console.log(`  osm_id=${f.properties.osm_id}  ${lat.toFixed(4)},${lng.toFixed(4)}  ${f.properties.area_ha} ha  type=${f.properties.water_type}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
