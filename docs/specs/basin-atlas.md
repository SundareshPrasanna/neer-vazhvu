# Basin Atlas - Full Spec (V0)

Status: design draft, pre-implementation. June 2026.
Owner: Sundaresh. Related: `docs/paani_data/` (Arkavathi reference package, Paani Earth),
`docs/specs/citizen-sightings.md`, cascade catchment-atlas (`src/components/cascade/`).

## 0. One-paragraph summary

A basin-resolution map surface ("basin atlas") that renders an entire river basin - boundary,
sub-catchments, named rivers, waterbodies, monitoring points, pollution evidence, treatment
infrastructure, and pressure layers - from **pure data, zero per-basin code**. Every basin is a
manifest plus a set of files conforming to fixed layer contracts; onboarding river N+1 is a
data task a partner can largely do themselves. First basin: **Arkavathi** (with tributaries
Vrishabhavathi, Kumudavathi, Suvarnamukhi), source data from Paani Earth Foundation.

Governing rule for every decision below: **standardized primitives, local narratives.** The
platform defines the shapes once; partners supply conforming data and the story copy. The
founder reviews contributions, he does not hand-build them. A second rule inherited from the
exploration phase: depth is **disclosed progressively** (zoom + selection + opt-in), never
dumped on the first view.

## 1. Navigation model (locked in design discussion, June 2026)

Two orthogonal controls plus progressive disclosure. The **elevator** (vertical, left rail) is
*which layer of the story*; **river-selection** (the map itself) is *which part of the basin*.
They compose cleanly and neither overloads the other.

### 1.1 The elevator (left-rail level navigator)

A vertical stack of **ordered floors** on the left, one per layer group, presented as a
cross-section of the basin's story (top = surface, descending = deeper causes and
accountability). Inherits the Context -> Pressure -> Action narrative principle:

| floor | group | what's on it |
| --- | --- | --- |
| 1 (top, surface) | `hydrology` | boundary, rivers, sub-catchments, waterbodies, drainage |
| 2 | `monitoring` | monitoring points, agency readings, citizen + research evidence |
| 3 | `pressures` | industrial areas, quarries, waste facilities |
| 4 (bottom) | `governance` | STPs/treatment, command areas, admin boundaries |

Behavior:
- You are always on **exactly one** focused floor; its box is highlighted and the full shaft
  stays visible, so "where am I / what's above / what's below" is answered at a glance.
- Clicking a floor **focuses, it does not erase**: that floor's layers come forward, the map
  eases to the floor's natural zoom, other floors recede (dimmed, still rendered for context).
