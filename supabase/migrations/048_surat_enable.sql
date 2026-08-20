-- =============================================================
-- 048_surat_enable.sql
-- Launch cutover: flip Surat from registered-but-disabled to live.
--
-- 046_surat_seed_disabled.sql seeded the city with enabled=FALSE so the
-- CityConfig, water_sources and nine routes could be built against
-- city_id='surat' without exposing any of it. This is the promised follow-up.
--
-- RENUMBERED FROM 044/045. Surat's two seed migrations were authored as 044
-- and 045 while this branch was open, and Pune took the same two numbers on
-- main in the meantime, so the merged tree carried duplicate version prefixes.
-- Nothing keyed on them - the remote ledger records only 001-016 and later
-- migrations were applied out-of-band - so renaming is safe and makes a fresh
-- rebuild deterministic instead of relying on 'p' sorting before 's'.
--
-- WHAT ACTUALLY GATES THE SITE - unchanged from 033_delhi_enable.sql,
-- 039_hyderabad_enable.sql, 042_kolkata_enable.sql and 045_pune_enable.sql:
--   The ONLY functional switch is `enabled: true` on the CityConfig in
--   src/lib/cities/surat.ts, read by the frontend route guard in
--   [cityId]/layout.tsx. Without it /surat 404s outside
--   NEXT_PUBLIC_PREVIEW_CITIES and the landing board shows Surat as
--   "onboarding".
--
--   This `enabled` COLUMN is read by no code at all - neither the Next.js app
--   nor the Python API queries it.
--
-- So this migration is for CONSISTENCY, not for gating: it keeps the seeded
-- row honest about a city that is live, and keeps the state reproducible on a
-- fresh database.
--
-- STATE AT CUTOVER (2026-08-20), so a fresh rebuild can be checked against it:
--   cities         1 row, ward_count=30 (the electoral wards SMC is elected
--                  on, 4 corporators each - NOT the analytical unit, which is
--                  the zone; see 046 for why "ward" means three incompatible
--                  things in Surat), default_consumption_mld=NULL because SMC
--                  publishes no measured delivery figure and inventing one
--                  would put a number under a hero that is about flood
--                  headroom, not supply runway. enabled flips FALSE -> TRUE.
--   water_sources  2 rows, and NEITHER is a reservoir. Surat is run-of-river
--                  like Kolkata: it impounds nothing of its own, so days-left
--                  is undefined rather than un-backfilled. Both rows are
--                  flow_station on purpose - ukai (full_tank_level_ft 345.0,
--                  operated by the Gujarat Water Resources Department, ~100 km
--                  upstream) and singanpor_weir, the weir-cum-causeway pond
--                  SMC actually abstracts from, which is the one carrying
--                  is_primary_drinking_source TRUE. Recording Ukai as a
--                  reservoir would let its volume be counted as Surat storage,
--                  which it is not: Surat's share is published nowhere.
--   reservoir_daily_v2  NO ROWS, and none expected. There is nothing to fill
--                  them with. The live chain is scraped to
--                  surat-flood-chain.json by the launchd job, not to the
--                  database, because SMC's page is a rolling ~10-reading
--                  window with no archive and the artifact is what the
--                  flood-headroom hero reads.
--
-- SCHEMA GAP CLOSED 2026-08-20. Everything below is kept as the record of what
-- was true when this migration was written; none of it is true now. The whole
-- backlog 017-048 was applied and the remote ledger repaired, so
-- `supabase migration list` shows Local == Remote for all 48 and there is no
-- longer a reason to avoid `supabase db push`. See docs/architecture/
-- database-reconciliation-2026-08-20.md.
--
-- KNOWN SCHEMA GAP, unchanged and recorded again rather than worked around:
--   The corporations and source_corporation tables from 029_mmr_corporations.sql
--   still do not exist in the live database. No code queries either table, and
--   Surat declares no corporations of its own, so it adds nothing to that debt.
--
-- GURUGRAM, noted here when it was still broken and FIXED 2026-08-20: it had
--   been live since 15 Aug with no row in the cities table because
--   043_gurugram_seed_enabled.sql was never applied. Applied now; the table
--   holds all ten cities.
--
-- PREREQUISITE: 046 must already be applied. This raises rather than silently
-- updating nothing if the row is absent.
-- =============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cities WHERE city_id = 'surat') THEN
    RAISE EXCEPTION
      'surat is not seeded - apply 046_surat_seed_disabled.sql first';
  END IF;
END $$;

UPDATE cities
   SET enabled = TRUE
 WHERE city_id = 'surat';
