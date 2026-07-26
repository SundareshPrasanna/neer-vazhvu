# Data Sources - Delhi

> Where each Delhi dataset comes from, how often it refreshes, and what to watch out for.

Delhi is the fifth city under onboarding (config registered `enabled: false`, branch `delhi-onboarding`). The full source audit lives in the private research repo (`docs/research/delhi-data-sources-audit-DRAFT.md`, compiled 2026-05-11, verification-refreshed 2026-07-20 with a 191-URL liveness probe). This file documents only what has actually been ACQUIRED into the repo, as it lands - the Madurai documentation principle applies: hedge absence claims ("no known public X"), name every gap.

Supply model in one line: Delhi owns no impounded storage - ~90% of raw water arrives via inter-state instruments (1994 Yamuna MoU at Wazirabad, Munak Canal from Haryana, Bhakra via BBMB, Tehri via THDC, Upper Ganga Canal), ~10% is DJB's own groundwater; 9 WTPs produce ~960 MGD against ~1,400 MGD demand (CAG Report No. 3 of 2025).

**Network constraint that shapes every scraper decision:** NICNET hosts (164.100.x.x - CPCB, yamuna-revival.nic.in, arc.indiawris.gov.in, Bhuvan/NDRF) refuse TCP from non-India IPs, confirmed from two networks on 2026-07-20. Every scraper touching them must run from the India-IP path (the local scheduled-job pattern used for CMWSSB/Pravah/KWRIS), never from CI runners.

## OSM Water Bodies (polygon base layer)

| | |
|---|---|
| **Source** | OpenStreetMap via Overpass API |
| **License** | ODbL 1.0 - "(c) OpenStreetMap contributors" attribution required on every rendering surface |
| **Script** | `scripts/fetch-water-bodies-osm-delhi.ts` (clone of the Bangalore fetcher: osmtogeojson assembly, drain/wastewater exclusion, 0.1 ha floor, Hindi `name:hi` capture) |
| **File** | `public/geojson/delhi-water-bodies-current.geojson` |
| **Fetched** | 2026-07-20 |
| **Coverage** | 1,845 polygons, ~5,805 ha total, NCT bbox 28.40-28.90 N / 76.85-77.40 E. Largest: **Najafgarh Jheel remnant at 601.5 ha** - independent corroboration of the "226 sq km drained to ~7 sq km" collapse story (the OSM polygon is the surviving core). Only 87 of 1,845 are named; 4 carry Hindi names. |

## OSM Rivers + Canals + Major Drains

