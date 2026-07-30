# Chennai raw data

## chennai-wards-2011-mislabeled.geojson (incident archive, 2026-07-30)

This file is the geometry that lived at `public/geojson/chennai-wards-2022.geojson`
until 2026-07-30. External review found it matches OpenCity's **2011** Chennai ward
KML to coordinate-rounding tolerance: it is the pre-delimitation 2011 ward geometry
that had been mislabeled as the post-delimitation 2022 boundaries. Because ward
numbers were re-drawn in the delimitation, the wrong physical area was being
associated with post-2022 ward numbers in ward profiles, locality joins, risk
outputs and map lookups.

It is preserved here (repo-internal, NOT under `public/`) as the archival record of
what was served. Do not use it as 2022 geometry. Comparison against the genuine
2022 boundaries: 152 of 200 wards differ materially (centroid shift > 100 m, area
change > 10 %, or IoU < 0.90); 69 wards overlap their true 2022 extent by less
than half (IoU < 0.5). Full per-ward diff table in
`docs/specs/chennai-wards-incident.md` (local, gitignored) and in the incident
commit message.

## Replacement source (genuine 2022 boundaries)

`public/geojson/chennai-wards-2022.geojson` is now built from Greater Chennai
Corporation's official public ArcGIS service:

- Service: `https://gisgcc.chennaicorporation.gov.in/server/rest/services/GCCPublic/GCC_AdminBoundary/MapServer/4`
  (layer "Ward_Boundary", 200 features, source CRS EPSG:32644 / WGS 84 UTM 44N)
- Fetched: 2026-07-30, single query
  `.../4/query?where=1=1&outFields=*&returnGeometry=true&outSR=4326&f=geojson`
  with a browser-like User-Agent (plain fetch was accepted).
- Service metadata captured verbatim alongside:
  - `gcc-ward-boundary-layer4-metadata.json` (layer: fields, CRS, renderer)
  - `gcc-adminboundary-service-metadata.json` (service root)
- Normalization applied: coordinates rounded to 8 decimal places (~1 mm; rounding
  to 6 or 7 dp introduced ring self-intersections, 8 dp keeps all 200 features
  valid), features sorted by ward number, properties renamed to the keys
  downstream consumers read (`Ward_No`, `ward_number`, plus `Zone_No`/`Zone_Name`
  joined from `public/data/ward-names.json`; the service itself carries only
  `objectid`, `ward`, `st_area(shape)`, `st_perimeter(shape)`, preserved as
  `gcc_objectid`, `area_sqm`, `perimeter_m`).

### Licence / terms

The GCC ArcGIS service publishes **no licence text**: `copyrightText` is an empty
string on both the service root and the Ward_Boundary layer, and both
`description` fields are empty (see the captured metadata JSONs). No licence text
is published on the service; this is Government of Tamil Nadu / Greater Chennai
Corporation government data, used with attribution to Greater Chennai Corporation
(GIS-GCC).
