# Data Sources - Hyderabad

> Where each Hyderabad dataset comes from, how often it refreshes, and what to watch out for.

Hyderabad is the sixth city under onboarding (config registered `enabled: false`, branch
`hyderabad-onboarding`). The full pre-onboarding research lives in the private research repo
(`docs/research/hyderabad-kolkata-onboarding-research-2026-07.md`, compiled 2026-07-26, with raw
evidence artefacts under `docs/research/hyd-kol-evidence/`). **This file documents only what has
actually been ACQUIRED into the repo, as it lands.** The Madurai documentation principle applies:
hedge absence claims ("no known public X"), name every gap.

Supply model in one line: HMWSSB draws from six impounded sources - the Nizam-era twins on the Musi
(Osman Sagar, Himayat Sagar), the Manjira system (Singur, Manjira), the Krishna leg (Akkampally,
balanced off Nagarjuna Sagar) and the Godavari leg (Sripada Yellampally) - and publishes the daily
draw-off from each.

**Scope note that shapes everything else:** GHMC was trifurcated on 11 Feb 2026 into GHMC (150
wards), Cyberabad (76) and Malkajgiri (74). Despite that, Hyderabad is modelled as a **standalone
city**, not a region: the three corporations sit under **one** water utility (HMWSSB), so the water
story is unitary. Only ward surfaces carry a scope badge. See the comment block at the top of
`src/lib/cities/hyderabad.ts` for the full reasoning.

**Network constraint:** `cpcb.nic.in` refuses TCP from non-India IPs, confirmed 2026-07-26. Any
scraper touching CPCB (NWMP river quality, polluted river stretches for the Musi) must run from the
India-IP path (the local scheduled-job pattern used for CMWSSB/Pravah/KWRIS), never from CI runners.
HMWSSB, TGDPS, `lakes.hmda.gov.in`, India-WRIS and OpenCity are all reachable from anywhere.

## HMWSSB daily reservoir statement

| | |
|---|---|
| **Source** | Hyderabad Metropolitan Water Supply and Sewerage Board, "Statements of WaterLevels in Reservoirs" |
| **URL** | `https://bms.hyderabadwater.gov.in/wlrreport/showreport1.aspx` |
| **Discovery** | The page linked from HMWSSB's nav ("More > Water levels in Reservoirs") is only a wrapper; the report is the iframe target above. |
| **Script** | `neer-vazhvu-api/scripts/scrape_hmwssb_reservoirs.py` |
| **Frequency** | Daily. Today's statement is not filed until some point during the day - an empty result for today is normal, not an error; the script walks back up to 7 days to find the latest. |
| **Archive** | **01-Jan-2014 to present** (01-Jan-2013 and earlier return "No Records Found"), backfillable by date iteration. |
| **Licence** | Government of Telangana public disclosure; attribute "HMWSSB daily reservoir statement" with the URL on every rendering surface. |

**Why this feed matters:** it is the richest reservoir feed on the platform. It carries **today's
draw-off in MLD** and **today's inflow in TMC** per reservoir, plus the level and storage on the
**same date last year**. Chennai's CMWSSB gives level and storage; Mumbai's Pravah gives storage
only, which is why Mumbai's hero has to collapse its three rain scenarios into one line. Hyderabad
can run the full interactive `days-left` hero with a **measured** divisor rather than an assumed
one, and gets a year-on-year series for free.

Columns per row: FTL, storage capacity at FTL (TMC), level on previous day, today's level, today's
capacity (TMC), today's drawl (MLD), today's inflows (TMC), last-year level on same date, last-year
capacity on same date.

**Handling notes (do not skip if re-running):**

- **The date format is `dd-MMM-yyyy` and nothing else.** `25/07/2026` and `07/25/2026` both return a
  well-formed page reading "No Records Found" - a wrong format is indistinguishable from a date with
  no data. Same failure shape as the India-WRIS blank-`districtName` trap. `_fmt_date()` is the only
  place in the script that formats a date; keep it that way.
- **The summary row is mislabelled.** It reads "Total(1 to 5)" but is not the sum of rows 1-5: on
  25-Jul-2026 it printed 2,659.493 MLD while rows 1-5 sum to 1,922.632, the difference being exactly
  Yellampally (row 8, 736.861 MLD). The label predates the Godavari source being added. The script
  **ignores the printed total** and recomputes from the individual rows, so the set stays under our
  control if HMWSSB adds another source. Note the Krishna chain needs `max()`, not `sum()` - see below.
