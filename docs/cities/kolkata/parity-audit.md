# Kolkata parity audit against Chennai

> Page-by-page audit of Kolkata against Chennai, the platform's reference city. Every gap is classified, and every gap that **cannot** be closed carries the reason. Audit date 2026-07-26, against `docs/cities/chennai/features.md`.

## How gaps are classified

| Class | Meaning |
|---|---|
| **PARITY** | Kolkata has the equivalent feature with comparable or better data |
| **BETTER** | Kolkata exceeds Chennai here |
| **PARTIAL** | Present but thinner; the shortfall is stated |
| **BUILDABLE** | Data exists and is reachable; not yet built. Effort noted |
| **BLOCKED** | Data would exist but is unreachable, unpublished, or contradicts itself. Named blocker |
| **N/A** | Structurally inapplicable to Kolkata. **Not a gap** - a difference in the city |

The honest headline: **Kolkata is not a weaker Chennai, it is an inverted one.** Chennai's spine is
supply (reservoirs, days-left, tankers, a desalination fleet). Kolkata has no supply spine to measure
because it stores nothing. Kolkata's spine is drainage, sewage and pollution, where it is the
strongest city on this platform. Scoring it on Chennai's axes alone would report a failure that is
actually a difference; scoring it only on its own axes would hide real gaps. Both are below.

---

## 1. Dashboard

| Chennai feature | Kolkata | Notes |
|---|---|---|
| Days of Water Left, 3 scenarios | **N/A** | Kolkata impounds **nothing**. Supply is run-of-river Hooghly abstraction plus ~110 MLD of tube wells. The days-left numerator does not exist - this is undefined, not merely hard. |
| Reservoir cards, 6 reservoirs, live storage/inflow/outflow | **N/A** | No reservoirs. The four source cards render identity + a `noFeedNote` naming who would have to publish, the Delhi pattern. |
| Catchment rainfall context (CHIRPS 30/90-day) | **N/A** | No reservoir catchments to contextualise. |
| Per-reservoir drilldown, 365-day charts | **N/A** | As above. |
| Historical comparison overlay 2019-2025 | **N/A** | No storage series to overlay. |
| Storage trend chart | **N/A** | As above. |
| Rainfall trends, 56-year IMD history | **PARITY** | Shipped 2026-07-26. **56 years, 1970-2025, 672 monthly records, long-term annual mean 1,659.3 mm**, at grid point 22.5/88.25 (the city centre sits near deltaic cells IMD classifies as water). Open-Meteo provisional fill runs on top. The temporary freshness EXEMPTION has been REMOVED - its stated removal condition was met. |
| *(no Chennai equivalent)* | **BETTER** | **`drainage-capacity` hero**: 26 years of hourly rainfall (232,896 hours) against KMC's published 6 mm/h design standard, with a movable threshold and year picker. No other city has a sub-daily rainfall product. |

**Verdict: intentionally divergent, and now with no outstanding gap.** Five N/A rows are the same
underlying fact stated five ways - Kolkata stores no water. The one real gap, the IMD rainfall
backbone, is closed. Everything remaining on this page is structural.

---

## 2. Groundwater

