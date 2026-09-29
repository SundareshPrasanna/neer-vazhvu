/**
 * Monitored wells for one district, placed in its Gram Panchayats, served as
 * public/data/atlas/<state>/<district>/groundwater-wells.json.
 *
 *   npx tsx scripts/atlas-wells-district.ts --district palakkad --fetch --as-of 2026-09-29
 *   npx tsx scripts/atlas-wells-district.ts --district palakkad --replay --as-of 2026-09-29
 *
 * Reads the National Water Data Portal resources the reviewed plan names
 * (sources.wells), district-filtered, paged and cached under .cache/atlas/.
 * A well goes to the Panchayat whose served polygon contains it
 * (datameet-panchayat-geometry.json from the identity refresh's
 * --fetch-boundary); a well in no Panchayat polygon, or whose published
 * coordinates are too coarse to say, stays on the district list unplaced.
 */
import { readFileSync } from "node:fs";

import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { MultiPolygon } from "geojson";

import { districtArtifactPath, type DistrictDirectoryArtifact } from "../src/lib/atlas/artifacts";
import {
  GROUNDWATER_WELLS_SCHEMA_VERSION,
  cleanReadings,
  preMonsoonSummary,
  qualityExceedances,
  type GroundwaterWellsPayload,
  type QualityParameter,
  type WellQualityRecord,
  type WellStationRecord,
} from "../src/lib/atlas/pipeline/core/groundwater-wells";
import type { LgdDistrictRefreshPlan } from "../src/lib/atlas/pipeline/adapters/lgd/lgd-acquisition-model";
import {
  NWDP_DATASTORE_URL,
  coarseCoordinates,
  nwdpDate,
  nwdpNumber,
  stationsFromRows,
  type NwdpWellsSource,
} from "../src/lib/atlas/pipeline/core/nwdp-wells";
import {
  SOURCE_IDS,
  atlasEnvelope,
  hasFlag,
  readArtifact,
  readCacheJson,
  requireAsOf,
  requireDistrict,
  reviewedInputPath,
  upstreamSource,
  writeAtlasArtifact,
  writeCache,
  type UpstreamKey,
} from "./lib/atlas-producer";
const PRODUCED_BY = "scripts/atlas-wells-district.ts";
const GEOMETRY_CACHE = "datameet-panchayat-geometry.json";
const PAGE = 5000;

type Row = Record<string, unknown>;

async function fetchRows(resourceId: string, districtName: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const query = new URLSearchParams({
      resource_id: resourceId,
      filters: JSON.stringify({ District: districtName }),
      limit: String(PAGE),
      offset: String(offset),
    });
    const response = await fetch(`${NWDP_DATASTORE_URL}?${query}`, { headers: { "User-Agent": "neer-vazhvu-atlas/0.1" } });
    if (!response.ok) throw new Error(`NWDP ${resourceId} returned HTTP ${response.status}`);
    const body = (await response.json()) as { success?: boolean; result?: { records?: Row[] } };
    const records = body.result?.records;
    if (!body.success || !records) throw new Error(`NWDP ${resourceId}: malformed response at offset ${offset}`);
    rows.push(...records);
    if (records.length < PAGE) return rows;
  }
}

async function rowsFor(
  district: ReturnType<typeof requireDistrict>,
  resourceId: string,
  districtName: string,
  fetchNow: boolean,
): Promise<Row[]> {
  const name = `nwdp-${resourceId}.json`;
  if (fetchNow) {
    const rows = await fetchRows(resourceId, districtName);
    writeCache(district, name, rows);
    return rows;
  }
  const cached = readCacheJson<Row[]>(district, name);
  if (!cached) throw new Error(`No cached NWDP rows for ${resourceId}; run --fetch`);
  return cached;
}

function upstreamKeyOf(sourceId: string): UpstreamKey {
  const key = (Object.keys(SOURCE_IDS) as UpstreamKey[]).find((candidate) => SOURCE_IDS[candidate] === sourceId);
  if (!key) throw new Error(`${sourceId} is not a registered Atlas upstream; add it in scripts/lib/atlas-producer.ts`);
  return key;
}

