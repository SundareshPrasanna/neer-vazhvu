import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDataMeetBoundaryExtract,
  buildPanchayatGeometries,
  parseDataMeetCrosswalk,
  sliceDataMeetDistrict,
  validateDataMeetBoundaryExtract,
  type DataMeetVillageFeature,
} from "./datameet-boundary";
import type { DistrictIdentity } from "./artifacts";

const square = (x: number, y: number): number[][][] => [
  [
    [x, y],
    [x + 0.01, y],
    [x + 0.01, y + 0.01],
    [x, y + 0.01],
    [x, y],
  ],
];

const features: DataMeetVillageFeature[] = [
  { properties: { DISTRICT: "Satara", CEN_2001: "A" }, geometry: { type: "Polygon", coordinates: square(74, 17) } },
  { properties: { DISTRICT: "Satara", CEN_2001: "B" }, geometry: { type: "Polygon", coordinates: square(74.02, 17) } },
  { properties: { DISTRICT: "Satara", CEN_2001: "C" }, geometry: { type: "Polygon", coordinates: square(74.04, 17) } },
  { properties: { DISTRICT: "Pune", CEN_2001: "Z" }, geometry: { type: "Polygon", coordinates: square(75, 18) } },
];

const crosswalkCsv = [
  "village_code_2011,village_name_2011,state_code_2011,district_code_2011,sub_district_code_2011,village_code_2001,village_name_2001,state_code_2001,district_code_2001,sub_district_code_2001,CEN_2001",
  "564320,Marul Haveli,27,527,4264,1,Marul Haveli,27,11,3,A",
  "564162,Marul tarf patan,27,527,4264,2,Marul tarf patan,27,11,3,B",
  "999999,Elsewhere,27,521,4000,3,Elsewhere,27,11,3,Z",
].join("\n");

test("the district slice and the 2001-to-2011 crosswalk are keyed on CEN_2001 within the district", () => {
  assert.equal(sliceDataMeetDistrict(features, "satara").length, 3);
  const crosswalk = parseDataMeetCrosswalk(crosswalkCsv, "527");
  assert.deepEqual([...crosswalk.keys()], ["A", "B"]);
  assert.equal(crosswalk.get("A")?.villageCode2011, "564320");
});

test("a Panchayat's geometry is the MultiPolygon of its drawn member villages, undrawn members named", () => {
  const crosswalk = parseDataMeetCrosswalk(crosswalkCsv, "527");
  const { geometries, villagePolygons, unmatchedFeatures } = buildPanchayatGeometries({
    features: sliceDataMeetDistrict(features, "Satara"),
    crosswalk,
    panchayats: [
      { lgdGramPanchayatCode: "189960", name: "Marul Haveli", lgdBlockCode: "4264", memberCensusCodes: ["564320"] },
      { lgdGramPanchayatCode: "189959", name: "Marul Tarf Patan", lgdBlockCode: "4264", memberCensusCodes: ["564162", "564163"] },
      { lgdGramPanchayatCode: "100000", name: "Undrawn", lgdBlockCode: "4264", memberCensusCodes: ["564999"] },
    ],
  });
  assert.equal(villagePolygons, 2);
  assert.equal(unmatchedFeatures, 1, "feature C has no crosswalk row");
  assert.equal(geometries.size, 2);
  const tarf = geometries.get("189959")!;
  assert.equal(tarf.geometry.type, "MultiPolygon");
  assert.deepEqual(tarf.memberVillagesDrawn, ["564162"]);
  assert.deepEqual(tarf.memberVillagesNotDrawn, ["564163"]);
  assert.equal(geometries.has("100000"), false);
});

test("the boundary extract carries ODbL rights and validates against the identity, gaps reported not rejected", () => {
  const crosswalk = parseDataMeetCrosswalk(crosswalkCsv, "527");
  const panchayats = [
    { lgdGramPanchayatCode: "189960", name: "Marul Haveli", lgdBlockCode: "4264", memberCensusCodes: ["564320"] },
    { lgdGramPanchayatCode: "100000", name: "Undrawn", lgdBlockCode: "4264", memberCensusCodes: ["564999"] },
  ];
  const { geometries } = buildPanchayatGeometries({ features: sliceDataMeetDistrict(features, "Satara"), crosswalk, panchayats });
  const extract = buildDataMeetBoundaryExtract({
    planId: "mh-satara-v1",
    districtLgdCode: "494",
    acquiredAt: "2026-09-01",
    sourceUrl: "https://example.test/mh2.geojson",
    crosswalkUrl: "https://example.test/mh.csv",
    snapshotSha256: "a".repeat(64),
    geometries,
    panchayats,
    area: () => 1_000_000,
    bbox: () => [74, 17, 74.01, 17.01],
  });
  assert.equal(extract.recordCount, 1);
  assert.deepEqual(extract.panchayatsWithoutGeometry, ["100000"]);
  assert.equal(extract.source.rights.status, "share-alike");
  assert.equal(extract.source.rights.license, "ODbL 1.0");
  const identity: DistrictIdentity = {
    planId: "mh-satara-v1",
    gramPanchayats: new Map([
      ["189960", { name: "Marul Haveli", blockCode: "4264", blockName: "Patan" }],
      ["100000", { name: "Undrawn", blockCode: "4264", blockName: "Patan" }],
    ]),
    blocks: new Map([["4264", "Patan"]]),
    jjmVillagePaths: new Set(),
    censusVillageCodes: new Set(),
  };
  assert.deepEqual(validateDataMeetBoundaryExtract(extract, identity), []);
  const wrongBlock = structuredClone(extract);
  wrongBlock.records[0].lgdBlockCode = "4265";
  assert.ok(validateDataMeetBoundaryExtract(wrongBlock, identity).some((error) => error.includes("LGD block")));
  const stray = structuredClone(extract);
  stray.records[0].lgdGramPanchayatCode = "555555";
  assert.ok(validateDataMeetBoundaryExtract(stray, identity).some((error) => error.includes("matches no Gram Panchayat")));
});
