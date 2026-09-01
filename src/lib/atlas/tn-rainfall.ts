import { readFileSync } from "node:fs";

import { computeRecordsSha256 } from "./acquisition-validation";
import type { DistrictIdentity } from "./artifacts";

export const RAINFALL_SCHEMA_VERSION = 1;

export const RAINFALL_SOURCE_ID = "open-meteo-grid-rainfall";

export const RAINFALL_API_URL = "https://api.open-meteo.com/v1/forecast";

export const RAINFALL_ARCHIVE_URL =
  "https://archive-api.open-meteo.com/v1/archive";

/**
 * Years of the same calendar window used to build the normal. The archive
 * returns the same grid cell as the forecast endpoint, so the normal and the
 * current reading describe the same point rather than two nearby ones.
 */
export const RAINFALL_NORMAL_YEARS = 11;

/**
 * The profile allows 30 days for current rainfall, so the window matches it.
 * A longer window would quietly age the evidence past what the profile
 * accepts.
 */
export const RAINFALL_WINDOW_DAYS = 30;

export interface RainfallRecord {
  lgdGramPanchayatCode: string;
  queryLatitude: number;
  queryLongitude: number;
  gridLatitude: number;
  gridLongitude: number;
  /** Distance from the queried point to the grid cell actually returned. */
  gridOffsetKm: number;
  rainfallMm: number;
  daysWithRain: number;
  wettestDate: string | null;
  wettestDayMm: number | null;
  /**
   * Mean of the same calendar window across earlier years. Optional because
   * the archive endpoint is rate-limited separately from the forecast one, so
   * a district can carry current rainfall without a normal yet.
   */
  normalMm?: number | null;
  normalYears?: number;
  anomalyMm?: number | null;
  percentOfNormal?: number | null;
}

export interface TnDistrictRainfallExtract {
  schemaVersion: number;
  planId: string;
  acquiredAt: string;
  source: {
    sourceId: string;
    sourceUrl: string;
    /**
     * Open-Meteo serves modelled reanalysis interpolated to a point, not gauge
     * observations. Recorded so a brief never implies a rain gauge in the
     * village.
     */
    measurement: "modelled-reanalysis";
    windowDays: number;
  };
  window: { start: string; end: string };
  recordsSha256: string;
  recordCount: number;
  records: RainfallRecord[];
}

const EARTH_RADIUS_KM = 6371;

export function haversineKm(
  from: [number, number],
  to: [number, number],
): number {
  const toRadians = (value: number): number => (value * Math.PI) / 180;
  const dLat = toRadians(to[0] - from[0]);
  const dLon = toRadians(to[1] - from[1]);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from[0])) *
      Math.cos(toRadians(to[0])) *
      Math.sin(dLon / 2) ** 2;
  return Number(
    (EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(3),
  );
}

export function summarizeDailyRainfall(
  dates: string[],
  values: Array<number | null>,
): {
  rainfallMm: number;
  daysWithRain: number;
  wettestDate: string | null;
  wettestDayMm: number | null;
} {
  let total = 0;
  let daysWithRain = 0;
  let wettestDate: string | null = null;
  let wettestDayMm: number | null = null;
  for (let index = 0; index < dates.length; index += 1) {
    const value = values[index];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    total += value;
    if (value > 0) daysWithRain += 1;
    if (wettestDayMm === null || value > wettestDayMm) {
      wettestDayMm = value;
      wettestDate = dates[index];
    }
  }
  return {
    rainfallMm: Number(total.toFixed(2)),
    daysWithRain,
    wettestDate,
    wettestDayMm: wettestDayMm === null ? null : Number(wettestDayMm.toFixed(2)),
  };
}

function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86400000);
}