- **Levels are mixed-unit**, declared per row by the source: `AkkamPally[Krishna](M)` is metres,
  every other row is feet. `RESERVOIRS` in the script pins the unit per source and `--check-units`
  validates the pin. Validated 2026-07-26 over the 2022-09-01..2022-10-10 monsoon window: all eight
  reservoirs land at max(level)/FTL between **0.997 and 1.000**, and Osman Sagar, Himayat Sagar,
  Nagarjuna Sagar and Srisailam each touch FTL exactly. That proves level and FTL share a scale
  (so storage percentages are sound); it does **not** prove the absolute unit, which we take from
  the feed's own declarations. Yellampally's 485.560 reads as feet (= 148.0 m, a plausible Godavari
  barrage elevation) rather than 485 m, but that inference is not independently confirmed - confirm
  against Telangana I&CAD before publishing a level in feet for Yellampally. Storage and percentage
  figures are unaffected either way.
- **The Krishna chain needs `max()`, not `sum()`.** Akkampally is a balancing reservoir fed from
  Nagarjuna Sagar, fed in turn from Srisailam: one physical draw, booked inconsistently. Normally
  Akkampally carries it and the parents read 0.000, which is why the parents are not primary
  drinking sources. But **Nagarjuna Sagar carries the full ~1,254 MLD on 15 of 4,514 days** and
  Srisailam on 7 of 4,444, and on **18 days both report a figure** - sometimes the identical one
  (2016-05-07: Akkampally and Nagarjuna Sagar both 1,116.807 MLD). So summing only the flagged city
  sources understates by up to ~47% of a day's total, while summing everything double-counts. The
  script takes the max across the chain, which is correct in both cases and conservative in the
  ambiguous ones. 21 of 4,589 days (0.46%) are affected - small, but they are exactly the days a
  runway chart would otherwise show as an inexplicable cliff.
- **Politeness:** this is a government IIS box. The backfill runs at `--sleep 0.25` by default.

### Upstream data-entry errors in the archive

The 12.5-year archive contains a small number of genuine HMWSSB errors. They are **not parse
errors** - the feed's own `level_prev_day` column identifies them - and they are quarantined rather
than silently dropped or silently kept. Every excluded row is preserved in the artefact's
`_excluded_levels` block with its reason, so nothing is lost. Totals across 35,975 raw rows:

| Problem | Rows | Effect |
|---|---|---|
| Duplicate renders (whole table emitted twice on 16 dates) | 118 | deduplicated; 15 fields disagreed and are reported |
| Implausible level (physical envelope) | 23 | `level_today` nulled |
| Implausible level (one-day spike) | 13 | `level_today` nulled |
| Implausible capacity (>2x capacity-at-FTL) | 14 | `capacity_today_tmc` + `storage_pct_ftl` nulled |

Left unfixed, the duplicates alone produced **91 primary-key collisions** against
`reservoir_daily_v2`'s `(city_id, source_code, date)` key, which an upsert would have silently
absorbed, and 8 rows violated the `storage_pct_frl NUMERIC(5,2)` ceiling of 999.99.

**Stage 1, physical envelope (23 rows).** A level outside 0.5-1.05x its own FTL is not a low
reservoir, it is a data-entry error. Four failure modes seen:

- **decimal-point slips** - `osman_sagar` 2017-02-28 level `1780840.0` against a previous day of
  `1780.86`; `himayat_sagar` 2019-05-05 level `1745100.0` against `1745.2`; `akkampally`
  2018-01-20 level `243100.0` against `243.45`.
- **unit flips** - `singur` 2019-09-04 level `509.16` against a previous day of `1670.554` ft, and
  1670.554 ft *is* 509.18 m. The source printed metres in a feet column for a day.
- **column duplication** - on 2019-08-09 both `srisailam` and `yellampally` printed level equal to
  capacity (181.83 and 19.31 respectively).
- **cross-row contamination** - `nagarjuna_sagar` 2021-11-09 level `862.9` and 2026-02-14 level
  `870.9`, both Srisailam-scale values (FTL 885) in a reservoir whose FTL is 590.

