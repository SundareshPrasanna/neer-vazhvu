import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wardParam = searchParams.get("ward");

  if (!wardParam) {
    return NextResponse.json({ error: "ward parameter required" }, { status: 400 });
  }

  const wardNumber = parseInt(wardParam, 10);
  if (isNaN(wardNumber) || wardNumber < 1 || wardNumber > 200) {
    return NextResponse.json({ error: "ward must be 1-200" }, { status: 400 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ wardNumber, depthM: null, trend: "unknown", riskLevel: "noData", riskScore: null, riskComponents: null });
  }

  const { createServerClient } = await import("@/lib/supabase/server");
  const supabase = createServerClient();

  // Get latest two readings for this ward (current + previous year same month for trend)
  const { data: gwData } = await supabase
    .from("groundwater_monthly")
    .select("depth_to_water_m, year, month")
    .eq("ward_number", wardNumber)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(1);

  const current = gwData?.[0];
  let trend: "improving" | "stable" | "declining" | "unknown" = "unknown";

  // Compute trend by comparing to previous year same month (matching main route logic)
  if (current?.depth_to_water_m != null) {
    const { data: prevData } = await supabase
      .from("groundwater_monthly")
      .select("depth_to_water_m")
      .eq("ward_number", wardNumber)
      .eq("year", current.year - 1)
      .eq("month", current.month)
      .limit(1);

    const prevDepth = prevData?.[0]?.depth_to_water_m;
    if (prevDepth != null) {
      const diff = current.depth_to_water_m - prevDepth;
      if (diff < -0.5) trend = "improving";
      else if (diff > 0.5) trend = "declining";
      else trend = "stable";
    }
  }

  // Get latest risk score + components for this ward
  const { data: riskData } = await supabase
    .from("ward_risk_score")
    .select("risk_score, risk_level, groundwater_component, trend_component, reservoir_component, seasonal_component")
    .eq("ward_number", wardNumber)
    .order("computed_date", { ascending: false })
    .limit(1);

  const risk = riskData?.[0];

  return NextResponse.json({
    wardNumber,
    depthM: current?.depth_to_water_m ?? null,
    trend,
    riskLevel: risk?.risk_level ?? "noData",
    riskScore: risk?.risk_score ?? null,
    riskComponents: risk ? {
      groundwater_depth: risk.groundwater_component ?? 0,
      trend: risk.trend_component ?? 0,
      reservoir: risk.reservoir_component ?? 0,
      seasonal: risk.seasonal_component ?? 0,
    } : null,
  });
}
