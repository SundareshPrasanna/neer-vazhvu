-- 030_rls_hardening_reference_tables.sql
-- Defence-in-depth: enable Row Level Security on the public reference tables
-- that were created without it (cities/017, water_sources/017,
-- water_source_name_aliases/017, reservoir_daily_v2/018). They hold public,
-- read-only civic data (no PII/secrets), but with RLS OFF their write exposure
-- depends entirely on the anon role's table grants - fragile. Enabling RLS with
-- a SELECT-only policy GUARANTEES the public anon key can read but never
-- insert/update/delete, regardless of grant drift. The pipeline writes via the
-- service_role, which bypasses RLS, so ingestion is unaffected.
--
-- Idempotent: guarded so re-running (or running where a table is absent) is a
-- no-op. Reads are preserved (explicit GRANT SELECT + USING(true) policy);
-- only anon WRITE access is removed.

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'cities', 'water_sources', 'water_source_name_aliases', 'reservoir_daily_v2'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;  -- table not present in this environment
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    -- Read-only for anon; revoke any inherited write grants.
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon, authenticated', t);
    -- Public-read policy (create once).
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
        AND policyname = 'Public read ' || t
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT USING (true)',
        'Public read ' || t, t
      );
    END IF;
  END LOOP;
END $$;
