/**
 * One-time script: Fetch Delhi's river + canal + major-drain paths from
 * OpenStreetMap.
 *
 * The Yamuna is the headline river; Delhi's rivers page is explicitly
 * Yamuna-BASIN scoped (labelled), not NCT-clipped, per the Delhi audit -
 * the reach runs Hathnikund barrage (Haryana) -> Palla -> the 22 km
 * Wazirabad-Okhla city stretch -> exit toward Agra. Delhi's "tributaries"
 * are engineered: the Western Yamuna Canal / Munak carrier (the ~70%
 * raw-water lifeline), and the two drains that carry 84% of the city's
 * pollution load into the river (Najafgarh, Shahdara) plus Barapullah.
 * OSM tags these waterway=canal / waterway=drain, not river - the config
 * accepts per-channel waterway sets.
 *
 * Run: npx tsx scripts/fetch-rivers-osm-delhi.ts
 * Output: public/geojson/hyderabad-rivers.geojson
 *
 * Mirror of fetch-rivers-osm-madurai.ts (same assembly + connectivity
 * walk), with Hindi names in place of Tamil.
 */

import { writeFileSync } from "fs";
import { join } from "path";

const OVERPASS_URL = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";

// Yamuna basin reach relevant to Delhi: Hathnikund (~30.35N 77.6E) south
// through NCT to the Okhla exit, west to the Sahibi's Haryana reach, east
// to the Hindon's UP course. [south, west, north, east]
// Wider than the city: the Musi rises in the Anantagiri hills west of the
// Core Urban Region and runs east to the Krishna, and the rivers page is
// basin-scoped and labelled as such (the Madurai rule). The Manjira sits
// north-west, on the supply side.
const BBOX = "17.05,77.60,18.05,79.20";

// Permissive clip = the query bbox; users see the upstream/downstream
// context when they zoom out (Madurai precedent).
const DEFAULT_CLIP = { south: 17.05, north: 18.05, west: 77.6, east: 79.2 };

const QUERY = `
[out:json][timeout:120];
(
  way["waterway"~"^(river|canal|drain)$"]["name"~"Musi|Musa|Esi|Manjira|Haldi|Kurel",i](${BBOX});
  relation["waterway"~"^(river|canal|drain)$"]["name"~"Musi|Musa|Esi|Manjira|Haldi|Kurel",i](${BBOX});
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
    name_te: string;
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

// Map a channel name to a stable slug and Hindi name. Slug joins to the
// future public/data/river-quality-delhi.json (DPCC 8-station + 27-drain
// monthly feed + CPCB NWMP stations).
//
// `waterways` is a set because Delhi's channels switch tags along their
// course (the Najafgarh drain is canal in stretches, drain in others; the
// WYC/Munak carrier is canal throughout).
const RIVER_CONFIG: Record<
  string,
  {
    id: string;
    name_te: string;
    /** Canonical waterway value written to output properties. */
    waterway: string;
    /** Tags accepted during the connectivity walk. */
    waterways: string[];
    clip?: ClipBounds;
  }
> = {
  musi: {
    // OSM maps the Musi under THREE name variants - "Musi River" (15 ways),
    // "Musi" (4) and "Musa" (1) - so they are unified here rather than
    // rendering as three rivers. The Musi is Hyderabad's story river: the
    // Nizam-era twins impound it upstream, the city discharges into it, and
    // the riverfront project is built on it.
    id: "musi",
    name_te: "\u0c2e\u0c42\u0c38\u0c40 \u0c28\u0c26\u0c3f",
    waterway: "river",
    waterways: ["river", "stream"],
  },
  esi: {
    // The Esi (Isa) is the tributary Himayat Sagar impounds, as Osman Sagar
    // impounds the Musi. Only ONE way carries the name in OSM.
    id: "esi",
    name_te: "\u0c08\u0c38\u0c40 \u0c28\u0c26\u0c3f",
    waterway: "river",
    waterways: ["river", "stream"],
  },
  manjira: {
    // Supply-side, not a city river: Singur and the Manjira barrage sit on it.
    id: "manjira",
    name_te: "\u0c2e\u0c02\u0c1c\u0c40\u0c30\u0c3e \u0c28\u0c26\u0c3f",
    waterway: "river",
    waterways: ["river"],
  },
  haldi: {
    id: "haldi",
    name_te: "",
    waterway: "river",
    waterways: ["river", "stream"],
  },
};

function getRiverKey(name: string): string | null {
  const lower = name.toLowerCase();
  // Order matters. "Musi River", "Musi" and "Musa" are the SAME river under
  // three OSM name variants and must collapse to one key, or the map renders
  // three rivers. Checked against the live name census (2026-07-26): 15 ways
  // "Musi River", 4 "Musi", 1 "Musa", 1 "Esi River", 2 "Manjira", 2 "Haldi".
  if (lower.includes("manjira")) return "manjira";
  if (lower.includes("esi")) return "esi";
  if (lower.includes("haldi")) return "haldi";
  if (lower.includes("musi") || lower.includes("musa")) return "musi";
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
      "User-Agent": "neer-vazhvu/delhi-onboarding (https://neervazhvu.org; civic water dashboard)",
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

  // Group line segments by channel key
  const riverSegments = new Map<
    string,
    { segments: number[][][]; osm_ids: number[]; way_ids: number[]; name: string }
  >();

  const waysInRelations = new Set<number>();
  for (const el of elements) {
    if (el.type === "relation" && el.members) {
      for (const member of el.members) {
        if (member.type === "way") waysInRelations.add(member.ref);
      }
    }
  }

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

  // Relations - collect their member ways
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

  // Connectivity walk: pull in unnamed continuation ways of the same
  // waterway class so channels don't render with gaps.
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

          if (!config.waterways.includes(connectedWay.tags.waterway ?? "")) continue;

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
        name_te: config.name_te,
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

  const outPath = join(process.cwd(), "public/geojson/hyderabad-rivers.geojson");
  writeFileSync(outPath, JSON.stringify(geojson, null, 2));

  console.log(`\nWrote ${features.length} river features to public/geojson/hyderabad-rivers.geojson`);
  console.log("Channels found:", features.map((f) => f.properties.river_id).join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
