-- =============================================================
-- 015_groundwater_wris_quality_mode_aware.sql
-- Refine groundwater_wris_latest's data_quality_flag so it understands
-- the difference between Telemetric (DWLR, daily) and Manual (CGWB
-- field crew, ~quarterly) stations.
--
-- Quality flag heuristic:
--   stuck   - Telemetric station with >=5 readings in the last 60 days AND
--             range < 0.10m (sensor not moving). This is what catches
--             stations like ADAYAR_1 whose sensor flatlined at -29.85m.
--   stale   - Telemetric: latest reading >14 days old (DWLR should report daily)
--             Manual:    latest reading >180 days old (seasonal cadence)
--   ok      - has at least one reading and not stuck/stale
--   unknown - no recent data and unknown mode behaviour
-- =============================================================

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
    WHEN l.acquisition_mode = 'Telemetric'
         AND COALESCE(r.recent_count, 0) >= 5
         AND r.recent_range_m < 0.10
      THEN 'stuck'
    WHEN l.acquisition_mode = 'Telemetric'
         AND l.reading_date < CURRENT_DATE - INTERVAL '14 days'
      THEN 'stale'
    WHEN l.acquisition_mode = 'Manual'
         AND l.reading_date < CURRENT_DATE - INTERVAL '180 days'
      THEN 'stale'
    WHEN COALESCE(r.recent_count, 0) >= 1
      THEN 'ok'
    WHEN l.acquisition_mode = 'Manual'
      THEN 'ok'
    ELSE 'unknown'
  END AS data_quality_flag
FROM latest l
LEFT JOIN recent r USING (station_code);

GRANT SELECT ON groundwater_wris_latest TO anon, authenticated;
