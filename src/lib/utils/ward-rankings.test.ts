import assert from "node:assert/strict";
import test from "node:test";

import type { WardProfile } from "@/lib/hooks/use-ward-profile";

import { computeWardRankings } from "./ward-rankings";

function buildWardProfile(
  overrides: Partial<WardProfile> & Pick<WardProfile, "ward_number">,
): WardProfile {
  return {
    zone_no: "I",
    zone_name: "Zone I",
    centroid: [80, 13],
    area_sq_km: 1,
    water_bodies: {
      current_count: 1,
      census_records: 0,
      restoration_critical: 0,
      restoration_high: 0,
      avg_restoration_score: 50,
      top_bodies: [],
      ...overrides.water_bodies,
    },
    lost_bodies: {
      count: 0,
      names: [],
      ...overrides.lost_bodies,
    },
    flood: {
      hazard_zone_count: 1,
      by_category: { high: 1 },
      dominant_hazard: "high",
      hotspot_2015_count: 0,
      hotspot_2020_count: 0,
      ...overrides.flood,
    },
    drainage: {
      line_count: 1,
      total_length_km: 1,
      ...overrides.drainage,
    },
    sewerage: {
      stp_count: 0,
      sps_count: 1,
      pumping_main_count: 1,
      pumping_main_length_km: 1,
      total_stp_capacity_mld: 0,
      ...overrides.sewerage,
    },
    rivers: {
      nearest_station_id: null,
      nearest_river_id: null,
      nearest_km: null,
      ...overrides.rivers,
    },
    industrial: {
      zone_count: 0,
      ...overrides.industrial,
    },
    ...overrides,
  };
}

test("overall percentile is based on citywide composite rank, not raw composite score", () => {
  const profiles: WardProfile[] = [
    buildWardProfile({
      ward_number: 1,
      water_bodies: { current_count: 1, census_records: 0, restoration_critical: 0, restoration_high: 0, avg_restoration_score: 20, top_bodies: [] },
      flood: { hazard_zone_count: 1, by_category: { high: 1 }, dominant_hazard: "high", hotspot_2015_count: 0, hotspot_2020_count: 0 },
      drainage: { line_count: 1, total_length_km: 3 },
      sewerage: { stp_count: 0, sps_count: 2, pumping_main_count: 2, pumping_main_length_km: 3, total_stp_capacity_mld: 0 },
    }),
    buildWardProfile({
      ward_number: 2,
      water_bodies: { current_count: 1, census_records: 0, restoration_critical: 0, restoration_high: 0, avg_restoration_score: 10, top_bodies: [] },
      flood: { hazard_zone_count: 1, by_category: { high: 2 }, dominant_hazard: "high", hotspot_2015_count: 0, hotspot_2020_count: 0 },
      drainage: { line_count: 1, total_length_km: 2 },
      sewerage: { stp_count: 0, sps_count: 1, pumping_main_count: 1, pumping_main_length_km: 2, total_stp_capacity_mld: 0 },
    }),
    buildWardProfile({
      ward_number: 3,
      water_bodies: { current_count: 1, census_records: 0, restoration_critical: 0, restoration_high: 0, avg_restoration_score: 30, top_bodies: [] },
      flood: { hazard_zone_count: 1, by_category: { high: 3 }, dominant_hazard: "high", hotspot_2015_count: 0, hotspot_2020_count: 0 },
      drainage: { line_count: 1, total_length_km: 1 },
      sewerage: { stp_count: 0, sps_count: 0, pumping_main_count: 1, pumping_main_length_km: 1, total_stp_capacity_mld: 0 },
    }),
  ];

  const rankings = computeWardRankings(2, profiles);
  assert.ok(rankings);
  assert.equal(rankings.overallRank, 2);
  assert.equal(rankings.overallPercentile, 50);
  assert.equal(rankings.overallGrade, "C");
  assert.equal(rankings.overallScore, 62.5);
});

