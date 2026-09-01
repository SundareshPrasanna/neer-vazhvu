import { readFileSync } from "node:fs";

import profileJson from "./village-water-profile-v2.json";

import {
  capabilityRegistry,
  validateCapabilityIds,
  validateCapabilityRegistry,
} from "./capability-registry";

/**
 * Place kinds a profile may target. Only gram-panchayat is used today; the
 * list is the model's vocabulary (place-water-system-model.md) kept in full so
 * a profile for a block or a village validates the same way.
 */
export const PLACE_KINDS = [
  "country",
  "state",
  "region",
  "district",
  "city",
  "municipal-corporation",
  "municipality",
  "town-panchayat",
  "census-town",
  "subdistrict",
  "block",
  "gram-panchayat",
  "village",
  "habitation",
  "ward",
  "locality",
  "basin",
  "sub-basin",
  "watershed",
  "assessment-unit",
  "aquifer",
  "revenue-circle",
  "station",
  "grid-cell",
  "reservoir-system",
] as const;

export type PlaceKind = (typeof PLACE_KINDS)[number];

export const CAPABILITY_PROFILE_V2_SCHEMA_VERSION = 2;

export const CAPABILITY_OBLIGATIONS = [
  "core",
  "conditional",
  "enrichment",
] as const;
export type CapabilityObligation = (typeof CAPABILITY_OBLIGATIONS)[number];

export const POSITIVE_EVIDENCE_POLICIES = [
  "required-for-launch",
  "required-for-spatial-mode",
  "not-required-for-launch",
] as const;
export type PositiveEvidencePolicy = (typeof POSITIVE_EVIDENCE_POLICIES)[number];

export const APPLICABILITY_POLICIES = ["always", "evaluate"] as const;
export type ApplicabilityPolicy = (typeof APPLICABILITY_POLICIES)[number];

export const EVIDENCE_LOCALITY_CLASSES = [
  "direct-place",
  "within-place",
  "connected-system",
  "containing-area",
  "nearby-observation",
  "derived-place",
] as const;
export type EvidenceLocalityClass = (typeof EVIDENCE_LOCALITY_CLASSES)[number];

export const PROJECTION_METHODS = [
  "direct-published",
  "identifier-crosswalk",
  "spatial-intersection",
  "area-weighted",
  "station-assignment",
  "interpolation",
  "service-relation",
  "administrative-rollup",
  "administrative-proxy",
  "expert-mapped",
] as const;
export type ProjectionMethod = (typeof PROJECTION_METHODS)[number];

export const APPLICABILITY_STATES = [
  "applicable",
  "not-applicable",
  "not-assessed",
] as const;
export type ApplicabilityState = (typeof APPLICABILITY_STATES)[number];

export const CAPABILITY_ASSESSMENT_STATES = [
  "adequate",
  "unavailable",
  "not-applicable",
  "not-assessed",
] as const;
export type CapabilityAssessmentState =
  (typeof CAPABILITY_ASSESSMENT_STATES)[number];

export interface AdequacyRequirementV2 {
  id: string;
  capabilityId: string;
  obligation: CapabilityObligation;
  positiveEvidencePolicy: PositiveEvidencePolicy;
  applicabilityPolicy: ApplicabilityPolicy;
  acceptableLocalityClasses: EvidenceLocalityClass[];
  acceptableProjectionMethods: ProjectionMethod[];
  dependencyIds?: string[];
  maxEvidenceAgeDays?: number;
}

