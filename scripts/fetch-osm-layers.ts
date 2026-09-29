/**
 * City-generic OpenStreetMap layer fetcher (Overpass). Per-city knowledge (bbox, select statements,
 * river-name rules, ward join) lives in scripts/osm-layers/<city>.json; each layer there names the
 * assembly method below that builds it.
 *
 * Run:
 *   npx tsx scripts/fetch-osm-layers.ts --city madurai --layer rivers
 *   npx tsx scripts/fetch-osm-layers.ts --city kolkata --layer all
 *
 * Outputs: see OUTPUT below ({city}-water-bodies-current, -rivers, -drainage, -industrial-zones,
 * {city}-localities). The old per-city script names
 * (fetch-rivers-osm-<city>.ts and friends) remain only as entry points the artifacts' produced_by cites.
 * Two forks remain until their Overpass pulls can be captured and diffed: fetch-localities-osm.ts
 * (Chennai) and fetch-water-bodies-osm-hyderabad.ts.
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import osmtogeojson from "osmtogeojson";
import { writeArtifact } from "./lib/nvdm-write";

type LayerName = "water-bodies" | "rivers" | "drainage" | "localities" | "industrial-zones";
type Coord = [number, number];
interface Clip { south: number; north: number; west: number; east: number }
interface River { id: string; match: string[]; local: string; waterway: string; waterways?: string[]; label?: string; clip?: Partial<Clip> }

interface Layer {
  /** Assembly method, a key of METHODS. */
  method: string;
  /** "south,west,north,east" exactly as sent to Overpass. */
  bbox: string;
  timeout?: number;
  select?: string[];
  refLat?: number;
  minAreaHa?: number;
  minAreaSqm?: number;
  waterProps?: boolean;
  exclude?: string[];
  labelRivers?: boolean;
  clip?: Clip;
  skip?: string[];
  rivers?: River[];
  rules?: Array<[string, string]>;
  labels?: Record<string, string>;
  metadata?: { source: string; note: string; script: string };
  wards?: string;
  profiles?: string;
  wikidata?: { parents: string };
}

interface CityConfig {
  /** OSM name:<lang> tag captured beside English. */
  lang: string;
  layers: Partial<Record<LayerName, Layer>>;
}

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

interface Built { data: object; count: number; compact?: boolean }

/* ── Overpass plumbing ────────────────────────────────────────────────────── */

const ENDPOINTS = process.env.OVERPASS_URL
  ? [process.env.OVERPASS_URL]
  : ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const USER_AGENT = "neer-vazhvu (https://neervazhvu.org; civic water dashboard)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const today = () => new Date().toISOString().slice(0, 10);

// Overpass sheds load with 429/504: rotate mirrors and back off rather than fail.
async function overpass(query: string): Promise<{ elements: OsmElement[] }> {
  for (let round = 1; ; round++) {
    for (const url of ENDPOINTS) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
        body: `data=${encodeURIComponent(query)}`,
      }).catch((e: Error) => e);
      if (res instanceof Response && res.ok) return res.json();
      console.error(`  ${new URL(url).host}: ${res instanceof Response ? res.status : res.message}`);
    }
    if (round === 3) throw new Error("Overpass unavailable after 3 rounds");
    await sleep(round * 20_000);
  }
}

const OUT = { recurse: "out body;\n>;\nout skel qt;", geom: "out body geom;", center: "out center tags;", body: "out body;" };
const WATER_SELECT = [
  'way["natural"="water"]',
  'relation["natural"="water"]["type"="multipolygon"]',
  'way["water"~"lake|reservoir|pond|tank"]',
  'way["landuse"="reservoir"]',
];

function ql(l: Layer, out: keyof typeof OUT): string {
  const lines = (l.select ?? WATER_SELECT).map((s) => `  ${s}(${l.bbox});`).join("\n");
  return `[out:json][timeout:${l.timeout ?? 90}];\n(\n${lines}\n);\n${OUT[out]}`;
}

/* ── Geometry helpers ─────────────────────────────────────────────────────── */

