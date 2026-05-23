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
-- ETL code paired with this migration sets city_id explicitly on new
-- inserts (see app/etl/pipeline.py + scripts/scrape_wris_*.py). The
-- default is just belt-and-braces for any caller we miss.
-- =============================================================

-- --- helper: district string -> city_id ---
-- Used by the backfill UPDATEs below. The district column in our
-- existing tables is text and not normalised: 'Chennai', 'CHENNAI',
-- 'Madurai', 'BANGALORE URBAN', 'Bengaluru Urban' all appear.
CREATE OR REPLACE FUNCTION _city_id_from_district(d TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN d IS NULL THEN 'chennai'
    WHEN lower(d) IN ('chennai') THEN 'chennai'
    WHEN lower(d) IN ('madurai') THEN 'madurai'
    WHEN lower(d) IN ('bangalore urban', 'bengaluru urban', 'bangalore rural', 'bengaluru rural') THEN 'bangalore'
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

-- groundwater_wris_latest (mirror)
ALTER TABLE groundwater_wris_latest ADD COLUMN IF NOT EXISTS city_id TEXT DEFAULT 'chennai'
  REFERENCES cities(city_id) ON DELETE CASCADE;
UPDATE groundwater_wris_latest SET city_id = _city_id_from_district(district) WHERE city_id IS NULL OR city_id = 'chennai';
CREATE INDEX IF NOT EXISTS idx_groundwater_wris_latest_city ON groundwater_wris_latest(city_id);

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
