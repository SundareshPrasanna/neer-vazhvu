-- =============================================================
-- 071_jaipur_enable.sql
-- Launch cutover: flip Jaipur from registered-but-disabled to live.
--
-- 069_jaipur_seed_disabled.sql seeded the city with enabled=FALSE so the
-- reservoir ingest could write against city_id='jaipur' before launch.
-- As with 056_ahmedabad_enable.sql and 063_nagpur_enable.sql, the ONLY
-- functional switch is `enabled: true` in src/cities/jaipur/config.ts; this
-- column is read by no code, and this migration keeps the row honest and a
-- fresh rebuild reproducible.
--
-- STATE AT CUTOVER: cities 1 row (069), ward_count=150; water_sources 2 rows
-- (070: bisalpur primary, ramgarh not). reservoir_daily_v2 already holds
-- Jaipur's history from 16 Jun 2022 (scrape_rajasthan_wrd_dams.py backfill,
-- 21 Oct 2026); from the merge on, step 7b of the local scheduled job adds
-- each report.
--
-- Apply after the merge; 069, 070 and the backfill come first.
-- =============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cities WHERE city_id = 'jaipur') THEN
    RAISE EXCEPTION
      'jaipur is not seeded - apply 069_jaipur_seed_disabled.sql first';
  END IF;
END $$;

UPDATE cities
   SET enabled = TRUE
 WHERE city_id = 'jaipur';
