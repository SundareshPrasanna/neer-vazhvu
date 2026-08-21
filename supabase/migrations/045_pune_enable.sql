-- =============================================================
-- 045_pune_enable.sql
-- Launch cutover: flip Pune from registered-but-disabled to live.
--
-- 044_pune_seed_disabled.sql seeded the city with enabled=FALSE so the
-- CityConfig, water_sources and ten routes could be built against
-- city_id='pune' without exposing any of it. This is the promised follow-up.
--
-- WHAT ACTUALLY GATES THE SITE - unchanged from 033_delhi_enable.sql,
-- 039_hyderabad_enable.sql and 042_kolkata_enable.sql:
--   The ONLY functional switch is `enabled: true` on the CityConfig in
--   src/lib/cities/pune.ts, read by the frontend route guard in
--   [cityId]/layout.tsx. Without it /pune 404s outside
--   NEXT_PUBLIC_PREVIEW_CITIES and the landing board shows Pune as
--   "onboarding".
--
--   This `enabled` COLUMN is read by no code at all - neither the Next.js app
--   nor the Python API queries it.
--
-- So this migration is for CONSISTENCY, not for gating: it keeps the seeded
-- row honest about a city that is live, and keeps the state reproducible on a
-- fresh database.
--
-- STATE AT CUTOVER (2026-08-18), so a fresh rebuild can be checked against it:
--   cities         1 row, ward_count=41 (the 2025 delimitation's electoral
--                  prabhags, NOT the 15 administrative ward offices),
--                  default_consumption_mld=1631.84 (PMC's own stated total
--                  requirement, not a measured delivery), enabled flips
--                  FALSE -> TRUE here.
--   water_sources  6 rows: khadakwasla, panshet, warasgaon and temghar (the
--                  Khadakwasla chain PMC drinks from), bhama_askhed (PMC's
--                  eastern scheme) and pawana (PCMC's source, the one row with
--                  is_primary_drinking_source FALSE).
--                  Their four chain capacities sum to 29,158.9 Mcft = 29.159
--                  TMC, which reproduces the 29.15 TMC PMC publishes in its own
--                  ESR from a completely separate source. That agreement was
--                  re-checked against the live rows after applying 044.
--                  MULSHI IS DELIBERATELY ABSENT: it is Tata's hydro reservoir,
--                  carried on the artifact for context and excluded from every
--                  supply total, so scrape_pravah_dams.py's pune db_filter
--                  drops it before any write.
--   reservoir_daily_v2  12 rows at cutover, from the first
--                  `scrape_pravah_dams.py --city pune --supabase` run: 6 dams
--                  for the report date plus the same 6 dated a year back, which
--                  the bulletin publishes as a same-date-last-year percentage.
--                  Every daily run grows the series at both ends.
--                  Checked before the flip: no row exceeds 105% of live
--                  capacity. That is the signature of the bug in issue #276,
--                  where the Pravah parser read today's GROSS storage as last
--                  year's LIVE and put Modaksagar at 159%. The producer fix
--                  shipped in #275; this confirms Pune never carried it.
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
--   still do not exist in the live database - the remote ledger records only
--   001-016 and later migrations were applied out-of-band and data-only. No
--   code queries either table (the region dashboard reads its corporation list
--   from src/lib/cities/<city>.ts), so nothing breaks. Pune declares no
--   corporations of its own, being a PMC-scoped city rather than an MMR-style
--   region, so it adds nothing to that debt.
--
-- PREREQUISITE: 044 must already be applied. This raises rather than silently
-- updating nothing if the row is absent.
-- =============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cities WHERE city_id = 'pune') THEN
    RAISE EXCEPTION
      'pune is not seeded - apply 044_pune_seed_disabled.sql first';
  END IF;
END $$;

UPDATE cities
   SET enabled = TRUE
 WHERE city_id = 'pune';