const round = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp;
const rad = (d: number) => (d * Math.PI) / 180;

function haversineKm(coords: number[][]): number {
  let length = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [lon1, lat1] = coords[i];
    const [lon2, lat2] = coords[i + 1];
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    length += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return length;
}

/** Shoelace area of a lon/lat ring in hectares, scaled at a reference latitude. */
function shoelaceHa(ring: number[][], refLat: number): number {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    area += ring[i][0] * ring[i + 1][1];
    area -= ring[i + 1][0] * ring[i][1];
  }
  return ((Math.abs(area) / 2) * 111320 * 111320 * Math.cos((refLat * Math.PI) / 180)) / 10000;
}

const nodeIndex = (els: OsmElement[]) =>
  new Map(els.filter((e) => e.type === "node" && e.lat != null && e.lon != null).map((e) => [e.id, [e.lon!, e.lat!] as Coord]));
const wayCoords = (way: OsmElement, nodes: Map<number, Coord>) =>
  (way.nodes ?? []).map((id) => nodes.get(id)).filter((c): c is Coord => c !== undefined);
const readJson = (rel: string) => JSON.parse(readFileSync(join(process.cwd(), rel), "utf-8"));

/* ── Water bodies and industrial zones ────────────────────────────────────── */

/** Hand-assembled closed ways and outer-member relations (Chennai). */
async function rings(_city: string, l: Layer, lang: string): Promise<Built> {
  const els = (await overpass(ql(l, "recurse"))).elements;
  const nodes = nodeIndex(els);
  const min = l.minAreaHa ?? 0.1;
  const closed = (c: Coord[]) => (c[0][0] !== c[c.length - 1][0] || c[0][1] !== c[c.length - 1][1] ? [...c, c[0]] : c);
  const features = [];
  for (const el of els) {
    if (el.type !== "way" && el.type !== "relation") continue;
    const tags = el.tags || {};
    const head = { osm_id: el.id, osm_type: el.type, name: tags["name"] || tags["name:en"] || "" };
    const water = l.waterProps
      ? { [`name_${lang}`]: tags[`name:${lang}`] || "", water_type: tags["water"] || tags["natural"] || tags["landuse"] || "water" }
      : {};
    if (el.type === "way") {
      const coords = wayCoords(el, nodes);
      if (el.nodes!.length < 4 || coords.length < 4) continue;
      const ring = closed(coords);
      const area_ha = round(shoelaceHa(ring, l.refLat!), 2);
      if (area_ha < min) continue;
      features.push({ type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: { ...head, ...water, area_ha } });
      continue;
    }
    const outer: Coord[][] = [];
    for (const m of el.members ?? []) {
      if (m.type !== "way" || m.role !== "outer") continue;
      const way = els.find((e) => e.type === "way" && e.id === m.ref);
      const coords = way ? wayCoords(way, nodes) : [];
      if (coords.length >= 4) outer.push(closed(coords));
    }
    if (!outer.length) continue;
    const sum = outer.reduce((s, r) => s + round(shoelaceHa(r, l.refLat!), 2), 0);
    // The water-body port floors the unrounded sum, the industrial port the rounded one.
    if ((l.waterProps ? sum : round(sum, 2)) < min) continue;
    features.push({
      type: "Feature",
      geometry: { type: "MultiPolygon", coordinates: outer.map((r) => [r]) },
      properties: { ...head, ...water, area_ha: round(sum, 2) },
    });
  }
  return { data: { type: "FeatureCollection", features }, count: features.length };
}

type PolyGeom = { type: "Polygon"; coordinates: number[][][] } | { type: "MultiPolygon"; coordinates: number[][][][] };

