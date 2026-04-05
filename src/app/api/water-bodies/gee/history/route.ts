import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { internalServerError, logRouteError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const geeTargetId = searchParams.get("gee_target_id");
  const osmId = searchParams.get("osm_id");
  const parsedOsmId = osmId ? Number(osmId) : null;

  if (!geeTargetId && !osmId) {
    return NextResponse.json(
      { error: "Provide gee_target_id or osm_id" },
      { status: 400 },
    );
  }

  if (osmId && Number.isNaN(parsedOsmId)) {
    return NextResponse.json({ error: "Invalid osm_id" }, { status: 400 });
  }

  const supabase = createServerClient();
  let query = supabase
    .from("water_body_satellite_summary")
    .select(
      "summary_date, latest_observed_area_ha, seasonal_baseline_area_ha, anomaly_ratio, surface_water_anomaly_level, confidence_level, valid_pixel_pct",
    )
    .order("summary_date", { ascending: true });

  if (geeTargetId) {
    query = query.eq("gee_target_id", geeTargetId);
  } else {
    query = query.eq("osm_id", parsedOsmId);
  }

  const { data, error } = await query;

  if (error) {
    logRouteError("/api/water-bodies/gee/history", error);
    return internalServerError();
  }

  return NextResponse.json({ data: data ?? [] }, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
    },
  });
}
