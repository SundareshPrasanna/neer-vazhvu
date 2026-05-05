/**
 * One-time script: Fetch Madurai/Vaigai river paths from OpenStreetMap.
 *
 * Vaigai is the headline river. Madurai's basin scope (per
 * project_madurai_scope_decision.md) covers Vaigai + main tributaries
 * (Suruliyaru, Manjalar, Varaha) and the cross-state Periyar-side that
 * feeds Vaigai via the Mullaperiyar tunnel.
 *
 * Run: npx tsx scripts/fetch-rivers-osm-madurai.ts
 * Output: public/geojson/madurai-rivers.geojson
 *
 * Mirror of fetch-rivers-osm.ts; M4 will fold both into a place-aware script.
 */

import { writeFileSync } from "fs";
import { join } from "path";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Vaigai basin bbox: from Periyar dam (Idukki Kerala, ~9.54N 77.14E)
// through Theni (Vaigai dam, 10.05N 77.59E) -> Madurai city (9.93N 78.12E)
// -> Manamadurai (9.69N 78.48E) -> Bay of Bengal at Ramanathapuram
// (9.30N 78.84E). Bbox covers the whole reach.
// [south, west, north, east]
const BBOX = "9.2,77.0,10.2,79.0";

// Default clip for Madurai-focused map geometry. Map zoom 10 around city
// center will not show the full basin; this is a permissive clip that lets
// the full Vaigai reach render so users can see the upstream/downstream
// context when they zoom out.
const DEFAULT_CLIP = { south: 9.2, north: 10.2, west: 77.0, east: 79.0 };

