import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { internalServerError, logRouteError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const geeTargetId = searchParams.get("gee_target_id");
  const osmId = searchParams.get("osm_id");
  const censusId = searchParams.get("census_id");
  const parsedOsmId = osmId ? Number(osmId) : null;
  const parsedCensusId = censusId ? Number(censusId) : null;

  if (!geeTargetId && !osmId && !censusId) {
    return NextResponse.json(
      { error: "Provide gee_target_id, osm_id, or census_id" },
      { status: 400 }
    );
  }

  if (osmId && Number.isNaN(parsedOsmId)) {
    return NextResponse.json({ error: "Invalid osm_id" }, { status: 400 });
  }

  if (censusId && Number.isNaN(parsedCensusId)) {
    return NextResponse.json({ error: "Invalid census_id" }, { status: 400 });
  }

  const supabase = createServerClient();
  let query = supabase
    .from("water_body_satellite_summary")
    .select("*")
    .order("summary_date", { ascending: false })
    .limit(1);

  if (geeTargetId) {
    query = query.eq("gee_target_id", geeTargetId);
  } else if (osmId) {
    query = query.eq("osm_id", parsedOsmId);
  } else if (censusId) {
    query = query.eq("census_id", parsedCensusId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    logRouteError("/api/water-bodies/gee", error);
    return internalServerError();
  }

  if (!data) {
    return NextResponse.json({ error: "No satellite summary found" }, { status: 404 });
  }

  return NextResponse.json({ data }, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
    },
  });
}
