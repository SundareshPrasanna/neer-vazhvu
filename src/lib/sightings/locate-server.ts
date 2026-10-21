import "server-only";

import type { FeatureCollection, GeoJsonProperties } from "geojson";

import { listEnabledPlaces } from "@/lib/cities";
import { corporationsGeoJsonPathFor, wardsGeoJsonPathFor } from "@/lib/cities/data-paths";
import type { PlaceConfig } from "@/lib/cities/types";
import type { DistrictDirectoryArtifact } from "@/lib/atlas/artifacts";
import { listPublishedAtlasDistricts, type AtlasDistrict } from "@/lib/atlas/registry";
import { listBasins, type BasinManifest } from "@/lib/basins";
import { wardNumberOf } from "@/lib/utils/ward-number";
import { listWaterways } from "@/lib/waterways";
import {
  containing,
  distanceKm,
  inBBox,
  indexLines,
  indexPolygons,
  linesNear,
  nearest,
  polygonsNear,
  type BBox,
  type IndexedLine,
  type IndexedPolygon,
} from "./locate";
import type { NearbyWater } from "./types";

/** Where a report lands. Resolved on the server from GPS only. */
export interface Placement {
  placeKind: "city" | "district" | "basin";
  /** cityId, the district's scope id, or the basinId. */
  placeId: string;
  placeName: string;
  stateCode: string;
  corporationId: string | null;
  wardId: string | null;
  wardName: string | null;
  blockCode: string | null;
  panchayatCode: string | null;
  panchayatName: string | null;
  waterBodyId: string | null;
  waterBodyName: string | null;
  /** Town or district a basin's own map names at the point. */
  locality: string | null;
}

interface CityGeo {
  wards: IndexedPolygon[];
  bodies: IndexedPolygon[];
  corporations: IndexedPolygon[];
}

type Panchayat = { code: string; name: string; blockCode: string; centroid: [number, number]; bbox: BBox };

// Geometry is fetched from the site's own static files, not bundled: the
// function stays small and every deployment's lambda stays small.
const cache = new Map<string, Promise<unknown>>();

/** Towns and reservoirs in onboarded districts lie 2-5 km from a panchayat centre; neighbouring districts 12 km and more. */
export const DISTRICT_REACH_KM = 5;

/** A static file of this deployment; `missing` when it has none (404), which holds for the deployment's life. */
export async function load(url: string): Promise<{ json: unknown; missing: boolean }> {
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  try {
    const r = await fetch(url, { cache: "no-store", headers: bypass ? { "x-vercel-protection-bypass": bypass } : {} });
    return r.ok ? { json: await r.json(), missing: false } : { json: null, missing: r.status === 404 };
  } catch {
    return { json: null, missing: false };
  }
}

/** Once per instance: a failed fetch is tried again next time, a file the deployment does not have is not. */
function once<T>(store: Map<string, Promise<T | null>>, url: string, make: (json: unknown) => T): Promise<T | null> {
  if (!store.has(url)) {
    const p = load(url).then(({ json, missing }) => {
      if (json == null && !missing) store.delete(url);
      return json == null ? null : make(json);
    });
    store.set(url, p);
  }
  return store.get(url)!;
}

/** A file an earlier lookup already holds, for readers that must not keep whole files themselves (suggest-server.ts). */
export const held = (url: string): Promise<unknown> | null => cache.get(url) ?? null;

function getJson<T>(origin: string, path: string | null): Promise<T | null> {
  return path ? (once(cache, `${origin}${path}`, (json) => json) as Promise<T | null>) : Promise.resolve(null);
}

/** A loaded file's polygons with their boxes, indexed once per file rather than on every lookup. */
const indexes = new WeakMap<FeatureCollection, IndexedPolygon[]>();
function indexed(fc: FeatureCollection | null): IndexedPolygon[] {
  if (!fc) return [];
  if (!indexes.has(fc)) indexes.set(fc, indexPolygons(fc));
  return indexes.get(fc)!;
}

