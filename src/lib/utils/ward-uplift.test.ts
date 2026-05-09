import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import type { WardProfile } from "@/lib/hooks/use-ward-profile";
import { buildCityDistributions, buildProjectedProfile, computeGapAnalysis, computeUpliftPlan } from "./ward-uplift";
import { computeWardRankings, METRICS, percentileFromRank } from "./ward-rankings";
import { INTERVENTIONS } from "@/lib/data/uplift-benchmarks";

/* ── Load real profiles ────────────────────────────────────────────── */

const profilesPath = path.resolve("public/data/ward-profiles.json");
const allProfiles: WardProfile[] = JSON.parse(readFileSync(profilesPath, "utf-8"));
const cityDist = buildCityDistributions(allProfiles);

/* ── Helpers ────────────────────────────────────────────────────────── */

function getProfile(wardNumber: number): WardProfile {
  const p = allProfiles.find((w) => w.ward_number === wardNumber);
  if (!p) throw new Error(`Ward ${wardNumber} not found`);
  return p;
}

/* ── Tests ──────────────────────────────────────────────────────────── */

describe("computeGapAnalysis", () => {
  it("returns 5 metrics for a standard ward", () => {
    const gaps = computeGapAnalysis(15, allProfiles, cityDist);
    assert.equal(gaps.length, 5);
    const keys = gaps.map((g) => g.metricKey);
    assert.deepEqual(keys, ["wb_health", "wb_density", "flood_risk", "drainage", "sewerage_infra"]);
  });

  it("marks wb_health as not applicable for wards with no water bodies and no restoration score", () => {
    // Ward 13: 0 water bodies, area 0.44 sq km
    const gaps = computeGapAnalysis(13, allProfiles, cityDist);
    const wbHealth = gaps.find((g) => g.metricKey === "wb_health")!;
    assert.equal(wbHealth.applicable, false);
    assert.equal(wbHealth.currentValue, null);
    // Non-applicable metrics get neutral 50th percentile
    assert.equal(wbHealth.currentPercentile, 50);
    assert.equal(wbHealth.currentGrade, "C");
  });

  it("shows applicable = true for wards with water body data", () => {
    // Ward 15: 3 water bodies
    const gaps = computeGapAnalysis(15, allProfiles, cityDist);
    const wbHealth = gaps.find((g) => g.metricKey === "wb_health")!;
    assert.equal(wbHealth.applicable, true);
    assert.notEqual(wbHealth.currentValue, null);
  });

  it("has null gap for A-grade metrics", () => {
    // Find a ward with very high drainage (likely A)
    const gaps = computeGapAnalysis(32, allProfiles, cityDist);
    const drainage = gaps.find((g) => g.metricKey === "drainage")!;
    // Ward 32 has 12.94 km/sq km drainage - likely A
    if (drainage.currentGrade === "A") {
      assert.equal(drainage.gapToNextGrade, null);
      assert.equal(drainage.nextGrade, null);
    }
  });

  it("has non-null gap for non-A metrics", () => {
    // Ward 15: very low drainage (0.21 km/sq km) - should be F
    const gaps = computeGapAnalysis(15, allProfiles, cityDist);
    const drainage = gaps.find((g) => g.metricKey === "drainage")!;
    assert.notEqual(drainage.currentGrade, "A");
    assert.notEqual(drainage.gapToNextGrade, null);
    assert.notEqual(drainage.nextGrade, null);
    assert.ok(drainage.gapToNextGrade! > 0);
  });
});

