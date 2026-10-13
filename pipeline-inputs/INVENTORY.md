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

## basins/erode-rivers/

Inputs of `scripts/build_erode_rivers_basin.py` (the Erode district map, `public/data/basins/erode-rivers/`).

| File | Purpose | SHA-256 (first 16) | Provenance | Licence status |
|---|---|---|---|---|
| tngis-district-boundary.json | The district frame every spatial test rests on, frozen so the weekly `--live` refresh never depends on TNGIS | `bdd9c986666ffbac` | TNGIS WFS `admin_master:administrative_boundary_district`, LGD 573, raw response, retrieved 2026-09-17 | As `tngis-open-geoserver` in `scripts/source-registry/basins.json` |
| tngis-sub-basins.json | TN WRD sub-basins over the district extent; clipped to the frame they are the map's catchments | `7476b2cd17d51d39` | TNGIS WFS `generic_viewer:sub_basin`, raw response, retrieved 2026-09-17 | As above |
| tnpcb-type-sectors.json | Reviewed lookup: TNPCB industry type code to the sector class on the map | `a1b115807a75a2f3` | Authored from the distinct type strings in the Erode slice of the TNGIS industry register; review status inside the file | Own work |
| thenpennai-interstate-samples.json | TNPCB's monthly laboratory samples of the Thenpennai at Chokkarasanapalli (interstate entry point): 53 dated samples, September 2017 to April 2021 and April 2025 to January 2026, every value as printed; feeds `monitoring-points.geojson` and `readings/tnpcb-chokkarasanapalli.json` | `e960f52fd556eae8` | Transcribed 2026-10-09 from the page images of the NGT (SZ) filings: joint committee progress report in O.A. 111 of 2020 (Annexure VII) and TNPCB's report of 10.07.2026 in O.A. 111 of 2020 and O.A. 14 of 2025 (Annexure III); ranges for 2022-24 from CPCB's reply in O.A. 14 of 2025; review status inside the file (proposed) | Public judicial records, cited with attribution |
| thenpennai-survey-points.json | The two one-day surveys: the NGT joint committee's 12 points of 9 and 10 September 2020 (Table 1 and the report's findings) and the CPCB, KSPCB and TNPCB six points of 28 October 2024 (Tables 1 and 2, with the printed coordinates); 2020 positions by place name | `b9c3a9972f9f9ce7` | Transcribed 2026-10-09 from the page images of the same filings; positions from the 2024 report's Table 2, OpenStreetMap places and TNGIS revenue villages as recorded per point; review status inside the file (proposed) | Public judicial records, cited with attribution; OSM ODbL; TNGIS with attribution |
| treatment-and-supply.json | Hosur Corporation's UGSS progress (two STPs under construction) and water-supply sheet of 17.06.2026, Krishnagiri Municipality's sewerage page, SIPCOT's TTRO plant, the register's STP and TSDF status notes; feeds `treatment-plants.geojson`, `water-supply.geojson` and the estates' TTRO fact | `87bc629490f8f3a9` | Read 2026-10-08 and 2026-10-09 from tnurbantree.tn.gov.in (Hosur, Krishnagiri) and sipcotweb.tn.gov.in; STP site names from Indian Infrastructure (trade press, secondary); review status inside the file (proposed) | Government sheets and pages, cited with attribution |
| cetp-schemes.json | Proposed and operating common effluent treatment plants, joined to register unit ids | `bb8465bfcaa34925` | Parsed by script from the Tamil Nadu Department of Textiles 'Nadanthai Vaazhi Cauvery' table (retrieved 2026-09-17) and TNPCB's 2020 CETP lists; the name join is the reviewed part | Government publications, cited with attribution |

Consumer: the builder above and `.github/workflows/district-basins-refresh.yml` (weekly, one job per district basin). Public exposure: downloadable via the public repo.

Log:
- 2026-07-30: directory created (#210); inventory added after governance
  review found the orphan hidden rather than governed, and the README
  overclaiming "not reachable at a public URL".
- 2026-09-06: mumbai-river-catchments-fabdem.geojson added with the mumbai-rivers
  basin atlas (FABDEM river catchments for the four Greater Mumbai rivers).
- 2026-09-17: basins/erode-rivers/ added with the Erode district map: two frozen TNGIS frames and two
  reviewed lookups (TNPCB type codes; treatment schemes).


## basins/krishnagiri-rivers/

Inputs of `scripts/build_krishnagiri_rivers_basin.py` (the Krishnagiri district map, `public/data/basins/krishnagiri-rivers/`), Krishnagiri's configuration of the shared engine `scripts/lib/tn_district_basin.py`.

| File | Purpose | SHA-256 (first 16) | Provenance | Licence status |
|---|---|---|---|---|
| tngis-district-boundary.json | The district frame every spatial test rests on, frozen so the weekly `--live` refresh never depends on TNGIS | `ac4653c7e7ee53f6` | TNGIS WFS `admin_master:administrative_boundary_district`, LGD 577, raw response, retrieved 2026-09-18 | TNGIS open GeoServer, published with attribution (see basins.json `tngis-open-geoserver`) |
| tngis-sub-basins.json | TN WRD sub-basins over the district extent (Pennaiyar, Cauvery and Palar basins); clipped to the frame they are the map's catchments | `d59964a27a15c0ed` | TNGIS WFS `generic_viewer:sub_basin`, raw response, retrieved 2026-09-18 | As above |
| tnpcb-type-sectors.json | Reviewed lookup: TNPCB industry type code to the sector class on the map (stone, engineering and metal treatment added to Erode's national codes; 1072 TSDF as a treatment kind, 2026-10-09) | `44dc3e67768a27fe` | Authored from the distinct type strings in the Krishnagiri slice of the TNGIS industry register (1,695 units); review status inside the file | Own work |

Consumer: the builder above and `.github/workflows/district-basins-refresh.yml` (weekly). Public exposure: downloadable via the public repo.

Log:
- 2026-09-18: directory created with the Hosur deep dive (Krishnagiri district map).
- 2026-10-09: the Thenpennai monitoring record (TNPCB's filed monthly samples, the 2020 and 2024 surveys) and the treatment and supply record added; the sector lookup gained the TSDF kind.
