# Kolkata vs Chennai: graded parity scorecard

> Deep audit, 2026-07-26. Every row is **measured from the shipped files**, not estimated. Companion to `parity-audit.md` (which explains the *why* behind each gap); this document grades the *how much*.

## Grades

| Grade | Meaning |
|---|---|
| **XHigh** | Kolkata carries materially **more** than Chennai |
| **High** | Genuine parity - comparable in kind and depth |
| **Medium** | Present and usable, but thinner than Chennai |
| **Low** | Minimal or absent. Reason stated; several are not ours to fix |
| **N/A** | Structurally inapplicable. **Not a deficiency** - a difference in the city |

**Headline: 11 of 11 routes live, 0 empty states, 0 console errors.**
14 XHigh · 6 High · 11 Medium · 9 Low · 6 N/A

---

## XHigh - Kolkata exceeds Chennai (14)

| Feature | Chennai | Kolkata | Multiple |
|---|---|---|---|
| **River water-quality readings** | 51 | **3,209** | **63x** |
| **River monitoring stations** | 13 | **41** | 3.2x |
| **River series span** | 2020-2024 (5 yrs, annual) | **2010-2026 (17 yrs, quarterly)** | 3.4x span |
| **Longest single station series** | - | **281 samples** (Ganga at Dakshineswar, 2010-01-28 to 2026-07-07) | - |
| **Groundwater observation wells** | ~35 | **703** | **20x** |
| **Groundwater readings** | - | **201,221** | - |
| **Water bodies (OSM polygons)** | 1,636 | **5,526** | 3.4x |
| **Census water bodies** | 305 | **3,051** | **10x** |
| **Localities** | 500 | 765 | 1.5x |
| **Sub-daily rainfall intensity** | none | **26 yrs hourly, 232,896 values** | platform-first |
| **Tidal station pairing** | none | **6 points x high/low tide** | platform-first |
| **Sewage balance** | none | **full generated-vs-treated balance** | platform-first |
| **Live ward-attributed waterlogging register** | none | **weekly, 66 pockets / 53 wards** | platform-first |
| **Hero mode** | days-left | **drainage-capacity** (4th mode, generic) | platform-first |

**Five of these are platform firsts**, not just bigger numbers: no other city here has sub-daily
rainfall, tidal station pairs, a sewage balance, a live weekly waterlogging register, or a
non-storage hero. Each was built generic, so other cities inherit them.

---

## High - genuine parity (6)

| Feature | Chennai | Kolkata |
|---|---|---|
| IMD gridded rainfall | 672 monthly records | **672** monthly records (1970-2025, mean 1,659.3 mm) |
| River geometry | 4 rivers | 4 rivers (Hooghly 140 km, Saraswati 67, Adi Ganga 39, Bidyadhari 38) |
| Lost water bodies | 15 | 22 (21 toponymic + 1 court-documented) |
| Provisional rainfall fill | Open-Meteo daily | Open-Meteo daily |
| River pollution profile / BIS limits | shared classifier | shared classifier, same components |
| Named-gap discipline | provenance + gaps | provenance + gaps, arguably deeper |

---

## Medium - present but thinner (11)

| Feature | Chennai | Kolkata | Why thinner |
|---|---|---|---|
| Ward geometry | 200 (complete) | **141 of 144** | The 3 missing wards are 18.93 km2 = **9.2% of the city**; no public geometry exists anywhere |
| Flagship deep-zoom bodies | 12 | 4 | Only 4 have sourceable history at V/N grade |
| Restoration projects | 9 | 4 | Kolkata has no restoration *register*; its record is a court docket plus a survey |
| Commitments | 16 | 2 | Only 2 carry a dated deadline in a citable document |
| Allocation arrangements | 5 | 2 | Kolkata has no entitlement for its *own* water - only what KMC sells onward |
| Groundwater assessment units | 16 blocks | 6 districts | And the core district is `salinity`, so it has no extraction stage at all |
| Facts | dynamic pipeline | 13 static | No live pipeline; static snapshot |
| Historical flood events | 327 + 53 hotspots (2015, Nivar) | 3 narrative events | No modelled event layers; the weekly register is the better primitive |
| Drain detail attributes | depth/width/material/condition | OSM tags only | GCC surveyed those; KMC has not published them |
| Sewerage | 4,188 network features | plant-level only (5 existing + 10 upcoming, 9 mappable) | No pumping-station or pipe geometry is public |
| Borough/zone naming | full zone names | 52 of 141 wards | Derived from KMC's own weekly register - the only primary source that ties wards to boroughs |

