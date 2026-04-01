/**
 * Verify ward-to-zone assignments by computing each ward's centroid
 * and checking which GCC official zone polygon it falls into.
 *
 * Usage: npx tsx scripts/verify-ward-zones.ts
 *
 * Requires: /tmp/gcc_zone.geojson (downloaded from GCC website)
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import centroid from "@turf/centroid";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Point } from "geojson";

// Zone Roman numeral to number mapping
const ROMAN_TO_NUM: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8,
  IX: 9, X: 10, XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15,
};

const NUM_TO_ROMAN: Record<number, string> = Object.fromEntries(
  Object.entries(ROMAN_TO_NUM).map(([k, v]) => [v, k])
);

const ZONE_NAMES: Record<number, string> = {
  1: "THIRUVOTTIYUR", 2: "MANALI", 3: "MADHAVARAM", 4: "TONDIARPET",
  5: "ROYAPURAM", 6: "THIRU-VI-KA NAGAR", 7: "AMBATTUR", 8: "ANNA NAGAR",
  9: "TEYNAMPET", 10: "KODAMBAKKAM", 11: "VALASARAVAKKAM", 12: "ALANDUR",
  13: "ADYAR", 14: "PERUNGUDI", 15: "SHOLINGANALLUR",
};

// Load GCC zone boundaries
const zoneGeoJSON: FeatureCollection = JSON.parse(
  readFileSync("/tmp/gcc_zone.geojson", "utf-8")
);

// Load our ward boundaries
const wardGeoJSON: FeatureCollection = JSON.parse(
  readFileSync(resolve(process.cwd(), "public/geojson/chennai-wards-2022.geojson"), "utf-8")
);

// Load our ward-names.json (current zone assignments)
const wardNames: { ward_number: number; ward_name: string; zone_no: string; zone_name: string }[] =
  JSON.parse(readFileSync(resolve(process.cwd(), "public/data/ward-names.json"), "utf-8"));

const currentZoneMap = new Map(wardNames.map((w) => [w.ward_number, w.zone_no]));

// Parse zone number from each zone feature
function getZoneNumber(feature: Feature): number | null {
  const name = feature.properties?.name;
  if (name && ROMAN_TO_NUM[name]) return ROMAN_TO_NUM[name];
  return null;
}

// Find which zone a point falls into
function findZone(point: Feature<Point>): number | null {
  for (const zoneFeature of zoneGeoJSON.features) {
    const zoneNum = getZoneNumber(zoneFeature);
    if (!zoneNum) continue;

    const geom = zoneFeature.geometry;
    if (geom.type === "Polygon") {
      if (booleanPointInPolygon(point, geom as Polygon)) return zoneNum;
    } else if (geom.type === "MultiPolygon") {
      // Check each polygon in the MultiPolygon
      for (const coords of (geom as MultiPolygon).coordinates) {
        const poly: Polygon = { type: "Polygon", coordinates: coords };
        if (booleanPointInPolygon(point, poly)) return zoneNum;
      }
    }
  }
  return null;
}

// Process each ward
const discrepancies: {
  wardNumber: number;
  wardName: string;
  currentZone: string;
  currentZoneName: string;
  gccZone: string;
  gccZoneName: string;
}[] = [];

let matched = 0;
let unresolved = 0;

for (const wardFeature of wardGeoJSON.features) {
  const wardNum = Number(
    wardFeature.properties?.ward_number || wardFeature.properties?.Ward_No
  );
  const wardName =
    wardFeature.properties?.ward_name || `Ward ${wardNum}`;

  if (!wardNum) continue;

  // Compute centroid of ward polygon
  const wardCentroid = centroid(wardFeature as Feature<Polygon | MultiPolygon>);

  // Find which GCC zone this centroid falls into
  const gccZoneNum = findZone(wardCentroid);

  const currentZoneRoman = currentZoneMap.get(wardNum) || "?";
  const currentZoneNum = ROMAN_TO_NUM[currentZoneRoman] || 0;

  if (gccZoneNum === null) {
    unresolved++;
    console.log(
      `  ??? Ward ${wardNum} (${wardName}) - centroid not in any zone polygon`
    );
    continue;
  }

  if (gccZoneNum !== currentZoneNum) {
    discrepancies.push({
      wardNumber: wardNum,
      wardName,
      currentZone: currentZoneRoman,
      currentZoneName: ZONE_NAMES[currentZoneNum] || "?",
      gccZone: NUM_TO_ROMAN[gccZoneNum],
      gccZoneName: ZONE_NAMES[gccZoneNum] || "?",
    });
  } else {
    matched++;
  }
}

// Report
console.log("\n=== Ward-to-Zone Verification Report ===\n");
console.log(`Matched: ${matched}`);
console.log(`Discrepancies: ${discrepancies.length}`);
console.log(`Unresolved (centroid outside all zones): ${unresolved}`);

if (discrepancies.length > 0) {
  console.log("\n--- DISCREPANCIES ---\n");
  console.log(
    "Ward | Ward Name | Current Zone | GCC Zone"
  );
  console.log("-----|-----------|-------------|----------");
  for (const d of discrepancies.sort((a, b) => a.wardNumber - b.wardNumber)) {
    console.log(
      `${d.wardNumber} | ${d.wardName} | ${d.currentZone} (${d.currentZoneName}) | ${d.gccZone} (${d.gccZoneName})`
    );
  }
}

console.log("\nDone.");
