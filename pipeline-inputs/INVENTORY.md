# pipeline-inputs inventory

One entry per file, no exceptions (governance ruling 2026-07-30: moving a file
out of `public/` must not move it out of governance). Update this file in the
same commit as any change to the directory.

| Field | chennai-reservoir-catchments.geojson | delhi-microwatersheds.geojson |
|---|---|---|
| Purpose | Catchment polygons for the daily GEE reservoir rainfall-context pipeline (CHIRPS aggregation per reservoir catchment) | Independent watershed-atlas control layer for catchment cross-checking (intended consumer script not present on main) |
| Consumer / owner | `neer-vazhvu-api/app/gee/reservoir_context.py` via `PIPELINE_INPUTS_DIR` (`app/gee/config.py`); daily workflow | **None on main** (2026-07-30 exhaustive grep). Kept per ruling as an analytical control; owner: Sundaresh |
| SHA-256 (first 16) | `d5acfaf02160c40d` | `603df211255386ef` |
| Provenance | Self-derived (Neer Vazhvu catchment delineation); file self-declares `ready_for_verification` - NOT yet verified | **UNCONFIRMED** - NRSC/SLUSI-style watershed atlas is an inference; publisher unknown; 2,324 features, metadata null |
| Licence status | Self-derived, but built on FABDEM (CC BY-NC-SA) upstream - non-commercial encumbrance presumed until verified | **UNKNOWN** - no licence can be asserted; do not republish, do not assume republishable |
| Public exposure | Downloadable via the public repo (and its full git history) | Downloadable via the public repo (and its full git history) - the licence-risk case |
| Retention decision | **PENDING (Sundaresh)**: verify-and-keep vs retire; dashboard card carries a provisional label meanwhile | **PENDING (Sundaresh)**: keep-in-public-repo vs private storage vs history purge; confirm publisher first |

Log:
- 2026-07-30: directory created (#210); inventory added after governance
  review found the orphan hidden rather than governed, and the README
  overclaiming "not reachable at a public URL".
