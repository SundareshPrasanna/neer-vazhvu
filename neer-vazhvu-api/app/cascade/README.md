# Tank cascade reconstruction

Pipeline for reconstructing the historical chain-of-tanks (cascade)
hydrology of a district, identifying broken links, and surfacing
named-cascade health on the dashboard.

## Two-layer separation

- **Layer A (universal)** - DEM-derived topology, OSM/Sentinel channel
  evidence, Dynamic World built-up overlay. Same algorithm for every
  district; zero district-specific code.
- **Layer B (curated, optional)** - Named cascades, court cases, atlas
  references, NGO partnerships, historical engineering eras. Each
  district plugs in its own curation. The pipeline runs without it; the
  outputs are richer with it.

## Adding a new district

1. Add a `DistrictCascadeConfig` entry to `_REGISTRY` in
   [`districts.py`](districts.py). Required fields: `district_id`,
   `label`, `state`, `tank_polygons_path`.
2. Make sure the tank-polygons GeoJSON exists at the configured path
   (typically `public/geojson/<city>-water-bodies-current.geojson`).
3. Run the pipeline:
   ```bash
   python scripts/run_cascade.py --district <id> run-all
   ```
4. (Optional) Populate Layer B fields on the config when curation
   becomes available - named cascades, court refs, atlas refs, etc.

That's it. No code changes anywhere else.

## Pipeline stages

| Stage | Module | What it produces |
|---|---|---|
| `build-topology` | `topology.py` | Directed cascade graph from DEM + tank polygons |
| `cross-check-channels` | `channels.py` | Edges annotated with OSM and Sentinel evidence |
| `detect-encroachment` | `encroachment.py` | Edges annotated with built-up overlap |
| `score` | `scoring.py` | Edge status (intact/partial/broken/encroached) + per-cascade health |
| `curate` | `curation.py` | Layer B merge: named-cascade metadata onto graph |
| `publish` | `publish.py` | Write GeoJSON + small JSON manifest |
| `tile` | `publish.py` | Build PMTiles for the frontend map layer |

## Performance contract

The cascade map layer must not regress the `<city>/water-bodies` page.
Concretely:

- **Initial page weight added by cascade layer**: 0 KB (lazy-loaded).
- **Page weight when toggled on**: < 250 KB transferred (PMTiles +
  manifest).
- **JS bundle weight added**: < 20 KB gzipped (small toggle component
  only; the layer renderer is dynamic-imported).
- **No bulk GeoJSON** is ever loaded by the frontend map. GeoJSON is
  written to `public/data/cascade/` for downloads and research use, but
  the map renders from PMTiles.

The `tile` stage requires
[`tippecanoe`](https://github.com/felt/tippecanoe) on `PATH`
(`brew install tippecanoe` on macOS).

## Outputs

```
public/data/cascade/
  <district>-cascade-nodes.geojson    # tanks with degree, position-in-cascade
  <district>-cascade-edges.geojson    # links with status
  <district>-cascade-systems.json     # named cascades + curation (no geometry)

public/tiles/cascade/
  <district>-cascade-nodes.pmtiles    # frontend nodes layer
  <district>-cascade-edges.pmtiles    # frontend edges layer
```
