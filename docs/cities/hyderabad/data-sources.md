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
