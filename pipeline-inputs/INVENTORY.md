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

## ahmedabad/

Inputs of `neer-vazhvu-api/scripts/build_ahmedabad_river_quality.py` (`public/data/river-quality-ahmedabad.json`).

| File | Purpose | SHA-256 (first 16) | Provenance | Licence status |
|---|---|---|---|---|
| cpcb-nwmp-sabarmati-2018-2024.csv | CPCB's yearly min and max per station for the Sabarmati, Khari, Meshwo and Shedhi, 2018-2024 (92 station-years), every value as printed with the PDF page on each row | `867fdc43bb980ac5` | Transcribed 2026-10-14 from CPCB NWMP annual river PDFs (`cpcb.gov.in/wqm/<year>/WQuality_River-Data-<year>.pdf`, Table 7 / 7.1) with `pdftotext -layout`; ten rows with blank cells assigned by column position and flagged in `parse_note`; 2024 V.N. Bridge and Hansol rows re-checked against the PDF by hand | As `cpcb-nwmp` in `scripts/source-registry/surat.json` (Government of India publication, cited with attribution) |
| sabarmati-wq-stations.csv | Official coordinates of the 22 river, STP and canal monitoring stations, with a flag on the one that cannot be right (1408 Miroli) | `516fd8fd10633d72` | CPCB `WQMN_list.pdf` (October 2020) and NWDP's CWC water-quality station metadata, retrieved 2026-10-14 | As above |

## nagpur/

Inputs of `neer-vazhvu-api/scripts/build_nagpur_river_quality.py` (`public/data/river-quality-nagpur.json`, `public/geojson/nagpur-stps.geojson`) the frozen city outline used by `neer-vazhvu-api/scripts/build_nagpur_geography.py`, and the zone outlines that `neer-vazhvu-api/scripts/build_nagpur_wards.py` writes for the localities join.

| File | Purpose | SHA-256 (first 16) | Provenance | Licence status |
|---|---|---|---|---|
| nmc-city-boundary.geojson | NMC's city outline, the frame for every point-in-city test (groundwater stations, STPs, water bodies inside NMC); frozen so a refresh never depends on the NMC host. Not served: no page draws a city outline | `c4bcea8c16c19516` | NMC GIS `NMC/NMCAdminBoundaries/MapServer/3` ("Nagapur", LASTUPDATE 2023-08-13), outSR 4326, retrieved 2026-10-15 with curl by `neer-vazhvu-api/scripts/build_nagpur_geography.py --layer boundary --live`; 222.33 km2 on the sphere (221.72 km2 on the WGS84 ellipsoid) | As `nmc-gis-admin-boundaries` in `scripts/source-registry/nagpur.json` (NMC publication, cited with attribution; the service states no licence) |
| nmc-zones.geojson | NMC's ten zone outlines (properties zone_name, zone_no = NMC's own zone number 1-10), from which each Nagpur locality takes the zone at its own point (`scripts/fetch-osm-layers.ts --city nagpur --layer localities`, config key `zones` in `scripts/osm-layers/nagpur.json`). Not served: no page draws zone outlines | `ab556378053ea7d7` | NMC GIS `NMC/NMCAdminBoundaries/MapServer/2` (NAME only; ZONEID and the tax fields dropped), outSR 4326, retrieved 2026-10-15 with curl and written by `neer-vazhvu-api/scripts/build_nagpur_wards.py` on each run | As `nmc-gis-admin-boundaries` in `scripts/source-registry/nagpur.json` (NMC publication, cited with attribution; the service states no licence) |
| river-mpcb-monthly-2017-2024.csv | MPCB monthly pH, DO, BOD, FC, TC and bathing verdict for NWMP stations 2170, 2171, 1909, 1908, 1910, Jan 2017-Dec 2024 (480 rows), values as printed with PDF file and page | `ffb3d5d4e4906a00` | Parsed 2026-10-15 by column position from `pdftotext -layout` of MPCB's Kanhan river.pdf (sha d0be402c), Kolar river.pdf (450fa59c), Wainganga River.pdf (830ad972), all re-downloaded 15 Oct 2026 with identical bytes; partial rows assigned by column centre and flagged in parse_note; 1910 Feb 2021 values printed on the line below the year | As `mpcb-prs-monthly-nagpur-rivers` in `scripts/source-registry/nagpur.json` (Maharashtra government publication, cited with attribution) |
| river-cpcb-nwmp-annual-2018-2024.csv | CPCB yearly DO, BOD, FC, pH min/max for the same 5 stations (30 rows): the producer's cross-check, not shipped as readings | `f46beb569b591605` | CPCB `WQuality_River-Data-<year>.pdf` 2018, 2019, 2021-2024 (2020 has no Nagpur station), PDF page per row | As `cpcb-nwmp` in `scripts/source-registry/surat.json` (Government of India publication, cited with attribution) |
| river-wq-stations.csv | Station names and coordinates for 2170, 2171, 1909, 1908 from CPCB WQMN_list.pdf (file dated Oct 2020, PDF pp.71-73); 1910 withheld with the reason | `bc3115f632087c37` | WQMN_list.pdf sha a30cba91; positions checked against the MRSAC river lines (0.09-0.52 km) | As `cpcb-nwmp` |
| river-nmc-esr-2023-24-sites.csv | NMC ESR 2023-24 river sites Nag-1..10, Pilli-1..8, Pora-1..5: place as printed, DMS coordinates, pH, TDS, DO, COD, TC, FC with printed pages | `46688123976276ca` | ESR 2023-24 (sha 3db860ce) Tables 6.13-6.16, printed pp.161-166, machine-read from `pdftotext -layout`; all 23 positions fall within 0.05 km of the MRSAC river lines | As `nmc-esr-river-stp-tables` in `scripts/source-registry/nagpur.json` (Nagpur Municipal Corporation publication, cited with attribution) |
| river-stps-esr-2023-24.csv | 13 STPs from ESR Table 6.3 (printed p.137) joined to MPCB's January 2026 MPR rows Sr. 151-162 (PDF pp.9-10) | `949c3de2f9c915c4` | ESR as above; MPR_Merged_Jan_2026.pdf sha ffd50242 | As `nmc-esr-river-stp-tables` and `mpcb-ngt-monthly-progress-reports` |
| river-mpcb-wqi-2022-2024.csv | MPCB WQI (April, Oct/Dec, average) for SWMP 185-189 with their new NWMP codes 5979-5983 | `c1c8892e9b4ccfd1` | WQR 2022-23 Table No. 39 (printed p.185, PDF p.200) and WQR 2023-24 Table No. 38 (printed p.181, PDF p.191); codes from MPCB New NWMP Stations list rows 15-19 | As `mpcb-water-quality-reports` (mumbai.json) and `mpcb-nwmp-station-list` (nagpur.json) |
| river-cpcb-prs-classes.csv | CPCB polluted-stretch priority class, stretch as printed and max BOD for Kanhan, Kolar, Wainganga in the 2018, 2022 and 2025 editions | `5a3ac338995cbc85` | PRS 2018 (PDF pp.5, 10), 2022 (pp.30-31), 2025 (Table 3.17 p.28; Annexures II, III A/B) | As `cpcb-prs-report` in `scripts/source-registry/platform.json` (restrictive, permission required) |

Consumer: the two builders above; the outline is also available to the groundwater and rivers builders for point-in-city tests. Public exposure: downloadable via the public repo.

Log:
- 2026-10-15: directory created with the Nagpur onboarding (frozen NMC outline; seven river and STP transcriptions).
