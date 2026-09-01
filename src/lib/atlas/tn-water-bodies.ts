import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { computeRecordsSha256 } from "./acquisition-validation";
import type { DistrictIdentity } from "./artifacts";
import {
  TNGIS_TERMS_QUOTE,
  TNGIS_TERMS_URL,
  type BoundaryRightsApproval,
} from "./tn-boundary";

export const WATER_BODY_EXTRACT_SCHEMA_VERSION = 1;

export const WATER_BODY_SOURCE_ID = "tngis-all-water-bodies";
export const WATER_BODY_LAYER = "generic_viewer:all_water_bodies";

/**
 * The layer carries a `panchayat_lgdvcode` column holding the LGD Gram
 * Panchayat code, which is the key the rest of the Atlas already indexes on.
 * That makes this the only Tamil Nadu water source so far that needs no name
 * folding and no crosswalk: every feature states which Panchayat it belongs
 * to, and the join is exact or it is a defect.
 *
 * What is stored is deliberately derived rather than raw. TNGIS restricts
 * publication without prior approval, so this follows the same rule the
 * boundary extract set: keep the counts and the areas computed from the
 * geometry, keep a digest of the raw content, and keep neither the geometry
 * nor the water-body names. If an approval is ever recorded, re-acquire and
 * widen the record then, rather than holding content we may not show.
 */
export interface TnWaterBodyRecord {
  lgdGramPanchayatCode: string;
  count: number;
  /** How many of them the source names at all. The rest are unnamed polygons. */
  namedCount: number;
  /** Summed waterspread, computed from geometry because `area` is empty upstream. */
  areaHectares: number;
  /** One large tank and thirty farm ponds are different places. */
  largestAreaHectares: number;
  byDepartment: Array<{ department: string; count: number }>;
  /** Fingerprint of the sorted name list. The names themselves are not held. */
  namesSha256: string;
}

export interface TnDistrictWaterBodyExtract {
  schemaVersion: number;
  planId: string;
  districtLgdCode: string;
  acquiredAt: string;
  source: {
    sourceId: string;
    layer: string;
    sourceUrl: string;
    retrievedAt: string;
    rights: {
      status: "permission-required";
      termsUrl: string;
      termsQuote: string;
      publicDisplay: "permission-required";
      redistribution: "permission-required";
      commercialUse: "permission-required";
      approval: BoundaryRightsApproval | null;
    };
    /**
     * The layer merges five departments' registers. Which one contributed a
     * feature is the closest thing to a vintage the source offers, so it is
     * kept per record rather than flattened into a single count.
     */
    contributingDepartments: string[];
  };
  snapshotSha256: string;
  recordsSha256: string;
  recordCount: number;
  featureCount: number;
  records: TnWaterBodyRecord[];
}

export interface WaterBodyJoinReport {
  districtLgdCode: string;
  lgdGramPanchayats: number;
  panchayatsWithWaterBodies: number;
  featureCount: number;
  /**
   * A Panchayat with no water body is a finding, not a defect: the delta has
   * canal-fed blocks where the register is genuinely empty. A water body
   * claiming a Panchayat that does not exist is a defect.
   */
  panchayatsWithout: string[];
  unmatchedPanchayatCodes: string[];
  totalAreaHectares: number;
  namedFeatures: number;
}

interface GeoJsonFeature {
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown } | null;
}

function roundHectares(squareMetres: number): number {
  return Number((squareMetres / 10000).toFixed(4));
}

