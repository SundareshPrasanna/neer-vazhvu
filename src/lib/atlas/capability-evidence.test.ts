import assert from "node:assert/strict";
import test from "node:test";

import type { AssessmentsShard } from "./artifacts";
import { villageWaterProfileV2 } from "./capability-assessment";
import {
  CAPABILITY_RULES,
  EVIDENCE_GENERATOR_VERSION,
  generateCapabilityAssessment,
} from "./capability-evidence";
import type { PlaceEvidenceInputs, RequirementPolicy } from "./capability-evidence";
import { FIXTURE_DISTRICTS, readFixture } from "./test-support";

const profile = villageWaterProfileV2;
const policies: RequirementPolicy[] = profile.requirements.map((requirement) => ({
  id: requirement.id,
  applicabilityPolicy: requirement.applicabilityPolicy,
}));

const emptyInputs: PlaceEvidenceInputs = {
  lgdGramPanchayatCode: "228400",
  lgdGramPanchayatName: "Poondi",
  identity: undefined,
  boundary: undefined,
  jjm: undefined,
  census: undefined,
  groundwater: undefined,
  rainfall: undefined,
  rainfallWindow: undefined,
  waterBodies: undefined,
};

test("a place with no acquired evidence claims nothing", () => {
  const assessment = generateCapabilityAssessment({
    profileId: profile.id,
    requirements: policies,
    inputs: emptyInputs,
    assessedAt: "2026-07-25",
    placeId: "228400",
  });
  assert.equal(assessment.summary.adequate, 0);
  assert.equal(assessment.generatorVersion, EVIDENCE_GENERATOR_VERSION);
  for (const requirement of assessment.requirements) {
    assert.equal(requirement.evidence.length, 0);
    assert.notEqual(requirement.state, "adequate");
  }
});

test("an undetermined applicability is not reported as a gap", () => {
  const assessment = generateCapabilityAssessment({
    profileId: profile.id,
    requirements: policies,
    inputs: emptyInputs,
    assessedAt: "2026-07-25",
    placeId: "228400",
  });
  const coastal = assessment.requirements.find((r) => r.requirementId === "coastal-and-estuarine");
  assert.equal(coastal?.applicability, "not-assessed");
  assert.equal(coastal?.state, "not-assessed");
  const identity = assessment.requirements.find((r) => r.requirementId === "place-identity-and-composition");
  assert.equal(identity?.applicability, "applicable");
  assert.equal(identity?.state, "unavailable");
});

test("a rule returns null rather than inventing evidence", () => {
  for (const [capabilityId, rule] of Object.entries(CAPABILITY_RULES)) {
    assert.equal(rule(emptyInputs, "2026-07-25"), null, `${capabilityId} invented evidence from nothing`);
  }
});

for (const fixture of FIXTURE_DISTRICTS) {
  const shard = readFixture<AssessmentsShard>(fixture.slug, "assessments", `${fixture.block}.json`);

  test(`${fixture.slug}: served evidence conforms to each requirement's own locality and projection`, () => {
    const byId = new Map(profile.requirements.map((requirement) => [requirement.id, requirement]));
    assert.deepEqual(shard.requirementIds, profile.requirements.map((r) => r.id));
    for (const assessment of shard.assessments) {
      assert.equal(assessment.requirements.length, profile.requirements.length);
      for (const requirement of assessment.requirements) {
        const policy = byId.get(requirement.requirementId);
        assert.ok(policy, `${requirement.requirementId} is not in the profile`);
        for (const evidence of requirement.evidence) {
          assert.ok(
            policy.acceptableLocalityClasses.includes(evidence.localityClass),
            `${requirement.requirementId} may not use locality ${evidence.localityClass}`,
          );
          assert.ok(
            policy.acceptableProjectionMethods.includes(evidence.projectionMethod),
            `${requirement.requirementId} may not use projection ${evidence.projectionMethod}`,
          );
        }
      }
    }
  });

  test(`${fixture.slug}: groundwater is recorded as containing-area, never as direct evidence`, () => {
    let seen = 0;
    for (const assessment of shard.assessments) {
      for (const requirement of assessment.requirements) {
        if (requirement.requirementId !== "groundwater-resource-status") continue;
        for (const evidence of requirement.evidence) {
          seen += 1;
          assert.equal(evidence.localityClass, "containing-area");
          assert.equal(evidence.projectionMethod, "administrative-proxy");
        }
      }
    }
    assert.equal(seen, fixture.panchayats);
  });

  test(`${fixture.slug}: the evidence floor is consistent across the block`, () => {
    const counts = shard.assessments.map((assessment) => assessment.summary.adequate);
    assert.ok(Math.max(...counts) <= 14);
    assert.ok(Math.min(...counts) >= 4);
    assert.equal(shard.dataset, "atlas/assessments");
    assert.equal(shard.provenance.method, "derived");
    assert.ok(shard.provenance.sources.every((source) => source.role === "input"));
    assert.ok(shard.provenance.internal_inputs?.some((path) => path.endsWith("directory.json")));
  });
}
