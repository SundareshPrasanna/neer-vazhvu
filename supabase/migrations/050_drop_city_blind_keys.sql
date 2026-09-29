-- =============================================================
-- 050_drop_city_blind_keys.sql
-- The writer cutover 035 prepared for: every writer now upserts on the
-- city-aware unique indexes 035 built and sends city_id explicitly, so the
-- city-blind arbiters and the DEFAULT 'chennai' come out.
--
--   1. Drop the ten city-blind UNIQUE keys (one per table).
--   2. Move wris_rainfall / wris_river_level primary keys onto city_id.
--   3. Drop DEFAULT 'chennai' so a writer that forgets its city fails loudly.
--
-- Supersedes check 2 of supabase/checks/035_m0_city_scoped_keys_postflight.sql
-- ("old city-blind arbiters are still present"), which held only for M0.
-- No rows change; drops only.
-- =============================================================

BEGIN;

-- Guard: refuse to run unless every city-aware arbiter is present and unique.
DO $$
DECLARE
  missing TEXT[];
BEGIN
  SELECT array_agg(n) INTO missing
  FROM unnest(ARRAY[
    'weather_daily_city_date_uidx',
    'water_estimate_daily_city_date_uidx',
    'daily_briefing_city_briefing_date_uidx',
    'groundwater_monthly_city_ward_year_month_uidx',
    'ward_risk_score_city_ward_computed_date_uidx',
    'ward_narrative_city_ward_narrative_date_uidx',
    'groundwater_wris_city_station_reading_date_uidx',
    'wris_river_level_city_station_reading_date_uidx',
    'wris_rainfall_city_station_reading_date_uidx',
    'water_bodies_census_city_census_code_uidx',
    'reservoir_catchment_context_city_reservoir_date_window_uidx',
    'water_body_satellite_summary_city_target_date_uidx'
  ]) AS n
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
    WHERE c.relname = n AND i.indisunique AND i.indisvalid AND i.indpred IS NULL
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION '050: city-aware arbiters missing or not unique: %', missing;
  END IF;
END $$;

-- 1. City-blind unique keys
ALTER TABLE weather_daily                DROP CONSTRAINT IF EXISTS weather_daily_date_key;
ALTER TABLE water_estimate_daily         DROP CONSTRAINT IF EXISTS water_estimate_daily_date_key;
ALTER TABLE daily_briefing               DROP CONSTRAINT IF EXISTS daily_briefing_briefing_date_key;
ALTER TABLE groundwater_monthly          DROP CONSTRAINT IF EXISTS groundwater_monthly_ward_number_year_month_key;
ALTER TABLE ward_risk_score              DROP CONSTRAINT IF EXISTS ward_risk_score_ward_number_computed_date_key;
ALTER TABLE ward_narrative               DROP CONSTRAINT IF EXISTS ward_narrative_ward_number_narrative_date_key;
ALTER TABLE groundwater_wris             DROP CONSTRAINT IF EXISTS groundwater_wris_station_code_reading_date_key;
ALTER TABLE water_bodies_census          DROP CONSTRAINT IF EXISTS water_bodies_census_census_code_key;
ALTER TABLE reservoir_catchment_context  DROP CONSTRAINT IF EXISTS reservoir_catchment_context_reservoir_context_date_window_d_key;
ALTER TABLE water_body_satellite_summary DROP CONSTRAINT IF EXISTS water_body_satellite_summary_gee_target_id_summary_date_key;

-- 2. WRIS primary keys onto city_id (the city-aware index becomes the key and
--    takes the _pkey name).
ALTER TABLE wris_rainfall DROP CONSTRAINT wris_rainfall_pkey;
ALTER TABLE wris_rainfall ADD CONSTRAINT wris_rainfall_pkey
  PRIMARY KEY USING INDEX wris_rainfall_city_station_reading_date_uidx;
ALTER TABLE wris_river_level DROP CONSTRAINT wris_river_level_pkey;
ALTER TABLE wris_river_level ADD CONSTRAINT wris_river_level_pkey
  PRIMARY KEY USING INDEX wris_river_level_city_station_reading_date_uidx;

-- 3. No default city
ALTER TABLE weather_daily                ALTER COLUMN city_id DROP DEFAULT;
ALTER TABLE water_estimate_daily         ALTER COLUMN city_id DROP DEFAULT;
ALTER TABLE daily_briefing               ALTER COLUMN city_id DROP DEFAULT;
ALTER TABLE groundwater_monthly          ALTER COLUMN city_id DROP DEFAULT;
ALTER TABLE ward_risk_score              ALTER COLUMN city_id DROP DEFAULT;
ALTER TABLE ward_narrative               ALTER COLUMN city_id DROP DEFAULT;
ALTER TABLE groundwater_wris             ALTER COLUMN city_id DROP DEFAULT;
ALTER TABLE wris_river_level             ALTER COLUMN city_id DROP DEFAULT;
ALTER TABLE wris_rainfall                ALTER COLUMN city_id DROP DEFAULT;
ALTER TABLE water_bodies_census          ALTER COLUMN city_id DROP DEFAULT;
ALTER TABLE reservoir_catchment_context  ALTER COLUMN city_id DROP DEFAULT;
ALTER TABLE water_body_satellite_summary ALTER COLUMN city_id DROP DEFAULT;

-- Postflight: the only unique indexes left are the id primary keys and the
-- city-aware ones. A city-blind key that was a bare index, not a constraint,
-- would survive DROP CONSTRAINT IF EXISTS; fail rather than leave it.
DO $$
DECLARE
  leftovers TEXT[];
BEGIN
  SELECT array_agg(indexname) INTO leftovers
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexdef ILIKE 'CREATE UNIQUE INDEX%'
    AND tablename IN ('weather_daily', 'water_estimate_daily', 'daily_briefing',
      'groundwater_monthly', 'ward_risk_score', 'ward_narrative', 'groundwater_wris',
      'wris_river_level', 'wris_rainfall', 'water_bodies_census',
      'reservoir_catchment_context', 'water_body_satellite_summary')
    AND indexdef NOT ILIKE '%(city_id,%'
    AND indexdef NOT ILIKE '%USING btree (id)';
  IF leftovers IS NOT NULL THEN
    RAISE EXCEPTION '050: city-blind unique indexes remain: %', leftovers;
  END IF;
END $$;

COMMIT;
