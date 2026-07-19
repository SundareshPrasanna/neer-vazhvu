import { NextRequest, NextResponse } from "next/server";
import { internalServerError, logRouteError } from "@/lib/api-error";
import { createServerClient } from "@/lib/supabase/server";

// Latest storage snapshot for a set of reservoir source codes - the basin
// overview's live strip (docs/specs/cauvery-basin-hierarchy.md §3a). Source
// codes come from the basin's reservoirs.geojson (liveCode), which the
// ingest maps from the source system's ids; this route stays source-agnostic.
export async function GET(request: NextRequest) {
  const codes = (new URL(request.url).searchParams.get("codes") ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 20);
  if (codes.length === 0) {
    return NextResponse.json({ reservoirs: [] });
  }

  const supabase = createServerClient();
  try {
    // Recent window, newest first; keep the first (latest) row per code.
    const { data, error } = await supabase
      .from("reservoir_daily_v2")
      .select("source_code, date, storage_tmc, storage_pct_frl, inflow_cusecs, outflow_cusecs")
      .in("source_code", codes)
      .order("date", { ascending: false })
      .limit(codes.length * 14);
    if (error) throw error;

    const latest = new Map<string, Record<string, unknown>>();
    for (const row of data ?? []) {
      const code = row.source_code as string;
      if (!latest.has(code)) latest.set(code, row);
    }
    return NextResponse.json(
      {
        reservoirs: [...latest.values()].map((r) => ({
          code: r.source_code,
          date: r.date,
          storageTmc: r.storage_tmc,
          storagePctFrl: r.storage_pct_frl,
          inflowCusecs: r.inflow_cusecs,
          outflowCusecs: r.outflow_cusecs,
        })),
      },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" } },
    );
  } catch (e) {
    logRouteError("reservoir/basin", e);
    return internalServerError();
  }
}
