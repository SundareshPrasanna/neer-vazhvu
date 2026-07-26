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
  **ignores the printed total** and recomputes from the individual rows against an explicit
  `is_city_source` set, so the set stays under our control if HMWSSB adds another source.
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
- **Nagarjuna Sagar and Srisailam are context, not supply.** They are the parent Krishna storages
  upstream of Akkampally and consistently report a city drawl of 0.000 MLD. Counting them as city
  sources would double-count the Krishna leg. They are kept because their level is the real
  constraint on Akkampally.
- **Politeness:** this is a government IIS box. The backfill runs at `--sleep 0.25` by default.

### Upstream data-entry errors in the archive - 36 rows in 35,975 (0.10%)

The 12.5-year archive contains a small number of genuine HMWSSB typos. They are
**not parse errors** - the feed's own `level_prev_day` column proves it in every case - and they are
quarantined in two stages rather than silently dropped or silently kept. All excluded rows are
preserved in the artefact's `_excluded_levels` block with the reason, so nothing is lost.

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

**City draw has grown ~136% in twelve years.** Mean daily draw across the six city sources, by
calendar year: 2014 **1,116.6** MLD, 2015 1,120.0, 2016 1,174.4, 2017 1,384.3, 2018 1,509.0,
2019 2,066.6, 2020 2,013.2, 2021 2,362.9, 2022 2,028.9, 2023 2,497.4, 2024 2,597.0, 2025 2,618.9,
2026 **2,636.4** (to 25 Jul). Every year is a full 365/366-day mean except 2026 (206 days).

**The GO 111 question.** GO 111 (1996) barred major construction across the catchment of Osman
Sagar and Himayat Sagar; Telangana repealed it in 2022, on the stated ground that the city no longer
depends on the twin reservoirs. The utility's own drawl column tests that directly:

| Year | Twin draw (MLD) | Total city draw (MLD) | Twin share | Days drawn |
|---|---|---|---|---|
| 2014 | 123.5 | 1,116.6 | 11.06% | 365/365 |
| 2015 | 74.6 | 1,120.0 | 6.66% | 365/365 |
| 2016 | 8.4 | 1,174.4 | 0.72% | 154/366 |
| 2017 | 9.6 | 1,384.3 | 0.70% | 107/365 |
| 2018 | 0.0 | 1,509.0 | 0.00% | **0/365** |
| 2019 | 97.3 | 2,066.6 | 4.71% | 342/365 |
| 2020 | 46.1 | 2,013.2 | 2.29% | 366/366 |
| 2021 | 79.9 | 2,362.9 | 3.38% | 365/365 |
| 2022 | 83.1 | 2,028.9 | 4.10% | 365/365 |
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
