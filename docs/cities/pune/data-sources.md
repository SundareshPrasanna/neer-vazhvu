# Pune - Data Sources

City ten. Scope is **PMC only** (Pune Municipal Corporation, 41 electoral prabhags, 478 sq km),
not the wider Pune Metropolitan Region. Build record and the reasoning behind every scope decision:
`docs/specs/pune-onboarding.md` (local).

Every number on Pune's surfaces is primary-sourced. Where a figure is derived, the artifact says so
in its own `_note`; where a source refuses to publish something, that refusal is recorded rather
than filled in.

---

## 1. Supply and entitlement - PMC's own Environment Status Report

**Source:** PMC Draft Environment Status Report 2025-26, chapter 5, and MWRRA Orders 19/2018 and
01/2025.
**Producer:** `neer-vazhvu-api/scripts/build_pune_supply.py`
**Output:** `public/data/pune-supply-overview.json`
**Refresh:** annual, when PMC publishes a new ESR edition.

PMC's site (`www.pmc.gov.in`) is a JavaScript shell that returns a 404-shaped page for every path.
The documents are reachable through **`webadmin.pmc.gov.in`, an open Drupal JSON:API with no auth**:
`/en/jsonapi/node/reports_and_dpr` lists ESR editions back to 1995-96. Two path asymmetries bite:
`next` links come back as `http://` and hang unless rewritten to https, and NODE pages need
`/index.php` in the path while FILE paths must not have it.

Current edition:
`https://webadmin.pmc.gov.in/sites/default/files/2026-08/PMC%20Draft%20ESR%202025-26_compressed.pdf`
(9.4 MB, Marathi, text-extractable).

### What the artifact carries

The **water budget 2025-26**, verbatim: six demand segments summing to 1,110.18 MLD net, plus
522.19 MLD of system loss at 32% NRW, for a total requirement of 1,631.84 MLD (21.030 TMC) against
a sanctioned 16.36 TMC. **The producer fails the build** if the transcribed rows stop summing to
PMC's own stated totals, and the same guard covers the four abstraction points (1,681.5 MLD) and the
WTP list (1,854 MLD).

Also: the 18-plant WTP inventory, the equitable-supply (24x7) project's cost and progress, the
sewage balance, the service-level benchmarks, and the full MWRRA entitlement chain with dates.

### Caveats recorded on the artifact

- **PMC's own budget does not close.** The six segment rows sum to 1,110.18 MLD, while the loss row
  is exactly 32% of the stated 1,631.84 total, which implies a net of 1,109.65 - a 0.53 MLD (0.03%)
  inconsistency. The TMC column shows the same gap. Both of PMC's figures are reproduced as
  published; neither is silently corrected.
- **PMC republished an identical service-level-benchmark table for four consecutive years**
  (2021-22 through 2024-25): coverage 98%, supply duration 4 hours, NRW 35%, per-capita 250 LPCD,
  metered 30%, collection 88%. Only 2025-26 moves. **Treat the first column as ONE observation, not
  a four-year trend.**
- **The report contradicts itself on plant count**: the text says 17 WTPs while the table lists 18
  rows. The capacities are the table's. The 2024-25 edition said 15 plants totalling 1,914 MLD.
- **1,681.5 MLD is installed LIFTING capacity, not measured delivery.** PMC publishes no measured
  daily abstraction, and states explicitly that its accounts exclude groundwater, private tankers
  and other alternative sources.
- **No measured annual draw has been published since 2017-18**, and for that year the utility and
  the regulator disagree by 4.15 TMC (PMC's affidavit 14.56 TMC against WRD's 18.71).

### The entitlement, and why "11.5 TMC" is the wrong number to quote

