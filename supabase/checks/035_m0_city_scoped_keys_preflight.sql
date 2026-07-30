-- Preflight checks before applying 035_m0_city_scoped_keys.sql to live Supabase.
--
-- This file is not a migration. Run it manually against the target database
-- after dumping/diffing the live schema and before applying migration 035.
--
-- Run section 1 first.
--   - If it returns zero rows, sections 2 and 3 can run directly.
--   - If it returns any rows, stop and reconcile that schema drift first;
--     the later sections reference city_id and will not run until those
--     columns exist.

-- 1. city_id columns expected from migration 026.
-- Expected result: zero rows.
WITH expected(table_name) AS (
  VALUES
    ('groundwater_wris'),
    ('wris_river_level'),
    ('wris_rainfall'),
    ('water_bodies_census'),
    ('weather_daily'),
    ('water_estimate_daily'),
    ('daily_briefing'),
    ('groundwater_monthly'),
    ('ward_risk_score'),
    ('ward_narrative'),
    ('reservoir_catchment_context'),
    ('water_body_satellite_summary')
)
SELECT e.table_name AS missing_city_id_column
FROM expected e
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = e.table_name
 AND c.column_name = 'city_id'
WHERE c.column_name IS NULL;


-- 2. Existing city_id values should not contain NULLs.
-- Expected result: every null_city_id_rows value is 0.
SELECT 'groundwater_wris' AS table_name, count(*) AS null_city_id_rows FROM groundwater_wris WHERE city_id IS NULL
UNION ALL SELECT 'wris_river_level', count(*) FROM wris_river_level WHERE city_id IS NULL
UNION ALL SELECT 'wris_rainfall', count(*) FROM wris_rainfall WHERE city_id IS NULL
UNION ALL SELECT 'water_bodies_census', count(*) FROM water_bodies_census WHERE city_id IS NULL
UNION ALL SELECT 'weather_daily', count(*) FROM weather_daily WHERE city_id IS NULL
UNION ALL SELECT 'water_estimate_daily', count(*) FROM water_estimate_daily WHERE city_id IS NULL
UNION ALL SELECT 'daily_briefing', count(*) FROM daily_briefing WHERE city_id IS NULL
UNION ALL SELECT 'groundwater_monthly', count(*) FROM groundwater_monthly WHERE city_id IS NULL
UNION ALL SELECT 'ward_risk_score', count(*) FROM ward_risk_score WHERE city_id IS NULL
UNION ALL SELECT 'ward_narrative', count(*) FROM ward_narrative WHERE city_id IS NULL
UNION ALL SELECT 'reservoir_catchment_context', count(*) FROM reservoir_catchment_context WHERE city_id IS NULL
UNION ALL SELECT 'water_body_satellite_summary', count(*) FROM water_body_satellite_summary WHERE city_id IS NULL;


-- 3. Duplicate checks for every new city-aware unique key.
-- Expected result: zero rows.
SELECT 'weather_daily(city_id,date)' AS key_name, city_id, date::TEXT AS key_1, NULL::TEXT AS key_2, count(*) AS row_count
FROM weather_daily
GROUP BY city_id, date
HAVING count(*) > 1
UNION ALL
SELECT 'water_estimate_daily(city_id,date)', city_id, date::TEXT, NULL::TEXT, count(*)
FROM water_estimate_daily
GROUP BY city_id, date
HAVING count(*) > 1
UNION ALL
SELECT 'daily_briefing(city_id,briefing_date)', city_id, briefing_date::TEXT, NULL::TEXT, count(*)
FROM daily_briefing
GROUP BY city_id, briefing_date
HAVING count(*) > 1
UNION ALL
SELECT 'groundwater_monthly(city_id,ward_number,year,month)', city_id, ward_number::TEXT, year::TEXT || '-' || month::TEXT, count(*)
FROM groundwater_monthly
GROUP BY city_id, ward_number, year, month
HAVING count(*) > 1
UNION ALL
SELECT 'ward_risk_score(city_id,ward_number,computed_date)', city_id, ward_number::TEXT, computed_date::TEXT, count(*)
FROM ward_risk_score
GROUP BY city_id, ward_number, computed_date
HAVING count(*) > 1
UNION ALL
SELECT 'ward_narrative(city_id,ward_number,narrative_date)', city_id, ward_number::TEXT, narrative_date::TEXT, count(*)
FROM ward_narrative
GROUP BY city_id, ward_number, narrative_date
HAVING count(*) > 1
UNION ALL
SELECT 'groundwater_wris(city_id,station_code,reading_date)', city_id, station_code, reading_date::TEXT, count(*)
FROM groundwater_wris
GROUP BY city_id, station_code, reading_date
HAVING count(*) > 1
UNION ALL
SELECT 'wris_river_level(city_id,station_code,reading_date)', city_id, station_code, reading_date::TEXT, count(*)
FROM wris_river_level
GROUP BY city_id, station_code, reading_date
HAVING count(*) > 1
UNION ALL
SELECT 'wris_rainfall(city_id,station_code,reading_date)', city_id, station_code, reading_date::TEXT, count(*)
FROM wris_rainfall
GROUP BY city_id, station_code, reading_date
HAVING count(*) > 1
UNION ALL
SELECT 'water_bodies_census(city_id,census_code)', city_id, census_code, NULL::TEXT, count(*)
FROM water_bodies_census
WHERE census_code IS NOT NULL
GROUP BY city_id, census_code
HAVING count(*) > 1
UNION ALL
SELECT 'reservoir_catchment_context(city_id,reservoir,context_date,window_days)', city_id, reservoir::TEXT, context_date::TEXT || '/' || window_days::TEXT, count(*)
FROM reservoir_catchment_context
GROUP BY city_id, reservoir, context_date, window_days
HAVING count(*) > 1
UNION ALL
SELECT 'water_body_satellite_summary(city_id,gee_target_id,summary_date)', city_id, gee_target_id, summary_date::TEXT, count(*)
FROM water_body_satellite_summary
GROUP BY city_id, gee_target_id, summary_date
HAVING count(*) > 1;


-- 4. WRIS telemetry district ownership sanity check.
-- Expected result: Vaigai-system districts map to madurai; any unexpected
-- district/city_id pairing should be reviewed before applying migration 035.
SELECT 'wris_river_level' AS table_name, district, city_id, count(*) AS row_count
FROM wris_river_level
GROUP BY district, city_id
ORDER BY table_name, district, city_id;

SELECT 'wris_rainfall' AS table_name, district, city_id, count(*) AS row_count
FROM wris_rainfall
GROUP BY district, city_id
ORDER BY table_name, district, city_id;
