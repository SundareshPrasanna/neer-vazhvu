# pipeline-inputs inventory

One entry per file, no exceptions (governance ruling 2026-07-30: moving a file
out of `public/` must not move it out of governance). Update this file in the
same commit as any change to the directory.

| Field | chennai-reservoir-catchments.geojson | delhi-microwatersheds.geojson | mumbai-river-catchments-fabdem.geojson |
|---|---|---|---|
| Purpose | Catchment polygons for the daily GEE reservoir rainfall-context pipeline (CHIRPS aggregation per reservoir catchment) | Independent watershed-atlas control layer for catchment cross-checking (intended consumer script not present on main) | Catchments of Greater Mumbai's four city rivers (Mithi 75 sq km, Dahisar 41, Poisar 23, Oshiwara 32): the city half of the mumbai-rivers basin's sub-hydrosheds family |
| Consumer / owner | `neer-vazhvu-api/app/gee/reservoir_context.py` via `PIPELINE_INPUTS_DIR` (`app/gee/config.py`); daily workflow | **None on main** (2026-07-30 exhaustive grep). Kept per ruling as an analytical control; owner: Sundaresh | `scripts/build_mumbai_rivers_basin.py` (reads it into `public/data/basins/mumbai-rivers/sub-hydrosheds.geojson` and `gaps.geojson`); owner: Sundaresh |
| SHA-256 (first 16) | `d5acfaf02160c40d` | `603df211255386ef` | `54376580c2d68fe1` |
| Provenance | Self-derived candidate polygons on WWF HydroSHEDS/HydroBASINS level-12 + a local MERIT Hydro upstream trace (per the file's own metadata; corrected 2026-07-30 round-2 review - an earlier row wrongly said FABDEM); self-declares `ready_for_verification` - NOT yet verified | **UNCONFIRMED** - NRSC/SLUSI-style watershed atlas is an inference; publisher unknown; 2,324 features, metadata null | Self-derived on FABDEM v1-2 30 m with WhiteboxTools (least-cost breach, D8 pointer, D8 accumulation) by `scripts/derive_mumbai_subbasins_fabdem.py`, 2026-09-06; pour points 800 m up each OSM river course, snapped to the highest accumulation within 250 m; the tidal reach below the pour point is not part of the shed. NVDM-enveloped (fabdem-dem + osm-overpass inputs). Same DEM and routing as the regional lake-catchment atlas |
| Licence status | HydroBASINS licence (attribution; free for most uses) + MERIT Hydro is DUAL-LICENSED (CC BY-NC 4.0 or ODbL 1.0) - which licence the trace was taken under is unrecorded, so non-commercial encumbrance presumed until the MERIT lineage is verified (registry entry `merit-hydro`) | **UNKNOWN** - no licence can be asserted; do not republish, do not assume republishable | FABDEM CC BY-NC-SA 4.0 (non-commercial, share-alike; Copernicus GLO-30 attribution passes down) - the same encumbrance the cascade catchment family already carries; OSM ODbL for the pour-point placement only |
| Public exposure | Downloadable via the public repo (and its full git history) | Downloadable via the public repo (and its full git history) - the licence-risk case | Downloadable via the public repo, as the cascade catchments already are |
| Retention decision | **PENDING (Sundaresh)**: verify-and-keep vs retire; dashboard card carries a provisional label meanwhile | **PENDING (Sundaresh)**: keep-in-public-repo vs private storage vs history purge; confirm publisher first | Keep: a reviewed input the basin build reproduces from; re-derive by deleting `.cache/mumbai-rivers/` and re-running the script |

Log:
- 2026-07-30: directory created (#210); inventory added after governance
  review found the orphan hidden rather than governed, and the README
  overclaiming "not reachable at a public URL".
- 2026-09-06: mumbai-river-catchments-fabdem.geojson added with the mumbai-rivers
  basin atlas (FABDEM river catchments for the four Greater Mumbai rivers).
