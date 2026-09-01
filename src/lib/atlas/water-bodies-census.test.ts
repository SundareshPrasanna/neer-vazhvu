import assert from "node:assert/strict";
import test from "node:test";

import { identityFromDirectory, type DistrictDirectoryArtifact, type WaterBodiesShard } from "./artifacts";
import { LGD_FIXTURE_DISTRICTS, fixtureSlugsPresent, readFixture, readFixtureArtifacts } from "./test-support";
import {
  assignRow,
  buildVillageMembership,
  buildWaterBodiesCensusExtract,
  diagnoseAttributes,
  looksTemplated,
  parseWaterBodiesCensusRow,
  parseWaterBodiesCensusRows,
  validateWaterBodiesCensusExtract,
  type WaterBodiesCensusRow,
} from "./water-bodies-census";

/** A three-Panchayat district: one village each, one village shared by two,
 *  one uncovered, one Census-only. Panchayat 300 has no boundary. */
function directory(): DistrictDirectoryArtifact {
  const panchayat = (lgdCode: string, blockCode: string, villages: string[], bbox: number[] | null) => ({
    lgdCode,
    name: `GP ${lgdCode}`,
    blockCode,
    blockName: `Block ${blockCode}`,
    tnrdMaster: null,
    lgdCoverage: { villages: villages.map((code) => ({ villageCode: code, villageName: `V${code}`, census2011Code: code, coverageType: "Full" })) },
    jjm: null,
    census: null,
    composition: { status: "crosswalk", completeness: "unknown", basis: "authoritative-crosswalk", reviewedAt: null, members: [], exclusions: [] },
    boundary: bbox ? { type: "test", areaHectares: 1, centroid: [bbox[0], bbox[1]], bbox, geometrySha256: "0".repeat(64), ringCount: 1, vertexCount: 4 } : null,
  });
  return {
    district: { planId: "test-plan", lgdDistrictCode: "494" },
    blocks: [
      { code: "1", name: "Block 1" },
      { code: "2", name: "Block 2" },
    ],
    panchayats: [
      panchayat("100", "1", ["563001", "563009"], [73.5, 17.5, 73.6, 17.6]),
      panchayat("200", "1", ["563002", "563009"], [73.6, 17.5, 73.7, 17.6]),
      panchayat("300", "2", ["563003"], null),
    ],
    uncoveredVillages: [{ villageCode: "563004", villageName: "Dare", census2011Code: "563004", subdistrictCode: "2", censusRow: true }],
    censusVillagesWithoutLgdRow: [{ villageCode: "563005", villageName: "Old", subdistrictCode: "2" }],
    unbound: { jjm: [], census: [] },
  } as unknown as DistrictDirectoryArtifact;
}

function apiRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    rural_or_urban: "Rural",
    state_name: "MAHARASHTRA",
    district_name: "SATARA",
    block_tehsil_name: "PATAN",
    village_name: "MARUL",
    town_municipalty_name: "NA",
    unique_id: "1/15/527/000001/563001/001",
    water_body_name: "NA",
    ref_water_body_type_id_name: "Tank",
    water_body_ownership_name: "State WRD/State Irrigation",
    water_body_nature_name: "Man-made",
    ref_water_body_in_use_id_name: "Yes",
    ref_selection_id_water_body_encroached_name: "No",
    water_spread_area_of_water_body: 4,
    construcion_year: 2001,
    construction_cost: 750000,
    latitude_dec: 17.55,
    longitude_dec: 73.55,
    ...overrides,
  };
}

function row(overrides: Record<string, unknown> = {}): WaterBodiesCensusRow {
  const parsed = parseWaterBodiesCensusRow(apiRecord(overrides));
  if ("error" in parsed) throw new Error(parsed.error);
  return parsed.row;
}

const OPTIONS = {
  planId: "test-plan",
  districtLgdCode: "494",
  acquiredAt: "2026-09-01",
  sourceId: "water-bodies-census-mh",
  resourceId: "e1874d07-a1db-4678-80c1-b64a2924b517",
  sourceUrl: "https://api.data.gov.in/resource/e1874d07?format=json&limit=all&filters[district_name]=SATARA",
  catalogUrl: "https://data.gov.in/resource/test",
  districtName: "SATARA",
  resourceUpdatedOn: "2026-02-10",
  snapshotSha256: "0".repeat(64),
  waterspread: "withheld" as const,
  waterspreadNote: "template values on every row",
};

