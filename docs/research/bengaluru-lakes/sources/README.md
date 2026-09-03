# Sources for the Bengaluru lakes snapshot

The PDFs in this directory are kept local (ignored by git, per the repo rule for
research corpora); the extracted CSV and the spine outputs under `../data/` are
tracked so the report is reproducible from the repository.

Provenance for every input that is not already a versioned platform dataset. Licence
and access notes are recorded before the data is used, per the platform rule.

| File or feed | What | Origin | Date obtained | Licence / terms | Status |
|---|---|---|---|---|---|
| `ktcda-bbmp-lakes.pdf` (8 pp), `ktcda-bda-lakes.pdf`, `ktcda-forest-lakes.pdf`, `ktcda-bmrcl-lakes.pdf` | Custody lists of lakes in Bengaluru by agency: BBMP 201 rows (197 inside BBMP limits, 4 marked "Out of BBMP"), BDA 5, Forest Department 4, BMRCL 1 | Karnataka Tank Conservation and Development Authority, "List of Lakes in Bengaluru" (presumed page: ktcda.karnataka.gov.in/info-4/List+of+Lakes+in+Bengaluru/en, which returned HTTP 500 on 3 Sep 2026). PDFs supplied by Sundaresh on 3 Sep 2026 | 2026-09-03 | Government of Karnataka publication; reuse of factual lists with attribution. URL to confirm | Extracted to `../data/ktcda-custody-lists.csv` by `scripts/bengaluru-snapshot/extract_ktcda_lists.py` |
| `../data/lms-locations-raw.json`, `../data/lms-zones/zone-1..8.json` | BBMP Lake Management System lake points: id, name, latitude, longitude; zone membership | `https://lms.bbmpgov.in/locations/0` and `/locations/{1..8}` (the `/lake/locations/...` paths recorded in July 2026 now return 404) | 2026-09-03 | Public BBMP web application, no stated terms; used for point locations and names only. Known coordinate typos: validate before use | Raw copies kept; consumed by `build_spine.py` |
| `public/geojson/bangalore-water-bodies-current.geojson` | 1,897 OSM water polygons with area | Platform dataset (OpenStreetMap, ODbL) | already versioned | ODbL | Polygon spine |
| `public/geojson/bangalore-wards-2025.geojson`, `bangalore-corporations-2025.geojson` | Post-delimitation wards (369) and the five corporations | Platform dataset | already versioned | See platform sources | Reporting units |
| `public/data/cascade/bangalore-cascade-*.geojson` | Cascade topology, positions, upstream areas | Platform dataset (terrain-derived) | already versioned | Platform | Network joins |
| Sentinel-2 L2A (`COPERNICUS/S2_SR_HARMONIZED`), Cloud Score+ | All optical KPIs | Copernicus via Google Earth Engine, noncommercial tier, for this marketing snapshot only; port to Copernicus/AWS COGs at the first paid line (register decision D4) | per run | Copernicus free and open; GEE noncommercial terms | Compute |
| Dynamic World V1 | Built-up inside footprints | Google / WRI via GEE | per run | CC BY 4.0 | Compute |
| `kspcb-bengaluru-lakes-2026-06.pdf` (2 pp, 130 rows) | KSPCB "Water Quality Data of Bengaluru Lakes for the Month of June-2026": 130 monitoring locations with latitude, longitude, 34 parameters and the Use Based Class (A to E) | kspcb.karnataka.gov.in/environmental-monitoring/water, link "Water Quality Data of Bengaluru Lakes for the month of June - 2026" (Google Drive file id 1CAov9xkGAq4a9yklzJA8OXGBj7PQqFYf) | 2026-09-03 | Government of Karnataka publication; the regulator's own finding, reproduced with attribution, never recomputed | Extracted to `../data/kspcb-lakes-2026-06.csv` by `scripts/bengaluru-snapshot/extract_kspcb_sheet.py` |
| `kspcb-nwqmp-classification-2025-04-to-2026-02.pdf` (19 pp) | KSPCB "Classification of Water Quality under National Water Quality Monitoring Programme from April-2025 to February-2026": monthly class per station, rivers then lakes | Same KSPCB page (Google Drive file id 1FWwNPKfFQljoPG8peUuJrF1tCl_p_hKj) | 2026-09-03 | As above | Held for the months-in-class-E count; not yet extracted |
| Deccan Herald, "BBMP allocates Rs 50 crore to develop 24 lakes; Kalkere gets highest funding" (17 July 2025) | The 24 lakes in the BBMP 2025-26 budget with amounts and works where printed | deccanherald.com (article id 3634095) | 2026-09-03 | Press report; source class Low (press) under the methodology note's V rules | Transcribed to `../data/programme-state-2025-26.csv` |
| SANDRP, "Bengaluru Lakes 2025: Buffer Zone Amended, Pollution Rising" (10 February 2026) | NDMF Rs 65 cr seven lakes; BBMP lakes-department Rs 75 cr split; seven lakes nearing completion by Nov 2025 | sandrp.in | 2026-09-03 | Compilation citing press; source class Low | Transcribed to `../data/programme-state-2025-26.csv` |

Not used: the OpenCity ATREE-CSEI lake boundary layer (CC BY, provenance undocumented) and any JRC Global Surface Water history (Landsat-derived; the snapshot is Sentinel-2 only).