/** osmtogeojson assembly (Bangalore, Delhi, Hyderabad, Madurai): holes subtracted, drains optionally excluded. */
async function assembled(city: string, l: Layer, lang: string): Promise<Built> {
  const json = await overpass(ql(l, "geom"));
  const exclude = new Set(l.exclude ?? []);
  const ringHa = (r: number[][]) => shoelaceHa(r, l.refLat!);
  const features = [];
  type Raw = { id?: string; geometry: PolyGeom; properties: Record<string, string> | null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const f of ((osmtogeojson(json as any) as any).features ?? []) as Raw[]) {
    const geom = f.geometry;
    if (geom.type !== "Polygon" && geom.type !== "MultiPolygon") continue;
    const tags = f.properties ?? {};
    const water_type = tags["water"] || tags["natural"] || tags["landuse"] || "water";
    if (exclude.has(water_type)) continue;
    const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
    const area = polys.reduce((t, p) => (p.length ? t + Math.max(0, p.slice(1).reduce((a, r) => a - ringHa(r), ringHa(p[0]))) : t), 0);
    const area_ha = round(area, 2);
    if (area_ha < (l.minAreaHa ?? 0.1)) continue;
    const id = f.id ? /^(node|way|relation)\/(\d+)$/.exec(f.id) : null;
    features.push({
      type: "Feature",
      geometry: geom,
      properties: {
        osm_id: id ? Number(id[2]) : -1,
        osm_type: id ? id[1] : "",
        name: tags["name"] || tags["name:en"] || "",
        [`name_${lang}`]: tags[`name:${lang}`] || "",
        water_type,
        area_ha,
      },
    });
  }
  if (l.labelRivers) labelRiverPolygons(city, lang, features);
  return { data: { type: "FeatureCollection", features }, count: features.length };
}

/** Unnamed water_type=river polygons take the name of the nearest vertex of {city}-rivers.geojson (Madurai). */
function labelRiverPolygons(city: string, lang: string, features: Array<{ geometry: PolyGeom; properties: Record<string, unknown> }>) {
  let rivers: { features: Array<{ geometry: { type: string; coordinates: number[][] | number[][][] }; properties: Record<string, string> }> };
  try {
    rivers = readJson(`public/geojson/${city}-rivers.geojson`);
  } catch {
    return console.warn(`  (river-name post-process skipped: ${city}-rivers.geojson not found)`);
  }
  const pts: Array<{ lat: number; lng: number; name: string; local: string }> = [];
  for (const r of rivers.features) {
    const name = r.properties.name ?? "";
    if (!name) continue;
    const lines = (r.geometry.type === "LineString" ? [r.geometry.coordinates] : r.geometry.coordinates) as number[][][];
    for (const line of lines) for (const [lng, lat] of line) pts.push({ lat, lng, name, local: r.properties[`name_${lang}`] ?? "" });
  }
  const metres = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
    return 6371000 * 2 * Math.asin(Math.sqrt(a));
  };
  for (const f of features) {
    const p = f.properties;
    if (p.name || p.water_type !== "river") continue;
    const coords = f.geometry.type === "Polygon" ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
    if (!coords || coords.length === 0) continue;
    let latSum = 0;
    let lngSum = 0;
    for (const [lng, lat] of coords) {
      latSum += lat;
      lngSum += lng;
    }
    const [cLat, cLng] = [latSum / coords.length, lngSum / coords.length];
    let best = { d: Infinity, name: "", local: "" };
    for (const rp of pts) {
      const d = metres(cLat, cLng, rp.lat, rp.lng);
      if (d < best.d) best = { d, name: rp.name, local: rp.local };
    }
    if (best.name) Object.assign(p, { name: best.name, [`name_${lang}`]: best.local });
  }
}

