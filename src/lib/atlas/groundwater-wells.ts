/**
 * Monitored wells placed in Gram Panchayats: groundwater level readings and
 * well chemistry from the National Water Data Portal (NWDP), each station
 * put in the Panchayat whose polygon contains it. This is the within-place
 * evidence the Atlas has otherwise lacked: IN-GRES assesses a block or a
 * taluk, while a monitored well sits in one Panchayat.
 *
 * Reading rules follow the Erode district map's (scripts/lib/tn_district_basin.py):
 * sentinel values are dropped, the sign convention is read per station from
 * its own median (telemetry reports depth as a negative number, manual wells
 * as a positive one), and readings outside a physical envelope are dropped
 * and counted. A station whose readings never change is a stuck sensor and
 * is dropped whole. Depths are metres below ground level: for KSGWD's manual
 * wells the published 'Water Level' already is (co-located telemetry agrees
 * to within centimetres), so the measuring-point height is not subtracted.
 */

import type { AtlasEnvelope } from "./artifacts";

export const GROUNDWATER_WELLS_SCHEMA_VERSION = 1;

/** Placeholder values the telemetry feeds use for "no reading". */
export const WELL_SENTINELS = [0, 1, -1];
/** Physical envelope in metres below ground level. */
export const WELL_ENVELOPE_M: [number, number] = [-5, 200];
/** Kerala's pre-monsoon season, when levels are lowest before the June rains. */
export const PRE_MONSOON_MONTHS = [3, 4, 5];
/** A trend needs this many pre-monsoon seasons within the window. */
export const TREND_MIN_YEARS = 5;
export const TREND_WINDOW_YEARS = 10;

export interface RawReading {
  /** YYYY-MM-DD */
  date: string;
  value: number;
}

export interface WellReading {
  date: string;
  depthMbgl: number;
}

