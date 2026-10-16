-- =============================================================
-- 059_visakhapatnam_enable.sql
-- Launch cutover: flip Visakhapatnam from registered-but-disabled to live.
--
-- 057_visakhapatnam_seed_disabled.sql seeded the city with enabled=FALSE so the
-- reservoir ingest could write against city_id='visakhapatnam' before launch.
-- As with 056_ahmedabad_enable.sql, the ONLY functional switch is
-- `enabled: true` in src/lib/cities/visakhapatnam.ts; this column is read by no
-- code, and this migration keeps the row honest and a fresh rebuild
-- reproducible.
--
-- STATE AT CUTOVER (2026-10-16): cities 1 row, ward_count=98; water_sources
-- 6 rows (yeleru, raiwada, thatipudi, meghadrigedda with a daily APWRIMS
-- reading; mudasarlova and gambheeram without one); reservoir_daily_v2 16,098
-- rows from 2012-01-01 (17,288 loaded, less 1,188 Thatipudi and Raiwada days on
-- the superseded level record and 2 misprints), refreshed daily by the local job.
-- =============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cities WHERE city_id = 'visakhapatnam') THEN
    RAISE EXCEPTION
      'visakhapatnam is not seeded - apply 057_visakhapatnam_seed_disabled.sql first';
  END IF;
END $$;

UPDATE cities
   SET enabled = TRUE
 WHERE city_id = 'visakhapatnam';