11.5 TMC is the **Khadakwasla-only** reservation (State High Power Committee, 10 Mar 2005; carried
into the PMC-WRD agreement of 1 Mar 2013 as 11.0 domestic + 0.5 commercial). PMC's **total**
authorisation is 16.36 TMC - the 14.61 TMC agreement plus 1.75 TMC for the merged villages
(Superintending Engineer's letter, 2 Jul 2021), per MWRRA Order 01/2025. Comparing 11.5 against
total lifting compares one reservoir's share against every source PMC draws on.

The entitlement has never been settled: PDRO fixed it at 8.19 TMC (23 Oct 2017); MWRRA set that
aside and deemed 11.5 TMC an entitlement under s.31(B) (13 Dec 2018), finding PMC's use far in
excess of the project's own 8.3 TMC drinking provision and the Khadakwasla farmers "deprived of
their share"; PMC appealed, and on 19 May 2025 MWRRA found the issuing officer was not the
competent PDRO and remitted the matter. Nine years, two orders, no number.

MWRRA orders are **scanned images** - `pdftotext` returns nothing. Read with OCR or vision.

---

## 2. Reservoirs - Maharashtra WRD Pravah daily bulletin

**Source:** `https://mwrdpravah.in/damsafety/control/pdfLatestReportEng`
**Producer:** `neer-vazhvu-api/scripts/scrape_pravah_dams.py --city pune`
**Output:** `public/data/pune-dam-storage.json` + `reservoir_daily_v2` (city_id=pune)
**Refresh:** daily, `.github/workflows/pravah-dam-refresh.yml`

One daily all-Maharashtra PDF; the cert chain is incomplete so TLS verification must be disabled.
Mumbai already depends on this feed, so Pune adds a second city to an existing dependency rather
than a new source.

Seven Pune-region dams are parsed: the **Khadakwasla chain** (Khadakwasla, Panshet, Warasgaon,
Temghar - the four that supply PMC), **Pawana** (PCMC's source), **Bhama Askhed** (PMC's eastern
scheme), and **Mulshi Tata** for context only.

### Cross-validation

Capacities are not taken on trust from one publisher. CWC's **National Register of Large Dams 2019**
agrees to the cubic metre on Panshet (301,610,000 m3), Warasgaon (363,130,000), Temghar and Bhama
Askhed (217,100,000). The chain's live total, **825.66 Mcum = 29.158 TMC**, independently reproduces
the 29.15 TMC / 825.43 MCM PMC publishes in its own ESR. CWC's weekly Reservoir Storage Bulletin
agrees to under 1% on every dam it also carries.

### Register errors - do not re-derive from these

- **NRLD-2019's Khadakwasla row is 10x high** (860,000,000 m3 gross against a true 85.91 Mcum - a
  stray zero).
- **NRLD-2023 is a scanned OCR document** and its Chaskaman and Bhama Askhed rows are 1000x low
  (0.242 and 0.230 against 241.69 and 230.47).
- Pravah and NRLD disagree on **Pavana alone** by ~11% (live 240.97 vs 274.32 Mcum) with no
  published explanation. Pravah is preferred as the operator's own current figure.

### The column that was read wrong

Column 9 of a Pravah row is **today's GROSS storage**. It was previously captured as last year's
LIVE storage and upserted into `reservoir_daily_v2` dated a year back, which put Modaksagar at 159%
and Tansa at 106% of live capacity in Mumbai's history. Last year's live storage is never printed
as a volume - only as column 11's percentage - so it is reconstructed as `ly_pct x live_cap`. Fixed
in PR #275; the residual Mumbai DB rows are tracked in issue #276.

### Backfill route

Pravah's dated URLs 404, so there is no archive on that endpoint. A **separate dated archive does
exist** and is the backfill path:
`https://wrd.maharashtra.gov.in/Upload/PDF/Today's-Storage-ReportMarathi-DD-MM-YYYY.pdf`
(apostrophe URL-encoded). Verified against the archive-fallback trap - the 01-08-2026 file carries
its own header date and different values, so the archive is genuine. Marathi only; the English
filename 404s. Not yet wired.

