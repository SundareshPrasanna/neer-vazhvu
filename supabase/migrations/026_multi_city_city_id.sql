-- =============================================================
-- 026_multi_city_city_id.sql
-- M0 finisher: add city_id to legacy single-tenant tables.
--
-- The 17_cities_and_water_sources migration introduced the cities table
-- and the city-aware v2 tables (reservoir_daily_v2, reservoir_forecast_v2,
-- avg_monthly_inflow_v2, kaveri_water_clock_*). This migration retrofits
-- city_id onto the older tables that still drive most of the runtime:
-- weather_daily, groundwater_*, ward_*, water_bodies_census, etc.
--
-- Strategy:
--   1) Add nullable city_id TEXT to each table, FK to cities(city_id).
--   2) Default 'chennai' (the legacy implicit owner) on the column so
--      existing INSERTs that don't specify city_id keep working.
--   3) Backfill from `district` text columns where they already exist.
--      For groundwater_wris / wris_river_level / wris_rainfall /
--      water_bodies_census we map the district string to a city_id.
--      For other tables (weather_daily, daily_briefing, ward_*) all
--      legacy rows are Chennai - default is correct.
--   4) Add a `city_id` index on every table.
--   5) NOT NULL is deferred to a follow-up migration. The default
--      keeps NULLs out of new inserts; the follow-up verifies all
--      backfilled rows are non-NULL before tightening the constraint.
--
-- Some paired ETL code sets city_id explicitly on new inserts; legacy
-- pipeline paths and older scripts may still rely on the default until their
-- writer cutover. The default is compatibility scaffolding, not the long-term
-- ownership model.
-- =============================================================

-- --- helper: district string -> city_id ---
-- Used by the backfill UPDATEs below. The district column in our
-- existing tables is text and not normalised: 'Chennai', 'CHENNAI',
-- 'Madurai', 'BANGALORE URBAN', 'Bengaluru Urban' all appear.
CREATE OR REPLACE FUNCTION _city_id_from_district(d TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN d IS NULL THEN 'chennai'
    WHEN lower(btrim(d)) IN ('chennai') THEN 'chennai'
    WHEN lower(btrim(d)) IN ('madurai', 'theni', 'dindigul', 'virudhunagar') THEN 'madurai'
    WHEN lower(btrim(d)) IN ('bangalore urban', 'bengaluru urban', 'bangalore rural', 'bengaluru rural') THEN 'bangalore'
    ELSE 'chennai'
  END;
$$;


-- =============================================================
-- Group A: tables that already have a `district` text column - backfill
-- city_id from district before relying on the column default.
-- =============================================================

-- groundwater_wris (already has 'Chennai' and 'Madurai' rows)
ALTER TABLE groundwater_wris ADD COLUMN IF NOT EXISTS city_id TEXT DEFAULT 'chennai'
  REFERENCES cities(city_id) ON DELETE CASCADE;
UPDATE groundwater_wris SET city_id = _city_id_from_district(district) WHERE city_id IS NULL OR city_id = 'chennai';
CREATE INDEX IF NOT EXISTS idx_groundwater_wris_city ON groundwater_wris(city_id, reading_date DESC);

-- groundwater_wris_latest is a view, not a table. Recreate it with city_id
-- from groundwater_wris instead of trying to add a storage column to the view.
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

-- wris_river_level
ALTER TABLE wris_river_level ADD COLUMN IF NOT EXISTS city_id TEXT DEFAULT 'chennai'
  REFERENCES cities(city_id) ON DELETE CASCADE;
UPDATE wris_river_level SET city_id = _city_id_from_district(district) WHERE city_id IS NULL OR city_id = 'chennai';
CREATE INDEX IF NOT EXISTS idx_wris_river_level_city ON wris_river_level(city_id, reading_date DESC);

-- wris_rainfall
ALTER TABLE wris_rainfall ADD COLUMN IF NOT EXISTS city_id TEXT DEFAULT 'chennai'
  REFERENCES cities(city_id) ON DELETE CASCADE;
UPDATE wris_rainfall SET city_id = _city_id_from_district(district) WHERE city_id IS NULL OR city_id = 'chennai';
CREATE INDEX IF NOT EXISTS idx_wris_rainfall_city ON wris_rainfall(city_id, reading_date DESC);

-- water_bodies_census (default on column was 'CHENNAI' uppercase)
ALTER TABLE water_bodies_census ADD COLUMN IF NOT EXISTS city_id TEXT DEFAULT 'chennai'
  REFERENCES cities(city_id) ON DELETE CASCADE;
UPDATE water_bodies_census SET city_id = _city_id_from_district(district) WHERE city_id IS NULL OR city_id = 'chennai';
CREATE INDEX IF NOT EXISTS idx_water_bodies_census_city ON water_bodies_census(city_id);


-- =============================================================
-- Group B: legacy single-tenant tables - no district column. All
-- existing rows are Chennai by construction, so the column default
-- of 'chennai' is the right backfill. NULL backfill is also a no-op
-- because the default applied at column-add time.
-- =============================================================

-- weather_daily
ALTER TABLE weather_daily ADD COLUMN IF NOT EXISTS city_id TEXT DEFAULT 'chennai'
  REFERENCES cities(city_id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_weather_daily_city ON weather_daily(city_id, date DESC);

-- water_estimate_daily
ALTER TABLE water_estimate_daily ADD COLUMN IF NOT EXISTS city_id TEXT DEFAULT 'chennai'
  REFERENCES cities(city_id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_water_estimate_daily_city ON water_estimate_daily(city_id, date DESC);

-- daily_briefing
ALTER TABLE daily_briefing ADD COLUMN IF NOT EXISTS city_id TEXT DEFAULT 'chennai'
  REFERENCES cities(city_id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_daily_briefing_city ON daily_briefing(city_id, briefing_date DESC);

-- groundwater_monthly (Chennai OpenCity ward survey)
ALTER TABLE groundwater_monthly ADD COLUMN IF NOT EXISTS city_id TEXT DEFAULT 'chennai'
  REFERENCES cities(city_id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_groundwater_monthly_city ON groundwater_monthly(city_id, month);

-- ward_risk_score (Chennai-only DB rows; Madurai uses file-based output)
ALTER TABLE ward_risk_score ADD COLUMN IF NOT EXISTS city_id TEXT DEFAULT 'chennai'
  REFERENCES cities(city_id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ward_risk_score_city ON ward_risk_score(city_id, ward_number);

-- ward_narrative (Chennai-only DB rows by current convention)
ALTER TABLE ward_narrative ADD COLUMN IF NOT EXISTS city_id TEXT DEFAULT 'chennai'
  REFERENCES cities(city_id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ward_narrative_city ON ward_narrative(city_id, ward_number, narrative_date DESC);

-- reservoir_catchment_context (GEE intelligence, Chennai-only legacy)
ALTER TABLE reservoir_catchment_context ADD COLUMN IF NOT EXISTS city_id TEXT DEFAULT 'chennai'
  REFERENCES cities(city_id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_reservoir_catchment_context_city ON reservoir_catchment_context(city_id, context_date DESC);

-- water_body_satellite_summary (GEE intelligence)
ALTER TABLE water_body_satellite_summary ADD COLUMN IF NOT EXISTS city_id TEXT DEFAULT 'chennai'
  REFERENCES cities(city_id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_water_body_satellite_summary_city ON water_body_satellite_summary(city_id);


-- =============================================================
-- Drop the temporary helper. The mapping logic lives in app code
-- from here on; SQL only needs it once for the backfill.
-- =============================================================
DROP FUNCTION IF EXISTS _city_id_from_district(TEXT);
