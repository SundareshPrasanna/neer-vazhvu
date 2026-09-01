import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import type {
  AcquiredSourceRecordSet,
  CensusVillageRecord,
  CompositionEvidenceMethod,
  JjmVillageRecord,
  TnDistrictRefreshPlan,
  TnDistrictSourceExtract,
  TnrdLgdGramPanchayatRecord,
  TnrdMasterGramPanchayatRecord,
} from "./acquisition-model";
import {
  ATLAS_SCHEMA_VERSION,
  CENSUS_COMPOSITION_EXCLUSION_REASONS,
  CENSUS_SETTLEMENT_KINDS,
  COMPOSITION_EVIDENCE_METHODS,
  RECORD_SET_COMPLETENESS_BASES,
  RECORD_SET_COMPLETENESS_STATUSES,
} from "./acquisition-model";

export const ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export function computeArtifactSetSha256(digests: string[]): string {
  if (digests.length === 1) return digests[0];
  return createHash("sha256").update(digests.join("\n")).digest("hex");
}

export function computeRecordsSha256(records: unknown[]): string {
  return createHash("sha256")
    .update(JSON.stringify(records))
    .digest("hex");
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isValidDate(value: unknown): value is string {
  if (!isNonEmptyString(value) || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

export function validateMappingExpectation(
  raw: unknown,
  label: string,
  errors: string[],
): void {
  if (!isRecord(raw)) {
    errors.push(`${label}: must be an object`);
    return;
  }
  if (
    !isNonEmptyString(raw.status) ||
    !RECORD_SET_COMPLETENESS_STATUSES.includes(
      raw.status as (typeof RECORD_SET_COMPLETENESS_STATUSES)[number],
    )
  ) {
    errors.push(`${label}.status: invalid completeness status`);
  }
  if (
    !isNonEmptyString(raw.basis) ||
    !RECORD_SET_COMPLETENESS_BASES.includes(
      raw.basis as (typeof RECORD_SET_COMPLETENESS_BASES)[number],
    )
  ) {
    errors.push(`${label}.basis: invalid completeness basis`);
  }
  if (
    raw.expectedRecordCount !== undefined &&
    !isPositiveInteger(raw.expectedRecordCount)
  ) {
    errors.push(`${label}.expectedRecordCount: must be a positive integer`);
  }
  if (
    ["complete", "partial"].includes(String(raw.status)) &&
    raw.expectedRecordCount === undefined
  ) {
    errors.push(
      `${label}.expectedRecordCount: required for ${String(raw.status)} status`,
    );
  }
}

export function validateCensusComposition(
  raw: unknown,
  targetLgdCode: unknown,
  label: string,
  errors: string[],
): void {
  if (!isRecord(raw)) {
    errors.push(`${label}: must be an object`);
    return;
  }
  validateMappingExpectation(raw, label, errors);

  if (!Array.isArray(raw.members) || raw.members.length === 0) {
    errors.push(`${label}.members: must be a non-empty array`);
  } else {
    const memberKeys = new Set<string>();
    for (const [index, member] of raw.members.entries()) {
      const memberLabel = `${label}.members[${index}]`;
      if (!isRecord(member)) {
        errors.push(`${memberLabel}: must be an object`);
        continue;
      }
      validateStringFields(member, ["kind", "code", "name"], memberLabel, errors);
      if (
        isNonEmptyString(member.kind) &&
        !CENSUS_SETTLEMENT_KINDS.includes(
          member.kind as (typeof CENSUS_SETTLEMENT_KINDS)[number],
        )
      ) {
        errors.push(`${memberLabel}.kind: unsupported Census settlement kind`);
      }
      if (isNonEmptyString(member.kind) && isNonEmptyString(member.code)) {
        const key = `${member.kind}:${member.code}`;
        if (memberKeys.has(key)) {
          errors.push(`${label}.members: duplicate ${key}`);
        }
        memberKeys.add(key);
      }
    }

    if (
      raw.status === "complete" &&
      raw.expectedRecordCount !== raw.members.length
    ) {
      errors.push(
        `${label}.expectedRecordCount: complete composition has ` +
          `${raw.members.length} members`,
      );
    }
    if (
      raw.status === "partial" &&
      isPositiveInteger(raw.expectedRecordCount) &&
      raw.expectedRecordCount <= raw.members.length
    ) {
      errors.push(
        `${label}.expectedRecordCount: partial composition must expect more ` +
          `than ${raw.members.length} members`,
      );
    }

    if (!Array.isArray(raw.exclusions)) {
      errors.push(`${label}.exclusions: must be an array`);
    } else {
      const exclusionKeys = new Set<string>();
      for (const [index, exclusion] of raw.exclusions.entries()) {
        const exclusionLabel = `${label}.exclusions[${index}]`;
        if (!isRecord(exclusion)) {
          errors.push(`${exclusionLabel}: must be an object`);
          continue;
        }
        validateStringFields(
          exclusion,
          [
            "kind",
            "code",
            "name",
            "reason",
            "ownerLgdGramPanchayatCode",
          ],
          exclusionLabel,
          errors,
        );
        if (
          isNonEmptyString(exclusion.kind) &&
          !CENSUS_SETTLEMENT_KINDS.includes(
            exclusion.kind as (typeof CENSUS_SETTLEMENT_KINDS)[number],
          )
        ) {
          errors.push(
            `${exclusionLabel}.kind: unsupported Census settlement kind`,
          );
        }
        if (
          isNonEmptyString(exclusion.reason) &&
          !CENSUS_COMPOSITION_EXCLUSION_REASONS.includes(
            exclusion.reason as (typeof CENSUS_COMPOSITION_EXCLUSION_REASONS)[number],
          )
        ) {
          errors.push(`${exclusionLabel}.reason: unsupported exclusion reason`);
        }
        if (
          isNonEmptyString(exclusion.ownerLgdGramPanchayatCode) &&
          exclusion.ownerLgdGramPanchayatCode === targetLgdCode
        ) {
          errors.push(
            `${exclusionLabel}.ownerLgdGramPanchayatCode: must identify a ` +
              `different Panchayat`,
          );
        }
        if (
          isNonEmptyString(exclusion.kind) &&
          isNonEmptyString(exclusion.code)
        ) {
          const key = `${exclusion.kind}:${exclusion.code}`;
          if (memberKeys.has(key)) {
            errors.push(`${exclusionLabel}: cannot also be a composition member`);
          }
          if (exclusionKeys.has(key)) {
            errors.push(`${label}.exclusions: duplicate ${key}`);
          }
          exclusionKeys.add(key);
        }
      }
    }
  }

  if (!Array.isArray(raw.evidence) || raw.evidence.length === 0) {
    errors.push(`${label}.evidence: must be a non-empty array`);
  } else {
    const evidenceIds = new Set<string>();
    for (const [index, evidence] of raw.evidence.entries()) {
      const evidenceLabel = `${label}.evidence[${index}]`;
      if (!isRecord(evidence)) {
        errors.push(`${evidenceLabel}: must be an object`);
        continue;
      }
      validateStringFields(
        evidence,
        [
          "id",
          "sourceId",
          "sourceUrl",
          "sourceAsOf",
          "method",
          "locator",
          "assertion",
        ],
        evidenceLabel,
        errors,
      );
      if (!isNonEmptyString(evidence.id) || !ID_PATTERN.test(evidence.id)) {
        errors.push(`${evidenceLabel}.id: invalid identifier`);
      } else if (evidenceIds.has(evidence.id)) {
        errors.push(`${evidenceLabel}.id: duplicate ${evidence.id}`);
      } else {
        evidenceIds.add(evidence.id);
      }
      if (
        !isNonEmptyString(evidence.sourceId) ||
        !ID_PATTERN.test(evidence.sourceId)
      ) {
        errors.push(`${evidenceLabel}.sourceId: invalid identifier`);
      }
      validateUrl(evidence.sourceUrl, `${evidenceLabel}.sourceUrl`, errors);
      if (
        !COMPOSITION_EVIDENCE_METHODS.includes(
          evidence.method as CompositionEvidenceMethod,
        )
      ) {
        errors.push(`${evidenceLabel}.method: unsupported value`);
      }
    }
  }
}

export function validateUrl(value: unknown, label: string, errors: string[]): void {
  if (!isNonEmptyString(value)) {
    errors.push(`${label}: must be a non-empty URL`);
    return;
  }
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) {
      errors.push(`${label}: only http/https URLs are supported`);
    }
  } catch {
    errors.push(`${label}: invalid URL`);
  }
}

export function validateStringFields(
  record: Record<string, unknown>,
  fields: string[],
  label: string,
  errors: string[],
): void {
  for (const field of fields) {
    if (!isNonEmptyString(record[field])) {
      errors.push(`${label}.${field}: must be a non-empty string`);
    }
  }
}

function validateTargets(
  raw: unknown,
  errors: string[],
): TnDistrictRefreshPlan["targets"] {
  if (!Array.isArray(raw) || raw.length === 0) {
    errors.push("targets: must be a non-empty array");
    return [];
  }
  const ids = new Set<string>();
  const lgdCodes = new Set<string>();
  const targets: TnDistrictRefreshPlan["targets"] = [];
  for (const [index, target] of raw.entries()) {
    const label = `targets[${index}]`;
    if (!isRecord(target)) {
      errors.push(`${label}: must be an object`);
      continue;
    }
    if (!isNonEmptyString(target.id) || !ID_PATTERN.test(target.id)) {
      errors.push(`${label}.id: invalid identifier`);
    } else if (ids.has(target.id)) {
      errors.push(`${label}.id: duplicate ${target.id}`);
    } else {
      ids.add(target.id);
    }
    if (!isValidDate(target.reviewedAt)) {
      errors.push(`${label}.reviewedAt: must be a valid date`);
    }
    validateStringFields(
      target,
      [
        "displayName",
        "tnrdLgdGramPanchayatCode",
        "tnrdMasterBlockCode",
        "tnrdMasterGramPanchayatCode",
        "jjmBlockId",
        "jjmGramPanchayatId",
        "censusSubdistrictCode",
        "censusGramPanchayatCode",
      ],
      label,
      errors,
    );
    if (!isRecord(target.mappingExpectations)) {
      errors.push(`${label}.mappingExpectations: must be an object`);
    } else {
      validateMappingExpectation(
        target.mappingExpectations.jjm,
        `${label}.mappingExpectations.jjm`,
        errors,
      );
      validateMappingExpectation(
        target.mappingExpectations.census,
        `${label}.mappingExpectations.census`,
        errors,
      );
    }
    validateCensusComposition(
      target.censusComposition,
      target.tnrdLgdGramPanchayatCode,
      `${label}.censusComposition`,
      errors,
    );
    if (isNonEmptyString(target.tnrdLgdGramPanchayatCode)) {
      if (lgdCodes.has(target.tnrdLgdGramPanchayatCode)) {
        errors.push(
          `${label}.tnrdLgdGramPanchayatCode: duplicate ` +
            target.tnrdLgdGramPanchayatCode,
        );
      }
      lgdCodes.add(target.tnrdLgdGramPanchayatCode);
    }
    targets.push(target as unknown as TnDistrictRefreshPlan["targets"][number]);
  }
  return targets;
}

export function validateTnDistrictRefreshPlan(raw: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(raw)) return ["refresh plan: root must be an object"];
  if (raw.schemaVersion !== ATLAS_SCHEMA_VERSION) {
    errors.push(`schemaVersion: expected ${ATLAS_SCHEMA_VERSION}`);
  }
  if (!isNonEmptyString(raw.id) || !ID_PATTERN.test(raw.id)) {
    errors.push("id: invalid identifier");
  }
  if (!isRecord(raw.district)) {
    errors.push("district: must be an object");
  } else {
    validateStringFields(
      raw.district,
      [
        "displayName",
        "tnrdLgdCode",
        "tnrdMasterCode",
        "jjmStateId",
        "jjmDistrictId",
        "censusDistrictCode",
        // The taluk layer keys on LGD district codes while the Panchayat layer
        // keys on TNRD codes, and IN-GRES keys on a name. Every one of them
        // lives here so a new district is described once, not rediscovered at
        // each command line.
        "lgdDistrictCode",
        "ingresDistrictName",
        "ingresStateUuid",
      ],
      "district",
      errors,
    );
    const subdistricts = raw.district.censusSubdistrictCodes;
    if (subdistricts !== undefined) {
      if (
        !Array.isArray(subdistricts) ||
        subdistricts.length === 0 ||
        !subdistricts.every((code) => typeof code === "string" && /^\d{5}$/.test(code))
      ) {
        errors.push(
          "district.censusSubdistrictCodes: must be a non-empty array of five-digit Census subdistrict codes",
        );
      } else if (new Set(subdistricts).size !== subdistricts.length) {
        errors.push("district.censusSubdistrictCodes: duplicate subdistrict code");
      }
    }
  }
  if (!isRecord(raw.sources)) {
    errors.push("sources: must be an object");
  } else {
    for (const sourceName of ["tnrdLgdPdf", "tnrdMaster", "jjm", "census"]) {
      const source = raw.sources[sourceName];
      if (!isRecord(source)) {
        errors.push(`sources.${sourceName}: must be an object`);
        continue;
      }
      validateUrl(source.url, `sources.${sourceName}.url`, errors);
      if (
        ["tnrdLgdPdf", "census"].includes(sourceName) &&
        !isNonEmptyString(source.sourceAsOf)
      ) {
        errors.push(`sources.${sourceName}.sourceAsOf: must be non-empty`);
      }
    }
  }
  if (!isRecord(raw.expectedCounts)) {
    errors.push("expectedCounts: must be an object");
  } else {
    for (const field of [
      "tnrdLgdGramPanchayats",
      "tnrdMasterBlocks",
      "tnrdMasterGramPanchayats",
      "jjmVillages",
      "censusVillages",
    ]) {
      if (!isPositiveInteger(raw.expectedCounts[field])) {
        errors.push(`expectedCounts.${field}: must be a positive integer`);
      }
    }
  }
  validateTargets(raw.targets, errors);
  return errors;
}