export function buildTnDistrictWaterBodyExtract(
  features: GeoJsonFeature[],
  options: {
    planId: string;
    districtLgdCode: string;
    acquiredAt: string;
    sourceUrl: string;
    snapshotSha256: string;
    area: (feature: unknown) => number;
  },
): TnDistrictWaterBodyExtract {
  interface Bucket {
    count: number;
    namedCount: number;
    areaSquareMetres: number;
    largestSquareMetres: number;
    departments: Map<string, number>;
    names: string[];
  }
  const buckets = new Map<string, Bucket>();
  const departments = new Set<string>();
  let featureCount = 0;

  for (const feature of features) {
    const rawCode = feature.properties.panchayat_lgdvcode;
    if (rawCode === null || rawCode === undefined || Number(rawCode) === 0) {
      // The statewide layer carries town and corporation features with no
      // Panchayat. Skipping them here keeps the district artifact rural
      // without pretending the source is cleaner than it is.
      continue;
    }
    const code = String(rawCode);
    const bucket = buckets.get(code) ?? {
      count: 0,
      namedCount: 0,
      areaSquareMetres: 0,
      largestSquareMetres: 0,
      departments: new Map<string, number>(),
      names: [],
    };
    const squareMetres = feature.geometry ? options.area(feature) : 0;
    const name = String(feature.properties.water_body_name ?? "").trim();
    const department = String(
      feature.properties.source_department ?? "unstated",
    ).trim();

    bucket.count += 1;
    if (name.length > 0) {
      bucket.namedCount += 1;
      bucket.names.push(name);
    }
    bucket.areaSquareMetres += squareMetres;
    bucket.largestSquareMetres = Math.max(
      bucket.largestSquareMetres,
      squareMetres,
    );
    bucket.departments.set(
      department,
      (bucket.departments.get(department) ?? 0) + 1,
    );
    departments.add(department);
    buckets.set(code, bucket);
    featureCount += 1;
  }

  const records: TnWaterBodyRecord[] = [...buckets.entries()]
    .map(([code, bucket]) => ({
      lgdGramPanchayatCode: code,
      count: bucket.count,
      namedCount: bucket.namedCount,
      areaHectares: roundHectares(bucket.areaSquareMetres),
      largestAreaHectares: roundHectares(bucket.largestSquareMetres),
      byDepartment: [...bucket.departments.entries()]
        .map(([department, count]) => ({ department, count }))
        .sort(
          (left, right) =>
            right.count - left.count ||
            left.department.localeCompare(right.department),
        ),
      namesSha256: createHash("sha256")
        .update(JSON.stringify([...bucket.names].sort()))
        .digest("hex"),
    }))
    .sort((left, right) =>
      left.lgdGramPanchayatCode.localeCompare(right.lgdGramPanchayatCode),
    );

  return {
    schemaVersion: WATER_BODY_EXTRACT_SCHEMA_VERSION,
    planId: options.planId,
    districtLgdCode: options.districtLgdCode,
    acquiredAt: options.acquiredAt,
    source: {
      sourceId: WATER_BODY_SOURCE_ID,
      layer: WATER_BODY_LAYER,
      sourceUrl: options.sourceUrl,
      retrievedAt: options.acquiredAt,
      rights: {
        status: "permission-required",
        termsUrl: TNGIS_TERMS_URL,
        termsQuote: TNGIS_TERMS_QUOTE,
        publicDisplay: "permission-required",
        redistribution: "permission-required",
        commercialUse: "permission-required",
        approval: null,
      },
      contributingDepartments: [...departments].sort(),
    },
    snapshotSha256: options.snapshotSha256,
    recordsSha256: computeRecordsSha256(records),
    recordCount: records.length,
    featureCount,
    records,
  };
}

export function reportWaterBodyJoin(
  waterBodies: TnDistrictWaterBodyExtract,
  identity: DistrictIdentity,
): WaterBodyJoinReport {
  const lgdCodes = new Set(identity.gramPanchayats.keys());
  const held = new Map(
    waterBodies.records.map((record) => [record.lgdGramPanchayatCode, record]),
  );
  return {
    districtLgdCode: waterBodies.districtLgdCode,
    lgdGramPanchayats: lgdCodes.size,
    panchayatsWithWaterBodies: [...held.keys()].filter((code) =>
      lgdCodes.has(code),
    ).length,
    featureCount: waterBodies.featureCount,
    panchayatsWithout: [...lgdCodes].filter((code) => !held.has(code)).sort(),
    unmatchedPanchayatCodes: [...held.keys()]
      .filter((code) => !lgdCodes.has(code))
      .sort(),
    totalAreaHectares: Number(
      waterBodies.records
        .reduce((total, record) => total + record.areaHectares, 0)
        .toFixed(2),
    ),
    namedFeatures: waterBodies.records.reduce(
      (total, record) => total + record.namedCount,
      0,
    ),
  };
}

