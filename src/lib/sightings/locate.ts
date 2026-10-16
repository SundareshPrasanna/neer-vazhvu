/** Pure point-in-place helpers for report binding (no fs; unit-testable). */
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import turfBbox from "@turf/bbox";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";

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