/** Kolkata: standing-water allowlist, multipolygon outers stitched, largest first. */
async function allowlist(city: string, l: Layer, lang: string): Promise<Built> {
  const els = (await overpass(ql(l, "recurse"))).elements;
  const nodes = nodeIndex(els);
  const wayIndex = new Map(els.filter((e) => e.type === "way").map((e) => [e.id, e]));
  // Member ways of a multipolygon carry no tags; skip them so the relation is not emitted twice.
  const memberWayIds = new Set(els.flatMap((e) => (e.type === "relation" ? (e.members ?? []).filter((m) => m.type === "way").map((m) => m.ref) : [])));
  const features = [];
  for (const e of els) {
    if (!e.tags || (e.type === "way" && memberWayIds.has(e.id)) || (e.type !== "way" && e.type !== "relation")) continue;
    const t = e.tags;
    if (t.waterway === "drain" || t.water === "wastewater" || t.man_made === "wastewater_basin") continue;
    // Allowlist, not denylist: an unknown OSM value (water=river polygons, say) stays out of a pond inventory.
    const kind = t.water ?? t.natural ?? t.landuse ?? "water";
    if (!STANDING_WATER_KINDS.has(kind)) continue;
    const ring = e.type === "relation" ? relationOuterRing(e, wayIndex, nodes) : wayCoords(e, nodes);
    if (!ring || ring.length < 4) continue;
    const area = ringAreaSqm(ring);
    if (area < (l.minAreaSqm ?? 1000)) continue;
    features.push({
      type: "Feature" as const,
      properties: {
        osm_id: e.id,
        osm_type: e.type,
        name: t.name ?? null,
        name_local: t[`name:${lang}`] ?? null,
        // The shared water-bodies panel reads water_type and area_ha.
        water_type: kind,
        area_ha: Math.round((area / 10_000) * 100) / 100,
      },
      geometry: { type: "Polygon" as const, coordinates: [ring] },
    });
  }
  features.sort((a, b) => b.properties.area_ha - a.properties.area_ha);
  return { data: fc(features, city, "OpenStreetMap water bodies"), count: features.length };
}

const STANDING_WATER_KINDS = new Set(["pond", "lake", "reservoir", "water", "basin", "oxbow", "moat", "fishpond", "lagoon", "wetland"]);

function ringAreaSqm(coords: Coord[]): number {
  // Equirectangular at the ring's own latitude: well under a percent at city scale.
  if (coords.length < 3) return 0;
  const latRad = (coords[0][1] * Math.PI) / 180;
  let a = 0;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) a += coords[j][0] * coords[i][1] - coords[i][0] * coords[j][1];
  return Math.abs(a / 2) * 111_132 * (111_320 * Math.cos(latRad));
}

/** Stitch a relation's outer ways into closed rings and keep the largest (Rabindra and Subhash Sarobar are relations). */
function relationOuterRing(rel: OsmElement, ways: Map<number, OsmElement>, nodes: Map<number, Coord>): Coord[] | null {
  const pool = (rel.members ?? [])
    .filter((m) => m.type === "way" && (m.role === "outer" || m.role === ""))
    .map((m) => ways.get(m.ref))
    .filter(Boolean)
    .map((w) => wayCoords(w!, nodes))
    .filter((c) => c.length >= 2);
  if (!pool.length) return null;
  const key = (p: Coord) => `${p[0]},${p[1]}`;
  const found: Coord[][] = [];
  while (pool.length) {
    let ring = pool.shift()!;
    let extended = true;
    while (extended && key(ring[0]) !== key(ring[ring.length - 1])) {
      extended = false;
      for (let i = 0; i < pool.length; i++) {
        const seg = pool[i];
        const tail = ring[ring.length - 1];
        if (key(seg[0]) === key(tail)) ring = ring.concat(seg.slice(1));
        else if (key(seg[seg.length - 1]) === key(tail)) ring = ring.concat([...seg].reverse().slice(1));
        else continue;
        pool.splice(i, 1);
        extended = true;
        break;
      }
    }
    if (ring.length >= 4 && key(ring[0]) === key(ring[ring.length - 1])) found.push(ring);
  }
  return found.length ? found.sort((a, b) => ringAreaSqm(b) - ringAreaSqm(a))[0] : null;
}

/* ── Rivers ───────────────────────────────────────────────────────────────── */

/** Named channels grouped per river, extended through connected unnamed ways of an accepted
 *  waterway class so channels do not render with gaps, then clipped for display. */
