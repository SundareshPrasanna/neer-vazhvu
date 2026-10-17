import "server-only";

import type { FeatureCollection, GeoJsonProperties } from "geojson";

import { listEnabledPlaces } from "@/lib/cities";
import { corporationsGeoJsonPathFor, wardsGeoJsonPathFor } from "@/lib/cities/data-paths";
import type { PlaceConfig } from "@/lib/cities/types";
import type { DistrictDirectoryArtifact } from "@/lib/atlas/artifacts";
import { listPublishedAtlasDistricts, type AtlasDistrict } from "@/lib/atlas/registry";
import { listBasins, type BasinManifest } from "@/lib/basins";
import { wardNumberOf } from "@/lib/utils/ward-number";
import { containing, distanceKm, inBBox, indexPolygons, nearest, type BBox, type IndexedPolygon } from "./locate";

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
const DISTRICT_REACH_KM = 5;

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

const basinUrl = (b: BasinManifest, file: string) => `/data/basins/${b.basinId}/${file}.geojson`;

/** The smallest onboarded basin whose boundary holds the point, with the town or district and major water body its own map names. */
async function basinPlacement(origin: string, lng: number, lat: number): Promise<Placement | null> {
  const basins = [...listBasins()].sort((a, b) => (a.areaKm2 ?? Infinity) - (b.areaKm2 ?? Infinity));
  for (const b of basins) {
    const boundary = indexPolygons(await getJson<FeatureCollection>(origin, basinUrl(b, "boundary")));
    if (!containing(boundary, lng, lat)) continue;
    const [towns, districts, bodies] = await Promise.all(
      ["admin-town", "admin-district", "waterbodies-major"].map(async (f) => indexPolygons(await getJson<FeatureCollection>(origin, basinUrl(b, f)))),
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
  const boundary = basin ? indexPolygons(await getJson<FeatureCollection>(origin, basinUrl(basin, "boundary")))[0] : null;
  return boundary ? mid(boundary.bbox, 9) : null;
}