async function geoFor(origin: string, cityId: string): Promise<CityGeo> {
  const [wards, bodies, corporations] = await Promise.all([
    getJson<FeatureCollection>(origin, wardsGeoJsonPathFor(cityId)),
    getJson<FeatureCollection>(origin, `/geojson/${cityId}-water-bodies-current.geojson`),
    getJson<FeatureCollection>(origin, corporationsGeoJsonPathFor(cityId)),
  ]);
  return { wards: indexed(wards), bodies: indexed(bodies), corporations: indexed(corporations) };
}

async function panchayatsOf(origin: string, d: AtlasDistrict): Promise<Panchayat[]> {
  const dir = await getJson<DistrictDirectoryArtifact>(origin, `/data/atlas/${d.stateSlug}/${d.slug}/directory.json`);
  return (dir?.panchayats ?? []).flatMap((p) =>
    p.boundary ? [{ code: p.lgdCode, name: p.name, blockCode: p.blockCode, centroid: p.boundary.centroid, bbox: p.boundary.bbox }] : [],
  );
}

const box = (b: { west: number; south: number; east: number; north: number }): BBox => [b.west, b.south, b.east, b.north];

/**
 * A region's corporation: its boundary file, the ward's own tag, or the nearest
 * configured box. Ward geometry covers only corporations with a ward count, so a
 * point inside the wards picks among those and a point outside among the rest.
 */
function corporationOf(c: PlaceConfig, geo: CityGeo, ward: GeoJsonProperties | null, lng: number, lat: number): string | null {
  const fromFile = containing(geo.corporations, lng, lat)?.properties?.corporation_id;
  if (fromFile != null) return String(fromFile);
  if (ward?.corporation != null) return String(ward.corporation).toLowerCase();
  const pool = (c.corporations ?? []).filter(
    (k) => inBBox(lng, lat, box(k.bbox)) && (geo.wards.length === 0 || (k.wardCount != null) === (ward != null)),
  );
  return nearest(pool.map((k) => ({ id: k.corporationId, centroid: [k.center.lng, k.center.lat] as [number, number] })), lng, lat)?.id ?? null;
}

function cityPlacement(c: PlaceConfig, geo: CityGeo, ward: GeoJsonProperties | null, lng: number, lat: number): Placement {
  const body = containing(geo.bodies, lng, lat)?.properties;
  const wardNo = ward ? wardNumberOf(ward) : null;
  return {
    placeKind: "city",
    placeId: c.cityId,
    placeName: c.displayName,
    stateCode: c.stateCode,
    corporationId: corporationOf(c, geo, ward, lng, lat),
    wardId: wardNo != null ? String(wardNo) : null,
    wardName: (ward?.ward_name as string) || (ward?.ward_label as string) || null,
    blockCode: null,
    panchayatCode: null,
    panchayatName: null,
    waterBodyId: body?.osm_id != null ? String(body.osm_id) : null,
    waterBodyName: (body?.name as string) || null,
    locality: null,
  };
}

/**
 * City wards first; then the nearest village panchayat of a published district;
 * then a city without ward geometry by its bounding box. Null = not covered.
 */
export async function placePoint(origin: string, lng: number, lat: number): Promise<Placement | null> {
  const placed = await placeByRecord(origin, lng, lat);
  if (!placed || placed.placeKind === "city" || placed.waterBodyId) return placed;
  // A lake a city maps beyond its wards (Chennai's Red Hills, Chembarambakkam) keeps the
  // district or basin for routing, and its id, so the city's lake panel shows the report too.
  for (const c of listEnabledPlaces().filter((x) => inBBox(lng, lat, box(x.bbox)))) {
    const body = containing((await geoFor(origin, c.cityId)).bodies, lng, lat)?.properties;
    if (body?.osm_id != null) return { ...placed, waterBodyId: String(body.osm_id), waterBodyName: (body.name as string) || null };
  }
  return placed;
}