async function walk(_city: string, l: Layer, lang: string): Promise<Built> {
  const els = (await overpass(ql(l, "recurse"))).elements;
  const rivers = new Map(l.rivers!.map((r) => [r.id, r]));
  // First matching rule wins, so the config lists rivers in check order (Delhi's canals before "yamuna").
  const keyOf = (name: string) => {
    const lower = name.toLowerCase();
    if (l.skip?.some((s) => lower.includes(s))) return null;
    return l.rivers!.find((r) => r.match.some((m) => lower.includes(m)))?.id ?? null;
  };
  const nameOf = (tags: Record<string, string>) => tags.name || tags["name:en"] || "";
  const nodes = nodeIndex(els);
  const wayMap = new Map<number, OsmElement>();
  for (const el of els) if (el.type === "way" && el.nodes) wayMap.set(el.id, el);
  const nodeToWays = new Map<number, number[]>();
  for (const way of wayMap.values()) for (const n of way.nodes!) nodeToWays.set(n, [...(nodeToWays.get(n) ?? []), way.id]);
  const inRelation = new Set(els.flatMap((e) => (e.type === "relation" ? (e.members ?? []).filter((m) => m.type === "way").map((m) => m.ref) : [])));
  const coordsOf = (way: OsmElement) => {
    const c = wayCoords(way, nodes);
    return c.length >= 2 ? c : null;
  };

  const groups = new Map<string, { segments: Coord[][]; osm_ids: number[]; way_ids: number[]; name: string }>();
  const add = (key: string, name: string, coords: Coord[], wayId: number, osmId: number, fromRelation: boolean) => {
    if (!groups.has(key)) groups.set(key, { segments: [], osm_ids: [], way_ids: [], name });
    const g = groups.get(key)!;
    g.segments.push(coords);
    g.way_ids.push(wayId);
    if (!fromRelation) g.osm_ids.push(osmId);
    else if (!g.osm_ids.includes(osmId)) g.osm_ids.push(osmId);
  };
  for (const el of els) {
    if (el.type !== "way" || !el.tags || inRelation.has(el.id)) continue;
    const key = keyOf(nameOf(el.tags));
    const way = key ? wayMap.get(el.id) : undefined;
    const coords = way ? coordsOf(way) : null;
    if (key && coords) add(key, nameOf(el.tags), coords, el.id, el.id, false);
  }
  for (const el of els) {
    if (el.type !== "relation" || !el.tags || !el.members) continue;
    const key = keyOf(nameOf(el.tags));
    if (!key) continue;
    for (const m of el.members) {
      const way = m.type === "way" ? wayMap.get(m.ref) : undefined;
      const coords = way ? coordsOf(way) : null;
      if (coords) add(key, nameOf(el.tags), coords, m.ref, el.id, true);
    }
  }

  for (const [key, g] of groups) {
    const accept = rivers.get(key)!.waterways ?? [rivers.get(key)!.waterway];
    const seen = new Set(g.way_ids);
    const queue = [...g.way_ids];
    while (queue.length) {
      const way = wayMap.get(queue.shift()!);
      if (!way) continue;
      for (const n of way.nodes!) {
        for (const id of nodeToWays.get(n) ?? []) {
          if (seen.has(id)) continue;
          const next = wayMap.get(id);
          if (!next?.tags || !accept.includes(next.tags.waterway ?? "")) continue;
          const nextName = nameOf(next.tags);
          const nextKey = nextName ? keyOf(nextName) : null;
          if (nextKey && nextKey !== key) continue;
          const coords = coordsOf(next);
          if (!coords) continue;
          seen.add(id);
          queue.push(id);
          g.segments.push(coords);
          g.way_ids.push(id);
          g.osm_ids.push(id);
        }
      }
    }
  }

  const [s, w, n, e] = l.bbox.split(",").map(Number);
  const defaultClip = l.clip ?? { south: s, north: n, west: w, east: e };
  const features = [];
  for (const [key, { segments, osm_ids, name }] of groups) {
    const r = rivers.get(key)!;
    const c = { ...defaultClip, ...r.clip };
    const clipped = segments
      .map((seg) => seg.filter(([lon, lat]) => lat >= c.south && lat <= c.north && lon >= c.west && lon <= c.east))
      .filter((seg) => seg.length >= 2);
    if (!clipped.length) continue;
    const km = clipped.reduce((sum, seg) => sum + haversineKm(seg), 0);
    features.push({
      type: "Feature",
      geometry: clipped.length === 1 ? { type: "LineString", coordinates: clipped[0] } : { type: "MultiLineString", coordinates: clipped },
      properties: { river_id: r.id, name: r.label ?? name, [`name_${lang}`]: r.local, waterway: r.waterway, length_km: round(km, 1), osm_ids },
    });
    console.log(`  ${r.id}: ${segments.length} raw segments, ${clipped.length} rendered, ~${Math.round(km)} km`);
  }
  if (!features.length) throw new Error("No river features found - check the Overpass query or bbox");
  return { data: { type: "FeatureCollection", features }, count: features.length };
}

