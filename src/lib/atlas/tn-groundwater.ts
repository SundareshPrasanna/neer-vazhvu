import { readFileSync } from "node:fs";

import { computeRecordsSha256 } from "./acquisition-validation";

export const GROUNDWATER_SCHEMA_VERSION = 1;

export const GROUNDWATER_SOURCE_ID = "ingres-gec-dynamic-groundwater";

export const INGRES_API_URL =
  "https://ingres.iith.ac.in/api/gec/getBusinessDataForUserOpen";

export const INDIA_LOCATION_UUID = "ffce954d-24e1-494b-ba7e-0931d8ad6085";

/**
 * IN-GRES categories, ordered by severity. The portal spells them with
 * underscores; they are preserved verbatim rather than prettified so the
 * artifact stays faithful to the source.
 */
export const GROUNDWATER_CATEGORIES = [
  "safe",
  "semi_critical",
  "critical",
  "over_exploited",
  "saline",
] as const;

export type GroundwaterCategory = (typeof GROUNDWATER_CATEGORIES)[number];

export interface GroundwaterAssessmentUnit {
  locationName: string;
  locationUUID: string;
  /**
   * The assessment hierarchy is the revenue one (STATE > DISTRICT > TALUK).
   * It is not the Panchayat hierarchy, which is why a Gram Panchayat can only
   * ever inherit this as containing-area context.
   */
  locationType: string;
  category: GroundwaterCategory | null;
  stageOfExtractionPercent: number | null;
  annualRechargeHam: number | null;
  totalAvailabilityHam: number | null;
  availabilityForFutureUseHam: number | null;
  rainfallMm: number | null;
}

export interface TnDistrictGroundwaterExtract {
  schemaVersion: number;
  planId: string;
  assessmentYear: string;
  acquiredAt: string;
  source: {
    sourceId: string;
    sourceUrl: string;
    portalUrl: string;
    /** The assessment unit level this district actually reports at. */
    assessmentUnitType: string;
    hierarchy: "revenue";
  };
  district: {
    locationName: string;
    locationUUID: string;
    category: GroundwaterCategory | null;
    stageOfExtractionPercent: number | null;
  };
  recordsSha256: string;
  recordCount: number;
  records: GroundwaterAssessmentUnit[];
}

function pickNumber(value: unknown, path: string[]): number | null {
  let node: unknown = value;
  for (const key of path) {
    if (node === null || typeof node !== "object") return null;
    node = (node as Record<string, unknown>)[key];
  }
  if (node === null || node === undefined) return null;
  const parsed = Number(node);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(4)) : null;
}

function pickCategory(value: unknown): GroundwaterCategory | null {
  if (value === null || typeof value !== "object") return null;
  const total = (value as Record<string, unknown>).total;
  if (typeof total !== "string") return null;
  return GROUNDWATER_CATEGORIES.includes(total as GroundwaterCategory)
    ? (total as GroundwaterCategory)
    : null;
}

export function normalizeGroundwaterRow(
  row: Record<string, unknown>,
  locationType: string,
): GroundwaterAssessmentUnit {
  return {
    locationName: String(row.locationName ?? "").trim(),
    locationUUID: String(row.locationUUID ?? ""),
    locationType,
    category: pickCategory(row.category),
    stageOfExtractionPercent: pickNumber(row.stageOfExtraction, ["total"]),
    annualRechargeHam: pickNumber(row.rechargeData, ["rainfall", "total"]),
    totalAvailabilityHam: pickNumber(row.totalGWAvailability, ["total"]),
    availabilityForFutureUseHam: pickNumber(row.availabilityForFutureUse, [
      "total",
    ]),
    rainfallMm: pickNumber(row.rainfall, ["total"]),
  };
}

export function buildTnDistrictGroundwaterExtract(options: {
  planId: string;
  assessmentYear: string;
  acquiredAt: string;
  assessmentUnitType: string;
  portalUrl: string;
  districtRow: Record<string, unknown>;
  unitRows: Record<string, unknown>[];
}): TnDistrictGroundwaterExtract {
  const district = normalizeGroundwaterRow(options.districtRow, "DISTRICT");
  // The portal appends a synthetic 'total' row to every response. It is the
  // parent's own figure, already captured as `district`, so it is not an
  // assessment unit and must not be counted as one.
  const records = options.unitRows
    .filter(
      (row) =>
        String(row.locationName ?? "").trim().toLowerCase() !== "total",
    )
    .map((row) => normalizeGroundwaterRow(row, options.assessmentUnitType))
    .sort((left, right) => left.locationName.localeCompare(right.locationName));

  return {
    schemaVersion: GROUNDWATER_SCHEMA_VERSION,
    planId: options.planId,
    assessmentYear: options.assessmentYear,
    acquiredAt: options.acquiredAt,
    source: {
      sourceId: GROUNDWATER_SOURCE_ID,
      sourceUrl: INGRES_API_URL,
      portalUrl: options.portalUrl,
      assessmentUnitType: options.assessmentUnitType,
      hierarchy: "revenue",
    },
    district: {
      locationName: district.locationName,
      locationUUID: district.locationUUID,
      category: district.category,
      stageOfExtractionPercent: district.stageOfExtractionPercent,
    },
    recordsSha256: computeRecordsSha256(records),
    recordCount: records.length,
    records,
  };
}

