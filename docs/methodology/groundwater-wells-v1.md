# Groundwater well data: sources, cleaning and status

Version 1 - Neer Vazhvu - October 2026

The platform's groundwater record is built on wells. No satellite measures an
aquifer's depth, thickness or volume, so satellite products enter only as
direct surface observations or as tested covariates, never as a stand-in for
the water table. This note sets out where Chennai's well readings come from,
the rules every series passes through, and what each reading's status means.

## 1. Sources (Chennai)

| Source | What it is | Coverage | Where it lands |
|---|---|---|---|
| CMWSSB ward water-level loggers | One logger per GCC ward, two readings a day | 18 Aug 2020 to date | `groundwater_dwlr_daily` |
| OpenCity ward-wise groundwater | CMWSSB's ward table, monthly | Jan 2021 to Mar 2024 | `groundwater_monthly` |
| NWDP groundwater telemetry | CGWB and Tamil Nadu state stations, six-hourly | to date | `groundwater_wris` |
| IN-GRES | CGWB's dynamic groundwater assessment, per taluk | editions to 2025-26 | `public/data/gwr-blocks.json` |

### CMWSSB's monitoring portal

The portal is at `http://111.93.109.166/CMWSSB-web`, linked from
cmwssb.tn.gov.in. It answers in two ways, and only one is dependable:

- `getWaterlevel` returns a logger's latest reading **before** the date asked.
  Ask for 5 October and the answer is 4 October's last reading, or an older
  one if the logger missed a day. A reading's date is always taken from the
  answer, never from the question. A call takes about 7 seconds; a logger with
  no recent reading can hold it past a minute.
- The report pages list every reading as an `.xls`, but on this host the
  all-depot day report does not return and the one-depot range report answers
  "No record found" for most requests, including ranges that hold readings
  (tested 5 October 2026).

`122.183.188.248:8080`, the address in older write-ups, is a test copy whose
values are identical to the live host and stop on 6 September 2021. Its day
reports did work: the 386 saved there on 5 October 2026 (17 August 2020 to
6 September 2021, every depot, twice a day) are the only full-resolution
record of the network's first year.

What the record can hold, then:

| Period | Resolution | From | State (5 Oct 2026) |
|---|---|---|---|
| Aug 2020 to Sep 2021 | two readings a day | test-copy day reports | archived |
| Oct 2021 to Sep 2026 | the last reading of each month | live host, asked on the 1st (`--history`) | not yet collected |
| from the daily job's first run | the last reading of each day | live host, asked daily | starts with the job |

On 5 October calls took 7 to 11 s, and during a `--history` run calls for
loggers that had answered in 10 s began to time out at 60 s, so the run was
stopped. The month-end history is better asked of CMWSSB as an export than
pulled through a public page one call at a time.

Every answer is saved gzipped and unchanged, with a manifest line (URL, time
fetched, SHA-256), before it is parsed. The table is rebuilt from that archive.

**Depot number is ward number.** CMWSSB's Area N is GCC Zone N, and every
area's depots run over that zone's ward range. Five depots (wards 22, 168,
169, 181 and 182) sit in the zones of the older ward-to-zone table that GCC
corrected in 2022. The loggers went in during 2020, so their ward numbers are
the 2011-era wards; most boundaries carried over to the 2022 delimitation, but
a ward join should be read with that in mind.

### OpenCity's ward table

Two fixes made in October 2026: wards 168 and 169 have no serial number in any
year's table and were being skipped, so the ward is now read from the depot
number when the serial is blank. Cells reading `GL` (water at ground level, 21
in 2021, most in November after the floods) are now read as 0 m rather than
dropped.

OpenCity's monthly value is the loggers' month-end reading. On the 1,537
ward-months both cover (January to August 2021, loggers with at least 15
measured days that month), OpenCity differs from the last day's logger value
by a median of 0.07 m, with 80% within 0.25 m; against the monthly mean the
median difference is 0.20 m. A month-end history pulled from the portal
therefore continues OpenCity's series like for like.

