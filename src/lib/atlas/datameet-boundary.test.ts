import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDataMeetBoundaryExtract,
  buildPanchayatGeometries,
  dataMeetFeatureKey,
  parseDataMeetCrosswalk,
  parseDataMeetVillageCodeMapping,
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

// Karnataka: codes on the feature and a semicolon mapping file (ka.geojson).
test("the village-code mapping joins on the 2001 district and village code, splits left out", () => {
  const mapping = [
    "village_code_2011;village_name_2011;state_code_2011;district_code_2011;sub_district_code_2011;village_code_2001;village_name_2001;state_code_2001;district_code_2001;sub_district_code_2001",
    "622340;Masthi;29;581;5592;1831400;Masthi;29;19;9",
    "622345;Appaiana Agrahara;29;581;5592;1831900;Appaiana Agrahara;29;19;9",
    // one 2001 village that became two 2011 villages: neither is drawn from it
    "622400;North;29;581;5592;1840000;Split;29;19;9",
    "622401;South;29;581;5592;1840000;Split;29;19;9",
    // a Chikkaballapur village under the same 2001 district
    "623000;Elsewhere;29;582;5595;1900000;Elsewhere;29;19;1",
    "622999;Town part;29;581;5592;;Town part;29;19;9",
  ].join("\r\n");
  const { rows, splitVillages2001 } = parseDataMeetVillageCodeMapping(mapping, "581");
  assert.equal(splitVillages2001, 1);
  assert.deepEqual([...rows.keys()].sort(), ["19:1831400", "19:1831900"]);
  const kaFeatures: DataMeetVillageFeature[] = [
    { properties: { DISTRICT: "Kolar", DIST_CODE: "19", V_CT_CODE: "01831400" }, geometry: { type: "Polygon", coordinates: square(78, 13) } },
    { properties: { DISTRICT: "Kolar", DIST_CODE: "19", V_CT_CODE: "" }, geometry: { type: "Polygon", coordinates: square(78.1, 13) } },
    { properties: { DISTRICT: "Kolar", DIST_CODE: "19", V_CT_CODE: "01900000" }, geometry: { type: "Polygon", coordinates: square(78.2, 13) } },
  ];
  assert.equal(dataMeetFeatureKey(kaFeatures[0], "village-code-mapping"), "19:1831400");
  assert.equal(dataMeetFeatureKey(kaFeatures[1], "village-code-mapping"), "");
  const { geometries, unmatchedFeatures } = buildPanchayatGeometries({
    features: kaFeatures,
    crosswalk: rows,
    format: "village-code-mapping",
    panchayats: [
      { lgdGramPanchayatCode: "218979", name: "Masthi", lgdBlockCode: "5592", memberCensusCodes: ["622340", "622345"] },
    ],
  });
  assert.equal(unmatchedFeatures, 2);
  assert.deepEqual(geometries.get("218979")?.memberVillagesDrawn, ["622340"]);
  assert.deepEqual(geometries.get("218979")?.memberVillagesNotDrawn, ["622345"]);
});
