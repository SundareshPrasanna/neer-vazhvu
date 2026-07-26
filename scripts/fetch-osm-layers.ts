/**
 * City-generic OpenStreetMap layer fetcher (Overpass).
 *
 * Replaces the per-city clone pattern (fetch-water-bodies-osm-delhi.ts,
 * fetch-rivers-osm-delhi.ts, fetch-drainage-osm-delhi.ts,
 * fetch-localities-osm-delhi.ts and their Bangalore/Mumbai ancestors) with one
 * script parameterised by city. Those four scripts x five cities was heading
 * for twenty near-identical files differing only in a bbox and a name regex,
 * which is the fork pattern docs/specs/multi-city-component-discipline.md
 * exists to prevent. Existing per-city scripts are left alone; new cities use
 * this one.
 *
 * Per-city knowledge lives in CITY_LAYERS below - a bbox, a river-name regex,
 * a locality ward-join strategy. Everything else is shared.
 *
 * Run:
 *   npx tsx scripts/fetch-osm-layers.ts --city kolkata --layer water-bodies
 *   npx tsx scripts/fetch-osm-layers.ts --city kolkata --layer all
 *
 * Outputs (matching the established naming the pages already read):
 *   public/geojson/{city}-water-bodies-current.geojson
 *   public/geojson/{city}-rivers.geojson
 *   public/geojson/{city}-drainage.geojson
 *   public/data/{city}-localities.json
 */

import { writeFileSync } from "fs";
import { join } from "path";

const OVERPASS_URL = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";

type LayerName = "water-bodies" | "rivers" | "drainage" | "localities";

interface CityLayerConfig {
  /** [south, west, north, east] - the administrative extent. */
  bbox: [number, number, number, number];
  /** Wider box for rivers, which need upstream/downstream context. */
  riverBbox?: [number, number, number, number];
  /** Named channels worth carrying. OSM tags thousands of unnamed drains; an
   *  unfiltered pull is unusable, so each city names its rivers explicitly. */
  riverNames: string;
  /** Second-language OSM name tag to capture alongside English. */
  localNameTag?: string;
  /** Minimum water-body area in m2. Below this OSM is mostly noise. */
  minAreaSqm?: number;
}

const CITY_LAYERS: Record<string, CityLayerConfig> = {
  // Kolkata: KMC plus the verified out-of-KMC units (EKW east, Palta ~22 km
  // north, Budge Budge south) - matches bbox in src/lib/cities/kolkata.ts.
  kolkata: {
    bbox: [22.35, 88.15, 22.85, 88.55],
    // Wider for rivers: the Hooghly's reach from above Palta down to the
    // estuary mouth, so the intake and the tidal Adi Ganga both sit in context.
    riverBbox: [22.1, 88.0, 23.0, 88.7],
    // The Adi Ganga is the original course of the Ganga through south Kolkata
    // and is the city's signature polluted channel; Tolly's Nullah is its
    // engineered reach and OSM uses both names. Bidyadhari and Kulti drain the
    // wetlands eastward.
    riverNames: "Hooghly|Hugli|Adi Ganga|Tolly|Bidyadhari|Kulti|Ganga|Bhagirathi|Saraswati",
    localNameTag: "name:bn",
    minAreaSqm: 1000,
  },
};

/* ── Overpass plumbing (shared) ───────────────────────────────────────────── */

interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  center?: { lat: number; lon: number };
  members?: Array<{ type: string; ref: number; role: string }>;
  tags?: Record<string, string>;
}

async function overpass(query: string): Promise<OsmElement[]> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "neer-vazhvu (https://neervazhvu.org; civic water dashboard)",
      },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (res.ok) return ((await res.json()) as { elements: OsmElement[] }).elements;
    // Overpass rate-limits with 429/504 under load; back off rather than fail.
    if (attempt === 3) throw new Error(`Overpass ${res.status} after ${attempt} attempts`);
    await new Promise((r) => setTimeout(r, attempt * 20_000));
  }
  return [];
}

function ringArea(coords: [number, number][]): number {
  // Spherical excess is overkill at city scale; equirectangular at the ring's
  // own latitude is accurate to well under a percent here.
  if (coords.length < 3) return 0;
  const latRad = (coords[0][1] * Math.PI) / 180;
  const mPerDegLat = 111_132;
  const mPerDegLng = 111_320 * Math.cos(latRad);
  let a = 0;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    a += coords[j][0] * coords[i][1] - coords[i][0] * coords[j][1];
  }
  return Math.abs(a / 2) * mPerDegLat * mPerDegLng;
}

function buildNodeIndex(els: OsmElement[]): Map<number, [number, number]> {
  const m = new Map<number, [number, number]>();
  for (const e of els) if (e.type === "node" && e.lat != null && e.lon != null) m.set(e.id, [e.lon, e.lat]);
  return m;
}

function wayCoords(way: OsmElement, nodes: Map<number, [number, number]>): [number, number][] {
  return (way.nodes ?? []).map((id) => nodes.get(id)).filter(Boolean) as [number, number][];
}

