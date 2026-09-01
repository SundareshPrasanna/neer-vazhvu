/**
 * Acquisition-side types for a district whose identity comes from the Local
 * Government Directory rather than a state department's own register: the
 * reviewed refresh plan (pipeline-inputs/atlas/<state>/<district>/refresh-plan.json
 * with identityAdapter "lgd-directory") and the source extract the
 * acquisition produces from the LGD resources on data.gov.in, JJM and the
 * Census 2011 village release.
 *
 * Tamil Nadu keeps its TNRD adapter (acquisition-model.ts); the two share the
 * JJM and Census record types, the completeness vocabulary and the served
 * directory shape. What differs is the identity master: here it is the LGD
 * Village Panchayat list with the villages each Panchayat covers, and the
 * block layer is the LGD sub-district (taluka) where a state's Panchayat
 * Samitis are coterminous with its talukas.
 */
import {
  ID_PATTERN,
  isNonEmptyString,
  isPositiveInteger,
  isRecord,
  isValidDate,
  validateAcquiredSource,
  validateCensusComposition,
  validateJjmRecord,
  validateMappingExpectation,
  validateStringFields,
  validateUniqueValues,
  validateUrl,
} from "./acquisition-validation";
import type {
  AcquiredSourceRecordSet,
  CensusVillageRecord,
  JjmVillageRecord,
  TnDistrictCensusCompositionReview,
  TnDistrictMappingExpectation,
} from "./acquisition-model";
import { ATLAS_SCHEMA_VERSION } from "./acquisition-model";

export const LGD_IDENTITY_ADAPTER = "lgd-directory" as const;

/** How a state's blocks are represented. Satara's eleven Panchayat Samitis
 *  are coterminous with its eleven talukas, so the LGD sub-district is the
 *  block layer there; a state whose development blocks cut across talukas
 *  would need the LGD block resource, which data.gov.in does not carry. */
export const LGD_BLOCK_MODELS = ["sub-district"] as const;
export type LgdBlockModel = (typeof LGD_BLOCK_MODELS)[number];

export interface LgdDistrictRefreshPlan {
  schemaVersion: number;
  id: string;
  identityAdapter: typeof LGD_IDENTITY_ADAPTER;
  district: {
    displayName: string;
    lgdStateCode: string;
    lgdDistrictCode: string;
    jjmStateId: string;
    jjmDistrictId: string;
    censusStateCode: string;
    censusDistrictCode: string;
    /** The DCHB village release worksheet; the state release number is in it. */
    censusWorkbookSheet: string;
    ingresStateName: string;
    ingresStateUuid: string;
    ingresDistrictName: string;
    /** What IN-GRES calls the assessment unit in this state (TALUK, TALUKA, BLOCK, MANDAL). */
    ingresAssessmentUnitType: string;
    blockModel: LgdBlockModel;
  };
  sources: {
    lgdLocalBodies: LgdResourceSource;
    lgdVillages: LgdResourceSource;
    lgdSubdistricts: LgdResourceSource;
    jjm: { url: string };
    census: { url: string; catalogUrl: string; sourceAsOf: string };
    boundary: {
      geojsonUrl: string;
      crosswalkUrl: string;
      /** The DISTRICT property value in the DataMeet file. */
      districtName: string;
      license: string;
    };
    /** The First Census of Water Bodies state resource on data.gov.in, when
     *  the district's water-body register is read from it. */
    waterBodiesCensus?: LgdWaterBodiesCensusSource;
  };
  expectedCounts: {
    lgdSubdistricts: number;
    lgdVillages: number;
    lgdGramPanchayats: number;
    /** Coverage rows (one per Panchayat-village pair) the Local Bodies resource
     *  carries for this district. Fewer than the villages: the resource lists
     *  one covering village for most Panchayats, not every member. */
    lgdCoverageRows: number;
    jjmVillages: number;
    censusVillages: number;
    /** Rows the census resource returns for the district, rural and urban;
     *  a closed edition, so the count is exact. Required with the source. */
    waterBodiesCensusRows?: number;
  };
  targets: LgdDistrictRefreshTarget[];
}

export interface LgdWaterBodiesCensusSource extends LgdResourceSource {
  /** The district_name value as the resource spells it (upper case). */
  districtName: string;
  /** The reviewer's judgement of the waterspread column: "stated" publishes
   *  the entered hectares, "withheld" serves counts and points only. The
   *  producer refuses "stated" on a return that reads as templated. */
  waterspread: "stated" | "withheld";
  waterspreadNote: string;
}

