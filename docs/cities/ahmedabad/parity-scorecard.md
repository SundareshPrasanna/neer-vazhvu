# Ahmedabad vs Chennai and Bengaluru: graded parity scorecard

> Measured 2026-10-14 from the shipped files with a script, at the close of the onboarding branch.
> Grades follow `docs/cities/kolkata/parity-scorecard.md`. Sources and traps: `data-sources.md`.

| Grade | Meaning |
|---|---|
| **XHigh** | Ahmedabad carries materially more than the benchmark |
| **High** | Comparable in kind and depth |
| **Medium** | Present and usable, thinner |
| **Low** | Minimal or absent; reason stated |
| **N/A** | Structurally inapplicable; a difference in the city, not the build |

**11 of 15 routes built** (live since 15 October 2026): dashboard, about, groundwater, water-bodies, rivers,
flood-risk, lake-restoration, my-ward, facts, origins, commitments.

## Measured

| Feature | Chennai | Bengaluru | Ahmedabad | Grade |
|---|---|---|---|---|
| Groundwater telemetry stations | 49 | 13 | **139** (24 in the city unit), monthly to 2026-10 | XHigh |
| River station-years (CPCB NWMP) | 51 | 25 | **70** (2018-2024) | XHigh |
| River monitoring stations | 13 | 9 | 11 | High |
| Live reservoir feed with archive | yes | yes | **daily since 2019-06-07**, 3 dams | High |
| Groundwater assessment units | 16 blocks | 6 | 8 talukas + 2 saline, on IN-GRES's own polygons | High |
| Groundwater assessment editions | 8 | 9 | 5 (the current units exist from 2021-22) | Medium |
| Ward geometry | 200 | 369 | 48 (the actual 2020 delimitation, AMC's own map) | High |
| Localities | 519 | 369 | 116 across 45 wards | Medium |
| Water-body polygons | 1,636 | 1,897 | 232 (OSM; AMC itself counts 176 lakes) | Medium |
| Facts | dynamic pipeline | 32 | 18, 4 tier-1, every figure read from an artifact | Medium |
| Commitments | 16 | 15 | 10, each status dated and cited | High |
| Lake restoration | priority scoring | register | 8 flagship lakes, 10 projects, 6 court orders | Medium |
| Satellite deep-zoom lakes | 7 | 14 | 2 (the others are too small for 30 m series) | Medium |
| Origins | yes | yes | 10 chapters, 11 licence-checked images | High |

## Notes on the grades

- **Groundwater is the deepest layer.** The district reads semi-critical (79.14%, 2025-26) while the
  Urban unit, which holds every AMC ward, is over-exploited (128.85%). Drilling below the district
  was necessary for the same reason as Pune: the aggregate states the opposite of the finding.
- **Rivers carry the signature finding**: peak BOD 1.2 to 5 mg/L at Hansol, 82 to 358 at V.N.
  Bridge, across seven editions.
- **Water bodies are thinner by geography, not by source.** Chennai is tank country; Ahmedabad's
  own count is 176 lakes. Both cities' layers are OSM.

## Low, with reasons

| Feature | Why |
|---|---|
| Per-plant STP and CETP compliance on the map | GPCB publishes CETP monthly results without coordinates and AMC STP outlet data only as 2023-24 averages |
| Sewage balance | AMC's generation figure is 80% of supply by method, with treated set equal to it |
| Flood hazard layers | No inundation map, no named hotspot list, no drain geometry is public |

## N/A or off by decision

| Route | Why |
|---|---|
| Allocations | No public entitlement order for AMC |
| Tanker | No register, ledger or survey; the research drop's tenders are vehicle purchases |
| Shoreline | Landlocked |
| Climate-risk | Not built (backlog, not a refusal) |
