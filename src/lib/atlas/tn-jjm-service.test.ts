import assert from "node:assert/strict";
import test from "node:test";

import { computeRecordsSha256 } from "./acquisition-validation";
import { identityFromDirectory, type DistrictDirectoryArtifact, type JjmServiceShard } from "./artifacts";
import {
  normalizeJjmVillageService,
  parseJjmSampleDate,
  rollUpJjmServiceByGramPanchayat,
  validateJjmServiceRecords,
  validateTnDistrictJjmServiceExtract,
} from "./tn-jjm-service";
import type { TnDistrictJjmServiceExtract } from "./tn-jjm-service";
import { FIXTURE_DISTRICTS, readFixture } from "./test-support";

const directory = readFixture<DistrictDirectoryArtifact>("thanjavur", "directory.json");
const identity = identityFromDirectory(directory);
const shard = readFixture<JjmServiceShard>("thanjavur", "jjm-service", "6633.json");

/** The district-grain intermediate the producer caches, rebuilt from a shard. */
function asDistrictExtract(records: JjmServiceShard["records"]): TnDistrictJjmServiceExtract {
  return {
    schemaVersion: shard.schemaVersion,
    planId: shard.planId,
    jjmStateId: shard.jjmStateId,
    jjmDistrictId: shard.jjmDistrictId,
    acquiredAt: shard.acquiredAt,
    source: shard.source,
    coverage: {
      villagesInDistrict: identity.jjmVillagePaths.size,
      villagesAcquired: records.length,
      partialReason: null,
    },
    recordsSha256: computeRecordsSha256(records),
    recordCount: records.length,
    records,
  };
}

test("sample dates are read as day-month-year", () => {
  assert.equal(parseJjmSampleDate("16-07-2026"), "2026-07-16");
  assert.equal(parseJjmSampleDate("2026-07-16"), null);
  assert.equal(parseJjmSampleDate(""), null);
});

test("a village payload normalizes into habitations, sources and samples", () => {
  const record = normalizeJjmVillageService(
    { blockId: "1", gpId: "2", villageId: "3", villageName: "Test" },
    {
      habitations: [
        { HabitationName: "A", TotalPop: "1,094", Household: "205", HouseholdConn: "205", QualityStatus: "None", QualityContamination: "None" },
        { HabitationName: "B", TotalPop: "2326", Household: "629", HouseholdConn: "629", QualityStatus: "None", QualityContamination: "None" },
      ],
      sources: [
        { sourceId: 601005, HabitationName: "A", SourceTypeCategory: "Ground Water", SourceType: "Deep Tubewell" },
      ],
      samples: [
        [{ total_number_of_sample_taken: 49, sample_found_contaminated: 0, remedial_action_taken: 0 }],
        [
          { Date_of_sample_taken: "13-06-2026", contaminated_found: "Chemical and bacteriological both", Statustaken: "Safe", remidacialaction: "Not required", Location: "Individual Household" },
          { Date_of_sample_taken: "16-07-2026", contaminated_found: "Chemical and bacteriological both", Statustaken: "Safe", remidacialaction: "Not required", Location: "Individual Household" },
        ],
      ],
    },
  );
  assert.equal(record.totals.habitationCount, 2);
  assert.equal(record.totals.population, 3420);
  assert.equal(record.totals.households, 834);
  assert.equal(record.totals.householdConnections, 834);
  assert.equal(record.totals.sourceCount, 1);
  assert.equal(record.totals.sampleRowCount, 2);
  // The latest sample is by date, not by row order.
  assert.equal(record.totals.latestSampleDate, "2026-07-16");
  assert.equal(record.totals.latestSampleStatus, "Safe");
  assert.equal(record.sampleSummary.samplesTaken, 49);
});

for (const district of FIXTURE_DISTRICTS) {
  test(`${district.slug}: every village in the shard belongs to the directory's enumeration`, () => {
    const served = readFixture<DistrictDirectoryArtifact>(district.slug, "directory.json");
    const servedIdentity = identityFromDirectory(served);
    const blockShard = readFixture<JjmServiceShard>(district.slug, "jjm-service", `${district.block}.json`);
    assert.deepEqual(validateJjmServiceRecords(blockShard.records, servedIdentity), []);
    assert.equal(blockShard.dataset, "atlas/jjm-service");
    assert.equal(blockShard.blockCode, district.block);
    assert.equal(blockShard.recordCount, blockShard.records.length);
    assert.equal(blockShard.recordsSha256, computeRecordsSha256(blockShard.records));
    assert.equal(blockShard.coverage.villagesAcquired, servedIdentity.jjmVillagePaths.size);
    assert.equal(blockShard.coverage.partialReason, null);
    assert.equal(blockShard.provenance.produced_at, blockShard.acquiredAt);
    assert.ok(blockShard.provenance.internal_inputs?.some((path) => path.endsWith("directory.json")));
  });
}

test("the shard reproduces Kuruvikkarambai's hand-researched service figures", () => {
  // Recorded in the reviewed brief before any bulk acquisition existed:
  // 1,566 households and tap connections across ten habitations, 29
  // deep-tubewell source rows over two service villages.
  const rollups = rollUpJjmServiceByGramPanchayat(shard);
  const kuruvikkarambai = rollups.find((rollup) => rollup.gpId === "152422");
  assert.ok(kuruvikkarambai);
  assert.equal(kuruvikkarambai.villageIds.length, 2);
  assert.equal(kuruvikkarambai.households, 1566);
  assert.equal(kuruvikkarambai.householdConnections, 1566);
  assert.equal(kuruvikkarambai.tapCoveragePercent, 100);
  assert.equal(kuruvikkarambai.habitationCount, 10);
  assert.equal(kuruvikkarambai.sourceCount, 29);
  assert.deepEqual(kuruvikkarambai.sourceTypes, ["Deep Tubewell"]);
});

test("villages roll up to the Gram Panchayats the directory binds", () => {
  const rollups = rollUpJjmServiceByGramPanchayat(shard);
  const boundGpIds = new Set(
    directory.panchayats.filter((panchayat) => panchayat.jjm).map((panchayat) => panchayat.jjm!.gpId),
  );
  assert.deepEqual(new Set(rollups.map((rollup) => rollup.gpId)), boundGpIds);
  for (const rollup of rollups) {
    assert.ok(rollup.villageIds.length > 0);
    assert.equal(rollup.samplesByYear.reduce((total, entry) => total + entry.count, 0) <= rollup.sampleRowCount, true);
    if (rollup.tapCoveragePercent !== null) assert.ok(rollup.tapCoveragePercent >= 0);
  }
});

test("a village outside the enumeration is rejected", () => {
  const records = [{ ...shard.records[0], villageId: "999999" }, ...shard.records.slice(1)];
  const errors = validateJjmServiceRecords(records, identity);
  assert.ok(errors.some((error) => error.includes("not in the tracked JJM enumeration")));
});

test("more tap connections than households is rejected", () => {
  const first = shard.records[0];
  const records = [
    { ...first, totals: { ...first.totals, households: 10, householdConnections: 11 } },
    ...shard.records.slice(1),
  ];
  const errors = validateJjmServiceRecords(records, identity);
  assert.ok(errors.some((error) => error.includes("more tap connections than households")));
});

test("a partial district run must declare why it is partial", () => {
  assert.deepEqual(validateTnDistrictJjmServiceExtract(asDistrictExtract(shard.records), identity), []);
  const partial = asDistrictExtract(shard.records.slice(0, 3));
  const errors = validateTnDistrictJjmServiceExtract(partial, identity);
  assert.ok(errors.some((error) => error.includes("partialReason")));
});
