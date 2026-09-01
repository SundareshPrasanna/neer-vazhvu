import { readFileSync } from "node:fs";

import { computeRecordsSha256 } from "./acquisition-validation";
import type { DistrictIdentity } from "./artifacts";

export const JJM_SERVICE_SCHEMA_VERSION = 1;

export const JJM_SERVICE_SOURCE_ID = "jjm-citizen-corner-village-service";

/**
 * The citizen-corner page renders village service data client-side from
 * ASP.NET page methods that take only the state, district and village
 * identifiers. They need no session or ViewState, so acquisition is a direct
 * JSON read keyed by identifiers the district extract already holds, rather
 * than a scrape of the rendered page.
 */
export const JJM_PAGE_METHODS = {
  habitations: "BindHabitationInfo",
  sources: "BindSourceInfo",
  samples: "BindSampleTestedInfo",
} as const;

export interface JjmHabitation {
  habitationName: string;
  totalPopulation: number | null;
  households: number | null;
  householdConnections: number | null;
  qualityStatus: string;
  qualityContamination: string;
}

export interface JjmSource {
  sourceId: string;
  habitationName: string;
  sourceTypeCategory: string;
  sourceType: string;
}

export interface JjmSampleSummary {
  samplesTaken: number | null;
  samplesContaminated: number | null;
  remedialActionTaken: number | null;
}

export interface JjmSample {
  sampleDate: string;
  contaminationTested: string;
  status: string;
  remedialAction: string;
  location: string;
}

export interface JjmVillageService {
  blockId: string;
  gpId: string;
  villageId: string;
  villageName: string;
  habitations: JjmHabitation[];
  sources: JjmSource[];
  sampleSummary: JjmSampleSummary;
  samples: JjmSample[];
  totals: {
    habitationCount: number;
    population: number | null;
    households: number | null;
    householdConnections: number | null;
    sourceCount: number;
    sampleRowCount: number;
    latestSampleDate: string | null;
    latestSampleStatus: string | null;
  };
}

export interface TnDistrictJjmServiceExtract {
  schemaVersion: number;
  planId: string;
  jjmStateId: string;
  jjmDistrictId: string;
  acquiredAt: string;
  source: {
    sourceId: string;
    sourceUrl: string;
    pageMethods: string[];
  };
  coverage: {
    villagesInDistrict: number;
    villagesAcquired: number;
    /** Set when a run deliberately covers part of the district. */
    partialReason: string | null;
  };
  recordsSha256: string;
  recordCount: number;
  records: JjmVillageService[];
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function toText(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parses `dd-mm-yyyy`, the format the sample rows use, into an ISO date. */
export function parseJjmSampleDate(value: string): string | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

export function normalizeJjmVillageService(
  village: { blockId: string; gpId: string; villageId: string; villageName: string },
  payloads: {
    habitations: unknown;
    sources: unknown;
    samples: unknown;
  },
): JjmVillageService {
  const habitationRows = Array.isArray(payloads.habitations)
    ? (payloads.habitations as Record<string, unknown>[])
    : [];
  const habitations: JjmHabitation[] = habitationRows.map((row) => ({
    habitationName: toText(row.HabitationName),
    totalPopulation: toNumber(row.TotalPop),
    households: toNumber(row.Household),
    householdConnections: toNumber(row.HouseholdConn),
    qualityStatus: toText(row.QualityStatus),
    qualityContamination: toText(row.QualityContamination),
  }));

  const sourceRows = Array.isArray(payloads.sources)
    ? (payloads.sources as Record<string, unknown>[])
    : [];
  const sources: JjmSource[] = sourceRows.map((row) => ({
    sourceId: String(row.sourceId ?? ""),
    habitationName: toText(row.HabitationName),
    sourceTypeCategory: toText(row.SourceTypeCategory),
    sourceType: toText(row.SourceType),
  }));

  // BindSampleTestedInfo returns [summaryRows, sampleRows].
  const sampleGroups = Array.isArray(payloads.samples) ? payloads.samples : [];
  const summaryRow = (
    Array.isArray(sampleGroups[0]) ? sampleGroups[0][0] : undefined
  ) as Record<string, unknown> | undefined;
  const sampleRows = (
    Array.isArray(sampleGroups[1]) ? sampleGroups[1] : []
  ) as Record<string, unknown>[];

  const samples: JjmSample[] = sampleRows.map((row) => ({
    sampleDate: parseJjmSampleDate(toText(row.Date_of_sample_taken)) ?? "",
    contaminationTested: toText(row.contaminated_found),
    status: toText(row.Statustaken),
    remedialAction: toText(row.remidacialaction),
    location: toText(row.Location),
  }));
  const dated = samples
    .filter((sample) => sample.sampleDate !== "")
    .sort((left, right) => right.sampleDate.localeCompare(left.sampleDate));

  const sumOf = (
    pick: (habitation: JjmHabitation) => number | null,
  ): number | null => {
    const values = habitations
      .map(pick)
      .filter((value): value is number => value !== null);
    return values.length === 0
      ? null
      : values.reduce((total, value) => total + value, 0);
  };

  return {
    blockId: village.blockId,
    gpId: village.gpId,
    villageId: village.villageId,
    villageName: village.villageName,
    habitations,
    sources,
    sampleSummary: {
      samplesTaken: toNumber(summaryRow?.total_number_of_sample_taken),
      samplesContaminated: toNumber(summaryRow?.sample_found_contaminated),
      remedialActionTaken: toNumber(summaryRow?.remedial_action_taken),
    },
    samples,
    totals: {
      habitationCount: habitations.length,
      population: sumOf((habitation) => habitation.totalPopulation),
      households: sumOf((habitation) => habitation.households),
      householdConnections: sumOf(
        (habitation) => habitation.householdConnections,
      ),
      sourceCount: sources.length,
      sampleRowCount: samples.length,
      latestSampleDate: dated[0]?.sampleDate ?? null,
      latestSampleStatus: dated[0]?.status ?? null,
    },
  };
}

/**
 * Record-level rules shared by the district intermediate and the per-block
 * shards: every village path is in the enumeration, appears once, and its
 * totals agree with its rows.
 */
export function validateJjmServiceRecords(
  records: JjmVillageService[],
  identity: DistrictIdentity,
): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    const key = `${record.blockId}/${record.gpId}/${record.villageId}`;
    if (seen.has(key)) {
      errors.push(`records: village path ${key} appears more than once`);
    }
    seen.add(key);
    if (!identity.jjmVillagePaths.has(key)) {
      errors.push(
        `records: village path ${key} is not in the tracked JJM enumeration`,
      );
    }
    const totals = record.totals;
    if (totals.habitationCount !== record.habitations.length) {
      errors.push(`records[${key}]: habitation count disagrees with its rows`);
    }
    if (totals.sourceCount !== record.sources.length) {
      errors.push(`records[${key}]: source count disagrees with its rows`);
    }
    if (totals.sampleRowCount !== record.samples.length) {
      errors.push(`records[${key}]: sample count disagrees with its rows`);
    }
    if (
      totals.householdConnections !== null &&
      totals.households !== null &&
      totals.householdConnections > totals.households
    ) {
      errors.push(
        `records[${key}]: more tap connections than households`,
      );
    }
  }
  return errors;
}

