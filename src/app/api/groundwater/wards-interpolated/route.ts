import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { resolve } from "path";
import { internalServerError, logRouteError } from "@/lib/api-error";
import { idwInterpolate, polygonCentroid, haversineKm, type IdwStation } from "@/lib/groundwater/idw";
import { getGroundwaterStatus } from "@/types/groundwater";
import { tryGetPlaceConfig } from "@/lib/cities";
import { wardsVintageFor } from "@/lib/cities/wards-vintage";

/**
 * Ward groundwater depth via IDW from CGWB / WRIS stations.
 *
 * Why this exists: Chennai's /api/groundwater serves authoritative ward
 * monthly data from OpenCity (groundwater_monthly table). For other
 * cities (Madurai, future onboardings) no equivalent ward survey exists,
 * so we interpolate from CGWB station depths in groundwater_wris_latest.
 *
 * Response shape mirrors GroundwaterApiResponse (the depth/risk view in
 * /[cityId]/groundwater consumes both endpoints uniformly).
 *
 * Cache: revalidate every 6 hours - WRIS daily ingest happens once per
 * day so this is generous, but it lets us amortize the geojson + table
 * cost across visitors.
 */
export const revalidate = 21_600;

// Maps cityId -> WRIS district. Keep in sync with
// src/app/api/groundwater/stations/route.ts.
const DISTRICT_BY_CITY: Record<string, string> = {
  chennai: "Chennai",
  madurai: "Madurai",
};

/** Load stations from the curated static Year Book file
 *  (public/data/{cityId}-cgwb-stations.json). Each well's LATEST seasonal
 *  reading becomes its depth. Returns null when the city has no such file. */