const QUERY = `
[out:json][timeout:90];
(
  way["waterway"="river"]["name"~"Vaigai|Suruliyaru|Suruli|Manjalar|Varaha|Periyar",i](${BBOX});
  relation["waterway"="river"]["name"~"Vaigai|Suruliyaru|Suruli|Manjalar|Varaha|Periyar",i](${BBOX});
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

interface OsmWay {
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}

interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  members?: Array<{ type: string; ref: number; role: string }>;
  tags?: Record<string, string>;
}

interface GeoJsonFeature {
  type: "Feature";
  geometry:
    | {
        type: "LineString";
        coordinates: number[][];
      }
    | {
        type: "MultiLineString";
        coordinates: number[][][];
      };
  properties: {
    river_id: string;
    name: string;
    name_ta: string;
    waterway: string;
    length_km: number;
    osm_ids: number[];
  };
}

interface ClipBounds {
  south: number;
  north: number;
  west: number;
  east: number;
}

// Map a river name to a stable slug and Tamil name. Slug joins to
// future public/data/river-quality-madurai.json (CPCB NWMP Vaigai
// stations - M3 work).
const RIVER_CONFIG: Record<
  string,
  {
    id: string;
    name_ta: string;
    waterway: string;
    clip?: ClipBounds;
  }
> = {
  vaigai: {
    id: "vaigai",
    name_ta: "வைகை ஆறு",
    waterway: "river",
  },
  suruliyaru: {
    id: "suruliyaru",
    name_ta: "சுருளியாறு",
    waterway: "river",
  },
  manjalar: {
    id: "manjalar",
    name_ta: "மஞ்சளாறு",
    waterway: "river",
  },
  varaha: {
    id: "varaha",
    name_ta: "வராஹா ஆறு",
    waterway: "river",
  },
  periyar: {
    // Kerala-side; feeds Vaigai via the Mullaperiyar tunnel.
    id: "periyar",
    name_ta: "பெரியாறு",
    waterway: "river",
  },
};

function getRiverKey(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.includes("vaigai")) return "vaigai";
  if (lower.includes("suruli")) return "suruliyaru";
  if (lower.includes("manjalar")) return "manjalar";
  if (lower.includes("varaha")) return "varaha";
  if (lower.includes("periyar")) return "periyar";
  return null;
}

function computeSegmentLengthKm(coords: number[][]): number {
  let length = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [lon1, lat1] = coords[i];
    const [lon2, lat2] = coords[i + 1];
    // Haversine approximation (good enough for short segments)
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    length += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return length;
}

async function fetchOverpass(): Promise<OsmElement[]> {
  console.log("Querying Overpass API...");
  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "neer-vazhvu/madurai-onboarding (https://neervazhvu.org; civic water dashboard)",
    },
    body: `data=${encodeURIComponent(QUERY)}`,
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { elements: OsmElement[] };
  console.log(`Received ${data.elements.length} elements from Overpass`);
  return data.elements;
}

function buildGeoJSON(elements: OsmElement[]): GeoJsonFeature[] {
  // Build node lookup
  const nodeMap = new Map<number, OsmNode>();
  for (const el of elements) {
    if (el.type === "node" && el.lat !== undefined && el.lon !== undefined) {
      nodeMap.set(el.id, { id: el.id, lat: el.lat, lon: el.lon });
    }
  }

  // Collect ways with their tags
  const wayMap = new Map<number, OsmWay>();
  for (const el of elements) {
    if (el.type === "way" && el.nodes) {
      wayMap.set(el.id, { id: el.id, nodes: el.nodes, tags: el.tags });
    }
  }

  const nodeToWays = new Map<number, number[]>();
  for (const way of wayMap.values()) {
    for (const nodeId of way.nodes) {
      const connected = nodeToWays.get(nodeId) ?? [];
      connected.push(way.id);
      nodeToWays.set(nodeId, connected);
    }
  }

  // Group line segments by river key
  // riverKey → list of [lon, lat][] segments
  const riverSegments = new Map<
    string,
    { segments: number[][][]; osm_ids: number[]; way_ids: number[]; name: string }
  >();

  // Process standalone ways (not part of a relation)
  const waysInRelations = new Set<number>();
  for (const el of elements) {
    if (el.type === "relation" && el.members) {
      for (const member of el.members) {
        if (member.type === "way") waysInRelations.add(member.ref);
      }
    }
  }

  // Process ways (both standalone and those we'll catch via relations)
  const processWay = (way: OsmWay): number[][] | null => {
    const coords = way.nodes
      .map((nid) => nodeMap.get(nid))
      .filter((n): n is OsmNode => n !== undefined)
      .map((n) => [n.lon, n.lat]);
    return coords.length >= 2 ? coords : null;
  };

  // Standalone ways (not in relations)
  for (const el of elements) {
    if (el.type === "way" && el.tags && !waysInRelations.has(el.id)) {
      const name = el.tags.name || el.tags["name:en"] || "";
      const key = getRiverKey(name);
      if (!key) continue;

      const way = wayMap.get(el.id);
      if (!way) continue;
      const coords = processWay(way);
      if (!coords) continue;

      if (!riverSegments.has(key)) {
        riverSegments.set(key, { segments: [], osm_ids: [], way_ids: [], name });
      }
      const entry = riverSegments.get(key)!;
      entry.segments.push(coords);
      entry.osm_ids.push(el.id);
      entry.way_ids.push(el.id);
    }
  }

  // Process relations — collect their member ways
  for (const el of elements) {
    if (el.type === "relation" && el.tags && el.members) {
      const name = el.tags.name || el.tags["name:en"] || "";
      const key = getRiverKey(name);
      if (!key) continue;

      for (const member of el.members) {
        if (member.type !== "way") continue;
        const way = wayMap.get(member.ref);
        if (!way) continue;
        const coords = processWay(way);
        if (!coords) continue;

        if (!riverSegments.has(key)) {
          riverSegments.set(key, { segments: [], osm_ids: [], way_ids: [], name });
        }
        const entry = riverSegments.get(key)!;
        entry.segments.push(coords);
        entry.way_ids.push(member.ref);
        if (!entry.osm_ids.includes(el.id)) entry.osm_ids.push(el.id);
      }
    }
  }

  for (const [key, entry] of riverSegments) {
    const config = RIVER_CONFIG[key];
    if (!config) continue;

    const seenWayIds = new Set(entry.way_ids);
    const queue = [...entry.way_ids];

    while (queue.length > 0) {
      const wayId = queue.shift()!;
      const way = wayMap.get(wayId);
      if (!way) continue;

      for (const nodeId of way.nodes) {
        const connectedWayIds = nodeToWays.get(nodeId) ?? [];
        for (const connectedWayId of connectedWayIds) {
          if (seenWayIds.has(connectedWayId)) continue;

          const connectedWay = wayMap.get(connectedWayId);
          if (!connectedWay?.tags) continue;

          if (connectedWay.tags.waterway !== config.waterway) continue;

          const connectedName =
            connectedWay.tags.name || connectedWay.tags["name:en"] || "";
          const connectedKey = connectedName ? getRiverKey(connectedName) : null;

          if (connectedKey && connectedKey !== key) continue;

          const coords = processWay(connectedWay);
          if (!coords) continue;

          seenWayIds.add(connectedWayId);
          queue.push(connectedWayId);
          entry.segments.push(coords);
          entry.way_ids.push(connectedWayId);
          entry.osm_ids.push(connectedWayId);
        }
      }
    }
  }

  function clipSegment(seg: number[][], bounds: ClipBounds): number[][] {
    return seg.filter(
      ([lon, lat]) =>
        lat >= bounds.south && lat <= bounds.north &&
        lon >= bounds.west && lon <= bounds.east
    );
  }

  // Build GeoJSON features
  const features: GeoJsonFeature[] = [];

  for (const [key, { segments, osm_ids, name }] of riverSegments) {
    if (segments.length === 0) continue;

    const config = RIVER_CONFIG[key];
    if (!config) continue;

    const clipped = segments
      .map((segment) => clipSegment(segment, config.clip ?? DEFAULT_CLIP))
      .filter((segment) => segment.length >= 2);

    if (clipped.length === 0) continue;

    const totalLengthKm = clipped.reduce((sum, seg) => sum + computeSegmentLengthKm(seg), 0);

    features.push({
      type: "Feature",
      geometry:
        clipped.length === 1
          ? {
              type: "LineString",
              coordinates: clipped[0],
            }
          : {
              type: "MultiLineString",
              coordinates: clipped,
            },
      properties: {
        river_id: config.id,
        name,
        name_ta: config.name_ta,
        waterway: config.waterway,
        length_km: Math.round(totalLengthKm * 10) / 10,
        osm_ids,
      },
    });

    console.log(
      `  ${config.id}: ${segments.length} raw segments, ${clipped.length} rendered segment(s), ~${Math.round(totalLengthKm)} km`
    );
  }

  return features;
}

async function main() {
  const elements = await fetchOverpass();
  const features = buildGeoJSON(elements);

  if (features.length === 0) {
    console.error("No river features found — check the Overpass query or bounding box");
    process.exit(1);
  }

  const geojson = {
    type: "FeatureCollection",
    features,
  };

  const outPath = join(process.cwd(), "public/geojson/madurai-rivers.geojson");
  writeFileSync(outPath, JSON.stringify(geojson, null, 2));

  console.log(`\nWrote ${features.length} river features to public/geojson/madurai-rivers.geojson`);
  console.log("Rivers found:", features.map((f) => f.properties.river_id).join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