Names: three government sources spell one dam three ways - Pravah "Khadakwasla", CWC "KHADAKVASLA",
India-WRIS "Khadakwasala_1". Pravah prints "Warasgaon" where secondary writing says Varasgaon.
Official register names differ again: Panshet is Tanajisagar, Warasgaon is Vir Baji Pasalkar.

---

## 3. Groundwater - IN-GRES, drilled to taluka

**Source:** IN-GRES, `POST https://ingres.iith.ac.in/api/gec/getBusinessDataForUserOpen`
**Producer:** `neer-vazhvu-api/scripts/build_ingres_gwr.py --city pune`
**Outputs:** `public/data/gwr-blocks-pune.json`, `public/geojson/pune-gwr-blocks.geojson`
**Refresh:** annual per assessment edition.

**Pune is the first city on this producer to drill below the district**, and the reason is that the
district figure states the opposite of the finding. Pune district totals **63.73% and reads SAFE**,
while **Shirur taluka inside it is CRITICAL at 95.71%** and has been in all six published editions,
never below 94.24%. 92.9% of Shirur's extraction is agriculture.

14 talukas x 6 editions (2019-20, 2021-22, 2022-23, 2023-24, 2024-25, 2025-26). 2020-21 returns a
lone empty `total` row - a real gap, not a fetch failure.

### Three traps, each of which produces a plausible wrong number

1. **The `total` key silently includes saline/poor-quality area and does NOT match CGWB's published
   report.** Summing `command + non_command` reproduces the CGWB *National Compilation on Dynamic
   Ground Water Resources of India 2025* (p.161) exactly - recharge 194,942.64, extractable
   182,653.14, extraction 115,497.00 ham, stage 63.23% - where the naive key gives 67.25%. It bites
   only the four salinity-affected talukas (Baramati, Daund, Indapur, Purandhar - exactly the four
   CGWB names on p.391, derived here independently) and is **invisible on the other ten**, so
   verifying on a clean taluka shows perfect agreement and proves nothing. `stageOfExtraction` and
   `category` are already computed on the fresh area, so the percentage stays right while the
   volumes it comes from are wrong.
2. **Editions land PER STATE, not nationally.** `scripts/source-registry/gurugram.json` records
   "2024-2025 is current; there is no newer edition" as of 15 Aug 2026, verified against Tamil Nadu
   and Haryana. Maharashtra's 2025-2026 was already published (36 districts, state stage 50.85%)
   while Haryana and West Bengal still returned the empty total. Anything that watches one state and
   infers the national edition will be wrong for the others.
3. **Six editions are not six years of measurement.** IN-GRES recomputes availability every edition
   while largely carrying forward the rainfall and extraction inputs. Seven of the 14 talukas carry
   a single rainfall value across all six; no taluka has more than three distinct values in six.
   Purandhar moves from semi-critical 85.20% to safe 51.27% on an extraction figure that is
   **identical in both editions** (10,854.4 ham) - the denominator was revised, nothing was measured
   to have changed. Baramati moves the same way. **Do not render as an annual extraction trend.**

### Request shape

The discriminator is **`parentuuid`, not `loctype`**. Pune's children come from
`locname=PUNE, loctype=DISTRICT, locuuid=<Pune>, parentuuid=<Maharashtra>`. Setting `parentuuid` to
Pune's own uuid - the obvious guess - returns **zero rows with HTTP 200**, which reads as "this
district publishes no block assessment". `loctype` values TEHSIL, BLOCK, TALUK and ASSESSMENT UNIT
all return zero too.

UUIDs, both obtained by asking the API rather than from the Angular bundle:
Maharashtra `e7b3f02d-2497-4bcd-9e20-baa4b621822b`, Pune `471dff0a-9b41-46f2-890d-179b2408ca4d`.

### Geometry

