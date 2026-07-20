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

## MCD Ward Boundaries 2022 - BLOCKED (the one missing geometry)

The 250-ward post-unification delimitation (SEC Delhi 2022; NOT the pre-merger 272/290) has exactly one known public digitization: OpenCity's "Delhi Wards Information" dataset (`delhi_wards.kml`, with ward number/name, AC mapping, and per-ward population attributes). That dataset was **delisted from OpenCity** sometime after mid-2025; the live files 404 and both Wayback captures of the KML are **truncated at exact MiB payload caps** (2024 capture: 1 MiB / 53 wards; 2025 capture: 5 MiB / 191 wards; union 191/250 - the partial stays out of the repo per the honest-data rule).

Exhausted alternates (all checked 2026-07-20): Datameet (pre-2022 vintage, 290 features), ESRI India policymaps item (inaccessible), HT Labs shapefiles (2017), data.gov.in (none), Datawrapper basemaps (none), archive.today (none), OSM admin_level 9/10 (sectors/villages, no MCD wards), Bharatmaps public REST (districts only), MPD-2041 dataset (PDFs). MCD's citizens GIS portal renders wards via MapmyIndia's licensed API - deliberately not scraped (commercial ToS, murky provenance).

**Resolution path:** restore request to OpenCity (draft prepared; owner sends), with SEC Delhi per-ward PDFs as the from-scratch fallback. The MCD zones layer (12 zones, same dataset) is parked with the same ask.

## CAG Performance Audit of DJB (Report No. 3 of 2025)

| | |
|---|---|
| **Source** | CAG of India - press release (24 Mar 2026) + full report; tabled in the Delhi Legislature 23 Mar 2026; audit period FY2017-18 to 2021-22 |
| **File** | `public/data/cag-djb-audit-2025.json` (chapter-organized findings, values + faithful stat sentences; extraction from the press release, full-report page anchors addable per fact) |
| **Fetched** | 2026-07-20 (both PDFs verified live) |
| **Headlines** | NRW 51-53% (Rs 4,988 cr revenue impact); Rs 66,595 cr outstanding loans + interest (Mar 2022); only 40% of produced water billed, 66% of that metered; zonal inequity <20 GPCD in 4 zones vs 60 required; ADB withdrew Rs 2,243 cr (Wazirabad WTP rehab); 594 MGD sewage generated / 545 treated / 35 STPs; 212.59 MGD from 1,080 unauthorised colonies untreated into storm drains |

## DUSIB JJ Bastis roster (675 clusters, 306,521 households)