/** Kolkata: one feature per river id, raw OSM segments dissolved, no walk or clip. */
async function dissolve(city: string, l: Layer, lang: string): Promise<Built> {
  const els = (await overpass(ql(l, "recurse"))).elements;
  const nodes = nodeIndex(els);
  const rules = l.rules!.map(([re, id]) => [new RegExp(re, "i"), id] as const);
  const tag = `name:${lang}`;
  const byRiver = new Map<string, { name: string; nameLocal: string | null; waterway: string; lines: Coord[][]; ids: number[] }>();
  for (const e of els) {
    if (e.type !== "way" || !e.tags?.name) continue;
    const line = wayCoords(e, nodes);
    if (line.length < 2) continue;
    const rid = rules.find(([re]) => re.test(e.tags!.name))?.[1];
    if (!rid) continue;
    const entry = byRiver.get(rid) ?? {
      name: l.labels?.[rid] ?? e.tags.name,
      nameLocal: e.tags[tag] ?? null,
      waterway: e.tags.waterway ?? "river",
      lines: [],
      ids: [],
    };
    entry.lines.push(line);
    entry.ids.push(e.id);
    if (!entry.nameLocal && e.tags[tag]) entry.nameLocal = e.tags[tag];
    byRiver.set(rid, entry);
  }
  const features = [...byRiver.entries()].map(([rid, r]) => ({
    type: "Feature" as const,
    properties: {
      river_id: rid,
      name: r.name,
      name_local: r.nameLocal,
      waterway: r.waterway,
      length_km: Math.round(r.lines.reduce((sum, line) => sum + equirectKm(line), 0)),
      segments: r.lines.length,
      osm_ids: r.ids,
    },
    geometry: { type: "MultiLineString" as const, coordinates: r.lines },
  }));
  features.sort((a, b) => b.properties.length_km - a.properties.length_km);
  return { data: fc(features, city, "OpenStreetMap named channels, dissolved per river"), count: features.length };
}

function equirectKm(line: Coord[]): number {
  let km = 0;
  for (let i = 1; i < line.length; i++) {
    const [x1, y1] = line[i - 1];
    const [x2, y2] = line[i];
    km += Math.hypot((x2 - x1) * 111.32 * Math.cos(((y1 + y2) / 2) * Math.PI / 180), (y2 - y1) * 111.132);
  }
  return km;
}

/* ── Drainage ─────────────────────────────────────────────────────────────── */

/** Per-way drain segments with length and covered flag, stamped with the layer's metadata (Delhi). */
async function measured(_city: string, l: Layer, lang: string): Promise<Built> {
  const els = (await overpass(ql(l, "recurse"))).elements;
  const nodes = nodeIndex(els);
  const features = [];
  for (const el of els) {
    if (el.type !== "way" || !el.nodes) continue;
    const coords = wayCoords(el, nodes);
    if (coords.length < 2) continue;
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: coords },
      properties: {
        osm_id: el.id,
        name: el.tags?.name || el.tags?.["name:en"] || "",
        [`name_${lang}`]: el.tags?.[`name:${lang}`] || "",
        covered: el.tags?.covered === "yes" || el.tags?.tunnel != null,
        length_km: round(haversineKm(coords), 2),
      },
    });
  }
  const { source, note, script } = l.metadata!;
  const data = { type: "FeatureCollection", metadata: { source, note, fetched: today(), script }, features };
  return { data, count: features.length, compact: true };
}

