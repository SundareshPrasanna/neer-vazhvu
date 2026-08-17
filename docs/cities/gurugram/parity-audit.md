# Gurugram parity audit against Chennai

> Page-by-page audit of Gurugram against Chennai, the platform's reference city. Every gap is classified, and every gap that **cannot** be closed carries the reason. Audit date 2026-08-17, against `docs/cities/chennai/features.md`.
>
> This document exists because it was missing, and its absence was itself a defect: the shared `FeatureNotYetAvailable` component was rendering a hardcoded `parity:` badge for Gurugram - "EASY" on the rivers page, for a city with no river - with no assessment anywhere behind it. The badge is now gated on this file existing. Nothing on the site may assert a parity verdict that this document has not made.

## How gaps are classified

| Class | Meaning |
|---|---|
| **PARITY** | Gurugram has the equivalent feature with comparable or better data |
| **BETTER** | Gurugram exceeds Chennai here |
| **PARTIAL** | Present but thinner; the shortfall is stated |
| **BUILDABLE** | Data exists and is reachable; not yet built. Effort noted |
| **BLOCKED** | Data would exist but is unreachable or unpublished. Named blocker |
| **N/A** | Structurally inapplicable to Gurugram. **Not a gap** - a difference in the city |

The honest headline: **Gurugram has no water of its own to measure.** Chennai's spine is impoundment
- six reservoirs, a days-left runway, a desalination fleet. Gurugram impounds nothing, has no river,
and treats no water it owns. Its water arrives by canal, comes out of an over-drawn aquifer, or
arrives on a tanker. Scoring it on Chennai's supply axes reports a failure that is really a
difference. Its own axes - extraction, the tanker market, and a water-body register with the
publisher's own cross-survey attribution - are where it is strong, and on two of them it is the
strongest city on this platform.

---

## 1. Dashboard

| Chennai feature | Gurugram | Notes |
|---|---|---|
| Days of Water Left, 3 scenarios | **N/A** | Gurugram impounds nothing. There is no numerator. Undefined, not merely hard. |
| Reservoir cards, live storage | **N/A** | No reservoirs, no dams. `waterSources` is deliberately empty and `reservoirHistoryAbsentNote` says why. |
| Catchment rainfall context | **N/A** | No reservoir catchments to contextualise. |
| Supply hero | **PARITY** | `cauvery-pumping` mode on `gurugram-supply-overview.json`: 572 MLD installed (Chandu Budhera 300 + Basai 272), read from GMDA's asset register **at build time** so it cannot drift from the publisher. |
| Demand / deficit | **BLOCKED** | Every demand figure in circulation (675-700 MLD peak) is press-sourced. GMDA's Final Development Plan and Social Infrastructure Development Plan are scanned PDFs with no text layer. No supply-minus-demand gap is computed, deliberately. |
| Long-term rainfall chart | **BUILDABLE** | Needs the IMD gridded backfill for grid point (28.4360, 77.0560). Freshness exemption `gurugram:rainfall-recent` records the removal condition. |

## 2. Groundwater

| Chennai feature | Gurugram | Notes |
|---|---|---|
| Block/district exploitation choropleth | **PARTIAL** | IN-GRES 2024-25, six districts with geometry and stage %. Gurugram 194.6% over-exploited. Chennai's equivalent is at **block** resolution; Gurugram's is at **district**, so the unit is coarser even though the measure is the same. |
| Four-year assessment history | **PARITY** | Four assessment years (2021-22 to 2024-25) for all six districts. |
| Per-ward interpolated depth | **BLOCKED** | The India-WRIS level series for this district is **37 stations ending June 2020**, and Haryana's telemetry network does not cover Gurugram at all - 95 MB of state export, zero rows. Not ours to fix. |
| Ward risk composite | **BLOCKED** | Same blocker: no current depth surface to composite. |
| CGWB station overlay | **BLOCKED** | Same. Revisit if HWRA or a CGWB Year Book publishes post-2020 levels. |

## 3. Water bodies

