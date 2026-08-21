# Surat vs Chennai: graded parity scorecard

> Measured from the shipped branch on 2026-08-19, after merging main (Pune live), by walking every route in a browser against the
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

**Headline: 9 of 9 enabled routes render, 0 crashes, 0 empty states.**

## Route sweep

| Route | Surat | Chennai | Ratio | State |
|---|---|---|---|---|
| Dashboard | 822w | 846w | 0.97 | Renders, hero live |
| Rivers | 376w | 105w | **3.58** | 2 rivers, 8 stations, 6 editions, 2 CETPs with consent compliance |
| Commitments | 145w | n/a | - | Renders, 3 dated commitments |
| Flood risk | 803w | 102w | **7.87** | Narrative variant: 4 external feeds, 7 named gaps, no map because no hazard model is published |
| Facts | 250w | 407w | 0.61 | Renders, 7 facts |
| About | 120w | 208w | 0.58 | Renders |
| Groundwater | 13w | 23w | 0.57 | Renders (both are map-only shells) |
| Water bodies | 73w | 241w | 0.30 | Renders, 805 polygons inside SMC limits |
| Origins | 2,361w | 3,928w | 0.60 | 8 chapters, 4 licence-verified plates |

## XHigh - Surat exceeds Chennai (6)

| Feature | Chennai | Surat |
|---|---|---|
| **River-quality span** | 2020-2024 (5 editions) | **2019-2024 (6 editions)** |
| **CETP consent compliance** | none | **2 plants x 24 parameters x 12 monthly samples, against each plant's own GPCB consent** |
| **Live threshold-referenced flood chain** | none | **4 links, hourly, every threshold published by the operator** |
| **Published operational danger levels** | none | **5 khadis, each with its own D.L.** |
| **Reuse ledger** | none | **330 MLD reused, Rs 496.23 Cr cumulative, tariff history, 249 industrial buyers** |
| **Hero mode** | days-left | **flood-headroom (5th mode, built generic)** |
| **Stated flood gaps** | 0 | **7**, including the two that killed the interactive route |

Four of these are platform firsts. Each was built generic, so other cities inherit them.

## High - genuine parity (3)

| Feature | Chennai | Surat |
|---|---|---|
| IMD gridded rainfall | 672 monthly records | **672** monthly records (1970-2025) |
| Provisional rainfall fill | Open-Meteo daily | Open-Meteo daily |
| Named-gap discipline | provenance + gaps | provenance + gaps, 9 named gaps, 7 route-off reasons |

## Medium - present but thinner (6)

| Feature | Chennai | Surat | Why thinner |
|---|---|---|---|
| River geometry | 4 rivers | 2 rivers, **211 km + 135 km** | OSM names only the Tapi and Mindhola; the five monitored khadis have no geometry anywhere public. The reach is the BASIN reach, not a city box: the first cut queried Overpass inside a box around Surat and cut the Tapi 48 km short of Ukai, stranding five of seven CPCB stations off the drawn line |
| Groundwater stations | ~35 | **94** (but district-wide) | More stations, but spread across the district rather than the city, so no interpolated surface |
| River quality readings | 51 across 13 stations | **45 across 8 stations** | Fewer stations, one more year of span. CPCB monitors 8 in this reach; that is the network, not our coverage |
| Water bodies | 1,636 OSM + 305 census | **805** (SAC atlas inland, in-city + 21 OSM-only) | Twice the polygons, a fraction of the names: 44 named. The naming gap is the source's |
| Facts | dynamic pipeline | 7 static | No live fact pipeline; static snapshot |
| Origins long-read | 3,928 words | 2,361 words | Eight chapters against Chennai's longer arc; shorter, not absent |

## Low - minimal or absent (3)

| Feature | Chennai | Surat | Blocker, and whose it is |
|---|---|---|---|
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

0. **Two of these were found independently.** The water-bodies gate below was fixed on main for
   Gurugram and Pune while this branch was open, with a better comment; that resolution was taken
   over mine at merge. Recording it because it says the bug was real, not a Surat quirk.

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
5. **The CPCB extractor invented reading field names.** The shared rivers client reads `do_mgl`,
   `conductivity_us` and `nitrate_mgl`; the extractor wrote `dissolved_oxygen_mgl` and friends, so
   dissolved oxygen rendered as N/A on every Surat river panel until a Playwright pass caught it.
6. **A shipped artifact had no consumer.** `cetp-compliance-surat.json` sat in the catalogue with
   `has_consumer: false` until it was wired into the rivers panel. The catalogue already tracks
   this; nothing fails on it.
7. **The shared flood map loaded ward geometry with no city argument.** `getWardGeoJSON()` bare
   takes its Chennai default, so `flood-risk-map.tsx` put Chennai's 200 wards on any other city's
   flood map - and since `FitToBounds` fits to that layer, it dragged the viewport to Chennai even
   though `center` was correctly derived from the registry. Same class as the recurring per-city
   map fallback; now derived from `wardsGeoJsonPathFor(cityId)`.
8. **`useWardLookup` had the same bug, silently.** It resolved every city's lat/lng against
   Chennai's ward polygons, so the flood and water-body detail panels returned no ward for any city
   but Chennai and would have returned a *wrong* ward had the bounding boxes overlapped. Now reads
   the city from the route.

9. **The groundwater `exploitation` flag was never checked against its data.** Its two siblings
   already gated on data having loaded (`depth` on interpolated wards, `risk` on the risk file);
   this one gated on the config flag alone. IN-GRES assesses some states at district level only, so
   Surat, Kolkata and Gurugram all shipped `blocks: []` and all three titled the page "CGWB block
   exploitation (GWR)" under a four-class percent legend - over depth-in-metres markers for Surat
   and Kolkata, and over an empty basemap for Gurugram, which has no other layer at all. Now gated;
   Gurugram routes to its named-gap state with the numbers in prose.

**The route sweep did not catch either of these.** Both pages loaded, neither crashed, and the
scorecard above graded the flood route "Renders" at 0.85 of Chennai. Rendering the wrong city's
geometry is invisible to a load-and-count pass; it took a screenshot to see it.
