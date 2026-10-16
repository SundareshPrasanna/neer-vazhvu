-- =============================================================
-- 063_nagpur_enable.sql
-- Launch cutover: flip Nagpur from registered-but-disabled to live.
--
-- 060_nagpur_seed_disabled.sql seeded the city with enabled=FALSE so the
-- reservoir ingest could write against city_id='nagpur' before launch.
-- As with 048_surat_enable.sql, 056_ahmedabad_enable.sql and
-- 059_visakhapatnam_enable.sql, the ONLY functional switch is
-- `enabled: true` in src/lib/cities/nagpur.ts; this
-- column is read by no code, and this migration keeps the row honest and a
-- fresh rebuild reproducible.
--
-- STATE AT CUTOVER: cities 1 row (060), ward_count=38; water_sources 4 rows
-- (061: totladoh, navegaon_khairi, kanhan_intake, gorewada; the two dams and
-- the intake primary, Gorewada not; the intake and Gorewada have no feed).
-- reservoir_daily_v2 already holds Nagpur rows when this is applied. The
-- launch order is 060, 061 and one `scrape_pravah_dams.py --city nagpur
-- --supabase` run before the merge (that day's reading for Totladoh and
-- Navegaon Khairi, plus each bulletin's same-date-last-year row, written
-- insert-only), then the merge, then this migration. From then on step 2c of
-- the local scheduled job adds each day's readings. The Marathi-archive
-- backfill (dated copies from 25 Feb 2024) is insert-only and runs only on
-- the owner's word.
--
-- Apply after the merge; 060, 061 and the first ingest come first.
-- =============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cities WHERE city_id = 'nagpur') THEN
    RAISE EXCEPTION
      'nagpur is not seeded - apply 060_nagpur_seed_disabled.sql first';
  END IF;
END $$;

UPDATE cities
   SET enabled = TRUE
 WHERE city_id = 'nagpur';
