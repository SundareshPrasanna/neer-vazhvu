-- =============================================================
-- 014_groundwater_wris_metadata_and_quality.sql
-- Add well metadata (type, depth, aquifer) to groundwater_wris and
-- extend the latest view with a sensor data-quality flag.
-- See 015 for the mode-aware quality flag refinement.
-- =============================================================

-- 1. Metadata columns: captured from WRIS API "wellType", "wellDepth",
--    "wellAquiferType". They are nullable because older rows predate
--    the metadata-aware scrape; backfill happens via the next ETL run.
ALTER TABLE groundwater_wris
  ADD COLUMN IF NOT EXISTS well_type         TEXT,
  ADD COLUMN IF NOT EXISTS well_depth_m      NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS well_aquifer_type TEXT;

-- 2. Recreate the latest view with metadata + quality flag.
DROP VIEW IF EXISTS groundwater_wris_latest;

CREATE VIEW groundwater_wris_latest AS
WITH latest AS (
  SELECT DISTINCT ON (station_code)
    station_code,
    station_name,
    latitude,
    longitude,
    reading_date,
    depth_to_water_m,
    acquisition_mode,
    agency,
    district,
    well_type,
    well_depth_m,
    well_aquifer_type
  FROM groundwater_wris
  ORDER BY station_code, reading_date DESC
),
recent AS (
  SELECT
    station_code,
    COUNT(*)                                      AS recent_count,
    MAX(depth_to_water_m) - MIN(depth_to_water_m) AS recent_range_m
  FROM groundwater_wris
  WHERE reading_date >= CURRENT_DATE - INTERVAL '60 days'
  GROUP BY station_code
)
SELECT
  l.station_code,
  l.station_name,
  l.latitude,
  l.longitude,
  l.reading_date,
  l.depth_to_water_m,
  l.acquisition_mode,
  l.agency,
  l.district,
  l.well_type,
  l.well_depth_m,
  l.well_aquifer_type,
  COALESCE(r.recent_count, 0)::INT AS recent_count,
  r.recent_range_m,
  CASE
    WHEN COALESCE(r.recent_count, 0) >= 5 AND r.recent_range_m < 0.10
      THEN 'stuck'
    WHEN l.reading_date < CURRENT_DATE - INTERVAL '60 days'
      THEN 'stale'
    WHEN COALESCE(r.recent_count, 0) >= 3
      THEN 'ok'
    ELSE 'unknown'
  END AS data_quality_flag
FROM latest l
LEFT JOIN recent r USING (station_code);

GRANT SELECT ON groundwater_wris_latest TO anon, authenticated;
