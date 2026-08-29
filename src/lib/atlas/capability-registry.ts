import { readFileSync } from "node:fs";

import registryJson from "./capabilities.json";

export const CAPABILITY_REGISTRY_SCHEMA_VERSION = 1;

export interface CapabilityRegistryEntry {
  id: string;
  status: "active" | "legacy";
  vocabularyVersion: "v1" | "v2";
  replacementIds?: string[];
}

export interface CapabilityRegistry {
  schemaVersion: 1;
  id: "atlas-capabilities-v2";
  capabilities: CapabilityRegistryEntry[];
}

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateCapabilityRegistry(raw: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(raw)) return ["capability registry: root must be an object"];
  if (raw.schemaVersion !== CAPABILITY_REGISTRY_SCHEMA_VERSION) {
    errors.push(
      `schemaVersion: expected ${CAPABILITY_REGISTRY_SCHEMA_VERSION}`,
    );
  }
  if (raw.id !== "atlas-capabilities-v2") {
    errors.push("id: expected atlas-capabilities-v2");
  }
  if (!Array.isArray(raw.capabilities) || raw.capabilities.length === 0) {
    errors.push("capabilities: must be a non-empty array");
    return errors;
  }

  const ids = new Set<string>();
  const activeIds = new Set<string>();
  const legacyEntries: Array<{
    index: number;
    replacementIds: unknown;
  }> = [];
  for (const [index, entry] of raw.capabilities.entries()) {
    const label = `capabilities[${index}]`;
    if (!isRecord(entry)) {
      errors.push(`${label}: must be an object`);
      continue;
    }
    if (typeof entry.id !== "string" || !ID_PATTERN.test(entry.id)) {
      errors.push(`${label}.id: invalid identifier`);
    } else if (ids.has(entry.id)) {
      errors.push(`${label}.id: duplicate ${entry.id}`);
    } else {
      ids.add(entry.id);
      if (entry.status === "active") activeIds.add(entry.id);
    }
    if (!["active", "legacy"].includes(String(entry.status))) {
      errors.push(`${label}.status: expected active or legacy`);
    }
    if (!["v1", "v2"].includes(String(entry.vocabularyVersion))) {
      errors.push(`${label}.vocabularyVersion: expected v1 or v2`);
    }
    if (entry.status === "active") {
      if (entry.vocabularyVersion !== "v2") {
        errors.push(`${label}.vocabularyVersion: active entries must be v2`);
      }
      if (entry.replacementIds !== undefined) {
        errors.push(`${label}.replacementIds: active entries cannot declare replacements`);
      }
    }
    if (entry.status === "legacy") {
      if (entry.vocabularyVersion !== "v1") {
        errors.push(`${label}.vocabularyVersion: legacy entries must be v1`);
      }
      legacyEntries.push({ index, replacementIds: entry.replacementIds });
    }
  }

  for (const entry of legacyEntries) {
    const label = `capabilities[${entry.index}].replacementIds`;
    if (
      !Array.isArray(entry.replacementIds) ||
      entry.replacementIds.length === 0 ||
      !entry.replacementIds.every(
        (replacement) =>
          typeof replacement === "string" && ID_PATTERN.test(replacement),
      )
    ) {
      errors.push(`${label}: must be a non-empty identifier array`);
      continue;
    }
    if (new Set(entry.replacementIds).size !== entry.replacementIds.length) {
      errors.push(`${label}: values must be unique`);
    }
    for (const replacementId of entry.replacementIds) {
      if (!activeIds.has(replacementId)) {
        errors.push(`${label}: ${replacementId} is not an active capability`);
      }
    }
  }
  return errors;
}

export function validateCapabilityIds(
  registry: CapabilityRegistry,
  references: Array<{ id: unknown; label: string }>,
  options: { activeOnly: boolean },
): string[] {
  const statuses = new Map(
    registry.capabilities.map((entry) => [entry.id, entry.status]),
  );
  const errors: string[] = [];
  for (const reference of references) {
    if (typeof reference.id !== "string" || !ID_PATTERN.test(reference.id)) {
      continue;
    }
    const status = statuses.get(reference.id);
    if (!status) {
      errors.push(`${reference.label}: unregistered capability ${reference.id}`);
    } else if (options.activeOnly && status !== "active") {
      errors.push(
        `${reference.label}: ${reference.id} is legacy; use an active v2 capability`,
      );
    }
  }
  return errors;
}

export function loadCapabilityRegistry(path: string): CapabilityRegistry {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  const errors = validateCapabilityRegistry(parsed);
  if (errors.length > 0) {
    throw new Error(`Invalid capability registry:\n- ${errors.join("\n- ")}`);
  }
  return parsed as CapabilityRegistry;
}

export const capabilityRegistry = registryJson as CapabilityRegistry;