async function placeByRecord(origin: string, lng: number, lat: number): Promise<Placement | null> {
  const cities = listEnabledPlaces().filter((c) => inBBox(lng, lat, box(c.bbox)));
  const geos = await Promise.all(cities.map((c) => geoFor(origin, c.cityId)));
  for (const [i, c] of cities.entries()) {
    const ward = containing(geos[i].wards, lng, lat);
    // A region's ward file may cover one corporation only (Mumbai: BMC); its corporation boundaries cover the rest.
    if (ward || containing(geos[i].corporations, lng, lat)) return cityPlacement(c, geos[i], ward?.properties ?? null, lng, lat);
  }

  // A panchayat whose box holds the point; else a town or tank bed within
  // DISTRICT_REACH_KM of one (panchayat boundaries leave both out). Further than
  // that is a district not yet onboarded, never credited to its neighbour.
  const districts = listPublishedAtlasDistricts().filter((d) => d.bbox && inBBox(lng, lat, d.bbox));
  const all = (
    await Promise.all(districts.map(async (d) => (await panchayatsOf(origin, d)).map((gp) => ({ d, gp, centroid: gp.centroid }))))
  ).flat();
  const holding = nearest(all.filter((x) => inBBox(lng, lat, x.gp.bbox)), lng, lat);
  const near = holding ?? nearest(all, lng, lat);
  const best = near && (holding || distanceKm(lng, lat, near.centroid) <= DISTRICT_REACH_KM) ? near : null;
  if (best) {
    return {
      placeKind: "district",
      placeId: best.d.scopeId,
      placeName: best.d.name,
      stateCode: best.d.stateCode,
      corporationId: null,
      wardId: null,
      wardName: null,
      blockCode: holding ? best.gp.blockCode : null,
      panchayatCode: holding ? best.gp.code : null,
      panchayatName: holding ? best.gp.name : null,
      waterBodyId: null,
      waterBodyName: null,
      locality: null,
    };
  }

  const basin = await basinPlacement(origin, lng, lat);
  if (basin) return basin;

  // No ward geometry, or a region corporation known only by its box (Kolkata's Bidhannagar).
  const i = cities.findIndex((c, k) => geos[k].wards.length === 0 || c.corporations?.some((x) => inBBox(lng, lat, box(x.bbox))));
  return i >= 0 ? cityPlacement(cities[i], geos[i], null, lng, lat) : null;
}

export const basinUrl = (b: BasinManifest, file: string) => `/data/basins/${b.basinId}/${file}.geojson`;

/** The smallest onboarded basin whose boundary holds the point, with the town or district and major water body its own map names. */
async function basinPlacement(origin: string, lng: number, lat: number): Promise<Placement | null> {
  const basins = [...listBasins()].sort((a, b) => (a.areaKm2 ?? Infinity) - (b.areaKm2 ?? Infinity));
  for (const b of basins) {
    const boundary = indexed(await getJson<FeatureCollection>(origin, basinUrl(b, "boundary")));
    if (!containing(boundary, lng, lat)) continue;
    const [towns, districts, bodies] = await Promise.all(
      ["admin-town", "admin-district", "waterbodies-major"].map(async (f) => indexed(await getJson<FeatureCollection>(origin, basinUrl(b, f)))),
    );
    const body = containing(bodies, lng, lat)?.properties;
    const place = containing(towns, lng, lat)?.properties ?? containing(districts, lng, lat)?.properties;
    return {
      placeKind: "basin",
      placeId: b.basinId,
      placeName: b.displayName,
      stateCode: b.stateCode,
      corporationId: null,
      wardId: null,
      wardName: null,
      blockCode: null,
      panchayatCode: null,
      panchayatName: null,
      waterBodyId: body?.tankId != null ? String(body.tankId) : null,
      waterBodyName: (body?.name as string) || null,
      locality: (place?.name as string) || null,
    };
  }
  return null;
}