| Chennai feature | Kolkata | Notes |
|---|---|---|
| Ward depth choropleth (200 wards) | **BLOCKED** | Two blockers, either sufficient: ward geometry is 141 of 144, and station spread has not been validated for interpolation. Painting a continuous surface from 23 in-district wells over 206 km² would invent values. |
| CGWB exploitation blocks | **SHIPPED for the ring, N/A for the core** | IN-GRES API decoded and built (4 assessment years, all 6 KMA districts). But **Kolkata district cannot have this choropleth at all**: it is categorised `salinity` - a poor-quality category, not a stage band - and carries no availability, resource or extraction figures, because CGWB does not assess saline aquifers on extraction. South 24 Parganas the same. The framework classifies Kolkata on a different axis; that is a finding, not a missing file. The ring IS assessed: **North 24 Parganas moved safe -> semi-critical in 2024-25**, Nadia semi-critical, Hooghly and Howrah safe. |
| Live CGWB station overlay (~35 stations) | **BETTER** | **704 stations, 201,276 readings** across the six KMA districts; 23 in Kolkata district alone, live to 2026-06-04. Chennai has ~35. |
| Sensor data-quality layer (stuck/stale/ok) | **PARTIAL** | Per-**district** liveness ships (live / lagging / stale). Per-**station** stuck detection is not ported. Buildable, ~half a day. |
| Ward detail panel | **BLOCKED** | Depends on ward choropleth above. |
| Block detail panel | **BUILDABLE** | With IN-GRES blocks. |
| Risk score + breakdown + nudges | **BLOCKED** | Chennai's composite weights reservoir stress at 20%. Kolkata has no reservoirs, so the composite needs re-derivation with its own weights (the Delhi `risk_v2_dl` precedent), on top of ward geometry it does not have. |
| Ward context panel, AI ward analysis | **BLOCKED** | Ward-keyed. |

**Kolkata-specific, no Chennai equivalent:**
- **Arsenic at KMA scale** - 42.4% of North 24 Parganas habitations affected, 83 affected blocks
  statewide including Barrackpur I/II (the intake) and Rajarhat. **PARTIAL**: verified but rests on
  PHED IMIS *as of 30 April 2016*. Must be presented as of-2016 or refreshed from JJM-WQMIS.
- **Two districts have gone silent** - Howrah since 2023-04-30, Hooghly since 2022-11-30. Rendered
  stale, never interpolated over. Liveness as a finding is itself a feature Chennai does not have.

**Verdict: better raw network, weaker surfaces.** Kolkata has 20x Chennai's station count and cannot
yet draw Chennai's main groundwater map, because the blocker is ward geometry, not water data.

---

## 3. Rivers

| Chennai feature | Kolkata | Notes |
|---|---|---|
| Interactive polyline map, 4 rivers | **PARITY** | 52 named segments: Hooghly, Adi Ganga, Saraswati, Bidyadhari, Kulti. |
| Monitoring station markers (10 stations) | **BETTER** | **41 stations, 3,209 samples**. |
| DO/BOD/nitrate time series (2015-2024) | **BETTER** | **2010-2026**, roughly quarterly. Longest single series: Ganga at Dakshineswar, **281 samples**, 2010-01-28 to 2026-07-07. Chennai is annual CPCB NWMP. |
| Pollution profile with BIS limits | **PARITY** | Same shared classifier; DO, BOD, COD, TSS, faecal + total coliform, pH, temperature. |
| River detail panel, 3-year trend | **PARITY** | Same component. |
| Stretch highlighting | **PARITY** | Same component. |
| Sewage inlet layer (31 inlets, Cooum) | **BLOCKED** | No equivalent geo-located inlet inventory found. KMC's 80 drainage maps are per-ward **PDFs**, not vector. |
| Restoration tracker (9 CRRT projects) | **BUILDABLE** | The 10-plant STP programme with coordinates is the natural analogue and is already ingested; needs page wiring. |
| No-monitoring alarm | **PARITY** | Same component; applies to unmonitored channels. |
| Industrial pollution overlay (7 facilities) | **BLOCKED** | **KMC left the entire industrial-wastewater section of its own statutory Environment Plan blank**, naming WBPCB as responsible. The corporation declares this gap itself. One hook exists: WBPCB samples groundwater *inside* the Kolkata Leather Complex. |
| *(no Chennai equivalent)* | **BETTER** | **Tidal station pairs.** Six Adi Ganga points, each sampled separately at high and low tide - unique on the platform, and the correct way to model a tidal river. |

**The finding this page carries:** the Adi Ganga at Bansdroni recorded **NIL dissolved oxygen and
4,900,000 MPN/100ml faecal coliform** on 7 May 2026, WBPCB's own observers recording the water as
"Blackish" and "Pungent". And because of the tidal pairing we can say something no other city's data
supports: **low tide is worse** - BOD 14.53 against 10.75, faecal coliform 8.4 million against 4.9
million at the same point on the same day.

