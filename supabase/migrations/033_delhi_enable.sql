-- =============================================================
-- 033_delhi_enable.sql
-- Launch cutover: flip Delhi from registered-but-disabled to live.
--
-- 031_delhi_seed_disabled.sql seeded the city with enabled=FALSE so the
-- CityConfig, water_sources and ingest could be built against
-- city_id='delhi' without exposing it. This is the promised follow-up.
--
-- TWO SWITCHES, BOTH REQUIRED - they gate different surfaces:
--   1. `enabled: true` on the CityConfig in src/lib/cities/delhi.ts, which
--      the frontend route guard ([cityId]/layout.tsx) reads. Without it the
--      /delhi routes 404 and the landing board shows Delhi as "onboarding".
--   2. this migration, which the backend's list_enabled_places() reads.
-- Flipping only one leaves the site and the API disagreeing about whether
-- Delhi exists. Bengaluru and Mumbai were switched on directly in Supabase
-- with no migration recorded; doing it in version control this time so the
-- cutover is reviewable and repeatable on a fresh database.
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
