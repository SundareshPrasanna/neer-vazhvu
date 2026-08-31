/**
 * Open-Meteo 30-day rainfall per Gram Panchayat (bbox-centre grid point) with
 * an eleven-year same-window normal, served as
 * public/data/atlas/<state>/<district>/rainfall.json.
 *
 *   npx tsx scripts/atlas-rainfall-tn-district.ts --district thanjavur --fetch --as-of 2026-09-01
 *   npx tsx scripts/atlas-rainfall-tn-district.ts --district thanjavur --replay
 *
 * Values are modelled reanalysis interpolated to a point, not gauge
 * observations, and are recorded as such.
 */
import { computeRecordsSha256 } from "../src/lib/atlas/acquisition-validation";
import {
  districtArtifactPath,
  identityFromDirectory,
  type DistrictDirectoryArtifact,
} from "../src/lib/atlas/artifacts";
import {
  RAINFALL_API_URL,
  RAINFALL_ARCHIVE_URL,
  RAINFALL_NORMAL_YEARS,
  RAINFALL_SCHEMA_VERSION,
  RAINFALL_SOURCE_ID,
  RAINFALL_WINDOW_DAYS,
  haversineKm,
  summarizeDailyRainfall,
  summarizeRainfall,
  validateTnDistrictRainfallExtract,
} from "../src/lib/atlas/tn-rainfall";
import type { RainfallRecord, TnDistrictRainfallExtract } from "../src/lib/atlas/tn-rainfall";
import {
  atlasEnvelope,
  cachePath,
  hasFlag,
  readArtifact,
  readCacheJson,
  requireAsOf,
  requireDistrict,
  upstreamSource,
  writeAtlasArtifact,
  writeCache,
} from "./lib/atlas-producer";

const PRODUCED_BY = "scripts/atlas-rainfall-tn-district.ts";
const CACHE = "rainfall.json";
const BATCH_SIZE = 100;
const USER_AGENT = "neer-vazhvu-atlas/0.1 (research; contact@neervazhvu.org)";

const sleep = (ms: number): Promise<void> =>
  new Promise((done) => setTimeout(done, ms));

interface DailyResponse {
  latitude: number;
  longitude: number;
  daily: { time: string[]; precipitation_sum: Array<number | null> };
}

interface Point {
  code: string;
  latitude: number;
  longitude: number;
}

