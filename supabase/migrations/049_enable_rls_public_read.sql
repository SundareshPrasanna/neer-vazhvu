-- 049: enable row-level security on every publicly exposed table.
--
-- WHY. Supabase flagged rls_disabled_in_public on 2026-08-23. With RLS off, a
-- table's access is governed by GRANTs alone, and Supabase grants anon the full
-- set on the public schema -- so the anon key, which ships in the client bundle
-- and any visitor can read out of page source, could insert, update and delete
-- production data. That is the exposure this migration closes.
--
-- HOW NOT TO PROVE IT, since two obvious probes are worthless here and both
-- were tried first:
--   * INSERT with a made-up column returns 400 PGRST204. That says nothing:
--     PostgREST validates the payload against its schema CACHE in the API layer
--     and never issues SQL, so the response is identical whether or not RLS
--     would have allowed the write.
--   * DELETE with a filter matching nothing returns 204. Also nothing: under
--     RLS a DELETE with no matching policy filters every row out and reports
--     zero rows deleted, which looks exactly like a filter that matched none.
-- INSERT with REAL columns is the only probe that distinguishes them, because
-- INSERT is the one write RLS refuses with an error (42501) rather than by
-- quietly reducing the row set. Use that, and clean up after yourself.
--
-- WHAT CHANGES. Reads that the site actually performs are preserved exactly,
-- via explicit SELECT policies. No table gains an INSERT, UPDATE or DELETE
-- policy, so writes stop for anon and authenticated alike.
--
-- WHY THE WRITERS KEEP WORKING. Every writer authenticates as service_role:
-- src/lib/supabase/admin.ts for cron and seeds, neer-vazhvu-api/app/db.py for
-- the scrapers. service_role BYPASSES row-level security, so none of them
-- needs a policy and none of them is affected by this migration.
--
-- HOW THE TWO LISTS WERE DERIVED. Not from the schema, and not guessed: every
-- .from() call in src/ was attributed to the client that issues it
-- (createServerClient = anon, createAdminClient = service_role), and the
-- lock_down list was then checked for any other reference across src/,
-- neer-vazhvu-api/ and scripts/. `cities` is in the lock_down list because
-- nothing calls .from('cities') anywhere -- src/lib/cities/gurugram.ts says in
-- as many words that the enabled column "is read by no code at all".
--
-- APPLIED to production 2026-08-25 via the SQL editor. Verified afterwards:
-- all fourteen anon reads return 200, the two RPCs the city pages call with the
-- anon key still work, and an INSERT as anon is refused with
--   42501 new row violates row-level security policy
-- which is the only write RLS rejects with an error rather than by filtering
-- rows to none. Eight live pages render with real reservoir figures.
--
-- WHAT THIS MIGRATION DELIBERATELY DOES NOT DO. The database already carried
-- SELECT policies named "Public read <table>" granted to role `public`, which
-- includes anon. They were inert while RLS was off and became live the moment
-- it was switched on. That means tables this migration does not give a policy
-- to -- cities, water_sources, wris_rainfall and the rest -- are STILL readable
-- by anon through those older policies. Dropping them was considered and
-- rejected: read access to public civic data is the platform's purpose, the
-- exposure that mattered was anonymous WRITE access and that is now closed, and
-- a drop risks blanking a section of a live public site for some consumer
-- outside this repo that no grep can find. If it is ever revisited, do it one
-- table at a time with a check between, starting with `cities` -- nothing calls
-- .from('cities') anywhere.
--
-- Idempotent: safe to re-run after a partial apply.

do $$
declare
  t text;

  -- Read by the site with the ANON key. These keep a permissive SELECT policy
  -- so the front end behaves exactly as it does today.
  public_read text[] := array[
    'daily_briefing',
    'groundwater_monthly',
    'groundwater_wris',
    'reservoir_catchment_context',
    'reservoir_daily',
    'reservoir_daily_v2',
    'reservoir_forecast',
    'reservoir_forecast_v2',
    'ward_narrative',
    'ward_risk_score',
    'water_bodies_census',
    'water_body_satellite_summary',
    'weather_daily'
  ];

  -- Read by NO anon-key caller in this repo. RLS is switched on so writes are
  -- refused, but note these keep whatever pre-existing "Public read <table>"
  -- policy the database already carried, so they REMAIN READABLE by anon. See
  -- the note above on why those were not dropped.
  lock_down text[] := array[
    'cities',
    'corporations',
    'delta_capex_projects',
    'delta_infrastructure_assets',
    'news_articles',
    'source_corporation',
    'water_estimate_daily',
    'water_source_name_aliases',
    'water_sources',
    'wris_rainfall',
    'wris_river_level',
    'basin_rainfall_daily',
    'flow_station_daily',
    'mettur_release_signal',
    'pipeline_log',
    'reservoir_meta'
  ];
begin
  foreach t in array public_read || lock_down loop
    if not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t and c.relkind = 'r'
    ) then
      raise notice 'skipping %: not a base table in this database', t;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);
  end loop;

  foreach t in array public_read loop
    if exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t and c.relkind = 'r'
    ) and not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = 'public read'
    ) then
      execute format(
        'create policy "public read" on public.%I for select to anon, authenticated using (true)',
        t
      );
    end if;
  end loop;
end $$;

-- groundwater_wris_latest is a VIEW over groundwater_wris and is read with the
-- anon key. A view runs with its owner's rights unless it is declared
-- security_invoker, which would let it hand out rows the caller could not read
-- directly. Make it honour the caller's RLS, on the Postgres versions that
-- support it.
do $$
begin
  if exists (
    select 1 from pg_views where schemaname = 'public' and viewname = 'groundwater_wris_latest'
  ) and current_setting('server_version_num')::int >= 150000 then
    execute 'alter view public.groundwater_wris_latest set (security_invoker = true)';
  end if;
end $$;