export function validateTnDistrictJjmServiceExtract(
  service: TnDistrictJjmServiceExtract,
  identity: DistrictIdentity,
): string[] {
  const errors: string[] = [];
  if (service.schemaVersion !== JJM_SERVICE_SCHEMA_VERSION) {
    errors.push(
      `schemaVersion: expected ${JJM_SERVICE_SCHEMA_VERSION}, found ${service.schemaVersion}`,
    );
  }
  if (service.planId !== identity.planId) {
    errors.push(
      `planId: service ${service.planId} does not match district ${identity.planId}`,
    );
  }
  if (service.recordCount !== service.records.length) {
    errors.push(
      `recordCount: declared ${service.recordCount}, found ${service.records.length}`,
    );
  }
  if (service.recordsSha256 !== computeRecordsSha256(service.records)) {
    errors.push("recordsSha256: records do not match their digest");
  }
  if (errors.length > 0) return errors;

  errors.push(...validateJjmServiceRecords(service.records, identity));

  if (service.coverage.villagesInDistrict !== identity.jjmVillagePaths.size) {
    errors.push(
      `coverage.villagesInDistrict: ${service.coverage.villagesInDistrict} does not match ` +
        `the tracked enumeration of ${identity.jjmVillagePaths.size}`,
    );
  }
  if (service.coverage.villagesAcquired !== service.records.length) {
    errors.push("coverage.villagesAcquired disagrees with the record count");
  }
  // A partial run is legitimate but must say so, otherwise a sample reads as
  // full district coverage.
  if (
    service.coverage.villagesAcquired < service.coverage.villagesInDistrict &&
    !service.coverage.partialReason
  ) {
    errors.push(
      "coverage.partialReason: a run that covers part of the district must state why",
    );
  }
  return errors;
}

export function loadTnDistrictJjmServiceExtract(
  path: string,
  identity: DistrictIdentity,
): TnDistrictJjmServiceExtract {
  const parsed = JSON.parse(
    readFileSync(path, "utf8"),
  ) as TnDistrictJjmServiceExtract;
  const errors = validateTnDistrictJjmServiceExtract(parsed, identity);
  if (errors.length > 0) {
    throw new Error(
      `Invalid JJM service extract ${path}:\n- ${errors.join("\n- ")}`,
    );
  }
  return parsed;
}

