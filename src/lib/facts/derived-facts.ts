import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import type { Fact } from "@/types/facts";

/**
 * Derived Tier 2 facts - computed from existing refreshable data files
 * (public/data/*.json) rather than hardcoded.
 *
 * When the underlying data file is regenerated via its refresh script
 * (listed in DATA_SOURCES.md and below), the fact auto-updates. This keeps
 * /facts in sync with the rest of the app without a code change.
 *
 * Refresh sources:
 * - public/data/gwr-blocks.json        -> scripts/fetch-wris-groundwater.ts
 * - public/data/river-quality.json     -> manual CPCB PDF extraction (annual)
 *
 * Failures are non-fatal - if a source file is missing or malformed, we
 * skip that card rather than break the page. Callers should filter nulls.
 */
export async function buildDerivedFacts(): Promise<Fact[]> {
  const retrievedAt = new Date().toISOString();
  const results = await Promise.allSettled([
    buildCgwbOverExploitedBlocks(retrievedAt),
    buildCgwbBlockNames(retrievedAt),
    buildCooumDoRecord(retrievedAt),
    buildCooumBodRecord(retrievedAt),
    buildBuckinghamDoRecord(retrievedAt),
    buildGwDataGap(retrievedAt),
  ]);

  return results
    .filter(
      (r): r is PromiseFulfilledResult<Fact | null> =>
        r.status === "fulfilled" && r.value !== null,
    )
    .map((r) => r.value as Fact);
}

// ── GWR blocks (CGWB) ────────────────────────────────────────────────────────

interface GwrBlockEntry {
  name: string;
  latest: {
    class: string;
    development_pct: number | null;
  };
}

interface GwrBlocksFile {
  source: string;
  fetched_at: string;
  years: number[];
  blocks: GwrBlockEntry[];
}

let gwrCache: GwrBlocksFile | null = null;

async function loadGwrBlocks(): Promise<GwrBlocksFile | null> {
  if (gwrCache) return gwrCache;
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), "public", "data", "gwr-blocks.json"),
      "utf8",
    );
    gwrCache = JSON.parse(raw) as GwrBlocksFile;
    return gwrCache;
  } catch {
    return null;
  }
}

async function buildCgwbOverExploitedBlocks(
  retrievedAt: string,
): Promise<Fact | null> {
  const data = await loadGwrBlocks();
  if (!data) return null;

  const overExploited = data.blocks.filter(
    (b) => b.latest.class === "Over Exploited",
  );
  const total = data.blocks.length;
  const pct = total > 0 ? Math.round((overExploited.length / total) * 100) : 0;
  const latestYear = data.years[data.years.length - 1] ?? null;
  const dataDate = latestYear ? `${latestYear}-01-01` : null;

  return {
    id: "cgwb-over-exploited-blocks",
    tier: 2,
    category: "groundwater",
    title: "CGWB over-exploited blocks",
    value: `${overExploited.length} of ${total}`,
    unit: "blocks",
    interpretation: `${pct}% of Chennai's groundwater blocks are classified "Over-Exploited" in the CGWB ${latestYear} assessment - water drawn exceeds natural recharge.`,
    data_date: dataDate,
    published_date: dataDate,
    retrieved_at: retrievedAt,
    computed_at: retrievedAt,
    source_url: "https://cgwb.gov.in/",
    source_label: `CGWB Dynamic Ground Water Resource Assessment ${latestYear ?? ""}`.trim(),
    method_id: "cgwb-block-assessment",
    confidence: "high",
    claim_status: "observed",
    quote_text: `${pct}% of Chennai's groundwater blocks (${overExploited.length} of ${total}) are classified "Over-Exploited" by the Central Ground Water Board in its ${latestYear ?? "latest"} assessment - water drawn exceeds natural recharge. Source: CGWB Dynamic Ground Water Resource Assessment.`,
  };
}

async function buildCgwbBlockNames(retrievedAt: string): Promise<Fact | null> {
  const data = await loadGwrBlocks();
  if (!data) return null;

  const overExploited = data.blocks
    .filter((b) => b.latest.class === "Over Exploited")
    .map((b) => b.name);
  if (overExploited.length === 0) return null;

  const latestYear = data.years[data.years.length - 1] ?? null;
  const dataDate = latestYear ? `${latestYear}-01-01` : null;
  const names = overExploited.join(", ");

  return {
    id: "over-exploited-block-names",
    tier: 2,
    category: "groundwater",
    title: "Blocks in crisis",
    value: String(overExploited.length),
    unit: "named blocks",
    interpretation: `${names} are drawing groundwater faster than it recharges.`,
    data_date: dataDate,
    published_date: dataDate,
    retrieved_at: retrievedAt,
    computed_at: retrievedAt,
    source_url: "https://cgwb.gov.in/",
    source_label: `CGWB ${latestYear ?? ""} assessment`.trim(),
    method_id: "cgwb-block-assessment",
    confidence: "high",
    claim_status: "observed",
    quote_text: `${overExploited.length} Chennai blocks are classified Over-Exploited by CGWB in its ${latestYear ?? "latest"} assessment: ${names}. Source: CGWB Dynamic Ground Water Resource Assessment.`,
  };
}