- The focused floor is the only place its **per-layer toggles** appear (fine control lives
  inside the coarse floor - this is where the old "expert toggles" go). Each floor shows its
  inventory counts inline ("Pressures: 56 industrial areas, 101 quarries, 45 waste
  facilities"), so the rail doubles as the data inventory even before anything is toggled.
- Floor order and membership come from each layer's `group` in the manifest (section 4); the
  rail is generated, not hand-built per basin.
- The focused floor is reflected in the URL (`?level=pressures`) alongside any river selection,
  for shareable deep links.

### 1.2 River-selection (orthogonal axis)

Clicking a river (or its sub-hydroshed polygon - the whole polygon is the click target, since
thin polylines are poor tap targets) **scopes** the view to that sub-basin: every floor now
shows only that river's features, and the heavy layers (drainage, waterbodies) load **only
now, only for this sub-basin** via per-sub-hydroshed slices (cascade-atlas on-demand pattern).
Selection lives in the URL (`?river=vrishabhavathi`). Rivers must look clickable regardless of
focused floor (hover highlight, cursor, generous hit buffer).

### 1.3 Progressive disclosure (the defaults)

- **Landing**: floor 1 (Hydrology) focused, no river selected. Visible: basin boundary, named
  rivers, district boundaries, major attributed reservoirs/tanks, subtle sub-hydroshed fills.
  Initial payload budget under ~2 MB. One-time coach mark "Click a river to explore its
  pollution story" + "don't show again" (localStorage).
- **Zoom gating**: heavy/detail layers (drainage, unattributed waterbodies, gram panchayats)
  appear only z13+; when too far out they show greyed in the floor with a "zoom in to see ..."
  hint. **Zoom, floor focus, and toggles all gate _fetching_, not just rendering** - nothing
  heavy downloads until something makes it visible.
- **Admin ladder** (within the Governance floor): districts always on; taluks ~z11; gram
  panchayats z13+; one toggle turns the admin family off.

A "Data on this map" section below the map lists every layer with count, source, provenance,
and named gaps (honest-data-gaps pattern; doubles as partner credit).

### 1.4 Mobile

The left rail collapses to a compact horizontal floor-stepper (or folds into the existing
`bottom-sheet`); the focused-floor indicator and its toggles render inside the sheet. Same
state, smaller affordance - no separate mobile information architecture.

## 2. Principles applied (DRY / SRP / YAGNI)

- **DRY** - one manifest type, one layer-contract module consumed by the ingestion validator,
  the map renderer, the elevator rail, and the "Data on this map" section. The elevator's
  floors and per-floor toggles are generated from each layer's `group`; no per-basin rail
  code. Reuse: Leaflet stack, the existing legend-toggle component (`rivers-legend.tsx`)
  becomes the per-floor toggle list, cascade on-demand API pattern, city-config capability
  flags, existing simplification tooling (`@turf/simplify`).
- **SRP** - ingestion (scripts) / serving (static files + one thin API route for slices) /
  rendering (one component tree keyed off the manifest) are cleanly separated. The elevator
  owns *focus + navigation*; per-floor toggles own *visibility*; river-selection owns *scope* -
  three independent state slices, not one tangled controller. Narrative copy lives in the
  manifest, not in components.
- **YAGNI** - explicitly NOT in V0, each with a seam: vector tiles (slicing seam exists),
  partner self-serve upload portal (contract + validator exist; intake is reviewed file drop),
  time-series charts inside the panel (panel sections are data-driven), multi-language layer
  metadata beyond labels (labelKey seam), OCEMS/NGT live feeds (they land as additional
  layer families later).

## 3. Capability gating

One additive field on `BasePlaceConfig` (mirrors `hasCascadeOverlay`):

```ts
/** Basin atlas surfaces available for this city. Each id must have a manifest in
 *  src/lib/basins/ and data under public/data/basins/<id>/. Default: none. */
basinIds?: string[];
```

Bangalore first: `basinIds: ['arkavathi']`. Route: `/[cityId]/basins/[basinId]`
(decision: basin pages are city-scoped for nav/i18n consistency, even though basins exceed
city limits; the page states its true extent, per the Madurai scope-label precedent).

## 4. Basin manifest (one file per basin, the only per-basin "code")

`src/lib/basins/<basinId>.ts`, typed by `src/lib/basins/types.ts`:

```ts
export interface BasinManifest {
  basinId: string;                 // 'arkavathi'
  cityIds: string[];               // host cities for nav ('bangalore')
  displayName: string;             // 'Arkavathi Basin'
  displayNameLocal?: string;       // regional-script gloss, per city languages
  mapCenter: [number, number];
  mapZoom: number;
  areaKm2?: number;                // stated, with source
  rivers: BasinRiver[];            // named, selectable rivers
  layers: BasinLayerDecl[];        // which layer families exist + per-layer overrides
  credits: BasinCredit[];          // partner/source attribution, rendered verbatim
  narrative?: { introKey: string };// i18n keys for landing copy
}

export interface BasinRiver {
  riverId: string;                 // 'vrishabhavathi' (URL-stable)
  displayName: string;
  subHydroshedIds: string[];       // links river -> catchment polygons (click target + scope)
  color: string;
  narrativeKey?: string;           // panel intro copy
}

export interface BasinLayerDecl {
  layer: BasinLayerFamily;         // enum, section 5
  defaultOn: boolean;
  minZoom?: number;                // zoom gate (also gates fetching)
  group: 'hydrology' | 'monitoring' | 'pressures' | 'governance';
  countLabelKey?: string;          // legend inventory line
}
```

## 5. Layer contracts (the scaling surface)

All files are EPSG:4326, 2D, minified GeoJSON (or JSON for non-spatial tables), produced by
the ingestion pipeline (section 6), living at `public/data/basins/<basinId>/`.

**Required families** (a basin cannot ship without these three):

| family | file | geometry | required properties |
| --- | --- | --- | --- |
| `boundary` | `boundary.geojson` | Polygon | - |
| `sub-hydrosheds` | `sub-hydrosheds.geojson` | Polygons | `shedId`, `name` |
| `rivers` | `rivers.geojson` | Lines | `riverId`, `name`, `shedId` |

**Optional families** (any subset; sparse basins onboard day one and grow):

| family | geometry | required properties | optional properties |
| --- | --- | --- | --- |
| `monitoring-points` | Point | `name`, `agency`, `purpose` | `frequency`, `publicDomain` (Y/N), `dataUrl`, `findings`, `govCode`, `shedId` |
| `evidence-points` | Point | `contributor`, `findings`, `evidenceUrl` | `period`, `locationName`, `shedId` |
| `infrastructure` | Point | `name`, `kind` (stp/fstp/wtp/...), `status` | `capacityMld`, `process`, `agency`, `sourceNote`, `shedId` |
| `pressures` | Polygon/Point | `kind` (industrial-area/quarry/waste-facility/...) | `name`, `agency`, `detailsUrl`, `shedId` |
| `waterbodies` | Polygon | - | `name`, `custodian`, `tankId`, `district`, `shedId` |
| `drainage` | Lines | `shedId` | `name` |
| `admin` | Polygon | `level` (district/taluk/gp/town), `name` | `lgdCode`, `kgisCode` |
| `command-areas` | Polygon | `name` | `areaHa`, `type`, `status` |

Contract rules:
- **Geometry + `kind` is enough to render.** Names/details are enrichment, never blockers
  (the Arkavathi quarries layer - 101 polygons, zero attributes - must render as-is).
- `shedId` on any feature enables river-selected scoping; features without it appear only in
  expert mode, never lost.
- Every family carries file-level `provenance` metadata (source, contributor, date, method);
  rendered in "Data on this map". Unknown values stay empty, never guessed.
- Heavy families (`drainage`, `waterbodies` when large) are **additionally** emitted as
  per-shed slices `drainage/<shedId>.geojson` for on-demand loading; the combined file is
  only for expert-mode basin-wide toggles past its zoom gate.

## 6. Ingestion pipeline (one script, manifest-driven)

`scripts/ingest-basin.ts <basinId>` reads `docs/<source-dir>/ingest-manifest.json`:

```jsonc
{
  "basinId": "arkavathi",
  "sources": [
    { "file": "Arkavathi_Basin_Boundary.gpkg", "layer": "boundary" },
    { "file": "Arkavathi_SubHydrosheds_IndiaWRIS.gpkg", "layer": "sub-hydrosheds",
      "fields": { "shedId": "wsconc", "name": "Name" } },
    { "file": "Arkavathi_All_Common_STPs_Src_BWSSB_Other_Links.csv", "layer": "infrastructure",
      "kind": "stp", "latField": "Latitude", "lngField": "Longitude",
      "fields": { "name": "Name of STP", "capacityMld": "Operating Capacity", "status": "Status" },
      "provenance": "Paani Earth compilation from BWSSB dashboards + media, June 2026" }
    // ... one entry per source file
  ]
}
```

Pipeline steps (all deterministic, re-runnable): read via GDAL (`ogr2ogr`; QGIS-bundled
binary works: `/Applications/QGIS-*.app/Contents/MacOS/ogr2ogr` with
`PROJ_LIB=<app>/Contents/Resources/qgis/proj`) -> reproject to 4326 -> strip Z -> map fields
per manifest -> assign `shedId` by point-in-polygon against `sub-hydrosheds` where absent ->
simplify above per-family size budgets (boundary/sheds 0.0005 tolerance; drainage stronger) ->
emit minified files + per-shed slices + a generated `inventory.json` (counts, sizes,
provenance) consumed by the legend and "Data on this map".

**Validator** (`scripts/validate-basin.ts`, also run by the ingest script): checks contract
conformance - required families present, required properties non-empty, CRS, geometry types,
`shedId` referential integrity, size budgets - and prints a partner-readable report. This is
the bottleneck-removal tool: a partner can run it (or we run it on their drop and send the
report) before any integration work starts.

## 7. Partner contribution spec (external one-pager)

`docs/partnerships/basin-data-contribution.md` - derived from section 5, written for a
non-developer GIS user. Accepted inputs: GeoPackage, GeoJSON, Shapefile, KML, or CSV with
lat/lng columns; any common CRS. Each file maps to one layer family; column names are theirs
(the ingest manifest maps them, so partners never rename columns). Required per delivery:
source/provenance line per file and a contact for attribute questions. Explicitly stated:
partial deliveries welcome (contract minimums are just boundary + sheds + rivers).

## 8. Reference implementation: Arkavathi (validates every contract)

| Paani file | family | notes / known gaps (send back, do not block) |
| --- | --- | --- |
| Basin_Boundary.gpkg | boundary | area field 4,161 (units unconfirmed) |
| SubHydrosheds_IndiaWRIS.gpkg | sub-hydrosheds | 7 sheds; code typo `CO5CAM33` vs `C05...` - normalize |
| River_Hydrology gpkg, named layers | rivers | mainstems for all 4 named rivers |
| River_Hydrology gpkg, drainage | drainage | 7,356 segments, 9.9 MB raw -> slice per shed |
| River_Hydrology gpkg, waterbodies | waterbodies | 114 attributed ("MMM" - meaning unconfirmed with Madhuri) + 972 unattributed (6.7 MB raw) |
| River_Monitoring_Points (94) | monitoring-points | 7 agencies; `publicDomain` flag present |
| Citizen_Reported (8) | evidence-points | RTI/lab PDFs on paani.earth |
| Research_Institutions (18) | evidence-points | ATREE etc.; merge with above under `contributor` |
| STPs CSV (47) | infrastructure | kind=stp; capacities + status |
| FSTP CSV (3) | infrastructure | kind=fstp; no coords - **excluded until completed** |
| Hazardous-waste CSV (45) | pressures | kind=waste-facility |
| Industrial_Areas (56) | pressures | kind=industrial-area; 33 rows agency "KSSIDC?" - keep the question mark, ask Madhuri |
| Quarries (101) | pressures | kind=quarry; zero attributes - renders geometry-only |
| Districts/Taluks/GPs/Towns gpkgs | admin | ladder per section 1 |
| Command_Areas (3) | command-areas | custom Lambert CRS - reprojects fine |
| 17-category Karnataka CSV (228 records) | pressures (kind=industry-17cat) | **revision pending from Paani (2026-06-13)** - classification labels not canonical (22 distinct strings, incl. stray-newline/wording dupes, vs CPCB's 17; normalize at ingest), 1 row missing coords, some address/coord mismatches (e.g. United Spirits "Hospet" carries Bangalore coords). Statewide -> clip to boundary; only ~33 rows fall in basin. Hold this layer or re-ingest when corrected file lands. |

## 9. Rollout

P0: types + ingest script + validator + Arkavathi manifest; elevator rail (4 floors, focus +
per-floor toggles) + landing + river-selected scoping on `/bangalore/basins/arkavathi`;
"Data on this map".
P1: per-floor polish (zoom-gated heavy layers, dim-recede transitions, mobile floor-stepper),
contribution one-pager sent to Paani Earth; their corrections (quarry attrs, KSSIDC?, MMM,
FSTP) land as data-only re-ingests.
P2: second basin (likely Vaigai/Madurai via DHAN, or Vrishabhavathi-only subset views);
wishlist layers (NGT MPR series, OCEMS reporting-status) join as new layer families.

## 10. Open questions

- Landing default: is the basin page linked from `/bangalore/rivers` or also from the city
  dashboard? (Nav decision, not architecture.)
- Evidence-points vs citizen-sightings: Paani's curated evidence is static partner data; the
  sightings pipeline is live capture. They stay separate families; revisit if/when sightings
  ship for river stretches.
- Per-shed slicing threshold (propose: slice any family file > 1 MB).
