import { NextRequest, NextResponse } from "next/server";
import { logRouteError } from "@/lib/api-error";
import { tryGetPlaceConfig } from "@/lib/cities";
import { createServerClient } from "@/lib/supabase/server";
import {
  RESERVOIR_DISPLAY_ORDER,
  RESERVOIR_METADATA,
} from "@/lib/utils/constants";
import { loadCityForecast, loadCityHistory } from "@/app/[cityId]/data";
import type {
  ChennaiReservoirName,
  ForecastSeries,
  HistorySeries,
  HistorySeriesPoint,
} from "@/types/reservoir";

export const revalidate = 900;

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
};

interface HistoryPayload {
  earliestDate: string | null;
  latestDate: string | null;
  pointCount: number;
  series: HistorySeries[];
  forecast: ForecastSeries[];
  forecastDate: string | null;
}

type LegacyHistoryRow = {
  date: string;
  reservoir: string;
  current_storage_mcft: number | null;
};

type LegacyForecastRow = {
  reservoir: string;
  forecast_date: string;
  target_date: string;
  predicted_storage_mcft: number | null;
  confidence_lower_mcft: number | null;
  confidence_upper_mcft: number | null;
};

function json(data: HistoryPayload, status = 200) {
  return NextResponse.json(data, { status, headers: CACHE_HEADERS });
}

function emptyPayload(): HistoryPayload {
  return {
    earliestDate: null,
    latestDate: null,
    pointCount: 0,
    series: [],
    forecast: [],
    forecastDate: null,
  };
}

async function loadLegacyChennaiHistory(): Promise<HistoryPayload> {
  const supabase = createServerClient();
  const rows: LegacyHistoryRow[] = [];
  const PAGE_SIZE = 1000;
  const MAX_ROWS = 20000;
  let offset = 0;

  while (rows.length < MAX_ROWS) {
    const { data, error } = await supabase
      .from("reservoir_daily")
      .select("date, reservoir, current_storage_mcft")
      .not("current_storage_mcft", "is", null)
      .order("date", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error || !data || data.length === 0) break;
    rows.push(...(data as LegacyHistoryRow[]));
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  if (rows.length === 0) return emptyPayload();

  const bySource = new Map<string, HistorySeriesPoint[]>();
  for (const row of rows) {
    const meta = RESERVOIR_METADATA[row.reservoir as ChennaiReservoirName];
    const points = bySource.get(row.reservoir) ?? [];
    const storage = Number(row.current_storage_mcft ?? 0);
    points.push({
      date: row.date,
      storage_tmc: storage,
      storage_pct_frl:
        meta?.fullCapacityMcft && meta.fullCapacityMcft > 0
          ? (storage / meta.fullCapacityMcft) * 100
          : null,
    });
    bySource.set(row.reservoir, points);
  }

  const orderedCodes = [
    ...RESERVOIR_DISPLAY_ORDER,
    ...Array.from(bySource.keys()).filter(
      (code) => !(RESERVOIR_DISPLAY_ORDER as readonly string[]).includes(code),
    ),
  ];
  const series: HistorySeries[] = orderedCodes
    .map((code) => {
      const meta = RESERVOIR_METADATA[code as ChennaiReservoirName];
      const points = bySource.get(code) ?? [];
      return {
        source_code: code,
        display_name: meta?.displayName ?? code,
        full_capacity_mcft: meta?.fullCapacityMcft ?? null,
        full_tank_level_ft: meta?.fullTankLevelFt ?? null,
        is_primary: true,
        points,
      };
    })
    .filter((s) => s.points.length > 0);

  const forecast = await loadLegacyChennaiForecast(supabase);
  const dates = rows.map((row) => row.date).sort();

  return {
    earliestDate: dates[0] ?? null,
    latestDate: dates[dates.length - 1] ?? null,
    pointCount: rows.length,
    series,
    forecast: forecast.series,
    forecastDate: forecast.forecastDate,
  };
}

async function loadLegacyChennaiForecast(
  supabase: ReturnType<typeof createServerClient>,
): Promise<{ forecastDate: string | null; series: ForecastSeries[] }> {
  const { data: latestRows, error: latestError } = await supabase
    .from("reservoir_forecast")
    .select("forecast_date")
    .order("forecast_date", { ascending: false })
    .limit(1);

  if (latestError || !latestRows?.[0]?.forecast_date) {
    return { forecastDate: null, series: [] };
  }

  const forecastDate = latestRows[0].forecast_date as string;
  const { data, error } = await supabase
    .from("reservoir_forecast")
    .select(
      "reservoir, forecast_date, target_date, predicted_storage_mcft, confidence_lower_mcft, confidence_upper_mcft",
    )
    .eq("forecast_date", forecastDate)
    .order("target_date", { ascending: true });

  if (error || !data) return { forecastDate: null, series: [] };

  const bySource = new Map<string, LegacyForecastRow[]>();
  for (const row of data as LegacyForecastRow[]) {
    const rows = bySource.get(row.reservoir) ?? [];
    rows.push(row);
    bySource.set(row.reservoir, rows);
  }

  const series: ForecastSeries[] = Array.from(bySource.entries())
    .map(([code, sourceRows]) => ({
      source_code: code,
      forecast_date: forecastDate,
      model_name: "auto_arima",
      points: sourceRows.map((row) => ({
        date: row.target_date,
        predicted_tmc: Number(row.predicted_storage_mcft ?? 0),
        lower_tmc: Number(row.confidence_lower_mcft ?? 0),
        upper_tmc: Number(row.confidence_upper_mcft ?? 0),
      })),
    }))
    .filter((s) => s.points.length > 0);

  return { forecastDate, series };
}

async function loadV2History(cityId: string): Promise<HistoryPayload | null> {
  const config = tryGetPlaceConfig(cityId);
  if (!config) return null;

  const [history, forecast] = await Promise.all([
    loadCityHistory(config),
    loadCityForecast(config),
  ]);

  return {
    earliestDate: history.earliestDate,
    latestDate: history.latestDate,
    pointCount: history.pointCount,
    series: history.series,
    forecast: forecast.series,
    forecastDate: forecast.forecastDate,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cityId = searchParams.get("cityId") || "chennai";

  try {
    if (cityId === "chennai") {
      return json(await loadLegacyChennaiHistory());
    }

    const payload = await loadV2History(cityId);
    if (!payload) return json(emptyPayload());
    return json(payload);
  } catch (error) {
    logRouteError("/api/reservoir/history", error);
    return json(emptyPayload(), 500);
  }
}
