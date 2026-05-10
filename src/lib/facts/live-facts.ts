import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import { createServerClient } from "@/lib/supabase/server";
import { DAY_ZERO_2019 } from "@/lib/utils/constants";
import type { Fact } from "@/types/facts";

/**
 * Tier 1 (Live) facts computed at request time from Supabase.
 *
 * Failures here must be non-fatal: if a source is unavailable, we skip
 * that card rather than break the page. Each builder returns `Fact | null`
 * so the caller can filter.
 */
export async function buildLiveFacts(): Promise<Fact[]> {
  const retrievedAt = new Date().toISOString();

  const results = await Promise.allSettled([
    buildReservoirToday(retrievedAt),
    buildDayZeroCompare(retrievedAt),
    buildRainfallLast30d(retrievedAt),
    buildWaterBodyAreaChange(retrievedAt),
    buildBiggestWaterBodyChange(retrievedAt, "loser"),
    buildBiggestWaterBodyChange(retrievedAt, "gainer"),
    buildWardGwCrisis(retrievedAt),
  ]);

  return results
    .filter(
      (r): r is PromiseFulfilledResult<Fact | null> =>
        r.status === "fulfilled" && r.value !== null,
    )
    .map((r) => r.value as Fact);
}

async function buildReservoirToday(retrievedAt: string): Promise<Fact | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("reservoir_daily")
    .select("date, current_storage_mcft, capacity_mcft")
    .order("date", { ascending: false })
    .limit(6);

  if (!data || data.length === 0) return null;

  const latestDate = data[0].date as string;
  const todayRows = data.filter((r) => r.date === latestDate);
  const totalStorage = todayRows.reduce(
    (s, r) => s + (r.current_storage_mcft || 0),
    0,
  );
  const totalCapacity = todayRows.reduce(
    (s, r) => s + (r.capacity_mcft || 0),
    0,
  );
  const pct = totalCapacity > 0 ? (totalStorage / totalCapacity) * 100 : 0;
  const totalFmt = formatNumber(totalStorage);
  const capacityFmt = formatNumber(totalCapacity);
  const pctFmt = pct.toFixed(1);

  return {
    id: "reservoir-today",
    tier: 1,
    category: "supply",
    title: "Reservoir storage today",
    value: `${totalFmt}`,
    unit: `MCFT (${pctFmt}% of ${capacityFmt} MCFT)`,
    interpretation: `Chennai's six combined reservoirs hold ${totalFmt} MCFT of water today - ${pctFmt}% of total capacity (${capacityFmt} MCFT).`,
    data_date: latestDate,
    published_date: latestDate,
    retrieved_at: retrievedAt,
    computed_at: retrievedAt,
    source_url: "https://cmwssb.tn.gov.in/lake-level",
    source_label: "CMWSSB daily lake level scrape",
    method_id: "reservoir-sum",
    confidence: "high",
    claim_status: "observed",
    quote_text: `Chennai's six combined reservoirs held ${totalFmt} MCFT of water on ${latestDate} - ${pctFmt}% of total capacity (${capacityFmt} MCFT). Source: CMWSSB daily lake level page.`,
  };
}

async function buildDayZeroCompare(retrievedAt: string): Promise<Fact | null> {
  const supabase = createServerClient();
  const { data: todayRows } = await supabase
    .from("reservoir_daily")
    .select("date, current_storage_mcft")
    .order("date", { ascending: false })
    .limit(6);

  if (!todayRows || todayRows.length === 0) return null;
  const latestDate = todayRows[0].date as string;
  const today = todayRows
    .filter((r) => r.date === latestDate)
    .reduce((s, r) => s + (r.current_storage_mcft || 0), 0);

  const dayZero2019 = DAY_ZERO_2019.totalStorageMcft;
  const diff = today - dayZero2019;
  const direction = diff >= 0 ? "higher" : "lower";
  const todayFmt = formatNumber(today);
  const diffFmt = formatNumber(Math.abs(diff));

  return {
    id: "day-zero-compare",
    tier: 1,
    category: "supply",
    title: "Today vs 2019 Day Zero",
    // Headline the DIFFERENCE rather than today's absolute storage,
    // otherwise this card displays the same big number as
    // "Reservoir storage today" right above it and reads as a duplicate.
    value: `${diffFmt}`,
    unit: `MCFT ${direction} than 2019 Day Zero (~${dayZero2019} MCFT)`,
    interpretation: `Chennai's reservoirs today (${todayFmt} MCFT) hold ${diffFmt} MCFT ${direction} than the ~${dayZero2019} MCFT of usable storage when reservoirs were effectively dry on 19 June 2019.`,
    data_date: latestDate,
    published_date: latestDate,
    retrieved_at: retrievedAt,
    computed_at: retrievedAt,
    source_url: "https://cmwssb.tn.gov.in/lake-level",
    source_label: "CMWSSB daily + 2019 archive",
    method_id: "day-zero-diff",
    confidence: "high",
    claim_status: "observed",
    quote_text: `Chennai's reservoirs held ${todayFmt} MCFT of water on ${latestDate} - that is ${diffFmt} MCFT ${direction} than the ~${dayZero2019} MCFT of usable storage recorded on 19 June 2019, when the reservoirs were effectively dry at the height of the Day Zero crisis. Source: CMWSSB.`,
  };
}