describe("computeUpliftPlan - data-backed caps", () => {
  it("caps restore_water_body at restoration_critical + restoration_high", () => {
    const plan = computeUpliftPlan(189, allProfiles, 500, cityDist);
    assert.ok(plan);
    const restoreAlloc = plan.allocations.find((a) => a.interventionId === "restore_water_body");
    const ward = getProfile(189);
    const cap = ward.water_bodies.restoration_critical + ward.water_bodies.restoration_high;
    if (restoreAlloc) {
      assert.ok(restoreAlloc.units <= cap, `Allocated ${restoreAlloc.units} bodies but cap is ${cap}`);
    }
  });

  it("caps revive_water_body at lost_bodies.count", () => {
    // Ward 189 has 2 lost bodies
    const plan = computeUpliftPlan(189, allProfiles, 500, cityDist);
    assert.ok(plan);
    const reviveAlloc = plan.allocations.find((a) => a.interventionId === "revive_water_body");
    if (reviveAlloc) {
      assert.ok(reviveAlloc.units <= 2, `Allocated ${reviveAlloc.units} but only 2 lost bodies`);
    }
  });

  it("never allocates revive_water_body for wards with no lost bodies", () => {
    // Ward 15: 3 water bodies, 0 lost
    const plan = computeUpliftPlan(15, allProfiles, 500, cityDist);
    assert.ok(plan);
    const reviveAlloc = plan.allocations.find((a) => a.interventionId === "revive_water_body");
    assert.equal(reviveAlloc, undefined, "Should not recommend reviving bodies when none are lost");
  });

  it("never allocates WB interventions for wards with no water bodies and no lost bodies", () => {
    // Ward 13: 0 current, 0 lost
    const plan = computeUpliftPlan(13, allProfiles, 500, cityDist);
    assert.ok(plan);
    const wbAllocs = plan.allocations.filter(
      (a) => a.interventionId === "restore_water_body" || a.interventionId === "revive_water_body"
    );
    assert.equal(wbAllocs.length, 0, "No WB interventions for a ward with 0 bodies and 0 lost");
  });

  it("caps flood_mitigation at actual severe zone count", () => {
    // Ward 15 has flood zones
    const ward = getProfile(15);
    const severeZones =
      "_data_status" in ward.flood
        ? 0
        : (ward.flood.by_category["very_high"] ?? 0) + (ward.flood.by_category["high"] ?? 0);
    const plan = computeUpliftPlan(15, allProfiles, 500, cityDist);
    assert.ok(plan);
    const floodAlloc = plan.allocations.find((a) => a.interventionId === "flood_mitigation");
    if (floodAlloc) {
      assert.ok(floodAlloc.units <= severeZones, `Allocated ${floodAlloc.units} zones but only ${severeZones} severe`);
    }
  });
});

describe("computeUpliftPlan - discrete interventions", () => {
  it("allocates whole units for discrete interventions", () => {
    const plan = computeUpliftPlan(15, allProfiles, 100, cityDist);
    assert.ok(plan);
    for (const alloc of plan.allocations) {
      const intervention = INTERVENTIONS.find((i) => i.id === alloc.interventionId)!;
      if (intervention.resolution === "discrete") {
        assert.equal(
          alloc.units % 1, 0,
          `Discrete intervention ${alloc.interventionId} has fractional units: ${alloc.units}`,
        );
      }
    }
  });
});

describe("computeUpliftPlan - budget", () => {
  it("returns zero allocations for zero budget", () => {
    const plan = computeUpliftPlan(15, allProfiles, 0, cityDist);
    assert.ok(plan);
    assert.equal(plan.allocations.length, 0);
    assert.equal(plan.budgetSpentCr, 0);
    // Gap analysis should still be populated
    assert.equal(plan.gapAnalysis.length, 5);
  });

  it("does not overspend the budget", () => {
    const plan = computeUpliftPlan(15, allProfiles, 50, cityDist);
    assert.ok(plan);
    assert.ok(plan.budgetSpentCr <= 50, `Spent ${plan.budgetSpentCr} on a 50 Cr budget`);
  });

  it("spends most of a large budget when gaps exist", () => {
    // Ward 15 is weak across many factors - should use a lot of 200 Cr
    const plan = computeUpliftPlan(15, allProfiles, 200, cityDist);
    assert.ok(plan);
    assert.ok(plan.budgetSpentCr > 10, `Only spent ${plan.budgetSpentCr} Cr of 200 Cr`);
    assert.ok(plan.allocations.length > 0);
  });

  it("improves or maintains overall grade", () => {
    const plan = computeUpliftPlan(15, allProfiles, 100, cityDist);
    assert.ok(plan);
    assert.ok(
      plan.overallPercentileAfter >= plan.overallPercentileBefore,
      `Percentile decreased from ${plan.overallPercentileBefore} to ${plan.overallPercentileAfter}`,
    );
  });

  it("returns null for a non-existent ward", () => {
    const plan = computeUpliftPlan(999, allProfiles, 100, cityDist);
    assert.equal(plan, null);
  });
});

describe("computeUpliftPlan - cost ranges reconcile", () => {
  it("low cost <= mid cost <= high cost for each allocation", () => {
    const plan = computeUpliftPlan(15, allProfiles, 100, cityDist);
    assert.ok(plan);
    for (const alloc of plan.allocations) {
      assert.ok(alloc.costCrLow <= alloc.costCrMid, `${alloc.interventionId}: low > mid`);
      assert.ok(alloc.costCrMid <= alloc.costCrHigh, `${alloc.interventionId}: mid > high`);
    }
  });
});

describe("ranking parity with report card", () => {
  it("overallPercentileBefore matches computeWardRankings for all wards", () => {
    let mismatches = 0;
    for (const p of allProfiles) {
      const plan = computeUpliftPlan(p.ward_number, allProfiles, 0, cityDist);
      const report = computeWardRankings(p.ward_number, allProfiles);
      assert.ok(plan);
      assert.ok(report);
      if (plan.overallPercentileBefore !== report.overallPercentile) {
        mismatches++;
      }
    }
    assert.equal(mismatches, 0, `${mismatches}/200 wards have mismatched percentiles`);
  });

  it("overallGradeBefore matches computeWardRankings for all wards", () => {
    let mismatches = 0;
    for (const p of allProfiles) {
      const plan = computeUpliftPlan(p.ward_number, allProfiles, 0, cityDist);
      const report = computeWardRankings(p.ward_number, allProfiles);
      assert.ok(plan);
      assert.ok(report);
      if (plan.overallGradeBefore !== report.overallGrade) {
        mismatches++;
      }
    }
    assert.equal(mismatches, 0, `${mismatches}/200 wards have mismatched grades`);
  });
});

