# pipeline-inputs/

Analytical and pipeline input files that are committed to the repo but are
NOT served by the app; nothing in `src/` may read from here. Files land here
when they are load-bearing for a script, checker, or scheduled pipeline but
have no place in `public/` (de-publicization ruling, 2026-07-30).

**Honest scope of "de-publicized" (corrected 2026-07-30 review):** this
repository is PUBLIC, so everything here remains downloadable through GitHub
- the move removes files from production static serving and app URLs, nothing
more. Treat every file here as published. Files whose publisher or licence is
unverified (see INVENTORY.md) must not be assumed republishable, and
licence-safe withdrawal would require private storage and potentially a
history purge - a pending decision, tracked in the inventory.

Governance for this directory lives in `INVENTORY.md` (purpose, consumer,
checksum, provenance, licence status, retention decision - one entry per
file, no exceptions). The dataset catalogue walks `public/` only; registry
`dependsOn` entries carry upstream lineage where an upstream is known.

## chennai-reservoir-catchments.geojson

Input for the daily GEE reservoir rainfall-context pipeline
(`neer-vazhvu-api/app/gee/reservoir_context.py`, path configured in
`neer-vazhvu-api/app/gee/cities.py`; run daily by
`.github/workflows/gee-phase1.yml`). Four curated candidate catchment
polygons for Poondi, Red Hills, Chembarambakkam and Cholavaram, derived from
WWF HydroSHEDS/HydroBASINS level-12 plus a local MERIT Hydro upstream trace
(Cholavaram). Written/updated by
`neer-vazhvu-api/app/gee/catchment_derivation.py`.

The file's own metadata says `status: ready_for_verification`: these are
reviewed candidates, not verified catchment boundaries. The dashboard surface
fed by this pipeline carries a matching provisional label. Upstream lineage is
registered under `hydrosheds-basins` in
`scripts/source-registry/platform.json`.

## delhi-microwatersheds.geojson

Independent watershed-atlas control layer for Delhi catchment work: 2,324
micro-watershed polygons with hierarchical delineation codes (`BASIN` /
`CATCHMENT` / `SUBCATCH` / `WATERSHED` / `SUBWATERSH` / `MWS`, e.g.
`2B6B2c1`). Kept as an analytical cross-check input, not a shipped layer;
no frontend code renders it.

Provenance: UNCONFIRMED. The property schema and code style match the
NRSC/SLUSI-style all-India micro-watershed atlas delineation (Bhuvan), but
that is an INFERENCE from the schema only. Publisher and licence have not
been verified; do not republish or ship this file until they are.