export interface CleanedReadings {
  readings: WellReading[];
  dropped: number;
  /** Every reading identical: a stuck sensor, so nothing is kept. */
  flatlined: boolean;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const round = (value: number, places = 2): number => Number(value.toFixed(places));

export function cleanReadings(raw: RawReading[]): CleanedReadings {
  const kept = raw.filter((reading) => Number.isFinite(reading.value) && !WELL_SENTINELS.includes(reading.value));
  if (kept.length >= 3 && new Set(kept.map((reading) => reading.value)).size === 1) {
    return { readings: [], dropped: raw.length, flatlined: true };
  }
  if (kept.length === 0) return { readings: [], dropped: raw.length, flatlined: false };
  const sign = median(kept.map((reading) => reading.value)) < 0 ? -1 : 1;
  let readings = kept
    .map((reading) => ({ date: reading.date, depthMbgl: sign * reading.value }))
    .filter((reading) => reading.depthMbgl >= WELL_ENVELOPE_M[0] && reading.depthMbgl <= WELL_ENVELOPE_M[1]);
  // Above ground in a well whose water usually sits metres down is a
  // sign-flipped record, not artesian flow.
  if (readings.length > 0 && median(readings.map((reading) => reading.depthMbgl)) > 2) {
    readings = readings.filter((reading) => reading.depthMbgl >= 0);
  }
  readings.sort((left, right) => left.date.localeCompare(right.date));
  return { readings, dropped: raw.length - readings.length, flatlined: false };
}

export interface PreMonsoonSummary {
  season: string;
  /** Pre-monsoon seasons with at least one reading. */
  years: number;
  latestYear: number;
  /** Median of the latest season's readings. */
  latestMbgl: number;
  /** Median of the earlier seasons' medians in the window; null with fewer than two. */
  priorMedianMbgl: number | null;
  /** latestMbgl minus priorMedianMbgl: positive = deeper than usual. */
  changeM: number | null;
  /** Least-squares slope of the seasonal medians in the window, metres per
   *  year, positive = deepening; null with fewer than TREND_MIN_YEARS seasons. */
  trendMPerYear: number | null;
  trendYears: number;
}

export function preMonsoonSummary(readings: WellReading[]): PreMonsoonSummary | null {
  const byYear = new Map<number, number[]>();
  for (const reading of readings) {
    const month = Number(reading.date.slice(5, 7));
    if (!PRE_MONSOON_MONTHS.includes(month)) continue;
    const year = Number(reading.date.slice(0, 4));
    byYear.set(year, [...(byYear.get(year) ?? []), reading.depthMbgl]);
  }
  if (byYear.size === 0) return null;
  const latestYear = Math.max(...byYear.keys());
  const seasons = [...byYear.entries()]
    .filter(([year]) => year > latestYear - TREND_WINDOW_YEARS)
    .map(([year, values]) => ({ year, depth: median(values) }))
    .sort((left, right) => left.year - right.year);
  const latest = seasons[seasons.length - 1];
  const prior = seasons.slice(0, -1).map((season) => season.depth);
  let trend: number | null = null;
  if (seasons.length >= TREND_MIN_YEARS) {
    const meanYear = seasons.reduce((total, season) => total + season.year, 0) / seasons.length;
    const meanDepth = seasons.reduce((total, season) => total + season.depth, 0) / seasons.length;
    const covariance = seasons.reduce((total, season) => total + (season.year - meanYear) * (season.depth - meanDepth), 0);
    const variance = seasons.reduce((total, season) => total + (season.year - meanYear) ** 2, 0);
    trend = variance > 0 ? round(covariance / variance, 3) : null;
  }
  const priorMedian = prior.length >= 2 ? round(median(prior)) : null;
  return {
    season: "March to May",
    years: byYear.size,
    latestYear,
    latestMbgl: round(latest.depth),
    priorMedianMbgl: priorMedian,
    changeM: priorMedian === null ? null : round(latest.depth - priorMedian),
    trendMPerYear: trend,
    trendYears: seasons.length,
  };
}

/* ── well chemistry against BIS IS 10500:2012 ──────────────────────────── */

export const QUALITY_PARAMETERS = ["ph", "tds", "chloride", "nitrate", "fluoride", "totalHardness", "ec", "faecalColiform"] as const;
export type QualityParameter = (typeof QUALITY_PARAMETERS)[number];

/** Acceptable limits of the Indian drinking water standard (IS 10500:2012,
 *  Table 1 and 2); EC has no limit there and is reported only. */
export const BIS_ACCEPTABLE: Partial<Record<QualityParameter, { max?: number; min?: number; unit: string }>> = {
  ph: { min: 6.5, max: 8.5, unit: "" },
  tds: { max: 500, unit: "mg/l" },
  chloride: { max: 250, unit: "mg/l" },
  nitrate: { max: 45, unit: "mg/l" },
  fluoride: { max: 1.0, unit: "mg/l" },
  totalHardness: { max: 200, unit: "mg/l" },
  faecalColiform: { max: 0, unit: "per 100 ml" },
};

export interface QualityExceedance {
  parameter: QualityParameter;
  value: number;
  limit: string;
}

export function qualityExceedances(values: Partial<Record<QualityParameter, number | null>>): QualityExceedance[] {
  const out: QualityExceedance[] = [];
  for (const parameter of QUALITY_PARAMETERS) {
    const value = values[parameter];
    const limit = BIS_ACCEPTABLE[parameter];
    if (value === null || value === undefined || !limit) continue;
    if (limit.max !== undefined && value > limit.max) {
      out.push({ parameter, value, limit: `${limit.min !== undefined ? `${limit.min} to ` : "at most "}${limit.max}${limit.unit ? ` ${limit.unit}` : ""}` });
    } else if (limit.min !== undefined && value < limit.min) {
      out.push({ parameter, value, limit: `${limit.min} to ${limit.max}` });
    }
  }
  return out;
}

/* ── the served artifact ───────────────────────────────────────────────── */

export interface WellStationRecord {
  id: string;
  /** The NWDP resource family: ksgwd-manual-monthly, ksgwd-telemetry, cgwb-telemetry. */
  network: string;
  agency: string;
  wellType: string | null;
  lon: number;
  lat: number;
  /** The Panchayat whose polygon holds the well; null when none does
   *  (an urban local body, or outside the district's Panchayats). */
  lgdGramPanchayatCode: string | null;
  /** Published to two decimals or fewer, so never placed in a Panchayat. */
  coordinatesCoarse?: true;
  readingsCount: number;
  firstReading: string;
  latest: WellReading;
  preMonsoon: PreMonsoonSummary | null;
}

export interface WellQualityRecord {
  id: string;
  agency: string;
  wellType: string | null;
  lon: number;
  lat: number;
  lgdGramPanchayatCode: string | null;
  sampledAt: string;
  samples: number;
  values: Partial<Record<QualityParameter, number | null>>;
  exceedances: QualityExceedance[];
}

export interface GroundwaterWellsPayload {
  schemaVersion: number;
  planId: string;
  acquiredAt: string;
  networks: Array<{
    network: string;
    sourceId: string;
    stations: number;
    readings: number;
    droppedReadings: number;
    flatlinedStations: number;
    lastReading: string | null;
  }>;
  stations: WellStationRecord[];
  quality: WellQualityRecord[];
  summary: {
    stations: number;
    stationsInPanchayats: number;
    panchayatsWithWells: number;
    qualityWells: number;
    panchayatsWithQuality: number;
  };
}

export interface GroundwaterWellsArtifact extends AtlasEnvelope, GroundwaterWellsPayload {}

/** What one Panchayat's brief and assessment read. */
export interface GramPanchayatWells {
  stations: WellStationRecord[];
  quality: WellQualityRecord[];
}

export function wellsByGramPanchayat(payload: Pick<GroundwaterWellsPayload, "stations" | "quality">): Map<string, GramPanchayatWells> {
  const out = new Map<string, GramPanchayatWells>();
  const bucket = (code: string) => {
    const existing = out.get(code) ?? { stations: [], quality: [] };
    out.set(code, existing);
    return existing;
  };
  for (const station of payload.stations) {
    if (station.lgdGramPanchayatCode) bucket(station.lgdGramPanchayatCode).stations.push(station);
  }
  for (const record of payload.quality) {
    if (record.lgdGramPanchayatCode) bucket(record.lgdGramPanchayatCode).quality.push(record);
  }
  return out;
}
