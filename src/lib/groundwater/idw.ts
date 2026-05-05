/**
 * Inverse-distance weighted interpolation for groundwater depth.
 *
 * Used by /api/groundwater/wards-interpolated to estimate ward-level
 * water-table depth in cities where no authoritative ward survey exists
 * (Chennai uses OpenCity ward GW; Madurai etc. interpolate from CGWB
 * stations).
 *
 * Algorithm:
 *   1. Compute haversine distance from the query centroid to each station.
 *   2. Drop stations beyond `maxKm` (capped service radius).
 *   3. Sort ascending by distance, keep nearest `k`.
 *   4. Weight each = 1 / dist^power (power=2 by default).
 *   5. depth = sum(w * depth) / sum(w).
 *
 * Returns null depth when fewer than `minStations` are within radius.
 */

export interface IdwStation {
  lat: number;
  lng: number;
  depthM: number;
}

export interface IdwResult {
  depthM: number | null;
  stationCount: number;
  meanDistanceKm: number | null;
  nearestKm: number | null;
}

const EARTH_RADIUS_KM = 6371;

function haversineKm(a: [number, number], b: [number, number]): number {
  const [lat1, lng1] = a;
  const [lat2, lng2] = b;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1Rad) * Math.cos(lat2Rad);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function idwInterpolate(
  centroid: [number, number],
  stations: IdwStation[],
  opts: {
    k?: number;
    maxKm?: number;
    power?: number;
    minStations?: number;
  } = {},
): IdwResult {
  const { k = 4, maxKm = 15, power = 2, minStations = 2 } = opts;

  const distances: { dist: number; depth: number }[] = [];
  for (const s of stations) {
    const d = haversineKm(centroid, [s.lat, s.lng]);
    if (d > maxKm) continue;
    if (Number.isFinite(s.depthM)) distances.push({ dist: d, depth: s.depthM });
  }

  distances.sort((a, b) => a.dist - b.dist);
  const used = distances.slice(0, k);

  if (used.length < minStations) {
    return {
      depthM: null,
      stationCount: used.length,
      meanDistanceKm: used.length === 0 ? null : used.reduce((s, x) => s + x.dist, 0) / used.length,
      nearestKm: used[0]?.dist ?? null,
    };
  }

  // Exact-match guard: when one station coincides with the centroid,
  // 1/0^p blows up. Return that station's depth verbatim.
  const exact = used.find((u) => u.dist < 0.01);
  if (exact) {
    return {
      depthM: +exact.depth.toFixed(2),
      stationCount: used.length,
      meanDistanceKm: 0,
      nearestKm: 0,
    };
  }

  let weightSum = 0;
  let depthWeightedSum = 0;
  for (const u of used) {
    const w = 1 / Math.pow(u.dist, power);
    weightSum += w;
    depthWeightedSum += w * u.depth;
  }

  return {
    depthM: +(depthWeightedSum / weightSum).toFixed(2),
    stationCount: used.length,
    meanDistanceKm: +(used.reduce((s, x) => s + x.dist, 0) / used.length).toFixed(2),
    nearestKm: +used[0].dist.toFixed(2),
  };
}

export function polygonCentroid(coords: number[][][]): [number, number] {
  // Outer ring centroid (good enough for IDW; full-polygon centroid is
  // overkill at our resolution).
  const ring = coords[0];
  let latSum = 0;
  let lngSum = 0;
  for (const [lng, lat] of ring) {
    latSum += lat;
    lngSum += lng;
  }
  return [latSum / ring.length, lngSum / ring.length];
}