export function validateTnDistrictWaterBodyExtract(
  waterBodies: TnDistrictWaterBodyExtract,
  identity: DistrictIdentity,
): string[] {
  const errors: string[] = [];
  if (waterBodies.schemaVersion !== WATER_BODY_EXTRACT_SCHEMA_VERSION) {
    errors.push(
      `schemaVersion: expected ${WATER_BODY_EXTRACT_SCHEMA_VERSION}, found ${waterBodies.schemaVersion}`,
    );
  }
  if (waterBodies.planId !== identity.planId) {
    errors.push(
      `planId: water bodies ${waterBodies.planId} does not match district ${identity.planId}`,
    );
  }
  if (waterBodies.recordCount !== waterBodies.records.length) {
    errors.push(
      `recordCount: declared ${waterBodies.recordCount}, found ${waterBodies.records.length}`,
    );
  }
  if (waterBodies.recordsSha256 !== computeRecordsSha256(waterBodies.records)) {
    errors.push("recordsSha256: records do not match their digest");
  }

  const rights = waterBodies.source.rights;
  if (!rights || rights.status !== "permission-required") {
    errors.push(
      "source.rights.status: TNGIS requires prior approval for public display, " +
        "redistribution and commercial use; that restriction may not be downgraded",
    );
  } else {
    if (rights.termsUrl !== TNGIS_TERMS_URL) {
      errors.push(`source.rights.termsUrl: must cite ${TNGIS_TERMS_URL}`);
    }
    if (!rights.termsQuote.includes("prior approval")) {
      errors.push(
        "source.rights.termsQuote: must carry the published restriction verbatim",
      );
    }
  }

  const seen = new Set<string>();
  let featureTally = 0;
  for (const record of waterBodies.records) {
    const label = record.lgdGramPanchayatCode;
    if (seen.has(label)) {
      errors.push(`records: Gram Panchayat ${label} appears more than once`);
    }
    seen.add(label);
    if (!(record.count > 0)) {
      errors.push(`records[${label}]: a record with no water body is not a record`);
    }
    if (record.namedCount > record.count) {
      errors.push(`records[${label}]: more names than water bodies`);
    }
    if (record.areaHectares < 0 || record.largestAreaHectares < 0) {
      errors.push(`records[${label}]: area may not be negative`);
    }
    if (record.largestAreaHectares > record.areaHectares + 0.0001) {
      errors.push(
        `records[${label}]: largest water body exceeds the summed waterspread`,
      );
    }
    const departmentTotal = record.byDepartment.reduce(
      (total, entry) => total + entry.count,
      0,
    );
    if (departmentTotal !== record.count) {
      errors.push(
        `records[${label}]: department counts total ${departmentTotal}, expected ${record.count}`,
      );
    }
    featureTally += record.count;
  }
  if (featureTally !== waterBodies.featureCount) {
    errors.push(
      `featureCount: declared ${waterBodies.featureCount}, records total ${featureTally}`,
    );
  }
  if (errors.length > 0) return errors;

  const report = reportWaterBodyJoin(waterBodies, identity);
  // Only one direction is fatal. A Panchayat with no water body is a real
  // answer; a water body assigned to a Panchayat this district does not have
  // means the join key is wrong.
  if (report.unmatchedPanchayatCodes.length > 0) {
    errors.push(
      `join: ${report.unmatchedPanchayatCodes.length} water-body records name a ` +
        `Gram Panchayat outside this district ` +
        `(first: ${report.unmatchedPanchayatCodes.slice(0, 3).join(", ")})`,
    );
  }
  return errors;
}

export function loadTnDistrictWaterBodyExtract(
  path: string,
  identity: DistrictIdentity,
): TnDistrictWaterBodyExtract {
  const parsed = JSON.parse(
    readFileSync(path, "utf8"),
  ) as TnDistrictWaterBodyExtract;
  const errors = validateTnDistrictWaterBodyExtract(parsed, identity);
  if (errors.length > 0) {
    throw new Error(
      `Invalid district water-body extract ${path}:\n- ${errors.join("\n- ")}`,
    );
  }
  return parsed;
}
