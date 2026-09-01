import { readFileSync } from "node:fs";

import { computeRecordsSha256 } from "./acquisition-validation";
import { collectCensusSourceUnits } from "./tn-crosswalk";
import type { TnDistrictSourceExtract } from "./acquisition-model";
import type { DistrictIdentity } from "./artifacts";
import type { CanonicalCrosswalk } from "./tn-crosswalk-resolution";

export const CENSUS_ATTRIBUTES_SCHEMA_VERSION = 1;

export const DRINKING_WATER_SOURCE_KEYS = [
  "tapTreated",
  "tapTreatedSummer",
  "tapUntreated",
  "tapUntreatedSummer",
  "coveredWell",
  "coveredWellSummer",
  "uncoveredWell",
  "uncoveredWellSummer",
  "handPump",
  "handPumpSummer",
  "tubeWell",
  "tubeWellSummer",
  "riverCanal",
  "riverCanalSummer",
  "tankPondLake",
  "tankPondLakeSummer",
] as const;

export type DrinkingWaterSourceKey =
  (typeof DRINKING_WATER_SOURCE_KEYS)[number];

export type SourceAvailability = "available" | "not-available" | "not-stated";

export const CENSUS_MEASURE_KEYS = [
  "totalGeographicalAreaHectares",
  "totalHouseholds",
  "totalPopulation",
  "forestAreaHectares",
  "barrenAreaHectares",
  "culturableWasteAreaHectares",
  "netAreaSownHectares",
  "unirrigatedAreaHectares",
  "irrigatedAreaHectares",
  "canalIrrigatedAreaHectares",
  "wellIrrigatedAreaHectares",
  "tankIrrigatedAreaHectares",
  "waterfallIrrigatedAreaHectares",
  "otherIrrigatedAreaHectares",
] as const;

export type CensusMeasureKey = (typeof CENSUS_MEASURE_KEYS)[number];

export type CensusVillageAttributes = {
  villageCode: string;
  villageName: string;
  referenceYear: string;
  drinkingWaterSources: Record<DrinkingWaterSourceKey, SourceAvailability>;
} & Record<CensusMeasureKey, number | null>;

export interface TnDistrictCensusAttributes {
  schemaVersion: number;
  planId: string;
  censusDistrictCode: string;
  acquiredAt: string;
  source: {
    sourceId: string;
    sourceUrl: string;
    sourceAsOf: string;
  };
  snapshotSha256: string;
  recordsSha256: string;
  recordCount: number;
  records: CensusVillageAttributes[];
}

export interface GramPanchayatCensusRollup {
  lgdGramPanchayatCode: string;
  censusSourceUnitId: string;
  villageCodes: string[];
  measures: Record<CensusMeasureKey, number | null>;
  /**
   * A source counts as available for the Panchayat when any constituent
   * village reports it. Absence is only asserted when every village says so,
   * which keeps a single unstated village from erasing a real source.
   */
  drinkingWaterSources: Record<DrinkingWaterSourceKey, SourceAvailability>;
  /**
   * Census reports each source both for the year and for the summer months, so
   * a source present annually but absent in summer is a seasonal failure. This
   * is 2009 reference-year seasonality, not current service reliability.
   */
  annualSourceTypes: number;
  summerSourceTypes: number;
  sourceTypesLostInSummer: string[];
}

export interface BoundaryAreaCrossCheck {
  lgdGramPanchayatCode: string;
  boundaryAreaHectares: number;
  censusAreaHectares: number;
  deltaPercent: number;
  verdict: "agrees" | "review";
}

export interface BoundaryAreaCrossCheckReport {
  tolerancePercent: number;
  compared: number;
  agreed: number;
  review: number;
  notComparable: number;
  medianDeltaPercent: number;
  outliers: BoundaryAreaCrossCheck[];
}