export interface AdequacyProfileV2 {
  schemaVersion: 2;
  id: string;
  title: string;
  targetKinds: PlaceKind[];
  requirements: AdequacyRequirementV2[];
}

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const PROFILE_KEYS = new Set([
  "schemaVersion",
  "id",
  "title",
  "targetKinds",
  "requirements",
]);
const PROFILE_REQUIREMENT_KEYS = new Set([
  "id",
  "capabilityId",
  "obligation",
  "positiveEvidencePolicy",
  "applicabilityPolicy",
  "acceptableLocalityClasses",
  "acceptableProjectionMethods",
  "dependencyIds",
  "maxEvidenceAgeDays",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isKnownValue<const T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function isValidId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

function validateKnownKeys(
  value: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
  label: string,
  errors: string[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      errors.push(`${label}: unsupported property ${JSON.stringify(key)}`);
    }
  }
}

function validateUniqueIdArray(
  value: unknown,
  label: string,
  errors: string[],
  allowEmpty = false,
): value is string[] {
  if (
    !Array.isArray(value) ||
    (!allowEmpty && value.length === 0) ||
    !value.every(isValidId)
  ) {
    errors.push(
      `${label}: must be ${allowEmpty ? "an" : "a non-empty"} identifier array`,
    );
    return false;
  }
  if (new Set(value).size !== value.length) {
    errors.push(`${label}: values must be unique`);
  }
  return true;
}

function validateKnownUniqueArray<const T extends readonly string[]>(
  value: unknown,
  knownValues: T,
  label: string,
  errors: string[],
): value is T[number][] {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${label}: must be a non-empty array`);
    return false;
  }
  const known: T[number][] = [];
  for (const item of value) {
    if (!isKnownValue(knownValues, item)) {
      errors.push(`${label}: unsupported value ${JSON.stringify(item)}`);
    } else {
      known.push(item);
    }
  }
  if (new Set(value).size !== value.length) {
    errors.push(`${label}: values must be unique`);
  }
  return known.length === value.length;
}

export function validateAdequacyProfileV2(raw: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(raw)) return ["profile: root must be an object"];
  errors.push(
    ...validateCapabilityRegistry(capabilityRegistry).map(
      (error) => `capabilityRegistry: ${error}`,
    ),
  );
  validateKnownKeys(raw, PROFILE_KEYS, "profile", errors);

  if (raw.schemaVersion !== CAPABILITY_PROFILE_V2_SCHEMA_VERSION) {
    errors.push(
      `profile.schemaVersion: expected ${CAPABILITY_PROFILE_V2_SCHEMA_VERSION}`,
    );
  }
  if (!isValidId(raw.id)) errors.push("profile.id: must be a valid identifier");
  if (typeof raw.title !== "string" || raw.title.trim().length === 0) {
    errors.push("profile.title: must be a non-empty string");
  }
  if (
    !Array.isArray(raw.targetKinds) ||
    raw.targetKinds.length === 0 ||
    !raw.targetKinds.every((kind) => isKnownValue(PLACE_KINDS, kind))
  ) {
    errors.push("profile.targetKinds: must be a non-empty known place-kind array");
  } else if (new Set(raw.targetKinds).size !== raw.targetKinds.length) {
    errors.push("profile.targetKinds: values must be unique");
  }

  if (!Array.isArray(raw.requirements) || raw.requirements.length === 0) {
    errors.push("profile.requirements: must be a non-empty array");
    return errors;
  }

  const requirementIds = new Set<string>();
  const capabilityIds = new Set<string>();
  for (const [index, requirement] of raw.requirements.entries()) {
    const label = `profile.requirements[${index}]`;
    if (!isRecord(requirement)) {
      errors.push(`${label}: must be an object`);
      continue;
    }
    validateKnownKeys(requirement, PROFILE_REQUIREMENT_KEYS, label, errors);
    if (!isValidId(requirement.id)) {
      errors.push(`${label}.id: must be a valid identifier`);
    } else if (requirementIds.has(requirement.id)) {
      errors.push(`${label}.id: duplicate ${requirement.id}`);
    } else {
      requirementIds.add(requirement.id);
    }
    if (!isValidId(requirement.capabilityId)) {
      errors.push(`${label}.capabilityId: must be a valid identifier`);
    } else if (capabilityIds.has(requirement.capabilityId)) {
      errors.push(`${label}.capabilityId: duplicate ${requirement.capabilityId}`);
    } else {
      capabilityIds.add(requirement.capabilityId);
    }
    errors.push(
      ...validateCapabilityIds(
        capabilityRegistry,
        [{ id: requirement.capabilityId, label: `${label}.capabilityId` }],
        { activeOnly: true },
      ),
    );
    if (!isKnownValue(CAPABILITY_OBLIGATIONS, requirement.obligation)) {
      errors.push(
        `${label}.obligation: unsupported value ${JSON.stringify(requirement.obligation)}`,
      );
    }
    if (
      !isKnownValue(
        POSITIVE_EVIDENCE_POLICIES,
        requirement.positiveEvidencePolicy,
      )
    ) {
      errors.push(
        `${label}.positiveEvidencePolicy: unsupported value ` +
          JSON.stringify(requirement.positiveEvidencePolicy),
      );
    }
    if (
      !isKnownValue(APPLICABILITY_POLICIES, requirement.applicabilityPolicy)
    ) {
      errors.push(
        `${label}.applicabilityPolicy: unsupported value ` +
          JSON.stringify(requirement.applicabilityPolicy),
      );
    }
    validateKnownUniqueArray(
      requirement.acceptableLocalityClasses,
      EVIDENCE_LOCALITY_CLASSES,
      `${label}.acceptableLocalityClasses`,
      errors,
    );
    validateKnownUniqueArray(
      requirement.acceptableProjectionMethods,
      PROJECTION_METHODS,
      `${label}.acceptableProjectionMethods`,
      errors,
    );
    const dependencyIds = requirement.dependencyIds;
    if (dependencyIds !== undefined) {
      validateUniqueIdArray(
        dependencyIds,
        `${label}.dependencyIds`,
        errors,
      );
      if (
        typeof requirement.id === "string" &&
        Array.isArray(dependencyIds) &&
        dependencyIds.includes(requirement.id)
      ) {
        errors.push(`${label}.dependencyIds: requirement cannot depend on itself`);
      }
    }
    if (
      requirement.maxEvidenceAgeDays !== undefined &&
      (!Number.isInteger(requirement.maxEvidenceAgeDays) ||
        Number(requirement.maxEvidenceAgeDays) < 0)
    ) {
      errors.push(`${label}.maxEvidenceAgeDays: must be a non-negative integer`);
    }
  }

  for (const [index, requirement] of raw.requirements.entries()) {
    if (!isRecord(requirement) || !Array.isArray(requirement.dependencyIds)) {
      continue;
    }
    for (const dependencyId of requirement.dependencyIds) {
      if (typeof dependencyId === "string" && !requirementIds.has(dependencyId)) {
        errors.push(
          `profile.requirements[${index}].dependencyIds: unknown requirement ` +
            dependencyId,
        );
      }
    }
  }

  const dependencies = new Map<string, string[]>();
  for (const requirement of raw.requirements) {
    if (
      isRecord(requirement) &&
      typeof requirement.id === "string" &&
      requirementIds.has(requirement.id) &&
      Array.isArray(requirement.dependencyIds)
    ) {
      dependencies.set(
        requirement.id,
        requirement.dependencyIds.filter(
          (dependencyId): dependencyId is string =>
            typeof dependencyId === "string" && requirementIds.has(dependencyId),
        ),
      );
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (requirementId: string, path: string[]): void => {
    if (visiting.has(requirementId)) {
      const cycleStart = path.indexOf(requirementId);
      const cycle = [...path.slice(cycleStart), requirementId];
      errors.push(`profile.requirements: dependency cycle ${cycle.join(" -> ")}`);
      return;
    }
    if (visited.has(requirementId)) return;
    visiting.add(requirementId);
    for (const dependencyId of dependencies.get(requirementId) ?? []) {
      visit(dependencyId, [...path, requirementId]);
    }
    visiting.delete(requirementId);
    visited.add(requirementId);
  };
  for (const requirementId of requirementIds) visit(requirementId, []);

  return errors;
}

export function loadAdequacyProfileV2(path: string): AdequacyProfileV2 {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  const errors = validateAdequacyProfileV2(parsed);
  if (errors.length > 0) {
    throw new Error(`Invalid Atlas v2 adequacy profile:\n- ${errors.join("\n- ")}`);
  }
  return parsed as AdequacyProfileV2;
}

/** The one profile the Atlas assesses against: 40 v2 capabilities. */
export const villageWaterProfileV2 = ((): AdequacyProfileV2 => {
  const errors = validateAdequacyProfileV2(profileJson);
  if (errors.length > 0) {
    throw new Error(`Invalid bundled adequacy profile:\n- ${errors.join("\n- ")}`);
  }
  return profileJson as AdequacyProfileV2;
})();