/** A data.gov.in resource: the API resource id, the API url, and the catalog
 *  page a reader can open. The bulk export url (limit=all) is discovered from
 *  the portal's own metadata at fetch time, never copied into the plan. */
export interface LgdResourceSource {
  resourceId: string;
  url: string;
  catalogUrl: string;
}

export interface LgdDistrictRefreshTarget {
  id: string;
  displayName: string;
  reviewedAt: string;
  lgdGramPanchayatCode: string;
  lgdSubdistrictCode: string;
  jjmBlockId: string;
  jjmGramPanchayatId: string;
  censusSubdistrictCode: string;
  mappingExpectations: {
    jjm: TnDistrictMappingExpectation;
    census: TnDistrictMappingExpectation;
  };
  censusComposition: TnDistrictCensusCompositionReview;
}

/* ── records ───────────────────────────────────────────────────────────── */

export interface LgdSubdistrictRecord {
  stateCode: string;
  districtCode: string;
  districtName: string;
  subdistrictCode: string;
  subdistrictName: string;
  subdistrictCensus2011Code: string;
}

export interface LgdVillageRecord {
  villageCode: string;
  villageName: string;
  /** Empty when the LGD has not recorded one (a village created after 2011). */
  villageCensus2011Code: string;
  subdistrictCode: string;
  subdistrictName: string;
  districtCode: string;
  stateCode: string;
}

/** One row of the Local Bodies resource: a Panchayat and one village it
 *  covers. The Panchayat's own identity repeats on every row. */
export interface LgdLocalBodyCoverageRecord {
  stateCode: string;
  localBodyCode: string;
  localBodyName: string;
  localBodyNameLocal: string;
  localBodyTypeName: string;
  entityCode: string;
  entityName: string;
  entityType: string;
  coverageType: string;
}

export interface LgdDistrictSourceExtract {
  schemaVersion: number;
  planId: string;
  identityAdapter: typeof LGD_IDENTITY_ADAPTER;
  acquiredAt: string;
  sources: {
    lgdSubdistricts: AcquiredSourceRecordSet<LgdSubdistrictRecord>;
    lgdVillages: AcquiredSourceRecordSet<LgdVillageRecord>;
    lgdLocalBodies: AcquiredSourceRecordSet<LgdLocalBodyCoverageRecord>;
    jjm: AcquiredSourceRecordSet<JjmVillageRecord>;
    census: AcquiredSourceRecordSet<CensusVillageRecord>;
  };
}

export const LGD_SOURCE_IDS = {
  subdistricts: "lgd-subdistricts-datagovin",
  villages: "lgd-villages-datagovin",
  localBodies: "lgd-local-bodies-datagovin",
  jjm: "jjm-citizen-corner",
  census: "census-2011-village-amenities",
} as const;

/* ── validation ────────────────────────────────────────────────────────── */

function validateResourceSource(raw: unknown, label: string, errors: string[]): void {
  if (!isRecord(raw)) {
    errors.push(`${label}: must be an object`);
    return;
  }
  validateStringFields(raw, ["resourceId"], label, errors);
  validateUrl(raw.url, `${label}.url`, errors);
  validateUrl(raw.catalogUrl, `${label}.catalogUrl`, errors);
}