describe("computeGapAnalysis - zero gap edge cases", () => {
  it("never shows gapToNextGrade === 0 for non-A metrics", () => {
    let zeroGaps = 0;
    for (const p of allProfiles) {
      const gaps = computeGapAnalysis(p.ward_number, allProfiles, cityDist);
      for (const g of gaps) {
        if (g.applicable && g.currentGrade !== "A" && g.gapToNextGrade === 0) {
          zeroGaps++;
        }
      }
    }
    assert.equal(zeroGaps, 0, `Found ${zeroGaps} non-A metrics with gapToNextGrade === 0`);
  });
});

describe("after-state ranking parity", () => {
  it("overallPercentileAfter matches independent computeWardRankings recompute for all wards", () => {
    let mismatches = 0;
    const examples: string[] = [];
    for (const p of allProfiles) {
      const plan = computeUpliftPlan(p.ward_number, allProfiles, 100, cityDist);
      if (!plan) continue;

      // Independently build projected profile from plan allocations
      const projectedValues = new Map<string, number>();
      for (const alloc of plan.allocations) {
        projectedValues.set(alloc.metricKey, alloc.metricAfter);
      }
      // Fill unchanged metrics with original values
      for (const def of METRICS) {
        if (!projectedValues.has(def.key)) {
          const isApplicable = !def.applicable || def.applicable(p);
          if (isApplicable) projectedValues.set(def.key, def.extract(p));
        }
      }

      const projected = buildProjectedProfile(p, projectedValues);
      const modified = allProfiles.map(w =>
        w.ward_number === p.ward_number ? projected : w,
      );
      const rankings = computeWardRankings(p.ward_number, modified);
      if (!rankings) continue;

      if (plan.overallPercentileAfter !== rankings.overallPercentile) {
        mismatches++;
        if (examples.length < 5) {
          examples.push(
            `ward ${p.ward_number}: plan=${plan.overallPercentileAfter} vs recompute=${rankings.overallPercentile}`,
          );
        }
      }
    }
    assert.equal(mismatches, 0, `${mismatches}/200 wards mismatch. Examples: ${examples.join("; ")}`);
  });

  it("per-metric after grades match independent recompute for all allocations", () => {
    let mismatches = 0;
    for (const p of allProfiles) {
      const plan = computeUpliftPlan(p.ward_number, allProfiles, 100, cityDist);
      if (!plan || plan.allocations.length === 0) continue;

      const projectedValues = new Map<string, number>();
      for (const alloc of plan.allocations) {
        projectedValues.set(alloc.metricKey, alloc.metricAfter);
      }
      for (const def of METRICS) {
        if (!projectedValues.has(def.key)) {
          const isApplicable = !def.applicable || def.applicable(p);
          if (isApplicable) projectedValues.set(def.key, def.extract(p));
        }
      }

      const projected = buildProjectedProfile(p, projectedValues);
      const modified = allProfiles.map(w =>
        w.ward_number === p.ward_number ? projected : w,
      );
      const rankings = computeWardRankings(p.ward_number, modified);
      if (!rankings) continue;

      for (const alloc of plan.allocations) {
        const metric = rankings.metrics.find(m => m.key === alloc.metricKey);
        if (!metric || metric.grade == null) continue;
        if (alloc.gradeAfter !== metric.grade) {
          mismatches++;
        }
      }
    }
    assert.equal(mismatches, 0, `${mismatches} allocation after-grade mismatches`);
  });

  it("buildProjectedProfile round-trips: extract(projected) matches projected values", () => {
    let failures = 0;
    for (const p of allProfiles.slice(0, 50)) {
      const plan = computeUpliftPlan(p.ward_number, allProfiles, 100, cityDist);
      if (!plan || plan.allocations.length === 0) continue;

      const projectedValues = new Map<string, number>();
      for (const alloc of plan.allocations) {
        projectedValues.set(alloc.metricKey, alloc.metricAfter);
      }

      const projected = buildProjectedProfile(p, projectedValues);
      for (const [key, expected] of projectedValues) {
        const def = METRICS.find(m => m.key === key);
        if (!def) continue;
        const actual = def.extract(projected);
        if (Math.abs(actual - expected) > 0.01) {
          failures++;
        }
      }
    }
    assert.equal(failures, 0, `${failures} round-trip failures`);
  });
});
