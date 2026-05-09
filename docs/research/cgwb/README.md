# CGWB source PDFs

Reference material from India's **Central Ground Water Board** (CGWB,
Ministry of Jal Shakti). These are the source documents we extract
station-level groundwater data from for the Madurai (and future
Tamil Nadu city) dashboards. Not committed to git - kept locally for
re-extraction and citation. The source-of-truth structured data lives
in `public/data/<city>-cgwb-stations.json`.

## Files

### Tamil Nadu State Year Books — primary data source

These are the per-state CGWB Year Books, the documents from which we
extract per-station depth-to-water-level (m bgl) readings. Each year
book lists every CGWB monitoring well in TN+Puducherry by district,
with quarterly readings for May / Aug / Nov / Jan.

| File | Year covered | Report ID | Used in |
|---|---|---|---|
| `tn-state-yearbook-2023-24.pdf` | May 2023 - Jan 2024 | SECR/GWYB/TN/2023 (Jul 2024) | `public/data/madurai-cgwb-stations.json` |
| `tn-state-yearbook-2024-25.pdf` | May 2024 - Jan 2025 | SECR/GWYB/TN/2024 (Aug 2025) | `public/data/madurai-cgwb-stations.json` |

The Year Books are published annually by CGWB South Eastern Coastal
Region (Chennai). Source portal:
[cgwb.gov.in/cgwbpnm/search?type=2&cat_id=4&state_id=33](https://cgwb.gov.in/cgwbpnm/search?type=2&cat_id=4&state_id=33)
(filter: type=2 Year Book, cat_id=4, state_id=33 Tamil Nadu).

### CGWB All-India Annual Reports — context only, not extracted

All-India activity reports - drilling rigs operated, samples analysed,
NAQUIM coverage, schemes implemented, policy narrative. Useful as
background context for the Origins long-read or any all-India framing.
Not used for station-level data extraction (that lives in the State
Year Books above).

| File | Year covered |
|---|---|
| `india-annual-report-2020-21.pdf` | 2020-21 |
| `india-annual-report-2021-22.pdf` | 2021-22 |
| `india-annual-report-2022-23.pdf` | 2022-23 |
| `india-annual-report-2023-24.pdf` | 2023-24 (Feb 2025) |
| `india-annual-report-2024-25.pdf` | 2024-25 |

## Extraction workflow

Each TN State Year Book has an Annexure-I section listing every
monitored well by district with lat/lng + 4 quarterly readings. For
Madurai the annexure block is around Sl 300-318 (dug wells only in
2024-25; both dug wells + bore-well piezometers in 2023-24).

To extract a new year:

1. Open the Year Book PDF and find the Madurai annexure pages
   (alphabetical district order, after Krishnagiri).
2. Match wells to existing entries in
   `public/data/madurai-cgwb-stations.json` by lat/lng (treat ≤2.5 km
   drift as same well; ≥10 km as distinct).
3. Append four quarterly readings per matched well, with
   `year_book: "<YYYY-YY>"`.
4. New wells (not in any prior year book) get a new entry; wells
   absent from a year book just don't get readings for that year
   - the schema tolerates gaps.

## Provenance

The Year Book annexures publish lat/lng to ~6 decimal places (~10cm
precision) but recorded coordinates can drift up to ~2.5 km between
editions as CGWB occasionally re-georeferences existing wells.
`madurai-cgwb-stations.json` keeps the most recent year's coords as
canonical and notes drift in the per-reading `_note` field.
