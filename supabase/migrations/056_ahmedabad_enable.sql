-- =============================================================
-- 056_ahmedabad_enable.sql
-- Launch cutover: flip Ahmedabad from registered-but-disabled to live.
--
-- 054_ahmedabad_seed_disabled.sql seeded the city with enabled=FALSE so the
-- reservoir ingest could write against city_id='ahmedabad' before launch.
-- As with 048_surat_enable.sql, the ONLY functional switch is `enabled: true`
-- in src/lib/cities/ahmedabad.ts; this column is read by no code, and this
-- migration keeps the row honest and a fresh rebuild reproducible.
--
-- STATE AT CUTOVER (2026-10-15): cities 1 row, ward_count=48; water_sources
-- 3 rows (sardar_sarovar, kadana, dharoi), none a primary drinking source;
-- reservoir_daily_v2 about 8,040 rows from 2019-06-07, refreshed daily by the
-- local job, with the department's seven known misprints withheld.
-- =============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cities WHERE city_id = 'ahmedabad') THEN
    RAISE EXCEPTION
      'ahmedabad is not seeded - apply 054_ahmedabad_seed_disabled.sql first';
  END IF;
END $$;

UPDATE cities
   SET enabled = TRUE
 WHERE city_id = 'ahmedabad';
