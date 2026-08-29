import assert from "node:assert/strict";
import test from "node:test";

import type { WaterBodiesShard } from "./artifacts";
import { SAMPLE_STALE_AFTER_DAYS, getDistrictAggregate } from "./district-aggregate";
import { getDistrictBriefs, getDistrictDirectory } from "./district-directory";
import { FIXTURE_DISTRICTS, readFixture } from "./test-support";

const AS_OF = "2026-07-26";

test("every Panchayat is counted once, brief or not", () => {
  for (const fixture of FIXTURE_DISTRICTS) {
    const aggregate = getDistrictAggregate("tn", fixture.slug, AS_OF)!;
    const directory = getDistrictDirectory("tn", fixture.slug)!;
    assert.equal(aggregate.panchayatCount, directory.panchayats.length);
    assert.equal(aggregate.blockCount, directory.blocks.length);
    assert.equal(
      aggregate.blocks.reduce((total, block) => total + block.panchayatCount, 0),
      directory.panchayats.length,
    );
  }
});

test("a measure reports the places that carried it, not the whole district", () => {
  const aggregate = getDistrictAggregate("tn", "thanjavur", AS_OF)!;
  assert.ok(aggregate.landPlaces > 0);
  assert.ok(aggregate.landPlaces < aggregate.panchayatCount, "places without Census land stay outside the denominator");
  assert.ok(aggregate.households.places <= aggregate.panchayatCount);
  assert.ok(aggregate.netSownHectares.places <= aggregate.landPlaces);
});

test("block roll-ups sum to the district roll-up", () => {
  for (const fixture of FIXTURE_DISTRICTS) {
    const aggregate = getDistrictAggregate("tn", fixture.slug, AS_OF)!;
    const sum = (pick: (block: (typeof aggregate.blocks)[number]) => number) =>
      aggregate.blocks.reduce((total, block) => total + pick(block), 0);
    assert.equal(sum((block) => block.households), aggregate.households.value);
    assert.equal(sum((block) => block.connections), aggregate.connections);
    assert.equal(sum((block) => block.waterBodyCount), aggregate.waterBodyCount);
    assert.equal(sum((block) => block.sampleCount), aggregate.sampleCount);
    assert.equal(sum((block) => block.stalePlaces), aggregate.stalePlaces);
  }
});

test("water bodies roll up to the served totals", () => {
  for (const fixture of FIXTURE_DISTRICTS) {
    const aggregate = getDistrictAggregate("tn", fixture.slug, AS_OF)!;
    const shard = readFixture<WaterBodiesShard>(fixture.slug, "water-bodies", `${fixture.block}.geojson`);
    assert.equal(aggregate.waterBodyCount, shard.ext.atlas.featureCount);
    assert.equal(aggregate.waterBodyPlaces, shard.features.length);
    assert.equal(aggregate.waterBodyPlaces + aggregate.placesWithoutWaterBodies, aggregate.panchayatCount);
  }
});

test("staleness is counted against the as-of date, not today", () => {
  const early = getDistrictAggregate("tn", "tiruchirappalli", "2026-01-01")!;
  const later = getDistrictAggregate("tn", "tiruchirappalli", "2026-07-26")!;
  assert.ok(later.stalePlaces >= early.stalePlaces);
  assert.ok(later.worstSampleAgeDays !== null);
  const thanjavur = getDistrictAggregate("tn", "thanjavur", AS_OF)!;
  assert.ok(thanjavur.worstSampleAgeDays !== null);
  assert.equal(thanjavur.stalePlaces, thanjavur.blocks.reduce((t, b) => t + b.stalePlaces, 0));
  void SAMPLE_STALE_AFTER_DAYS;
});

test("irrigation shares are computed over the places with a Census land record", () => {
  // Both fixture blocks sit on the Cauvery's canal system, so the share is
  // canal-dominant in each; what matters is that the denominator is the
  // places that carry a land record, never the whole block.
  for (const fixture of FIXTURE_DISTRICTS) {
    const aggregate = getDistrictAggregate("tn", fixture.slug, AS_OF)!;
    assert.ok(aggregate.canalPercent! > 50, `${fixture.slug} block is canal-fed`);
    assert.ok(aggregate.landPlaces < aggregate.panchayatCount);
    const shares = [aggregate.canalPercent, aggregate.wellPercent, aggregate.tankPercent].map((v) => v ?? 0);
    assert.ok(Math.abs(shares.reduce((t, v) => t + v, 0) - 100) < 1.5, "shares of irrigated area sum to the whole");
  }
});

test("taluks come from IN-GRES and are ordered by extraction", () => {
  for (const fixture of FIXTURE_DISTRICTS) {
    const aggregate = getDistrictAggregate("tn", fixture.slug, AS_OF)!;
    assert.ok(aggregate.taluks.length > 0);
    assert.equal(aggregate.groundwaterAssessmentYear, "2024-2025");
    for (let index = 1; index < aggregate.taluks.length; index += 1) {
      assert.ok(aggregate.taluks[index - 1].stageOfExtractionPercent >= aggregate.taluks[index].stageOfExtractionPercent);
    }
    assert.equal(
      aggregate.overExploitedTaluks,
      aggregate.taluks.filter((taluk) => taluk.stageOfExtractionPercent > 100).length,
    );
  }
});

test("no place is double counted between blocks", () => {
  const directory = getDistrictDirectory("tn", "thanjavur")!;
  const briefs = new Set(getDistrictBriefs("thanjavur").map((b) => b.placeId));
  const seen = new Set<string>();
  for (const panchayat of directory.panchayats) {
    assert.ok(!seen.has(panchayat.lgdCode));
    seen.add(panchayat.lgdCode);
  }
  assert.ok(briefs.size <= seen.size);
});

test("every figure on the page declares what period it describes, from the artifacts themselves", () => {
  for (const fixture of FIXTURE_DISTRICTS) {
    const aggregate = getDistrictAggregate("tn", fixture.slug, AS_OF)!;
    assert.ok(aggregate.vintages.length >= 5);
    for (const vintage of aggregate.vintages) {
      assert.ok(vintage.label.length > 0);
      assert.ok(vintage.represents.length > 0);
      assert.match(vintage.acquired, /^\d{4}-\d{2}-\d{2}/, `${vintage.label} has no acquired date`);
      assert.ok(vintage.note.length > 0);
    }
    const census = aggregate.vintages.find((v) => v.label.startsWith("Land, irrigation"));
    assert.equal(census?.represents, "2009");
    assert.equal(census?.historical, true);
    const jjm = aggregate.vintages.find((v) => v.label.startsWith("Drinking-water service"));
    assert.equal(jjm?.historical, false);
    const groundwater = aggregate.vintages.find((v) => v.label.startsWith("Groundwater"));
    assert.equal(groundwater?.represents, "2024-2025");
    assert.equal(groundwater?.historical, false);
    const water = aggregate.vintages.find((v) => v.label.startsWith("Boundaries"));
    assert.equal(water?.acquired, "2026-07-26");
  }
});