**Verdict: Kolkata's strongest page, ahead of Chennai on depth, cadence and method.**

---

## 4. Flood risk, drainage and sewerage

| Chennai feature | Kolkata | Notes |
|---|---|---|
| Narrative flood page | **PARITY** | Shipped. Required generalising `FloodConfig`: `dam_release_threshold_cusecs` was a REQUIRED field, a Madurai/Delhi-era assumption that a city floods when someone upstream opens a gate. Kolkata has no gate, so the dam fields are now optional and a generic `primary_trigger` carries the 6 mm/h standard. |
| CFLOWS hazard zones (Very High to Very Low) | **BLOCKED** | No public flood model. WRD's legal red/blue flood-line maps exist as **41 scanned A0 sheets**, not georeferenced. Georeferencing is a real project, not an ingest. |
| Historical flood events (2015 / Nivar) | **BUILDABLE** | Kolkata's analogue is chronic annual waterlogging rather than named catastrophic events; the weekly register is the better primitive. |
| Storm-water drain network (10,308 GCC segments) | **PARTIAL** | 182 OSM drain segments against Chennai's 10,308 surveyed. KMC publishes **80 per-ward drainage-map PDFs**, so the vector network exists on paper only. |
| Macro/micro drains (52 channels) | **PARITY** | Comparable via OSM + the named-channel layer. |
| Drain detail panel | **PARTIAL** | OSM attributes only (no depth, width, material, condition - GCC surveyed those, KMC has not published them). |
| Sewerage network (13 STPs, 348 SPS, 3,834 mains) | **PARTIAL** | Plant-level only: 5 existing STPs (179 MLD) + 10 upcoming (280.06 MLD, 9 with coordinates). No pumping-station or pipe-network geometry is public. |
| Return-period maps (5-200 year) | **BLOCKED** | Same blocker as hazard zones. |
| Ward boundary overlay (200 wards) | **PARTIAL** | 141 of 144, borough known for 52. |
| Ward context + AI analysis | **BLOCKED** | Ward-keyed. |
| Deep linking `?ward=N` | **PARTIAL** | Works for the 141 mapped wards. |
| *(no Chennai equivalent)* | **BETTER** | **Live weekly ward-attributed waterlogging register**: 329 rows, 66 named pockets, 53 wards, 15 boroughs, 469 machine deployments in one week. KMC overwrites it in place, so our capture is the only archive that will ever exist. |
| *(no Chennai equivalent)* | **BETTER** | **The combined-system fact.** Most of the core city carries sewage and stormwater in one conduit, which is the single fact tying Kolkata's flooding, river pollution and wetland dependence together. |

**Verdict: worse hazard modelling, better observed-failure evidence.** Chennai can tell you where
flooding is *modelled* to occur; Kolkata can tell you where it *actually* happened last week, by ward.

---

## 5. Water bodies and restoration

| Chennai feature | Kolkata | Notes |
|---|---|---|
| Water-body census map | **PARITY** | 5,526 bodies, 5,365 ha from OSM. |
| Lost water bodies layer | **BUILDABLE** | Needs a historical comparison; the satellite pipeline is the route. |
| Restoration priority scoring | **BUILDABLE** | Shared pipeline; needs a Kolkata run. |
| Rich-data deep-zoom panel (flagship bodies) | **BUILDABLE** | Rabindra Sarobar and Subhash Sarobar are the natural candidates and are both WBPCB-sampled, so water quality is already in hand. |
| CRRT restoration projects | **BLOCKED** | No equivalent public restoration project register found. |
| *(no Chennai equivalent)* | **BETTER, shipped** | The **East Kolkata Wetlands** now have a first-class dashboard card (`sewage-balance-card.tsx`), placed second, directly under the hero: 910 of 1,400 MLD, 5.1x all five STPs combined, with the 311 MLD untreated remainder and the 30.94 MLD residual gap that survives building all ten planned plants. Deliberately a CARD, not a map layer - EKW is not a feature of the landscape, it is the sewage system. **Boundary geometry is a named gap**: OSM has no EKW polygon (the one protected-area way in its bbox is a 15-node 0-ha stub) and Ramsar's RSIS boundary was not retrievable in this pass. |