IN-GRES's own GeoServer, `gec:indgec_ver_mahar`, with `CQL_FILTER=parent_name='PUNE' AND year=2021`.
**Without the year filter the layer returns 27 features across two vintages** (2019 with 13 talukas,
2021 with 14 - the 2019 vintage predates Pune City becoming its own unit). The WFS `uuid` is a
**different namespace** from the assessment API's `locationUUID` and matches nothing, so the join is
on normalised name: the portal upper-cases unit names before 2023-24, title-cases after, and spells
MAVAL as "Mawal" in 2025-26 only.

**Pune City becomes its own assessment unit only in 2023-24.** Before that it is inside Haveli, so
its series is three editions long by construction. Its extractable resource (1,218-1,231 ham) is the
smallest in the district - urban Pune drinks surface water, so the aquifer under it is a minor
resource rather than the main one.

---

## 4. Groundwater stations - India-WRIS / NWDP telemetry

**Source:** India-WRIS / NWDP, Groundwater Level Telemetry (6-hourly), Maharashtra GW.
**Producer:** `neer-vazhvu-api/scripts/build_pune_gw_stations.py`
**Output:** `public/data/gw-stations-pune.json`
**Refresh:** manual. India-WRIS is unreachable from CI runners and was unreachable from three
separate hosts during this build (TCP connect to 164.100.85.36:443 times out), consistent with the
known geo-blocking. The data arrived as a **bulk CSV export in a research drop**, and the artifact
records that provenance. Only derived aggregates are published - never the 6-hourly rows.

**120 stations across Pune district, and exactly ONE inside the city.** That is the finding, and it
is why `groundwaterViews.depth` is false. Tested **point-in-polygon against the 41 PMC prabhags**,
not by bounding box: the bbox answer is nine, and six of those are rural stations in Purandhar,
Haveli and Maval that merely fall inside the rectangle. The one is Shivaji Nagar_1. Drawn on the
groundwater map, the station dots make the point visually - Maharashtra instruments the farmland,
not the city.

### Validity filter, and why a global sign rule is safe here

`reference_wris_groundwater_levels_api` records that WRIS sign convention is **per station** and that
a global rule cost Kolkata 9,115 readings. Checked before assuming: across all 120 Pune stations,
96.99% of readings are negative, 2.68% positive, 0.34% exactly zero, and **not one station is
predominantly positive**. This export is uniformly negative-convention. The check is the point, not
the answer - re-check for the next state.

Rejected, with per-station counts kept on the artifact: NaN (20); exactly 0.0, +1.0 and -1.0
(8,031 - **+1.0 occurs 3,465 times and -1.0 3,490 times**, a symmetry no water table produces,
against real readings carrying two or three decimals; whole stations flatline on them, Medad 75.8%,
Nazare Supe 48.9%); and all positive values (5,083 - clusters at +41, +43 and +50 and a lone
+162.37 m). 306,231 readings survive.

**The filename lies about the date range** (third city running, after Surat and Gurugram): the file
named `1991_2020` holds 20 Pune rows from Nov-Dec 1999. Real coverage starts Sep 2022. Re-derive
coverage from the data.

### River telemetry from the same drop is NOT wired, and the reason is a gap worth stating

15 Pune river stations, 858,493 rows - and the network **stops on 18 December 2024**, with only
three Tata dam gauges continuing into 2026. Worse, four stations including **Dattawadi, the only
gauge inside Pune city, have an 84-day hole running 29 May to 22 Aug 2024**, so the in-city gauge
did not record the 25 July 2024 flood at all. Khadakwasla_1 has a 96-day hole over the same window.
Nighoje on the Indrayani did capture it, peaking at 568.92 m on 25 Jul against a 563.02 m median.
Pimpale Gurav is unusable - it sits at exactly 555.16 m for ten consecutive days then jumps 18 m.
Sentinels here are -99.99/-100, and Khadakwasla_1 carries a 941.4 m spike against a ~586 m FRL.

---

## 5. Rivers - CPCB polluted river stretches