/**
 * Stitch a multipolygon relation's `outer` member ways into closed rings.
 *
 * Non-optional, not a nicety: Kolkata's two most significant named lakes -
 * Rabindra Sarobar and Subhash Sarobar, both sampled by WBPCB - are mapped as
 * relations, not ways. A ways-only pass drops them silently, which is the
 * failure mode this whole layer exists to avoid. OSM also spells them
 * "Sarobar" rather than the "Sarovar" most sources use.
 *
 * Returns the largest assembled ring; lakes are single-outer in practice and
 * we would rather under-claim than emit a broken multi-ring polygon.
 */
function relationOuterRing(
  rel: OsmElement,
  ways: Map<number, OsmElement>,
  nodes: Map<number, [number, number]>,
): [number, number][] | null {
  const segments = (rel.members ?? [])
    .filter((m) => m.type === "way" && (m.role === "outer" || m.role === ""))
    .map((m) => ways.get(m.ref))
    .filter(Boolean)
    .map((w) => wayCoords(w!, nodes))
    .filter((c) => c.length >= 2);
  if (!segments.length) return null;

  const key = (p: [number, number]) => `${p[0]},${p[1]}`;
  const rings: [number, number][][] = [];
  const pool = [...segments];

  while (pool.length) {
    let ring = pool.shift()!;
    let extended = true;
    while (extended && key(ring[0]) !== key(ring[ring.length - 1])) {
      extended = false;
      for (let i = 0; i < pool.length; i++) {
        const seg = pool[i];
        const tail = ring[ring.length - 1];
        if (key(seg[0]) === key(tail)) {
          ring = ring.concat(seg.slice(1));
        } else if (key(seg[seg.length - 1]) === key(tail)) {
          ring = ring.concat([...seg].reverse().slice(1));
        } else {
          continue;
        }
        pool.splice(i, 1);
        extended = true;
        break;
      }
    }
    if (ring.length >= 4 && key(ring[0]) === key(ring[ring.length - 1])) rings.push(ring);
  }
  if (!rings.length) return null;
  return rings.sort((a, b) => ringArea(b) - ringArea(a))[0];
}

/* ── Layers ───────────────────────────────────────────────────────────────── */

/** Standing water only. Flowing/marine kinds (river, canal, ditch, stream,
 *  harbour) are channels and belong to the rivers/drainage layers. `basin` is
 *  kept deliberately: in Kolkata the East Kolkata Wetlands' sewage-fed
 *  fisheries (bheris) map as basins, and they are the point of the city. */
const STANDING_WATER_KINDS = new Set([
  "pond", "lake", "reservoir", "water", "basin", "oxbow", "moat", "fishpond", "lagoon", "wetland",
]);

async function waterBodies(city: string, cfg: CityLayerConfig) {
  const b = cfg.bbox.join(",");
  const els = await overpass(`
[out:json][timeout:180];
(
  way["natural"="water"](${b});
  relation["natural"="water"]["type"="multipolygon"](${b});
  way["water"~"lake|reservoir|pond|tank"](${b});
  way["landuse"="reservoir"](${b});
);
out body;
>;
out skel qt;`);

  const nodes = buildNodeIndex(els);
  const wayIndex = new Map<number, OsmElement>();
  for (const e of els) if (e.type === "way") wayIndex.set(e.id, e);
  // Member ways of a multipolygon carry no tags of their own; skip them so the
  // relation is not also emitted as its own untagged fragments.
  const memberWayIds = new Set<number>();
  for (const e of els) {
    if (e.type === "relation") for (const m of e.members ?? []) if (m.type === "way") memberWayIds.add(m.ref);
  }
  const min = cfg.minAreaSqm ?? 1000;
  const features = [];
  for (const e of els) {
    if (!e.tags) continue;
    if (e.type === "way" && memberWayIds.has(e.id)) continue;
    if (e.type !== "way" && e.type !== "relation") continue;
    const t = e.tags;
    // Drains and wastewater basins are not water bodies; they belong to the
    // drainage layer and would otherwise inflate the pond count.
    if (t.waterway === "drain" || t.water === "wastewater" || t.man_made === "wastewater_basin") continue;
    // ALLOWLIST, not a denylist: an unknown future OSM value defaults to
    // excluded rather than silently polluting a pond inventory. This matters -
    // the first Kolkata pull returned 16 `water=river` polygons carrying
    // 1,828 ha, three of them larger than every genuine lake in the city, which
    // would have made the Hooghly itself the biggest "water body" in Kolkata.
    // Channels belong to the rivers and drainage layers.
    const kind = t.water ?? t.natural ?? t.landuse ?? "water";
    if (!STANDING_WATER_KINDS.has(kind)) continue;
    const ring =
      e.type === "relation" ? relationOuterRing(e, wayIndex, nodes) : wayCoords(e, nodes);
    if (!ring || ring.length < 4) continue;
    const area = ringArea(ring);
    if (area < min) continue;
    features.push({
      type: "Feature" as const,
      properties: {
        osm_id: e.id,
        osm_type: e.type,
        name: t.name ?? null,
        name_local: cfg.localNameTag ? (t[cfg.localNameTag] ?? null) : null,
        kind,
        area_sqm: Math.round(area),
      },
      geometry: { type: "Polygon" as const, coordinates: [ring] },
    });
  }
  features.sort((a, b2) => b2.properties.area_sqm - a.properties.area_sqm);
  write(`public/geojson/${city}-water-bodies-current.geojson`, fc(features, city, "OpenStreetMap water bodies"));
  return features.length;
}

