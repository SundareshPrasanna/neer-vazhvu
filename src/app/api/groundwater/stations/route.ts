import { NextRequest, NextResponse } from "next/server";
import { internalServerError, logRouteError } from "@/lib/api-error";

function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * GET /api/groundwater/stations
 *
 * Returns CGWB monitoring station data from India WRIS.
 *
 * Query params:
 *   - city: cityId (optional, default "chennai") - filters by district.
 *           Supported: chennai, madurai. Bangalore and others land here as
 *           their daily ingestion ships.
 *   - station: station_code (optional, filter to one station)
 *   - mode: "Manual" | "Telemetric" (optional filter)
 *   - days: number of days of history (default 90, max 730) - only used with station param
 *
 * Without station param: returns latest reading per station from the
 *   groundwater_wris_latest view (one row per station, regardless of age).
 * With station param: returns full time series for that station within the
 *   `days` window.
 */

// Map cityId -> district name in groundwater_wris.district. Keep in sync
// with the per-city WRIS daily scripts (scrape_wris_madurai.py etc).
const DISTRICT_BY_CITY: Record<string, string> = {
  chennai: "Chennai",
  madurai: "Madurai",
};
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ stations: [], message: "Supabase not configured" });
  }

  const { createServerClient } = await import("@/lib/supabase/server");
  const supabase = createServerClient();

  const { searchParams } = new URL(request.url);
  const stationCode = searchParams.get("station");
  const modeFilter = searchParams.get("mode");
  const daysParam = searchParams.get("days");
  const days = Math.min(Math.max(parseInt(daysParam || "90", 10) || 90, 1), 730);
  const cityParam = (searchParams.get("city") || "chennai").toLowerCase();
  const district = DISTRICT_BY_CITY[cityParam] ?? "Chennai";

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoff = cutoffDate.toISOString().slice(0, 10);

  if (stationCode) {
    // Return time series for a specific station, along with the latest-view
    // metadata (well_type, quality flag, etc.) so the panel can display it.
    let query = supabase
      .from("groundwater_wris")
      .select(
        "station_code, station_name, latitude, longitude, reading_date, depth_to_water_m, acquisition_mode, well_type, well_depth_m, well_aquifer_type",
      )
      .eq("station_code", stationCode)
      .eq("district", district)
      .gte("reading_date", cutoff)
      .order("reading_date", { ascending: true })
      .limit(1000);

    if (modeFilter) {
      query = query.eq("acquisition_mode", modeFilter);
    }

    const [timeseriesRes, latestRes] = await Promise.all([
      query,
      supabase
        .from("groundwater_wris_latest")
        .select(
          "station_code, station_name, latitude, longitude, acquisition_mode, well_type, well_depth_m, well_aquifer_type, recent_count, recent_range_m, data_quality_flag, district",
        )
        .eq("station_code", stationCode)
        .eq("district", district)
        .maybeSingle(),
    ]);

    if (timeseriesRes.error) {
      logRouteError("/api/groundwater/stations", timeseriesRes.error);
      return internalServerError();
    }
    if (latestRes.error) {
      logRouteError("/api/groundwater/stations", latestRes.error);
      return internalServerError();
    }

    const data = timeseriesRes.data;
    const latest = latestRes.data;

    if ((!data || data.length === 0) && !latest) {
      return NextResponse.json({ station: null, readings: [] });
    }

    const meta = latest ?? data?.[0];
    return NextResponse.json({
      station: meta
        ? {
            stationCode: meta.station_code,
            stationName: meta.station_name,
            latitude: meta.latitude,
            longitude: meta.longitude,
            acquisitionMode: meta.acquisition_mode,
            wellType: normalizeMetaString(meta.well_type),
            wellDepthM: meta.well_depth_m as number | null,
            wellAquiferType: normalizeMetaString(meta.well_aquifer_type),
            recentCount: latest?.recent_count ?? null,
            recentRangeM: latest?.recent_range_m ?? null,
            dataQualityFlag: (latest?.data_quality_flag as string | undefined) ?? null,
          }
        : null,
      readings: (data ?? []).map((r) => ({
        date: r.reading_date,
        depthM: r.depth_to_water_m,
      })),
    });
  }

  // No station specified: return latest reading per station from the view,
  // filtered to the requested city's district.
  let listQuery = supabase
    .from("groundwater_wris_latest")
    .select(
      "station_code, station_name, latitude, longitude, reading_date, depth_to_water_m, acquisition_mode, well_type, well_depth_m, well_aquifer_type, recent_count, recent_range_m, data_quality_flag, district",
    )
    .eq("district", district);

  if (modeFilter) {
    listQuery = listQuery.eq("acquisition_mode", modeFilter);
  }

  const { data: latestRows, error: latestError } = await listQuery;

  if (latestError) {
    logRouteError("/api/groundwater/stations", latestError);
    return internalServerError();
  }

  const stations = (latestRows || [])
    .map((r) => ({
      stationCode: r.station_code as string,
      stationName: r.station_name as string,
      latitude: r.latitude as number | null,
      longitude: r.longitude as number | null,
      latestDate: r.reading_date as string,
      latestDepthM: r.depth_to_water_m as number,
      acquisitionMode: r.acquisition_mode as string,
      wellType: normalizeMetaString(r.well_type),
      wellDepthM: r.well_depth_m as number | null,
      wellAquiferType: normalizeMetaString(r.well_aquifer_type),
      recentCount: r.recent_count as number | null,
      recentRangeM: r.recent_range_m as number | null,
      dataQualityFlag: (r.data_quality_flag as string | null) ?? null,
    }))
    .sort((a, b) => a.stationName.localeCompare(b.stationName));

  return NextResponse.json({
    stations,
    totalStations: stations.length,
  });
}

/**
 * WRIS returns the metadata strings inconsistently: sometimes null, sometimes
 * an empty string, sometimes the literal "Not Available". Normalize them all
 * to null so the UI can reliably hide missing fields.
 */
function normalizeMetaString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === "not available") return null;
  return trimmed;
}
