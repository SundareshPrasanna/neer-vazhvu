-- =============================================================
-- 042_kolkata_enable.sql
-- Launch cutover: flip Kolkata from registered-but-disabled to live.
--
-- 040_kolkata_seed_disabled.sql seeded the city with enabled=FALSE so the
-- CityConfig, water_sources and the UI could be built against
-- city_id='kolkata' without exposing it. This is the promised follow-up.
--
-- WHAT ACTUALLY GATES THE SITE - unchanged from 033_delhi_enable.sql and
-- 039_hyderabad_enable.sql:
--   The ONLY functional switch is `enabled: true` on the CityConfig in
--   src/lib/cities/kolkata.ts, read by the frontend route guard in
--   [cityId]/layout.tsx. Without it /kolkata 404s outside
--   NEXT_PUBLIC_PREVIEW_CITIES and the landing board shows Kolkata as
--   "onboarding".
--
--   This `enabled` COLUMN is read by no code at all - neither the Next.js
--   app nor the Python API queries it.
--
-- So this migration is for CONSISTENCY, not for gating: it keeps the seeded
-- row honest about a city that is live, and keeps the state reproducible on
-- a fresh database. Bengaluru shipped in June 2026 and sat at enabled=FALSE
-- here for weeks with nothing breaking (see 034_bangalore_enable_fix.sql),
-- which is the evidence for that claim rather than an assumption.
--
-- STATE AT CUTOVER (2026-08-14), so a fresh rebuild can be checked against it:
--   cities         1 row, place_kind='region', ward_count=144,
--                  enabled flips FALSE -> TRUE here
--   water_sources  4 rows: hooghly_palta, garden_reach, dhapa (all 'river',
--                  primary drinking sources) and kmc_tubewells
--                  ('borewell_field', not primary)
--   reservoir_daily_v2   0 rows, AND THAT IS CORRECT. Kolkata impounds
--                  nothing - it abstracts run-of-river from the Hooghly at
--                  Palta and pumps deep tube wells - so there is no storage
--                  series to backfill even in principle. Every source is
--                  hasPublicFeed:false because no authority publishes a daily
--                  abstraction or production figure. Hyderabad needed 27,019
--                  rows here; Kolkata needs none, which is why its hero is
--                  drainage-capacity rather than days-left.
--
-- SCHEMA GAP CLOSED 2026-08-20. Everything below is kept as the record of what
-- was true when this migration was written; none of it is true now. The whole
-- backlog 017-048 was applied and the remote ledger repaired, so
-- `supabase migration list` shows Local == Remote for all 48 and there is no
-- longer a reason to avoid `supabase db push`. See docs/architecture/
-- database-reconciliation-2026-08-20.md.
--
-- KNOWN SCHEMA GAP, recorded rather than worked around:
--   040 and 041 also INSERT INTO corporations and source_corporation. Those
--   tables do not exist in the live database: they are DDL from
--   029_mmr_corporations.sql, which was never applied (the remote migration
--   ledger records only 001-016; later migrations were applied out-of-band and
--   data-only). Mumbai's corporation rows are absent for the same reason and
--   have been since it launched, with nothing breaking, because NO code queries
--   either table - the region dashboard reads its corporation list from
--   src/lib/cities/<city>.ts, not from SQL.
--   So Kolkata's corporation rows are pending, not lost. Applying 029 closes
--   the drift for every city at once; it is idempotent throughout
--   (CREATE TABLE/INDEX IF NOT EXISTS, INSERT ... ON CONFLICT DO NOTHING) and
--   the policies cannot pre-exist because the tables do not.
--
-- PREREQUISITE: 040 and 041 must already be applied. This migration raises
-- rather than silently updating nothing if the row is absent.
-- =============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cities WHERE city_id = 'kolkata') THEN
    RAISE EXCEPTION
      'kolkata is not seeded - apply 040_kolkata_seed_disabled.sql first';
  END IF;
END $$;

UPDATE cities
   SET enabled = TRUE
 WHERE city_id = 'kolkata';
