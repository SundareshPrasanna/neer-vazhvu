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
 *   - station: station_code (optional, filter to one station)
 *   - mode: "Manual" | "Telemetric" (optional filter)
 *   - days: number of days of history (default 90, max 730) - only used with station param
 *
 * Without station param: returns latest reading per station from the
 *   groundwater_wris_latest view (one row per station, regardless of age).
 * With station param: returns full time series for that station within the
 *   `days` window.
 */
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

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoff = cutoffDate.toISOString().slice(0, 10);

  if (stationCode) {
    // Return time series for a specific station
    let query = supabase
      .from("groundwater_wris")
      .select("station_code, station_name, latitude, longitude, reading_date, depth_to_water_m, acquisition_mode")
      .eq("station_code", stationCode)
      .gte("reading_date", cutoff)
      .order("reading_date", { ascending: true })
      .limit(1000);

    if (modeFilter) {
      query = query.eq("acquisition_mode", modeFilter);
    }

    const { data, error } = await query;

    if (error) {
      logRouteError("/api/groundwater/stations", error);
      return internalServerError();
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ station: null, readings: [] });
    }

    const first = data[0];
    return NextResponse.json({
      station: {
        stationCode: first.station_code,
        stationName: first.station_name,
        latitude: first.latitude,
        longitude: first.longitude,
        acquisitionMode: first.acquisition_mode,
      },
      readings: data.map((r) => ({
        date: r.reading_date,
        depthM: r.depth_to_water_m,
      })),
    });
  }

  // No station specified: return latest reading per station from the view
  let listQuery = supabase
    .from("groundwater_wris_latest")
    .select("station_code, station_name, latitude, longitude, reading_date, depth_to_water_m, acquisition_mode");

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
    }))
    .sort((a, b) => a.stationName.localeCompare(b.stationName));

  return NextResponse.json({
    stations,
    totalStations: stations.length,
  });
}