/**
 * Counts wards at crisis-level groundwater depth (>25m) in the latest
 * monthly OpenCity / CMWSSB piezometer snapshot present in Supabase.
 * Goes stale if the OpenCity ingestion pipeline falls behind - see
 * `data-gap-gw` derived fact for the publication gap signal.
 */
async function buildWardGwCrisis(retrievedAt: string): Promise<Fact | null> {
  const supabase = createServerClient();
  const { data: latestPeriod } = await supabase
    .from("groundwater_monthly")
    .select("year, month")
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(1);

  if (!latestPeriod || latestPeriod.length === 0) return null;
  const { year, month } = latestPeriod[0] as { year: number; month: number };

  const { data: wardRows } = await supabase
    .from("groundwater_monthly")
    .select("ward_number, depth_to_water_m")
    .eq("year", year)
    .eq("month", month);

  if (!wardRows || wardRows.length === 0) return null;

  const crisisCount = wardRows.filter(
    (r) =>
      r.depth_to_water_m != null && (r.depth_to_water_m as number) > 25,
  ).length;
  const totalWards = wardRows.length;
  const dataDate = `${year}-${String(month).padStart(2, "0")}-01`;

  return {
    id: "ward-gw-crisis",
    tier: 2,
    category: "groundwater",
    title: "Wards at crisis groundwater depth",
    value: String(crisisCount),
    unit: `of ${totalWards} wards with data (>25m deep)`,
    interpretation: `${crisisCount} of ${totalWards} Chennai wards with ward-level data are at "crisis" groundwater depth (greater than 25 metres below ground) in the latest ${dataDate} snapshot.`,
    data_date: dataDate,
    published_date: dataDate,
    retrieved_at: retrievedAt,
    computed_at: retrievedAt,
    source_url:
      "https://data.opencity.in/dataset/chennai-ward-wise-groundwater-levels",
    source_label: `OpenCity / CMWSSB piezometer network, ${year}-${String(month).padStart(2, "0")}`,
    method_id: "ward-gw-crisis-count",
    confidence: "medium",
    claim_status: "observed",
    quote_text: `${crisisCount} of ${totalWards} Chennai wards with published data sit at "crisis" groundwater depth (over 25 metres below ground) in the latest ${dataDate} CMWSSB piezometer snapshot. Source: OpenCity Chennai ward-wise groundwater dataset.`,
  };
}

async function buildRainfallLast30d(retrievedAt: string): Promise<Fact | null> {
  const supabase = createServerClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const { data } = await supabase
    .from("weather_daily")
    .select("date, rainfall_mm")
    .gte("date", thirtyDaysAgo)
    .order("date", { ascending: false });

  if (!data || data.length === 0) return null;
  const total = data.reduce((s, r) => s + (r.rainfall_mm || 0), 0);
  const latestDate = data[0].date as string;
  const totalFmt = total.toFixed(1);

  return {
    id: "rainfall-last-30d",
    tier: 1,
    category: "rainfall",
    title: "Rainfall in the last 30 days",
    value: `${totalFmt}`,
    unit: "mm",
    interpretation: `Chennai received ${totalFmt} mm of rainfall in the past 30 days.`,
    data_date: latestDate,
    published_date: latestDate,
    retrieved_at: retrievedAt,
    computed_at: retrievedAt,
    source_url: "https://open-meteo.com/",
    source_label: "Open-Meteo daily + NASA POWER fallback",
    method_id: "rainfall-30d-sum",
    confidence: "high",
    claim_status: "observed",
    quote_text: `Chennai recorded ${totalFmt} mm of rainfall in the 30 days leading to ${latestDate}. Source: Open-Meteo (primary), NASA POWER (fallback), via the Neer Vazhvu pipeline.`,
  };
}

