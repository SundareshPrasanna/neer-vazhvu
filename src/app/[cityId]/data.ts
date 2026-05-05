import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import type { PlaceConfig } from "@/lib/cities";

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

export interface CitySnapshot {
  asOf: string | null;
  readingsBySource: Record<string, ReservoirReadingV2 | null>;
  reservoirIsLive: boolean;
}

const EMPTY_SNAPSHOT: CitySnapshot = {
  asOf: null,
  readingsBySource: {},
  reservoirIsLive: false,
};

export async function loadCitySnapshot(config: PlaceConfig): Promise<CitySnapshot> {
  const sourceCodes = config.waterSources.map((s) => s.sourceCode);
  if (sourceCodes.length === 0) return EMPTY_SNAPSHOT;

  let supabase;
  try {
    supabase = createServerClient();
  } catch {
    return EMPTY_SNAPSHOT;
  }

  const { data: latest, error: latestErr } = await supabase
    .from("reservoir_daily_v2")
    .select("date")
    .eq("city_id", config.cityId)
    .in("source_code", sourceCodes)
    .order("date", { ascending: false })
    .limit(1);

  if (latestErr || !latest || latest.length === 0) {
    return EMPTY_SNAPSHOT;
  }

  const asOf = latest[0].date as string;

  const { data: rows, error } = await supabase
    .from("reservoir_daily_v2")
    .select(
      "city_id, source_code, date, storage_tmc, storage_pct_frl, level_ft, inflow_cusecs, outflow_cusecs, source",
    )
    .eq("city_id", config.cityId)
    .eq("date", asOf)
    .in("source_code", sourceCodes);

  if (error || !rows) {
    return EMPTY_SNAPSHOT;
  }

  const typed = rows as ReservoirReadingV2[];
  const readingsBySource: Record<string, ReservoirReadingV2 | null> = {};
  for (const code of sourceCodes) {
    readingsBySource[code] = typed.find((r) => r.source_code === code) ?? null;
  }

  // "Live" means we have at least one primary-drinking-source reading.
  const primaryCodes = config.waterSources
    .filter((s) => s.isPrimaryDrinkingSource)
    .map((s) => s.sourceCode);
  const liveSources = primaryCodes.filter((c) => readingsBySource[c] !== null);
  const reservoirIsLive = primaryCodes.length > 0 && liveSources.length === primaryCodes.length;

  return { asOf, readingsBySource, reservoirIsLive };
}