type RecordValidator<T> = (
  raw: Record<string, unknown>,
  label: string,
  errors: string[],
) => T;

export function validateAcquiredSource<T>(
  raw: unknown,
  label: string,
  validateRecord: RecordValidator<T>,
  errors: string[],
): AcquiredSourceRecordSet<T> | null {
  if (!isRecord(raw)) {
    errors.push(`${label}: must be an object`);
    return null;
  }
  validateStringFields(raw, ["sourceId", "sourceAsOf"], label, errors);
  if (!isNonEmptyString(raw.sourceId) || !ID_PATTERN.test(raw.sourceId)) {
    errors.push(`${label}.sourceId: invalid identifier`);
  }
  validateUrl(raw.sourceUrl, `${label}.sourceUrl`, errors);
  if (!isValidDate(raw.retrievedAt)) {
    errors.push(`${label}.retrievedAt: must be a valid date`);
  }
  if ("reusedCachedArtifact" in raw && raw.reusedCachedArtifact !== true) {
    errors.push(`${label}.reusedCachedArtifact: when present it must be exactly true`);
  }
  if (!isNonEmptyString(raw.snapshotSha256) || !SHA256_PATTERN.test(raw.snapshotSha256)) {
    errors.push(`${label}.snapshotSha256: must be a lowercase SHA-256`);
  }
  if (!isNonEmptyString(raw.recordsSha256) || !SHA256_PATTERN.test(raw.recordsSha256)) {
    errors.push(`${label}.recordsSha256: must be a lowercase SHA-256`);
  }
  if (
    !Array.isArray(raw.artifactSha256s) ||
    raw.artifactSha256s.length === 0 ||
    !raw.artifactSha256s.every(
      (value) => isNonEmptyString(value) && SHA256_PATTERN.test(value),
    )
  ) {
    errors.push(`${label}.artifactSha256s: must be a non-empty SHA-256 array`);
  } else if (
    isNonEmptyString(raw.snapshotSha256) &&
    SHA256_PATTERN.test(raw.snapshotSha256)
  ) {
    const expectedDigest = computeArtifactSetSha256(raw.artifactSha256s);
    if (raw.snapshotSha256 !== expectedDigest) {
      errors.push(
        `${label}.snapshotSha256: expected ${expectedDigest}, got ` +
          raw.snapshotSha256,
      );
    }
  }
  if (!Array.isArray(raw.records) || raw.records.length === 0) {
    errors.push(`${label}.records: must be a non-empty array`);
    return null;
  }
  const records: T[] = [];
  for (const [index, record] of raw.records.entries()) {
    const recordLabel = `${label}.records[${index}]`;
    if (!isRecord(record)) {
      errors.push(`${recordLabel}: must be an object`);
      continue;
    }
    records.push(validateRecord(record, recordLabel, errors));
  }
  if (!isPositiveInteger(raw.recordCount)) {
    errors.push(`${label}.recordCount: must be a positive integer`);
  } else if (raw.recordCount !== raw.records.length) {
    errors.push(
      `${label}.recordCount: expected ${raw.records.length}, got ${raw.recordCount}`,
    );
  }
  if (
    isNonEmptyString(raw.recordsSha256) &&
    SHA256_PATTERN.test(raw.recordsSha256)
  ) {
    const expectedDigest = computeRecordsSha256(records);
    if (raw.recordsSha256 !== expectedDigest) {
      errors.push(
        `${label}.recordsSha256: expected ${expectedDigest}, got ` +
          raw.recordsSha256,
      );
    }
  }
  return { ...(raw as unknown as AcquiredSourceRecordSet<T>), records };
}