export function validateTnDistrictRainfallExtract(
  rainfall: TnDistrictRainfallExtract,
  identity: DistrictIdentity,
): string[] {
  const errors: string[] = [];
  if (rainfall.schemaVersion !== RAINFALL_SCHEMA_VERSION) {
    errors.push(
      `schemaVersion: expected ${RAINFALL_SCHEMA_VERSION}, found ${rainfall.schemaVersion}`,
    );
  }
  if (rainfall.planId !== identity.planId) {
    errors.push(
      `planId: rainfall ${rainfall.planId} does not match district ${identity.planId}`,
    );
  }
  if (rainfall.source.measurement !== "modelled-reanalysis") {
    errors.push(
      "source.measurement: Open-Meteo serves modelled values, not gauge " +
        "observations, and may not be recorded as measured rainfall",
    );
  }
  if (rainfall.recordCount !== rainfall.records.length) {
    errors.push(
      `recordCount: declared ${rainfall.recordCount}, found ${rainfall.records.length}`,
    );
  }
  if (rainfall.recordsSha256 !== computeRecordsSha256(rainfall.records)) {
    errors.push("recordsSha256: records do not match their digest");
  }
  const span = daysBetween(rainfall.window.start, rainfall.window.end);
  if (span < 1) {
    errors.push("window: the end date must follow the start date");
  }
  // The profile accepts current rainfall only within 30 days, so an extract
  // whose window already closed earlier than that cannot satisfy it.
  const age = daysBetween(rainfall.window.end, rainfall.acquiredAt);
  if (age > RAINFALL_WINDOW_DAYS) {
    errors.push(
      `window.end: ${rainfall.window.end} is ${age} days before acquisition, ` +
        `beyond the ${RAINFALL_WINDOW_DAYS} day limit the profile accepts`,
    );
  }
  if (errors.length > 0) return errors;

  const known = identity.gramPanchayats;
  const seen = new Set<string>();
  for (const record of rainfall.records) {
    if (seen.has(record.lgdGramPanchayatCode)) {
      errors.push(`records: ${record.lgdGramPanchayatCode} appears more than once`);
    }
    seen.add(record.lgdGramPanchayatCode);
    if (!known.has(record.lgdGramPanchayatCode)) {
      errors.push(
        `records: ${record.lgdGramPanchayatCode} is not a mapped Gram Panchayat`,
      );
    }
    if (record.rainfallMm < 0) {
      errors.push(`records[${record.lgdGramPanchayatCode}]: negative rainfall`);
    }
    if (record.normalMm !== null && record.normalMm !== undefined) {
      if ((record.normalYears ?? 0) < 5) {
        errors.push(
          `records[${record.lgdGramPanchayatCode}]: a normal from ` +
            `${record.normalYears} years is too short to call a normal`,
        );
      }
      const expected = Number(
        (record.rainfallMm - record.normalMm).toFixed(2),
      );
      if (record.anomalyMm !== expected) {
        errors.push(
          `records[${record.lgdGramPanchayatCode}]: anomaly does not equal ` +
            "the reading minus its normal",
        );
      }
    } else if (
      (record.anomalyMm ?? null) !== null ||
      (record.percentOfNormal ?? null) !== null
    ) {
      errors.push(
        `records[${record.lgdGramPanchayatCode}]: an anomaly without a normal`,
      );
    }
    // A grid point far from the queried centroid is no longer within the
    // place, which is what the profile's locality class claims.
    if (record.gridOffsetKm > 15) {
      errors.push(
        `records[${record.lgdGramPanchayatCode}]: grid point is ` +
          `${record.gridOffsetKm} km from the Panchayat centroid`,
      );
    }
  }
  return errors;
}

export function loadTnDistrictRainfallExtract(
  path: string,
  identity: DistrictIdentity,
): TnDistrictRainfallExtract {
  const parsed = JSON.parse(
    readFileSync(path, "utf8"),
  ) as TnDistrictRainfallExtract;
  const errors = validateTnDistrictRainfallExtract(parsed, identity);
  if (errors.length > 0) {
    throw new Error(
      `Invalid rainfall extract ${path}:\n- ${errors.join("\n- ")}`,
    );
  }
  return parsed;
}

export function summarizeRainfall(rainfall: TnDistrictRainfallExtract): {
  places: number;
  meanRainfallMm: number;
  driest: RainfallRecord | null;
  wettest: RainfallRecord | null;
  maxGridOffsetKm: number;
  withNormal: number;
  meanPercentOfNormal: number | null;
} {
  if (rainfall.records.length === 0) {
    return {
      places: 0,
      meanRainfallMm: 0,
      driest: null,
      wettest: null,
      maxGridOffsetKm: 0,
      withNormal: 0,
      meanPercentOfNormal: null,
    };
  }
  const sorted = [...rainfall.records].sort(
    (left, right) => left.rainfallMm - right.rainfallMm,
  );
  const withNormal = rainfall.records.filter(
    (record) => (record.percentOfNormal ?? null) !== null,
  );
  const total = rainfall.records.reduce(
    (sum, record) => sum + record.rainfallMm,
    0,
  );
  return {
    places: rainfall.records.length,
    meanRainfallMm: Number((total / rainfall.records.length).toFixed(2)),
    driest: sorted[0],
    wettest: sorted[sorted.length - 1],
    maxGridOffsetKm: Math.max(
      ...rainfall.records.map((record) => record.gridOffsetKm),
    ),
    withNormal: withNormal.length,
    meanPercentOfNormal:
      withNormal.length === 0
        ? null
        : Number(
            (
              withNormal.reduce(
                (sum, record) => sum + (record.percentOfNormal ?? 0),
                0,
              ) / withNormal.length
            ).toFixed(1),
          ),
  };
}
