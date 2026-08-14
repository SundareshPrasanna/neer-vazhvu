-- =============================================================
-- 039_hyderabad_enable.sql
-- Launch cutover: flip Hyderabad from registered-but-disabled to live.
--
-- 037_hyderabad_seed_disabled.sql seeded the city with enabled=FALSE so the
-- CityConfig, water_sources and the 12.5-year ingest could be built against
-- city_id='hyderabad' without exposing it. This is the promised follow-up.
--
-- WHAT ACTUALLY GATES THE SITE - unchanged from 033_delhi_enable.sql, and
-- restated because the older comments in this repo get it wrong:
--   The ONLY functional switch is `enabled: true` on the CityConfig in
--   src/lib/cities/hyderabad.ts, read by the frontend route guard in
--   [cityId]/layout.tsx. Without it /hyderabad 404s outside
--   NEXT_PUBLIC_PREVIEW_CITIES and the landing board shows Hyderabad as
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
--   cities                    1 row,  enabled flips FALSE -> TRUE here
--   water_sources             8 rows, 6 city sources + 2 context-only
--   water_source_name_aliases 23 rows
--   reservoir_daily_v2        27,019 rows, 2014-01-01 .. 2026-08-14,
--                             6 city sources (the 2 parent Krishna storages
--                             are excluded by the scraper's is_city_source
--                             filter - at 312,045 and 215,807 mcft they are
--                             ~5x the city's whole impounded volume and would
--                             swamp every total they entered)
--
-- PREREQUISITE: 037 and 038 must already be applied. This migration raises
-- rather than silently updating nothing if the row is absent.
-- =============================================================

DO $$
DECLARE
  updated INT;
BEGIN
  UPDATE cities SET enabled = TRUE WHERE city_id = 'hyderabad';
  GET DIAGNOSTICS updated = ROW_COUNT;

  IF updated = 0 THEN
    RAISE EXCEPTION
      'No cities row for city_id=hyderabad. Apply 037_hyderabad_seed_disabled.sql (and 038_hyderabad_water_sources.sql) before this migration.';
  END IF;
END $$;
