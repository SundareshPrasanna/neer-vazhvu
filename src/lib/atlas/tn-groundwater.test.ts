import assert from "node:assert/strict";
import test from "node:test";

import { computeRecordsSha256 } from "./acquisition-validation";
import type { GroundwaterTaluksArtifact } from "./artifacts";
import {
  buildTnDistrictGroundwaterExtract,
  normalizeGroundwaterRow,
  summarizeGroundwater,
  validateTnDistrictGroundwaterExtract,
} from "./tn-groundwater";
import { readFixture } from "./test-support";

const thanjavur = readFixture<GroundwaterTaluksArtifact>("thanjavur", "groundwater-taluks.json");
const tiruchirappalli = readFixture<GroundwaterTaluksArtifact>("tiruchirappalli", "groundwater-taluks.json");

test("the served taluk artifacts validate and carry their envelope", () => {
  for (const extract of [thanjavur, tiruchirappalli]) {
    assert.deepEqual(validateTnDistrictGroundwaterExtract(extract), []);
    assert.equal(extract.dataset, "atlas/groundwater-taluks");
    assert.equal(extract.provenance.method, "api");
    assert.equal(extract.provenance.produced_at, extract.acquiredAt);
    assert.equal(extract.provenance.sources[0].id, "ingres-gw-assessment-tn");
  }
});

test("Thanjavur reports nine over-drawn taluks against an over-exploited district", () => {
  assert.equal(thanjavur.district.category, "over_exploited");
  assert.equal(thanjavur.district.stageOfExtractionPercent, 100.8433);
  const summary = summarizeGroundwater(thanjavur);
  assert.equal(summary.assessmentUnits, 9);
  assert.deepEqual(summary.byCategory, { over_exploited: 6, critical: 1, semi_critical: 2 });
  assert.equal(summary.worst?.locationName, "THIRUVIDAIMARUDHUR");
  assert.equal(summary.worst?.stageOfExtractionPercent, 124.7696);
});

test("Tiruchirappalli carries the sharper single unit on a milder district", () => {
  assert.equal(tiruchirappalli.district.category, "semi_critical");
  const summary = summarizeGroundwater(tiruchirappalli);
  assert.equal(summary.assessmentUnits, 11);
  assert.equal(summary.worst?.locationName, "MANAPPARAI");
  assert.ok((summary.worst?.stageOfExtractionPercent ?? 0) > 140);
});

test("assessment units are recorded as revenue hierarchy, not Panchayat", () => {
  for (const extract of [thanjavur, tiruchirappalli]) {
    assert.equal(extract.source.hierarchy, "revenue");
    assert.equal(extract.source.assessmentUnitType, "TALUK");
    for (const record of extract.records) assert.equal(record.locationType, "TALUK");
  }
});

test("the portal's synthetic total row is never an assessment unit", () => {
  const built = buildTnDistrictGroundwaterExtract({
    planId: "tn-test-v1",
    assessmentYear: "2024-2025",
    acquiredAt: "2026-07-25",
    assessmentUnitType: "TALUK",
    portalUrl: "https://ingres.iith.ac.in/",
    districtRow: { locationName: "TEST", locationUUID: "d-1", category: { total: "critical" }, stageOfExtraction: { total: 92 } },
    unitRows: [
      { locationName: "UNIT A", locationUUID: "u-1", category: { total: "over_exploited" }, stageOfExtraction: { total: 120 } },
      { locationName: "total", locationUUID: "t-1" },
    ],
  });
  assert.equal(built.recordCount, 1);
  assert.equal(built.records[0].locationName, "UNIT A");
  assert.equal(built.district.category, "critical");
});

test("a single-year edition label is rejected", () => {
  const tampered = { ...thanjavur, assessmentYear: "2024" };
  assert.ok(validateTnDistrictGroundwaterExtract(tampered).some((error) => error.includes("assessmentYear")));
});

test("claiming a Panchayat hierarchy is rejected", () => {
  const tampered = { ...thanjavur, source: { ...thanjavur.source, hierarchy: "panchayat" as never } };
  assert.ok(validateTnDistrictGroundwaterExtract(tampered).some((error) => error.includes("revenue")));
});

test("a category without a stage of extraction is rejected", () => {
  const records = [{ ...thanjavur.records[0], stageOfExtractionPercent: null }, ...thanjavur.records.slice(1)];
  const tampered = { ...thanjavur, records, recordsSha256: computeRecordsSha256(records) };
  assert.ok(
    validateTnDistrictGroundwaterExtract(tampered).some((error) => error.includes("without a stage of extraction")),
  );
});

test("nested portal figures are read without inventing values", () => {
  const record = normalizeGroundwaterRow(
    {
      locationName: " ORATHANADU ",
      locationUUID: "u-9",
      category: { total: "over_exploited", non_command: "over_exploited" },
      stageOfExtraction: { total: 108.1591, non_command: 111.2 },
      totalGWAvailability: { total: 5000.5 },
      rainfall: { total: 1033.32719 },
      availabilityForFutureUse: {},
    },
    "TALUK",
  );
  assert.equal(record.locationName, "ORATHANADU");
  assert.equal(record.category, "over_exploited");
  assert.equal(record.stageOfExtractionPercent, 108.1591);
  assert.equal(record.totalAvailabilityHam, 5000.5);
  assert.equal(record.rainfallMm, 1033.3272);
  assert.equal(record.availabilityForFutureUseHam, null);
  assert.equal(record.annualRechargeHam, null);
});