| | |
|---|---|
| **Source** | Delhi Urban Shelter Improvement Board - the 2019 "675 JJ Bastis" list (46 pp) joined on cluster code with the 2015 "675 JJ Clusters" list (adds land area sqm, parliamentary constituency, pre-2022 ward no, revenue district) |
| **Script** | `neer-vazhvu-api/scripts/build_delhi_jj_bastis.py` (pdfplumber; downloads + parses + joins) |
| **File** | `public/data/dusib-jj-bastis.json` - 675/675 parsed, 675 enriched |
| **Fetched** | 2026-07-20 |
| **Correction to the internal audit** | Neither public PDF carries lat/lon (the audit's "lat/lon per cluster" claim does not hold). Geocoding is a follow-up: ward-join once 2022 geometry lands, or Nominatim + manual QA. `ward_no_pre2022` must NOT be joined to 2022 wards without the SEC crosswalk. |

## Allocation Ledger seed (`allocations-delhi.json`)

Authored 2026-07-20 from the verification-refreshed audit: 5 arrangements (1994 MoU 0.724 BCM/yr; Munak carrier 1,050 cusecs fixed May 2018; Bhakra TC-minute shares; Tehri 300 cusecs via UGC; DJB's unregistered groundwater), 4 authorities, 5 events, the Renuka/Lakhwar/Kishau future with the CAG's own "remote" verdict, and 5 named receipt gaps. Delhi's signature asymmetry - crisp entitlements, unmetered receipts - is the ledger's framing. All instrument URLs verified live 2026-07-20 except news pages that bot-block (noted in-file).

## Commitments Register seed (`commitments-delhi.json`)

Authored 2026-07-20: 8 commitments with dated citations and status histories. Highlight: the 39-drain trapping target (30 Jun 2026) is already **overdue** - deadline passed with no known public completion word; first verification venue is the DPCC monthly covering July. Verification calendar documented in-file (DPCC ~25th monthly, Economic Survey Feb-Mar, Flood Control Order June, Chhath season Oct-Nov).

## Facts page (`facts-delhi.json`, 35 facts)

Authored 2026-07-20 (static pipeline, Madurai/Bangalore pattern). Tier-1 set: Anangpur dam, Najafgarh Jheel 97% loss, 22 km = ~80% Yamuna load, 75% STPs without disinfection, CAG NRW + debt, Economic Survey "mafia" line, 17x LPCD gap, structural supply deficit, Munak lifeline, 2023 flood record, HC Chhath denial. Every fact carries source_url + source_label; all refresh corrections applied (37 STPs, 226 sq km, AKTC "2007-2020 core phase"). The Sept 2025 Hathnikund peak is deliberately excluded pending the 3,29,313-vs-29,313 cusec discrepancy. Hindi renderings land with the translation pass.

## Flagship + lost water-bodies registers

`water-bodies-flagship-delhi.json` (12 bodies): the hauz-baoli chain (Hauz Khas, Hauz-i-Shamsi, Agrasen/Rajon/Nizamuddin baolis, Tughlaqabad cisterns, Satpula's surviving dam via lost-register cross-ref) + modern anchors (Sanjay, Bhalswa, Najafgarh remnant, YBP wetlands, Neela Hauz, Purana Qila moat). Confidence graded A/B/C; coordinates are monument positions (OSM/ASI), not survey boundaries.

`water-bodies-lost-delhi.json` (7 entries, 3 fully lost / 4 severely reduced): Najafgarh Jheel as-a-lake, Nahar-i-Behisht city reach, Anang Tal, Hauz Rani, Satpula tank, Tughlaqabad southern reservoir, Yamuna floodplain ox-bows. Named follow-up: reconstruct the Najafgarh historic-extent polygon from the 1883 Gazetteer + DPGS EMP maps.

## DPCC Monthly Yamuna + Drain Water Quality (THE Tier-1 feed)

| | |
|---|---|
| **Source** | DPCC I/C Water Laboratory monthly analysis reports - 8 Yamuna stations (pH/BOD/COD/DO/faecal coliform/phosphate/ammonical-N, C-class criteria) + ~39 drain points in three series (direct outfalls incl. Najafgarh + Shahdara; Najafgarh subdrains + Jheel upstream/downstream; UP outfalls; Agra-canal drains) + **monthly per-STP compliance reports (~30 pp) that the May audit assumed were RTI-gated** |
| **Domain migration** | `dpcc.delhigovt.nic.in` -> **`dpcc.delhi.gov.in`** (Drupal). The new domain is reachable from ordinary networks - the DPCC scraper does NOT need the India-IP runner path (constraint note corrected). |
| **Format reality** | PDFs are IMAGE SCANS, zero text layer - the recurring parser needs OCR (tesseract on the runner is the wiring task). Seed data was transcribed visually from 200-dpi rasters. |
| **Script** | `neer-vazhvu-api/scripts/fetch_dpcc_monthly_delhi.py` - scrapes both listing pages, classifies (river/drain/stp), archives new PDFs + index (default archive: `~/.local/neervazhvu-ops/dpcc-archive`). First run archived 10 PDFs: river Jan/Mar/Apr/May 2026, drain Mar/Apr/May, STP Mar/Apr/May. |
| **File** | `public/data/dpcc-monthly-wq-delhi.json` - river series for Jan/Mar/Apr/May 2026 (Feb absent from DPCC's own listing - publication gap) + full May drain network |
| **Headlines in the seed data** | May 2026: BOD 2.0 at Palla -> 60.0 at Asgarpur (30x across the city, vs 3.0 limit); DO NIL at 5-6 of 8 stations every month; exit faecal coliform 310,000-400,000 MPN/100ml = 124-160x max-permissible. **9 of 39 drain points read NO FLOW - drain-trapping's footprint in DPCC's own data, the verification signal for the overdue 39-drain commitment.** |

## CETP monthly water-quality archive (62 PDF bundles, 2019-2024)

| | |
|---|---|
| **Source** | DPCC per-CETP monthly analysis reports (inlet/outlet across 23 parameters incl. heavy metals, EPA standards, measured flow vs design capacity, OLMS status remark) |
| **Host** | OpenCity datasets `delhi-cetp-monthly-water-quality-data-2019-2022` + `-2022-2024` (archival - the series ends Nov 2024) |
| **File** | `public/data/delhi-cetp-monthly-index.json` - full 62-resource index + one transcribed schema sample (Wazirpur, Nov 2024: 5.32 MLD measured vs 24 MLD design; "OLMS was non functional" remark on the report itself) |
| **Fetched** | 2026-07-20 (index + sample); PDFs are image scans - bulk extraction rides the same OCR batch as the DPCC river/drain/STP scans |

## Registered but not yet acquired

The audit's full per-page source map (DPCC monthly Yamuna feed, CAG audit PDF, DUSIB 675 JJ bastis, CGWB blocks, CETP monthly WQ PDFs, BBMB/Tehri feeds, drainage master plan, heritage baolis) is research-complete and URL-verified as of 2026-07-20 but not yet ingested. Each source graduates into this file when its data actually lands in the repo.
