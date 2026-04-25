import "server-only";

import { createServerClient } from "@/lib/supabase/server";

export interface ReservoirReadingV2 {
  city_id: string;
  source_code: string;
  date: string;
  storage_tmc: number | null;
  storage_pct_frl: number | null;
  level_ft: number | null;
  inflow_cusecs: number | null;
  outflow_cusecs: number | null;
  source: string;
}

export interface KaveriSnapshot {
  asOf: string | null;
  mettur: ReservoirReadingV2 | null;
  karnatakaDams: ReservoirReadingV2[];
  isLive: boolean;
}

const KARNATAKA_SOURCE_CODES = ["krs", "kabini", "hemavathy", "harangi"] as const;

export async function loadKaveriSnapshot(): Promise<KaveriSnapshot> {
  let supabase;
  try {
    supabase = createServerClient();
  } catch {
    // Missing env vars in dev: degrade to mock-only render.
    return { asOf: null, mettur: null, karnatakaDams: [], isLive: false };
  }

  const sourceCodes = ["mettur", ...KARNATAKA_SOURCE_CODES];

  const { data: latest, error: latestErr } = await supabase
    .from("reservoir_daily_v2")
    .select("date")
    .eq("city_id", "kaveri")
    .in("source_code", sourceCodes)
    .order("date", { ascending: false })
    .limit(1);

  if (latestErr || !latest || latest.length === 0) {
    return { asOf: null, mettur: null, karnatakaDams: [], isLive: false };
  }

  const asOf = latest[0].date as string;

  const { data: rows, error } = await supabase
    .from("reservoir_daily_v2")
    .select(
      "city_id, source_code, date, storage_tmc, storage_pct_frl, level_ft, inflow_cusecs, outflow_cusecs, source",
    )
    .eq("city_id", "kaveri")
    .eq("date", asOf)
    .in("source_code", sourceCodes);

  if (error || !rows) {
    return { asOf: null, mettur: null, karnatakaDams: [], isLive: false };
  }

  const typed = rows as ReservoirReadingV2[];
  const mettur = typed.find((r) => r.source_code === "mettur") ?? null;
  const karnatakaDams = KARNATAKA_SOURCE_CODES.map(
    (code) => typed.find((r) => r.source_code === code) ?? null,
  ).filter((r): r is ReservoirReadingV2 => r !== null);

  return {
    asOf,
    mettur,
    karnatakaDams,
    isLive: mettur !== null && karnatakaDams.length === KARNATAKA_SOURCE_CODES.length,
  };
}