async function buildWaterBodyAreaChange(
  retrievedAt: string,
): Promise<Fact | null> {
  const changes = await fetchWaterBodyChanges();
  if (!changes || changes.length === 0) return null;

  const netHaChange = changes.reduce((s, c) => s + c.deltaHa, 0);
  const netFmt = netHaChange >= 0 ? `+${netHaChange.toFixed(1)}` : netHaChange.toFixed(1);
  const count = changes.length;

  return {
    id: "water-body-area-change",
    tier: 1,
    category: "water-bodies",
    title: "Water body area change (year-over-year)",
    value: netFmt,
    unit: "hectares net",
    interpretation: `Across ${count} tracked water bodies with sufficient data, comparing the most recent 6 months against the same 6 calendar months of the previous year yields a net ${netFmt} ha change in surface area.`,
    data_date: changes[0].endDate,
    published_date: changes[0].endDate,
    retrieved_at: retrievedAt,
    computed_at: retrievedAt,
    source_url: "https://neervazhvu.org/water-bodies",
    source_label: "GEE Sentinel-2 NDWI, Neer Vazhvu pipeline",
    method_id: "gee-yoy-comparison",
    confidence: "medium",
    claim_status: "observed",
    quote_text: `Across ${count} water bodies with sufficient seasonal data, Sentinel-2 satellite imagery (NDWI) shows a net ${netFmt} hectare change when comparing the most recent 6 months to the same 6 calendar months of the prior year. Small ponds (<5 ha baseline) and readings with cloud cover are excluded. Source: Neer Vazhvu GEE pipeline.`,
  };
}

async function buildBiggestWaterBodyChange(
  retrievedAt: string,
  kind: "loser" | "gainer",
): Promise<Fact | null> {
  const changes = await fetchWaterBodyChanges();
  if (!changes || changes.length === 0) return null;

  const named = changes.filter((c) => c.name && c.name.trim().length > 0);
  if (named.length === 0) return null;

  const sorted = [...named].sort((a, b) =>
    kind === "loser" ? a.deltaPct - b.deltaPct : b.deltaPct - a.deltaPct,
  );
  const top = sorted[0];
  if (!top) return null;

  const pctFmt = top.deltaPct >= 0 ? `+${top.deltaPct.toFixed(1)}` : top.deltaPct.toFixed(1);
  const id = kind === "loser" ? "water-body-biggest-loser" : "water-body-biggest-gainer";
  const title =
    kind === "loser"
      ? "Biggest-shrinking water body (year-over-year)"
      : "Biggest-growing water body (year-over-year)";
  const interpretation =
    kind === "loser"
      ? `${top.name}'s 6-month average surface area is ${Math.abs(top.deltaPct).toFixed(1)}% smaller than the same 6 calendar months a year earlier - the largest relative decline among water bodies with sufficient seasonal data.`
      : `${top.name}'s 6-month average surface area is ${top.deltaPct.toFixed(1)}% larger than the same 6 calendar months a year earlier. Consistent with restoration, rainfall retention, or seasonal hydrology - causal attribution requires field verification.`;

  return {
    id,
    tier: 1,
    category: "water-bodies",
    title,
    value: top.name,
    unit: `${pctFmt}% area`,
    interpretation,
    data_date: top.endDate,
    published_date: top.endDate,
    retrieved_at: retrievedAt,
    computed_at: retrievedAt,
    source_url: "https://neervazhvu.org/water-bodies",
    source_label: "GEE Sentinel-2 NDWI, Neer Vazhvu pipeline",
    method_id: "gee-yoy-comparison",
    confidence: "medium",
    claim_status: "observed",
    quote_text:
      kind === "loser"
        ? `${top.name} recorded a 6-month average surface area ${Math.abs(top.deltaPct).toFixed(1)}% smaller than the same 6 calendar months a year earlier (comparing up to ${top.endDate}). The largest year-over-year decline among Chennai water bodies with sufficient seasonal satellite data. Source: Neer Vazhvu GEE pipeline using Sentinel-2 NDWI.`
        : `${top.name} recorded a 6-month average surface area ${top.deltaPct.toFixed(1)}% larger than the same 6 calendar months a year earlier (comparing up to ${top.endDate}). Consistent with restoration, rainfall retention, or seasonal hydrology - causal attribution requires field verification. Source: Neer Vazhvu GEE pipeline using Sentinel-2 NDWI.`,
  };
}