**Source:** CPCB, *Polluted River Stretches for Restoration of Water Quality (Updated Version)*,
October 2025 - Table 3.17 and Annexure XIV.
**Producer:** `neer-vazhvu-api/scripts/build_pune_river_quality.py`
**Output:** `public/data/river-quality-pune.json`
**Refresh:** per assessment cycle.

**The report contradicts itself, and that is the story.** It classifies the Mula as *improved*
(Priority I in 2018 down to Priority II) on 2022-23 monitoring, while Annexure XIV of the same
document records 2024 BOD at the same stations - and station 2194, "River Mula at Harrison Bridge
near Mula-Pawana Sangam, Village Bopodi, Taluka Haveli, District Pune", reads **102.5 mg/L**.
Verified by reading the PDF text directly, not from a summary.

Ranked against the annexure itself: **756 locations tabulated, only 6 above 100 mg/L**, and the Mula
is one of them - above the worst 2024 Delhi Yamuna station (85.0, stn 1812) and above the Mithi at
Mahim (80.0, stn 2168). The five higher are 160.0 and 120.0 (Tamil Nadu), 150.0 (Bhella), 142.0
(Ghaggar, Punjab) and 116.0 (Yamuna).

**The gradient is the second story.** The Mutha leaves Khadakwasla at 4.1 mg/L, reads 32.5 at Deccan
Bridge, 35.0 at Sangam and 50.2 at Veer Savarkar Bhavan. The river does not arrive polluted.

Seven stretches (Mutha, Mula, Mula-Mutha, Pawana, Bhima, Indrayani, Ghod), 20 stations.

### Caveats

- **Two vintages, never merged.** The priority class rests on 2022-23 monitoring and is CPCB's formal
  classification; the 2024 BOD is a later measurement that has not been used to re-classify anything.
- **Every station carries `lat: null`.** CPCB names them and publishes no coordinates;
  `mpcb.ecmpcb.in/envtdata/<id>.php` geolocates only a partial set, frozen at 2019. The rivers map
  already guards a null coordinate, so readings render and markers do not. Inventing positions would
  be worse.
- **The 2015 edition's numeric column is STRETCH LENGTH IN KM, not BOD** (Indrayani 96, Mula-Mutha
  15, Mutha 12, Pawana 12, Bhima 200). Read as BOD those are catastrophic and wrong. Only 2018
  onward are comparable.
- **CPCB files two Pune city stations under "Bhima"** and its own label for the first reads "River
  Bhima at Pune (Mutha River)" - the board flagging that the water at Vithalwadi is the Mutha before
  it is anything else. Kept under CPCB's river name so the row can be found in the source.
- **Per-station COD is collected by MPCB and not published.** No surfactant or detergent measurement
  exists for the Indrayani, which matters because MPCB's attribution of the Alandi foaming to
  detergent is a position rather than a measurement, and PCMC attributes it to Chakan/Dehu/Talegaon
  industry instead. The page states the dispute rather than settling it.

---

## 6. Base geography - wards, water bodies, rivers, STPs

**Producer:** `neer-vazhvu-api/scripts/build_pune_geography.py`

### Wards - the vintage is the whole problem

**Source:** OpenCity `pune-wards-info` + PMC's 2026 election-results CSV.
**Output:** `public/geojson/pune-wards-2025.geojson` (41 features, all named).

OpenCity's dataset page carries **seven** ward files across four delimitations, and PMC has two
unrelated ward systems on top of that:

- **15 administrative ward offices** in 5 DMC zones. This is what PMC's own operational records key
  to - the STP layer has a `Ward_Offic` column, not a prabhag number.
- **Electoral prabhags**, redrawn at 76 (2012), 41 (2017), 58 (a 2022 draft that never went to poll)
  and 41 (2025).