export function validateLgdDistrictRefreshPlan(raw: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(raw)) return ["refresh plan: root must be an object"];
  if (raw.schemaVersion !== ATLAS_SCHEMA_VERSION) {
    errors.push(`schemaVersion: expected ${ATLAS_SCHEMA_VERSION}`);
  }
  if (!isNonEmptyString(raw.id) || !ID_PATTERN.test(raw.id)) {
    errors.push("id: invalid identifier");
  }
  if (raw.identityAdapter !== LGD_IDENTITY_ADAPTER) {
    errors.push(`identityAdapter: expected ${LGD_IDENTITY_ADAPTER}`);
  }
  if (!isRecord(raw.district)) {
    errors.push("district: must be an object");
  } else {
    validateStringFields(
      raw.district,
      [
        "displayName",
        "lgdStateCode",
        "lgdDistrictCode",
        "jjmStateId",
        "jjmDistrictId",
        "censusStateCode",
        "censusDistrictCode",
        "censusWorkbookSheet",
        "ingresStateName",
        "ingresStateUuid",
        "ingresDistrictName",
        "ingresAssessmentUnitType",
      ],
      "district",
      errors,
    );
    if (!LGD_BLOCK_MODELS.includes(raw.district.blockModel as LgdBlockModel)) {
      errors.push(`district.blockModel: must be one of ${LGD_BLOCK_MODELS.join(", ")}`);
    }
  }
  if (!isRecord(raw.sources)) {
    errors.push("sources: must be an object");
  } else {
    for (const name of ["lgdLocalBodies", "lgdVillages", "lgdSubdistricts"]) {
      validateResourceSource(raw.sources[name], `sources.${name}`, errors);
    }
    const jjm = raw.sources.jjm;
    if (!isRecord(jjm)) errors.push("sources.jjm: must be an object");
    else validateUrl(jjm.url, "sources.jjm.url", errors);
    const census = raw.sources.census;
    if (!isRecord(census)) errors.push("sources.census: must be an object");
    else {
      validateUrl(census.url, "sources.census.url", errors);
      validateUrl(census.catalogUrl, "sources.census.catalogUrl", errors);
      if (!isNonEmptyString(census.sourceAsOf)) {
        errors.push("sources.census.sourceAsOf: must be non-empty");
      }
    }
    const boundary = raw.sources.boundary;
    if (!isRecord(boundary)) errors.push("sources.boundary: must be an object");
    else {
      validateUrl(boundary.geojsonUrl, "sources.boundary.geojsonUrl", errors);
      validateUrl(boundary.crosswalkUrl, "sources.boundary.crosswalkUrl", errors);
      validateStringFields(boundary, ["districtName", "license"], "sources.boundary", errors);
    }
    const waterBodies = raw.sources.waterBodiesCensus;
    if (waterBodies !== undefined) {
      validateResourceSource(waterBodies, "sources.waterBodiesCensus", errors);
      if (isRecord(waterBodies)) {
        validateStringFields(waterBodies, ["districtName", "waterspreadNote"], "sources.waterBodiesCensus", errors);
        if (waterBodies.waterspread !== "stated" && waterBodies.waterspread !== "withheld") {
          errors.push("sources.waterBodiesCensus.waterspread: must be stated or withheld");
        }
      }
      if (isRecord(raw.expectedCounts) && !isPositiveInteger(raw.expectedCounts.waterBodiesCensusRows)) {
        errors.push("expectedCounts.waterBodiesCensusRows: required with sources.waterBodiesCensus");
      }
    }
  }
  if (!isRecord(raw.expectedCounts)) {
    errors.push("expectedCounts: must be an object");
  } else {
    for (const field of [
      "lgdSubdistricts",
      "lgdVillages",
      "lgdGramPanchayats",
      "lgdCoverageRows",
      "jjmVillages",
      "censusVillages",
    ]) {
      if (!isPositiveInteger(raw.expectedCounts[field])) {
        errors.push(`expectedCounts.${field}: must be a positive integer`);
      }
    }
  }
  if (!Array.isArray(raw.targets) || raw.targets.length === 0) {
    errors.push("targets: must be a non-empty array");
  } else {
    const ids = new Set<string>();
    const codes = new Set<string>();
    for (const [index, target] of raw.targets.entries()) {
      const label = `targets[${index}]`;
      if (!isRecord(target)) {
        errors.push(`${label}: must be an object`);
        continue;
      }
      if (!isNonEmptyString(target.id) || !ID_PATTERN.test(target.id)) {
        errors.push(`${label}.id: invalid identifier`);
      } else if (ids.has(target.id)) {
        errors.push(`${label}.id: duplicate ${target.id}`);
      } else ids.add(target.id);
      if (!isValidDate(target.reviewedAt)) errors.push(`${label}.reviewedAt: must be a valid date`);
      validateStringFields(
        target,
        [
          "displayName",
          "lgdGramPanchayatCode",
          "lgdSubdistrictCode",
          "jjmBlockId",
          "jjmGramPanchayatId",
          "censusSubdistrictCode",
        ],
        label,
        errors,
      );
      if (!isRecord(target.mappingExpectations)) {
        errors.push(`${label}.mappingExpectations: must be an object`);
      } else {
        validateMappingExpectation(target.mappingExpectations.jjm, `${label}.mappingExpectations.jjm`, errors);
        validateMappingExpectation(
          target.mappingExpectations.census,
          `${label}.mappingExpectations.census`,
          errors,
        );
      }
      validateCensusComposition(
        target.censusComposition,
        target.lgdGramPanchayatCode,
        `${label}.censusComposition`,
        errors,
      );
      if (isNonEmptyString(target.lgdGramPanchayatCode)) {
        if (codes.has(target.lgdGramPanchayatCode)) {
          errors.push(`${label}.lgdGramPanchayatCode: duplicate ${target.lgdGramPanchayatCode}`);
        }
        codes.add(target.lgdGramPanchayatCode);
      }
    }
  }
  return errors;
}