**Stage 2, one-day spike filter (13 rows).** The envelope cannot catch a single-digit substitution
that lands inside it. Their signature is unmistakable: the value spikes for exactly one day, reverts
the next, and the gap is a **round number** because one digit changed in a fixed decimal position -
`1753.3 -> 1453.3 -> 1753.28` (300.0), `817.7 -> 517.7 -> 817.6` (300.0), `1756.7 -> 1576.7 ->
1756.7` (180.0), `1796.136 -> 1696.097` (100.0). A reading is rejected if it differs from **both**
neighbours by more than 3% of FTL in the same direction; a genuine step change (gates opened,
monsoon inflow) differs from only one neighbour and survives.

**Stage 3, capacity envelope (14 rows).** The capacity column carries the same family of errors,
and they matter more: `storage_tmc` is the days-left **numerator**, so a bad capacity corrupts the
runway itself. Same shapes - cross-column contamination (`osman_sagar` 2023-10-30 capacity
**485.588 TMC** against a capacity-at-FTL of 3.9, and 485.588 is *Yellampally's FTL*;
`akkampally` 2025-12-25 capacity 248.54 against 1.499, which is an Akkampally *level* in metres) and
decimal slips (`srisailam` 2017-07-16 capacity 20,160.0 against 215.807). The threshold is
deliberately loose at **2x** capacity-at-FTL: a reservoir genuinely can exceed its live capacity
during a flood surcharge, so `manjira` at 1.3x and `srisailam` at 1.2x are **retained**. Nothing
physical explains 3.7x and above, and every rejected row sits at 3.7x or higher.

Effect on the retained series: every reservoir's p99 level now sits at 0.999-1.000 of FTL, and the
minima become physically sensible - Osman Sagar's series minimum moves from 1453.3 (below the
reservoir bed) to 1744.8, Himayat Sagar's from 1576.7 to 1726.34, Srisailam's from 517.7 to 774.8.

**Storage, capacity and drawl columns are unaffected** by either filter - only `level_today` is
nulled - so the days-left maths and the draw series use the full record.

### Silent capacity revision, 01-Jul-2026 - watch this

Bisected against the archive, HMWSSB changed the "Storage Capacity at FTL" for the twin reservoirs
between **30-Jun-2026 (old value)** and **01-Jul-2026 (new value)**:

| Reservoir | to 30-Jun-2026 | from 01-Jul-2026 | change |
|---|---|---|---|
| Osman Sagar | 3.900 TMC | 3.518 TMC | -9.8% |
| Himayat Sagar | 2.967 TMC | 2.521 TMC | -15.0% |
| Singur / Manjira / Akkampally | unchanged | unchanged | - |

Probed at 15-Apr, 01-May, 15-May, 01-Jun, 15-Jun, 16-Jun, 20-Jun, 24-Jun, 26-Jun, 28-Jun and
30-Jun-2026 (all old) and 01-Jul-2026 (new), plus every sampled date back to 2014 at the old value.

**The cause is UNCONFIRMED and must not be described as siltation without a GO.** It lands exactly on
the 1 July water-year boundary, so it could equally be a capacity re-survey, a gross-vs-live
redefinition, or a correction. What is certain is the consequence: any `days-left` denominator
cached before 1 Jul 2026 is now wrong by 10-15% for the twins. A Headwaters detector watches this
column.

### What the feed already shows

Two findings computed entirely from this one source, with no other data required.

**City draw has grown ~136% in twelve years.** Mean daily draw, by calendar year:
2014 **1,116.6** MLD, 2015 1,120.0, 2016 1,177.7, 2017 1,384.3, 2018 1,509.0, 2019 2,043.6,
2020 1,966.8, 2021 2,362.9, 2022 2,032.4, 2023 2,497.4, 2024 2,597.0, 2025 2,618.9,
2026 **2,636.4** (to 25 Jul). Every year is a full 365/366-day mean except 2026 (206 days).

Trailing 365 days to 25-Jul-2026: mean **2,628.4** MLD, median 2,647.0, range 1,862.2-4,339.0.
The 1,862.2 minimum is a genuine low-draw day, not an artefact - it survives both the
Krishna-chain correction and deduplication.