We use the **2025 delimitation, 41 prabhags**, drafted 22 Aug 2025 on Census 2011 per Supreme Court
guidelines and used for the 2026 PMC election. Confirmed current by OpenCity's own
`pmc-election-results` CSV: 165 seat rows across exactly those 41 numbers (40 four-member wards plus
Ambegaon-Katraj with five).

**The join that must not be attempted.** The 2025 KML has **no ward names** - its only attribute is
`qwr`, a float ward number - so names come from the election CSV, 41 of 41. Do NOT instead join the
2025 polygons to the 2017 name list: both files have exactly 41 features so **the join succeeds
silently**, the first two names even agree (2017 ward 1 Kalas-Dhanori, 2025 ward 1
Kalas-Dhanori-Lohegaon), and it is wrong from ward 3 onward.

**Examined and rejected:** `PMC Electoral Wards 2012` (76 features) and `PMC Prabhag Boundary`
(72 features). Both carry the modern 15 ward-office names, which post-date the 2021 village mergers,
alongside 2017 prabhag names; `ward_no` runs 1-75 across 76 features and `prabhag_id` 1-66 across
72. Neither matches any single delimitation and both disagree with their own feature counts. No
defensible vintage could be established.

**No PCMC ward boundary exists publicly** - no OpenCity dataset, GeoServer login-walled (WFS/WMS
GetCapabilities 403, REST 401; the open WMTS carries five raster basemaps and no vector layer), and
OSM has no PCMC corporation polygon at all. This is why Pune is a `city` and not an MMR-style
`region`.

### Water bodies and rivers - OSM, and that is a finding

**Source:** OpenStreetMap via Overpass, bbox `18.3,73.4,18.95,74.05` (PMC + PCMC, wider than the ward
envelope because the dams the city drinks from sit well west of it).
**Outputs:** `public/geojson/pune-water-bodies-current.geojson` (791 polygons, 84 named, after
excluding 7 counted non-water-bodies), `public/geojson/pune-rivers.geojson` (8 rivers).
**Licence:** ODbL v1.0 - **share-alike**, so these are build fixtures, not part of the licence-clean
reference corpus.

**THE FETCH BBOX MUST STAY EQUAL TO `pune.bbox` IN `src/lib/cities/pune.ts`.** It did not. The fetch
box was `18.38,73.65,18.72,74.05` against a map frame of `18.3,73.4,18.95,74.05`, so the producer
covered about a third of what the reader can pan over. Everything west of 73.65 fell outside it, which
meant **Panshet, Warasgaon, Temghar, Pawana, Mulshi and Bhama Askhed were all absent from the layer** -
every reservoir Pune drinks from except Khadakwasla, missing from the city's own water-body map while
the dashboard's reservoir cards named them. Correcting it took the layer 484 -> 791 polygons and
64 -> 84 named, and added Andhra, Bushi, Gunjavani, Valvan, Shirota, Tungarli, Uksan, Kasarsai and
Tata besides.

The producer now **fails loudly if any of the six source reservoirs is absent**, and the guard carries
both spellings of two of them: OSM writes *Varasgaon* and *Pavana* where the WRD bulletin writes
Warasgaon and Pawana, and the first version of that check reported a false gap on exactly that. Same
trap as MAVAL/Mawal in IN-GRES.

Seven features are excluded and **counted on the artifact** rather than silently dropped: 3 swimming
pools caught by `water=pool`, plus a gym pool, a service reservoir ("PCMC Water Tank"), a
rainwater-harvesting sump and one pool carrying only `natural=water`. The tag test alone does not
catch the last four - three of them carry `water=reservoir`, the same tag Khadakwasla and Panshet
carry - so there is a name test too, kept narrow because **talav is a real water body here**. Ganesh
Talav and Lakaki Talav are lakes and a broader match for "tank" would delete them.

**PMC publishes no lake or tank layer at all.** Its only water-body file is `Pune River Map`: 12
polygons of river *channel*, three with a null REMARK and one with AREA=0. Katraj, Pashan,
Jambhulwadi, Manas and Bund Garden are all in OSM and in none of the PMC datasets probed.