function loadStaticWells(
  cityId: string,
): { stations: IdwStation[]; latestDate: string | null } | null {
  interface StaticWell {
    lat?: number;
    lng?: number;
    readings?: Array<{ year: number; month: number; depth_m_bgl: number }>;
  }
  let wells: StaticWell[];
  try {
    const raw = readFileSync(
      resolve(process.cwd(), `public/data/${cityId}-cgwb-stations.json`),
      "utf-8",
    );
    wells = (JSON.parse(raw) as { wells: StaticWell[] }).wells;
  } catch {
    return null;
  }
  const stations: IdwStation[] = [];
  let latestDate: string | null = null;
  for (const w of wells) {
    const last = w.readings?.[w.readings.length - 1];
    if (typeof w.lat !== "number" || typeof w.lng !== "number" || !last) continue;
    stations.push({ lat: w.lat, lng: w.lng, depthM: Math.abs(last.depth_m_bgl) });
    const d = `${last.year}-${String(last.month).padStart(2, "0")}-01`;
    if (!latestDate || d > latestDate) latestDate = d;
  }
  return { stations, latestDate };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cityId = (searchParams.get("city") || "madurai").toLowerCase();
  const config = tryGetPlaceConfig(cityId);
  if (!config) {
    return NextResponse.json({ error: "Unknown city" }, { status: 404 });
  }
  // Cities with a live WRIS district read Supabase; cities without one
  // (e.g. Mumbai, whose WRIS feed went stale in 2023) fall back to the
  // curated static Year Book file public/data/{cityId}-cgwb-stations.json.
  const district = DISTRICT_BY_CITY[cityId];
  const staticWells = district ? null : loadStaticWells(cityId);
  if (!district && !staticWells) {
    return NextResponse.json(
      { error: "City has no WRIS district mapping or static station file" },
      { status: 404 },
    );
  }

  // 1. Load ward polygons (vintage per city - Bangalore uses GBA 2025
  //    not GCC/MMC 2022).
  const geojsonPath = resolve(
    process.cwd(),
    `public/geojson/${cityId}-wards-${wardsVintageFor(cityId)}.geojson`,
  );
  let geojson: {
    features: Array<{
      properties: Record<string, unknown>;
      geometry: { type: string; coordinates: number[][][] | number[][][][] };
    }>;
  };
  try {
    geojson = JSON.parse(readFileSync(geojsonPath, "utf-8"));
  } catch (e) {
    logRouteError("/api/groundwater/wards-interpolated geojson", e);
    return NextResponse.json({ error: "Ward GeoJSON missing" }, { status: 500 });
  }

  // 2. Pull latest CGWB station readings - from Supabase (WRIS district
  //    cities) or the curated static file (Year Book cities).
  // Drop stations whose lat/lng is wildly off (some WRIS records carry
  // mislocated coordinates - e.g. one Madurai-tagged station that lands
  // near Chennai). Sane CGWB stations for a city should sit within
  // ~80 km of the city center.
  const MAX_STATION_DIST_KM = 80;
  const cityCenter: [number, number] = [config.center.lat, config.center.lng];

  let stations: IdwStation[];
  let latestDate: string | null;
  let sourceLabel: string;

  if (district) {
    const { createServerClient } = await import("@/lib/supabase/server");
    let supabase;
    try {
      supabase = createServerClient();
    } catch (e) {
      logRouteError("/api/groundwater/wards-interpolated supabase", e);
      return internalServerError();
    }

    const { data: rows, error } = await supabase
      .from("groundwater_wris_latest")
      .select("station_code, latitude, longitude, depth_to_water_m, reading_date")
      .eq("district", district);

    if (error) {
      logRouteError("/api/groundwater/wards-interpolated query", error);
      return internalServerError();
    }

    stations = (rows || [])
      .filter(
        (r) =>
          typeof r.latitude === "number" &&
          typeof r.longitude === "number" &&
          typeof r.depth_to_water_m === "number",
      )
      .filter((r) => haversineKm(cityCenter, [r.latitude as number, r.longitude as number]) <= MAX_STATION_DIST_KM)
      .map((r) => ({
        lat: r.latitude as number,
        lng: r.longitude as number,
        depthM: Math.abs(r.depth_to_water_m as number), // CGWB sometimes stores negative
      }));

    // Latest reading_date across all stations - shown as the "as of" anchor.
    latestDate =
      (rows || [])
        .map((r) => r.reading_date as string | null)
        .filter((d): d is string => !!d)
        .sort()
        .pop() ?? null;
    sourceLabel = "CGWB stations";
  } else {
    const s = staticWells!;
    stations = s.stations.filter(
      (st) => haversineKm(cityCenter, [st.lat, st.lng]) <= MAX_STATION_DIST_KM,
    );
    latestDate = s.latestDate;
    sourceLabel = "CGWB Year Book wells (curated)";
  }

  // 3. Interpolate per ward.
  const wards = geojson.features.map((feat) => {
    const props = feat.properties;
    const wardNumber = Number(props.ward_no ?? props.ward_number ?? 0);
    const wardName = String(props.ward_name ?? `Ward ${wardNumber}`);
    const zone = String(props.zone ?? props.zone_name ?? "");

    // Polygon vs MultiPolygon — pick the largest ring centroid for MP.
    const geomType = feat.geometry.type;
    let centroid: [number, number];
    if (geomType === "Polygon") {
      centroid = polygonCentroid(feat.geometry.coordinates as number[][][]);
    } else {
      // MultiPolygon: use first polygon (Madurai wards are all single Polygon).
      const mp = feat.geometry.coordinates as number[][][][];
      centroid = polygonCentroid(mp[0]);
    }

    const idw = idwInterpolate(centroid, stations, { k: 4, maxKm: 15, power: 2 });

    return {
      wardNumber,
      wardName,
      zone,
      depthM: idw.depthM,
      trend: "unknown" as const,
      stationCount: idw.stationCount,
      meanDistanceKm: idw.meanDistanceKm,
    };
  });
  wards.sort((a, b) => a.wardNumber - b.wardNumber);

  // 4. Summary buckets matching GroundwaterApiResponse.
  const summary = {
    healthy: 0,
    moderate: 0,
    declining: 0,
    stressed: 0,
    critical: 0,
    crisis: 0,
    noData: 0,
  };
  for (const w of wards) {
    summary[getGroundwaterStatus(w.depthM)]++;
  }

  const withData = wards.filter((w) => w.depthM !== null);
  const cityAverage =
    withData.length > 0
      ? +(withData.reduce((s, w) => s + (w.depthM as number), 0) / withData.length).toFixed(1)
      : null;

  return NextResponse.json({
    cityId,
    asOf: latestDate,
    method: `IDW (k=4, max 15 km, power=2) over ${stations.length} ${sourceLabel}`,
    cityAverage,
    wards,
    summary,
  });
}