function validateTnrdLgdRecord(
  raw: Record<string, unknown>,
  label: string,
  errors: string[],
): TnrdLgdGramPanchayatRecord {
  validateStringFields(
    raw,
    [
      "districtCode",
      "districtName",
      "blockCode",
      "blockName",
      "gramPanchayatCode",
      "gramPanchayatName",
    ],
    label,
    errors,
  );
  return raw as unknown as TnrdLgdGramPanchayatRecord;
}

function validateTnrdMasterRecord(
  raw: Record<string, unknown>,
  label: string,
  errors: string[],
): TnrdMasterGramPanchayatRecord {
  validateStringFields(
    raw,
    [
      "districtLocalCode",
      "districtName",
      "blockLocalCode",
      "blockName",
      "gramPanchayatLocalCode",
      "gramPanchayatName",
    ],
    label,
    errors,
  );
  return raw as unknown as TnrdMasterGramPanchayatRecord;
}

export function validateJjmRecord(
  raw: Record<string, unknown>,
  label: string,
  errors: string[],
): JjmVillageRecord {
  validateStringFields(
    raw,
    [
      "stateId",
      "districtId",
      "blockId",
      "blockName",
      "gpId",
      "gpName",
      "villageId",
      "villageName",
    ],
    label,
    errors,
  );
  return raw as unknown as JjmVillageRecord;
}