**And no open vector lake register exists for Maharashtra**, which is why OSM is the source rather
than a preference. MRSAC, the state remote-sensing centre that would be the analogue of the open TNGIS
GeoServer behind Chennai's 70k tanks, does not resolve publicly: `mahagis.mrsac.gov.in` has no DNS
record and `mrsac.maharashtra.gov.in` times out. Bhuvan answers a WFS request with
`ServiceUnavailable: Service WFS is disabled` on both `bhuvan-vec1` and `bhuvan-vec2`, raster only.

The **First Census of Water Bodies (2018-19, Ministry of Jal Shakti)** does cover Maharashtra, and is
worth recording as a probed-and-rejected source rather than an unexplored one. 3,680 point records for
Pune district with area, depth, ownership and use. It is **not** a substitute for this layer on two
counts. Coverage: only **10 of the 3,680 sit inside PMC** and 45 in the district are urban at all - it
is a *minor irrigation* census that counts rural tanks and is effectively blind inside the city.
Enumeration: the condition columns are unfilled defaults - **3,679 of 3,680 "not encroached"**, 3,676
of 3,680 with use "Ground water recharge", 3,680 of 3,680 in use with none defunct, 3,679 of 3,680
man-made, and ownership 3,618 "State WRD" plus 62 "Co-operative" with no panchayat, municipal or
private row anywhere. Chennai's cut of the *same* census carries populated encroachment percentages
and original-versus-present storage, so this is a per-state enumeration difference. Publishing "3,680
water bodies in Pune" as coverage would be laundering an empty form.

If it is ever loaded, it belongs as a district irrigation-tank layer with that finding attached, and
note the licence fork: the copy carrying point geometry is OpenCity's, labelled Creative Commons
**Non-Commercial** (the encumbered bucket). data.gov.in is the better-licensed route and the one
Chennai already uses via `neer-vazhvu-api/app/scrapers/data_gov_in.py`, and it needs an API key the
repo does not currently hold.

Rivers are **merged from 44 OSM segments into one MultiLineString per river**. Shipping the raw
segments made React log a duplicate-key error per collision and the page header read "38 rivers".
`river_id` match order is load-bearing: "Mutha Right Bank Canal" contains "mutha" and was being
drawn as the river Mutha until the canal was tested first (20 segments mislabelled).

The canal is drawn deliberately. The Khadakwasla Complex is an irrigation project - 22.55 TMC of its
33.77 TMC of use is the irrigation provision - and Pune's water argument is unreadable without the
other claimant on the same water.

### STPs

**Source:** OpenCity `pune-sewage-treatment-plants` (PMC).
**Output:** `public/geojson/pune-stps.geojson` (20 features).

9 existing plants totalling **477 MLD** and 11 proposed totalling **396 MLD**. The proposed set IS
the JICA Mula-Mutha programme and its capacities sum to exactly the 396 MLD PMC and JICA both
publish independently - a check on the layer rather than a coincidence. MPCB's "416 MLD" is this 396
plus the Pune Cantonment Board's 20 MLD.

A 567 MLD existing-capacity figure also circulates and reconciles: it counts the 90 MLD Old Naidu
plant (commissioned Nov 1988), which CPCB's inventory marks non-operational and MPCB's table shows
with no inflow.

Data quality: `Year_of_Co` and `Utilized_C` are `-` on 19 of 20 rows and are emitted as null, never
as a false zero. The single populated row attaches Old Naidu's 1988 commissioning date to New Naidu.

**OpenCity answers HTTP 406 to a request with no `Accept` header**, which reads like a dead file.

---

## 7. Rainfall - IMD gridded, and the grid cell is a real decision

