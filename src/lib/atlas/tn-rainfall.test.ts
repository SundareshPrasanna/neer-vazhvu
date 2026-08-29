import assert from "node:assert/strict";
import test from "node:test";

import { computeRecordsSha256 } from "./acquisition-validation";
import { identityFromDirectory, type DistrictDirectoryArtifact } from "./artifacts";
import { loadRainfall } from "./data";
import {
  RAINFALL_WINDOW_DAYS,
  haversineKm,
  summarizeDailyRainfall,
  summarizeRainfall,
  validateTnDistrictRainfallExtract,
} from "./tn-rainfall";
import { FIXTURE_DISTRICTS, districtBySlug, readFixture } from "./test-support";

test("daily totals ignore gaps and find the wettest day", () => {
  const summary = summarizeDailyRainfall(
    ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04"],
    [0, 12.5, null, 3.25],
  );
  assert.equal(summary.rainfallMm, 15.75);
  assert.equal(summary.daysWithRain, 2);
  assert.equal(summary.wettestDate, "2026-07-02");
  assert.equal(summary.wettestDayMm, 12.5);
});

test("a run of dry days reports zero rather than nothing", () => {
  const summary = summarizeDailyRainfall(["2026-07-01", "2026-07-02"], [0, 0]);
  assert.equal(summary.rainfallMm, 0);
  assert.equal(summary.daysWithRain, 0);
  assert.equal(summary.wettestDayMm, 0);
});

test("distance between two points is measured on the sphere", () => {
  assert.ok(Math.abs(haversineKm([10, 79], [11, 79]) - 111.19) < 0.5);
  assert.equal(haversineKm([10, 79], [10, 79]), 0);
});

for (const fixture of FIXTURE_DISTRICTS) {
  const district = districtBySlug(fixture.slug);
  const directory = readFixture<DistrictDirectoryArtifact>(fixture.slug, "directory.json");
  const identity = identityFromDirectory(directory);
  const rainfall = loadRainfall(district)!;

  test(`${fixture.slug} rainfall covers every Gram Panchayat once and stays inside the place`, () => {
    assert.deepEqual(validateTnDistrictRainfallExtract(rainfall, identity), []);
    assert.equal(rainfall.recordCount, fixture.panchayats);
    const codes = rainfall.records.map((record) => record.lgdGramPanchayatCode);
    assert.equal(new Set(codes).size, codes.length);
    const summary = summarizeRainfall(rainfall);
    assert.ok(summary.maxGridOffsetKm <= 15);
    assert.ok(summary.meanRainfallMm > 0);
  });

  test(`${fixture.slug} rainfall is labelled modelled, not measured, in artifact and envelope`, () => {
    assert.equal(rainfall.source.measurement, "modelled-reanalysis");
    assert.equal(rainfall.source.windowDays, RAINFALL_WINDOW_DAYS);
    assert.equal(rainfall.dataset, "atlas/rainfall");
    assert.equal(rainfall.provenance.sources[0].id, "open-meteo-archive");
    assert.match(String(rainfall.provenance.conventions?.measurement), /not a rain gauge/);
  });
}

const thanjavur = loadRainfall(districtBySlug("thanjavur"))!;
const identity = identityFromDirectory(readFixture<DistrictDirectoryArtifact>("thanjavur", "directory.json"));

test("rainfall older than the profile accepts is rejected", () => {
  const stale = { ...thanjavur, acquiredAt: "2026-09-30" };
  assert.ok(validateTnDistrictRainfallExtract(stale, identity).some((error) => error.includes("beyond the 30 day limit")));
});

test("claiming gauge measurement is rejected", () => {
  const tampered = { ...thanjavur, source: { ...thanjavur.source, measurement: "gauge-observed" as never } };
  assert.ok(validateTnDistrictRainfallExtract(tampered, identity).some((error) => error.includes("modelled values")));
});

test("a grid point far from the Panchayat is rejected", () => {
  const records = [{ ...thanjavur.records[0], gridOffsetKm: 40 }, ...thanjavur.records.slice(1)];
  const tampered = { ...thanjavur, records, recordsSha256: computeRecordsSha256(records) };
  assert.ok(validateTnDistrictRainfallExtract(tampered, identity).some((error) => error.includes("km from the Panchayat")));
});
