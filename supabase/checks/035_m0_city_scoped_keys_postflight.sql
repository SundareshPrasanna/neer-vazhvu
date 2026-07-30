-- Postflight checks after applying 035_m0_city_scoped_keys.sql to live Supabase.
--
-- This file is not a migration. Run it manually against the target database
-- immediately after applying migration 035. Compare row-count outputs against
-- the same queries run during the pre-apply rehearsal on the restored dump.
--
-- Section 6 is the next-morning check: run it after the first scheduled
-- daily pipeline completes to confirm new telemetry rows arrive with
-- city_id = 'madurai'.

-- 1. All 12 city-aware unique indexes exist.
-- Expected result: zero rows.
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
SELECT e.index_name AS missing_index
FROM expected e
LEFT JOIN pg_class c
  ON c.relname = e.index_name
 AND c.relkind = 'i'
 AND c.relnamespace = 'public'::regnamespace
WHERE c.oid IS NULL;


-- 2. Old city-blind arbiters are still present (M0 must not drop them;
-- deployed writers still upsert against these).
-- Expected: every legacy natural key still appears (e.g. weather_daily date,
-- wris_* station_code/reading_date PKs, water_bodies_census census_code).
-- Surrogate id-column primary keys will also appear; that is fine.
SELECT t.relname AS table_name, c.conname AS constraint_name, c.contype
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
WHERE t.relname IN (
  'weather_daily', 'water_estimate_daily', 'daily_briefing',
  'groundwater_monthly', 'ward_risk_score', 'ward_narrative',
  'groundwater_wris', 'wris_river_level', 'wris_rainfall',
  'water_bodies_census',
  'reservoir_catchment_context', 'water_body_satellite_summary'
)
AND c.contype IN ('u', 'p')
AND NOT EXISTS (
  SELECT 1 FROM unnest(c.conkey) AS k
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k
  WHERE a.attname = 'city_id'
)
ORDER BY t.relname;


-- 3. city_id is NOT NULL on all stabilized tables.
-- Expected result: zero rows.
SELECT c.table_name AS nullable_city_id
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.column_name = 'city_id'
  AND c.is_nullable = 'YES'
  AND c.table_name IN (
    'groundwater_wris', 'wris_river_level', 'wris_rainfall',
    'water_bodies_census', 'weather_daily', 'water_estimate_daily',
    'daily_briefing', 'groundwater_monthly', 'ward_risk_score',
    'ward_narrative', 'reservoir_catchment_context',
    'water_body_satellite_summary'
  );


-- 4. groundwater_wris_latest view is city-aware and readable.
-- Expected: first query returns at least the city_id column; second returns
-- one row per (city_id) with plausible station counts.
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'groundwater_wris_latest'
ORDER BY ordinal_position;

SELECT city_id, count(*) AS latest_stations
FROM groundwater_wris_latest
GROUP BY city_id
ORDER BY city_id;


-- 5. Row ownership by city. Compare against the rehearsal run on the
-- restored dump; unexplained differences mean writes landed mid-window.
SELECT 'groundwater_wris' AS table_name, city_id, count(*) AS row_count FROM groundwater_wris GROUP BY city_id
UNION ALL SELECT 'wris_river_level', city_id, count(*) FROM wris_river_level GROUP BY city_id
UNION ALL SELECT 'wris_rainfall', city_id, count(*) FROM wris_rainfall GROUP BY city_id
UNION ALL SELECT 'water_bodies_census', city_id, count(*) FROM water_bodies_census GROUP BY city_id
UNION ALL SELECT 'weather_daily', city_id, count(*) FROM weather_daily GROUP BY city_id
UNION ALL SELECT 'water_estimate_daily', city_id, count(*) FROM water_estimate_daily GROUP BY city_id
UNION ALL SELECT 'daily_briefing', city_id, count(*) FROM daily_briefing GROUP BY city_id
UNION ALL SELECT 'groundwater_monthly', city_id, count(*) FROM groundwater_monthly GROUP BY city_id
UNION ALL SELECT 'ward_risk_score', city_id, count(*) FROM ward_risk_score GROUP BY city_id
UNION ALL SELECT 'ward_narrative', city_id, count(*) FROM ward_narrative GROUP BY city_id
UNION ALL SELECT 'reservoir_catchment_context', city_id, count(*) FROM reservoir_catchment_context GROUP BY city_id
UNION ALL SELECT 'water_body_satellite_summary', city_id, count(*) FROM water_body_satellite_summary GROUP BY city_id
ORDER BY table_name, city_id;

-- Vaigai telemetry ownership: after the backfill, Theni/Dindigul/Virudhunagar
-- rows must be madurai, not chennai.
-- Expected result: zero rows.
SELECT 'wris_river_level' AS table_name, district, city_id, count(*) AS mislabeled_rows
FROM wris_river_level
WHERE lower(btrim(district)) IN ('madurai', 'theni', 'dindigul', 'virudhunagar')
  AND city_id <> 'madurai'
GROUP BY district, city_id
UNION ALL
SELECT 'wris_rainfall', district, city_id, count(*)
FROM wris_rainfall
WHERE lower(btrim(district)) IN ('madurai', 'theni', 'dindigul', 'virudhunagar')
  AND city_id <> 'madurai'
GROUP BY district, city_id;