test("a row is read from the API record, with NA fields as not stated", () => {
  const parsed = row({ water_body_name: "NA", water_spread_area_of_water_body: "NA", latitude_dec: "NA" });
  assert.equal(parsed.subdistrictCode, "1");
  assert.equal(parsed.censusVillageCode, "563001");
  assert.equal(parsed.name, null);
  assert.equal(parsed.waterSpreadAreaHectares, null);
  assert.equal(parsed.latitude, null);
  assert.equal(parsed.inUse, true);
  assert.equal(parsed.encroached, false);
  const bad = parseWaterBodiesCensusRow(apiRecord({ unique_id: "1/15/527" }));
  assert.ok("error" in bad);
  assert.throws(() => parseWaterBodiesCensusRows([apiRecord({ rural_or_urban: "Peri-urban" })]), /neither Rural nor Urban/);
});

test("a village under exactly one Panchayat is assigned; every other row is counted, never pooled", () => {
  const membership = buildVillageMembership(directory());
  assert.deepEqual(assignRow(row(), membership), { kind: "panchayat", lgdGramPanchayatCode: "100", blockCode: "1" });
  assert.equal(assignRow(row({ unique_id: "1/15/527/000001/563009/001" }), membership).kind, "shared-village");
  assert.equal(assignRow(row({ unique_id: "1/15/527/000002/563004/001" }), membership).kind, "uncovered-village");
  assert.equal(assignRow(row({ unique_id: "1/15/527/000002/563005/001" }), membership).kind, "census-village-without-lgd-row");
  assert.equal(assignRow(row({ unique_id: "1/15/527/000002/999999/001" }), membership).kind, "unknown-village");
  assert.equal(assignRow(row({ rural_or_urban: "Urban", unique_id: "2/15/527/802867/000012/001" }), membership).kind, "urban");
  assert.deepEqual(membership.districtBbox, [73.45, 17.45, 73.75, 17.65]);
});

test("rows roll up per Panchayat with the holder and type axes, points inside the district only", () => {
  const rows = [
    row(),
    row({ unique_id: "1/15/527/000001/563001/002", ref_water_body_type_id_name: "Ponds", water_body_ownership_name: "Panchayat", water_body_name: "Gaon Talav", latitude_dec: 137.87, longitude_dec: 4.24 }),
    row({ unique_id: "1/15/527/000001/563002/001" }),
    row({ unique_id: "1/15/527/000002/563003/001", latitude_dec: 17.52, longitude_dec: 73.52 }),
    row({ unique_id: "1/15/527/000001/563009/001" }),
    row({ unique_id: "1/15/527/000002/563004/001" }),
    row({ rural_or_urban: "Urban", unique_id: "2/15/527/802867/000012/001", town_municipalty_name: "SATARA (M CL)" }),
  ];
  const extract = buildWaterBodiesCensusExtract(rows, directory(), OPTIONS);
  assert.equal(extract.rowCount, 7);
  assert.equal(extract.ruralRowCount, 6);
  assert.equal(extract.featureCount, 4);
  assert.equal(extract.recordCount, 3);
  assert.deepEqual(extract.unassigned, { sharedVillage: 1, uncoveredVillage: 1, censusVillageWithoutLgdRow: 0, unknownVillage: 0, urban: 1 });
  assert.deepEqual(extract.unassignedByBlock, {
    "1": { sharedVillage: 1, uncoveredVillage: 0, censusVillageWithoutLgdRow: 0, unknownVillage: 0, urban: 0 },
    "2": { sharedVillage: 0, uncoveredVillage: 1, censusVillageWithoutLgdRow: 0, unknownVillage: 0, urban: 0 },
  });
  const first = extract.records.find((record) => record.lgdGramPanchayatCode === "100");
  assert.ok(first);
  assert.equal(first.count, 2);
  assert.equal(first.namedCount, 1);
  assert.equal(first.lgdBlockCode, "1");
  assert.deepEqual(first.byDepartment, [{ department: "Panchayat", count: 1 }, { department: "State WRD/State Irrigation", count: 1 }]);
  assert.deepEqual(first.byType, [{ type: "Ponds", count: 1 }, { type: "Tank", count: 1 }]);
  assert.equal(first.pointCount, 1, "the garbled coordinate is dropped");
  assert.deepEqual(first.points, [[73.55, 17.55]]);
  assert.equal(extract.pointsOutsideDistrict, 1);
  assert.equal(first.areaBasis, "withheld");
  assert.equal(first.areaHectares, 0);
  assert.equal(extract.records.find((record) => record.lgdGramPanchayatCode === "300")?.pointCount, 1, "a Panchayat without its own polygon still keeps points inside the district");
  assert.deepEqual(validateWaterBodiesCensusExtract(extract, identityFromDirectory(directory())), []);
});

