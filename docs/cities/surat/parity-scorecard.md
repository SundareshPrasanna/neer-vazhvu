# Surat vs Chennai: graded parity scorecard

> Measured from the shipped branch on 2026-08-17 by walking every route in a browser against the
> same route on Chennai, not estimated. Word counts are rendered body text after hydration; they
> are a crude proxy for "is there anything here", which is exactly the question a first pass needs
> to answer.

## Grades

| Grade | Meaning |
|---|---|
| **XHigh** | Surat carries materially **more** than Chennai |
| **High** | Genuine parity |
| **Medium** | Present and usable, thinner than Chennai |
| **Low** | Minimal or absent, reason stated |
| **N/A** | Structurally inapplicable. **Not a deficiency** |

**Headline: 9 of 9 enabled routes render, 0 crashes, 1 empty state (Origins, deliberate).**

## Route sweep

| Route | Surat | Chennai | Ratio | State |
|---|---|---|---|---|
| Dashboard | 823w | 811w | **1.01** | Renders, hero live |
| Rivers | 172w | 102w | **1.69** | Renders, 2 rivers, 8 stations |
| Commitments | 145w | n/a | - | Renders, 3 dated commitments |
| Flood risk | 87w | 102w | 0.85 | Renders |
| Facts | 250w | 407w | 0.61 | Renders, 7 facts |
| About | 120w | 208w | 0.58 | Renders |
| Groundwater | 13w | 23w | 0.57 | Renders (both are map-only shells) |
| Water bodies | 73w | 241w | 0.30 | Renders, 3,401 polygons |
| Origins | 48w | 3,928w | 0.01 | **Stub. Not written.** |

## XHigh - Surat exceeds Chennai (4)

| Feature | Chennai | Surat |
|---|---|---|
| **River-quality span** | 2020-2024 (5 editions) | **2019-2024 (6 editions)** |
| **Live threshold-referenced flood chain** | none | **4 links, hourly, every threshold published by the operator** |
| **Published operational danger levels** | none | **5 khadis, each with its own D.L.** |
| **Reuse ledger** | none | **330 MLD reused, Rs 496.23 Cr cumulative, tariff history, 249 industrial buyers** |
| **Hero mode** | days-left | **flood-headroom (5th mode, built generic)** |

Three of these are platform firsts. Each was built generic, so other cities inherit them.

## High - genuine parity (3)

| Feature | Chennai | Surat |
|---|---|---|
| IMD gridded rainfall | 672 monthly records | **672** monthly records (1970-2025) |
| Provisional rainfall fill | Open-Meteo daily | Open-Meteo daily |
| Named-gap discipline | provenance + gaps | provenance + gaps, 9 named gaps, 7 route-off reasons |

## Medium - present but thinner (5)

| Feature | Chennai | Surat | Why thinner |
|---|---|---|---|

| River geometry | 4 rivers | 2 rivers | OSM names only the Tapi and Mindhola; the five monitored khadis have no geometry anywhere public |
| Groundwater stations | ~35 | **94** (but district-wide) | More stations, but spread across the district rather than the city, so no interpolated surface |
| River quality readings | 51 across 13 stations | **45 across 8 stations** | Fewer stations, one more year of span. CPCB monitors 8 in this reach; that is the network, not our coverage |
| Water bodies | 1,636 OSM + 305 census | **3,418** (SAC atlas + 17 OSM-only) | Twice the polygons, a fraction of the names: 44 named. The naming gap is the source's |
| Facts | dynamic pipeline | 7 static | No live fact pipeline; static snapshot |

## Low - minimal or absent (4)

| Feature | Chennai | Surat | Blocker, and whose it is |
|---|---|---|---|
| **Origins long-read** | 3,928 words | stub | Ours. The spine is identified (8 km2 to 462.149 km2 across six annexations); the writing is not done. The largest remaining gap. |
| Ward surfaces | 200 wards | none | Three competing ward schemes, none with downloadable geometry. **WFS is disabled on SMC's own GIS.** Not ours to fix without an ask. |
| Restoration ranking | 9 projects | none | SMC restores lakes and publishes no register: no list, no dates, no budgets, no per-body status. |
| Allocation ledger | 5 arrangements | none | No published entitlement instrument exists. The ledger's subject is entitled-versus-received and the entitled half is not public. |

## N/A - structurally inapplicable (3)

| Feature | Why |
|---|---|
| Storage history / days-left | Surat impounds nothing. The weir pond is a river reach; Ukai's volume is the state's and Surat's share is unpublished. Not "not backfilled" - undefined. |
| Cascade reconstruction | Not a cascade geography. Coastal wetlands, tidal creeks and urban talavs, not chained kanmoi/kere. |
| Tanker | 95% piped coverage; the open-data release records tanker-served properties as NA in every year. |

## Platform fixes this onboarding forced

Four bugs found by walking the routes, all affecting future cities rather than Surat alone:

1. **`UrbanSupplyOverview` crashed the whole dashboard** on a partial artifact: three unguarded
   `.map()` calls on optional fields. Any city shipping a supply overview without `supply_chain`,
   `_sources` or `reference_figures` took the page down. Now degrades.
2. **The water-bodies page hid a good map** because it gated on the *lost*-bodies study rather than
   on having anything to show. A city with mapped current bodies and no lost-body research got the
   empty stub. Losing a layer should cost that layer, not the page.
3. **Madurai's copy leaks into every city** that ships a supply overview without `_view_overrides`:
   the i18n defaults are literally "Structural numbers from MMC and the ADB Tamil Nadu Urban
   Flagship Investment Program" and "Pannaipatty WTP capacity". Surat overrides them. **The default
   is still wrong and should be fixed at the source.**
4. **`CITY_TOKENS` in the catalogue builder is a hardcoded list** every new city must join or its
   artifact identity fails to derive from the path. Worth deriving from the city registry.