**The named gap that is the story:** KMC's own inventory is a **departmental tank list "as prepared on
1993"** plus a 2004 NRSA aerial map, covering 3,777 ponds. A 33-year-old inventory of a pond-dense
delta city is the gap, and the strongest argument for the satellite corroborating layer.

**Caveat on our own layer:** OSM's extent is conservative for some features - its outer ring for
Rabindra Sarobar is 3.04 ha against a lake usually given as ~29 ha. This layer corroborates KMC's
list; it does not replace it.

---

## 6. Pages Kolkata does not ship

| Page | Class | Reason |
|---|---|---|
| `shoreline` | **N/A** | Kolkata is not a coastal city. It is a tidal river port ~130 km upstream of the Bay of Bengal. Chennai's shoreline page measures **coastal erosion against a sea**; there is no sea here. A riverbank/estuary variant would be a genuinely different surface, not a port of this one. |
| `cascades` | **N/A** | Not a cascade geography. Tank cascades are a peninsular-India form (Chennai, Madurai); the Gangetic delta drains, it does not cascade. |
| `climate-risk` | **BLOCKED (weak method)** | The HydroBASINS hybas_12 method transfers mechanically, but Kolkata sits on a **very flat delta** where DEM-based catchment delineation is unreliable. Shipping it would mean shipping boundaries we cannot defend. Kolkata's real climate exposure is cyclone and storm surge, which needs a different framing and a different source. |
| `my-ward` | **BLOCKED, and bigger than it looked** | Ward geometry is 141 of 144, but the gap is **18.93 km2 = 9.2% of Kolkata**, not three small wards: the 141 mapped wards union to 187.15 km2 against KMC's stated 206.08. The mean mapped ward is 1.33 km2, so the gap is 4.7x three average wards - consistent with 142-144 being the large peri-urban Joka additions. Every source exhausted 2026-07-26: OpenCity has only the 141; OSM has **zero Kolkata ward relations at any admin_level**; KMC's own ward/borough pages 404; nothing on GitHub or DataMeet. Derivation by subtracting the 141 wards from OSM's KMC boundary (relation 9381363) **failed informatively** - that polygon is 184.4 km2, smaller than the 141 wards, so OSM excludes the 2015 additions too; the residual was 600 sliver artefacts centred on the river. Shipping a derived polygon would have been fabrication. |
| `tanker` | **PARTIAL/BLOCKED** | KMC *does* run a municipal tanker service with published per-trip rates (Rs 450 / 3,600-4,000 l within 8 km) - but publishes **no volumes, no bookings, no deliveries**. Chennai's page is built on operational data that does not exist here. The tariff is also 2010-11; no current schedule found. |

---

## 7. Cross-cutting gaps

| Item | Class | Reason |
|---|---|---|
| Total supply capacity | **BLOCKED, deliberately** | KMC's own page lists plants summing to 2,324.7 MLD beside a ~1,900 MLD target and ~1,660 MLD requirement, labelled "(DRAFT)", footered 2013, referring to 2025 in the future tense. No total is published anywhere in the product until it reconciles against KMC's budget statements. |
| LPCD / per-capita supply | **BLOCKED, deliberately** | KMC contests its own denominator: 4.5m residents + 6m/day floating in the Environment Plan, 44.96 lakh "static" on the water site. `defaultConsumptionMld` is null on purpose. |
| Non-revenue water | **BLOCKED** | Not found at all. Combined with near-absent volumetric charging and largely unmetered connections, NRW and distributional equity are structurally invisible in Kolkata. |
| Ward representatives | **BUILDABLE** | KMC election CSVs are on OpenCity. |
| Bengali UI | **PARTIAL** | `availableLanguages: ['en']`, `upcomingLanguages: ['bn']`. Drainage-hero strings are English-only and fall back to `en`; entries are partial by design. Needs a native review pass, which should not be machine-generated. |
| Elevation bands | **N/A (low value)** | FABDEM bands ship for all four earlier cities. Kolkata's grid point sits at **12 m** and the delta is near-flat, so hypsometric bands would be visually uniform and analytically empty. Also FABDEM is CC BY-NC-SA, which matters if the commercial track consumes these pages. |
| AI narratives | **BUILDABLE** | Template pattern transfers. |

