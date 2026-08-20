# Database reconciliation, 2026-08-20

The live database and `supabase/migrations/` had been drifting apart since
migration 017. This records what was actually wrong, what was applied, and what
is now true, so the next person does not have to re-derive it.

## The state before

The remote ledger (`supabase_migrations.schema_migrations`) recorded **001-016
only**. Everything from 017 on had been applied by hand, out of band, and
mostly data-only - which is why four separate migration headers carry some
version of "the remote ledger records only 001-016; later migrations were
applied out-of-band". That made `supabase db push` unusable: it would have
tried to re-run 32 migrations including DDL.

Because nobody could push, the DDL migrations quietly never landed:

| Migration | What was missing | Consequence |
|---|---|---|
| **018** | 4 of its tables (`delta_capex_projects`, `delta_infrastructure_assets`, `flow_station_daily`, `mettur_release_signal`) | none - the Kaveri delta project was dropped. `basin_rainfall_daily`, `place_kind`, the `flow_station` source type and `reservoir_daily_v2` had all landed. |
| **022** | `avg_monthly_inflow_v2()` | **real**: `data.ts` calls this RPC on every city dashboard render, got PGRST202, and fell through to its documented back-compat path - pulling the full inflow archive into the Server Component instead. Correct output, wrong cost. |
| **023** | the whole thing | 381 evidence rows + 1,575 storage objects survived a pipeline retired in April. |
| **026** | `city_id` on 11 of 12 tables | it got `groundwater_wris` in and stopped. `city-dashboard.tsx` had adapted, with a comment saying those tables "have no city_id column". |
| **029** | `corporations`, `source_corporation` | Kolkata's and Mumbai's corporation rows had nowhere to go. No code reads them. |
| **035** | all of it | this is the migration written *for* this situation - "live-safe", idempotent, supersedes 026. |
| **043** | Gurugram's `cities` row | Gurugram had been live since 15 Aug with no row at all. |
| **025 / 028** | Bangalore + Mumbai `water_source_name_aliases` | 26 rows. Nothing reads the table today. |

## What was applied

Surgically, one file at a time via `supabase db query --linked -f`, never
`db push`. Data-only inserts went through PostgREST with
`Prefer: resolution=ignore-duplicates`, parsing VALUES straight out of the
`.sql` rather than transcribing them, with a per-row assert on `city_id`.

Order: 043 and the aliases (data) -> 035 (which subsumes 026's column work) ->
029 -> 040/041's corporation rows -> 022 -> 018 -> 023.

**023 could not run as written.** Supabase has since added
`storage.protect_delete()`, which refuses `DELETE` against `storage.objects`
with `ERROR 42501`. The bucket was emptied and dropped through the Storage API
instead; the file now carries that recipe and guards the SQL so a fresh rebuild
does not abort. `water_body_satellite_summary` was preserved as 023 always
intended - 19,861 rows, three live consumers.

## What is true now

- **All 48 migrations are applied and recorded.** `supabase migration list`
  shows Local == Remote for 001-048.
- **`supabase db push` is no longer a hazard**, because nothing is pending. The
  standing "never push" rule came from the broken ledger, and that is fixed.
- Every table, view and function the migration set defines exists. The one
  apparent exception, `_m0_city_id_from_district`, is correct: 035 drops its own
  helper at line 389.
- `cities` holds 10 rows, all `enabled = true`.

## What was deliberately NOT changed

- **026 is recorded as applied without having been run.** Its own successor says
  why: it "attempted to ALTER a view" and fails. 035 repeats its work
  idempotently and did land. Marking it applied is the honest operational
  statement - the effect is in place - and it stops a future push from firing a
  migration known to break.
- The four Kaveri-delta tables from 018 are created and empty. The project is
  dropped; they are harmless and their absence was the only thing making 018
  look half-applied.

## A related divergence, investigated and deliberately left alone

`public/data/basins/arkavathi/mpr-reviewed.json` exists in the corpus and has
never existed in this repo, while `basin-atlas.tsx:699` fetches it at runtime.
It looked like a gap. It is not one worth closing:

- **Production is unaffected** - the site builds from the corpus, which has it.
- **Local dev degrades by design.** `fetchJson` returns null on a 404 and the
  caller does `setReviewedMpr(null)`, exactly as it already does for the sibling
  `accountability.json`. The section simply does not render.
- **Committing it trips the L2 gate, correctly.** The file carries no NVDM
  envelope, like every other artifact in that basin directory. Its siblings are
  grandfathered because they predate the gate; a file arriving now counts as
  new and must be L2. Adding an envelope to this copy alone would make it differ
  from the corpus copy - reintroducing the very drift this was meant to close -
  and the "Publish Arkavathi MPR update" process that writes it would overwrite
  the envelope on its next run anyway.

So the honest state is: the corpus is the authority for this artifact, the repo
does not carry it, and nothing is broken. Closing it properly means giving the
basin publisher an NVDM envelope at source, which is a change to that pipeline
rather than a file copy.