interface GeometryCache {
  planId: string;
  geometries: Record<string, { geometry: MultiPolygon }>;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const district = requireDistrict(argv);
  const fetchNow = hasFlag(argv, "--fetch");
  if (fetchNow === hasFlag(argv, "--replay")) throw new Error("choose exactly one of --fetch or --replay");
  const asOf = requireAsOf(argv);
  const plan = JSON.parse(readFileSync(reviewedInputPath(district, "refresh-plan.json"), "utf8")) as LgdDistrictRefreshPlan;
  const source: NwdpWellsSource | undefined = plan.sources?.wells;
  if (!source) throw new Error(`${district.slug}: the reviewed plan names no sources.wells`);
  const directory = readArtifact<DistrictDirectoryArtifact>(district, "directory");
  const geometry = readCacheJson<GeometryCache>(district, GEOMETRY_CACHE);
  if (!geometry || geometry.planId !== directory.district.planId) {
    throw new Error("No Panchayat geometry for this plan; run atlas-refresh-lgd-district.ts --fetch-boundary first");
  }
  const polygons = directory.panchayats
    .filter((panchayat) => geometry.geometries[panchayat.lgdCode])
    .map((panchayat) => ({ code: panchayat.lgdCode, geometry: geometry.geometries[panchayat.lgdCode].geometry }));
  const place = (latitude: number, longitude: number, coarse: boolean): string | null => {
    if (coarse) return null;
    const hits = polygons.filter((polygon) => booleanPointInPolygon([longitude, latitude], polygon.geometry));
    return hits.length === 1 ? hits[0].code : null;
  };

  const networks: GroundwaterWellsPayload["networks"] = [];
  const stations: WellStationRecord[] = [];
  for (const level of source.levels) {
    const rows = await rowsFor(district, level.resourceId, source.districtName, fetchNow);
    const { stations: grouped, unusableRows } = stationsFromRows(rows, level.fields);
    let dropped = unusableRows;
    let flatlined = 0;
    let lastReading: string | null = null;
    for (const station of grouped) {
      const cleaned = cleanReadings(station.raw);
      dropped += cleaned.dropped;
      if (cleaned.flatlined) flatlined += 1;
      if (cleaned.readings.length === 0) continue;
      const latest = cleaned.readings[cleaned.readings.length - 1];
      if (!lastReading || latest.date > lastReading) lastReading = latest.date;
      stations.push({
        id: station.id,
        network: level.network,
        agency: station.agency,
        wellType: station.wellType,
        lon: Number(station.longitude.toFixed(5)),
        lat: Number(station.latitude.toFixed(5)),
        lgdGramPanchayatCode: place(station.latitude, station.longitude, station.coarse),
        ...(station.coarse ? { coordinatesCoarse: true } : {}),
        readingsCount: cleaned.readings.length,
        firstReading: cleaned.readings[0].date,
        latest: { date: latest.date, depthMbgl: Number(latest.depthMbgl.toFixed(2)) },
        preMonsoon: preMonsoonSummary(cleaned.readings),
      });
    }
    networks.push({
      network: level.network,
      sourceId: level.sourceId,
      stations: grouped.length,
      readings: rows.length,
      droppedReadings: dropped,
      flatlinedStations: flatlined,
      lastReading,
    });
  }

  const quality: WellQualityRecord[] = [];
  if (source.quality) {
    const q = source.quality;
    const rows = await rowsFor(district, q.resourceId, source.districtName, fetchNow);
    const byWell = new Map<string, Row[]>();
    for (const row of rows) {
      const id = String(row[q.fields.station] ?? "").trim();
      if (id && nwdpDate(row[q.fields.date])) byWell.set(id, [...(byWell.get(id) ?? []), row]);
    }
    for (const [id, samples] of [...byWell.entries()].sort()) {
      const latest = samples.reduce((best, row) =>
        (nwdpDate(row[q.fields.date]) ?? "") > (nwdpDate(best[q.fields.date]) ?? "") ? row : best,
      );
      const latitude = nwdpNumber(latest[q.fields.latitude]);
      const longitude = nwdpNumber(latest[q.fields.longitude]);
      if (latitude === null || longitude === null) continue;
      const values: Partial<Record<QualityParameter, number | null>> = {};
      for (const [parameter, field] of Object.entries(q.parameters) as Array<[QualityParameter, string]>) {
        values[parameter] = nwdpNumber(latest[field]);
      }
      quality.push({
        id,
        agency: String(latest[q.fields.agency] ?? "").trim(),
        wellType: q.fields.wellType ? String(latest[q.fields.wellType] ?? "").trim() || null : null,
        lon: Number(longitude.toFixed(5)),
        lat: Number(latitude.toFixed(5)),
        lgdGramPanchayatCode: place(latitude, longitude, coarseCoordinates(latest[q.fields.latitude], latest[q.fields.longitude])),
        sampledAt: nwdpDate(latest[q.fields.date])!,
        samples: samples.length,
        values,
        exceedances: qualityExceedances(values),
      });
    }
  }