test("missing metrics contribute a neutral score instead of being dropped from the composite", () => {
  const profiles: WardProfile[] = [
    buildWardProfile({
      ward_number: 1,
      water_bodies: { current_count: 1, census_records: 0, restoration_critical: 0, restoration_high: 0, avg_restoration_score: 10, top_bodies: [] },
      flood: { hazard_zone_count: 1, by_category: { high: 1 }, dominant_hazard: "high", hotspot_2015_count: 0, hotspot_2020_count: 0 },
      drainage: { line_count: 1, total_length_km: 3 },
      sewerage: { stp_count: 0, sps_count: 2, pumping_main_count: 2, pumping_main_length_km: 3, total_stp_capacity_mld: 0 },
    }),
    buildWardProfile({
      ward_number: 2,
      water_bodies: { current_count: 0, census_records: 0, restoration_critical: 0, restoration_high: 0, avg_restoration_score: null, top_bodies: [] },
      flood: { hazard_zone_count: 1, by_category: { high: 1 }, dominant_hazard: "high", hotspot_2015_count: 0, hotspot_2020_count: 0 },
      drainage: { line_count: 1, total_length_km: 3 },
      sewerage: { stp_count: 0, sps_count: 2, pumping_main_count: 2, pumping_main_length_km: 3, total_stp_capacity_mld: 0 },
    }),
    buildWardProfile({
      ward_number: 3,
      water_bodies: { current_count: 1, census_records: 0, restoration_critical: 0, restoration_high: 0, avg_restoration_score: 30, top_bodies: [] },
      flood: { hazard_zone_count: 1, by_category: { high: 3 }, dominant_hazard: "high", hotspot_2015_count: 0, hotspot_2020_count: 0 },
      drainage: { line_count: 1, total_length_km: 1 },
      sewerage: { stp_count: 0, sps_count: 0, pumping_main_count: 1, pumping_main_length_km: 1, total_stp_capacity_mld: 0 },
    }),
  ];

  const rankings = computeWardRankings(2, profiles);
  assert.ok(rankings);
  assert.equal(rankings.metrics.find((metric) => metric.key === "wb_health")?.grade, null);
  assert.equal(rankings.overallRank, 2);
  assert.equal(rankings.overallPercentile, 50);
  assert.equal(rankings.overallScore, 82.5);
});

test("zero severe flood zones are scored as best-case flood exposure, not omitted", () => {
  const profiles: WardProfile[] = [
    buildWardProfile({
      ward_number: 1,
      flood: { hazard_zone_count: 0, by_category: {}, dominant_hazard: null, hotspot_2015_count: 0, hotspot_2020_count: 0 },
    }),
    buildWardProfile({
      ward_number: 2,
      flood: { hazard_zone_count: 1, by_category: { high: 1 }, dominant_hazard: "high", hotspot_2015_count: 0, hotspot_2020_count: 0 },
    }),
    buildWardProfile({
      ward_number: 3,
      flood: { hazard_zone_count: 2, by_category: { high: 2 }, dominant_hazard: "high", hotspot_2015_count: 0, hotspot_2020_count: 0 },
    }),
  ];

  const rankings = computeWardRankings(1, profiles);
  assert.ok(rankings);
  const floodMetric = rankings.metrics.find((metric) => metric.key === "flood_risk");
  assert.ok(floodMetric);
  assert.equal(floodMetric.value, 0);
  assert.equal(floodMetric.rank, 1);
  assert.equal(floodMetric.total, 3);
  assert.equal(floodMetric.grade, "A");
});

test("zero-area wards treat density metrics as not applicable instead of best-in-class", () => {
  const profiles: WardProfile[] = [
    buildWardProfile({
      ward_number: 1,
      area_sq_km: 0,
      water_bodies: { current_count: 2, census_records: 0, restoration_critical: 0, restoration_high: 0, avg_restoration_score: 40, top_bodies: [] },
      flood: { hazard_zone_count: 0, by_category: {}, dominant_hazard: null, hotspot_2015_count: 0, hotspot_2020_count: 0 },
      drainage: { line_count: 1, total_length_km: 5 },
      sewerage: { stp_count: 0, sps_count: 2, pumping_main_count: 1, pumping_main_length_km: 3, total_stp_capacity_mld: 0 },
    }),
    buildWardProfile({
      ward_number: 2,
      water_bodies: { current_count: 1, census_records: 0, restoration_critical: 0, restoration_high: 0, avg_restoration_score: 30, top_bodies: [] },
      flood: { hazard_zone_count: 1, by_category: { high: 1 }, dominant_hazard: "high", hotspot_2015_count: 0, hotspot_2020_count: 0 },
      drainage: { line_count: 1, total_length_km: 2 },
      sewerage: { stp_count: 0, sps_count: 1, pumping_main_count: 1, pumping_main_length_km: 2, total_stp_capacity_mld: 0 },
    }),
    buildWardProfile({
      ward_number: 3,
      water_bodies: { current_count: 1, census_records: 0, restoration_critical: 0, restoration_high: 0, avg_restoration_score: 20, top_bodies: [] },
      flood: { hazard_zone_count: 2, by_category: { high: 2 }, dominant_hazard: "high", hotspot_2015_count: 0, hotspot_2020_count: 0 },
      drainage: { line_count: 1, total_length_km: 1 },
      sewerage: { stp_count: 0, sps_count: 1, pumping_main_count: 1, pumping_main_length_km: 1, total_stp_capacity_mld: 0 },
    }),
  ];

  const rankings = computeWardRankings(1, profiles);
  assert.ok(rankings);
  assert.equal(rankings.metrics.length, 5);

  for (const key of ["wb_density", "flood_risk", "drainage", "sewerage_infra"]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metric: any = rankings.metrics.find((entry) => entry.key === key);
    assert.ok(metric);
    assert.equal(metric.value, null);
    assert.equal(metric.rank, null);
    assert.equal(metric.grade, null);
  }
});

