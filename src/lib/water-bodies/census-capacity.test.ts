import assert from "node:assert/strict";
import test from "node:test";

import { assessCensusCapacity, getCensusCapacityUpperBoundM3 } from "./census-capacity";

test("getCensusCapacityUpperBoundM3 converts spread area and max depth into cubic meters", () => {
  assert.equal(
    getCensusCapacityUpperBoundM3({
      water_spread_area: 0.24,
      max_depth_m: 5,
    } as never),
    12000,
  );
});

test("assessCensusCapacity flags physically inconsistent original capacity", () => {
  const assessment = assessCensusCapacity({
    storage_capacity_original: 17160,
    storage_capacity_present: 10,
    water_spread_area: 0.24,
    max_depth_m: 5,
    is_in_use: true,
    encroachment_status: "no",
    encroachment_pct: null,
  } as never);

  assert.equal(assessment.shouldHideCapacity, true);
  assert.deepEqual(
    assessment.issues.sort(),
    [
      "near_zero_present_but_in_use_no_encroachment",
      "original_exceeds_area_depth_upper_bound",
    ].sort(),
  );
});

test("assessCensusCapacity keeps capacity visible for encroachment mismatch warnings", () => {
  const assessment = assessCensusCapacity({
    storage_capacity_original: 10000,
    storage_capacity_present: 9500,
    water_spread_area: 1.0,
    max_depth_m: 2,
    is_in_use: true,
    encroachment_status: "yes",
    encroachment_pct: 75,
  } as never);

  assert.equal(assessment.shouldHideCapacity, false);
  assert.deepEqual(assessment.issues, ["encroachment_mismatch"]);
  assert.equal(assessment.capacityPct, 95);
});

test("assessCensusCapacity flags present capacity greater than original", () => {
  const assessment = assessCensusCapacity({
    storage_capacity_original: 1000,
    storage_capacity_present: 1200,
    water_spread_area: 0,
    max_depth_m: null,
    is_in_use: true,
    encroachment_status: "no",
    encroachment_pct: null,
  } as never);

  assert.equal(assessment.shouldHideCapacity, true);
  assert.deepEqual(assessment.issues, ["present_gt_original"]);
});