export function validateCensusRecord(
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
    if (!Array.isArray(values) || values.length === 0) {
      errors.push(`${label}.${field}: must be a non-empty array`);
      continue;
    }
    const codes = new Set<string>();
    for (const [index, value] of values.entries()) {
      if (!isRecord(value)) {
        errors.push(`${label}.${field}[${index}]: must be an object`);
        continue;
      }
      validateStringFields(value, ["code", "name"], `${label}.${field}[${index}]`, errors);
      if (isNonEmptyString(value.code)) {
        if (codes.has(value.code)) {
          errors.push(`${label}.${field}: duplicate code ${value.code}`);
        }
        codes.add(value.code);
      }
    }
  }
  return raw as unknown as CensusVillageRecord;
}

export function validateUniqueValues(
  records: Array<Record<string, string>>,
  fields: string[],
  label: string,
  errors: string[],
): void {
  const seen = new Set<string>();
  for (const record of records) {
    const value = fields.map((field) => record[field]).join("/");
    if (seen.has(value)) {
      errors.push(`${label}: duplicate ${fields.join("+")} ${value}`);
    }
    seen.add(value);
  }
}

export function validateTnDistrictSourceExtract(raw: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(raw)) return ["source extract: root must be an object"];
  if (raw.schemaVersion !== ATLAS_SCHEMA_VERSION) {
    errors.push(`schemaVersion: expected ${ATLAS_SCHEMA_VERSION}`);
  }
  if (!isNonEmptyString(raw.planId) || !ID_PATTERN.test(raw.planId)) {
    errors.push("planId: invalid identifier");
  }
  if (!isValidDate(raw.acquiredAt)) {
    errors.push("acquiredAt: must be a valid date");
  }
  if (!isRecord(raw.sources)) {
    errors.push("sources: must be an object");
    return errors;
  }
  const tnrdLgd = validateAcquiredSource(
    raw.sources.tnrdLgd,
    "sources.tnrdLgd",
    validateTnrdLgdRecord,
    errors,
  );
  const tnrdMaster = validateAcquiredSource(
    raw.sources.tnrdMaster,
    "sources.tnrdMaster",
    validateTnrdMasterRecord,
    errors,
  );
  const jjm = validateAcquiredSource(
    raw.sources.jjm,
    "sources.jjm",
    validateJjmRecord,
    errors,
  );
  const census = validateAcquiredSource(
    raw.sources.census,
    "sources.census",
    validateCensusRecord,
    errors,
  );
  const sources: Array<[string, AcquiredSourceRecordSet<unknown> | null]> = [
    ["tnrdLgd", tnrdLgd],
    ["tnrdMaster", tnrdMaster],
    ["jjm", jjm],
    ["census", census],
  ];
  for (const [name, source] of sources) {
    if (source === null) continue;
    if (source.reusedCachedArtifact === true) {
      // A CLOSED source reused from the content-addressed cache keeps its
      // original retrieval date; the flag is the explicit licence for the
      // dates to differ, and a reused artifact can never postdate the run.
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
  if (tnrdLgd) {
    if (tnrdLgd.sourceId !== "tnrd-lgd-village-panchayat-list") {
      errors.push(
        "sources.tnrdLgd.sourceId: expected tnrd-lgd-village-panchayat-list",
      );
    }
    validateUniqueValues(
      tnrdLgd.records as unknown as Array<Record<string, string>>,
      ["gramPanchayatCode"],
      "sources.tnrdLgd.records",
      errors,
    );
  }
  if (
    tnrdMaster &&
    tnrdMaster.sourceId !== "tnrd-current-panchayat-master"
  ) {
    errors.push(
      "sources.tnrdMaster.sourceId: expected tnrd-current-panchayat-master",
    );
  }
  if (tnrdMaster) {
    validateUniqueValues(
      tnrdMaster.records as unknown as Array<Record<string, string>>,
      ["blockLocalCode", "gramPanchayatLocalCode"],
      "sources.tnrdMaster.records",
      errors,
    );
  }
  if (jjm) {
    if (jjm.sourceId !== "jjm-citizen-corner") {
      errors.push("sources.jjm.sourceId: expected jjm-citizen-corner");
    }
    validateUniqueValues(
      jjm.records as unknown as Array<Record<string, string>>,
      ["blockId", "gpId", "villageId"],
      "sources.jjm.records",
      errors,
    );
  }
  if (census) {
    if (census.sourceId !== "census-2011-village-amenities") {
      errors.push(
        "sources.census.sourceId: expected census-2011-village-amenities",
      );
    }
    validateUniqueValues(
      census.records as unknown as Array<Record<string, string>>,
      ["villageCode"],
      "sources.census.records",
      errors,
    );
  }
  return errors;
}

export function loadTnDistrictRefreshPlan(path: string): TnDistrictRefreshPlan {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  const errors = validateTnDistrictRefreshPlan(parsed);
  if (errors.length > 0) {
    throw new Error(`Invalid TN district refresh plan:\n- ${errors.join("\n- ")}`);
  }
  return parsed as TnDistrictRefreshPlan;
}

export function loadTnDistrictSourceExtract(path: string): TnDistrictSourceExtract {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  const errors = validateTnDistrictSourceExtract(parsed);
  if (errors.length > 0) {
    throw new Error(`Invalid TN district source extract:\n- ${errors.join("\n- ")}`);
  }
  return parsed as TnDistrictSourceExtract;
}
