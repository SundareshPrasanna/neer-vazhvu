-- =============================================================
-- 051_retire_kaveri_delta.sql
-- Retires the Kaveri Delta place that 018 seeded. The platform's focus is
-- cities and districts, and no config, scope or reader names 'kaveri'.
--
--   1. Refuse to run while any table holds rows under kaveri beyond the seed.
--   2. Delete the seed: 10 aliases, 6 water_sources, the cities row.
--   3. Delete the 10 delta timeline rows 018 seeded, by id.
--
-- Drops no table and no column: the 018 schema stays for a later return.
-- Idempotent, and a no-op on a database where kaveri was never seeded.
-- =============================================================

BEGIN;

-- Guard: every table with a city_id, other than the three seed tables, must be empty under kaveri.
DO $$
DECLARE
  t TEXT;
  n BIGINT;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'city_id' AND NOT a.attisdropped
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
      AND c.relname NOT IN ('cities', 'water_sources', 'water_source_name_aliases')
    ORDER BY c.relname
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE city_id = %L', t, 'kaveri') INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION '051: % holds % row(s) under kaveri; export or move them before retiring the place', t, n;
    END IF;
  END LOOP;
END $$;

-- Children first, so the order holds whether or not the foreign keys cascade.
DELETE FROM water_source_name_aliases WHERE city_id = 'kaveri';
DELETE FROM water_sources WHERE city_id = 'kaveri';
DELETE FROM cities WHERE city_id = 'kaveri';

-- The timeline seed from 018, by id, so a row added since is left alone.
DELETE FROM delta_infrastructure_assets
  WHERE asset_id IN ('kallanai', 'upper_anicut', 'lower_anicut', 'mettur_dam', 'grand_anicut_canal_main');
DELETE FROM delta_capex_projects
  WHERE project_id IN ('iamwarm', 'adb_vennar', 'grand_anicut_erm', 'cauvery_subbasin', 'mukkombu_rebuild');

COMMIT;
