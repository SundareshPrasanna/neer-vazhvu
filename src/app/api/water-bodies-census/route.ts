import { NextRequest, NextResponse } from "next/server";
import { internalServerError, logRouteError } from "@/lib/api-error";

function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

interface CensusRow {
  id: number;
  census_code: string | null;
  name: string | null;
  water_body_type: string | null;
  nature: string | null;
  ownership: string | null;
  latitude: number;
  longitude: number;
  storage_capacity_original: number | null;
  storage_capacity_present: number | null;
  storage_loss_pct: number | null;
  max_depth_m: number | null;
  water_spread_area: number | null;
  construction_year: number | null;
  renovation_year: number | null;
  basin: string | null;
  sub_basin: string | null;
  is_in_use: boolean | null;
  encroachment_status: string | null;
  encroachment_pct: number | null;
  ward_name: string | null;
  village: string | null;
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ data: [], summary: { total: 0, encroached: 0, avgStorageLossPct: null } });
  }

  const { createServerClient } = await import("@/lib/supabase/server");
  const supabase = createServerClient();

  const { searchParams } = new URL(request.url);
  const typeFilter = searchParams.get("type");
  const encroachmentFilter = searchParams.get("encroached");

  // Validate filters - reject LIKE wildcards and overly long values
  const VALID_ENCROACHMENT = ["yes", "no", "partial"];
  if (typeFilter && typeFilter !== "all" && (typeFilter.length > 50 || /[%_]/.test(typeFilter))) {
    return NextResponse.json({ error: "Invalid type filter" }, { status: 400 });
  }
  if (encroachmentFilter && encroachmentFilter !== "all" && !VALID_ENCROACHMENT.includes(encroachmentFilter)) {
    return NextResponse.json({ error: "Invalid encroachment filter" }, { status: 400 });
  }

  let query = supabase
    .from("water_bodies_census")
    .select(
      "id, census_code, name, water_body_type, nature, ownership, latitude, longitude, " +
        "storage_capacity_original, storage_capacity_present, storage_loss_pct, " +
        "max_depth_m, water_spread_area, construction_year, renovation_year, " +
        "basin, sub_basin, is_in_use, encroachment_status, encroachment_pct, " +
        "ward_name, village"
    )
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  if (typeFilter && typeFilter !== "all") {
    query = query.ilike("water_body_type", typeFilter);
  }

  if (encroachmentFilter && encroachmentFilter !== "all") {
    query = query.eq("encroachment_status", encroachmentFilter);
  }

  const { data: rawData, error } = await query.order("name", { ascending: true }).limit(1000);

  if (error) {
    logRouteError("/api/water-bodies-census", error);
    return internalServerError();
  }

  const data = (rawData ?? []) as unknown as CensusRow[];

  // Compute summary stats
  const total = data.length;
  const encroached = data.filter((r) => r.encroachment_status === "yes").length;

  const withCapacity = data.filter(
    (r) =>
      r.storage_capacity_original != null &&
      r.storage_capacity_present != null &&
      r.storage_capacity_original > 0
  );
  const avgStorageLoss =
    withCapacity.length > 0
      ? withCapacity.reduce((sum, r) => sum + (r.storage_loss_pct ?? 0), 0) /
        withCapacity.length
      : null;

  return NextResponse.json({
    data,
    summary: {
      total,
      encroached,
      avgStorageLossPct: avgStorageLoss ? parseFloat(avgStorageLoss.toFixed(1)) : null,
    },
  });
}
