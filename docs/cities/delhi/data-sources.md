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

## Registered but not yet acquired

The audit's full per-page source map (DPCC monthly Yamuna feed, CAG audit PDF, DUSIB 675 JJ bastis, CGWB blocks, CETP monthly WQ PDFs, BBMB/Tehri feeds, drainage master plan, heritage baolis) is research-complete and URL-verified as of 2026-07-20 but not yet ingested. Each source graduates into this file when its data actually lands in the repo.