export function validateTnDistrictCensusAttributes(
  attributes: TnDistrictCensusAttributes,
  identity: DistrictIdentity,
): string[] {
  const errors: string[] = [];
  if (attributes.schemaVersion !== CENSUS_ATTRIBUTES_SCHEMA_VERSION) {
    errors.push(
      `schemaVersion: expected ${CENSUS_ATTRIBUTES_SCHEMA_VERSION}, found ${attributes.schemaVersion}`,
    );
  }
  if (attributes.planId !== identity.planId) {
    errors.push(
      `planId: attributes ${attributes.planId} does not match district ${identity.planId}`,
    );
  }
  if (attributes.recordCount !== attributes.records.length) {
    errors.push(
      `recordCount: declared ${attributes.recordCount}, found ${attributes.records.length}`,
    );
  }
  if (attributes.recordsSha256 !== computeRecordsSha256(attributes.records)) {
    errors.push("recordsSha256: records do not match their digest");
  }
  if (errors.length > 0) return errors;

  // Payload rows must correspond exactly to the identity rows already tracked,
  // or a rollup would silently drop or invent villages.
  const identityCodes = identity.censusVillageCodes;
  const payloadCodes = new Set(
    attributes.records.map((record) => record.villageCode),
  );
  if (payloadCodes.size !== attributes.records.length) {
    errors.push("records: duplicate village codes");
  }
  const missing = [...identityCodes].filter((code) => !payloadCodes.has(code));
  const extra = [...payloadCodes].filter((code) => !identityCodes.has(code));
  if (missing.length > 0) {
    errors.push(
      `records: ${missing.length} tracked Census villages have no attribute row ` +
        `(first: ${missing.slice(0, 3).join(", ")})`,
    );
  }
  if (extra.length > 0) {
    errors.push(
      `records: ${extra.length} attribute rows match no tracked Census village ` +
        `(first: ${extra.slice(0, 3).join(", ")})`,
    );
  }
  for (const record of attributes.records) {
    for (const key of DRINKING_WATER_SOURCE_KEYS) {
      if (!(key in record.drinkingWaterSources)) {
        errors.push(`records[${record.villageCode}]: missing source ${key}`);
      }
    }
  }
  return errors;
}

export function loadTnDistrictCensusAttributes(
  path: string,
  identity: DistrictIdentity,
): TnDistrictCensusAttributes {
  const parsed = JSON.parse(
    readFileSync(path, "utf8"),
  ) as TnDistrictCensusAttributes;
  const errors = validateTnDistrictCensusAttributes(parsed, identity);
  if (errors.length > 0) {
    throw new Error(
      `Invalid Census attribute extract ${path}:\n- ${errors.join("\n- ")}`,
    );
  }
  return parsed;
}

function combineAvailability(
  values: SourceAvailability[],
): SourceAvailability {
  if (values.includes("available")) return "available";
  if (values.every((value) => value === "not-available")) return "not-available";
  return "not-stated";
}

/** Which Census villages a Gram Panchayat is bound to, from the crosswalk
 *  on the producer side or from the served directory on the consumer side. */
export interface CensusBinding {
  lgdGramPanchayatCode: string;
  sourceUnitId: string;
  villageCodes: string[];
}

export function censusBindingsFromCrosswalk(
  extract: TnDistrictSourceExtract,
  canonical: CanonicalCrosswalk,
): CensusBinding[] {
  const unitsById = new Map(
    collectCensusSourceUnits(extract.sources.census.records).map((unit) => [
      unit.id,
      unit,
    ]),
  );
  const bindings: CensusBinding[] = [];
  for (const record of canonical.records) {
    if (!record.census) continue;
    const unit = unitsById.get(record.census.sourceUnitId);
    if (!unit) continue;
    bindings.push({
      lgdGramPanchayatCode: record.lgdGramPanchayatCode,
      sourceUnitId: record.census.sourceUnitId,
      villageCodes: unit.villageCodes,
    });
  }
  return bindings;
}

