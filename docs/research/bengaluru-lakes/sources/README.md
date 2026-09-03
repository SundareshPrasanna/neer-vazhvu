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
| KSPCB monthly Bengaluru lake sheet (June 2026 and later) | Regulator's designated-best-use class per lake | kspcb.karnataka.gov.in/environmental-monitoring/water; OpenCity mirror (public domain) | to fetch | Public | Pending |

Not used: the OpenCity ATREE-CSEI lake boundary layer (CC BY, provenance undocumented) and any JRC Global Surface Water history (Landsat-derived; the snapshot is Sentinel-2 only).
