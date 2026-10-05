-- =============================================================
-- 052_madurai_water_body_city.sql
-- Until 050 the GEE water-body writer sent no city_id, so the weekly and
-- monthly Madurai passes landed under the old DEFAULT 'chennai'. Their nine
-- targets (public/data/gee-phase1-water-body-targets-madurai.json) appear in
-- no Chennai manifest, so gee_target_id alone identifies the rows: 468 on
-- 2026-10-05. Idempotent; touches no other table or city.
-- =============================================================

BEGIN;

UPDATE water_body_satellite_summary
SET city_id = 'madurai'
WHERE city_id = 'chennai'
  AND gee_target_id IN (
    'osm:1073092381', 'osm:136448547', 'osm:13724237',
    'osm:18641173', 'osm:339279340', 'osm:51815981',
    'osm:755424587', 'osm:870776568', 'osm:921413067'
  );

COMMIT;
