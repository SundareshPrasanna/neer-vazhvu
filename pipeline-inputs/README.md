# pipeline-inputs/

Analytical and pipeline input files that are committed to the repo but are
NOT shipped as public static assets. Nothing in this directory is served by
the app or reachable at a public URL; nothing in `src/` may read from here.
Files land here when they are load-bearing for a script, checker, or scheduled
pipeline but have no place in `public/` (de-publicization ruling, 2026-07-30).

The dataset catalogue (`scripts/build_dataset_catalogue.py`) walks
`public/data` and `public/geojson` only, so files here are deliberately
outside the catalogue. The Headwaters coverage sweep
(`scripts/lib/headwaters-coverage.ts`) likewise does not scan this directory;
lineage for files here is carried by `dependsOn` entries in
`scripts/source-registry/*.json` where an upstream is known.

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