-- 6. NEXT-MORNING CHECK: run after the first post-migration daily pipeline.
-- Review 2026-07-30: filtering on recent reading_date alone proves nothing -
-- migration 035 already repaired historical rows with recent reading dates.
-- A reading_date STRICTLY AFTER the apply date can only come from a
-- post-apply ingest. EDIT the date literal in the params CTE below before
-- running (plain SQL - works in the Supabase SQL Editor; no psql required).
-- Expected: every returned row has city_id = 'madurai' (rows exist only
-- once the fixed scrapers have run - ALSO confirm the launchd scheduler log
-- shows the job executed; no tracked workflow invokes these two scripts, so
-- the run itself needs independent evidence).
WITH params AS (
  SELECT DATE '2026-08-01' AS apply_date  -- <<< EDIT: the date 035 was applied
)
SELECT 'wris_river_level' AS table_name, w.reading_date, w.district, w.city_id, count(*) AS row_count
FROM wris_river_level w, params p
WHERE w.reading_date > p.apply_date
GROUP BY w.reading_date, w.district, w.city_id
UNION ALL
SELECT 'wris_rainfall', w.reading_date, w.district, w.city_id, count(*)
FROM wris_rainfall w, params p
WHERE w.reading_date > p.apply_date
GROUP BY w.reading_date, w.district, w.city_id
ORDER BY table_name, reading_date DESC, district;


-- 7. FK GUARANTEE: every city_id column must carry its named FK to cities.
-- Expected: zero rows (a row = a table whose constraint is missing - the
-- ADD COLUMN IF NOT EXISTS path skipped REFERENCES on a pre-existing column
-- and the DO-block guard somehow did not run).
SELECT t.relname AS table_missing_fk
FROM pg_class t
WHERE t.relname IN ('groundwater_wris', 'wris_river_level', 'wris_rainfall', 'water_bodies_census', 'weather_daily', 'water_estimate_daily', 'daily_briefing', 'groundwater_monthly', 'ward_risk_score', 'ward_narrative', 'reservoir_catchment_context', 'water_body_satellite_summary')
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = t.oid AND c.conname = t.relname || '_city_id_fkey'
  );


-- 8. ARBITER DEFINITIONS: the twelve city-aware unique indexes must exist,
-- be unique AND valid, on the right table with the right ordered columns
-- (name-existence alone would bless a same-named wrong index).
-- Expected: zero rows.
WITH expected(index_name, table_name, columns_csv) AS (
    VALUES
      ('weather_daily_city_date_uidx', 'weather_daily', 'city_id,date'),
      ('water_estimate_daily_city_date_uidx', 'water_estimate_daily', 'city_id,date'),
      ('daily_briefing_city_briefing_date_uidx', 'daily_briefing', 'city_id,briefing_date'),
      ('groundwater_monthly_city_ward_year_month_uidx', 'groundwater_monthly', 'city_id,ward_number,year,month'),
      ('ward_risk_score_city_ward_computed_date_uidx', 'ward_risk_score', 'city_id,ward_number,computed_date'),
      ('ward_narrative_city_ward_narrative_date_uidx', 'ward_narrative', 'city_id,ward_number,narrative_date'),
      ('groundwater_wris_city_station_reading_date_uidx', 'groundwater_wris', 'city_id,station_code,reading_date'),
      ('wris_river_level_city_station_reading_date_uidx', 'wris_river_level', 'city_id,station_code,reading_date'),
      ('wris_rainfall_city_station_reading_date_uidx', 'wris_rainfall', 'city_id,station_code,reading_date'),
      ('water_bodies_census_city_census_code_uidx', 'water_bodies_census', 'city_id,census_code'),
      ('reservoir_catchment_context_city_reservoir_date_window_uidx', 'reservoir_catchment_context', 'city_id,reservoir,context_date,window_days'),
      ('water_body_satellite_summary_city_target_date_uidx', 'water_body_satellite_summary', 'city_id,gee_target_id,summary_date')
  ),
  actual AS (
    SELECT
      ic.relname AS index_name,
      tc.relname AS table_name,
      i.indisunique,
      i.indisvalid,
      (i.indpred IS NOT NULL) AS is_partial,
      (SELECT string_agg(a.attname, ',' ORDER BY k.ord)
         FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
         JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
      ) AS columns_csv
    FROM pg_index i
    JOIN pg_class ic ON ic.oid = i.indexrelid
    JOIN pg_class tc ON tc.oid = i.indrelid
    WHERE ic.relnamespace = 'public'::regnamespace
  )
  SELECT e.index_name,
         CASE
           WHEN a.index_name IS NULL THEN 'missing'
           WHEN NOT a.indisunique THEN 'not unique'
           WHEN NOT a.indisvalid THEN 'invalid'
           WHEN a.is_partial THEN 'partial index (cannot back an unqualified ON CONFLICT)'
           WHEN a.table_name <> e.table_name THEN 'wrong table: ' || a.table_name
           WHEN a.columns_csv <> e.columns_csv THEN 'wrong columns: ' || a.columns_csv
         END AS problem
  FROM expected e
  LEFT JOIN actual a ON a.index_name = e.index_name
  WHERE a.index_name IS NULL
     OR NOT a.indisunique OR NOT a.indisvalid OR a.is_partial
     OR a.table_name <> e.table_name
     OR a.columns_csv <> e.columns_csv;