// ── River quality (CPCB) ─────────────────────────────────────────────────────

interface StationReading {
  year: number;
  do_mgl: number | null;
  bod_mgl: number | null;
}

interface RiverStation {
  id: string;
  name: string;
  readings: StationReading[];
}

interface River {
  id: string;
  name: string;
  stations: RiverStation[];
}

interface RiverQualityFile {
  last_updated: string;
  data_year_range: [number, number];
  rivers: River[];
}

let riverQualityCache: RiverQualityFile | null = null;

async function loadRiverQuality(): Promise<RiverQualityFile | null> {
  if (riverQualityCache) return riverQualityCache;
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), "public", "data", "river-quality.json"),
      "utf8",
    );
    riverQualityCache = JSON.parse(raw) as RiverQualityFile;
    return riverQualityCache;
  } catch {
    return null;
  }
}

interface RiverExtreme {
  station: string;
  year: number;
  value: number;
}

function findExtremeReading(
  river: River,
  metric: "do_mgl" | "bod_mgl",
  direction: "min" | "max",
): RiverExtreme | null {
  let best: RiverExtreme | null = null;
  for (const station of river.stations) {
    for (const reading of station.readings) {
      const v = reading[metric];
      if (v == null) continue;
      if (
        best == null ||
        (direction === "min" && v < best.value) ||
        (direction === "max" && v > best.value)
      ) {
        best = { station: station.name, year: reading.year, value: v };
      }
    }
  }
  return best;
}

async function buildCooumDoRecord(retrievedAt: string): Promise<Fact | null> {
  const data = await loadRiverQuality();
  if (!data) return null;
  const cooum = data.rivers.find((r) => r.id === "cooum");
  if (!cooum) return null;

  const extreme = findExtremeReading(cooum, "do_mgl", "min");
  if (!extreme) return null;

  const dataDate = `${extreme.year}-01-01`;
  return {
    id: "cooum-do-record",
    tier: 2,
    category: "rivers",
    title: "Cooum oxygen collapse",
    value: extreme.value.toFixed(1),
    unit: "mg/L",
    interpretation: `The worst recorded dissolved oxygen on the Cooum was ${extreme.value.toFixed(1)} mg/L at ${extreme.station} in ${extreme.year}. CPCB's Class D criterion for Propagation of Wildlife and Fisheries requires DO >= 4 mg/L.`,
    data_date: dataDate,
    published_date: `${data.data_year_range[1]}-01-01`,
    retrieved_at: retrievedAt,
    computed_at: retrievedAt,
    source_url: "https://cpcb.nic.in/water-quality-criteria/",
    source_label: `CPCB NWMP via river-quality.json (${extreme.station}, ${extreme.year})`,
    method_id: "river-quality-extreme",
    confidence: "high",
    claim_status: "observed",
    threshold: {
      value: 4,
      source: "CPCB Class D",
      label: "Propagation of Wildlife and Fisheries (DO >= 4 mg/L)",
    },
    quote_text: `The worst recorded annual midpoint dissolved oxygen on the Cooum was ${extreme.value.toFixed(1)} mg/L at ${extreme.station} in ${extreme.year} - aquatic life cannot survive at this level. CPCB's Class D criterion for Propagation of Wildlife and Fisheries requires DO >= 4 mg/L. Source: CPCB National Water Monitoring Programme.`,
  };
}

async function buildCooumBodRecord(retrievedAt: string): Promise<Fact | null> {
  const data = await loadRiverQuality();
  if (!data) return null;
  const cooum = data.rivers.find((r) => r.id === "cooum");
  if (!cooum) return null;

  const extreme = findExtremeReading(cooum, "bod_mgl", "max");
  if (!extreme) return null;

  const dataDate = `${extreme.year}-01-01`;
  return {
    id: "cooum-bod-record",
    tier: 2,
    category: "rivers",
    title: "Cooum sewage load peak",
    value: String(extreme.value),
    unit: "mg/L",
    interpretation: `Peak biochemical oxygen demand on the Cooum was ${extreme.value} mg/L at ${extreme.station} in ${extreme.year} - a clean river is below 2 mg/L.`,
    data_date: dataDate,
    published_date: `${data.data_year_range[1]}-01-01`,
    retrieved_at: retrievedAt,
    computed_at: retrievedAt,
    source_url: "https://cpcb.nic.in/",
    source_label: `CPCB NWMP via river-quality.json (${extreme.station}, ${extreme.year})`,
    method_id: "river-quality-extreme",
    confidence: "high",
    claim_status: "observed",
    quote_text: `The peak recorded annual midpoint biochemical oxygen demand on the Cooum was ${extreme.value} mg/L at ${extreme.station} in ${extreme.year}. A clean river has BOD below 2 mg/L. Source: CPCB National Water Monitoring Programme.`,
  };
}