/** Kolkata: plain per-way drains and ditches. */
async function plain(city: string, l: Layer): Promise<Built> {
  const els = (await overpass(ql(l, "recurse"))).elements;
  const nodes = nodeIndex(els);
  const features = els
    .filter((e) => e.type === "way")
    .map((e) => ({ e, line: wayCoords(e, nodes) }))
    .filter(({ line }) => line.length >= 2)
    .map(({ e, line }) => ({
      type: "Feature" as const,
      properties: { osm_id: e.id, name: e.tags?.name ?? null, waterway: e.tags?.waterway ?? "drain" },
      geometry: { type: "LineString" as const, coordinates: line },
    }));
  return { data: fc(features, city, "OpenStreetMap drains and ditches"), count: features.length };
}

/* ── Localities ───────────────────────────────────────────────────────────── */

/** OSM places (plus Wikidata settlements where configured) joined to their ward and zone; outside-ward points drop. */
async function wardJoin(_city: string, l: Layer, lang: string): Promise<Built> {
  const [osm, wiki] = await Promise.all([overpass(ql(l, "center")), l.wikidata ? wikidata(l.wikidata.parents, lang) : []]);
  const wards = readJson(l.wards!).features as Array<{ properties?: Record<string, unknown> }>;
  const raw = readJson(l.profiles!);
  const profiles: Array<{ ward_number: number; zone_no: string; zone_name: string }> = Array.isArray(raw) ? raw : raw.wards;
  const profileMap = new Map(profiles.map((p) => [p.ward_number, p]));
  const findWard = (lat: number, lng: number): number | null => {
    const pt = point([lng, lat]);
    for (const f of wards) {
      try {
        if (booleanPointInPolygon(pt, f as Parameters<typeof booleanPointInPolygon>[1])) {
          const n = f.properties?.ward_no ?? f.properties?.Ward_No ?? f.properties?.ward_number ?? f.properties?.WARD_NO;
          return typeof n === "number" ? n : null;
        }
      } catch {
        // skip malformed features
      }
    }
    return null;
  };
  const seen = new Set<string>();
  const rows: object[] = [];
  const consider = (name: string, local: string | undefined, c: { lat: number; lng: number } | null, place?: string) => {
    if (!name || seen.has(name.toLowerCase().trim()) || !c) return;
    const ward = findWard(c.lat, c.lng);
    const profile = ward ? profileMap.get(ward) : undefined;
    if (!profile) return;
    seen.add(name.toLowerCase().trim());
    const type = place === "neighbourhood" || place === "quarter" ? place : "suburb";
    rows.push({ name: name.trim(), name_ta: local, type, lat: c.lat, lng: c.lng, ward_number: ward, zone_name: profile.zone_name, zone_no: profile.zone_no });
  };
  for (const el of osm.elements) {
    const tags = el.tags || {};
    const at = el.type === "node" ? (el.lat != null && el.lon != null ? { lat: el.lat, lon: el.lon } : null) : el.center;
    const c = at ? { lat: at.lat, lng: at.lon } : null;
    // name_ta is the consumer's field name for the local-language name in every city.
    consider(tags["name:en"] || tags["name"] || "", tags[`name:${lang}`] || undefined, c, tags["place"]);
  }
  for (const b of wiki) {
    const m = b.coord?.value.match(/Point\(([\d.\-]+)\s+([\d.\-]+)\)/);
    consider(b.itemLabel?.value ?? "", b.taLabel?.value || undefined, m ? { lng: parseFloat(m[1]), lat: parseFloat(m[2]) } : null);
  }
  rows.sort((a, b) => (a as { name: string }).name.localeCompare((b as { name: string }).name));
  return { data: rows, count: rows.length };
}

type Binding = { itemLabel?: { value: string }; taLabel?: { value: string }; coord?: { value: string } };

