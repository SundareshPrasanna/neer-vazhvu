import assert from "node:assert/strict";
import test from "node:test";

import type { AssessmentsShard, BriefsShard } from "./artifacts";
import { assembleEvidenceInputs, generateDistrictAssessments, loadDistrictCorpus } from "./district-assessment";
import { FIXTURE_DISTRICTS, districtBySlug, readFixture } from "./test-support";

for (const fixture of FIXTURE_DISTRICTS) {
  const district = districtBySlug(fixture.slug);

  test(`${fixture.slug}: the served corpus is consistent with its directory`, () => {
    const { corpus, errors } = loadDistrictCorpus(district);
    assert.deepEqual(errors, []);
    assert.equal(corpus.identity.gramPanchayats.size, fixture.panchayats);
    assert.equal(corpus.jjm.length, 1);
    assert.equal(corpus.census.length, 1);
    assert.equal(corpus.waterBodies.length, 1);
    assert.ok(corpus.groundwater && corpus.projection && corpus.rainfall);
  });

  test(`${fixture.slug}: every Panchayat gets an evidence record wired to its bindings`, () => {
    const { corpus } = loadDistrictCorpus(district);
    const inputs = assembleEvidenceInputs(corpus);
    assert.equal(inputs.length, fixture.panchayats);
    for (const record of inputs) {
      const panchayat = corpus.directory.panchayats.find((p) => p.lgdCode === record.lgdGramPanchayatCode)!;
      assert.equal(record.identity?.jjm?.sourceUnitId, panchayat.jjm?.sourceUnitId);
      assert.equal(Boolean(record.jjm), Boolean(panchayat.jjm));
      assert.equal(Boolean(record.census), Boolean(panchayat.census));
      assert.equal(record.boundary?.areaHectares, panchayat.boundary?.areaHectares);
      assert.ok(record.groundwater, "the projection covers every fixture place");
      assert.ok(record.rainfall && record.rainfallWindow);
    }
  });

  test(`${fixture.slug}: regenerating from the served inputs reproduces the served assessments and briefs`, () => {
    const { corpus } = loadDistrictCorpus(district);
    const assessments = readFixture<AssessmentsShard>(fixture.slug, "assessments", `${fixture.block}.json`);
    const briefs = readFixture<BriefsShard>(fixture.slug, "briefs", `${fixture.block}.json`);
    const run = generateDistrictAssessments(corpus, assessments.assessedAt);
    assert.equal(run.profileId, assessments.profileId);
    assert.deepEqual(run.requirementIds, assessments.requirementIds);
    assert.deepEqual(run.assessments, assessments.assessments);
    assert.deepEqual(run.briefs, briefs.briefs);
  });
}
