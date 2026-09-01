import assert from "node:assert/strict";
import test from "node:test";

import { computeRecordsSha256 } from "./acquisition-validation";
import { identityFromDirectory, type DistrictDirectoryArtifact, type WaterBodiesShard } from "./artifacts";
import {
  buildTnDistrictWaterBodyExtract,
  reportWaterBodyJoin,
  validateTnDistrictWaterBodyExtract,
} from "./tn-water-bodies";
import type { TnDistrictWaterBodyExtract } from "./tn-water-bodies";
import { FIXTURE_DISTRICTS, readFixture } from "./test-support";

// A synthetic district, so the shape rules are tested without depending on
// what TNGIS happens to publish today.
function feature(code: number | null, name: string | null, department: string) {
  return {
    properties: { panchayat_lgdvcode: code, water_body_name: name, source_department: department },
    geometry: { type: "Polygon", coordinates: [] },
  };
}

const BUILD_OPTIONS = {
  planId: "test-plan",
  districtLgdCode: "540",
  acquiredAt: "2026-07-26",
  sourceUrl: "https://tngis.tn.gov.in/tngismaps/ows?test",
  snapshotSha256: "0".repeat(64),
  area: () => 20000,
};

/** The district extract the producer builds, reassembled from a served shard. */
function extractFromShard(shard: WaterBodiesShard): TnDistrictWaterBodyExtract {
  const records = shard.features.map((f) => {
    const { lgdBlockCode, ...record } = f.properties;
    void lgdBlockCode;
    return record;
  });
  return {
    schemaVersion: shard.ext.atlas.schemaVersion,
    planId: shard.ext.atlas.planId,
    districtLgdCode: shard.ext.atlas.districtLgdCode,
    acquiredAt: shard.ext.atlas.acquiredAt,
    source: {
      sourceId: "tngis-all-water-bodies",
      layer: shard.ext.atlas.layer,
      sourceUrl: shard.ext.atlas.sourceUrl,
      retrievedAt: shard.ext.atlas.acquiredAt,
      rights: {
        status: shard.ext.atlas.rights.status,
        termsUrl: shard.ext.atlas.rights.termsUrl,
        termsQuote: shard.ext.atlas.rights.termsQuote,
        publicDisplay: "permission-required",
        redistribution: "permission-required",
        commercialUse: "permission-required",
        approval: null,
      },
      contributingDepartments: shard.ext.atlas.contributingDepartments,
    },
    snapshotSha256: shard.ext.atlas.snapshotSha256,
    recordsSha256: computeRecordsSha256(records),
    recordCount: records.length,
    featureCount: records.reduce((total, record) => total + record.count, 0),
    records,
  };
}

test("features are rolled up per Gram Panchayat, not kept per feature", () => {
  const built = buildTnDistrictWaterBodyExtract(
    [feature(228400, "Alodai", "WRD"), feature(228400, null, "NRSC"), feature(228400, "Nagiah Eri", "WRD"), feature(228401, "Adalakulam", "AED")],
    BUILD_OPTIONS,
  );
  assert.equal(built.recordCount, 2);
  assert.equal(built.featureCount, 4);
  const poondi = built.records.find((record) => record.lgdGramPanchayatCode === "228400");
  assert.ok(poondi);
  assert.equal(poondi.count, 3);
  assert.equal(poondi.namedCount, 2);
  assert.deepEqual(poondi.byDepartment, [{ department: "WRD", count: 2 }, { department: "NRSC", count: 1 }]);
  assert.equal(poondi.areaHectares, 6);
  assert.equal(poondi.largestAreaHectares, 2);
});

test("features with no Gram Panchayat are dropped rather than pooled", () => {
  const built = buildTnDistrictWaterBodyExtract(
    [feature(0, "Town tank", "AED"), feature(null, "No code", "AED"), feature(228400, "Real", "WRD")],
    BUILD_OPTIONS,
  );
  assert.equal(built.recordCount, 1);
  assert.equal(built.records[0].lgdGramPanchayatCode, "228400");
});

test("neither geometry nor water-body names are stored, and the digest is order-independent", () => {
  const forward = buildTnDistrictWaterBodyExtract([feature(228400, "Alodai", "WRD"), feature(228400, "Nagiah Eri", "WRD")], BUILD_OPTIONS);
  const reversed = buildTnDistrictWaterBodyExtract([feature(228400, "Nagiah Eri", "WRD"), feature(228400, "Alodai", "WRD")], BUILD_OPTIONS);
  const serialised = JSON.stringify(forward);
  assert.doesNotMatch(serialised, /Alodai/);
  assert.doesNotMatch(serialised, /coordinates/);
  assert.match(forward.records[0].namesSha256, /^[0-9a-f]{64}$/);
  assert.equal(forward.records[0].namesSha256, reversed.records[0].namesSha256);
});

for (const fixture of FIXTURE_DISTRICTS) {
  test(`${fixture.slug}: the shard joins by LGD code and withholds TNGIS content`, () => {
    const directory = readFixture<DistrictDirectoryArtifact>(fixture.slug, "directory.json");
    const shard = readFixture<WaterBodiesShard>(fixture.slug, "water-bodies", `${fixture.block}.geojson`);
    const identity = identityFromDirectory(directory);
    const extract = extractFromShard(shard);
    assert.deepEqual(validateTnDistrictWaterBodyExtract(extract, identity), []);
    const report = reportWaterBodyJoin(extract, identity);
    assert.deepEqual(report.unmatchedPanchayatCodes, []);
    assert.equal(report.panchayatsWithWaterBodies + report.panchayatsWithout.length, fixture.panchayats);
    assert.equal(report.featureCount, shard.ext.atlas.featureCount);
    assert.ok(report.totalAreaHectares > 0);
    assert.equal(shard.type, "FeatureCollection");
    assert.equal(shard.dataset, "atlas/water-bodies");
    for (const f of shard.features) {
      assert.equal(f.geometry, null, "geometry is withheld until TNGIS approval");
      assert.equal(f.properties.lgdBlockCode, fixture.block);
    }
    assert.doesNotMatch(JSON.stringify(shard), /water_body_name|coordinates/);
    assert.equal(shard.ext.atlas.rights.status, "permission-required");
    assert.match(shard.ext.atlas.rights.termsQuote, /prior approval/);
    assert.deepEqual(shard.ext.atlas.contributingDepartments, ["AED", "DOSS", "NRSC", "TNRD", "WRD"]);
    assert.equal(shard.provenance.sources[0].id, "tngis-generic-viewer-water-bodies");
    assert.match(String(shard.provenance.sources[0].license), /LICENCE UNVERIFIED/);
  });
}

test("the published TNGIS restriction may not be downgraded", () => {
  const shard = readFixture<WaterBodiesShard>("thanjavur", "water-bodies", "6633.geojson");
  const identity = identityFromDirectory(readFixture<DistrictDirectoryArtifact>("thanjavur", "directory.json"));
  const extract = extractFromShard(shard);
  const downgraded = { ...extract, source: { ...extract.source, rights: { ...extract.source.rights, status: "open" as never } } };
  assert.ok(validateTnDistrictWaterBodyExtract(downgraded, identity).some((error) => error.includes("may not be downgraded")));
  const tampered = { ...extract, records: extract.records.map((record, index) => (index === 0 ? { ...record, count: record.count + 1 } : record)) };
  assert.ok(validateTnDistrictWaterBodyExtract(tampered, identity).some((error) => error.includes("recordsSha256")));
});
