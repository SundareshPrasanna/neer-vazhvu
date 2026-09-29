import assert from "node:assert/strict";
import test from "node:test";

import type { AssessmentsShard } from "./artifacts";
import { villageWaterProfileV2 } from "./capability-assessment";
import {
  CAPABILITY_RULES,
  EVIDENCE_GENERATOR_VERSION,
  LGD_PROVENANCE,
  generateCapabilityAssessment,
  lgdProvenanceFor,
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

test("LGD provenance follows what the district serves; withheld polygons evidence no boundary", () => {
  // Maharashtra's served ids reproduce the shared default exactly.
  assert.deepEqual(
    lgdProvenanceFor({
      boundarySourceRef: "datameet-village-boundaries-mh",
      waterBodySourceRef: "water-bodies-census-mh",
      assessmentUnitType: "TALUKA",
    }),
    LGD_PROVENANCE,
  );
  const karnataka = lgdProvenanceFor({
    boundarySourceRef: "datameet-village-boundaries-ka",
    assessmentUnitType: "TALUK",
    boundaryWithheld: true,
  });
  assert.equal(karnataka.boundarySourceRef, "datameet-village-boundaries-ka");
  assert.equal(karnataka.assessmentUnitLabel, "taluk");
  const boundary = {
    lgdGramPanchayatCode: "218979",
    lgdBlockCode: "5592",
    name: "Masthi",
    type: "Village Panchayat (union of DataMeet village polygons)",
    geometrySha256: "0".repeat(64),
    areaHectares: 812.4,
    bbox: [78.1, 13.0, 78.2, 13.1] as [number, number, number, number],
    ringCount: 2,
    vertexCount: 40,
  };
  const rule = CAPABILITY_RULES["place-boundary"];
  assert.equal(rule({ ...emptyInputs, boundary, provenance: karnataka }, "2026-09-19"), null);
  assert.notEqual(rule({ ...emptyInputs, boundary, provenance: LGD_PROVENANCE }, "2026-09-19"), null);
});

test("wells inside the Panchayat evidence its groundwater level, trend and chemistry within the place", () => {
  const station = {
    id: "KLPKDPZBW15",
    network: "ksgwd-manual-monthly",
    agency: "KSGWD",
    wellType: "Bore Well",
    lon: 76.75,
    lat: 10.7,
    lgdGramPanchayatCode: "228400",
    readingsCount: 120,
    firstReading: "2016-01-06",
    latest: { date: "2026-04-07", depthMbgl: 9.28 },
    preMonsoon: {
      season: "March to May",
      years: 10,
      latestYear: 2026,
      latestMbgl: 9.3,
      priorMedianMbgl: 8.1,
      changeM: 1.2,
      trendMPerYear: 0.14,
      trendYears: 10,
    },
  };
  const sample = {
    id: "KLPKDOW01",
    agency: "KSGWD",
    wellType: "Dug Well",
    lon: 76.75,
    lat: 10.7,
    lgdGramPanchayatCode: "228400",
    sampledAt: "2023-12-07",
    samples: 12,
    values: { nitrate: 60 },
    exceedances: [{ parameter: "nitrate" as const, value: 60, limit: "at most 45 mg/l" }],
  };
  const inputs = { ...emptyInputs, wells: { stations: [station], quality: [sample] } };
  const level = CAPABILITY_RULES["groundwater-level-observation"](inputs, "2026-09-29");
  assert.equal(level?.evidence[0].localityClass, "within-place");
  assert.match(level?.evidence[0].notes ?? "", /9\.28 m below ground on 2026-04-07/);
  const trend = CAPABILITY_RULES["groundwater-level-trend"](inputs, "2026-09-29");
  assert.match(trend?.evidence[0].notes ?? "", /deepened by 0\.14 m a year over 10 seasons/);
  const quality = CAPABILITY_RULES["drinking-water-quality"](inputs, "2026-09-29");
  assert.equal(quality?.evidence.length, 1, "no JJM samples here, so the wells stand alone");
  assert.match(quality?.evidence[0].notes ?? "", /KLPKDOW01 above the BIS acceptable limit for nitrate/);
  assert.equal(CAPABILITY_RULES["groundwater-level-trend"](emptyInputs, "2026-09-29"), null);
});