export function rollUpCensusAttributesByGramPanchayat(
  attributes: { records: CensusVillageAttributes[] },
  bindings: CensusBinding[],
): GramPanchayatCensusRollup[] {
  const byVillage = new Map(
    attributes.records.map((record) => [record.villageCode, record]),
  );

  const rollups: GramPanchayatCensusRollup[] = [];
  for (const binding of bindings) {
    const villages = binding.villageCodes
      .map((code) => byVillage.get(code))
      .filter((value): value is CensusVillageAttributes => value !== undefined);
    if (villages.length === 0) continue;

    const measures = {} as Record<CensusMeasureKey, number | null>;
    for (const key of CENSUS_MEASURE_KEYS) {
      const values = villages
        .map((village) => village[key])
        .filter((value): value is number => typeof value === "number");
      measures[key] =
        values.length === 0
          ? null
          : Number(values.reduce((total, value) => total + value, 0).toFixed(4));
    }
    const sources = {} as Record<DrinkingWaterSourceKey, SourceAvailability>;
    for (const key of DRINKING_WATER_SOURCE_KEYS) {
      sources[key] = combineAvailability(
        villages.map((village) => village.drinkingWaterSources[key]),
      );
    }
    const seasonalPairs: Array<[DrinkingWaterSourceKey, DrinkingWaterSourceKey]> = [
      ["tapTreated", "tapTreatedSummer"],
      ["tapUntreated", "tapUntreatedSummer"],
      ["coveredWell", "coveredWellSummer"],
      ["uncoveredWell", "uncoveredWellSummer"],
      ["handPump", "handPumpSummer"],
      ["tubeWell", "tubeWellSummer"],
      ["riverCanal", "riverCanalSummer"],
      ["tankPondLake", "tankPondLakeSummer"],
    ];
    const annual = seasonalPairs.filter(
      ([yearRound]) => sources[yearRound] === "available",
    );
    const lost = annual
      .filter(([, summer]) => sources[summer] !== "available")
      .map(([yearRound]) => yearRound);

    rollups.push({
      lgdGramPanchayatCode: binding.lgdGramPanchayatCode,
      annualSourceTypes: annual.length,
      summerSourceTypes: annual.length - lost.length,
      sourceTypesLostInSummer: lost,
      censusSourceUnitId: binding.sourceUnitId,
      villageCodes: villages.map((village) => village.villageCode),
      measures,
      drinkingWaterSources: sources,
    });
  }
  return rollups.sort((left, right) =>
    left.lgdGramPanchayatCode.localeCompare(right.lgdGramPanchayatCode),
  );
}

/**
 * Compares the mapped boundary area against the Census 2009 geographic area
 * for the same Panchayat. The two are independent measurements of the same
 * ground, so a large disagreement is evidence that identity, geometry or
 * composition is wrong somewhere and belongs in review rather than in a brief.
 */
export function crossCheckBoundaryAreas(
  boundaryAreas: Map<string, number>,
  rollups: GramPanchayatCensusRollup[],
  tolerancePercent = 10,
): BoundaryAreaCrossCheckReport {
  const boundaryByCode = boundaryAreas;
  const comparisons: BoundaryAreaCrossCheck[] = [];
  let notComparable = 0;
  for (const rollup of rollups) {
    const mapped = boundaryByCode.get(rollup.lgdGramPanchayatCode);
    const censusArea = rollup.measures.totalGeographicalAreaHectares;
    if (mapped === undefined || censusArea === null || censusArea <= 0) {
      notComparable += 1;
      continue;
    }
    const deltaPercent = Number(
      (((mapped - censusArea) / censusArea) * 100).toFixed(2),
    );
    comparisons.push({
      lgdGramPanchayatCode: rollup.lgdGramPanchayatCode,
      boundaryAreaHectares: mapped,
      censusAreaHectares: censusArea,
      deltaPercent,
      verdict:
        Math.abs(deltaPercent) <= tolerancePercent ? "agrees" : "review",
    });
  }
  const sorted = comparisons
    .map((comparison) => Math.abs(comparison.deltaPercent))
    .sort((left, right) => left - right);
  const median =
    sorted.length === 0
      ? 0
      : Number(
          (sorted.length % 2 === 1
            ? sorted[(sorted.length - 1) / 2]
            : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          ).toFixed(2),
        );
  return {
    tolerancePercent,
    compared: comparisons.length,
    agreed: comparisons.filter((c) => c.verdict === "agrees").length,
    review: comparisons.filter((c) => c.verdict === "review").length,
    notComparable,
    medianDeltaPercent: median,
    outliers: comparisons
      .filter((c) => c.verdict === "review")
      .sort((left, right) =>
        Math.abs(right.deltaPercent) - Math.abs(left.deltaPercent),
      ),
  };
}
