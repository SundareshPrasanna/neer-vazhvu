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
    value: `${todayFmt}`,
    unit: `MCFT today · ~${dayZero2019} MCFT in 2019`,
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
    title: "Water body area change (24 months)",
    value: netFmt,
    unit: "hectares net",
    interpretation: `Across ${count} tracked water bodies, satellite imagery shows a net ${netFmt} ha change in surface area over the last 24 months.`,
    data_date: changes[0].endDate,
    published_date: changes[0].endDate,
    retrieved_at: retrievedAt,
    computed_at: retrievedAt,
    source_url: "https://neervazhvu.org/water-bodies",
    source_label: "GEE Sentinel-2 NDWI, Neer Vazhvu pipeline",
    method_id: "gee-area-24mo",
    confidence: "medium",
    claim_status: "observed",
    quote_text: `Across ${count} water bodies tracked by Neer Vazhvu using Sentinel-2 satellite imagery (NDWI), the net surface area change over the last 24 months was ${netFmt} hectares. Source: Neer Vazhvu GEE pipeline.`,
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
      ? "Biggest-shrinking water body (24 months)"
      : "Biggest-growing water body (24 months)";
  const interpretation =
    kind === "loser"
      ? `${top.name} has lost ${Math.abs(top.deltaPct).toFixed(1)}% of its surface area over the last 24 months - the largest relative decline among tracked bodies.`
      : `${top.name} has grown ${top.deltaPct.toFixed(1)}% in surface area over the last 24 months. Consistent with restoration, rainfall retention, or seasonal hydrology - causal attribution requires field verification.`;

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
    method_id: "gee-delta-24mo",
    confidence: "medium",
    claim_status: "observed",
    quote_text:
      kind === "loser"
        ? `${top.name} lost ${Math.abs(top.deltaPct).toFixed(1)}% of its surface area between ${top.startDate} and ${top.endDate}, the largest relative decline among water bodies tracked by Neer Vazhvu using Sentinel-2 imagery. Source: Neer Vazhvu GEE pipeline.`
        : `${top.name} grew ${top.deltaPct.toFixed(1)}% in surface area between ${top.startDate} and ${top.endDate}. Consistent with restoration, rainfall retention, or seasonal hydrology - causal attribution requires field verification. Source: Neer Vazhvu GEE pipeline.`,
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

async function fetchWaterBodyChanges(): Promise<WaterBodyChange[] | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("water_body_satellite_summary")
    .select("gee_target_id, latest_observed_area_ha, summary_date")
    .order("summary_date", { ascending: true });

  if (!data || data.length === 0) return null;

  const names = await loadTargetNames();

  interface SummaryRow {
    gee_target_id: string;
    latest_observed_area_ha: number | null;
    summary_date: string | null;
  }

  const grouped = new Map<string, SummaryRow[]>();
  for (const row of data as SummaryRow[]) {
    if (!row.gee_target_id) continue;
    const arr = grouped.get(row.gee_target_id) ?? [];
    arr.push(row);
    grouped.set(row.gee_target_id, arr);
  }

  const changes: WaterBodyChange[] = [];
  for (const [id, rows] of grouped) {
    if (rows.length < 2) continue;
    const first = rows[0];
    const last = rows[rows.length - 1];
    if (
      first.latest_observed_area_ha == null ||
      last.latest_observed_area_ha == null ||
      first.latest_observed_area_ha <= 0
    )
      continue;
    const name = names.get(id);
    const deltaHa = last.latest_observed_area_ha - first.latest_observed_area_ha;
    const deltaPct = (deltaHa / first.latest_observed_area_ha) * 100;
    changes.push({
      name: name ?? "",
      startArea: first.latest_observed_area_ha,
      endArea: last.latest_observed_area_ha,
      deltaHa,
      deltaPct,
      startDate: first.summary_date ?? "",
      endDate: last.summary_date ?? "",
    });
  }

  return changes;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  });
}
