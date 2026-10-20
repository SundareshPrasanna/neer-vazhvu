/** Pure point-in-place helpers for report binding (no fs; unit-testable). */
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import turfBbox from "@turf/bbox";
import type { Feature, FeatureCollection, GeoJsonProperties, MultiPolygon, Polygon } from "geojson";

/** [west, south, east, north] */
export type BBox = [number, number, number, number];

export interface IndexedPolygon {
  bbox: BBox;
  feature: Feature<Polygon | MultiPolygon>;
}

export function inBBox(lng: number, lat: number, b: BBox): boolean {
  return lng >= b[0] && lng <= b[2] && lat >= b[1] && lat <= b[3];
}

export function indexPolygons(fc: FeatureCollection | null | undefined): IndexedPolygon[] {
  const out: IndexedPolygon[] = [];
  for (const f of fc?.features ?? []) {
    const type = f.geometry?.type;
    if (type !== "Polygon" && type !== "MultiPolygon") continue;
    const feature = f as Feature<Polygon | MultiPolygon>;
    out.push({ bbox: turfBbox(feature) as BBox, feature });
  }
  return out;
}

export function containing(index: IndexedPolygon[], lng: number, lat: number): Feature<Polygon | MultiPolygon> | null {
  for (const { bbox, feature } of index) {
    if (inBBox(lng, lat, bbox) && booleanPointInPolygon([lng, lat], feature)) return feature;
  }
  return null;
}

/** Squared equirectangular distance: enough to rank nearby centroids. */
export function distance2(lng: number, lat: number, c: [number, number]): number {
  const dx = (lng - c[0]) * Math.cos((lat * Math.PI) / 180);
  const dy = lat - c[1];
  return dx * dx + dy * dy;
}

/** Kilometres between a point and a [lng, lat] centroid (equirectangular; fine at district scale). */
export function distanceKm(lng: number, lat: number, c: [number, number]): number {
  return Math.sqrt(distance2(lng, lat, c)) * 111.2;
}

export function nearest<T extends { centroid: [number, number] }>(items: T[], lng: number, lat: number): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const item of items) {
    const d = distance2(lng, lat, item.centroid);
    if (d < bestD) [best, bestD] = [item, d];
  }
  return best;
}

/** Metres per degree of longitude and of latitude at a latitude (equirectangular: exact enough within a few km). */
function metresPerDegree(lat: number): [number, number] {
  return [111_320 * Math.cos((lat * Math.PI) / 180), 111_320];
}

/** True when the point lies inside the box grown by `m` metres on every side. */
export function nearBBox(lng: number, lat: number, b: BBox, m: number): boolean {
  const [kx, ky] = metresPerDegree(lat);
  const [dx, dy] = [m / kx, m / ky];
  return lng >= b[0] - dx && lng <= b[2] + dx && lat >= b[1] - dy && lat <= b[3] + dy;
}

/** Metres from a point to a path, given as flat [lng, lat, lng, lat, ...] or as [lng, lat] positions. */
export function pathDistanceM(lng: number, lat: number, path: ArrayLike<number> | number[][]): number {
  const [kx, ky] = metresPerDegree(lat);
  const flat = (path.length > 0 && Array.isArray((path as number[][])[0]) ? (path as number[][]).flatMap((p) => [p[0], p[1]]) : path) as ArrayLike<number>;
  if (flat.length < 2) return Infinity;
  let best = Infinity;
  let [ax, ay] = [(flat[0] - lng) * kx, (flat[1] - lat) * ky];
  if (flat.length === 2) return Math.hypot(ax, ay);
  for (let i = 2; i + 1 < flat.length; i += 2) {
    const [bx, by] = [(flat[i] - lng) * kx, (flat[i + 1] - lat) * ky];
    const [dx, dy] = [bx - ax, by - ay];
    const len2 = dx * dx + dy * dy;
    // The point is the origin: project it onto the segment, clamped to its ends.
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    [ax, ay] = [bx, by];
  }
  return best;
}

/** Metres from a point to a polygon: 0 inside, else to its nearest edge (holes included, so an island is outside). */
export function polygonDistanceM(lng: number, lat: number, feature: Feature<Polygon | MultiPolygon>): number {
  if (booleanPointInPolygon([lng, lat], feature)) return 0;
  const g = feature.geometry;
  const rings = g.type === "Polygon" ? g.coordinates : g.coordinates.flat();
  return Math.min(...rings.map((r) => pathDistanceM(lng, lat, r)));
}

/** Polygons whose outline holds the point or lies within `m` metres, nearest first. */
export function polygonsNear(index: IndexedPolygon[], lng: number, lat: number, m: number): { feature: Feature<Polygon | MultiPolygon>; distanceM: number }[] {
  return index
    .filter((x) => nearBBox(lng, lat, x.bbox, m))
    .map((x) => ({ feature: x.feature, distanceM: polygonDistanceM(lng, lat, x.feature) }))
    .filter((x) => x.distanceM <= m)
    .sort((a, b) => a.distanceM - b.distanceM);
}

/** A line feature kept small: its box, each part as flat 32-bit [lng, lat] pairs (under a metre of error), and what to say about it. */
export interface IndexedLine<T> {
  bbox: BBox;
  parts: Float32Array[];
  data: T;
}

/** Index the line features `pick` keeps (null drops one); the source collection can then be let go. */
export function indexLines<T>(fc: FeatureCollection | null | undefined, pick: (p: GeoJsonProperties) => T | null): IndexedLine<T>[] {
  const out: IndexedLine<T>[] = [];
  for (const f of fc?.features ?? []) {
    const g = f.geometry;
    if (g?.type !== "LineString" && g?.type !== "MultiLineString") continue;
    const data = pick(f.properties);
    if (data === null) continue;
    const lines = g.type === "LineString" ? [g.coordinates] : g.coordinates;
    const parts = lines.filter((l) => l.length > 0).map((l) => Float32Array.from(l.flatMap((p) => [p[0], p[1]])));
    if (parts.length === 0) continue;
    const b: BBox = [Infinity, Infinity, -Infinity, -Infinity];
    for (const part of parts) {
      for (let i = 0; i + 1 < part.length; i += 2) {
        b[0] = Math.min(b[0], part[i]);
        b[1] = Math.min(b[1], part[i + 1]);
        b[2] = Math.max(b[2], part[i]);
        b[3] = Math.max(b[3], part[i + 1]);
      }
    }
    out.push({ bbox: b, parts, data });
  }
  return out;
}

/** Lines within `m` metres of the point, nearest first. */
export function linesNear<T>(index: IndexedLine<T>[], lng: number, lat: number, m: number): { data: T; distanceM: number }[] {
  return index
    .filter((x) => nearBBox(lng, lat, x.bbox, m))
    .map((x) => ({ data: x.data, distanceM: Math.min(...x.parts.map((p) => pathDistanceM(lng, lat, p))) }))
    .filter((x) => x.distanceM <= m)
    .sort((a, b) => a.distanceM - b.distanceM);
}

/** Great-circle metres between two [lng, lat] points. */
export function metresBetween(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const rad = Math.PI / 180;
  const h = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}