async function buildBuckinghamDoRecord(
  retrievedAt: string,
): Promise<Fact | null> {
  const data = await loadRiverQuality();
  if (!data) return null;
  const bucks = data.rivers.find((r) => r.id === "buckingham-canal");
  if (!bucks) return null;

  const extreme = findExtremeReading(bucks, "do_mgl", "min");
  if (!extreme) return null;

  const dataDate = `${extreme.year}-01-01`;
  return {
    id: "buckingham-do-record",
    tier: 2,
    category: "rivers",
    title: "Buckingham Canal DO collapse",
    value: extreme.value.toFixed(1),
    unit: "mg/L",
    interpretation: `Dissolved oxygen at ${extreme.station} fell to ${extreme.value.toFixed(1)} mg/L in ${extreme.year} - the canal effectively functions as an open drain.`,
    data_date: dataDate,
    published_date: `${data.data_year_range[1]}-01-01`,
    retrieved_at: retrievedAt,
    computed_at: retrievedAt,
    source_url: "https://cpcb.nic.in/",
    source_label: `CPCB NWMP via river-quality.json (${extreme.station}, ${extreme.year})`,
    method_id: "river-quality-extreme",
    confidence: "high",
    claim_status: "observed",
    quote_text: `Dissolved oxygen at ${extreme.station} (Buckingham Canal) was ${extreme.value.toFixed(1)} mg/L in ${extreme.year} - the canal functions as an open drain. Source: CPCB National Water Monitoring Programme via Neer Vazhvu river-quality dataset.`,
  };
}

// ── Groundwater publication gap ─────────────────────────────────────────────

/**
 * Meta-fact: how long has it been since ward-level groundwater data was
 * published? The OpenCity CKAN resource is updated annually, covering the
 * previous calendar year. When the gap exceeds 6 months past the expected
 * publication window, this fact surfaces it as a transparency issue.
 */
async function buildGwDataGap(retrievedAt: string): Promise<Fact | null> {
  // OpenCity Chennai publication date for ward-wise GW data (Nov 2025 covering 2024)
  // Updated when new OpenCity data lands; see DATA_SOURCES.md for the latest.
  const LAST_PUBLICATION = "2025-11-27";
  const LAST_DATA_YEAR = 2024;

  const today = new Date();
  const lastPub = new Date(LAST_PUBLICATION);
  const msPerMonth = 1000 * 60 * 60 * 24 * 30.4375;
  const monthsSincePublication = Math.max(
    0,
    Math.round((today.getTime() - lastPub.getTime()) / msPerMonth),
  );

  // "Months of data missing" = from end of last covered year until today.
  // More meaningful than "months since last release" because it quantifies
  // what citizens and journalists can't see.
  const lastDataCoverageEnd = new Date(LAST_DATA_YEAR + 1, 0, 1); // Jan 1 of year after
  const monthsOfMissingData = Math.max(
    0,
    Math.round((today.getTime() - lastDataCoverageEnd.getTime()) / msPerMonth),
  );

  return {
    id: "data-gap-gw",
    tier: 2,
    category: "transparency",
    title: "Data Transparency Watch: groundwater",
    value: String(monthsOfMissingData),
    unit: "months of data unavailable",
    interpretation: `Chennai's ward-level groundwater depth data was last published on ${LAST_PUBLICATION}, covering ${LAST_DATA_YEAR}. No ${LAST_DATA_YEAR + 1} or later data has been released - ${monthsOfMissingData} months of monitoring are currently unavailable to the public (${monthsSincePublication} months since the last release).`,
    data_date: today.toISOString().slice(0, 10),
    published_date: LAST_PUBLICATION,
    retrieved_at: retrievedAt,
    computed_at: retrievedAt,
    source_url:
      "https://data.opencity.in/dataset/chennai-ward-wise-groundwater-levels",
    source_label: "OpenCity Chennai (CMWSSB piezometer network)",
    method_id: "opencity-gw-gap",
    confidence: "high",
    claim_status: "observed",
    quote_text: `Chennai's ward-level groundwater depth data was last published on ${LAST_PUBLICATION}, covering the ${LAST_DATA_YEAR} calendar year. As of ${today.toISOString().slice(0, 10)}, ${monthsOfMissingData} months of publicly-available monitoring data is missing (${monthsSincePublication} months since the last release). Source: OpenCity Chennai / CMWSSB piezometer network.`,
  };
}
