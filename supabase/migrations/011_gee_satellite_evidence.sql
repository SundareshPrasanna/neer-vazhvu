-- =============================================================
-- 011_gee_satellite_evidence.sql
-- Satellite evidence asset metadata for flagship water bodies
-- =============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('satellite-evidence', 'satellite-evidence', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

CREATE TABLE water_body_satellite_evidence (
    id                         BIGSERIAL PRIMARY KEY,
    gee_target_id              TEXT NOT NULL,
    osm_id                     BIGINT,
    census_id                  BIGINT,
    name                       TEXT,
    target_cohort              TEXT,
    reference_date             DATE NOT NULL,
    frame_date                 DATE NOT NULL,
    frame_rank                 INTEGER NOT NULL CHECK (frame_rank > 0),
    source_dataset             TEXT NOT NULL,
    source_asset_id            TEXT,
    dynamic_world_asset_id     TEXT,
    image_path                 TEXT,
    overlay_path               TEXT,
    usable_coverage_pct        NUMERIC(5,2),
    cloud_note                 TEXT,
    geometry_version           TEXT,
    is_same_scene_as_overlay   BOOLEAN NOT NULL DEFAULT false,
    is_reviewed                BOOLEAN NOT NULL DEFAULT false,
    notes                      TEXT,
    computed_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (gee_target_id, reference_date)
);

CREATE INDEX idx_water_body_satellite_evidence_target
    ON water_body_satellite_evidence (gee_target_id, frame_date DESC);
CREATE INDEX idx_water_body_satellite_evidence_osm
    ON water_body_satellite_evidence (osm_id, frame_date DESC);
CREATE INDEX idx_water_body_satellite_evidence_census
    ON water_body_satellite_evidence (census_id, frame_date DESC);

ALTER TABLE water_body_satellite_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read water_body_satellite_evidence"
    ON water_body_satellite_evidence FOR SELECT USING (true);

CREATE POLICY "Public read satellite evidence objects"
    ON storage.objects FOR SELECT USING (bucket_id = 'satellite-evidence');