---

## Low - minimal or absent (9)

| Feature | Chennai | Kolkata | Blocker, and whose it is |
|---|---|---|---|
| Storm-water drain network | **10,308** surveyed segments | 182 OSM segments | KMC publishes 80 per-ward drainage maps as **PDFs**. The vector network exists on paper. **Not ours to fix.** |
| Flood hazard zones | 15,524 features (CFLOWS) | none | No public flood model for Kolkata. WB's legal flood-line sheets are **scanned A0 plots**, not georeferenced. |
| Flood return periods | 3,550 features (5-200 yr) | none | Same blocker. |
| Flood inundation depth | 192 points | none | Same blocker. |
| Ward profiles | 200 | none | Ward-keyed; blocked on the 3 missing wards. |
| Per-ward groundwater choropleth | 200 wards, monthly | none | Ward-keyed **and** station spread unvalidated for interpolation. |
| Ward risk composite | risk_v2 | none | Chennai's weights reservoir stress at 20%; Kolkata has no reservoirs, so it needs its own derivation on ward geometry it lacks. |
| Industrial pollution sources | 218 zones + 7 facilities | none | **KMC left the entire industrial-wastewater section of its own statutory Environment Plan blank**, naming WBPCB as responsible. The corporation declares this gap itself. |
| Climate-risk sub-basins | 6 sub-basins, 4 components | none | HydroBASINS transfers mechanically but Kolkata is a **very flat delta** where DEM-based delineation is undefendable. Its real exposure is cyclone/storm surge, which needs a different method. |

**Six of these nine are not ours to close** - they are blocked on someone else publishing
something (PDF-only drain maps, no flood model, ungeoreferenced flood lines, a blank statutory
section, missing ward polygons). Two are honest method refusals.

---

## N/A - structurally inapplicable (6)

Not deficiencies. Kolkata is a different kind of city.

| Feature | Why it cannot apply |
|---|---|
| Days-of-water hero | **Kolkata impounds nothing.** Run-of-river Hooghly abstraction plus tube wells - the numerator does not exist |
| Reservoir cards / storage history | No reservoirs |
| Reservoir catchment rainfall context | No catchments to contextualise |
| Shoreline / coastal erosion | Not a coastal city - a tidal river port ~130 km upstream of the Bay of Bengal |
| Tank cascades | Peninsular-India form. The Gangetic delta drains; it does not cascade |
| Dam-release flood trigger | No dam, no barrage, no upstream gate to watch |

---

## The pattern worth naming

Kolkata refused the platform's default question **five** times, and each refusal produced a
generalisation other cities inherit rather than a Kolkata special case:

| # | The default question | Why it fails here | What was built instead |
|---|---|---|---|
| 1 | How many days of water are left? | Nothing is impounded | `drainage-capacity` hero, generic to any city with a published drainage standard |
| 2 | When does the dam release? | No dam | `primary_trigger` on FloodConfig, dam fields now optional |
| 3 | What is the groundwater extraction stage? | Aquifer is `salinity` - not assessed on extraction at all | Category checked before assuming a stage exists |
| 4 | Where is the city's supply infrastructure? | Its largest treatment asset is a wetland outside its boundary | Generic `sewageBalance` dashboard card |
| 5 | Which specific ponds were lost? | No per-pond inventory exists | Toponymic method, corroborating the 44% from a third direction |

Chennai's spine is **supply**. Kolkata's is **drainage, sewage and pollution** - and on that spine it
is the strongest city on the platform.

---

## Three things still open

| Item | Status |
|---|---|
| 6 mm/h hero anchor | **Pre-publication gate.** Needs a KEIIP document. One-line config change; the standard lives in `drainageCapacity.standardMmPerHour` with its citation |
| Wards 142-144 | **Blocked.** 9.2% of the city. Every route exhausted; the OpenCity ward KML is registered in Headwaters as the most likely way it ever closes |
| `enabled: true` + migration 039 | **Your call.** Kolkata is registered disabled and preview-gated |