function validateSubdistrictRecord(
  raw: Record<string, unknown>,
  label: string,
  errors: string[],
): LgdSubdistrictRecord {
  validateStringFields(
    raw,
    ["stateCode", "districtCode", "districtName", "subdistrictCode", "subdistrictName", "subdistrictCensus2011Code"],
    label,
    errors,
  );
  return raw as unknown as LgdSubdistrictRecord;
}

function validateVillageRecord(
  raw: Record<string, unknown>,
  label: string,
  errors: string[],
): LgdVillageRecord {
  validateStringFields(
    raw,
    ["villageCode", "villageName", "subdistrictCode", "subdistrictName", "districtCode", "stateCode"],
    label,
    errors,
  );
  if (typeof raw.villageCensus2011Code !== "string") {
    errors.push(`${label}.villageCensus2011Code: must be a string (empty when the LGD records none)`);
  }
  return raw as unknown as LgdVillageRecord;
}

function validateCoverageRecord(
  raw: Record<string, unknown>,
  label: string,
  errors: string[],
): LgdLocalBodyCoverageRecord {
  validateStringFields(
    raw,
    ["stateCode", "localBodyCode", "localBodyName", "localBodyTypeName", "entityCode", "entityName", "entityType", "coverageType"],
    label,
    errors,
  );
  if (typeof raw.localBodyNameLocal !== "string") {
    errors.push(`${label}.localBodyNameLocal: must be a string`);
  }
  if (raw.localBodyTypeName !== "Village Panchayat") {
    errors.push(`${label}.localBodyTypeName: only Village Panchayat rows belong in the extract`);
  }
  if (raw.entityType !== "Village") {
    errors.push(`${label}.entityType: only village coverage rows belong in the extract`);
  }
  return raw as unknown as LgdLocalBodyCoverageRecord;
}

/** The Maharashtra DCHB release leaves the Gram Panchayat columns blank, so
 *  the Census record validator here accepts an empty gramPanchayats list;
 *  everything else is the Tamil Nadu rule. */
function validateCensusRecordWithoutGramPanchayats(
  raw: Record<string, unknown>,
  label: string,
  errors: string[],
): CensusVillageRecord {
  validateStringFields(
    raw,
    [
      "stateCode",
      "stateName",
      "districtCode",
      "districtName",
      "subdistrictCode",
      "subdistrictName",
      "villageCode",
      "villageName",
      "referenceYear",
    ],
    label,
    errors,
  );
  for (const field of ["cdBlocks", "gramPanchayats"]) {
    const values = raw[field];
    if (!Array.isArray(values)) {
      errors.push(`${label}.${field}: must be an array`);
      continue;
    }
    if (field === "cdBlocks" && values.length === 0) {
      errors.push(`${label}.cdBlocks: must be a non-empty array`);
    }
    const codes = new Set<string>();
    for (const [index, value] of values.entries()) {
      if (!isRecord(value)) {
        errors.push(`${label}.${field}[${index}]: must be an object`);
        continue;
      }
      validateStringFields(value, ["code", "name"], `${label}.${field}[${index}]`, errors);
      const code = value.code;
      if (isNonEmptyString(code)) {
        if (codes.has(code)) errors.push(`${label}.${field}: duplicate code ${code}`);
        codes.add(code);
      }
    }
  }
  return raw as unknown as CensusVillageRecord;
}

