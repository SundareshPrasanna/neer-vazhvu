import assert from "node:assert/strict";
import test from "node:test";

import type { DistrictDirectoryArtifact } from "./artifacts";
import { buildCanonicalCrosswalk } from "./tn-crosswalk-resolution";
import {
  buildDistrictDirectoryPayload,
  validateDirectoryPayload,
} from "./tn-district-refresh";
import type { DirectoryPayload } from "./tn-district-refresh";
import {
  FIXTURE_DISTRICTS,
  buildMiniProposal,
  districtBySlug,
  loadMiniBoundary,
  loadMiniExtract,
  loadMiniPlan,
  loadMiniResolution,
  readFixture,
} from "./test-support";

function withoutEnvelope(artifact: DistrictDirectoryArtifact): DirectoryPayload {
  const { nvdm, dataset, scope, provenance, projection, ext, ...payload } = artifact;
  void nvdm;
  void dataset;
  void scope;
  void provenance;
  void projection;
  void ext;
  return payload;
}

function rebuild(slug: string): DirectoryPayload {
  const extract = loadMiniExtract(slug);
  const proposal = buildMiniProposal(slug, extract);
  const canonical = buildCanonicalCrosswalk(proposal, [loadMiniResolution(slug, proposal)]);
  return buildDistrictDirectoryPayload({
    district: districtBySlug(slug),
    plan: loadMiniPlan(slug),
    extract,
    proposal,
    canonical,
    boundary: loadMiniBoundary(slug),
  });
}

for (const district of FIXTURE_DISTRICTS) {
  const served = readFixture<DistrictDirectoryArtifact>(district.slug, "directory.json");

  test(`${district.slug}: the served directory is exactly what the producer rebuilds`, () => {
    assert.deepEqual(rebuild(district.slug), withoutEnvelope(served));
    assert.deepEqual(validateDirectoryPayload(served), []);
  });

  test(`${district.slug}: the directory carries its envelope and identity`, () => {
    assert.equal(served.nvdm, "1.0");
    assert.equal(served.dataset, "atlas/directory");
    assert.deepEqual(served.scope, { kind: "district", id: districtBySlug(district.slug).scopeId });
    assert.equal(served.provenance.method, "mixed");
    assert.deepEqual(served.provenance.internal_inputs, []);
    assert.equal(served.provenance.produced_at, served.acquiredAt);
    assert.ok(served.provenance.sources.every((source) => source.id || source.closed));
    assert.equal(served.panchayats.length, district.panchayats);
    assert.deepEqual(
      served.blocks.map((block) => [block.code, block.name, block.panchayatCount]),
      [[district.block, district.blockName, district.panchayats]],
    );
  });

  test(`${district.slug}: reviewed targets carry their reviewed composition, others say how they are known`, () => {
    const plan = loadMiniPlan(district.slug);
    for (const target of plan.targets) {
      const panchayat = served.panchayats.find(
        (entry) => entry.lgdCode === target.tnrdLgdGramPanchayatCode,
      );
      assert.ok(panchayat, target.id);
      assert.equal(panchayat.composition.status, "reviewed");
      assert.equal(panchayat.composition.reviewedAt, target.reviewedAt);
      assert.deepEqual(panchayat.composition.members, target.censusComposition.members);
      assert.ok(panchayat.tnrdMaster, "a reviewed target is bound to the current master");
    }
    for (const panchayat of served.panchayats) {
      if (panchayat.composition.status === "crosswalk") {
        assert.ok(panchayat.census);
        assert.equal(panchayat.composition.completeness, "unknown");
        assert.equal(panchayat.composition.members.length, panchayat.census.villages.length);
      }
      if (panchayat.composition.status === "unbound") {
        assert.equal(panchayat.census, null);
        assert.deepEqual(panchayat.composition.members, []);
      }
      if (panchayat.jjm) assert.ok(panchayat.jjm.villages.length > 0);
      assert.ok(panchayat.boundary, `${panchayat.lgdCode} has a TNGIS centroid`);
    }
  });
}

test("a directory whose blocks do not partition its Panchayats is rejected", () => {
  const served = readFixture<DistrictDirectoryArtifact>("thanjavur", "directory.json");
  const duplicate = structuredClone(served);
  duplicate.panchayats.push(duplicate.panchayats[0]);
  assert.ok(validateDirectoryPayload(duplicate).some((error) => error.includes("duplicate LGD code")));
  const miscounted = structuredClone(served);
  miscounted.blocks[0].panchayatCount -= 1;
  assert.ok(validateDirectoryPayload(miscounted).some((error) => error.includes("declares")));
  const stray = structuredClone(served);
  stray.panchayats[0].blockCode = "0000";
  assert.ok(validateDirectoryPayload(stray).some((error) => error.includes("unlisted block")));
});
