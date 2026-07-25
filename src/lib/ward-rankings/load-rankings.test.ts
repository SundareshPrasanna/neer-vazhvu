import assert from "node:assert/strict";
import test from "node:test";

import { loadWardRankings } from "./load-rankings";

// Smoke tests against the real on-disk data files. They guard against:
//   - schema drift (a column rename in ward-risk-madurai.json breaks
//     the loader)
//   - sort/normalisation bugs (rank=1 should always be the best ward)
//   - city dispatch (loadWardRankings('chennai') uses the live
//     ward-profiles compute path; loadWardRankings('madurai') uses the
//     pre-baked file)
//
// Intentionally not synthetic: the real data is the contract.

test("madurai bundle loads with all 100 wards and ranks ascending", () => {
  const bundle = loadWardRankings("madurai");
  assert.ok(bundle, "expected madurai bundle to load");
  assert.equal(bundle.cityId, "madurai");
  assert.equal(bundle.rows.length, 100);
  // Rank should be 1..N in ascending order after the loader sorts.
  bundle.rows.forEach((row, idx) => {
    assert.equal(row.rank, idx + 1, `row ${idx} should have rank ${idx + 1}`);
  });
  // Rank 1 = best (lowest composite score, since Madurai's model is
  // risk where lower = better).
  assert.ok(
    bundle.rows[0].compositeScore <= bundle.rows[bundle.rows.length - 1].compositeScore,
    "best ward should have <= composite score than worst",
  );
});

test("madurai bundle exposes the expected metric columns", () => {
  const bundle = loadWardRankings("madurai");
  assert.ok(bundle);
  const firstRow = bundle.rows[0];
  const metricKeys = firstRow.metricColumns.map((m) => m.key).sort();
  assert.deepEqual(metricKeys, [
    "gw_depth_m",
    "wb_density_per_sqkm",
    "wb_health_score",
  ]);
});

test("madurai grade counts sum to total ward count", () => {
  const bundle = loadWardRankings("madurai");
  assert.ok(bundle);
  const sum = Object.values(bundle.gradeCounts).reduce((a, b) => a + b, 0);
  assert.equal(sum, bundle.rows.length);
});

test("madurai zones list is non-empty and unique", () => {
  const bundle = loadWardRankings("madurai");
  assert.ok(bundle);
  assert.ok(bundle.zones.length > 0);
  assert.equal(
    new Set(bundle.zones).size,
    bundle.zones.length,
    "zones should be distinct",
  );
});

test("chennai bundle loads with 200 wards and ranks ascending", () => {
  const bundle = loadWardRankings("chennai");
  assert.ok(bundle, "expected chennai bundle to load");
  assert.equal(bundle.cityId, "chennai");
  assert.equal(bundle.rows.length, 200);
  bundle.rows.forEach((row, idx) => {
    assert.equal(row.rank, idx + 1);
  });
});

test("chennai metric columns include flood + drainage + sewerage", () => {
  const bundle = loadWardRankings("chennai");
  assert.ok(bundle);
  const metricKeys = new Set(
    bundle.rows[0].metricColumns.map((m) => m.key),
  );
  assert.ok(metricKeys.has("flood_risk"));
  assert.ok(metricKeys.has("drainage"));
  assert.ok(metricKeys.has("sewerage_infra"));
});

// Was "delhi" until 2026-07-25, when Delhi gained risk_v2_dl and stopped
// being an unknown city. Use a name that is not a city so the test keeps
// asserting the fallback rather than a particular city's absence.
test("unknown city returns null", () => {
  const bundle = loadWardRankings("atlantis");
  assert.equal(bundle, null);
});

test("delhi returns the risk_v2_dl bundle", () => {
  const bundle = loadWardRankings("delhi");
  assert.ok(bundle, "expected a Delhi bundle");
  assert.equal(bundle.cityId, "delhi");
  assert.equal(bundle.rows.length, 250);
  assert.equal(bundle.compositeScoreLowerIsBetter, true);
  // Wards with no CGWB well within range must stay null, never 0 - a
  // missing measurement is not water at the surface.
  const gw = bundle.rows[0].metricColumns.find((c) => c.key === "gw_depth_m");
  assert.ok(gw, "expected a groundwater-depth column");
  if (gw.numeric === null) assert.equal(gw.display, "-");
});