**The GO 111 question.** GO 111 (1996) barred major construction across the catchment of Osman
Sagar and Himayat Sagar; Telangana repealed it in 2022, on the stated ground that the city no longer
depends on the twin reservoirs. The utility's own drawl column tests that directly:

| Year | Twin draw (MLD) | Total city draw (MLD) | Twin share | Days drawn |
|---|---|---|---|---|
| 2014 | 123.5 | 1,116.6 | 11.06% | 365/365 |
| 2015 | 74.6 | 1,120.0 | 6.66% | 365/365 |
| 2016 | 8.4 | 1,177.7 | 0.71% | 154/366 |
| 2017 | 9.6 | 1,384.3 | 0.70% | 107/365 |
| 2018 | 0.0 | 1,509.0 | 0.00% | **0/365** |
| 2019 | 96.3 | 2,043.6 | 4.71% | 342/365 |
| 2020 | 45.0 | 1,966.8 | 2.29% | 366/366 |
| 2021 | 79.9 | 2,362.9 | 3.38% | 365/365 |
| 2022 | 83.1 | 2,032.4 | 4.09% | 365/365 |
| 2023 | 81.1 | 2,497.4 | 3.25% | 365/365 |
| 2024 | 111.8 | 2,597.0 | 4.31% | 366/366 |
| 2025 | 165.6 | 2,618.9 | 6.32% | 365/365 |
| 2026 | 172.5 | 2,636.4 | 6.54% | 206/206 |

The honest reading, which is the more interesting one:

- The premise was **not fabricated**. In 2018 the twins supplied nothing at all for a full year, and
  in 2016-17 they ran on fewer than half the days at under 1% share. Anyone looking at the feed
  around then would reasonably have called them redundant.
- But the trend has run the other way ever since. Twin draw in **2026 (172.5 MLD) is the highest in
  the entire record**, above even 2014, and the share has risen every year since 2023. The twins
  have been drawn on **every single day** since 2020.
- **Correlation, not causation.** The rise since the 2022 repeal may reflect restored capacity,
  better monsoons, or demand growth rather than anything caused by the repeal. State the series;
  do not claim the repeal caused it.

Caveats to carry into any published version: the twin share is small in every year (peak 11.06% in
2014, 6.54% now), and the totals here exclude Nagarjuna Sagar and Srisailam, which report a city
drawl of 0.000 MLD throughout.

## Layers acquired since the reservoir spine

All landed 2026-07-26. Each names its script; provenance and licence are in the artefact's own
`_source` / `_licence` block.

| Layer | File | Script | Scale |
|---|---|---|---|
| OSM water bodies | `public/geojson/hyderabad-water-bodies-current.geojson` | `scripts/fetch-water-bodies-osm-hyderabad.ts` | 669 polygons, ~10,599 ha |
| HMDA gazetted lake register | `public/data/hyderabad-lake-register.json` | `neer-vazhvu-api/scripts/fetch_hmda_lake_register.py` | 2,978 lakes; 1,352 finally notified |
| HMWSSB tankers | `public/data/hyderabad-tankers.json` | `neer-vazhvu-api/scripts/build_hyderabad_tankers.py` | 1,316,215 bookings, 201 sections |
| CGWB groundwater wells | `public/data/hyderabad-cgwb-stations.json` | `neer-vazhvu-api/scripts/build_hyderabad_cgwb_stations.py` | 481 wells, 10,724 monthly readings |
| TGDPS weather stations | `public/data/hyderabad-aws-stations.json` | `neer-vazhvu-api/scripts/fetch_tgdps_stations.py` | 161 in-city AWS with coordinates |
| Rivers (Musi, Esi, Manjira, Haldi) | `public/geojson/hyderabad-rivers.geojson` | `scripts/fetch-rivers-osm-hyderabad.ts` | Musi ~244 km, Esi ~10 km |
| GHMC nalas | `public/geojson/hyderabad-nalas.geojson` | `neer-vazhvu-api/scripts/build_hyderabad_opencity_layers.py` | 96 nalas, 245 km |
| Waterlogging points | `public/geojson/hyderabad-waterlogging.geojson` | same | 23 GHMC points |
| Jal Dharohar census | `public/geojson/hyderabad-water-census.geojson` | same | 3,116 points |
| GHMC tanks | `public/geojson/hyderabad-tanks-opencity.geojson` | same | 847 features |
| GHMC canals and drains | `public/geojson/hyderabad-canals-drains.geojson` | same | 3,960 segments |
| Allocation ledger | `public/data/allocations-hyderabad.json` | authored | 4 arrangements, 8 events |
| Commitments register | `public/data/commitments-hyderabad.json` | authored | 7 commitments |
| Facts | `public/data/facts-hyderabad.json` | authored | 17 facts |

