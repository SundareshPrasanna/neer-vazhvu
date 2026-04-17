/**
 * One-time script: Fetch Chennai neighborhoods/suburbs from OpenStreetMap via Overpass API.
 * Maps each locality to its ward (via point-in-polygon) and zone (via ward-profiles).
 * Saves result to public/data/chennai-localities.json
 *
 * Run: npx tsx scripts/fetch-localities-osm.ts
 */

import { writeFileSync, readFileSync } from "fs";
import { join } from "path";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";

// Greater Chennai Corporation bounding box: south, west, north, east
const BBOX = "12.90,80.09,13.26,80.36";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

const QUERY = `
[out:json][timeout:90];
(
  node["place"~"^(suburb|neighbourhood|quarter)$"](${BBOX});
  way["place"~"^(suburb|neighbourhood|quarter)$"](${BBOX});
  relation["place"~"^(suburb|neighbourhood|quarter)$"](${BBOX});
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

interface OsmResponse {
  elements: OsmElement[];
}

interface WardProfile {
  ward_number: number;
  zone_no: string;
  zone_name: string;
  centroid: [number, number]; // [lng, lat]
}

interface WardFeature {
  type: "Feature";
  properties: { Ward_No?: number; ward_no?: number; [key: string]: unknown };
  geometry: { type: string; coordinates: unknown };
}

export interface LocalityEntry {
  name: string;
  name_ta?: string;
  type: "suburb" | "neighbourhood" | "quarter";
  lat: number;
  lng: number;
  ward_number: number;
  zone_name: string;
  zone_no: string;
}

async function fetchLocalities(): Promise<void> {
  console.log("Fetching Chennai localities from Overpass API...");
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    body: new URLSearchParams({ data: QUERY }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);
  const data: OsmResponse = await res.json();
  console.log(`Received ${data.elements.length} raw OSM elements`);

  // Load ward GeoJSON
  const wardGeoPath = join(process.cwd(), "public/geojson/chennai-wards-2022.geojson");
  const wardGeo = JSON.parse(readFileSync(wardGeoPath, "utf-8"));

  // Load ward profiles for zone info
  const profilesPath = join(process.cwd(), "public/data/ward-profiles.json");
  const profiles: WardProfile[] = JSON.parse(readFileSync(profilesPath, "utf-8"));
  const profileMap = new Map<number, WardProfile>(profiles.map((p) => [p.ward_number, p]));

  // Helper: resolve lat/lng from OSM element
  function getCoords(el: OsmElement): { lat: number; lng: number } | null {
    if (el.type === "node" && el.lat != null && el.lon != null) {
      return { lat: el.lat, lng: el.lon };
    }
    if ((el.type === "way" || el.type === "relation") && el.center) {
      return { lat: el.center.lat, lng: el.center.lon };
    }
    return null;
  }

  // Helper: find ward number from lat/lng using point-in-polygon
  function findWard(lat: number, lng: number): number | null {
    const pt = point([lng, lat]);
    for (const feature of wardGeo.features as WardFeature[]) {
      try {
        if (booleanPointInPolygon(pt, feature as Parameters<typeof booleanPointInPolygon>[1])) {
          const wardNo =
            feature.properties?.Ward_No ??
            feature.properties?.ward_no ??
            feature.properties?.WARD_NO;
          return typeof wardNo === "number" ? wardNo : null;
        }
      } catch {
        // skip malformed features
      }
    }
    return null;
  }

  const seen = new Set<string>();
  const localities: LocalityEntry[] = [];

  for (const el of data.elements) {
    const tags = el.tags || {};
    const name = tags["name:en"] || tags["name"] || "";
    if (!name) continue;

    // Deduplicate by lowercase name
    const key = name.toLowerCase().trim();
    if (seen.has(key)) continue;

    const coords = getCoords(el);
    if (!coords) continue;

    const wardNum = findWard(coords.lat, coords.lng);
    if (!wardNum) continue; // outside GCC ward boundaries

    const profile = profileMap.get(wardNum);
    if (!profile) continue;

    seen.add(key);
    localities.push({
      name: name.trim(),
      name_ta: tags["name:ta"] || undefined,
      type: (tags["place"] as LocalityEntry["type"]) || "suburb",
      lat: coords.lat,
      lng: coords.lng,
      ward_number: wardNum,
      zone_name: profile.zone_name,
      zone_no: profile.zone_no,
    });
  }

  // Sort by name
  localities.sort((a, b) => a.name.localeCompare(b.name));

  const outPath = join(process.cwd(), "public/data/chennai-localities.json");
  writeFileSync(outPath, JSON.stringify(localities, null, 2));
  console.log(`\nWrote ${localities.length} localities to public/data/chennai-localities.json`);

  // Summary by zone
  const byZone = new Map<string, number>();
  for (const l of localities) {
    byZone.set(l.zone_name, (byZone.get(l.zone_name) || 0) + 1);
  }
  console.log("\nLocalities per zone:");
  for (const [zone, count] of [...byZone.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${zone}: ${count}`);
  }
}

fetchLocalities().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