**Sources:** IMD 0.25-degree gridded daily rainfall via `imdlib`; Open-Meteo archive for the
provisional fill.
**Producers:** `generate_imd_rainfall.py --city pune --lat 18.5 --lng 74.0`,
`fetch_recent_rainfall.py --city pune`
**Outputs:** `public/data/imd-rainfall-monthly-pune.json` (1970-2025, 672 monthly records),
`public/data/rainfall-recent-pune.json`

Pune district carries a **4.7x west-east rainfall gradient** - IN-GRES's own per-taluka figure runs
Velhe 2,182 mm to Indapur 468 mm in the same year - so a quarter-degree is not a rounding error.

The nearer-**looking** cell at 18.5/73.75 sits 11 km west of the city centre, up the gradient toward
the Ghats, and returns a **1,099.8 mm** long-term mean. IMD's own Pune (Shivajinagar) observatory
normal is **841.2 mm** (Climatological Tables 1991-2020, station index 43063). That cell is **31%
high**.

The cell used, **18.5/74.0**, returns **805.3 mm** - within 4.3% of the observatory. Both were
generated and compared before choosing; the reasoning is recorded in `CITY_DEFAULTS` in the producer.
`rainfall-recent-pune.json` uses the **same** grid point, or the provisional months would not
continue the series they fill.

---

## 8. What Pune does not have, and why

| Absent | Reason |
|---|---|
| Flood-risk page | Maharashtra WRD publishes Pune's red (100-yr) and blue (25-yr) flood lines as **scanned PDF map sheets only** - 518 PDFs, zero shapefiles/GeoJSON/KML. `pdftotext` extracts no characters from the Mutha sheets. The event register is solid (1961 Panshet, 2019 Ambil Odha, 25 Jul 2024, 4 Aug 2024, 21 Aug 2025); the hazard layer does not exist machine-readable. |
| Tanker page | **Buildable and the highest-value remaining work.** PMC publishes a daily tanker register at `webadmin.pmc.gov.in/en/jsonapi/node/water_tanker` - 409 XLSX files since 25 Apr 2026, per filling point, with prabhag, recipient society, address, vehicle number and scheduled vs on-demand trips. Bund Garden logged 153 deliveries on 12 Aug 2026, Ramtekadi 424 on 13 Aug, and those are monsoon figures from two of at least seven points. Note the *structured* feed `node/water_tanker_information` is **broken** - 289 rows, 126 dated 2027-2035, 10 vehicles. |
| Groundwater figure from PMC | **PMC publishes none and says so**: its accounts "do not include groundwater sources (e.g. borewells), private tanker supply or other alternative sources", and its 2025-26 ESR *recommends creating* seasonal borewell monitoring, city groundwater maps and a licensing regime. The only municipal survey is a 320-borewell pilot across five clusters. The independent estimate is ACWADAM's (2019): ~4 TMC/yr from 80,000-125,000 borewells, about a quarter of formal supply - carried as a modelled NGO estimate, never as a measurement. |
| Lost-water-bodies register | No official register of Pune's lost or encroached water bodies exists. |
| Allocation ledger | The instrument chain is unusually well documented, but the ledger's primitive is entitled-vs-**received**, and no measured annual draw has been published since 2017-18 - a year for which the utility and the regulator disagree by 4.15 TMC. |
| Origins page | Narrative work, not a data gap. The material is strong: the 12 July 1961 Panshet breach that flooded half the city and **has no official death toll by the state's own admission** in its current disaster plan, through the Khadakwasla chain to the 2025 entitlement remittal. |
| PCMC coverage | See §6. No public ward boundary in any form. PCMC does publish its own ESR series back to 2012-13 at `pcmcindia.gov.in/cms_upload/download_data/` (note: the on-page hrefs include `admin/` and 404 - strip it), so a future PCMC pass has a source. |

Other dead ends, so nobody re-probes them: LGD is CAPTCHA-walled on every route; MPCB's OCEMS portal
(`onlinecems.ecmpcb.in`) serves zero public effluent data anywhere in Maharashtra; PMC's operations
portal `amrmeter.online` is login-walled.