### Findings and gaps these produced

- **Lake register, by district.** Rangareddy holds the largest lake estate (891) and has among the
  weakest legal coverage at **34.5% finally notified**, against Siddipet 68.0% and Hyderabad
  district 66.7%; Yadadri-Bhongiri is worst at 15.2%. Rangareddy is the ORR growth corridor.
  Final notifications by year: 2016: 152, 2017: 10, 2019: 60, 2020: 2, 2021: 3, 2023: 2,
  **2024: 533, 2025: 533**, 2026: 57 - two-thirds of all final notifications ever issued arrived
  in the two years after HYDRAA was created.
- **Tankers: the fulfilment metric is a dead end, and that is the finding.** HMWSSB delivered
  1,315,622 of 1,316,215 bookings (99.95%); the worst of 201 sections is 98.4%. The signal is
  demand instead - a **3.0x** seasonal swing (Jun 90,946/month vs Oct 30,421) and a geography that
  cuts against expectation: Madhapur (135,332), Kondapur (125,555), Hafeezpet (79,150),
  Gachibowli, Manikonda, Nizampet, KPHB, plus Banjara Hills and Jubilee Hills. The western IT
  corridor, not the old city. Two upstream gaps: the series stops Feb 2024, and **Dec 2022 is an
  11-byte empty file at source**.
- **Nala encroachment columns are published EMPTY.** GHMC's drain layer defines `Govt_Encr`,
  `Pvt_Encr`, `Rel_Encr`, `Total_Encr` and `Court_Case`, and all five hold "0" for all 96 nalas -
  one distinct value, zero non-zero entries, while `Length_m` carries 94 distinct values. **This
  must never render as "zero encroachments"** in the city that created HYDRAA to demolish them.
  The fields are stripped from the artefact and the build asserts the condition, so if GHMC ever
  populates them the change surfaces.
- **Groundwater is denser than first assessed.** An early narrow-window probe suggested ~15
  stations in Hyderabad district; the full pull returns **481 wells** (Ranga Reddy 192, Medak 173,
  Hyderabad 48, Siddipet 44, Vikarabad 24), so the metro core alone has ~240 - Delhi's density.
  Two handling notes: families must be derived **generically** from the code prefix (Delhi's
  classifier hardcoded `AAXI`/`CGWB`, so `CGWHYD*` fell into the numeric catch-all and a clean
  split looked incoherent), and a station with 2 readings must not vote on a 322-station family's
  sign convention. `CGWHYD*` (122) and `TSCGWB*` (37) are negative-down; numeric NHN codes are
  positive-down. **Never `abs()`.**
- **TGDPS station count is unresolved.** The network's summary table reports 185 AWS inside
  GHMC_CMC_MMC, the image map exposes 162 hotspots, and 161 parse with coordinates. We publish
  what resolves to a point. `values.jsp` returns only the latest reading with no archive, so the
  series accumulates from first collection; historical bulk is on data.telangana.gov.in.
- **The Esi is under-mapped, not minor.** OSM carries a single 10 km way for the river Himayat
  Sagar impounds, against 244 km for the Musi - and the Musi appears under three name variants
  that must be merged. A gap in the public map, not a fact about the river.

## Registered but not yet acquired

Research-complete and URL-verified as of 2026-07-26, but not yet ingested. Each graduates into this
file when its data actually lands in the repo.

- **TGDPS rainfall network** (`https://tgdps.telangana.gov.in/`) - 1,097 AWS statewide, of which
  **185 sit inside GHMC_CMC_MMC**. Per-station endpoint `values.jsp?s1=<awsId>` returns location,
  mandal, lat/long, daily cumulative rainfall, temperature, humidity and wind, as plain HTML with no
  auth. This would give Hyderabad a **measured intra-city rainfall surface at 185 points**, where
  every other city interpolates from a single IMD 0.25-degree grid cell.
