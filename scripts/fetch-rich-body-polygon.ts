/**
 * Fetch a single "rich-data" water body from OSM by relation ID, assemble
 * its multipolygon (outer + inner rings), and emit two GeoJSON files:
 *   - public/geojson/rich-bodies/<bodyId>.geojson         (the body polygon)
 *   - public/geojson/rich-bodies/<bodyId>-buffer-1km.geojson  (1 km buffer ring)
 *
 * The buffer file is only written if --buffer-m is supplied (default 1000).
 *
 * Usage:
 *   npx tsx scripts/fetch-rich-body-polygon.ts \
 *     --osm-rel 15046539 --body-id pallikaranai \
 *     --name "Pallikaranai Marsh" --buffer-m 1000
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import buffer from "@turf/buffer";
import area from "@turf/area";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint } from "@turf/helpers";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const USER_AGENT = "neervazhvu-rich-body-fetcher/1.0";

interface OsmGeomNode {
  lat: number;
  lon: number;
}
interface OsmMember {
  type: "way" | "node" | "relation";
  ref: number;
  role: string;
  geometry?: OsmGeomNode[];
}
interface OsmRelation {
  type: "relation";
  id: number;
  members: OsmMember[];
  tags?: Record<string, string>;
}
interface OsmResponse {
  elements: OsmRelation[];
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const val = argv[i + 1];
    if (val && !val.startsWith("--")) {
      out[key] = val;
      i++;
    } else {
      out[key] = "true";
    }
  }
  return out;
}

function closeRing(coords: Position[]): Position[] {
  if (coords.length < 2) return coords;
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return [...coords, first];
  }
  return coords;
}

/**
 * Stitch ways that share endpoints into closed rings. OSM multipolygon
 * relations may split a single conceptual ring across multiple ways; we
 * concatenate ways whose endpoints touch until a closed ring forms.
 */
function stitchRings(ways: Position[][]): Position[][] {
  const remaining = ways.map((w) => [...w]);
  const rings: Position[][] = [];

  while (remaining.length > 0) {
    let current = remaining.shift()!;

    // Already closed → finish
    if (
      current.length >= 4 &&
      current[0][0] === current[current.length - 1][0] &&
      current[0][1] === current[current.length - 1][1]
    ) {
      rings.push(current);
      continue;
    }

    // Try to extend until closed or exhausted
    let extended = true;
    while (extended) {
      extended = false;
      const tail = current[current.length - 1];
      const head = current[0];

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const cHead = candidate[0];
        const cTail = candidate[candidate.length - 1];

        if (tail[0] === cHead[0] && tail[1] === cHead[1]) {
          current = current.concat(candidate.slice(1));
          remaining.splice(i, 1);
          extended = true;
          break;
        }
        if (tail[0] === cTail[0] && tail[1] === cTail[1]) {
          current = current.concat([...candidate].reverse().slice(1));
          remaining.splice(i, 1);
          extended = true;
          break;
        }
        if (head[0] === cTail[0] && head[1] === cTail[1]) {
          current = candidate.slice(0, -1).concat(current);
          remaining.splice(i, 1);
          extended = true;
          break;
        }
        if (head[0] === cHead[0] && head[1] === cHead[1]) {
          current = [...candidate].reverse().slice(0, -1).concat(current);
          remaining.splice(i, 1);
          extended = true;
          break;
        }
      }
    }

    rings.push(closeRing(current));
  }

  return rings;
}

function ringCentroid(ring: Position[]): Position {
  let sx = 0,
    sy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    sx += ring[i][0];
    sy += ring[i][1];
  }
  const n = ring.length - 1;
  return [sx / n, sy / n];
}

