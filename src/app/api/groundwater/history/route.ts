import { NextRequest, NextResponse } from "next/server";
import { requireCity } from "@/lib/require-city";
import { dataServiceUnavailable, internalServerError, logRouteError } from "@/lib/api-error";

function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const city = requireCity(searchParams);
  if (city instanceof NextResponse) return city;
  const wardParam = searchParams.get("ward");

  if (!wardParam) {
    return NextResponse.json({ error: "ward parameter is required" }, { status: 400 });
  }

  const wardNumber = parseInt(wardParam, 10);
  if (isNaN(wardNumber) || wardNumber < 1) {
    return NextResponse.json({ error: "ward must be a positive integer" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) return dataServiceUnavailable();

  const { createServerClient } = await import("@/lib/supabase/server");
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("groundwater_monthly")
    .select("ward_number, year, month, depth_to_water_m")
    .eq("city_id", city.cityId)
    .eq("ward_number", wardNumber)
    .order("year", { ascending: true })
    .order("month", { ascending: true })
    .limit(240);

  if (error) {
    logRouteError("/api/groundwater/history", error);
    return internalServerError();
  }

  const history = (data || []).map((r: Record<string, unknown>) => ({
    year: r.year as number,
    month: r.month as number,
    date: `${r.year}-${String(r.month as number).padStart(2, "0")}`,
    depthM: r.depth_to_water_m as number | null,
  }));

  return NextResponse.json({
    wardNumber,
    wardName: `Ward ${wardNumber}`,
    history,
  });
}
