export interface WaterBodySatelliteEvidenceFrame {
  geeTargetId: string;
  referenceDate: string;
  frameDate: string;
  frameRank: number;
  osmId: number | null;
  censusId: number | null;
  name: string | null;
  targetCohort: string | null;
  sourceDataset: string;
  sourceAssetId: string | null;
  dynamicWorldAssetId: string | null;
  imagePath: string | null;
  overlayPath: string | null;
  imageUrl: string | null;
  overlayUrl: string | null;
  usableCoveragePct: number | null;
  cloudNote: string | null;
  geometryVersion: string | null;
  isSameSceneAsOverlay: boolean;
  isReviewed: boolean;
  notes: string | null;
}

interface WaterBodySatelliteEvidenceApiRow {
  gee_target_id: string;
  reference_date: string;
  frame_date: string;
  frame_rank: number;
  osm_id: number | null;
  census_id: number | null;
  name: string | null;
  target_cohort: string | null;
  source_dataset: string;
  source_asset_id: string | null;
  dynamic_world_asset_id: string | null;
  image_path: string | null;
  overlay_path: string | null;
  image_url: string | null;
  overlay_url: string | null;
  usable_coverage_pct: number | null;
  cloud_note: string | null;
  geometry_version: string | null;
  is_same_scene_as_overlay: boolean;
  is_reviewed: boolean;
  notes: string | null;
}

export function normalizeWaterBodySatelliteEvidenceFrame(
  row: WaterBodySatelliteEvidenceApiRow,
): WaterBodySatelliteEvidenceFrame {
  return {
    geeTargetId: row.gee_target_id,
    referenceDate: row.reference_date,
    frameDate: row.frame_date,
    frameRank: row.frame_rank,
    osmId: row.osm_id,
    censusId: row.census_id,
    name: row.name,
    targetCohort: row.target_cohort,
    sourceDataset: row.source_dataset,
    sourceAssetId: row.source_asset_id,
    dynamicWorldAssetId: row.dynamic_world_asset_id,
    imagePath: row.image_path,
    overlayPath: row.overlay_path,
    imageUrl: row.image_url,
    overlayUrl: row.overlay_url,
    usableCoveragePct: row.usable_coverage_pct,
    cloudNote: row.cloud_note,
    geometryVersion: row.geometry_version,
    isSameSceneAsOverlay: row.is_same_scene_as_overlay,
    isReviewed: row.is_reviewed,
    notes: row.notes,
  };
}

export function normalizeWaterBodySatelliteEvidenceFrames(
  rows: WaterBodySatelliteEvidenceApiRow[] | null | undefined,
): WaterBodySatelliteEvidenceFrame[] {
  if (!rows || rows.length === 0) {
    return [];
  }

  return rows.map(normalizeWaterBodySatelliteEvidenceFrame);
}

export function hasWaterBodySatelliteEvidence(
  rows: WaterBodySatelliteEvidenceFrame[] | null | undefined,
): rows is WaterBodySatelliteEvidenceFrame[] {
  return Boolean(rows && rows.length > 0);
}
