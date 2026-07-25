-- =============================================================
-- 034_bangalore_enable_fix.sql
-- Corrects a stale flag: Bengaluru is live but sits enabled=FALSE.
--
-- 024_bangalore_seed_disabled.sql seeded Bengaluru with enabled=FALSE and
-- promised to "flip enabled=TRUE in a future migration once data + UI are
-- ready". Bengaluru went live in June 2026 (PR #117) by flipping
-- `enabled: true` on the CityConfig, but the matching database flip was
-- never written, so the row has been wrong ever since.
--
-- Found on 2026-07-26 while checking Delhi's migration state: the cities
-- table read back bangalore=False against chennai/madurai/mumbai=True,
-- while /bangalore has been serving in production throughout.
--
-- Why this was invisible, stated accurately: this column is read by NO code.
-- Verified 2026-07-26 - neither the Next.js app nor the Python API queries
-- cities.enabled. The website gates solely on `enabled` in the TypeScript
-- CityConfig via src/app/[cityId]/layout.tsx. The backend's
-- list_enabled_places() reads the PYTHON registry in app/cities/ (where
-- bangalore and mumbai are ALSO still enabled=False), and nothing imports
-- that module either.
--
-- So this fixes a stale FACT, not a live bug. Nothing was broken by it and
-- nothing will visibly change when it is applied. It is worth doing because
-- the row is the schema's own record of which cities are live, and leaving
-- it wrong makes the table untrustworthy for the next person who reads it.
--
-- The matching Python-registry flags (app/cities/bangalore.py and
-- mumbai.py) are still False and are NOT touched here - that is a separate
-- correction in a different language, and the registry is currently unused.
--
-- Delhi's equivalent flip is 033_delhi_enable.sql. Both are written as
-- migrations rather than done by hand so the state is reproducible on a
-- fresh database.
-- =============================================================

DO $$
DECLARE
  updated INT;
BEGIN
  UPDATE cities SET enabled = TRUE WHERE city_id = 'bangalore' AND enabled IS DISTINCT FROM TRUE;
  GET DIAGNOSTICS updated = ROW_COUNT;

  IF updated = 0 THEN
    -- Already TRUE, or the row is missing. Distinguish the two: a no-op on
    -- an already-correct row is fine, a missing row is not.
    IF NOT EXISTS (SELECT 1 FROM cities WHERE city_id = 'bangalore') THEN
      RAISE EXCEPTION
        'No cities row for city_id=bangalore. Apply 024_bangalore_seed_disabled.sql first.';
    END IF;
    RAISE NOTICE 'bangalore already enabled=TRUE; nothing to do.';
  END IF;
END $$;