/** Where the map opens for a report started from a place page: a water body, ward, panchayat, or the place itself. */
export async function viewOf(
  origin: string,
  q: { place: string; ward?: string | null; body?: string | null; panchayat?: string | null },
): Promise<{ lat: number; lng: number; zoom: number } | null> {
  const mid = (b: BBox, zoom: number) => ({ lng: (b[0] + b[2]) / 2, lat: (b[1] + b[3]) / 2, zoom });
  const city = listEnabledPlaces().find((c) => c.cityId === q.place);
  if (city) {
    const geo = await geoFor(origin, city.cityId);
    const body = q.body && geo.bodies.find((b) => String(b.feature.properties?.osm_id) === q.body);
    if (body) return mid(body.bbox, 16);
    const ward = q.ward && geo.wards.find((w) => String(wardNumberOf(w.feature.properties)) === q.ward);
    if (ward) return mid(ward.bbox, 15);
    return { ...city.center, zoom: 12 };
  }
  const district = listPublishedAtlasDistricts().find((d) => d.scopeId === q.place);
  if (district) {
    const gp = q.panchayat ? (await panchayatsOf(origin, district)).find((p) => p.code === q.panchayat) : null;
    if (gp) return { lng: gp.centroid[0], lat: gp.centroid[1], zoom: 14 };
    return district.bbox ? mid(district.bbox, 10) : null;
  }
  const basin = listBasins().find((b) => b.basinId === q.place);
  const boundary = basin ? indexed(await getJson<FeatureCollection>(origin, basinUrl(basin, "boundary")))[0] : null;
  return boundary ? mid(boundary.bbox, 9) : null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Water near a point, so the What step can ask "Are you at Puzhal lake?" instead of a list.

type LineData = { kind: NearbyWater["kind"]; name: string | null };

/** Line layers kept as small indexes only (locate.ts IndexedLine), never as the parsed file. */
const lineCache = new Map<string, Promise<IndexedLine<LineData>[] | null>>();

/** A lake outline this close counts, growing with the phone's reported accuracy. */
const LAKE_MARGIN_M: [number, number] = [30, 75];
/** A river, stream, canal or drain centreline this close counts. */
const LINE_MARGIN_M = 60;
const NEARBY_MAX = 3;

const named = (p: GeoJsonProperties): string | null => (typeof p?.name === "string" && p.name.trim() ? p.name.trim() : null);

/** City and basin water-body files map rivers, canals and drains as polygons too (OSM water=river and the like). */
export function polygonKind(p: GeoJsonProperties): NearbyWater["kind"] {
  const t = String(p?.water_type ?? p?.water ?? "");
  return t === "river" || t === "canal" || t === "stream" || t === "drain" ? t : "lake";
}

/**
 * A basin line layer's features as nearby water. `drainage` is three kinds of data: OSM waterways (Mumbai: nullahs and
 * drains, by `waterway`), a corporation's drain register (Chennai, GCC: `drain_type`; only open and macro drains count,
 * the rest are covered roadside drains that sit within 60 m of nearly every street) and a stream network with no tags
 * (Arkavathi, Kabini: India-WRIS).
 */
function lineKind(family: string, p: GeoJsonProperties): NearbyWater["kind"] | null {
  if (family === "streams") return "stream";
  if (family === "canals") return "canal";
  const w = typeof p?.waterway === "string" ? p.waterway : null;
  if (family === "rivers") return w === "canal" ? "canal" : "river";
  if (w) return w === "drain" || w === "ditch" ? "drain" : w === "stream" || w === "river" || w === "canal" ? w : null;
  if (p?.drain_type != null) return /open|macro/i.test(String(p.drain_type)) ? "drain" : null;
  return "stream";
}

function getLines(origin: string, path: string, pick: (p: GeoJsonProperties) => LineData | null): Promise<IndexedLine<LineData>[] | null> {
  return once(lineCache, `${origin}${path}`, (json) => indexLines(json as FeatureCollection, pick));
}

const BASIN_LINES = ["rivers", "streams", "canals", "drainage"] as const;

/** A basin's footprint: its boundary, or for an overview basin with none, its sub-basins. */
async function footprintOf(origin: string, b: BasinManifest): Promise<IndexedPolygon[]> {
  const boundary = await getJson<FeatureCollection>(origin, basinUrl(b, "boundary"));
  return indexed(boundary ?? (await getJson<FeatureCollection>(origin, basinUrl(b, "sub-basins"))));
}

/**
 * One entry per thing: "Cooum River (Satharai origin to mouth)" and "Cooum" are one river, the segments of an unnamed
 * stream network at a point are one stream, and unnamed ponds stay apart.
 */
const sameKey = (w: NearbyWater, i: number) => {
  if (w.name) return `${w.kind === "lake" ? "lake" : "flow"}:${w.name.toLowerCase().replace(/\(.*\)/g, "").replace(/\b(the|river|nadi|lake|tank|eri)\b/g, "").replace(/[^a-z0-9]/g, "")}`;
  return w.kind === "lake" || w.id ? `#${w.id ?? i}` : `line:${w.kind}`;
};

/**
 * Mapped water at or near a point, nearest first, at most three: lakes (and river polygons) whose outline holds the point
 * or lies within 30 to 75 m, more when the phone reports a wider accuracy; rivers, streams, canals and drains whose line
 * lies within 60 m. From each covering city's water-body file, and each covering basin's major water bodies and line
 * layers, plus the waterway centrelines. Files load once per instance; line layers are kept only as small indexes.
 */
export async function nearbyWater(origin: string, lng: number, lat: number, accuracyM?: number | null): Promise<NearbyWater[]> {
  const lakeM = Math.min(LAKE_MARGIN_M[1], Math.max(LAKE_MARGIN_M[0], accuracyM ?? 0));
  const found: NearbyWater[] = [];
  const add = (w: NearbyWater) => found.push({ ...w, distanceM: Math.round(w.distanceM) });
  const polygonHits = (index: IndexedPolygon[], idOf: (p: GeoJsonProperties) => unknown) => {
    for (const h of polygonsNear(index, lng, lat, lakeM)) {
      const id = idOf(h.feature.properties);
      add({ kind: polygonKind(h.feature.properties), name: named(h.feature.properties), id: id != null ? String(id) : null, distanceM: h.distanceM });
    }
  };
  const lineHits = (index: IndexedLine<LineData>[] | null) => {
    for (const h of linesNear(index ?? [], lng, lat, LINE_MARGIN_M)) add({ ...h.data, id: null, distanceM: h.distanceM });
  };

  const cities = listEnabledPlaces().filter((c) => inBBox(lng, lat, box(c.bbox)));
  const basins = listBasins();
  const [geos, footprints, waterways] = await Promise.all([
    Promise.all(cities.map((c) => geoFor(origin, c.cityId))),
    Promise.all(basins.map((b) => footprintOf(origin, b))),
    Promise.all(
      listWaterways().map((w) =>
        getLines(origin, `/data/waterways/${w.waterwayId}/centerline.geojson`, () => ({ kind: /canal/i.test(w.shortName) ? "canal" : "river", name: w.shortName })),
      ),
    ),
  ]);
  for (const geo of geos) polygonHits(geo.bodies, (p) => p?.osm_id);
  const inBasins = basins.filter((_, i) => polygonsNear(footprints[i], lng, lat, LINE_MARGIN_M).length > 0);
  const layers = await Promise.all(
    inBasins.map(async (b) => {
      const [bodies, ...lines] = await Promise.all([
        getJson<FeatureCollection>(origin, basinUrl(b, "waterbodies-major")),
        ...BASIN_LINES.map((f) => getLines(origin, basinUrl(b, f), (p) => {
          const kind = lineKind(f, p);
          return kind ? { kind, name: named(p) } : null;
        })),
      ]);
      return { bodies: indexed(bodies), lines };
    }),
  );
  for (const l of layers) {
    polygonHits(l.bodies, (p) => p?.tankId ?? p?.osm_id);
    l.lines.forEach(lineHits);
  }
  waterways.forEach(lineHits);

  // Nearest first (a stable sort keeps file order on ties). An unnamed river polygon (a city file maps the water area)
  // takes the name of the nearest river line; then a named lake or river found in two files counts once, with its id.
  found.sort((a, b) => a.distanceM - b.distanceM || Number(!a.id) - Number(!b.id));
  for (const w of found) if (!w.name && w.kind !== "lake") w.name = found.find((x) => x.name && x.kind === w.kind && !x.id)?.name ?? null;
  const seen = new Set<string>();
  return found.filter((w, i) => !seen.has(sameKey(w, i)) && !!seen.add(sameKey(w, i))).slice(0, NEARBY_MAX);
}
