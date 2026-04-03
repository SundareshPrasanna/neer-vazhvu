-- =============================================================
-- 008_gee_phase1.sql
-- Google Earth Engine Phase 1 foundation tables
-- =============================================================

CREATE TABLE reservoir_catchment_context (
    id              BIGSERIAL PRIMARY KEY,
    reservoir       reservoir_name NOT NULL,
    context_date    DATE NOT NULL,
    window_days     INTEGER NOT NULL CHECK (window_days > 0),
    rain_total_mm   NUMERIC(8,2) NOT NULL,
    baseline_mm     NUMERIC(8,2),
    anomaly_pct     NUMERIC(8,2),
    context_level   TEXT NOT NULL,
    source_dataset  TEXT NOT NULL DEFAULT 'chirps_daily',
    geometry_version TEXT,
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (reservoir, context_date, window_days)
);

CREATE INDEX idx_reservoir_catchment_context_date
    ON reservoir_catchment_context (context_date DESC, reservoir, window_days);

CREATE TABLE water_body_satellite_summary (
    id                           BIGSERIAL PRIMARY KEY,
    gee_target_id                TEXT NOT NULL,
    osm_id                       BIGINT,
    census_id                    BIGINT,
    name                         TEXT,
    summary_date                 DATE NOT NULL,
    historical_persistence_pct   NUMERIC(5,2),
    latest_observed_area_ha      NUMERIC(10,2),
    seasonal_baseline_area_ha    NUMERIC(10,2),
    anomaly_ratio                NUMERIC(8,3),
    surface_water_anomaly_level  TEXT NOT NULL,
    observation_start            DATE,
    observation_end              DATE,
    sensor_source                TEXT NOT NULL,
    confidence_level             TEXT NOT NULL,
    valid_pixel_pct              NUMERIC(5,2),
    computed_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (gee_target_id, summary_date)
);

CREATE INDEX idx_water_body_satellite_summary_target
    ON water_body_satellite_summary (gee_target_id, summary_date DESC);
CREATE INDEX idx_water_body_satellite_summary_osm
    ON water_body_satellite_summary (osm_id, summary_date DESC);
CREATE INDEX idx_water_body_satellite_summary_census
    ON water_body_satellite_summary (census_id, summary_date DESC);

ALTER TABLE reservoir_catchment_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_body_satellite_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read reservoir_catchment_context"
    ON reservoir_catchment_context FOR SELECT USING (true);
CREATE POLICY "Public read water_body_satellite_summary"
    ON water_body_satellite_summary FOR SELECT USING (true);
