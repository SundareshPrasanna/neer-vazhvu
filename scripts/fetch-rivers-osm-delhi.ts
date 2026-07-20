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
 * Output: public/geojson/delhi-rivers.geojson
 *
 * Mirror of fetch-rivers-osm-madurai.ts (same assembly + connectivity
 * walk), with Hindi names in place of Tamil.
 */

import { writeFileSync } from "fs";
import { join } from "path";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Yamuna basin reach relevant to Delhi: Hathnikund (~30.35N 77.6E) south
// through NCT to the Okhla exit, west to the Sahibi's Haryana reach, east
// to the Hindon's UP course. [south, west, north, east]
const BBOX = "28.30,76.30,30.50,77.85";

// Permissive clip = the query bbox; users see the upstream/downstream
// context when they zoom out (Madurai precedent).
const DEFAULT_CLIP = { south: 28.3, north: 30.5, west: 76.3, east: 77.85 };

const QUERY = `
[out:json][timeout:120];
(
  way["waterway"~"^(river|canal|drain)$"]["name"~"Yamuna|Hindon|Sahibi|Najafgarh|Barapulla|Shahdara|Munak",i](${BBOX});
  relation["waterway"~"^(river|canal|drain)$"]["name"~"Yamuna|Hindon|Sahibi|Najafgarh|Barapulla|Shahdara|Munak",i](${BBOX});
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
    name_hi: string;
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
    name_hi: string;
    /** Canonical waterway value written to output properties. */
    waterway: string;
    /** Tags accepted during the connectivity walk. */
    waterways: string[];
    clip?: ClipBounds;
  }
> = {
  yamuna: {
    id: "yamuna",
    name_hi: "यमुना नदी",
    waterway: "river",
    waterways: ["river"],
  },
  hindon: {
    id: "hindon",
    name_hi: "हिंडन नदी",
    waterway: "river",
    waterways: ["river"],
  },
  sahibi: {
    // The Sahibi's lower engineered course IS the Najafgarh drain; OSM
    // names the natural upper reach Sahibi (river) and the urban reach
    // Najafgarh (drain/canal) - kept as separate slugs, same story arc.
    id: "sahibi",
    name_hi: "साहिबी नदी",
    waterway: "river",
    waterways: ["river"],
  },
  wyc_munak: {
    id: "wyc_munak",
    name_hi: "पश्चिमी यमुना नहर (मुनक)",
    waterway: "canal",
    waterways: ["canal"],
  },
  najafgarh: {
    id: "najafgarh",
    name_hi: "नजफ़गढ़ नाला",
    waterway: "drain",
    waterways: ["drain", "canal"],
  },
  barapullah: {
    id: "barapullah",
    name_hi: "बारापुला नाला",
    waterway: "drain",
    waterways: ["drain"],
  },
  shahdara: {
    id: "shahdara",
    name_hi: "शाहदरा नाला",
    waterway: "drain",
    waterways: ["drain", "canal"],
  },
};

function getRiverKey(name: string): string | null {
  const lower = name.toLowerCase();
  // Order matters: the canal names contain "yamuna".
  if (lower.includes("western yamuna") || lower.includes("munak") || lower.includes("carrier lined"))
    return "wyc_munak";
  if (lower.includes("najafgarh")) return "najafgarh";
  if (lower.includes("barapulla")) return "barapullah";
  if (lower.includes("shahdara")) return "shahdara";
  if (lower.includes("yamuna")) return "yamuna";
  if (lower.includes("hindon")) return "hindon";
  if (lower.includes("sahibi") || lower.includes("sahibi nadi")) return "sahibi";
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
        name_hi: config.name_hi,
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

  const outPath = join(process.cwd(), "public/geojson/delhi-rivers.geojson");
  writeFileSync(outPath, JSON.stringify(geojson, null, 2));

  console.log(`\nWrote ${features.length} river features to public/geojson/delhi-rivers.geojson`);
  console.log("Channels found:", features.map((f) => f.properties.river_id).join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
