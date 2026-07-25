-- =============================================================
-- 033_delhi_enable.sql
-- Launch cutover: flip Delhi from registered-but-disabled to live.
--
-- 031_delhi_seed_disabled.sql seeded the city with enabled=FALSE so the
-- CityConfig, water_sources and ingest could be built against
-- city_id='delhi' without exposing it. This is the promised follow-up.
--
-- WHAT ACTUALLY GATES THE SITE (verified 2026-07-26, because the older
-- comments in this repo get this wrong):
--   The ONLY functional switch is `enabled: true` on the CityConfig in
--   src/lib/cities/delhi.ts, read by the frontend route guard in
--   [cityId]/layout.tsx. Without it /delhi 404s and the landing board shows
--   Delhi as "onboarding".
--
--   This `enabled` COLUMN is currently read by no code at all - neither the
--   Next.js app nor the Python API queries it. The backend's
--   list_enabled_places() reads the PYTHON registry in app/cities/, not this
--   table, and nothing imports that module either.
--
-- So this migration is for CONSISTENCY, not for gating: it keeps the seeded
-- row honest about a city that is live, and keeps the state reproducible on
-- a fresh database. Do not read it as a launch gate - Bengaluru shipped in
-- June 2026 and sat at enabled=FALSE here for weeks with nothing breaking
-- (see 034_bangalore_enable_fix.sql).
--
-- PREREQUISITE: 031 and 032 must already be applied. This migration is a
-- no-op UPDATE if the row is absent, so it fails loudly instead of
-- silently doing nothing.
-- =============================================================

DO $$
DECLARE
  updated INT;
BEGIN
  UPDATE cities SET enabled = TRUE WHERE city_id = 'delhi';
  GET DIAGNOSTICS updated = ROW_COUNT;

  IF updated = 0 THEN
    RAISE EXCEPTION
      'No cities row for city_id=delhi. Apply 031_delhi_seed_disabled.sql (and 032_delhi_water_sources.sql) before this migration.';
  END IF;
END $$;
