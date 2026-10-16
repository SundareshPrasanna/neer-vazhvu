# Nagpur vs Chennai and Bengaluru: graded parity scorecard

> Measured 2026-10-15 from the shipped files on the onboarding branch, by a script that reads each
> city's artifacts and config (kept with the build record, not in the repo). Grades follow
> `docs/cities/kolkata/parity-scorecard.md`. Sources and traps: `data-sources.md`.

| Grade | Meaning |
|---|---|
| **XHigh** | Nagpur carries materially more than the benchmark |
| **High** | Comparable in kind and depth |
| **Medium** | Present and usable, thinner |
| **Low** | Minimal or absent; reason stated |
| **N/A** | Structurally inapplicable; a difference in the city, not the build |

Numeric rows use one rule against the two benchmarks: XHigh at 1.5 times the higher or more, High at
the lower or more, Medium at a quarter of the lower or more, Low below that. Ward geometry, ward
profiles and reservoir cards are graded on completeness against the city's own count (38 wards; the
two Pench dams the city draws on), since a city's ward count is not a measure of depth.

**12 routes have a renderer-ready artifact** (live): dashboard, about, allocations,
groundwater, water-bodies, rivers, flood-risk, lake-restoration, commitments, facts, origins and
my-ward.
5 XHigh · 13 High · 5 Medium · 4 Low · 4 N/A

## Measured

| Feature | Chennai | Bengaluru | Nagpur | Grade |
|---|---|---|---|---|
| Groundwater telemetry stations | 49 | 13 | 101 (3 inside the city, all CGWB) | XHigh |
| Groundwater assessment units | 16 | 6 | 14 talukas incl. the city's own unit, on IN-GRES polygons | High |
| Groundwater assessment editions | 8 | 9 | 6 (2019-20 to 2025-26; the city unit from 2023-24) | Medium |
| River monitoring stations | 13 | 9 | 28 (23 NMC sampling points + 5 MPCB stations) | XHigh |
| River readings | 51 | 25 | 503 (MPCB monthly, 2017-2024, + NMC 2023) | XHigh |
| Water-body polygons | 1,636 | 1,897 | 1,767 (MRSAC 1:10,000 survey 2017-18) | High |
| Named water bodies | 315 | 848 | 65 (MRSAC names + OSM by overlap) | Low |
| Localities | 519 | 369 | 56 (OSM maps few Nagpur neighbourhoods) | Low |
| Commitments | 16 | 15 | 22 each status dated and cited | High |
| Allocation arrangements | 5 | 2 | 5 | High |
| Allocation events | 4 | 4 | 13 (1965 to 2023) | XHigh |
| IMD gridded rainfall months | 672 | 672 | 672 (1970-2025, + provisional daily fill) | High |
| Origins chapters | 4 | 4 | 6 (10 licence-checked image plates) | XHigh |
| Ward geometry | 200 | 369 | 38 of 38 (all of the 2025 delimitation; 4 edges (7 wards) to confirm) | High |
| Ward profiles | 200 | 369 | 38 of 38 (5 sections not_available with reasons) | High |
| Facts | dynamic pipeline | 32 | 22, 5 featured on the dashboard strip, every figure read from an artifact | High |
| Lake restoration (flagships / projects / court orders / scored) | 0 / 9 / 0 / 1787 | 0 / 0 / 0 / 17 | 8 / 8 / 10 / 0 | Medium |
| Satellite deep-zoom bodies | 7 | 14 | 7 (5 city lakes and the 2 Pench dams, on MRSAC's outlines) | High |
| Live reservoir cards (daily feed) | 6 | 4 | 2, both dams the city draws on (whole-dam storage; the city's share is a reservation) + 2 no-feed cards | High |
| Supply overview (chain steps / treatment plants) | 7 / 5 | 9 / 6 | 6 / 5 | High |
| Flood layers (hazard features / narrative events / flood-line register entries) | 19646 / 0 / 0 | 398 / 0 / 0 | 0 / 7 / 13 | Medium |
| Elevation bands | 7 | 6 | 7 | High |
| Drain and sewer network features | 14,496 | 15,154 | 0 | Low |
| Sewage plant points | 0 | 39 | 13 (in data; no page renders them yet) | Medium |
| Lost water bodies | 15 | 9 | 0 | Low |
| Languages | en, ta | en, kn | en (mr upcoming) | Medium |
| Routes in config / renderer-ready | 14 | 13 | 12 / 12 (live) | High |

The Chennai and Bengaluru lake-restoration cells are what this checkout ships: neither city has a
`water-bodies-flagship-<city>.json` here, and Bengaluru has no `restoration-projects-bangalore.json`.
Chennai's priority scoring (1,787 water bodies scored) is the depth Nagpur does not match.

## Notes on the grades

- **Rivers are the deepest layer.** MPCB samples the Kanhan, the Kolar and the Wainganga every month,
  so five stations carry 480 readings from January 2017 to December 2024, with dry and stagnant
  months kept as such. Inside the city NMC's 2023 sampling adds 23 points on the Nag, the Pili and
  the Pora, where CPCB has no station.
- **Groundwater telemetry is broad but thin inside the city.** 101 wells across the district; the
  three inside NMC are CGWB piezometers whose readings stop in June 2026. Every taluka reads Safe in
  2025-2026; the city's own unit exists only from 2023-2024, hence the Medium on editions.
- **The allocation ledger is the strongest of the three cities on events** (13, from the 1965 letter
  to the 2023 barrage study), because the State's resolutions and the regulator's 2018 order are
  public. What it lacks is a recent draw: the latest per-source figure is for 2017-18.
- **Water bodies are official first.** The base is MRSAC's 2017-18 survey, not OpenStreetMap, which
  is why so few are named: MRSAC names 56, and OpenStreetMap names only 9 more by overlap.

## Low, with reasons

| Feature | Why |
|---|---|
| Named water bodies | MRSAC's survey names few bodies; OpenStreetMap names are joined only where the outlines overlap one to one. NMC's ESR names three more city lakes that could be added from its sampling table. |
| Localities | OpenStreetMap maps few Nagpur neighbourhoods. The final ward notification lists the localities in each ward by name; they could extend the search index with ward-centroid positions. |
| Drain and sewer networks | NMC publishes neither as a map or file that we have found. The City Development Plan of 2015 records about 917 km of storm drains (2008 survey). |
| Lost water bodies | No register of lost lakes; the only names come from press reports recited in a 2026 High Court order. |

## N/A or off by decision

| Route or feature | Why |
|---|---|
| Days-of-water hero | The city's storage is a reservation in a hydro-electric dam shared with Madhya Pradesh and an irrigation dam; the Kanhan plant draws from the river itself |
| Tanker | NMC publishes a tanker count (37, May 2026) but no delivery register, booking ledger or price survey |
| Shoreline | Landlocked |
| Climate-risk | Buildable (HydroBASINS covers the Kanhan and the Wainganga), not built |
