# Tank-Cascade Reconstruction: Methodology Note

**neer-vazhvu cascade reconstruction v1.1.0**
**Algorithm: `d8_steepest_descent_v1`**
**Status: pre-review, intended for hydrologist feedback**

## Abstract

This note describes the methodology behind the public tank-cascade reconstruction overlay at [neervazhvu.org](https://neervazhvu.org), currently live for Madurai and Chennai. The algorithm reconstructs hypothetical kanmoi-style tank-to-tank cascade structure from terrain inputs (HydroSHEDS conditioned DEM + D8 flow direction) and current OpenStreetMap water polygons, without assuming any historical channel knowledge. Outputs are static GeoJSON + PMTiles served from a Next.js front-end; the auto-derived graph and a curated documented-cascades layer feed a per-cascade health score that ranks cascades by fragility. The note describes inputs, the algorithm, the four tunable parameters (with sensitivity tables), validation against documented chains, a worked example, and limitations.

## 1. Motivation

Most of Tamil Nadu's traditional tank cascades have been broken by urban encroachment over the last 50-100 years, but the terrain still organizes water the way the historical cascades did. There is no public-domain digital map of these cascade structures: TN PWD's IAMWARM DPRs, DHAN Vayalagam project files, and academic studies (Vencatesan 2014, Chinnasamy & Srivastava 2021, Columbia GSAPP 2016) each cover slices, but none assemble a per-district graph from first principles. neer-vazhvu's reconstruction is intended to fill this gap as an *open hypothesis*: a terrain-derived cascade structure that anyone can audit, refine, or refute.

## 2. Inputs

All inputs are open data; the pipeline runs from a single CLI command with deterministic outputs.

| Input | Source | Resolution | Used for |
|---|---|---|---|
| Tank polygons | OpenStreetMap `water=*` features | Variable (per OSM contributor) | Node set |
| Elevation | `WWF/HydroSHEDS/03CONDEM` (conditioned DEM) | ~90 m at 3 arc-second | Per-centroid elevation sampling |
| Flow direction | `WWF/HydroSHEDS/03DIR` (ESRI D8 codes) | ~90 m | Per-centroid flow vector |
| River barriers | OpenStreetMap `waterway=*` polylines | Variable | Rejecting candidate edges that cross rivers |

Tank polygons filtered to exclude `water_type` in {river, stream, canal, drain, ditch, wastewater} (these are conduits, not tanks). Polygons below `min_tank_area_ha` (default 1.0) are also excluded.

For Madurai the pipeline ingests 506 eligible tank polygons; for Chennai, 720.

## 3. Algorithm

For each upstream tank in the eligible set, the algorithm produces at most one outgoing edge (the steepest downhill candidate) through five sequential gates:

1. **Distance gate**: candidate must be within `max_downstream_distance_km` (default 3.0).
2. **Elevation gate**: candidate must be at a lower elevation than the upstream tank.
3. **Flow-direction cone gate**: candidate must lie within `cone_halfangle_deg` (default 67.5 degrees) of the bearing implied by the upstream tank's D8 flow direction.
4. **River-crossing gate**: the straight-line edge from upstream centroid to candidate centroid must not cross any mapped river polyline.
5. **Steepest selection**: the surviving candidate with the highest `score_m_per_km = elevation_drop_m / distance_km` wins.

If no candidate survives all five gates, the upstream tank gets no tank-to-tank outflow. If it additionally has flow direction pointing toward a river within `max_river_outlet_distance_km` (default 2.0), it is marked `drains_to_river` and rendered with an amber arrow to the nearest in-cone river point.

Single-outflow per tank is the V1 default. An opt-in `allow_multi_outflow` flag (per-district) relaxes this and keeps any candidate whose score is within `multi_outflow_score_tolerance` (default 30%) of the best, modelling tanks with both feeder and surplus channels. Off by default for Madurai and Chennai.

Reservoirs can be marked `terminal_sink_osm_ids` per-district (curated list of large engineered dams whose outflow is via spillway, not natural cascade). Currently empty for both cities pending validation against TN PWD inventories.

The cascade_position of each node is the longest path it sits on, computed via DP over the DAG. Nodes with no tank-to-tank inflow get cascade_position=1 and are labelled "headwater" in tooltips - they are NOT sources of water in any absolute sense; rainfall, runoff, springs, and engineered transfers are all unmodelled.

After the main loop, isolated nodes (degree_in=0, degree_out=0, drains_to_river=false) are re-evaluated and stamped with one of six isolation reasons explaining which gate eliminated all candidates. The six reasons appear in the on-map hover tooltip and are documented in section 6.

## 4. Parameters

Each tunable parameter was chosen with a stated rationale, validated against the sensitivity tables in section 5.

### `max_downstream_distance_km` = 3.0

How far an upstream tank looks for a downhill neighbour. 3 km is the historical median spacing between tanks in well-documented kanmoi networks (DHAN Vayalagam field data). Below 1.5 km the graph fragments sharply (Madurai: 228 edges, 172 isolated tanks); above 5 km the algorithm starts connecting tanks that have no historical relationship.

### `cone_halfangle_deg` = 67.5

How wide the directional cone around the upstream tank's D8 flow direction must be for a candidate to qualify. 67.5 degrees admits the principal D8 cell plus its two neighbours on each side (5 of 8 D8 cells). The default trades local D8 instability (90 m DEM produces noisy flow directions in flat terrain) against false-positive edges (a 90-degree cone admits half-plane candidates the water would never actually reach). A 22.5-degree cone (principal D8 only) loses 33% of Madurai's edges.

### `min_tank_area_ha` = 1.0

Minimum OSM water_type polygon size to enter the graph. 1 ha excludes most temple tanks, garden ponds, and roadside catchments while preserving the structural cascade. Raising the threshold thins the graph rapidly: at 5 ha Madurai keeps 72% of nodes; at 10 ha only 56%. The sweep cannot test values below the default because the elevation + flow-direction data points have not been sampled for sub-1ha polygons.

### `max_river_outlet_distance_km` = 2.0

Distance budget within which a tank with no tank-to-tank outflow can register a "drains to river" arrow. 2 km matches typical surplus-channel lengths in TN sub-basin engineering. Tightening to 1 km loses ~30% of river-outlet arrows; loosening to 3 km adds plausible-but-uncertain outlets that may be drainage rather than designed surplus.

## 5. Sensitivity

Each parameter swept against the live Madurai and Chennai data. Full JSON at `public/data/cascade/{city}-cascade-sensitivity.json`.

### Madurai: 506 nodes, 345 edges, 75 isolated, max depth 9 at defaults

`max_downstream_distance_km`:

| value | nodes | edges | isolated | max depth | outlets |
|---|---:|---:|---:|---:|---:|
| 1.5 | 506 | 228 | 172 | 10 | 39 |
| 2.0 | 506 | 289 | 117 | 10 | 38 |
| **3.0** | **506** | **345** | **75** | **9** | **34** |
| 4.0 | 506 | 376 | 62 | 13 | 32 |
| 5.0 | 506 | 399 | 50 | 13 | 29 |

`cone_halfangle_deg`:

| value | nodes | edges | isolated | max depth | outlets |
|---|---:|---:|---:|---:|---:|
| 22.5 | 506 | 230 | 188 | 6 | 16 |
| 45.0 | 506 | 295 | 117 | 10 | 33 |
| **67.5** | **506** | **345** | **75** | **9** | **34** |
| 90.0 | 506 | 369 | 52 | 9 | 38 |

`min_tank_area_ha`:

| value | nodes | edges | isolated | max depth | outlets |
|---|---:|---:|---:|---:|---:|
| **1.0** | **506** | **345** | **75** | **9** | **34** |
| 2.0 | 455 | 305 | 71 | 8 | 32 |
| 5.0 | 364 | 227 | 63 | 9 | 29 |
| 10.0 | 285 | 147 | 72 | 8 | 25 |

`max_river_outlet_distance_km`:

| value | nodes | edges | isolated | max depth | outlets |
|---|---:|---:|---:|---:|---:|
| 1.0 | 506 | 345 | 83 | 9 | 23 |
| **2.0** | **506** | **345** | **75** | **9** | **34** |
| 3.0 | 506 | 345 | 72 | 9 | 41 |

Chennai's full table is in the JSON. The key signal is that Chennai's flatter delta produces more isolated tanks at any distance threshold (delta geometry has more local lows) and that the cone half-angle matters more for Chennai (more in-range tanks with weak elevation gradients).

## 6. Isolation classification

A tank is "isolated" when it has no tank-to-tank inflow, no tank-to-tank outflow, and no river sink. The pipeline re-walks the candidate-evaluation gates for each such tank and stamps one of six reasons:

| Reason | Meaning |
|---|---|
| `elevation_sampling_failed` | HydroSHEDS DEM returned no value at centroid |
| `no_neighbors_in_range` | Zero candidate tanks within 3 km |
| `all_neighbors_uphill` | In-range tanks exist but all are higher |
| `all_neighbors_out_of_cone` | Lower tanks exist but all outside the ±67.5° cone |
| `all_neighbors_river_blocked` | Lower in-cone tanks exist but every edge crosses a river |
| `unknown_isolation` | Defensive fallback; should be empty |

For Madurai's 75 isolated nodes the distribution is: 34 `all_neighbors_out_of_cone`, 21 `all_neighbors_uphill`, 17 `no_neighbors_in_range`, 3 `all_neighbors_river_blocked`, 0 `unknown_isolation`. For Chennai's 130: 55 out_of_cone, 53 uphill, 14 no_neighbors, 0 river_blocked, 8 elevation_sampling_failed, 0 unknown. The zero `unknown_isolation` count for both cities indicates the six-category taxonomy explains every isolated tank.

## 7. Worked example: Vandiyur Lake (Madurai)

Vandiyur Lake (OSM way 1073092381) is the terminal anchor of the Vandiyur Tank Cascade System (VTCS) described in Chinnasamy & Srivastava 2021 (*Frontiers in Water*, DOI 10.3389/frwa.2021.639637). It is also the subject of the Madras HC Madurai bench PIL R. Manibharathi v UoI, WP(M) 31214/2023, on bund-road encroachment.

From the published `madurai-cascade-nodes.geojson`:

```
osm_id: 1073092381
name: Vandiyur Lake
centroid: (9.93312, 78.15701)
area_ha: 227.94
elevation_m: 127.0 (HydroSHEDS conditioned DEM, ~90 m)
flow_direction_d8: 1 (East)
degree_in: 3
degree_out: 0
cascade_position: 4
drains_to_river: false
isolation_reason: null
```

**Step 1: candidate evaluation for outgoing edges.** The algorithm looks for tanks within 3 km of Vandiyur at lower elevation, in the East-facing cone of the D8 flow direction. The conditioned DEM around Vandiyur is relatively flat (elev 125-130 m for several km east); no tank-polygon centroid within 3 km clears all five gates. Vandiyur therefore gets `degree_out=0`.

**Step 2: river-outlet evaluation.** With no tank-to-tank outflow, the algorithm checks whether Vandiyur's flow direction (D8=1, East) points to a mapped river within 2 km. The Vaigai river polyline in OSM passes about 2.5-3 km north of Vandiyur, outside the eastward cone. No river outlet is registered. `drains_to_river: false`.

**Step 3: inflow evaluation.** Three upstream tanks pick Vandiyur as their best downhill candidate:

| Upstream OSM | distance (km) | drop (m) | score (m/km) | confidence |
|---|---:|---:|---:|---|
| 807794474 | 1.978 | 8.0 | 4.04 | medium |
| 1072661613 | 2.144 | 6.0 | 2.80 | medium |
| 1072661614 | 1.843 | 7.0 | 3.80 | medium |

All three predicted edges score in the MEDIUM confidence band (1-5 m/km). None reaches HIGH (≥ 5 m/km), reflecting the modest local gradient.

**Step 4: cascade position.** Vandiyur's `cascade_position` is computed via the longest-path DP traversal. The deepest upstream chain feeding it ends at position 3 (three upstream tanks chained together), so Vandiyur sits at position 4.

**Step 5: isolation classification.** Vandiyur is not isolated because it has `degree_in=3`. `isolation_reason: null`.

**Comparison to the documented chain.** Chinnasamy & Srivastava 2021 names eight VTCS tanks in order: T1 Kulamangalam, T2 Veerapandi, T3 Thiruppalai, T4 Siruvour, T5-T7 Kosakulam/Parsurampatti/Kodikulam super-node, T8 Vandiyur. Of these eight only T8 Vandiyur and T3 Thiruppalai resolve in the current OSM extract (Thiruppalai under multiple polygons; we picked the 24.76 ha match). Six of seven documented tanks are missing from OSM, so the algorithm cannot reproduce a chain through them - it instead finds three other in-OSM upstream tanks (807794474, 1072661613, 1072661614, all unnamed) that the terrain points toward Vandiyur. This is the algorithm correctly working with the data it has rather than fabricating documented connections.

Recall against the documented chain: 0 of 7 edges reproduced. Precision over reproduced edges: cannot compute (algorithm produced different edges to different upstream tanks, not a like-for-like comparison).

This worked example illustrates both the algorithm's correctness (the gates produce defensible results given the input) and the platform's principal limitation (rural Tamil Nadu OSM coverage is sparse, so documented historical chains are mostly invisible to the current OSM-based pipeline).

## 8. Limitations

Quantified where possible.

- **DEM resolution** ~90 m. Adequate for district-scale structure; misses sub-cell channels.
- **Single outflow per tank (default)**. Real tanks often have feeder + surplus channels. `allow_multi_outflow` opt-in available; off for Madurai and Chennai by default. We have not validated the multi-outflow output yet.
- **River-coverage gaps**. The river-crossing barrier is only as complete as OSM polylines. The Vaigai polyline east of Madurai has documented gaps.
- **OSM `water_type=reservoir` ambiguity**. In Madurai ~87% of nodes carry that tag, including traditional kanmoi tanks that historically had downstream cascades. Auto-classifying reservoirs as terminal sinks would destroy the graph. We instead expose a curated per-district `terminal_sink_osm_ids` list (currently empty pending TN PWD validation).
- **No non-tank-to-tank inflow modelled**. Reservoirs receive water from direct rainfall, catchment runoff, dammed rivers, and engineered transfers. The cascade graph is silent on all four.
- **Edges labelled `predicted` only**. A future iteration will cross-check against OSM `waterway=*` tags and Sentinel-1/2 monsoon imagery, then label each edge as `intact / partial / broken / encroached`.
- **Sparse rural OSM in Tamil Nadu**. Documented Madurai cascades resolve to current OSM at ~18% (4 of 22 tanks across the four documented chains); Chennai resolves at ~65% (11 of 17). The platform under-represents rural Madurai's documented cascade depth as a result.

## 9. Validation against documented chains

Four documented cascades per city were hand-encoded with citations + OSM IDs where resolvable (file: `public/data/cascade/{city}-cascades-documented.json`). Each cascade is scored on tank presence in OSM, edge reproduction by the algorithm, average edge confidence on reproduced edges, and lost-tank intersections, producing a 0-100 health score and a priority class (CRITICAL / HIGH / MEDIUM / LOW).

Current results (file: `public/data/cascade/{city}-cascades-health.json`):

| Cascade | OSM coverage | Edges reproduced | Health | Priority |
|---|---|---:|---:|---|
| **Chennai Sembakkam-Pallikaranai cluster** | 5 of 7 (71%) | 3 of 6 (50%) | 61.9 | MEDIUM |
| Chennai Ambattur-Korattur-Retteri | 3 of 3 (100%) | 0 of 2 (0%) | 40.0 | HIGH |
| Chennai Korttalaiyar 4-reservoir (engineered) | 2 of 4 (50%) | 0 of 3 (0%) | 20.0 | CRITICAL |
| Chennai Veeranam (engineered control) | 0 of 3 (0%) | 0 of 2 (0%) | 0.0 | CRITICAL |
| Madurai Mullaperiyar-Vaigai (engineered control) | 1 of 4 (25%) | 0 of 3 (0%) | 10.0 | CRITICAL |
| Madurai Madakulam Pandya | 1 of 5 (20%) | 0 of 4 (0%) | 0.0 | CRITICAL |
| Madurai VTCS | 2 of 8 (25%) | 0 of 7 (0%) | 0.0 | CRITICAL |
| Madurai Kondagai-Piramanur-Palayanur | 0 of 5 (0%) | 0 of 4 (0%) | 0.0 | CRITICAL |

The Sembakkam-Pallikaranai cluster (Chennai) is the cleanest validation case: 5 of 7 named tanks present in OSM, half of the documented edges reproduced by the algorithm. The engineered controls (Veeranam, Mullaperiyar) correctly score very low because they are cross-district transfers the terrain-derived algorithm cannot reach. The Madurai cascades all score CRITICAL because of the OSM-coverage limitation discussed in section 8 rather than algorithm failure.

In addition to documented cascades, the pipeline auto-derives every weakly-connected component of size ≥ 3 in the algorithm output and scores each on algorithmic signals (avg edge confidence, non-isolated ratio, size, lost-tank name overlap). Madurai surfaces 35 auto cascades, Chennai 78. Where an auto cascade overlaps a documented chain by OSM ID, the auto cascade inherits the documented narrative (court anchors, NGO partnerships, etc.) for display.

## 10. Reproducibility

The full pipeline runs from a single CLI:

```
cd neer-vazhvu-api
python scripts/run_cascade.py --district madurai run-all
python scripts/run_cascade.py --district chennai run-all
```

`run-all` invokes seven stages: `build-topology`, `cross-check-channels`, `detect-encroachment`, `score`, `curate`, `publish`, `tile`. The last four are currently no-ops; topology + publish do the real work. Three additional stages exist that don't run in `run-all`:

- `stats` - regenerate the per-city stats manifest from existing GeoJSONs
- `health` - score documented + auto-derived cascades
- `sensitivity` - sweep each tunable parameter and write the sensitivity JSON

All inputs are public; all outputs are deterministic given identical inputs. Every published artefact carries a `_meta` block with `generated_at`, `pipeline_version`, `algorithm`, and a SHA256 of the input GeoJSONs (`inputs_hash`) so a reviewer can confirm the entire output set was generated from the same source extracts.

Source code: [github.com/SundareshPrasanna/neer-vazhvu](https://github.com/SundareshPrasanna/neer-vazhvu) (cascade modules at `neer-vazhvu-api/app/cascade/`). 132 unit + integration tests passing.

## 11. Future work

- **Edge classification** (intact/partial/broken/encroached). Cross-check predicted edges against OSM `waterway=*` polylines + Sentinel-1/2 monsoon imagery. Deferred behind DHAN / Arghyam partnership work.
- **Lost-tank ghost nodes** from Survey of India topo sheets and the Madurai District Water Resources Atlas. Would add documented tank locations that current OSM lacks, lifting Madurai's documented-chain OSM coverage from 18% toward 60-70%.
- **PySheds comparison**. Run the same Madurai inputs through PySheds standard flow-accumulation + watershed delineation; document where the two approaches diverge and why.
- **Topographic visualisation**. Color-by-elevation nodes + drop-weighted edges on the map (cheap), elevation-profile sidebar per cascade chain (cheap), 3D terrain mode (Mapbox migration; expensive).
- **Bangalore onboarding**. Same architecture; just needs an `allow_multi_outflow=true` setting because the Deccan Plateau geometry has documented multi-branch cascades.

## References

- Chinnasamy P. & Srivastava A. (2021). Revival of Traditional Cascade Tanks for Achieving Climate Resilience in Drylands of South India. *Frontiers in Water* 3:639637. [doi:10.3389/frwa.2021.639637](https://www.frontiersin.org/articles/10.3389/frwa.2021.639637/full)
- Vencatesan J. (2014). Dying Tanks in Urban Areas: What can be done with them? [academia.edu/10833095](https://www.academia.edu/10833095/Dying_Tanks_in_Urban_Areas_What_can_be_done_with_them)
- Columbia GSAPP & Thiagarajar College of Engineering (2016). *Water Urbanism: Madurai, India*. [arch.columbia.edu/books/reader/192](https://www.arch.columbia.edu/books/reader/192-water-urbanism-madurai-india)
- Lehner B. & Grill G. (2013). Global river hydrography and network routing: baseline data and new approaches to study the world's large river systems. *Hydrological Processes* 27(15). [HydroSHEDS](https://www.hydrosheds.org)
- TN PWD/WRD (2012-13). Restoration and Regradation of Girudhumal river. IAMWARM Package 01. [iamwarm.gov.in](https://iamwarm.gov.in/IAMWARM/OLD/dpr-pdf/Leftout/60Packages/Girudhumal.pdf)
- CMWSSB. Chennai Metropolitan Water Supply and Sewerage Board Historical Background. [cmwssb.tn.gov.in](https://cmwssb.tn.gov.in/historical-background)
- Care Earth Trust et al. (2014). *Comprehensive Management Plan for Pallikaranai Marsh 2014-2019*. Ramsar Site #2481. [rsis.ramsar.org](https://rsis.ramsar.org/ris/2481)
- Madras HC Madurai bench (Mar 7, 2024). R. Manibharathi v Union of India, WP(M) 31214 of 2023. [LawBeat](https://lawbeat.in/news-updates/madras-high-court-orders-dedicated-website-listing-all-water-bodies-tamil-nadu-encroachment)

## Appendix A: Pipeline output schema

Every published artefact carries `_meta`:

```json
{
  "_meta": {
    "district_id": "madurai",
    "generated_at": "2026-05-13T...Z",
    "pipeline_version": "v1.1.0",
    "algorithm": "d8_steepest_descent_v1",
    "inputs_hash": "<sha256 of input GeoJSONs>"
  }
}
```

Output files per district:

| File | Content |
|---|---|
| `{district}-cascade-nodes.geojson` | Tank polygon centroids with elevation, flow direction, cascade_position, degree_in/out, drains_to_river, isolation_reason |
| `{district}-cascade-edges.geojson` | LineStrings from upstream to downstream centroid with distance, drop, score, confidence, status |
| `{district}-cascade-river-outlets.geojson` | LineStrings to nearest in-cone river point for tanks marked drains_to_river |
| `{district}-cascade-stats.json` | Per-city summary (counts, max depth, top-convergence, narrative anchor, edge confidence distribution) |
| `{district}-cascade-systems.json` | Layer B curation manifest (empty until partnership data lands) |
| `{district}-cascades-documented.json` | Hand-curated documented cascade chains with citations + OSM IDs |
| `{district}-cascades-health.json` | Scored documented + auto-derived cascades with priority class |
| `{district}-cascade-sensitivity.json` | Per-parameter sensitivity sweep |
