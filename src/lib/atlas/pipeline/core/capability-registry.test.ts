import assert from "node:assert/strict";
import test from "node:test";

import {
  validateAdequacyProfileV2,
  villageWaterProfileV2,
} from "./capability-assessment";
import { capabilityRegistry, validateCapabilityIds, validateCapabilityRegistry } from "./capability-registry";

test("the bundled capability vocabulary validates", () => {
  assert.deepEqual(validateCapabilityRegistry(capabilityRegistry), []);
  assert.equal(capabilityRegistry.id, "atlas-capabilities-v2");
  const active = capabilityRegistry.capabilities.filter((entry) => entry.status === "active");
  const legacy = capabilityRegistry.capabilities.filter((entry) => entry.status === "legacy");
  assert.equal(active.length, 40);
  assert.equal(legacy.length, 8);
  for (const entry of legacy) {
    assert.ok(entry.replacementIds && entry.replacementIds.length > 0, `${entry.id} names its replacement`);
  }
});

test("the village water profile assesses exactly the forty active capabilities", () => {
  assert.deepEqual(validateAdequacyProfileV2(villageWaterProfileV2), []);
  assert.equal(villageWaterProfileV2.requirements.length, 40);
  const activeIds = new Set(
    capabilityRegistry.capabilities.filter((e) => e.status === "active").map((e) => e.id),
  );
  assert.deepEqual(new Set(villageWaterProfileV2.requirements.map((r) => r.capabilityId)), activeIds);
  assert.deepEqual(
    validateCapabilityIds(
      capabilityRegistry,
      villageWaterProfileV2.requirements.map((r) => ({ id: r.capabilityId, label: r.id })),
      { activeOnly: true },
    ),
    [],
  );
});

test("profile validation rejects unknown fields, duplicate capabilities, legacy ids and cycles", () => {
  const base = structuredClone(villageWaterProfileV2) as unknown as Record<string, unknown>;
  const unknown = { ...base, extra: true };
  assert.ok(validateAdequacyProfileV2(unknown).some((e) => e.includes("unsupported property")));

  const duplicate = structuredClone(villageWaterProfileV2);
  duplicate.requirements[1].capabilityId = duplicate.requirements[0].capabilityId;
  assert.ok(validateAdequacyProfileV2(duplicate).some((e) => e.includes("duplicate")));

  const legacyId = capabilityRegistry.capabilities.find((e) => e.status === "legacy")!.id;
  const legacy = structuredClone(villageWaterProfileV2);
  legacy.requirements[0].capabilityId = legacyId;
  assert.ok(validateAdequacyProfileV2(legacy).some((e) => e.includes("is legacy")));

  const cyclic = structuredClone(villageWaterProfileV2);
  cyclic.requirements[0].dependencyIds = [cyclic.requirements[1].id];
  cyclic.requirements[1].dependencyIds = [cyclic.requirements[0].id];
  assert.ok(validateAdequacyProfileV2(cyclic).some((e) => e.includes("dependency cycle")));
});