export function validateTnDistrictGroundwaterExtract(
  extract: TnDistrictGroundwaterExtract,
): string[] {
  const errors: string[] = [];
  if (extract.schemaVersion !== GROUNDWATER_SCHEMA_VERSION) {
    errors.push(
      `schemaVersion: expected ${GROUNDWATER_SCHEMA_VERSION}, found ${extract.schemaVersion}`,
    );
  }
  if (!/^\d{4}-\d{4}$/.test(extract.assessmentYear)) {
    errors.push(
      "assessmentYear: IN-GRES labels hydrological years as YYYY-YYYY; " +
        "do not convert it to a single edition year here",
    );
  }
  if (extract.source.hierarchy !== "revenue") {
    errors.push(
      "source.hierarchy: IN-GRES assessment units sit on the revenue " +
        "hierarchy; recording anything else would imply Panchayat-level evidence",
    );
  }
  if (extract.recordCount !== extract.records.length) {
    errors.push(
      `recordCount: declared ${extract.recordCount}, found ${extract.records.length}`,
    );
  }
  if (extract.recordsSha256 !== computeRecordsSha256(extract.records)) {
    errors.push("recordsSha256: records do not match their digest");
  }
  if (errors.length > 0) return errors;

  const seen = new Set<string>();
  for (const record of extract.records) {
    if (record.locationName.toLowerCase() === "total") {
      errors.push(
        "records: the portal's synthetic total row is not an assessment unit",
      );
    }
    if (seen.has(record.locationUUID)) {
      errors.push(`records: ${record.locationName} appears more than once`);
    }
    seen.add(record.locationUUID);
    if (record.locationName.length === 0) {
      errors.push("records: an assessment unit has no name");
    }
    if (
      record.stageOfExtractionPercent !== null &&
      record.stageOfExtractionPercent < 0
    ) {
      errors.push(`records[${record.locationName}]: negative stage of extraction`);
    }
    if (record.category !== null && record.stageOfExtractionPercent === null) {
      errors.push(
        `records[${record.locationName}]: a category without a stage of extraction`,
      );
    }
  }
  if (extract.records.length === 0) {
    errors.push("records: no assessment units were acquired");
  }
  return errors;
}

export function loadTnDistrictGroundwaterExtract(
  path: string,
): TnDistrictGroundwaterExtract {
  const parsed = JSON.parse(
    readFileSync(path, "utf8"),
  ) as TnDistrictGroundwaterExtract;
  const errors = validateTnDistrictGroundwaterExtract(parsed);
  if (errors.length > 0) {
    throw new Error(
      `Invalid groundwater extract ${path}:\n- ${errors.join("\n- ")}`,
    );
  }
  return parsed;
}

export interface GroundwaterCategorySummary {
  assessmentUnits: number;
  byCategory: Record<string, number>;
  worst: GroundwaterAssessmentUnit | null;
  districtCategory: GroundwaterCategory | null;
  districtStagePercent: number | null;
}

export function summarizeGroundwater(
  extract: TnDistrictGroundwaterExtract,
): GroundwaterCategorySummary {
  const byCategory: Record<string, number> = {};
  for (const record of extract.records) {
    const key = record.category ?? "not-stated";
    byCategory[key] = (byCategory[key] ?? 0) + 1;
  }
  const ranked = [...extract.records]
    .filter((record) => record.stageOfExtractionPercent !== null)
    .sort(
      (left, right) =>
        (right.stageOfExtractionPercent ?? 0) -
        (left.stageOfExtractionPercent ?? 0),
    );
  return {
    assessmentUnits: extract.records.length,
    byCategory,
    worst: ranked[0] ?? null,
    districtCategory: extract.district.category,
    districtStagePercent: extract.district.stageOfExtractionPercent,
  };
}