  stations.sort((left, right) => left.network.localeCompare(right.network) || left.id.localeCompare(right.id));
  const placedCodes = new Set(stations.map((station) => station.lgdGramPanchayatCode).filter(Boolean));
  const payload: GroundwaterWellsPayload = {
    schemaVersion: GROUNDWATER_WELLS_SCHEMA_VERSION,
    planId: directory.district.planId,
    acquiredAt: asOf,
    networks,
    stations,
    quality,
    summary: {
      stations: stations.length,
      stationsInPanchayats: stations.filter((station) => station.lgdGramPanchayatCode).length,
      panchayatsWithWells: placedCodes.size,
      qualityWells: quality.length,
      panchayatsWithQuality: new Set(quality.map((record) => record.lgdGramPanchayatCode).filter(Boolean)).size,
    },
  };
  const envelope = atlasEnvelope({
    district,
    family: "groundwater-wells",
    // One registry entry per upstream: every NWDP dataset cites the portal's.
    sources: [...new Set([...source.levels.map((level) => level.sourceId), ...(source.quality ? [source.quality.sourceId] : [])])].map(
      (sourceId) => upstreamSource(upstreamKeyOf(sourceId), { role: "input", retrieved: asOf }),
    ),
    method: "api",
    producedAt: asOf,
    producedBy: PRODUCED_BY,
    internalInputs: [districtArtifactPath(district, "directory")],
    note:
      `Monitored wells in ${directory.district.name} from the National Water Data Portal: ${payload.summary.stations} ` +
      `stations with usable readings, ${payload.summary.stationsInPanchayats} placed inside ${payload.summary.panchayatsWithWells} ` +
      `Gram Panchayats by their published coordinates; ${payload.summary.qualityWells} wells with chemistry. Depths are ` +
      "metres below ground level; each station's sign convention is read from its own median, sentinel values and " +
      "readings outside a physical envelope are dropped and counted, and a station whose readings never change is a " +
      "stuck sensor and is dropped whole. Wells with coordinates published to two decimals or fewer are not placed.",
    conventions: {
      depth: "metres below ground level; larger is deeper",
      preMonsoon:
        "March to May, the lowest levels before the June rains: latestMbgl is the latest season's median, priorMedianMbgl the median of " +
        "the earlier seasons in the last ten years, trendMPerYear the least-squares slope of the seasonal medians (positive = deepening, " +
        "at least five seasons)",
      quality:
        "the latest sample per well against the acceptable limits of BIS IS 10500:2012 (pH 6.5 to 8.5, TDS 500, chloride 250, " +
        "nitrate 45, fluoride 1.0, total hardness 200 mg/l, faecal coliform none in 100 ml); EC is reported without a limit",
      placement: "lgdGramPanchayatCode is the Panchayat whose polygon contains the well; null when none does or the coordinates are too coarse",
    },
  });
  const rel = writeAtlasArtifact(district, "groundwater-wells", undefined, envelope, payload);
  console.log(
    [
      `Wrote ${rel}`,
      ...networks.map(
        (network) =>
          `  ${network.network}: ${network.stations} stations, ${network.readings} rows, ${network.droppedReadings} dropped, ` +
          `${network.flatlinedStations} flatlined, last ${network.lastReading ?? "none"}`,
      ),
      `  placed: ${payload.summary.stationsInPanchayats} of ${payload.summary.stations} stations in ${payload.summary.panchayatsWithWells} Panchayats`,
      `  quality: ${payload.summary.qualityWells} wells, ${payload.summary.panchayatsWithQuality} Panchayats`,
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