async function rivers(city: string, cfg: CityLayerConfig) {
  const b = (cfg.riverBbox ?? cfg.bbox).join(",");
  const els = await overpass(`
[out:json][timeout:180];
(
  way["waterway"~"^(river|canal|stream)$"]["name"~"${cfg.riverNames}",i](${b});
  relation["waterway"~"^(river|canal)$"]["name"~"${cfg.riverNames}",i](${b});
);
out body;
>;
out skel qt;`);

  const nodes = buildNodeIndex(els);
  const features = [];
  for (const e of els) {
    if (e.type !== "way" || !e.tags?.name) continue;
    const line = wayCoords(e, nodes);
    if (line.length < 2) continue;
    features.push({
      type: "Feature" as const,
      properties: {
        osm_id: e.id,
        name: e.tags.name,
        name_local: cfg.localNameTag ? (e.tags[cfg.localNameTag] ?? null) : null,
        waterway: e.tags.waterway,
      },
      geometry: { type: "LineString" as const, coordinates: line },
    });
  }
  write(`public/geojson/${city}-rivers.geojson`, fc(features, city, "OpenStreetMap named channels"));
  return features.length;
}

async function drainage(city: string, cfg: CityLayerConfig) {
  const b = cfg.bbox.join(",");
  const els = await overpass(`
[out:json][timeout:180];
(
  way["waterway"="drain"](${b});
  way["waterway"="ditch"](${b});
);
out body;
>;
out skel qt;`);

  const nodes = buildNodeIndex(els);
  const features = [];
  for (const e of els) {
    if (e.type !== "way") continue;
    const line = wayCoords(e, nodes);
    if (line.length < 2) continue;
    features.push({
      type: "Feature" as const,
      properties: { osm_id: e.id, name: e.tags?.name ?? null, waterway: e.tags?.waterway ?? "drain" },
      geometry: { type: "LineString" as const, coordinates: line },
    });
  }
  write(`public/geojson/${city}-drainage.geojson`, fc(features, city, "OpenStreetMap drains and ditches"));
  return features.length;
}

async function localities(city: string, cfg: CityLayerConfig) {
  const b = cfg.bbox.join(",");
  const els = await overpass(`
[out:json][timeout:180];
(
  node["place"~"^(suburb|neighbourhood|quarter|village|town)$"](${b});
);
out body;`);

  const rows = els
    .filter((e) => e.type === "node" && e.tags?.name && e.lat != null && e.lon != null)
    .map((e) => ({
      name: e.tags!.name,
      ...(cfg.localNameTag && e.tags![cfg.localNameTag] ? { name_local: e.tags![cfg.localNameTag] } : {}),
      type: e.tags!.place,
      lat: e.lat!,
      lng: e.lon!,
    }))
    .sort((a, b2) => a.name.localeCompare(b2.name));

  // No ward_number here: Kolkata's ward geometry is 141 of 144 with no names
  // or boroughs, so a point-in-polygon join would silently drop localities in
  // the three missing wards. The join lands with the ward-geometry work.
  write(`public/data/${city}-localities.json`, rows);
  return rows.length;
}

/* ── Output helpers ───────────────────────────────────────────────────────── */

function fc(features: unknown[], city: string, what: string) {
  return {
    type: "FeatureCollection",
    _source: "OpenStreetMap contributors (ODbL 1.0), via Overpass",
    _what: what,
    _city: city,
    _generated: new Date().toISOString().slice(0, 10),
    features,
  };
}

function write(rel: string, data: unknown) {
  writeFileSync(join(process.cwd(), rel), JSON.stringify(data, null, 1));
}

/* ── CLI ──────────────────────────────────────────────────────────────────── */

async function main() {
  const args = process.argv.slice(2);
  const city = args[args.indexOf("--city") + 1];
  const layerArg = (args[args.indexOf("--layer") + 1] ?? "all") as LayerName | "all";
  const cfg = CITY_LAYERS[city];
  if (!cfg) {
    console.error(`Unknown city '${city}'. Known: ${Object.keys(CITY_LAYERS).join(", ")}`);
    process.exit(2);
  }

  const runners: Record<LayerName, () => Promise<number>> = {
    "water-bodies": () => waterBodies(city, cfg),
    rivers: () => rivers(city, cfg),
    drainage: () => drainage(city, cfg),
    localities: () => localities(city, cfg),
  };
  const layers: LayerName[] =
    layerArg === "all" ? (Object.keys(runners) as LayerName[]) : [layerArg];

  for (const l of layers) {
    const n = await runners[l]();
    console.error(`${city} ${l}: ${n} features`);
    // Be a good Overpass citizen between layers.
    if (layers.length > 1) await new Promise((r) => setTimeout(r, 5_000));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
