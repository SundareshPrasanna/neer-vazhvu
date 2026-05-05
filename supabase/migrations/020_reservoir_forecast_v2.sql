-- =============================================================
-- 020_reservoir_forecast_v2.sql
-- Multi-place reservoir forecast table.
-- =============================================================
-- The Chennai-only reservoir_forecast table (mig 002) is keyed by an
-- enum-typed `reservoir` column that doesn't include Vaigai / Mullaperiyar.
-- Rather than extend the enum (postgres enum mutation requires special
-- handling and ripples through the dependent typed views), we add a
-- v2 table keyed on (city_id, source_code) - matching reservoir_daily_v2.
--
-- Existing Chennai forecast pipeline (pipeline.py + forecaster.py) keeps
-- writing to the v1 table; a follow-up commit migrates Chennai to v2 too.
-- For now Madurai writes here.

CREATE TABLE IF NOT EXISTS reservoir_forecast_v2 (
  city_id                TEXT NOT NULL REFERENCES cities(city_id) ON DELETE CASCADE,
  source_code            TEXT NOT NULL,
  forecast_date          DATE NOT NULL,
  target_date            DATE NOT NULL,
  predicted_storage_tmc  NUMERIC(8,3),
  confidence_lower_tmc   NUMERIC(8,3),
  confidence_upper_tmc   NUMERIC(8,3),
  model_name             TEXT NOT NULL DEFAULT 'auto_arima',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (city_id, source_code, forecast_date, target_date),
  FOREIGN KEY (city_id, source_code)
    REFERENCES water_sources(city_id, source_code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reservoir_forecast_v2_lookup
  ON reservoir_forecast_v2(city_id, source_code, target_date DESC);

CREATE INDEX IF NOT EXISTS idx_reservoir_forecast_v2_recent
  ON reservoir_forecast_v2(city_id, forecast_date DESC);

ALTER TABLE reservoir_forecast_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read reservoir_forecast_v2"
  ON reservoir_forecast_v2 FOR SELECT USING (true);
