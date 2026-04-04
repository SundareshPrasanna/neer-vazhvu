import assert from "node:assert/strict";
import test from "node:test";

import {
  hasWaterBodySatelliteEvidence,
  normalizeWaterBodySatelliteEvidenceFrame,
} from "./water-body-satellite-evidence";

test("normalizeWaterBodySatelliteEvidenceFrame maps snake_case payload to camelCase", () => {
  const row = normalizeWaterBodySatelliteEvidenceFrame({
    gee_target_id: "osm:25453624",
    reference_date: "2026-04-04",
    frame_date: "2026-03-25",
    frame_rank: 6,
    osm_id: 25453624,
    census_id: null,
    name: "Chembarambakkam Lake",
    target_cohort: "flagship-history",
    source_dataset: "sentinel2_harmonized",
    source_asset_id: "20260325T045701_20260325T050734_T44PLV",
    dynamic_world_asset_id: "20260325T045701_20260325T050734_T44PLV",
    image_path: "flagship-history/osm-25453624/2026-03-25/true-color.jpg",
    overlay_path: "flagship-history/osm-25453624/2026-03-25/water-overlay.png",
    image_url: "https://example.com/true-color.jpg",
    overlay_url: "https://example.com/water-overlay.png",
    usable_coverage_pct: 99.39,
    cloud_note: "tile_cloud_pct=100.0",
    geometry_version: "chennai-water-bodies-current",
    is_same_scene_as_overlay: true,
    is_reviewed: false,
    notes: null,
  });

  assert.equal(row.geeTargetId, "osm:25453624");
  assert.equal(row.frameDate, "2026-03-25");
  assert.equal(row.frameRank, 6);
  assert.equal(row.imageUrl, "https://example.com/true-color.jpg");
  assert.equal(row.overlayUrl, "https://example.com/water-overlay.png");
  assert.equal(row.isSameSceneAsOverlay, true);
});

test("hasWaterBodySatelliteEvidence requires at least one frame", () => {
  assert.equal(hasWaterBodySatelliteEvidence(null), false);
  assert.equal(hasWaterBodySatelliteEvidence([]), false);
  assert.equal(
    hasWaterBodySatelliteEvidence([
      normalizeWaterBodySatelliteEvidenceFrame({
        gee_target_id: "osm:25453624",
        reference_date: "2026-04-04",
        frame_date: "2026-03-25",
        frame_rank: 1,
        osm_id: 25453624,
        census_id: null,
        name: "Chembarambakkam Lake",
        target_cohort: "flagship-history",
        source_dataset: "sentinel2_harmonized",
        source_asset_id: null,
        dynamic_world_asset_id: null,
        image_path: null,
        overlay_path: null,
        image_url: null,
        overlay_url: null,
        usable_coverage_pct: null,
        cloud_note: null,
        geometry_version: null,
        is_same_scene_as_overlay: false,
        is_reviewed: false,
        notes: null,
      }),
    ]),
    true,
  );
});