export interface JjmGramPanchayatService {
  gpId: string;
  villageIds: string[];
  habitationCount: number;
  population: number | null;
  households: number | null;
  householdConnections: number | null;
  tapCoveragePercent: number | null;
  sourceCount: number;
  sourceTypes: string[];
  sampleRowCount: number;
  latestSampleDate: string | null;
  latestSampleStatus: string | null;
  /**
   * Depth the portal publishes but a single "latest result" throws away.
   * Sampling recency varies from days to years between Panchayats, which is an
   * accountability signal in its own right, and a series that reports no
   * failures at all says more about the reporting than about the water.
   */
  unsafeSampleCount: number;
  samplesAtSource: number;
  samplesAtHousehold: number;
  earliestSampleDate: string | null;
  sampleYearsCovered: number;
  /** Per-habitation and per-source rows, so a page can show the place rather
   * than only its totals. */
  habitationDetail: Array<{
    name: string;
    population: number | null;
    households: number | null;
    connections: number | null;
  }>;
  sourceDetail: Array<{ type: string; category: string; habitation: string }>;
  samplesByYear: Array<{ year: string; count: number }>;
}

export function rollUpJjmServiceByGramPanchayat(
  service: { records: JjmVillageService[] },
): JjmGramPanchayatService[] {
  const byGp = new Map<string, JjmVillageService[]>();
  for (const record of service.records) {
    const bucket = byGp.get(record.gpId);
    if (bucket) bucket.push(record);
    else byGp.set(record.gpId, [record]);
  }
  const sum = (
    villages: JjmVillageService[],
    pick: (village: JjmVillageService) => number | null,
  ): number | null => {
    const values = villages
      .map(pick)
      .filter((value): value is number => value !== null);
    return values.length === 0
      ? null
      : values.reduce((total, value) => total + value, 0);
  };
  return [...byGp.entries()]
    .map(([gpId, villages]) => {
      const households = sum(villages, (village) => village.totals.households);
      const connections = sum(
        villages,
        (village) => village.totals.householdConnections,
      );
      const dated = villages
        .map((village) => village.totals)
        .filter((totals) => totals.latestSampleDate !== null)
        .sort((left, right) =>
          (right.latestSampleDate ?? "").localeCompare(
            left.latestSampleDate ?? "",
          ),
        );
      const samples = villages.flatMap((village) => village.samples);
      const sampleDates = samples
        .map((sample) => sample.sampleDate)
        .filter((date) => date !== "")
        .sort();
      const years = new Set(sampleDates.map((date) => date.slice(0, 4)));
      return {
        gpId,
        villageIds: villages.map((village) => village.villageId).sort(),
        habitationCount: villages.reduce(
          (total, village) => total + village.totals.habitationCount,
          0,
        ),
        population: sum(villages, (village) => village.totals.population),
        households,
        householdConnections: connections,
        tapCoveragePercent:
          households !== null && connections !== null && households > 0
            ? Number(((connections / households) * 100).toFixed(2))
            : null,
        sourceCount: villages.reduce(
          (total, village) => total + village.totals.sourceCount,
          0,
        ),
        sourceTypes: [
          ...new Set(
            villages.flatMap((village) =>
              village.sources.map((source) => source.sourceType),
            ),
          ),
        ]
          .filter(Boolean)
          .sort(),
        sampleRowCount: villages.reduce(
          (total, village) => total + village.totals.sampleRowCount,
          0,
        ),
        latestSampleDate: dated[0]?.latestSampleDate ?? null,
        latestSampleStatus: dated[0]?.latestSampleStatus ?? null,
        unsafeSampleCount: samples.filter(
          (sample) => sample.status !== "" && sample.status !== "Safe",
        ).length,
        samplesAtSource: samples.filter((sample) =>
          /source/i.test(sample.location),
        ).length,
        samplesAtHousehold: samples.filter((sample) =>
          /household/i.test(sample.location),
        ).length,
        earliestSampleDate: sampleDates[0] ?? null,
        sampleYearsCovered: years.size,
        habitationDetail: villages.flatMap((village) =>
          village.habitations.map((habitation) => ({
            name: habitation.habitationName,
            population: habitation.totalPopulation,
            households: habitation.households,
            connections: habitation.householdConnections,
          })),
        ),
        sourceDetail: villages.flatMap((village) =>
          village.sources.map((source) => ({
            type: source.sourceType,
            category: source.sourceTypeCategory,
            habitation: source.habitationName,
          })),
        ),
        samplesByYear: [
          ...sampleDates.reduce((counts, date) => {
            const year = date.slice(0, 4);
            counts.set(year, (counts.get(year) ?? 0) + 1);
            return counts;
          }, new Map<string, number>()),
        ]
          .map(([year, count]) => ({ year, count }))
          .sort((left, right) => left.year.localeCompare(right.year)),
      };
    })
    .sort((left, right) => left.gpId.localeCompare(right.gpId));
}