async function readBatch(points: Point[]): Promise<DailyResponse[]> {
  const params = new URLSearchParams({
    latitude: points.map((point) => point.latitude.toFixed(4)).join(","),
    longitude: points.map((point) => point.longitude.toFixed(4)).join(","),
    daily: "precipitation_sum",
    past_days: String(RAINFALL_WINDOW_DAYS),
    forecast_days: "1",
    timezone: "Asia/Kolkata",
  });
  const response = await fetch(`${RAINFALL_API_URL}?${params.toString()}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!response.ok) throw new Error(`Open-Meteo returned HTTP ${response.status}`);
  const body = (await response.json()) as DailyResponse | DailyResponse[];
  const rows = Array.isArray(body) ? body : [body];
  if (rows.length !== points.length) {
    throw new Error(`Open-Meteo returned ${rows.length} results for ${points.length} points`);
  }
  return rows;
}

/**
 * The same calendar window in an earlier year. The archive returns the same
 * grid cell as the forecast endpoint, so the normal describes the same point
 * as the current reading rather than a nearby one.
 */
async function readArchiveWindow(points: Point[], start: string, end: string): Promise<number[]> {
  const params = new URLSearchParams({
    latitude: points.map((point) => point.latitude.toFixed(4)).join(","),
    longitude: points.map((point) => point.longitude.toFixed(4)).join(","),
    daily: "precipitation_sum",
    start_date: start,
    end_date: end,
    timezone: "Asia/Kolkata",
  });
  // Eight doublings reach about eight and a half minutes in total: enough to
  // ride out a rolling hour another consumer has partly saturated, which a
  // 64-second ceiling was not (observed 2026-08-31).
  let response: Response | null = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    response = await fetch(`${RAINFALL_ARCHIVE_URL}?${params.toString()}`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (response.status !== 429) break;
    const wait = 2000 * 2 ** attempt;
    console.error(`    rate limited, waiting ${wait / 1000}s`);
    await sleep(wait);
  }
  if (!response || !response.ok) {
    throw new Error(
      `Open-Meteo archive returned HTTP ${response?.status ?? "no response"} after retries`,
    );
  }
  const body = (await response.json()) as DailyResponse | DailyResponse[];
  const rows = Array.isArray(body) ? body : [body];
  if (rows.length !== points.length) {
    throw new Error(`Archive returned ${rows.length} results for ${points.length} points`);
  }
  return rows.map((row) =>
    row.daily.precipitation_sum.reduce(
      (total: number, value) =>
        total + (typeof value === "number" && Number.isFinite(value) ? value : 0),
      0,
    ),
  );
}

/** The reanalysis grid is about 0.1 degrees, so every centroid rounded to the
 *  same tenth of a degree receives the same series. */
function cellKeyOf(point: Point): string {
  return `${point.latitude.toFixed(1)},${point.longitude.toFixed(1)}`;
}

async function acquire(
  points: Point[],
  planId: string,
  asOf: string,
): Promise<TnDistrictRainfallExtract> {
  // Open-Meteo accounts its allowance per LOCATION per window, not per HTTP
  // call: 589 Panchayats times one current window and eleven normal years is
  // about 7,100 location-windows, and the archive started answering 429
  // after roughly 5,000 in an hour (measured 2026-08-31, eight of eleven
  // normal years in). Panchayats in the same grid cell were already getting
  // identical series, so the API is asked once per cell and every Panchayat
  // inherits its cell's rows; a district collapses to a few dozen cells and
  // the whole run stays two orders of magnitude under the cap.
  const cells = new Map<string, Point>();
  for (const point of points) {
    const key = cellKeyOf(point);
    if (!cells.has(key)) {
      cells.set(key, {
        code: key,
        latitude: Number(point.latitude.toFixed(1)),
        longitude: Number(point.longitude.toFixed(1)),
      });
    }
  }
  const uniquePoints = [...cells.values()];
  console.error(`  ${points.length} Panchayats over ${uniquePoints.length} reanalysis grid cells`);

  const rowByCell = new Map<string, DailyResponse>();
  let window: { start: string; end: string } | null = null;
  for (let index = 0; index < uniquePoints.length; index += BATCH_SIZE) {
    const batch = uniquePoints.slice(index, index + BATCH_SIZE);
    const rows = await readBatch(batch);
    for (let offset = 0; offset < batch.length; offset += 1) {
      rowByCell.set(batch[offset].code, rows[offset]);
      window ??= {
        start: rows[offset].daily.time[0],
        end: rows[offset].daily.time[rows[offset].daily.time.length - 1],
      };
    }
    console.error(`  ${Math.min(index + BATCH_SIZE, uniquePoints.length)}/${uniquePoints.length} cells`);
  }
  if (!window) throw new Error("Open-Meteo returned no daily series");

  const records: RainfallRecord[] = [];
  for (const point of points) {
    const row = rowByCell.get(cellKeyOf(point));
    if (!row) throw new Error(`No grid-cell series for ${point.code}`);
    const daily = summarizeDailyRainfall(row.daily.time, row.daily.precipitation_sum);
    records.push({
      lgdGramPanchayatCode: point.code,
      queryLatitude: Number(point.latitude.toFixed(4)),
      queryLongitude: Number(point.longitude.toFixed(4)),
      gridLatitude: row.latitude,
      gridLongitude: row.longitude,
      gridOffsetKm: haversineKm(
        [point.latitude, point.longitude],
        [row.latitude, row.longitude],
      ),
      ...daily,
      normalMm: null,
      normalYears: 0,
      anomalyMm: null,
      percentOfNormal: null,
    });
  }

  const windowStart = window.start.slice(5);
  const windowEnd = window.end.slice(5);
  const endYear = Number(window.end.slice(0, 4));
  const normalTotals = new Map<string, number[]>();
  for (let back = 1; back <= RAINFALL_NORMAL_YEARS; back += 1) {
    const year = endYear - back;
    for (let index = 0; index < uniquePoints.length; index += BATCH_SIZE) {
      const batch = uniquePoints.slice(index, index + BATCH_SIZE);
      const totals = await readArchiveWindow(
        batch,
        `${year}-${windowStart}`,
        `${year}-${windowEnd}`,
      );
      for (let offset = 0; offset < batch.length; offset += 1) {
        const bucket = normalTotals.get(batch[offset].code) ?? [];
        bucket.push(totals[offset]);
        normalTotals.set(batch[offset].code, bucket);
      }
      await sleep(1200);
    }
    console.error(`  normal ${year} done`);
  }
  for (const record of records) {
    const cell = `${Number(record.queryLatitude).toFixed(1)},${Number(record.queryLongitude).toFixed(1)}`;
    const totals = normalTotals.get(cell) ?? [];
    if (totals.length === 0) continue;
    const normal = Number(
      (totals.reduce((sum, value) => sum + value, 0) / totals.length).toFixed(2),
    );
    record.normalMm = normal;
    record.normalYears = totals.length;
    record.anomalyMm = Number((record.rainfallMm - normal).toFixed(2));
    record.percentOfNormal =
      normal > 0 ? Number(((record.rainfallMm / normal) * 100).toFixed(1)) : null;
  }
  records.sort((left, right) =>
    left.lgdGramPanchayatCode.localeCompare(right.lgdGramPanchayatCode),
  );
  return {
    schemaVersion: RAINFALL_SCHEMA_VERSION,
    planId,
    acquiredAt: asOf,
    source: {
      sourceId: RAINFALL_SOURCE_ID,
      sourceUrl: RAINFALL_API_URL,
      measurement: "modelled-reanalysis",
      windowDays: RAINFALL_WINDOW_DAYS,
    },
    window,
    recordsSha256: computeRecordsSha256(records),
    recordCount: records.length,
    records,
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const district = requireDistrict(argv);
  const fetchNow = hasFlag(argv, "--fetch");
  const replay = hasFlag(argv, "--replay");
  if (fetchNow === replay) throw new Error("choose exactly one of --fetch or --replay");
  const directory = readArtifact<DistrictDirectoryArtifact>(district, "directory");
  const identity = identityFromDirectory(directory);

  let rainfall: TnDistrictRainfallExtract;
  if (fetchNow) {
    const asOf = requireAsOf(argv);
    // The bounding-box centre is enough for an 11 km reanalysis grid.
    const points: Point[] = directory.panchayats
      .filter((panchayat) => panchayat.boundary)
      .map((panchayat) => ({
        code: panchayat.lgdCode,
        longitude: panchayat.boundary!.centroid[0],
        latitude: panchayat.boundary!.centroid[1],
      }));
    if (points.length === 0) {
      throw new Error("the directory carries no centroids; acquire the TNGIS boundary first");
    }
    rainfall = await acquire(points, directory.district.planId, asOf);
    writeCache(district, CACHE, rainfall);
  } else {
    const cached = readCacheJson<TnDistrictRainfallExtract>(district, CACHE);
    if (!cached) {
      throw new Error(`No cached rainfall extract at ${cachePath(district, CACHE)}; run --fetch`);
    }
    rainfall = cached;
  }
  const errors = validateTnDistrictRainfallExtract(rainfall, identity);
  if (errors.length > 0) {
    throw new Error(`Invalid rainfall extract:\n- ${errors.join("\n- ")}`);
  }
  const summary = summarizeRainfall(rainfall);
  const gridCells = new Set(
    rainfall.records.map((record) => `${record.gridLatitude},${record.gridLongitude}`),
  ).size;
  const envelope = atlasEnvelope({
    district,
    family: "rainfall",
    sources: [upstreamSource("openMeteo", { retrieved: rainfall.acquiredAt })],
    method: "api",
    producedAt: rainfall.acquiredAt,
    producedBy: PRODUCED_BY,
    internalInputs: [districtArtifactPath(district, "directory")],
    note:
      `Open-Meteo daily precipitation summed over ${rainfall.window.start} to ` +
      `${rainfall.window.end} for ${rainfall.recordCount} Gram Panchayats, queried at the ` +
      "bounding-box centre of each TNGIS polygon (from the directory), " +
      `collapsed to ${gridCells} reanalysis grid cells: Panchayats whose centroids share ` +
      "a cell share its series, which the per-record grid coordinates and offset state. " +
      (summary.withNormal > 0
        ? `The normal is a ${RAINFALL_NORMAL_YEARS}-year mean of the same calendar window from the ERA5 archive for the same grid point.`
        : "No normal was computed on this run, so anomaly fields are null."),
    conventions: {
      measurement:
        "modelled reanalysis interpolated to a grid point inside the Panchayat, not a rain gauge; gridOffsetKm is the distance from the queried centroid to the returned grid cell",
      window: `${RAINFALL_WINDOW_DAYS} days ending on the acquisition date, matching the profile's current-rainfall limit`,
      units: "mm",
    },
  });
  const rel = writeAtlasArtifact(district, "rainfall", undefined, envelope, rainfall);
  console.log(
    [
      `Wrote ${rel}`,
      `${summary.places} Gram Panchayats, mean ${summary.meanRainfallMm} mm over ` +
        `${rainfall.window.start} to ${rainfall.window.end}`,
      `Driest ${summary.driest?.lgdGramPanchayatCode} at ${summary.driest?.rainfallMm} mm, ` +
        `wettest ${summary.wettest?.lgdGramPanchayatCode} at ${summary.wettest?.rainfallMm} mm; ` +
        `largest grid offset ${summary.maxGridOffsetKm} km`,
      summary.withNormal > 0
        ? `Normal: ${summary.withNormal} Panchayats, mean ${summary.meanPercentOfNormal} percent of normal`
        : "No normal computed",
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
