# Lake catchment pipeline

Builds the lake catchment atlas: the "Catchments" view on
`/<city>/water-bodies`. A district's tanks become a drains-to topology from
the DEM, then each lake gets a terrain-derived contributing catchment and its
rooftop-harvest potential. Methodology: `docs/methodology/catchment-atlas-v1.md`.

The package keeps its `cascade` name from the retired tank-cascade product;
only the topology it built survives, as the catchment stage's input.

## Adding a district

1. Add a `DistrictCascadeConfig` entry to `_REGISTRY` in
   [`districts.py`](districts.py). Required fields: `district_id`, `label`,
   `state`, `tank_polygons_path`.
2. Make sure the tank-polygons GeoJSON exists at the configured path
   (typically `public/geojson/<city>-water-bodies-current.geojson`).
3. Install the hydro extras (`pip install -e ".[hydro]"`) and run:
   ```bash
   python scripts/run_cascade.py --district <id> run-all
   ```
4. Set `hasCascadeOverlay: true` on the city config to show the view.

## Stages

| Stage | Module | What it produces |
|---|---|---|
| `build-topology` | `topology.py`, `publish.py` | Drains-to graph from DEM + tank polygons: nodes, edges, river outlets, stats |
| `delineate-catchments` | `catchments.py` | Per-lake catchment polygons, quality, streams, basins, downstream paths; lake names via `enrich_names.py` |
| `enrich-catchments` | `buildings.py` | Rooftop area, building count and harvest potential on the lakes GeoJSON |
| `stats` | `publish.py` | Refresh the stats manifest from existing topology GeoJSON |
| `run-all` | | `build-topology`, `delineate-catchments`, `enrich-catchments` |

## Outputs (`public/data/cascade/`)

```
<district>-cascade-nodes.geojson          # topology nodes; read by delineate-catchments
<district>-cascade-edges.geojson          # topology edges
<district>-cascade-river-outlets.geojson  # topology outlets
<district>-cascade-stats.json             # topology summary
<district>-cascade-lakes.geojson          # the atlas map layer
<district>-cascade-catchments.geojson     # per-lake catchments (served by /api/cascade)
<district>-catchment-{quality,streams,basin,downstream}.json
```
