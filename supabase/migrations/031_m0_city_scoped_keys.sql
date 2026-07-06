-- =============================================================
-- 031_m0_city_scoped_keys.sql
-- Phase 1 / M0: stabilize current multi-city tables.
--
-- Live-safe intent:
--   - keep all old city-blind UNIQUE/PRIMARY KEY arbiters in place
--   - add city-aware arbiters for the next writer cutover
--   - repair groundwater_wris_latest as a city-aware view
--   - avoid table drops, renames, or public API shape changes
--
-- Because migration 026 attempted to ALTER a view, this migration also
-- repeats the city_id column/default/backfill work idempotently. That makes
-- it useful against both fresh databases and live databases whose schema may
-- have been manually reconciled.
-- =============================================================

-- --- helper: district string -> city_id ---
CREATE OR REPLACE FUNCTION _m0_city_id_from_district(d TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN d IS NULL OR btrim(d) = '' THEN 'chennai'
    WHEN lower(btrim(d)) IN ('chennai') THEN 'chennai'
    WHEN lower(btrim(d)) IN ('madurai', 'theni', 'dindigul', 'virudhunagar') THEN 'madurai'
    WHEN lower(btrim(d)) IN (
      'bangalore',
      'bengaluru',
      'bangalore urban',
      'bengaluru urban',
      'bangalore rural',
      'bengaluru rural'
    ) THEN 'bangalore'
    WHEN lower(btrim(d)) IN (
      'mumbai',
      'mumbai city',
      'mumbai suburban',
      'thane',
      'palghar',
      'raigad',
      'navi mumbai'
    ) THEN 'mumbai'
    ELSE 'chennai'
  END;
$$;


-- =============================================================
-- Ensure city_id exists, is defaulted, and is backfilled.
-- =============================================================

ALTER TABLE groundwater_wris ADD COLUMN IF NOT EXISTS city_id TEXT DEFAULT 'chennai'
  REFERENCES cities(city_id) ON DELETE CASCADE;
ALTER TABLE groundwater_wris ALTER COLUMN city_id SET DEFAULT 'chennai';
UPDATE groundwater_wris
SET city_id = _m0_city_id_from_district(district)
WHERE city_id IS NULL OR city_id = 'chennai';

ALTER TABLE wris_river_level ADD COLUMN IF NOT EXISTS city_id TEXT DEFAULT 'chennai'
  REFERENCES cities(city_id) ON DELETE CASCADE;
ALTER TABLE wris_river_level ALTER COLUMN city_id SET DEFAULT 'chennai';
UPDATE wris_river_level
SET city_id = _m0_city_id_from_district(district)
WHERE city_id IS NULL OR city_id = 'chennai';

ALTER TABLE wris_rainfall ADD COLUMN IF NOT EXISTS city_id TEXT DEFAULT 'chennai'
  REFERENCES cities(city_id) ON DELETE CASCADE;
ALTER TABLE wris_rainfall ALTER COLUMN city_id SET DEFAULT 'chennai';
UPDATE wris_rainfall
SET city_id = _m0_city_id_from_district(district)
WHERE city_id IS NULL OR city_id = 'chennai';

ALTER TABLE water_bodies_census ADD COLUMN IF NOT EXISTS city_id TEXT DEFAULT 'chennai'
  REFERENCES cities(city_id) ON DELETE CASCADE;
ALTER TABLE water_bodies_census ALTER COLUMN city_id SET DEFAULT 'chennai';
UPDATE water_bodies_census
SET city_id = _m0_city_id_from_district(district)
WHERE city_id IS NULL OR city_id = 'chennai';

ALTER TABLE weather_daily ADD COLUMN IF NOT EXISTS city_id TEXT DEFAULT 'chennai'
  REFERENCES cities(city_id) ON DELETE CASCADE;
ALTER TABLE weather_daily ALTER COLUMN city_id SET DEFAULT 'chennai';
UPDATE weather_daily SET city_id = 'chennai' WHERE city_id IS NULL;

ALTER TABLE water_estimate_daily ADD COLUMN IF NOT EXISTS city_id TEXT DEFAULT 'chennai'
  REFERENCES cities(city_id) ON DELETE CASCADE;
ALTER TABLE water_estimate_daily ALTER COLUMN city_id SET DEFAULT 'chennai';
UPDATE water_estimate_daily SET city_id = 'chennai' WHERE city_id IS NULL;

ALTER TABLE daily_briefing ADD COLUMN IF NOT EXISTS city_id TEXT DEFAULT 'chennai'
  REFERENCES cities(city_id) ON DELETE CASCADE;
ALTER TABLE daily_briefing ALTER COLUMN city_id SET DEFAULT 'chennai';
UPDATE daily_briefing SET city_id = 'chennai' WHERE city_id IS NULL;

ALTER TABLE groundwater_monthly ADD COLUMN IF NOT EXISTS city_id TEXT DEFAULT 'chennai'
  REFERENCES cities(city_id) ON DELETE CASCADE;
ALTER TABLE groundwater_monthly ALTER COLUMN city_id SET DEFAULT 'chennai';
UPDATE groundwater_monthly SET city_id = 'chennai' WHERE city_id IS NULL;

ALTER TABLE ward_risk_score ADD COLUMN IF NOT EXISTS city_id TEXT DEFAULT 'chennai'
  REFERENCES cities(city_id) ON DELETE CASCADE;
ALTER TABLE ward_risk_score ALTER COLUMN city_id SET DEFAULT 'chennai';
UPDATE ward_risk_score SET city_id = 'chennai' WHERE city_id IS NULL;

ALTER TABLE ward_narrative ADD COLUMN IF NOT EXISTS city_id TEXT DEFAULT 'chennai'
  REFERENCES cities(city_id) ON DELETE CASCADE;
ALTER TABLE ward_narrative ALTER COLUMN city_id SET DEFAULT 'chennai';
UPDATE ward_narrative SET city_id = 'chennai' WHERE city_id IS NULL;

ALTER TABLE reservoir_catchment_context ADD COLUMN IF NOT EXISTS city_id TEXT DEFAULT 'chennai'
  REFERENCES cities(city_id) ON DELETE CASCADE;
ALTER TABLE reservoir_catchment_context ALTER COLUMN city_id SET DEFAULT 'chennai';
UPDATE reservoir_catchment_context SET city_id = 'chennai' WHERE city_id IS NULL;

ALTER TABLE water_body_satellite_summary ADD COLUMN IF NOT EXISTS city_id TEXT DEFAULT 'chennai'
  REFERENCES cities(city_id) ON DELETE CASCADE;
ALTER TABLE water_body_satellite_summary ALTER COLUMN city_id SET DEFAULT 'chennai';
UPDATE water_body_satellite_summary SET city_id = 'chennai' WHERE city_id IS NULL;


-- =============================================================
-- Require city_id for new rows after the backfill.
-- Defaults above keep existing deployed writers compatible while this is
-- validated.
-- =============================================================

DO $$
DECLARE
  table_name TEXT;
  null_count BIGINT;
  tables TEXT[] := ARRAY[
    'groundwater_wris',
    'wris_river_level',
    'wris_rainfall',
    'water_bodies_census',
    'weather_daily',
    'water_estimate_daily',
    'daily_briefing',
    'groundwater_monthly',
    'ward_risk_score',
    'ward_narrative',
    'reservoir_catchment_context',
    'water_body_satellite_summary'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE city_id IS NULL', table_name)
      INTO null_count;
    IF null_count > 0 THEN
      RAISE EXCEPTION 'Cannot enforce %.city_id NOT NULL: % NULL rows remain',
        table_name, null_count;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN city_id SET NOT NULL', table_name);
  END LOOP;
END $$;


-- =============================================================
-- City-aware unique arbiters for the next writer cutover.
--
-- Old city-blind constraints remain in place. While both old and new keys
-- coexist, second-city writes with duplicate natural keys still must wait for
-- the later cleanup release that drops the old arbiters.
-- =============================================================

CREATE UNIQUE INDEX IF NOT EXISTS weather_daily_city_date_uidx
  ON weather_daily(city_id, date);

CREATE UNIQUE INDEX IF NOT EXISTS water_estimate_daily_city_date_uidx
  ON water_estimate_daily(city_id, date);

CREATE UNIQUE INDEX IF NOT EXISTS daily_briefing_city_briefing_date_uidx
  ON daily_briefing(city_id, briefing_date);

CREATE UNIQUE INDEX IF NOT EXISTS groundwater_monthly_city_ward_year_month_uidx
  ON groundwater_monthly(city_id, ward_number, year, month);

CREATE UNIQUE INDEX IF NOT EXISTS ward_risk_score_city_ward_computed_date_uidx
  ON ward_risk_score(city_id, ward_number, computed_date);

CREATE UNIQUE INDEX IF NOT EXISTS ward_narrative_city_ward_narrative_date_uidx
  ON ward_narrative(city_id, ward_number, narrative_date);

CREATE UNIQUE INDEX IF NOT EXISTS groundwater_wris_city_station_reading_date_uidx
  ON groundwater_wris(city_id, station_code, reading_date);

CREATE UNIQUE INDEX IF NOT EXISTS wris_river_level_city_station_reading_date_uidx
  ON wris_river_level(city_id, station_code, reading_date);

CREATE UNIQUE INDEX IF NOT EXISTS wris_rainfall_city_station_reading_date_uidx
  ON wris_rainfall(city_id, station_code, reading_date);

CREATE UNIQUE INDEX IF NOT EXISTS water_bodies_census_city_census_code_uidx
  ON water_bodies_census(city_id, census_code);

CREATE UNIQUE INDEX IF NOT EXISTS reservoir_catchment_context_city_reservoir_date_window_uidx
  ON reservoir_catchment_context(city_id, reservoir, context_date, window_days);

CREATE UNIQUE INDEX IF NOT EXISTS water_body_satellite_summary_city_target_date_uidx
  ON water_body_satellite_summary(city_id, gee_target_id, summary_date);


-- =============================================================
-- Recreate groundwater_wris_latest as a city-aware latest-station view.
-- =============================================================

DROP VIEW IF EXISTS groundwater_wris_latest;

CREATE VIEW groundwater_wris_latest AS
WITH latest AS (
  SELECT DISTINCT ON (city_id, station_code)
    city_id,
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
  ORDER BY city_id, station_code, reading_date DESC
),
recent_deltas AS (
  SELECT
    city_id,
    station_code,
    depth_to_water_m,
    ABS(
      depth_to_water_m
      - LAG(depth_to_water_m) OVER (
          PARTITION BY city_id, station_code
          ORDER BY reading_date
        )
    ) AS delta_m
  FROM groundwater_wris
  WHERE reading_date >= CURRENT_DATE - INTERVAL '60 days'
),
recent AS (
  SELECT
    city_id,
    station_code,
    COUNT(*)                                               AS recent_count,
    MAX(depth_to_water_m) - MIN(depth_to_water_m)          AS recent_range_m,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY delta_m)
      FILTER (WHERE delta_m IS NOT NULL)                   AS median_daily_delta_m
  FROM recent_deltas
  GROUP BY city_id, station_code
)
SELECT
  l.city_id,
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
LEFT JOIN recent r USING (city_id, station_code);

GRANT SELECT ON groundwater_wris_latest TO anon, authenticated;


-- =============================================================
-- Guardrail: fail the migration if an expected city-aware arbiter is missing.
-- This keeps future edits from accidentally dropping the M0 safety net.
-- =============================================================

DO $$
DECLARE
  missing_indexes TEXT[];
BEGIN
  WITH expected(index_name) AS (
    VALUES
      ('weather_daily_city_date_uidx'),
      ('water_estimate_daily_city_date_uidx'),
      ('daily_briefing_city_briefing_date_uidx'),
      ('groundwater_monthly_city_ward_year_month_uidx'),
      ('ward_risk_score_city_ward_computed_date_uidx'),
      ('ward_narrative_city_ward_narrative_date_uidx'),
      ('groundwater_wris_city_station_reading_date_uidx'),
      ('wris_river_level_city_station_reading_date_uidx'),
      ('wris_rainfall_city_station_reading_date_uidx'),
      ('water_bodies_census_city_census_code_uidx'),
      ('reservoir_catchment_context_city_reservoir_date_window_uidx'),
      ('water_body_satellite_summary_city_target_date_uidx')
  )
  SELECT array_agg(e.index_name)
  INTO missing_indexes
  FROM expected e
  LEFT JOIN pg_class c
    ON c.relname = e.index_name
   AND c.relkind = 'i'
   AND c.relnamespace = 'public'::regnamespace
  WHERE c.oid IS NULL;

  IF missing_indexes IS NOT NULL THEN
    RAISE EXCEPTION 'Missing city-aware unique indexes: %', missing_indexes;
  END IF;
END $$;

DROP FUNCTION IF EXISTS _m0_city_id_from_district(TEXT);
