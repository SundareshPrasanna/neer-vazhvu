/**
 * One-time script: Fetch Bangalore river paths from OpenStreetMap via Overpass.
 *
 * Bangalore is a ridge city sitting astride three drainage divides, not a
 * river-city. The headline waterways are:
 *
 *   - Vrishabhavathi (the foam-and-fire river south-west of the city,
 *     discharges into Byramangala Reservoir then joins Arkavati then Cauvery).
 *     OSM tags it under three different spellings - we collapse them.
 *   - Arkavati (north-west, from Nandi Hills past TG Halli, joins Cauvery).
 *   - Dakshina Pinakini / Then Pennai / Ponnaiyar (east-flowing, originates
 *     in BBMP south, becomes Tamil Nadu's South Pennar).
 *
 * Run: npx tsx scripts/fetch-rivers-osm-bangalore.ts
 * Output: public/geojson/bangalore-rivers.geojson
 *
 * Mirror of fetch-rivers-osm.ts (Chennai) and fetch-rivers-osm-madurai.ts.
 * M4 will eventually fold all three into a place-aware fetcher.
 */

import { writeFileSync } from "fs";
import { join } from "path";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Bangalore river bbox: extended past the GBA 369-ward bbox to capture
// Arkavati's headwaters at Nandi Hills (~13.4 N) and Vrishabhavathi's
// downstream reach past Byramangala (~12.8 N, 77.3 E).
// [south, west, north, east]
const BBOX = "12.50,77.10,13.45,77.95";

// Default clip equals the fetch bbox - Bangalore's rivers extend beyond
// the 369-ward GBA bbox and clipping tighter would crop meaningful reaches
// (e.g. the Vrishabhavathi -> Byramangala discharge, the Arkavati headwaters).
const DEFAULT_CLIP = { south: 12.50, north: 13.45, west: 77.10, east: 77.95 };

const QUERY = `
[out:json][timeout:90];
(
  way["waterway"="river"]["name"~"Vrishabhavathi|Vrishabhavati|Vrishabavathi|Vrushabhavathi|Arkavati|Arkavathi|Dakshina Pinakini|Then Pennai|Ponnaiyar",i](${BBOX});
  relation["waterway"="river"]["name"~"Vrishabhavathi|Vrishabhavati|Vrishabavathi|Vrushabhavathi|Arkavati|Arkavathi|Dakshina Pinakini|Then Pennai|Ponnaiyar",i](${BBOX});
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
    name_kn: string;
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

// Map an OSM river name to a stable slug and Kannada name. Slugs join
// to public/data/river-quality-bangalore.json (KSPCB Vrishabhavathi + ARS
// monitoring - follow-up).
const RIVER_CONFIG: Record<
  string,
  {
    id: string;
    name_kn: string;
    waterway: string;
    clip?: ClipBounds;
  }
> = {
  vrishabhavathi: {
    id: "vrishabhavathi",
    name_kn: "ವೃಷಭಾವತಿ ನದಿ",
    waterway: "river",
  },
  arkavati: {
    id: "arkavati",
    name_kn: "ಅರ್ಕಾವತಿ ನದಿ",
    waterway: "river",
  },
  "dakshina-pinakini": {
    id: "dakshina-pinakini",
    name_kn: "ದಕ್ಷಿಣ ಪಿನಾಕಿನಿ",
    waterway: "river",
  },
};

// Canonical English names per river slug. OSM tags inconsistent spellings
// (Vrishabhavathi / Vrishabhavati / Vrishabavathi) and uses downstream-state
// names (Ponnaiyar for Dakshina Pinakini after it enters Tamil Nadu).
// Surface one canonical English name in the GeoJSON properties regardless of
// which OSM segment our walk happens to pick up.
const CANONICAL_NAME: Record<string, string> = {
  vrishabhavathi: "Vrishabhavathi",
  arkavati: "Arkavati",
  "dakshina-pinakini": "Dakshina Pinakini",
};

function getRiverKey(name: string): string | null {
  const lower = name.toLowerCase();
  // Vrishabhavathi OSM contributors disagree on spelling. Three variants
  // observed in the live data: Vrishabhavathi (10), Vrishabhavati (3),
  // Vrishabavathi (3). Collapse all to the canonical Vrishabhavathi.
  if (
    lower.includes("vrishabhav") ||
    lower.includes("vrishabav") ||
    lower.includes("vrushabhav")
  ) {
    return "vrishabhavathi";
  }
  // Arkavati: OSM uses "Arkavati" without the 'h'; common transliteration
  // is "Arkavathi". Accept both.
  if (lower.includes("arkavati") || lower.includes("arkavathi")) {
    return "arkavati";
  }
  // Dakshina Pinakini = Then Pennai (TN crossing) = Ponnaiyar (further TN).
  if (
    lower.includes("dakshina pinakini") ||
    lower.includes("then pennai") ||
    lower.includes("ponnaiyar")
  ) {
    return "dakshina-pinakini";
  }
  return null;
}

function computeSegmentLengthKm(coords: number[][]): number {
  let length = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [lon1, lat1] = coords[i];
    const [lon2, lat2] = coords[i + 1];
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
  console.log("Querying Overpass API for Bangalore rivers...");
  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "neer-vazhvu/bangalore-onboarding (https://neervazhvu.org; civic water dashboard)",
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
  const nodeMap = new Map<number, OsmNode>();
  for (const el of elements) {
    if (el.type === "node" && el.lat !== undefined && el.lon !== undefined) {
      nodeMap.set(el.id, { id: el.id, lat: el.lat, lon: el.lon });
    }
  }

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

  // Relation members
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

  // Greedy-walk to pull in connected unnamed segments that share waterway
  // type and don't conflict with a different named river (same logic as
  // Chennai's fetcher).
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
        name: CANONICAL_NAME[config.id] ?? name,
        name_kn: config.name_kn,
        waterway: config.waterway,
        length_km: Math.round(totalLengthKm * 10) / 10,
        osm_ids,
      },
    });

    console.log(
      `  ${config.id}: ${segments.length} raw segments, ${clipped.length} rendered, ~${Math.round(totalLengthKm)} km`
    );
  }

  return features;
}

async function main() {
  const elements = await fetchOverpass();
  const features = buildGeoJSON(elements);

  if (features.length === 0) {
    console.error("No river features found - check the Overpass query or bbox");
    process.exit(1);
  }

  const geojson = {
    type: "FeatureCollection",
    features,
  };

  const outPath = join(process.cwd(), "public/geojson/bangalore-rivers.geojson");
  writeFileSync(outPath, JSON.stringify(geojson, null, 2));

  console.log(`\nWrote ${features.length} river features to public/geojson/bangalore-rivers.geojson`);
  console.log("Rivers found:", features.map((f) => f.properties.river_id).join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