| Chennai feature | Gurugram | Notes |
|---|---|---|
| Current water-body polygons | **PARITY** | 824 features from GMDA's NGT register, 2,851 acres. |
| Lost / vanished bodies | **BETTER** | Derived from the publisher's **own** cross-survey flags (ROR 1956 / SoI 1976 / WorldView 2012 / drone / Google Earth), not a spatial join of ours. 29 of 283 ROR-matched bodies absent from the 2012 pass. Chennai's equivalent is hand-curated. |
| Encroachment census | **BLOCKED** | Needs the Supabase `water_bodies_census` table; GMDA publishes ownership and a remark field but no encroachment status. |
| Restoration priority ranking | **BUILDABLE** | Inputs present (ownership, area, remark, boundary membership); the scorer is not written. |
| Ward search | **BLOCKED** | Depends on ward profiles - see §6. |

## 4. Tanker market

| Chennai feature | Gurugram | Notes |
|---|---|---|
| Tanker data at all | **BETTER** | Chennai has none. Gurugram has GMDA's own transaction ledger: **29,284 loads, 1.72 billion litres, Rs 8.72 crore, 2019-2021**, with named buyers and a three-tier tariff. No other city on this platform has tanker data at transaction resolution. |
| Series currency | **PARTIAL** | The publisher stopped after 2021. Watched by `gmda-tanker-mis`; a 2022 file appearing is the event we want. |

## 5. Origins

| Chennai feature | Gurugram | Notes |
|---|---|---|
| Long-form water story | **PARITY** | Six chapters on the municipal limit 1985-2020 against the 2008 dark-zone notification. |
| Licence-cleared imagery | **PARTIAL** | **Text-only.** Every other city story carries images with provenance in a `MANIFEST.json`; none has been sourced for Gurugram. Fabricating provenance would be worse than running without, so it runs without. |
| Regional-language rendering | **PARTIAL** | Hindi is in `upcomingLanguages`; the story renders in English. Same posture as Kannada, Marathi and Bengali at their launches. |

## 6. My Ward

| Chennai feature | Gurugram | Notes |
|---|---|---|
| Ward selector, profiles, deep links | **BLOCKED, route OFF** | The 36 MCG ward polygons **are** harvested, but nothing is joined to them: `/api/wards` and `/api/localities` both 404 and there is no `gurugram-ward-profiles.json`. The page rendered 296 characters - a heading, a subtitle and a link - so the route is off rather than empty. Closes when ward-level data exists to attach to the geometry. |
| Ward names | **BLOCKED** | GMDA's ward layer publishes `ward_no` and a zone code and **no name**. Ward surfaces can label by number and zone only. |

## 7. Rivers

| Chennai feature | Gurugram | Notes |
|---|---|---|
| River quality, stations, pollution overlays | **N/A - route 404s** | **Gurugram has no river.** Every one of its NWMP stations is a lake or a borewell, and its surface water leaves as drain flow into the Najafgarh jheel and then Delhi's Najafgarh drain. This is the entry that exposed the badge bug: the page was rendering "parity: EASY" here. Parity is not easy, it is undefined. |

## 8. Flood risk

| Chennai feature | Gurugram | Notes |
|---|---|---|
| Hazard zones, historical hotspots, drainage overlays | **BUILDABLE** | Gurugram floods by waterlogging on a paved catchment, not by river. The inputs are verified and reachable on GMDA OneMap: **117 GMUC waterlogging sites**, the master storm-water network, natural flow direction, and 10 watersheds. Only the drain legs are harvested so far. This is the largest single buildable gap. |

## 9. Treatment and discharge

| Chennai feature | Gurugram | Notes |
|---|---|---|
| Per-plant STP capacity and effluent compliance | **BUILDABLE** | HSPCB's dated monitoring workbook carries **18 Gurugram STPs** with capacity, commissioning date, owning agency, and inlet/outlet BOD/COD/TSS, plus one CETP against published consent limits. Not yet wired to `hasTreatmentDischarge`. |

## 10. Structurally inapplicable

| Feature | Why |
|---|---|
| Shoreline change | Landlocked. |
| Cascades | Aravalli johads and village ponds are a real heritage but **not** a tank cascade: no chained-surplus system was engineered here as in the Tamil kanmoi districts or the Bengaluru kere chains. Catchment delineation itself is buildable and is a separate question. |
| Allocation ledger | No published entitlement instrument located. The ledger's primitive is entitled-vs-received against a named paper; without the paper there is no row to write. |

---

## What this audit changed

Writing it produced one immediate correction. The rivers page had been rendering **"parity: EASY"**
for Gurugram since the city went live. The correct verdict is **N/A** - not a gap to close but a
property of the city - and the route now 404s. The badge that made the claim is gated on this
document existing.
