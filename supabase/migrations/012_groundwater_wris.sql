-- =============================================================
-- 012_groundwater_wris.sql
-- CGWB station-level groundwater data from India WRIS API
-- Supplements ward-level OpenCity data with near-daily readings
-- =============================================================

-- Station-level groundwater readings (manual + telemetric/DWLR)
-- Uses existing 'cgwb' value from data_source enum
CREATE TABLE IF NOT EXISTS groundwater_wris (
  id                  BIGSERIAL PRIMARY KEY,
  station_code        TEXT NOT NULL,
  station_name        TEXT NOT NULL,
  latitude            NUMERIC(8,5),
  longitude           NUMERIC(8,5),
  reading_date        DATE NOT NULL,
  depth_to_water_m    NUMERIC(8,3) NOT NULL,
  acquisition_mode    TEXT NOT NULL DEFAULT 'Manual',
  agency              TEXT NOT NULL DEFAULT 'CGWB',
  district            TEXT NOT NULL DEFAULT 'Chennai',
  source              data_source NOT NULL DEFAULT 'cgwb',
  ingested_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(station_code, reading_date)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_gwris_station_date ON groundwater_wris(station_code, reading_date DESC);
CREATE INDEX IF NOT EXISTS idx_gwris_date ON groundwater_wris(reading_date DESC);
CREATE INDEX IF NOT EXISTS idx_gwris_mode ON groundwater_wris(acquisition_mode);

-- RLS: public read
ALTER TABLE groundwater_wris ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read groundwater_wris"
  ON groundwater_wris FOR SELECT USING (true);
