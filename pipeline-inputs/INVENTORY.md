# pipeline-inputs inventory

One entry per file, no exceptions (governance ruling 2026-07-30: moving a file
out of `public/` must not move it out of governance). Update this file in the
same commit as any change to the directory.

| Field | chennai-reservoir-catchments.geojson | delhi-microwatersheds.geojson |
|---|---|---|
| Purpose | Catchment polygons for the daily GEE reservoir rainfall-context pipeline (CHIRPS aggregation per reservoir catchment) | Independent watershed-atlas control layer for catchment cross-checking (intended consumer script not present on main) |
| Consumer / owner | `neer-vazhvu-api/app/gee/reservoir_context.py` via `PIPELINE_INPUTS_DIR` (`app/gee/config.py`); daily workflow | **None on main** (2026-07-30 exhaustive grep). Kept per ruling as an analytical control; owner: Sundaresh |
| SHA-256 (first 16) | `d5acfaf02160c40d` | `603df211255386ef` |
| Provenance | Self-derived candidate polygons on WWF HydroSHEDS/HydroBASINS level-12 + a local MERIT Hydro upstream trace (per the file's own metadata; corrected 2026-07-30 round-2 review - an earlier row wrongly said FABDEM); self-declares `ready_for_verification` - NOT yet verified | **UNCONFIRMED** - NRSC/SLUSI-style watershed atlas is an inference; publisher unknown; 2,324 features, metadata null |
| Licence status | HydroBASINS licence (attribution; free for most uses) + MERIT Hydro is DUAL-LICENSED (CC BY-NC 4.0 or ODbL 1.0) - which licence the trace was taken under is unrecorded, so non-commercial encumbrance presumed until the MERIT lineage is verified (registry entry `merit-hydro`) | **UNKNOWN** - no licence can be asserted; do not republish, do not assume republishable |
| Public exposure | Downloadable via the public repo (and its full git history) | Downloadable via the public repo (and its full git history) - the licence-risk case |
| Retention decision | **PENDING (Sundaresh)**: verify-and-keep vs retire; dashboard card carries a provisional label meanwhile | **PENDING (Sundaresh)**: keep-in-public-repo vs private storage vs history purge; confirm publisher first |

Log:
- 2026-07-30: directory created (#210); inventory added after governance
  review found the orphan hidden rather than governed, and the README
  overclaiming "not reachable at a public URL".
