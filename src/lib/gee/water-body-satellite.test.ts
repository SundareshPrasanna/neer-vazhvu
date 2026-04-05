import assert from "node:assert/strict";
import test from "node:test";

import {
  satelliteAnomalyPercent,
  normalizeWaterBodySatelliteSummary,
  satelliteAnomalyTone,
  shouldShowWaterBodySatelliteSummary,
} from "./water-body-satellite";

test("normalizeWaterBodySatelliteSummary converts snake_case API rows", () => {
  const row = normalizeWaterBodySatelliteSummary({
    gee_target_id: "osm:25394523",
    summary_date: "2026-03-30",
    osm_id: 25394523,
    census_id: null,
    name: "Sholavaram Lake",
    historical_persistence_pct: 100,
    latest_observed_area_ha: 437.47,
    seasonal_baseline_area_ha: 356.16,
    anomaly_ratio: 1.228,
    surface_water_anomaly_level: "higher",
    observation_start: "2026-02-18",
    observation_end: "2026-03-30",
    sensor_source: "sentinel2_ndwi",
    confidence_level: "high",
    valid_pixel_pct: 99.31,
  });

  assert.equal(row.geeTargetId, "osm:25394523");
  assert.equal(row.historicalPersistencePct, 100);
  assert.equal(row.confidenceLevel, "high");
});

test("shouldShowWaterBodySatelliteSummary hides low-confidence rows", () => {
  assert.equal(shouldShowWaterBodySatelliteSummary(null), false);
  assert.equal(
    shouldShowWaterBodySatelliteSummary(
      normalizeWaterBodySatelliteSummary({
        gee_target_id: "osm:1",
        summary_date: "2026-03-30",
        osm_id: 1,
        census_id: null,
        name: "Test",
        historical_persistence_pct: 50,
        latest_observed_area_ha: 10,
        seasonal_baseline_area_ha: 12,
        anomaly_ratio: 0.8,
        surface_water_anomaly_level: "lower",
        observation_start: "2026-02-18",
        observation_end: "2026-03-30",
        sensor_source: "sentinel2_ndwi",
        confidence_level: "low",
        valid_pixel_pct: 25,
      }),
    ),
    false,
  );
});

test("satelliteAnomalyTone collapses detailed anomaly levels into simple copy buckets", () => {
  assert.equal(satelliteAnomalyTone("much_lower"), "lower");
  assert.equal(satelliteAnomalyTone("lower"), "lower");
  assert.equal(satelliteAnomalyTone("near_normal"), "near_normal");
  assert.equal(satelliteAnomalyTone("higher"), "higher");
  assert.equal(satelliteAnomalyTone("much_higher"), "higher");
});

test("satelliteAnomalyPercent converts ratio into rounded percentage delta", () => {
  assert.equal(satelliteAnomalyPercent(1.228), 23);
  assert.equal(satelliteAnomalyPercent(0.8), -20);
  assert.equal(satelliteAnomalyPercent(null), null);
});
