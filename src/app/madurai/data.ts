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

export interface MaduraiSnapshot {
  asOf: string | null;
  vaigai: ReservoirReadingV2 | null;
  mullaperiyar: ReservoirReadingV2 | null;
  sothuparai: ReservoirReadingV2 | null;
  reservoirIsLive: boolean;
}

const MADURAI_SOURCE_CODES = ["vaigai", "mullaperiyar", "sothuparai"] as const;

export async function loadMaduraiSnapshot(): Promise<MaduraiSnapshot> {
  let supabase;
  try {
    supabase = createServerClient();
  } catch {
    return {
      asOf: null,
      vaigai: null,
      mullaperiyar: null,
      sothuparai: null,
      reservoirIsLive: false,
    };
  }

  const { data: latest, error: latestErr } = await supabase
    .from("reservoir_daily_v2")
    .select("date")
    .eq("city_id", "madurai")
    .in("source_code", MADURAI_SOURCE_CODES as unknown as string[])
    .order("date", { ascending: false })
    .limit(1);

  if (latestErr || !latest || latest.length === 0) {
    return {
      asOf: null,
      vaigai: null,
      mullaperiyar: null,
      sothuparai: null,
      reservoirIsLive: false,
    };
  }

  const asOf = latest[0].date as string;

  const { data: rows, error } = await supabase
    .from("reservoir_daily_v2")
    .select(
      "city_id, source_code, date, storage_tmc, storage_pct_frl, level_ft, inflow_cusecs, outflow_cusecs, source",
    )
    .eq("city_id", "madurai")
    .eq("date", asOf)
    .in("source_code", MADURAI_SOURCE_CODES as unknown as string[]);

  if (error || !rows) {
    return {
      asOf: null,
      vaigai: null,
      mullaperiyar: null,
      sothuparai: null,
      reservoirIsLive: false,
    };
  }

  const typed = rows as ReservoirReadingV2[];
  const vaigai = typed.find((r) => r.source_code === "vaigai") ?? null;
  const mullaperiyar = typed.find((r) => r.source_code === "mullaperiyar") ?? null;
  const sothuparai = typed.find((r) => r.source_code === "sothuparai") ?? null;

  return {
    asOf,
    vaigai,
    mullaperiyar,
    sothuparai,
    reservoirIsLive: vaigai !== null && mullaperiyar !== null,
  };
}
