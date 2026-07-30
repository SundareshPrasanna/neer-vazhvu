/**
 * One-time script: Fetch Delhi's engineered drain network from OpenStreetMap.
 * Saves GeoJSON to public/geojson/delhi-drainage.geojson
 *
 * Run: npx tsx scripts/fetch-drainage-osm-delhi.ts
 *
 * The flood-risk drainage layer (Chennai-parity: chennai-drainage.geojson
 * from the GCC SWD survey). Delhi has no public official drain GIS - the
 * IFC 2018 Drainage Master Plan (3,737 km across 11 agencies) exists only
 * as PDF maps - so OSM is the best available network geometry, honestly
 * labelled. Named major drains (Najafgarh, Shahdara, Barapullah, ...) come
 * from the same pull; the DPCC 28-drain list is the join table for the
 * monthly WQ points.
 *
 * NCT bbox; waterway=drain + waterway=ditch excluded (ditch = roadside
 * micro-drainage, noise at city scale). Canals are in the rivers layer.
 */

import { join } from "path";
import { writeArtifact } from "./lib/nvdm-write";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// NCT Delhi bbox per src/lib/cities/delhi.ts. [south, west, north, east]
const BBOX = "28.40,76.85,28.90,77.40";

const QUERY = `
[out:json][timeout:120];
(
  way["waterway"="drain"](${BBOX});
  relation["waterway"="drain"](${BBOX});
);
out body;
>;
out skel qt;
`.trim();

interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
}

function segmentLengthKm(coords: number[][]): number {
  let length = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [lon1, lat1] = coords[i];
    const [lon2, lat2] = coords[i + 1];
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    length += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return length;
}

async function main() {
  console.log("Querying Overpass for Delhi drains (waterway=drain, NCT bbox)...");
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "neer-vazhvu/delhi-onboarding (https://neervazhvu.org; civic water dashboard)",
    },
    body: `data=${encodeURIComponent(QUERY)}`,
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { elements: OsmElement[] };
  console.log(`Received ${data.elements.length} elements`);

  const nodeMap = new Map<number, [number, number]>();
  for (const el of data.elements) {
    if (el.type === "node" && el.lat !== undefined && el.lon !== undefined) {
      nodeMap.set(el.id, [el.lon, el.lat]);
    }
  }

  const features: GeoJSON.Feature[] = [];
  let named = 0;
  let totalKm = 0;
  for (const el of data.elements) {
    if (el.type !== "way" || !el.nodes) continue;
    const coords = el.nodes
      .map((id) => nodeMap.get(id))
      .filter((c): c is [number, number] => c !== undefined);
    if (coords.length < 2) continue;
    const name = el.tags?.name || el.tags?.["name:en"] || "";
    if (name) named++;
    const lengthKm = Math.round(segmentLengthKm(coords) * 100) / 100;
    totalKm += lengthKm;
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: coords },
      properties: {
        osm_id: el.id,
        name,
        name_hi: el.tags?.["name:hi"] || "",
        covered: el.tags?.covered === "yes" || el.tags?.tunnel != null,
        length_km: lengthKm,
      },
    });
  }

  const geojson = {
    type: "FeatureCollection" as const,
    metadata: {
      source: "OpenStreetMap (waterway=drain), (c) OpenStreetMap contributors, ODbL 1.0",
      note:
        "Best available Delhi drain-network geometry: no official drain GIS is public (the IFC 2018 " +
        "Drainage Master Plan's 3,737 km across 11 agencies exists only as PDF maps). OSM coverage is " +
        "partial and skews toward large open channels - lengths here are a floor, not the network total.",
      fetched: new Date().toISOString().slice(0, 10),
      script: "scripts/fetch-drainage-osm-delhi.ts",
    },
    features,
  };

  const outPath = join(process.cwd(), "public/geojson/delhi-drainage.geojson");
  writeArtifact(outPath, geojson as unknown as Record<string, unknown>, { compact: true });
  console.log(
    `Saved ${features.length} drain segments (${named} named, ~${Math.round(totalKm)} km) to ${outPath}`,
  );

  const namedTotals = new Map<string, number>();
  for (const f of features) {
    const n = (f.properties as { name: string }).name;
    if (!n) continue;
    namedTotals.set(n, (namedTotals.get(n) ?? 0) + (f.properties as { length_km: number }).length_km);
  }
  const top = [...namedTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log("Top named drains by mapped length:");
  for (const [n, km] of top) console.log(`  ${km.toFixed(1)} km - ${n}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
