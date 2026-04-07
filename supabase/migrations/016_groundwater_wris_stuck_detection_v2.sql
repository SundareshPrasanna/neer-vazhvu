-- =============================================================
-- 016_groundwater_wris_stuck_detection_v2.sql
-- Improve the stuck-sensor detector.
--
-- Problem with the v1 heuristic (migration 015): it used the absolute
-- range (max-min) of the last 60 days, with a 10cm threshold. That's
-- brittle: a single one-off step change (a recalibration or a one-day
-- glitch) blows the range well past 10cm even if the sensor is clearly
-- flatlined before and after.
--
-- v2 heuristic: compute the median of |day-to-day changes| in the last
-- 60 days. A healthy DWLR in Chennai moves a few cm per day due to
-- pumping and recharge cycles. A stuck sensor moves <1cm/day median.
-- Median is robust to single-step jumps.
--
-- Concrete Chennai data (as of 2026-04-07):
--   ADAYAR_1           median=0.00cm/d  -> stuck
--   Pallavaram_2       median=0.50cm/d  -> stuck (v1 missed this)
--   Taramani NITTR PZ  median=0.70cm/d  -> stuck (v1 missed this)
--   Guindy CLRI        median=1.80cm/d  -> healthy
--   Washermenpet       median=3.10cm/d  -> healthy
--
-- Threshold: median daily delta < 1.0cm with at least 10 readings in
-- the 60-day window. Also keep the old range in the view so the panel
-- UI can still show "range X.XXm over last 60 days" context.
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
recent_deltas AS (
  SELECT
    station_code,
    depth_to_water_m,
    ABS(
      depth_to_water_m
      - LAG(depth_to_water_m) OVER (
          PARTITION BY station_code
          ORDER BY reading_date
        )
    ) AS delta_m
  FROM groundwater_wris
  WHERE reading_date >= CURRENT_DATE - INTERVAL '60 days'
),
recent AS (
  SELECT
    station_code,
    COUNT(*)                                               AS recent_count,
    MAX(depth_to_water_m) - MIN(depth_to_water_m)          AS recent_range_m,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY delta_m)
      FILTER (WHERE delta_m IS NOT NULL)                   AS median_daily_delta_m
  FROM recent_deltas
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
  r.median_daily_delta_m,
  CASE
    WHEN l.acquisition_mode = 'Telemetric'
         AND COALESCE(r.recent_count, 0) >= 10
         AND r.median_daily_delta_m < 0.01
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
