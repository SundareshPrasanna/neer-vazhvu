import "server-only";

import type { FeatureCollection, GeoJsonProperties } from "geojson";

import { listEnabledPlaces } from "@/lib/cities";
import { corporationsGeoJsonPathFor, wardsGeoJsonPathFor } from "@/lib/cities/data-paths";
import type { PlaceConfig } from "@/lib/cities/types";
import type { DistrictDirectoryArtifact } from "@/lib/atlas/artifacts";
import { listPublishedAtlasDistricts, type AtlasDistrict } from "@/lib/atlas/registry";
import { wardNumberOf } from "@/lib/utils/ward-number";
import { containing, inBBox, indexPolygons, nearest, type BBox, type IndexedPolygon } from "./locate";

/** Where a report lands. Resolved on the server from GPS only. */
export interface Placement {
  placeKind: "city" | "district";
  /** cityId, or the district's scope id. */
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

function getJson<T>(origin: string, path: string | null): Promise<T | null> {
  if (!path) return Promise.resolve(null);
  const key = `${origin}${path}`;
  if (!cache.has(key)) {
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    const p = fetch(key, { cache: "no-store", headers: bypass ? { "x-vercel-protection-bypass": bypass } : {} })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    p.then((v) => v ?? cache.delete(key));
    cache.set(key, p);
  }
  return cache.get(key) as Promise<T | null>;
}

async function geoFor(origin: string, cityId: string): Promise<CityGeo> {
  const [wards, bodies, corporations] = await Promise.all([
    getJson<FeatureCollection>(origin, wardsGeoJsonPathFor(cityId)),
    getJson<FeatureCollection>(origin, `/geojson/${cityId}-water-bodies-current.geojson`),
    getJson<FeatureCollection>(origin, corporationsGeoJsonPathFor(cityId)),
  ]);
  return { wards: indexPolygons(wards), bodies: indexPolygons(bodies), corporations: indexPolygons(corporations) };
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
  };
}

/**
 * City wards first; then the nearest village panchayat of a published district;
 * then a city without ward geometry by its bounding box. Null = not covered.
 */
export async function placePoint(origin: string, lng: number, lat: number): Promise<Placement | null> {
  const cities = listEnabledPlaces().filter((c) => inBBox(lng, lat, box(c.bbox)));
  const geos = await Promise.all(cities.map((c) => geoFor(origin, c.cityId)));
  for (const [i, c] of cities.entries()) {
    const ward = containing(geos[i].wards, lng, lat);
    // A region's ward file may cover one corporation only (Mumbai: BMC); its corporation boundaries cover the rest.
    if (ward || containing(geos[i].corporations, lng, lat)) return cityPlacement(c, geos[i], ward?.properties ?? null, lng, lat);
  }

  const districts = listPublishedAtlasDistricts().filter((d) => d.bbox && inBBox(lng, lat, d.bbox));
  const scored = (
    await Promise.all(districts.map(async (d) => ({ d, gp: nearest(await panchayatsOf(origin, d), lng, lat) })))
  ).flatMap(({ d, gp }) => (gp ? [{ d, gp, centroid: gp.centroid }] : []));
  const best = nearest(scored, lng, lat);
  if (best) {
    const inside = inBBox(lng, lat, best.gp.bbox);
    return {
      placeKind: "district",
      placeId: best.d.scopeId,
      placeName: best.d.name,
      stateCode: best.d.stateCode,
      corporationId: null,
      wardId: null,
      wardName: null,
      blockCode: best.gp.blockCode,
      panchayatCode: inside ? best.gp.code : null,
      panchayatName: inside ? best.gp.name : null,
      waterBodyId: null,
      waterBodyName: null,
    };
  }

  // No ward geometry, or a region corporation known only by its box (Kolkata's Bidhannagar).
  const i = cities.findIndex((c, k) => geos[k].wards.length === 0 || c.corporations?.some((x) => inBBox(lng, lat, box(x.bbox))));
  return i >= 0 ? cityPlacement(cities[i], geos[i], null, lng, lat) : null;
}