interface WaterBodyChange {
  name: string;
  startArea: number;
  endArea: number;
  deltaHa: number;
  deltaPct: number;
  startDate: string;
  endDate: string;
}

interface PhaseTarget {
  gee_target_id: string;
  name: string;
}

let targetsByIdCache: Map<string, string> | null = null;

async function loadTargetNames(): Promise<Map<string, string>> {
  if (targetsByIdCache) return targetsByIdCache;
  const filePath = path.join(
    process.cwd(),
    "public",
    "data",
    "gee-phase1-water-body-targets.json",
  );
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as { targets: PhaseTarget[] };
    const map = new Map<string, string>();
    for (const t of parsed.targets) {
      if (t.gee_target_id && t.name && t.name.trim().length > 0) {
        map.set(t.gee_target_id, t.name);
      }
    }
    targetsByIdCache = map;
    return map;
  } catch {
    return new Map();
  }
}

/**
 * Minimum % valid satellite pixels required for a reading to count.
 * Low values mean the lake was mostly under cloud cover or partial scene.
 */
const MIN_VALID_PIXEL_PCT = 80;

/**
 * Minimum baseline area (hectares) for a water body to be included in
 * biggest-change rankings. Below this threshold, percentage changes are
 * dominated by measurement noise.
 */
const MIN_BASELINE_AREA_HA = 5;

/**
 * Number of months on each side of the comparison window.
 * We compare the most-recent 6 valid months against the same 6 calendar
 * months in the prior year - so the comparison is season-matched.
 */
const COMPARISON_WINDOW_MONTHS = 6;

async function fetchWaterBodyChanges(): Promise<WaterBodyChange[] | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("water_body_satellite_summary")
    .select(
      "gee_target_id, latest_observed_area_ha, summary_date, valid_pixel_pct",
    )
    .order("summary_date", { ascending: true });

  if (!data || data.length === 0) return null;

  const names = await loadTargetNames();

  interface SummaryRow {
    gee_target_id: string;
    latest_observed_area_ha: number | null;
    summary_date: string | null;
    valid_pixel_pct: number | null;
  }

  const grouped = new Map<string, SummaryRow[]>();
  for (const row of data as SummaryRow[]) {
    if (!row.gee_target_id) continue;
    if (!row.summary_date) continue;
    // Drop readings where the satellite couldn't see enough of the scene
    if ((row.valid_pixel_pct ?? 0) < MIN_VALID_PIXEL_PCT) continue;
    const arr = grouped.get(row.gee_target_id) ?? [];
    arr.push(row);
    grouped.set(row.gee_target_id, arr);
  }

  const changes: WaterBodyChange[] = [];
  for (const [id, rows] of grouped) {
    // Need at least two years of usable readings so the 12-month comparison
    // has both a current window and a prior-year window
    if (rows.length < 18) continue;

    const recent = rows.slice(-COMPARISON_WINDOW_MONTHS);
    const priorStart = Math.max(
      0,
      rows.length - 12 - COMPARISON_WINDOW_MONTHS,
    );
    const priorEnd = rows.length - 12;
    const prior = rows.slice(priorStart, priorEnd);
    if (recent.length < 3 || prior.length < 3) continue;

    const recentAvg = average(
      recent.map((r) => r.latest_observed_area_ha ?? 0),
    );
    const priorAvg = average(
      prior.map((r) => r.latest_observed_area_ha ?? 0),
    );

    // Skip noise: baseline too small to produce meaningful percentages
    if (priorAvg < MIN_BASELINE_AREA_HA) continue;

    const deltaHa = recentAvg - priorAvg;
    const deltaPct = (deltaHa / priorAvg) * 100;

    // Hard sanity cap - values outside this range are almost always artifacts
    // (calibration changes, cloud cover, mask misalignment)
    if (deltaPct > 300 || deltaPct < -95) continue;

    const name = names.get(id);
    changes.push({
      name: name ?? "",
      startArea: priorAvg,
      endArea: recentAvg,
      deltaHa,
      deltaPct,
      startDate: prior[0].summary_date ?? "",
      endDate: recent[recent.length - 1].summary_date ?? "",
    });
  }

  return changes;
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  });
}
