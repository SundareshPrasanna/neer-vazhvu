import assert from "node:assert/strict";
import test from "node:test";

import { computeRecordsSha256 } from "./acquisition-validation";
import { identityFromDirectory, type CensusShard, type DistrictDirectoryArtifact } from "./artifacts";
import {
  DRINKING_WATER_SOURCE_KEYS,
  crossCheckBoundaryAreas,
  rollUpCensusAttributesByGramPanchayat,
  validateTnDistrictCensusAttributes,
} from "./tn-census-attributes";
import type { CensusBinding, TnDistrictCensusAttributes } from "./tn-census-attributes";
import { FIXTURE_DISTRICTS, readFixture } from "./test-support";

function load(slug: string, block: string) {
  const directory = readFixture<DistrictDirectoryArtifact>(slug, "directory.json");
  const shard = readFixture<CensusShard>(slug, "census-2011", `${block}.json`);
  const bindings: CensusBinding[] = directory.panchayats
    .filter((panchayat) => panchayat.census)
    .map((panchayat) => ({
      lgdGramPanchayatCode: panchayat.lgdCode,
      sourceUnitId: panchayat.census!.sourceUnitId,
      villageCodes: panchayat.census!.villages.map((village) => village.villageCode),
    }));
  const villages = shard.records.flatMap((record) => record.villages);
  const attributes: TnDistrictCensusAttributes = {
    schemaVersion: shard.schemaVersion,
    planId: shard.planId,
    censusDistrictCode: shard.censusDistrictCode,
    acquiredAt: shard.acquiredAt,
    source: shard.source,
    snapshotSha256: "0".repeat(64),
    recordsSha256: computeRecordsSha256(villages),
    recordCount: villages.length,
    records: villages,
  };
  return { directory, shard, bindings, attributes };
}

for (const district of FIXTURE_DISTRICTS) {
  test(`${district.slug}: the shard's rollups are the directory's Census bindings, recomputed`, () => {
    const { directory, shard, bindings, attributes } = load(district.slug, district.block);
    const rollups = rollUpCensusAttributesByGramPanchayat(attributes, bindings);
    const served = shard.records.map((record) => {
      const { villages, ...rollup } = record;
      void villages;
      return rollup;
    });
    assert.deepEqual(rollups, served);
    assert.equal(shard.recordCount, bindings.length);
    assert.equal(shard.dataset, "atlas/census-2011");
    assert.equal(shard.provenance.method, "derived");
    for (const rollup of rollups) {
      assert.ok(rollup.villageCodes.length > 0);
      for (const key of DRINKING_WATER_SOURCE_KEYS) assert.ok(key in rollup.drinkingWaterSources);
    }
    // The shard carries rows only for villages a Panchayat is bound to; the
    // directory also enumerates the villages of unbound Census units, which
    // the validator rightly reports as rows it expected and did not find.
    const errors = validateTnDistrictCensusAttributes(attributes, identityFromDirectory(directory));
    assert.ok(errors.every((error) => error.includes("have no attribute row")), errors.join("\n"));
  });
}

test("Kuruvikkarambai reproduces the hand-researched slice figures exactly", () => {
  const { shard } = load("thanjavur", "6633");
  const kuruvikkarambai = shard.records.find((record) => record.lgdGramPanchayatCode === "228711");
  assert.ok(kuruvikkarambai);
  assert.deepEqual(kuruvikkarambai.villageCodes, ["639145", "639147"]);
  // From the reviewed brief: 1,251.74 ha total, 874.22 ha net sown, 253.29 ha
  // irrigated, 241.50 ha of it by canals.
  assert.equal(kuruvikkarambai.measures.totalGeographicalAreaHectares, 1251.74);
  assert.equal(kuruvikkarambai.measures.netAreaSownHectares, 874.22);
  assert.equal(kuruvikkarambai.measures.irrigatedAreaHectares, 253.29);
  assert.equal(kuruvikkarambai.measures.canalIrrigatedAreaHectares, 241.5);
});

test("an attribute row for an untracked village is rejected", () => {
  const { directory, attributes } = load("thanjavur", "6633");
  const records = [...attributes.records, { ...attributes.records[0], villageCode: "999999" }];
  const tampered = { ...attributes, records, recordCount: records.length, recordsSha256: computeRecordsSha256(records) };
  const errors = validateTnDistrictCensusAttributes(tampered, identityFromDirectory(directory));
  assert.ok(errors.some((error) => error.includes("match no tracked Census village")));
});

test("a source present in any constituent village counts for the Panchayat", () => {
  const { shard } = load("thanjavur", "6633");
  const multiVillage = shard.records.find((record) => record.villageCodes.length > 1);
  assert.ok(multiVillage, "expected a multi-village Panchayat");
  for (const key of DRINKING_WATER_SOURCE_KEYS) {
    const anyAvailable = multiVillage.villages.some(
      (village) => village.drinkingWaterSources[key] === "available",
    );
    if (anyAvailable) assert.equal(multiVillage.drinkingWaterSources[key], "available");
  }
});

test("summer failure is counted per Panchayat and splits the two districts", () => {
  const thanjavur = load("thanjavur", "6633").shard.records;
  // Delta country: nothing in the 2009 record dries up.
  assert.equal(thanjavur.filter((record) => record.sourceTypesLostInSummer.length > 0).length, 0);
  const tiruchirappalli = load("tiruchirappalli", "6684").shard.records;
  const lose = tiruchirappalli.filter((record) => record.sourceTypesLostInSummer.length > 0);
  assert.ok(lose.length > 0, "upland Trichy records a seasonal loss");
  for (const record of [...thanjavur, ...tiruchirappalli]) {
    assert.equal(
      record.summerSourceTypes,
      record.annualSourceTypes - record.sourceTypesLostInSummer.length,
    );
  }
});

test("boundary areas are cross-checked against the Census areas", () => {
  const { directory, shard } = load("thanjavur", "6633");
  const areas = new Map(
    directory.panchayats
      .filter((panchayat) => panchayat.boundary)
      .map((panchayat) => [panchayat.lgdCode, panchayat.boundary!.areaHectares]),
  );
  const report = crossCheckBoundaryAreas(areas, shard.records);
  assert.equal(report.compared, shard.records.length);
  assert.equal(report.notComparable, 0);
  assert.equal(report.agreed + report.review, report.compared);
  for (const outlier of report.outliers) {
    assert.ok(Math.abs(outlier.deltaPercent) > report.tolerancePercent);
  }
});