### IN-GRES taluk names for Chennai

Chennai's assessment units are matched by area, not by name. In the 2022-23,
2023-24 and 2024-25 editions IN-GRES prints the taluk names one place out of
step with their areas from Madhavaram on; in 2025-26 the same areas carry
their true names:

| Area (ha) | Name in 2022-23 to 2024-25 | Name in 2025-26 |
|---|---|---|
| 3,613 | Kolathur | Madhavaram |
| 3,268 | Madhavaram | Maduravoyal |
| 1,437 | Maduravoyal | Mambalam |
| 7,068 | Purasaivakkam | Sholinganallur |
| 5,588 | Sholinganallur | Thiruvottiyur (5,303 ha) |
| 2,077 | Tondiarpet | Velacheri |

The WRIS series already carried the true names; matching by area reproduces
its 2022-23 and 2023-24 values to 0.1 ham. The 2025-26 edition assesses 17
units (Kolathur, 700 ha, carved out of Ayanavaram; Thiruvottiyur 285 ha
smaller) and is held until polygons for that set are in the repo.

## 2. Rules every well series passes through

Shared code: `neer-vazhvu-api/app/scrapers/well_levels.py`.

1. **Placeholders out.** The WIMS feeds write 0.0 and 1.0 for a missed
   reading; CMWSSB's loggers write 0.000.
2. **Sign per station.** Depth is read in the station's own convention, taken
   from its median, never with `abs()`. Most feeds publish depth as negative
   below ground, and some flip sign mid-series.
3. **Physical envelope.** Depth must sit between -5 and 200 m below ground, the
   same envelope the district atlas uses. This replaced a 50 m cut that dropped
   real deep borewells.
4. **No above-ground readings in deep wells.** In a well whose median depth is
   over 2 m, a reading above ground is a sign-flipped record.
5. **Spikes out.** A logger reading more than 10 m from its station's median
   over the 15 days either side is dropped (CMWSSB depot 4 read 51.5 m at
   18:00 on 1 June 2021, against 3.8 m that morning).
6. **Stuck sensors marked.** A logger that has moved under 10 cm across 60
   days, with at least 30 days of readings in that window, is marked stuck.

Two things the first year of CMWSSB readings shows, both handled by these
rules: runs of 0.000 inside series that read 2 to 17 m either side (14 wards),
and positive readings in many loggers' first months in 2020 (wards 18 to 33
among others) in series that read negative afterwards; those become
not-measured days.

## 3. Status of a reading

| Status | Meaning | Stored value |
|---|---|---|
| measured | Water level read and passed the rules | Depth in metres below ground |
| stuck | Under 10 cm movement in 60 days | Value kept, left out of statistics |
| not_measured | The day's readings all failed the rules | Null |
| dry | Water below the bottom of the well | Null; well depth kept as a lower bound |
| stale | No reading for the day | No row |

Unknown values are null, never zero. Statistics treat dry readings as
censored: "at least X m" with the count of dry wells, never a median that
quietly leaves them out.

**Dry wells in Chennai today.** None of Chennai's machine-readable feeds record
a dry well: the NWDP manual series for Chennai, Tiruvallur, Chengalpattu and
Kancheepuram carried no dry marker in the rows read in October 2026 (the first
5,000 per district), and OpenCity's ward table has none in any year. A logger
whose water falls below its sensor would read a constant and be marked stuck,
and the sensor depths are not published, so the two cannot be told apart. The
one Chennai source that records "Dry" is CMWSSB's 2020 manual observation-well
table (`generateYearlyPDF?year=2020`), which predates the loggers.

## 4. Open items

- CMWSSB logger metadata (well depth, sensor depth, install date) is not
  published; it would separate dry from stuck.
- CMWSSB's logger history from October 2021 (see section 1).
- The raw archive lives on the machine that runs the daily job; a second,
  off-machine copy is not yet set up.
- The CMWSSB portal states no open licence ("All rights reserved"), so the
  logger table is service-role only until a publishing decision is recorded.