test("overall grade uses the rounded percentile shown to users", () => {
  const profiles: WardProfile[] = Array.from({ length: 200 }, (_, index) => {
    const wardNumber = index + 1;
    const descending = 201 - wardNumber;

    return buildWardProfile({
      ward_number: wardNumber,
      area_sq_km: 1,
      water_bodies: {
        current_count: descending,
        census_records: 0,
        restoration_critical: 0,
        restoration_high: 0,
        avg_restoration_score: wardNumber,
        top_bodies: [],
      },
      flood: {
        hazard_zone_count: wardNumber - 1,
        by_category: wardNumber > 1 ? { high: wardNumber - 1 } : {},
        dominant_hazard: wardNumber > 1 ? "high" : null,
        hotspot_2015_count: 0,
        hotspot_2020_count: 0,
      },
      drainage: {
        line_count: descending,
        total_length_km: descending,
      },
      sewerage: {
        stp_count: 0,
        sps_count: descending,
        pumping_main_count: descending,
        pumping_main_length_km: descending,
        total_stp_capacity_mld: 0,
      },
    });
  });

  const rankings = computeWardRankings(41, profiles);
  assert.ok(rankings);
  assert.equal(rankings.overallRank, 41);
  assert.equal(rankings.overallPercentile, 80);
  assert.equal(rankings.overallGrade, "A");
});

test("metric ranking uses raw precision instead of pre-rounded display values", () => {
  const profiles: WardProfile[] = [
    buildWardProfile({
      ward_number: 1,
      area_sq_km: 50,
      water_bodies: { current_count: 117, census_records: 0, restoration_critical: 0, restoration_high: 0, avg_restoration_score: 10, top_bodies: [] },
    }),
    buildWardProfile({
      ward_number: 2,
      area_sq_km: 50,
      water_bodies: { current_count: 118, census_records: 0, restoration_critical: 0, restoration_high: 0, avg_restoration_score: 10, top_bodies: [] },
    }),
    buildWardProfile({
      ward_number: 3,
      area_sq_km: 50,
      water_bodies: { current_count: 100, census_records: 0, restoration_critical: 0, restoration_high: 0, avg_restoration_score: 10, top_bodies: [] },
    }),
  ];

  const rankings = computeWardRankings(2, profiles);
  assert.ok(rankings);
  const densityMetric = rankings.metrics.find((metric) => metric.key === "wb_density");
  assert.ok(densityMetric);
  assert.ok(Math.abs((densityMetric.value ?? 0) - 2.36) < 1e-12);
  assert.equal(densityMetric.rank, 1);
});

test("sewerage ties are broken by SPS density, not raw SPS count", () => {
  const profiles: WardProfile[] = [
    buildWardProfile({
      ward_number: 1,
      area_sq_km: 10,
      sewerage: { stp_count: 0, sps_count: 5, pumping_main_count: 1, pumping_main_length_km: 10, total_stp_capacity_mld: 0 },
    }),
    buildWardProfile({
      ward_number: 2,
      area_sq_km: 1,
      sewerage: { stp_count: 0, sps_count: 1, pumping_main_count: 1, pumping_main_length_km: 1, total_stp_capacity_mld: 0 },
    }),
    buildWardProfile({
      ward_number: 3,
      area_sq_km: 1,
      sewerage: { stp_count: 0, sps_count: 0, pumping_main_count: 1, pumping_main_length_km: 0.5, total_stp_capacity_mld: 0 },
    }),
  ];

  const rankings = computeWardRankings(2, profiles);
  assert.ok(rankings);
  const sewerMetric = rankings.metrics.find((metric) => metric.key === "sewerage_infra");
  assert.ok(sewerMetric);
  assert.equal(sewerMetric.rank, 1);

  const otherRankings = computeWardRankings(1, profiles);
  assert.ok(otherRankings);
  const otherSewerMetric = otherRankings.metrics.find((metric) => metric.key === "sewerage_infra");
  assert.ok(otherSewerMetric);
  assert.equal(otherSewerMetric.rank, 2);
});
