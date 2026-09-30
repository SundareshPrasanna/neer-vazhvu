/**
 * Geo helpers shared by the compute-*-ward-profiles.ts producers: great-circle
 * distance, centroids, a grid index over ward bboxes, point-in-ward lookup and
 * a line's length split across the wards it crosses.
 */
import centroid from "@turf/centroid";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint } from "@turf/helpers";
import along from "@turf/along";
import length from "@turf/length";

export interface Coord {
  lat: number;
  lng: number;
}

/** What the index and lookup read; each producer's WardInfo extends it. */
export interface WardGeo {
  ward_number: number;
  feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
  bbox: [number, number, number, number]; // [minX, minY, maxX, maxY]
}

const R_EARTH_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversine(a: Coord, b: Coord): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R_EARTH_KM * Math.asin(Math.sqrt(h));
}

export function featureCentroid(feat: GeoJSON.Feature): Coord {
  const c = centroid(feat);
  return { lat: c.geometry.coordinates[1], lng: c.geometry.coordinates[0] };
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// ── Spatial grid index: a gridSize x gridSize grid over the wards' bounding box

export interface GridIndex {
  minLng: number;
  minLat: number;
  cellW: number;
  cellH: number;
  cols: number;
  rows: number;
  cells: Map<string, number[]>; // "col,row" -> ward indices
}

export function buildGridIndex(wards: WardGeo[], gridSize = 20): GridIndex {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const w of wards) {
    if (w.bbox[0] < minLng) minLng = w.bbox[0];
    if (w.bbox[1] < minLat) minLat = w.bbox[1];
    if (w.bbox[2] > maxLng) maxLng = w.bbox[2];
    if (w.bbox[3] > maxLat) maxLat = w.bbox[3];
  }

  const cellW = (maxLng - minLng) / gridSize;
  const cellH = (maxLat - minLat) / gridSize;
  const cells = new Map<string, number[]>();

  for (let i = 0; i < wards.length; i++) {
    const [wMinX, wMinY, wMaxX, wMaxY] = wards[i].bbox;
    const colStart = Math.max(0, Math.floor((wMinX - minLng) / cellW));
    const colEnd = Math.min(gridSize - 1, Math.floor((wMaxX - minLng) / cellW));
    const rowStart = Math.max(0, Math.floor((wMinY - minLat) / cellH));
    const rowEnd = Math.min(gridSize - 1, Math.floor((wMaxY - minLat) / cellH));

    for (let col = colStart; col <= colEnd; col++) {
      for (let row = rowStart; row <= rowEnd; row++) {
        const key = `${col},${row}`;
        const arr = cells.get(key);
        if (arr) arr.push(i);
        else cells.set(key, [i]);
      }
    }
  }

  return { minLng, minLat, cellW, cellH, cols: gridSize, rows: gridSize, cells };
}

export function findWard(lng: number, lat: number, wards: WardGeo[], grid: GridIndex): number | null {
  const col = Math.floor((lng - grid.minLng) / grid.cellW);
  const row = Math.floor((lat - grid.minLat) / grid.cellH);
  const key = `${Math.max(0, Math.min(grid.cols - 1, col))},${Math.max(0, Math.min(grid.rows - 1, row))}`;

  const candidates = grid.cells.get(key);
  if (!candidates) return null;

  const pt = turfPoint([lng, lat]);
  for (const idx of candidates) {
    if (booleanPointInPolygon(pt, wards[idx].feature)) {
      return wards[idx].ward_number;
    }
  }
  return null;
}

/** Count point features into the ward each sits in. A feature's own ward attribute is never read. */
export function countPointsByWard(features: GeoJSON.Feature[], wards: WardGeo[], grid: GridIndex): Map<number, number> {
  const counts = new Map<number, number>();
  for (const f of features) {
    const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
    const ward = findWard(lng, lat, wards, grid);
    if (ward != null) counts.set(ward, (counts.get(ward) ?? 0) + 1);
  }
  return counts;
}

/** Sample the line every sampleStepKm and credit each sample's share of its length to the ward it falls in. */
export function distributeLineLengthByWard(
  geom: GeoJSON.LineString,
  wards: WardGeo[],
  grid: GridIndex,
  sampleStepKm = 0.05,
): Map<number, number> {
  const line = { type: "Feature" as const, properties: {}, geometry: geom };
  const lenKm = length(line, { units: "kilometers" });
  if (lenKm <= 0) return new Map();

  const sampleCount = Math.max(1, Math.ceil(lenKm / sampleStepKm));
  const contributionKm = lenKm / sampleCount;
  const byWard = new Map<number, number>();

  for (let i = 0; i < sampleCount; i++) {
    const distanceKm = ((i + 0.5) / sampleCount) * lenKm;
    const sample = along(line, distanceKm, { units: "kilometers" });
    const [lng, lat] = sample.geometry.coordinates;
    const ward = findWard(lng, lat, wards, grid);
    if (ward != null) {
      byWard.set(ward, (byWard.get(ward) ?? 0) + contributionKm);
    }
  }

  return byWard;
}