function assignInnersToOuters(
  outers: Position[][],
  inners: Position[][]
): Position[][][] {
  const polygons: Position[][][] = outers.map((o) => [o]);

  for (const inner of inners) {
    const centroid = ringCentroid(inner);
    let assigned = false;
    for (let i = 0; i < outers.length; i++) {
      const outerPoly: Polygon = {
        type: "Polygon",
        coordinates: [outers[i]],
      };
      if (booleanPointInPolygon(turfPoint(centroid), outerPoly)) {
        polygons[i].push(inner);
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      console.warn(
        `  inner ring at centroid ${centroid} not contained in any outer; skipped`
      );
    }
  }

  return polygons;
}

async function main() {
  const args = parseArgs(process.argv);
  const osmRel = args["osm-rel"];
  const bodyId = args["body-id"];
  const displayName = args["name"] || "";
  const bufferM = parseInt(args["buffer-m"] || "0", 10);

  if (!osmRel || !bodyId) {
    console.error(
      "Usage: --osm-rel <relationId> --body-id <slug> [--name <name>] [--buffer-m <metres>]"
    );
    process.exit(1);
  }

  console.log(`Fetching OSM relation ${osmRel} (${displayName || bodyId})…`);

  const query = `[out:json][timeout:60];rel(${osmRel});out geom;`;
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) {
    throw new Error(`Overpass returned ${res.status}: ${await res.text()}`);
  }

  const osm: OsmResponse = await res.json();
  const rel = osm.elements.find((e) => e.type === "relation");
  if (!rel) {
    throw new Error(`Relation ${osmRel} not found in Overpass response`);
  }

  const tags = rel.tags || {};
  console.log(`  name: ${tags["name"] || "(unnamed)"}`);
  console.log(`  ramsar: ${tags["ramsar"] || "no"}`);
  console.log(`  members: ${rel.members.length}`);

  const outerWays: Position[][] = [];
  const innerWays: Position[][] = [];

  for (const m of rel.members) {
    if (m.type !== "way" || !m.geometry) continue;
    const ring: Position[] = m.geometry.map((g) => [g.lon, g.lat]);
    if (ring.length < 2) continue;
    if (m.role === "outer") outerWays.push(ring);
    else if (m.role === "inner") innerWays.push(ring);
  }

  console.log(`  outer ways: ${outerWays.length}, inner ways: ${innerWays.length}`);

  const outerRings = stitchRings(outerWays);
  const innerRings = stitchRings(innerWays);
  console.log(
    `  stitched outer rings: ${outerRings.length}, inner rings: ${innerRings.length}`
  );

  const polygons = assignInnersToOuters(outerRings, innerRings);

  const geometry: MultiPolygon = {
    type: "MultiPolygon",
    coordinates: polygons,
  };

  const feature: Feature<MultiPolygon> = {
    type: "Feature",
    geometry,
    properties: {
      body_id: bodyId,
      osm_type: "relation",
      osm_id: parseInt(osmRel, 10),
      name: tags["name"] || displayName,
      name_en: tags["name:en"] || tags["name"] || displayName,
      name_ta: tags["name:ta"] || "",
      ramsar: tags["ramsar"] === "yes",
      protect_class: tags["protect_class"] || null,
      protection_title: tags["protection_title"] || null,
      start_date: tags["start_date"] || null,
      wikidata: tags["wikidata"] || null,
      wikipedia: tags["wikipedia"] || null,
      area_ha: Math.round((area(geometry) / 10000) * 100) / 100,
      source: `OSM relation ${osmRel}`,
      license: "ODbL",
      fetched_at: new Date().toISOString(),
    },
  };

  const outDir = join(process.cwd(), "public/geojson/rich-bodies");
  mkdirSync(outDir, { recursive: true });

  const bodyPath = join(outDir, `${bodyId}.geojson`);
  writeFileSync(
    bodyPath,
    JSON.stringify(
      { type: "FeatureCollection", features: [feature] },
      null,
      2
    )
  );
  console.log(`\nWrote ${bodyPath}`);
  console.log(`  area: ${feature.properties!.area_ha} ha`);

  if (bufferM > 0) {
    const buffered = buffer(feature, bufferM, { units: "meters" });
    if (!buffered) {
      throw new Error("Buffer computation returned null");
    }
    const bufFeature = {
      ...buffered,
      properties: {
        body_id: bodyId,
        buffer_metres: bufferM,
        source_polygon: `${bodyId}.geojson`,
        computed_with: "@turf/buffer",
        fetched_at: new Date().toISOString(),
      },
    };
    const bufPath = join(outDir, `${bodyId}-buffer-${bufferM}m.geojson`);
    writeFileSync(
      bufPath,
      JSON.stringify(
        { type: "FeatureCollection", features: [bufFeature] },
        null,
        2
      )
    );
    console.log(`Wrote ${bufPath}`);
    const bufGeom = bufFeature.geometry as Polygon | MultiPolygon;
    console.log(`  buffer area: ${Math.round(area(bufGeom) / 10000)} ha`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