| | |
|---|---|
| **Source** | OpenStreetMap via Overpass API (ODbL, same attribution) |
| **Script** | `scripts/fetch-rivers-osm-delhi.ts` (Madurai-pattern assembly + connectivity walk, extended: per-channel `waterways` sets because Delhi's channels switch tags along their course) |
| **File** | `public/geojson/delhi-rivers.geojson` |
| **Fetched** | 2026-07-20 |
| **Coverage** | 5 channels over the Yamuna-basin reach (Hathnikund -> Okhla bbox, deliberately wider than NCT - the rivers page is basin-scoped and labelled as such): `yamuna` (~499 km incl. braided sections), `wyc_munak` (~302 km Western Yamuna Canal / Munak carrier - the ~70% raw-water lifeline), `hindon` (~319 km), `sahibi` (~52 km), `najafgarh` (3 km of explicitly-named fragments) |

**Naming caveat to resolve at rivers-page authoring:** OSM maps most of the Najafgarh drain's 57 km course as the Sahibi's engineered reach - the 52 km `sahibi` feature IS largely the drain. Decide the display split (natural upper Sahibi vs urban Najafgarh drain) before the page ships.

**Known gaps:** no known OSM-named geometry for the Barapullah or Shahdara drains inside the bbox (queried 2026-07-20). Acquire via manual OSM way-ID curation or the IFC 2018 Drainage Master Plan in the flood-risk phase.

## Jal Dharohar Water Bodies Census (893 census points)

| | |
|---|---|
| **Source** | 1st Census of Water Bodies / "Jal Dharohar" enumeration for NCT Delhi (enumerated 2022, map released 2023) - GNCTD / Ministry of Jal Shakti |
| **Digitization/host** | OpenCity Urban Data Portal, dataset [`delhi-water-bodies-census-data`](https://data.opencity.in/dataset/delhi-water-bodies-census-data), resource "Delhi Water Census Map 2023" (KML). Attribute BOTH the census (data) and OpenCity (digitization). |
| **Script** | `scripts/fetch-water-census-delhi.ts` (fetch + KML->GeoJSON; provenance block embedded in the output file's `metadata`) |
| **File** | `public/geojson/delhi-water-bodies-census.geojson` |
| **Fetched** | 2026-07-20 (live download - this dataset survived the OpenCity delistings that took the wards/pipelines files) |
| **Coverage** | 893 point features with unique_id, district, tehsil, village, water-body type, ownership, storage capacity, max depth, khasra number, enumeration date. Joins onto the OSM polygon layer at render time (the Chennai census-join pattern). |

**Source quirks (kept verbatim, handle in display code):** district values contain source typos ("SOUH EAST", "SOUH WEST"); `water_body_type` is a coded value (01, 02, ...) - the code table needs to be pulled from the census methodology PDF before the type renders as text.

## MCD Ward Boundaries 2022 - RECOVERED (2026-07-24)

| | |
|---|---|
| **File** | `public/geojson/delhi-wards-2022.geojson` - all 250 post-unification wards, normalized props + AC mapping + delimitation population columns (sum 16.42M = Census-2011 MCD area) |
| **Original publisher** | SEC Delhi, Delimitation Order 2022 |
| **Digitization** | OpenCity, dataset "Delhi Wards Information" (delisted ~2025) |
| **Recovery** | Owner's complete local copy of `delhi_wards.kml` (7,173,765 bytes, sha256 `528f90b258eb41546e485deee7b5f1371be6ef005128a73e08e395a98b84e08a`), verified **byte-identical to the Internet Archive's truncated capture of the OpenCity download URL over its full 5,242,880 bytes** - same origin file, integrity proven. Converted by `neer-vazhvu-api/scripts/convert_delhi_wards_kml.py`; one empty non-ward remainder record excluded |
| **Validation** | 250/250 ward numbers join `delhi-ward-representatives.json` with zero name mismatches |

Still with OpenCity (restore ask trimmed accordingly): the MCD **zones** KML (11/12 Wayback salvage) and the DJB **water/sewer pipelines** KMLs.

## CGWB groundwater observation wells (237 stations) - ACQUIRED 2026-07-25

| | |
|---|---|
| **Source** | Central Ground Water Board observation-well network (telemetric DWLRs + manual wells) |
| **Access** | India-WRIS "Ground Water Level" dataset API, `POST https://indiawris.gov.in/Dataset/Ground%20Water%20Level` - **open from any IP**; only `arc.indiawris.gov.in` (ArcGIS tiles) is India-IP gated. The general reusable recipe is in [the pan-India source playbook](../../methodology/pan-india-source-playbook.md) |
| **Script** | `neer-vazhvu-api/scripts/build_delhi_cgwb_stations.py` (caches raw rows in `.cache/`; `--refresh` re-downloads) |
| **File** | `public/data/delhi-cgwb-stations.json` |
| **Coverage** | 237 stations across all 11 districts, 278,830 raw readings for 2015-2025, published as monthly means. Later years 6-hourly telemetric; earlier years periodic manual |
| **Why it matters** | Delhi's CGWB assessment resolves only to **11 districts**. These resolve to **points**, which is what made the per-ward groundwater card and `risk_v2_dl` possible |

**Handling notes (do not skip if re-running):**

- **Sign convention is per-station, not global.** `dataValue` sign depends on the installing programme: numeric NHN codes and `AAXI*` are positive-down, `CGWBDL*` is negative-down. The build derives the convention per station from the median of its own readings and asserts family agreement (151/39/46, zero disagreement). A blanket `abs()` would erase real water-above-datum readings in floodplain wells and hide sign-faulty sensors.
- **Two sensors excluded**, not averaged in: `CGWBDL32` (perfectly symmetric ±26.10 m) and `CGWBDL46` (660-890 m, in a city whose deepest true well is ~68 m). Readings outside -5..100 m bgl are dropped and counted in `_excluded`.
- **Not a live feed.** Telemetry stops **2025-09-20** across the whole network, the same month BBMB's reservoir page froze (04.09.2025).
- Validated against known hydrogeology: ridge wells (Gadaipur 68.3 m, Sultanpur 68.6 m) vs floodplain wells (Jagatpur 2.0 m, Coronation Pillar 1.9 m) reproduce the published over-exploited districts independently.

## DUSIB JJ bastis - geocoded (675 clusters) - ACQUIRED 2026-07-25

| | |
|---|---|
| **Source** | Delhi Urban Shelter Improvement Board, "List of 675 J.J. Bastis with Latitude and Longitude", upload date 16-09-2022, linked from [the Board's JJ Bastis page](https://delhishelterboard.in/main/?page_id=3644) |
| **File (PDF)** | `JJC_List_675_Geo_Coordinates.pdf`, sha256 `f9dc3767bf904addf1a2ade3de18b90189159bfda24724d0dd80d0c4ccaf38e8` (pinned; the build aborts on mismatch) |
| **Script** | `neer-vazhvu-api/scripts/build_delhi_jj_bastis_geo.py` |
| **File** | `public/data/delhi-jj-bastis-geo.json` |
| **Coverage** | **675/675** clusters with coordinates, zero duplicates, all inside the NCT bounding box |

**Join + jurisdiction notes:**

- The coordinate PDF and the household roster (`dusib-jj-bastis.json`) use **different serial numbering** (geo #1 = F-Block Mangolpuri, roster #1 = LNJP Hospital Ranjeet Road), so households are joined on normalised location text. Every row records `match_method`: 594 exact, 2 fuzzy (difflib >= 0.90, score stored), 79 unmatched. Unmatched rows keep their coordinates and carry **no** household count rather than an inferred one. Household coverage **263,394 of 306,521 (85.9%)**.
- Long names wrap across up to three lines with coordinates on continuation lines, so records are parsed as blocks anchored on a strictly sequential serial. A naive per-line parse silently lost 137 of 675.
- **33 clusters fall outside every MCD ward, correctly**: 21 in NDMC (Lutyens - Race Course, Raisina, Talkatora, Pandara Road), 11 in Delhi Cantonment, 1 at the far eastern edge. Neither NDMC nor the Cantonment is part of the 250-ward MCD delimitation. They are reported as out-of-jurisdiction, not dropped.

## Elevation bands (FABDEM) - BUILT 2026-07-25

| | |
|---|---|
| **Source** | FABDEM V1-2 via Google Earth Engine (30 m DEM, buildings and forests removed) |
| **Script** | `neer-vazhvu-api/scripts/build_elevation_bands.py --city delhi` |
| **File** | `public/data/elevation-bands-delhi.geojson` (6 bands, 2.1 MB) |
| **Bands** | 192-205, 205-210, 210-214, 214-218, 218-224, 224-330 m, chosen from FABDEM percentiles over the NCT (p5=203.5, p50=214.5, p80=221.4, p100=326.3) - Delhi is a very flat plain with one hard Ridge edge |

**Datum warning:** these are **terrain** bands, not flood-stage bands. Delhi's flood ladder (204.50 m warning / 205.33 m danger / 206.00 m evacuation at the Old Railway Bridge) sits on the gauge's own datum - FABDEM reads **212.15 m** at that bridge, about 7 m off. The two must not be overlaid as if they shared a datum.

## DPCC drain network (39 points) - PARSED 2026-07-26

| | |
|---|---|
| **Source** | DPCC monthly drain analysis reports, [analysis-reports listing](https://dpcc.delhi.gov.in/dpcc/analysis-reports) |
| **Script** | `neer-vazhvu-api/scripts/extract_delhi_drain_quality.py` |
| **File** | `public/data/delhi-drain-quality.json` |
| **Coverage** | 2 months (2026-05, 2026-06), 73 readings, 40 with coordinates |

**Why it matters.** The drain network is the verification instrument for the commitment to trap all 39 major drains by 30 June 2026: **a trapped drain reads NO FLOW**. The repo previously carried the network for a single month because the rows were hand-typed off scans, so the pollution surface had one data point.

**THE ARCHIVING PROBLEM - the most important thing on this page.** DPCC's listing is a **rolling ~3-month window**. OpenCity mirrors only the CETP datasets. The Wayback Machine has **zero** captures of the analysis-report directory or the listing page (checked 2026-07-26). **A month not captured while it is listed is lost permanently.** The historical drain series was never archived by anyone and cannot be recovered; this series can only grow forward. That is why the Headwaters entry is tier 1, and it is the strongest candidate for an OpenCity mirror request.

**What the parse adds beyond the hand-typed month:** the reports carry **per-drain coordinates**, which the transcription never captured. That makes the drains a mappable, ward-attributable layer, and May's positions are backfilled from June's parse by canonical name.

**Handling notes:**

- June 2026 has an **embedded text layer** (no OCR needed). **April and May do not** (0 text characters) - they are pure image scans and are not parsed.
- The reports have no ruled table and records span two or three physical lines, so rows are rebuilt from word positions, with column bands derived **per page** from that page's own header (page 3 sits ~23pt right of page 1).
- Parsed names arrive mangled by the scanner (`D rain`, `Ll Drain`, or two drains run together). They are matched against the **39 hand-typed canonical names already in `dpcc-monthly-wq-delhi.json`**; **12 fragments did not clear the threshold and are reported, not published under a guessed name**.
- **`NO FLOW` is set only where DPCC printed it.** A row we failed to read stays null, because reporting an unread row as a trapped drain would fake the trapping programme's own result.

## CETP flows + industrial sources - ACQUIRED 2026-07-26

| | |
|---|---|
| **Source** | Delhi Pollution Control Committee, monthly CETP analysis reports (I/C Water Laboratory), via OpenCity |
| **Scripts** | `neer-vazhvu-api/scripts/extract_delhi_cetp_flows.py` (OCR) → `build_delhi_industrial_sources.py` (register) |
| **Files** | `public/data/delhi-cetp-flows.json`, `public/data/industrial-sources-delhi.json` |
| **Coverage** | 13 plants x 60 months, **709 readings** (628 with a flow value), **2019-04 to 2024-11** |

**Why this is Delhi's industrial layer.** DPCC's only public consent register is `consentapplicationstatus1991-july_2002.pdf`, stale by 24 years, so there is no per-unit denominator of who discharges what. But DPCC publishes each CETP's design capacity *and measured monthly inflow*, which answers a sharper question: how much industrial effluent reaches treatment at all. **Delhi built 213.8 MLD of common effluent treatment capacity and receives about a third of it in a median month; Okhla's plant runs at 7% of design.** This layer measures the treatment gap, not individual polluters, and must not be read as a census of industry.

**Extraction caveats (the PDFs are image scans with no text layer):**

- Extracted: plant, design capacity, month, sampling date, measured flow, OLMS remark, sampling location. **Not extracted**: the 23-parameter inlet/outlet grid, whose cells OCR badly. Half-read heavy-metal values would be worse than none.
- The build **asserts against a hand-transcribed page** (Wazirpur, Nov 2024) and fails on disagreement.
- **Median, not mean**, for utilisation: one mis-OCR'd flow dragged Mangolpuri to 254% of capacity; the median reads 67.5%.
- Flow above 3x design is rejected as an OCR artefact. Defensible because the observed ratios are bimodal with an empty 3x-10x band (621 readings at or under design, 6 genuine overloads to 3x, then 29x and 59x).
- 11 readings (1.5%) have an unresolved plant name and are reported, not silently dropped.
- Some 2019 reports record the sampling location as **"BYPASS OF CETP"** - captured as a field, because a sample taken at the bypass is a material fact.
- **NOT a live feed**: the series ends November 2024. Surfaces showing these figures carry that caveat next to the number.

**Coordinates.** No CETP is mapped in OpenStreetMap. Plant markers sit on the industrial area or locality each serves, never a surveyed position; every entry records `location_precision` (`industrial_area` 8, `locality` 3, `road` 1, `none` 1). **SMA CETP has no coordinate** - neither "SMA Industrial Area" nor "Shahzada Bagh" is in OSM - so it keeps its flow series and is excluded from the map rather than placed by guesswork. The 22 named industrial estates come from Overpass, filtered point-in-ward so Noida/Gurgaon/Kundli parcels are excluded (`overpass-api.de` 504s under this load; the kumi mirror worked).

## Registered but not yet acquired

The audit's full per-page source map (DPCC monthly Yamuna feed, CAG audit PDF, DUSIB 675 JJ bastis, CGWB blocks, CETP monthly WQ PDFs, BBMB/Tehri feeds, drainage master plan, heritage baolis) is research-complete and URL-verified as of 2026-07-20 but not yet ingested. Each source graduates into this file when its data actually lands in the repo.
