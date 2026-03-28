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
    return NextResponse.json({ wardNumber, depthM: null, trend: "unknown", riskLevel: "noData", riskScore: null });
  }

  const { createServerClient } = await import("@/lib/supabase/server");
  const supabase = createServerClient();

  // Get latest groundwater reading for this ward
  const { data: gwData } = await supabase
    .from("groundwater_monthly")
    .select("depth_m, trend")
    .eq("ward_number", wardNumber)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(1);

  // Get latest risk score for this ward
  const { data: riskData } = await supabase
    .from("ward_risk_score")
    .select("risk_score, risk_level")
    .eq("ward_number", wardNumber)
    .order("computed_date", { ascending: false })
    .limit(1);

  const gw = gwData?.[0];
  const risk = riskData?.[0];

  return NextResponse.json({
    wardNumber,
    depthM: gw?.depth_m ?? null,
    trend: gw?.trend ?? "unknown",
    riskLevel: risk?.risk_level ?? "noData",
    riskScore: risk?.risk_score ?? null,
  });
}