- **HMDA gazetted lake register** (`https://lakes.hmda.gov.in/`) - 2,978 lakes with preliminary and
  final FTL notification dates; the whole register renders in a single 4.2 MB page. Only **1,352
  (45.4%) carry a final notification**. Per-lake FTL/cadastral/buffer sheets are **scanned raster
  PDFs** with no extractable text, so the tractable route is OCR of the fixed-position "LAKE DETAILS"
  title block (area at FTL, FTL elevation, perimeter, bund length, survey date), not polygon
  digitisation.
- **HMWSSB tanker data** via OpenCity (`hyderabad-water-supply-through-tankers-data`) - 26 monthly
  CSVs, Jan 2022 to Feb 2024, schema `year,month,division,section,noofbookings,delivered`. Bookings
  **and** deliveries per HMWSSB division and section, which yields a booking-to-delivery fulfilment
  rate no other city can produce. Series stops Feb 2024 - named gap.
- **OpenCity Hyderabad holdings** (71 datasets) - `hyderabad-sewage-lines-map` (sewer network GIS),
  `hyderabad-canals-drains-and-tanks-lakes`, `hyderabad-and-telangana-water-bodies-census-data`
  (the Jal Dharohar leg), `hyderabad-hmwssb-water-connections-data`,
  `hyderabad-hwssb-billing-and-collection-data`, `hyderabad-microwatersheds-map`,
  `flooding-locations-in-hyderabad`, `hyderabad-slums`.
- **India-WRIS Ground Water Level API** - telemetric and **live to 2026-06-04** (unlike Delhi's,
  which stopped 2025-09-20). Watch the district-name trap: WRIS carries a partly pre-2016 district
  set, so `Ranga Reddy`, `Medak`, `Siddipet` and `Vikarabad` return data while `Medchal-Malkajgiri`,
  `Sangareddy` and `Yadadri Bhuvanagiri` return zero rows. Probe a **wide** date window first; a
  narrow one is indistinguishable from "no stations".
- **IN-GRES** (`ingres.iith.ac.in`) - standing decision for groundwater assessment; Telangana
  mandal-level pull not yet built.
- **Telangana Open Data Portal** (`data.telangana.gov.in`) - **DKAN, not CKAN**. API base `/api/1`;
  `GET /api/1/search?fulltext=<q>` works. The OpenCity CKAN recipe does not transfer.

## Known gaps and blockers

- **300-ward geometry is not public.** The delimitation was gazetted 25 Dec 2025 but only the
  superseded 150-ward GHMC 2022 KML exists publicly (OpenCity `hyderabad-wards-info`; complete and
  clean for that vintage - 155 placemarks, ward numbers 1-150, none missing, with ward/CIRCLE/ZONE
  attributes). `my-ward`, ward profiles and any per-ward composite stay off until it lands.
- **No sitting councillors.** The three corporations are under a Special Officer with elections
  pending, so ward representatives is an honest empty state, not a gap to backfill.
- **Sewerage/STP figures are not usable yet.** Public numbers are mutually inconsistent across
  sources (772 MLD from 25 STPs, 45 STPs at 1,878 MLD, 38 STPs, 39 under AMRUT 2.0). **None is used.**
  Get HMWSSB's RTI 4(1)(b) disclosure or an annual report first.
- **HMWSSB service-area basics are news-sourced only** (~1,480 sq km, 1.68 crore population,
  ~1,954 MLD supplied, Core Urban Region 2,053 sq km). Not used until primary-confirmed.
- **Telangana state remote-sensing WebGIS is login-gated** (`tgrac.telangana.gov.in`) - including
  "Water Bodies (ORR): Encroachment of Water bodies from 2014 onwards", which would be an
  exceptional lake dataset. RTI or partnership ask, not a scrape.
- **Musi river quality needs the India-IP runner** (CPCB blocked). TGPCB is an unprobed alternative.
- **Patancheru-Bollaram pharmaceutical effluent / AMR** is researched only to NGO-report level. The
  government-grade route is CPCB's Comprehensive Environmental Pollution Index for critically
  polluted clusters, plus TGPCB monitoring. Deserves its own research pass.