export function validateLgdDistrictSourceExtract(raw: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(raw)) return ["source extract: root must be an object"];
  if (raw.schemaVersion !== ATLAS_SCHEMA_VERSION) {
    errors.push(`schemaVersion: expected ${ATLAS_SCHEMA_VERSION}`);
  }
  if (!isNonEmptyString(raw.planId) || !ID_PATTERN.test(raw.planId)) {
    errors.push("planId: invalid identifier");
  }
  if (raw.identityAdapter !== LGD_IDENTITY_ADAPTER) {
    errors.push(`identityAdapter: expected ${LGD_IDENTITY_ADAPTER}`);
  }
  if (!isValidDate(raw.acquiredAt)) errors.push("acquiredAt: must be a valid date");
  if (!isRecord(raw.sources)) {
    errors.push("sources: must be an object");
    return errors;
  }
  const subdistricts = validateAcquiredSource(
    raw.sources.lgdSubdistricts,
    "sources.lgdSubdistricts",
    validateSubdistrictRecord,
    errors,
  );
  const villages = validateAcquiredSource(
    raw.sources.lgdVillages,
    "sources.lgdVillages",
    validateVillageRecord,
    errors,
  );
  const localBodies = validateAcquiredSource(
    raw.sources.lgdLocalBodies,
    "sources.lgdLocalBodies",
    validateCoverageRecord,
    errors,
  );
  const jjm = validateAcquiredSource(raw.sources.jjm, "sources.jjm", validateJjmRecord, errors);
  const census = validateAcquiredSource(
    raw.sources.census,
    "sources.census",
    validateCensusRecordWithoutGramPanchayats,
    errors,
  );
  const sources: Array<[string, AcquiredSourceRecordSet<unknown> | null, string]> = [
    ["lgdSubdistricts", subdistricts, LGD_SOURCE_IDS.subdistricts],
    ["lgdVillages", villages, LGD_SOURCE_IDS.villages],
    ["lgdLocalBodies", localBodies, LGD_SOURCE_IDS.localBodies],
    ["jjm", jjm, LGD_SOURCE_IDS.jjm],
    ["census", census, LGD_SOURCE_IDS.census],
  ];
  for (const [name, source, expectedId] of sources) {
    if (source === null) continue;
    if (source.sourceId !== expectedId) {
      errors.push(`sources.${name}.sourceId: expected ${expectedId}`);
    }
    if (source.reusedCachedArtifact === true) {
      if (typeof raw.acquiredAt === "string" && source.retrievedAt > raw.acquiredAt) {
        errors.push(
          `sources.${name}.retrievedAt: a reused cached artifact must carry ` +
            "its original retrieval date, not one after acquiredAt",
        );
      }
    } else if (source.retrievedAt !== raw.acquiredAt) {
      errors.push(`sources.${name}.retrievedAt: must equal acquiredAt`);
    }
  }
  if (subdistricts) {
    validateUniqueValues(
      subdistricts.records as unknown as Array<Record<string, string>>,
      ["subdistrictCode"],
      "sources.lgdSubdistricts.records",
      errors,
    );
  }
  if (villages) {
    validateUniqueValues(
      villages.records as unknown as Array<Record<string, string>>,
      ["villageCode"],
      "sources.lgdVillages.records",
      errors,
    );
  }
  if (localBodies) {
    validateUniqueValues(
      localBodies.records as unknown as Array<Record<string, string>>,
      ["localBodyCode", "entityCode"],
      "sources.lgdLocalBodies.records",
      errors,
    );
  }
  if (jjm) {
    validateUniqueValues(
      jjm.records as unknown as Array<Record<string, string>>,
      ["blockId", "gpId", "villageId"],
      "sources.jjm.records",
      errors,
    );
  }
  if (census) {
    validateUniqueValues(
      census.records as unknown as Array<Record<string, string>>,
      ["villageCode"],
      "sources.census.records",
      errors,
    );
  }
  // Cross-source agreement: every coverage row names a village of this
  // district, and every village sits in a listed sub-district.
  if (villages && localBodies && subdistricts && errors.length === 0) {
    const villageCodes = new Set(villages.records.map((record) => record.villageCode));
    const subdistrictCodes = new Set(subdistricts.records.map((record) => record.subdistrictCode));
    for (const record of localBodies.records) {
      if (!villageCodes.has(record.entityCode)) {
        errors.push(
          `sources.lgdLocalBodies: ${record.localBodyCode} covers ${record.entityCode}, ` +
            "which is not a village of this district",
        );
      }
    }
    for (const record of villages.records) {
      if (!subdistrictCodes.has(record.subdistrictCode)) {
        errors.push(`sources.lgdVillages: ${record.villageCode} sits in unlisted sub-district ${record.subdistrictCode}`);
      }
    }
  }
  return errors;
}
