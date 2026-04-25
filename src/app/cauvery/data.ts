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

export interface BasinRainfallReading {
  city_id: string;
  basin_code: string;
  date: string;
  season: "sw" | "ne";
  rainfall_mm: number | null;
  cumulative_mm: number | null;
  lpa_mm: number | null;
  source: string;
}

export interface BasinRainfallSummary {
  season: "sw" | "ne" | null;
  asOfDate: string | null;
  cumulativeMm: number | null;
  lpaMm: number | null;
  series: BasinRainfallReading[];
  isLive: boolean;
}

export interface KaveriSnapshot {
  asOf: string | null;
  mettur: ReservoirReadingV2 | null;
  karnatakaDams: ReservoirReadingV2[];
  reservoirIsLive: boolean;
  basinRainfall: BasinRainfallSummary;
}

const KARNATAKA_SOURCE_CODES = ["krs", "kabini", "hemavathy", "harangi"] as const;

const EMPTY_BASIN: BasinRainfallSummary = {
  season: null,
  asOfDate: null,
  cumulativeMm: null,
  lpaMm: null,
  series: [],
  isLive: false,
};

function currentSeason(d: Date): "sw" | "ne" | null {
  const month = d.getUTCMonth() + 1;
  if (month >= 6 && month <= 9) return "sw";
  if (month >= 10 && month <= 12) return "ne";
  return null;
}

export async function loadKaveriSnapshot(): Promise<KaveriSnapshot> {
  let supabase;
  try {
    supabase = createServerClient();
  } catch {
    return {
      asOf: null,
      mettur: null,
      karnatakaDams: [],
      reservoirIsLive: false,
      basinRainfall: EMPTY_BASIN,
    };
  }

  const reservoirSourceCodes = ["mettur", ...KARNATAKA_SOURCE_CODES];

  const [reservoirResult, basinResult] = await Promise.all([
    loadReservoirs(supabase, reservoirSourceCodes),
    loadBasinRainfall(supabase),
  ]);

  return {
    asOf: reservoirResult.asOf,
    mettur: reservoirResult.mettur,
    karnatakaDams: reservoirResult.karnatakaDams,
    reservoirIsLive: reservoirResult.isLive,
    basinRainfall: basinResult,
  };
}

async function loadReservoirs(
  supabase: ReturnType<typeof createServerClient>,
  sourceCodes: string[],
): Promise<{
  asOf: string | null;
  mettur: ReservoirReadingV2 | null;
  karnatakaDams: ReservoirReadingV2[];
  isLive: boolean;
}> {
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

async function loadBasinRainfall(
  supabase: ReturnType<typeof createServerClient>,
): Promise<BasinRainfallSummary> {
  const today = new Date();
  const season = currentSeason(today);
  if (!season) {
    return EMPTY_BASIN;
  }

  const yearStart =
    season === "sw"
      ? `${today.getUTCFullYear()}-06-01`
      : `${today.getUTCFullYear()}-10-01`;

  const { data: rows, error } = await supabase
    .from("basin_rainfall_daily")
    .select(
      "city_id, basin_code, date, season, rainfall_mm, cumulative_mm, lpa_mm, source",
    )
    .eq("city_id", "kaveri")
    .eq("basin_code", "cauvery_basin")
    .eq("season", season)
    .gte("date", yearStart)
    .order("date", { ascending: true });

  if (error || !rows || rows.length === 0) {
    return EMPTY_BASIN;
  }

  const series = rows as BasinRainfallReading[];
  // Latest row with a non-null cumulative_mm; forecast rows (after today) have null cumulative.
  const observed = series.filter((r) => r.cumulative_mm !== null);
  const latest = observed.length > 0 ? observed[observed.length - 1] : null;

  return {
    season,
    asOfDate: latest?.date ?? null,
    cumulativeMm: latest?.cumulative_mm ?? null,
    lpaMm: latest?.lpa_mm ?? null,
    series,
    isLive: latest !== null,
  };
}
