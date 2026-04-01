import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { resolve } from "path";
import { internalServerError, logRouteError } from "@/lib/api-error";
import { generateMockWardHistory } from "@/lib/mock-data";

const wardNamesPath = resolve(process.cwd(), "public/data/ward-names.json");
const canonicalNames = new Map<number, string>(
  (JSON.parse(readFileSync(wardNamesPath, "utf-8")) as { ward_number: number; ward_name: string }[])
    .map((w) => [w.ward_number, w.ward_name])
);

function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wardParam = searchParams.get("ward");

  if (!wardParam) {
    return NextResponse.json({ error: "ward parameter is required" }, { status: 400 });
  }

  const wardNumber = parseInt(wardParam, 10);
  if (isNaN(wardNumber) || wardNumber < 1 || wardNumber > 200) {
    return NextResponse.json({ error: "ward must be between 1 and 200" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(generateMockWardHistory(wardNumber));
  }

  const { createServerClient } = await import("@/lib/supabase/server");
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("groundwater_monthly")
    .select("ward_number, ward_name, year, month, depth_to_water_m")
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
    wardName: canonicalNames.get(wardNumber) || (data?.[0]?.ward_name as string) || `Ward ${wardNumber}`,
    history,
  });
}