test("a stated waterspread is summed; a templated return may not be called stated", () => {
  const rows = [row({ water_spread_area_of_water_body: 0.5 }), row({ unique_id: "1/15/527/000001/563001/002", water_spread_area_of_water_body: 2.25 })];
  const extract = buildWaterBodiesCensusExtract(rows, directory(), { ...OPTIONS, waterspread: "stated" });
  const record = extract.records[0];
  assert.equal(record.areaHectares, 2.75);
  assert.equal(record.largestAreaHectares, 2.25);
  assert.equal(record.areaBasis, "stated");

  const templated = Array.from({ length: 600 }, (_, index) =>
    row({ unique_id: `1/15/527/000001/563001/${String(index + 1).padStart(3, "0")}`, water_spread_area_of_water_body: index % 2 ? 4 : 5 }),
  );
  const diagnostic = diagnoseAttributes(templated);
  assert.equal(diagnostic.distinctWaterspreadValues, 2);
  assert.ok(looksTemplated(diagnostic));
  assert.throws(() => buildWaterBodiesCensusExtract(templated, directory(), { ...OPTIONS, waterspread: "stated" }), /needs a review/);
  const withheld = buildWaterBodiesCensusExtract(templated, directory(), OPTIONS);
  assert.equal(withheld.records[0].count, 600);
  assert.equal(withheld.records[0].areaHectares, 0);
});

test("the validator refuses a record for a Panchayat the district does not have, a key in the served url, and a stated area under withheld", () => {
  const identity = identityFromDirectory(directory());
  const extract = buildWaterBodiesCensusExtract([row()], directory(), OPTIONS);
  const stranger = { ...extract, records: [{ ...extract.records[0], lgdGramPanchayatCode: "999" }] };
  stranger.recordsSha256 = extract.recordsSha256;
  assert.ok(validateWaterBodiesCensusExtract(stranger, identity).some((e) => /digest/.test(e)));
  const leaked = { ...extract, source: { ...extract.source, sourceUrl: `${extract.source.sourceUrl}&api-key=secret` } };
  assert.ok(validateWaterBodiesCensusExtract(leaked, identity).some((e) => /API key/.test(e)));
  const areaUnderWithheld = { ...extract, records: [{ ...extract.records[0], areaHectares: 4 }] };
  assert.ok(validateWaterBodiesCensusExtract(areaUnderWithheld, identity).some((e) => /withheld but an area/.test(e)));
});

for (const fixture of LGD_FIXTURE_DISTRICTS.filter((entry) => fixtureSlugsPresent().includes(entry.slug))) {
  test(`${fixture.slug}: the served census shard is internally consistent and every Panchayat is the directory's`, () => {
    const shard = readFixture<WaterBodiesShard>(fixture.slug, "water-bodies", `${fixture.block}.geojson`);
    const identity = identityFromDirectory(readFixtureArtifacts(fixture.slug).directory);
    assert.equal(shard.ext.atlas.register, "water-bodies-census");
    assert.equal(shard.ext.atlas.rights.status, "open");
    assert.equal(shard.ext.atlas.attributes?.waterspread, "withheld");
    assert.equal(shard.features.reduce((total, feature) => total + feature.properties.count, 0), shard.ext.atlas.featureCount);
    for (const feature of shard.features) {
      assert.ok(identity.gramPanchayats.has(feature.properties.lgdGramPanchayatCode));
      assert.equal(feature.properties.lgdBlockCode, fixture.block);
      assert.equal(feature.properties.register, "water-bodies-census");
      assert.equal(feature.properties.areaHectares, 0);
      const points = feature.geometry?.coordinates.length ?? 0;
      assert.equal(points, feature.properties.pointCount);
      assert.ok(points <= feature.properties.count);
    }
    assert.ok(!/api-key=/.test(shard.ext.atlas.sourceUrl));
    assert.ok(shard.ext.atlas.unassigned && shard.ext.atlas.unassignedDistrict, "unassigned rows are counted on the shard, for the block and the district");
    assert.ok(shard.ext.atlas.unassignedDistrict.urban >= shard.ext.atlas.unassigned.urban);
  });
}