/** Wikidata settlements under the given parents, with their <lang> label; empty on failure (OSM alone still ships). */
async function wikidata(parents: string, lang: string): Promise<Binding[]> {
  const query = `
SELECT DISTINCT ?item ?itemLabel ?taLabel ?coord WHERE {
  ?item wdt:P131+ ?parent.
  VALUES ?parent { ${parents} }
  ?item wdt:P31/wdt:P279* ?type.
  VALUES ?type {
    wd:Q5283  wd:Q123705 wd:Q3957  wd:Q486972
    wd:Q15640612 wd:Q702492 wd:Q1968296
    wd:Q532   wd:Q15259  wd:Q15078955
  }
  ?item wdt:P625 ?coord.
  OPTIONAL { ?item rdfs:label ?taLabel FILTER(LANG(?taLabel) = "${lang}"). }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 1000
`.trim();
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/sparql-results+json", "User-Agent": USER_AGENT } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return ((await res.json()) as { results: { bindings: Binding[] } }).results.bindings;
    } catch (err) {
      console.warn(`  Wikidata attempt ${attempt}: ${err}`);
      if (attempt < 3) await sleep(2000 * attempt);
    }
  }
  console.warn("  Wikidata unavailable; continuing with OSM only");
  return [];
}

/** Kolkata: named place nodes as a search index, no ward join (its ward geometry is 141 of 144). */
async function points(_city: string, l: Layer, lang: string): Promise<Built> {
  const els = (await overpass(ql(l, "body"))).elements;
  const rows = els
    .filter((e) => e.type === "node" && e.tags?.name && e.lat != null && e.lon != null)
    .map((e) => ({
      name: e.tags!.name,
      ...(e.tags![`name:${lang}`] ? { name_local: e.tags![`name:${lang}`] } : {}),
      type: e.tags!.place,
      lat: e.lat!,
      lng: e.lon!,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { data: rows, count: rows.length };
}

function fc(features: unknown[], city: string, what: string) {
  return { type: "FeatureCollection", _source: "OpenStreetMap contributors (ODbL 1.0), via Overpass", _what: what, _city: city, _generated: today(), features };
}

/* ── CLI ──────────────────────────────────────────────────────────────────── */

const METHODS = { rings, assembled, allowlist, walk, dissolve, measured, plain, "ward-join": wardJoin, points };
const OUTPUT: Record<LayerName, string> = {
  "water-bodies": "public/geojson/{city}-water-bodies-current.geojson",
  rivers: "public/geojson/{city}-rivers.geojson",
  drainage: "public/geojson/{city}-drainage.geojson",
  "industrial-zones": "public/geojson/{city}-industrial-zones.geojson",
  localities: "public/data/{city}-localities.json",
};
const CONFIG_DIR = join(__dirname, "osm-layers");

async function run(args: string[]) {
  const city = args[args.indexOf("--city") + 1];
  const layerArg = args.includes("--layer") ? args[args.indexOf("--layer") + 1] : "all";
  const known = readdirSync(CONFIG_DIR).map((f) => f.replace(/\.json$/, ""));
  if (!known.includes(city)) {
    console.error(`Unknown city '${city}'. Known: ${known.join(", ")}`);
    process.exit(2);
  }
  const cfg: CityConfig = JSON.parse(readFileSync(join(CONFIG_DIR, `${city}.json`), "utf-8"));
  const layers = (layerArg === "all" ? Object.keys(cfg.layers) : [layerArg]) as LayerName[];
  for (const [i, name] of layers.entries()) {
    const l = cfg.layers[name];
    if (!l) throw new Error(`${city} has no '${name}' layer in scripts/osm-layers/${city}.json`);
    if (i > 0) await sleep(5_000); // be a good Overpass citizen between layers
    const build = METHODS[l.method as keyof typeof METHODS];
    if (!build) throw new Error(`Unknown method '${l.method}' (known: ${Object.keys(METHODS).join(", ")})`);
    const { data, count, compact } = await build(city, l, cfg.lang);
    writeArtifact(join(process.cwd(), OUTPUT[name].replace("{city}", city)), data, { compact });
    console.error(`${city} ${name}: ${count} features`);
  }
}

export function main(args: string[]): void {
  run(args).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

if (require.main === module) main(process.argv.slice(2));