---

## 7A. Live page audit (browser, 2026-07-26)

Every route driven in a real browser, not just checked for HTTP 200 - which
turned out to matter, because **all 11 routes returned 200 while four were
broken**. Status codes are worthless here: these pages catch their own errors and
still render a shell.

| Route | Words | Map features | Console errors | State |
|---|---|---|---|---|
| `/kolkata` | 622 | - | 0 | **live** - drainage-capacity hero |
| `/groundwater` | 54 | **703** | 0 | **live** - every CGWB well renders |
| `/rivers` | 296 | **67** | 0 | **live** - 4 rivers, 15 mapped stations, BIS profile, 2011-2026 series |
| `/facts` | 260 | - | 0 | **live** - 13 facts |
| `/allocations` | 485 | - | 0 | **live** - 2 arrangements, 5 gaps |
| `/commitments` | 137 | - | 0 | **live** - 2 dated commitments |
| `/about` | 143 | - | 0 | live, thin |
| `/origins` | 58 | - | 0 | live, thin - long-form not written |
| `/flood-risk` | 700+ | 0 | 0 | **live** - drainage-capacity framing, 3 events, 5 stated gaps |
| `/water-bodies` | 102 | 0 | 0 | **honest empty state** - needs curated water-body data files |
| `/lake-restoration` | 122 | 0 | 0 | **honest empty state** - needs curated lake-restoration files |

**Five defects found and fixed** that no status check would have caught:
allocations and commitments 404ing on unset config flags; allocations crashing
on a wrong arrangement shape; commitments crashing on an invalid status value;
groundwater crashing on a wrong station-file shape; and rivers needing a curated
per-city config plus a dissolved-per-river geojson, then crashing twice more on
a missing `stretch` field and on null station coordinates.

**The lesson for the next onboarding:** a city's data files landing is roughly
half the work. Each map page additionally needs a curated per-city config entry
(`RIVER_INFO_BY_CITY` and its equivalents), and the shared components carry
Chennai-era assumptions - a required `stretch` descriptor, a `display_name_hi`
that presumed Hindi - that only surface when a city without them renders.

The three remaining empty states are **honest, not broken**: they name what is
missing and link to what is live. They are the next unit of work.

## 8. Scorecard

Counting the 47 feature rows above, excluding N/A (which are city differences, not gaps):

| Class | Count |
|---|---|
| PARITY or BETTER | 17 |
| PARTIAL | 9 |
| BUILDABLE | 9 |
| BLOCKED | 12 |
| N/A (structural) | 11 |

**Kolkata is BETTER than Chennai on 8 features**, all on the pollution/drainage spine: station count
and depth, sampling cadence, tidal method, the live waterlogging register, the sewage balance, the
combined-system framing, sub-daily rainfall, and groundwater network density.

**The three gaps worth closing first**, in order:
1. **IMD rainfall backbone** - the clearest missing Chennai feature, and it unblocks the freshness
   exemption. Mechanical, just heavy.
2. **IN-GRES groundwater blocks** - unblocks the exploitation choropleth and block detail panel.
3. **Wards 142-144** - unblocks `my-ward`, ward profiles, ward context and every ward-keyed panel.
   This single 3-polygon gap blocks more downstream features than anything else on the list.

**The gaps that are not ours to close:** industrial sources (KMC declared it blank in its own
statutory plan), NRW (never published), flood hazard zones (scanned A0 sheets), sewage inlets and the
drain network (PDF-only), and the supply total (self-contradictory at source). These are recorded as
named gaps on the product surfaces rather than filled from weaker sources.
