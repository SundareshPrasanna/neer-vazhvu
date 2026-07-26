#!/usr/bin/env python3
"""
Scrape HMWSSB's daily "Statements of WaterLevels in Reservoirs" for Hyderabad.

This is the richest reservoir feed on the platform. Unlike Chennai (CMWSSB:
level + storage) and Mumbai (Pravah: storage only, which is why Mumbai's hero
has to collapse its rain scenarios), HMWSSB publishes BOTH today's draw-off in
MLD and today's inflow in TMC, plus the level and storage on the SAME DATE LAST
YEAR. So Hyderabad can run the full interactive days-left hero with a MEASURED
divisor instead of an assumed one, and gets a year-on-year series for free.

Feed
----
The page linked from HMWSSB's nav ("Water levels in Reservoirs") is only a
wrapper; the real report is the iframe target:

    https://bms.hyderabadwater.gov.in/wlrreport/showreport1.aspx

Classic ASP.NET WebForms. Fetch once to harvest __VIEWSTATE /
__VIEWSTATEGENERATOR / __EVENTVALIDATION, then POST them back with `txtdate`
and __EVENTTARGET=txtdate to select a date.

GOTCHAS - all three verified 2026-07-26, all three silent
---------------------------------------------------------
1. The date format is `dd-MMM-yyyy` (e.g. 25-Jul-2026) and NOTHING ELSE.
   `25/07/2026` and `07/25/2026` both return a well-formed page reading
   "No Records Found" - i.e. a wrong format is indistinguishable from a date
   with no data. Same failure shape as the India-WRIS blank-districtName trap.
   `_fmt_date()` below is the only place that formats a date; keep it that way.

2. The summary row is labelled "Total(1 to 5)" but is NOT the sum of rows 1-5.
   On 25-Jul-2026 it printed 2,659.493 MLD while rows 1-5 sum to 1,922.632;
   the difference is exactly Yellampally (row 8, 736.861). The label is stale -
   it predates the Godavari source being added. We therefore IGNORE the printed
   total entirely and recompute from the individual rows. See `city_draw_mld`.

3. Levels are in MIXED UNITS, declared only in the row label: rows carry feet
   unless the name is suffixed "(M)". `AkkamPally[Krishna](M)` is metres;
   `Singur(Ft./M)` reads on a feet scale (~1,690-1,718) despite the ambiguous
   suffix. `RESERVOIRS` below pins the unit per source rather than guessing per
   run, and `--check-units` validates the pin against the archive.

Archive
-------
Daily data exists from 01-Jan-2014 to the present (01-Jan-2013 and earlier
return "No Records Found"), so ~12.5 years is backfillable by iterating dates.
Today's statement is not filed until some point during the day - an empty
result for today is normal, not an error.

Run
---
    cd neer-vazhvu-api
    python3 scripts/scrape_hmwssb_reservoirs.py                  # latest available
    python3 scripts/scrape_hmwssb_reservoirs.py --date 25-Jul-2026
    python3 scripts/scrape_hmwssb_reservoirs.py --backfill 2014-01-01:2026-07-26 \
        --out ../public/data/hyderabad-reservoirs-archive.json
    python3 scripts/scrape_hmwssb_reservoirs.py --check-units --backfill 2015-01-01:2026-07-26

Emits JSON to stdout unless --out is given. DB ingestion into
reservoir_daily_v2 is behind --supabase and needs the Hyderabad water_sources
rows to exist first (FK on city_id, source_code).
"""

import argparse
import html
import json
import re
import ssl
import sys
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from http.cookiejar import CookieJar

REPORT_URL = "https://bms.hyderabadwater.gov.in/wlrreport/showreport1.aspx"

# 1 TMC (thousand million cubic feet) = 28.3168 million m3. Used only to expose
# inflow in a second unit; the canonical stored value stays TMC.
MCUM_PER_TMC = 28.3168
FT_PER_M = 3.280839895

# The feed's reservoir label -> our canonical source_code, the level unit AS
# PUBLISHED, and whether the row is one of the city's own supply draws.
#
# `is_city_source` marks the five rows HMWSSB draws the city's water from
# directly. Nagarjuna Sagar and Srisailam are the PARENT Krishna storages
# upstream of Akkampally - they are reported for context and consistently show
# a drawl of 0.000 MLD for the city, so counting them as city sources would
# double-count the Krishna leg. Yellampally IS a city source (the Godavari
# leg, commissioned after 2014 - it is absent from the earliest rows).
RESERVOIRS = {
    "OsmanSagar": ("osman_sagar", "ft", True),
    "HimayathSagar": ("himayat_sagar", "ft", True),
    "Singur(Ft./M)": ("singur", "ft", True),
    "Manjira": ("manjira", "ft", True),
    "AkkamPally[Krishna](M)": ("akkampally", "m", True),
    "SriPadaYellampally(Godavari)": ("yellampally", "ft", True),
    "NagarjunSagar": ("nagarjuna_sagar", "ft", False),
    "Srisailam": ("srisailam", "ft", False),
}

# Capacity-at-FTL, in TMC, as published on 2026-07-26. This is the days-left
# DENOMINATOR, so a silent change to it silently changes every runway figure we
# publish - which is exactly what happened on 01-Jul-2026, when HMWSSB revised
# Osman Sagar 3.900 -> 3.518 and Himayat Sagar 2.967 -> 2.521 with no notice,
# bisected to the exact day, on the water-year boundary. Cause still unconfirmed.
#
# Headwaters cannot watch this the usual way: these values only appear after an
# ASP.NET postback, so a GET-based page-hash detector would hash a constant
# "No Records Found" page forever. The guard therefore lives here, where the
# value is actually parsed. `--strict-capacity` turns the warning into a
# non-zero exit so the daily cron fails loudly instead of quietly republishing
# a wrong runway.
EXPECTED_CAPACITY_TMC = {
    "osman_sagar": 3.518,
    "himayat_sagar": 2.521,
    "singur": 29.917,
    "manjira": 1.500,
    "akkampally": 1.499,
    "yellampally": 20.175,
    "nagarjuna_sagar": 312.045,
    "srisailam": 215.807,
}
# Tolerance is tight on purpose: these are published constants, not readings.
CAPACITY_TOLERANCE_TMC = 0.001


def check_capacity_drift(rows: list) -> list:
    """
    Compare each row's capacity-at-FTL against the pinned expectation.

    Returns a list of human-readable drift descriptions (empty = all good).
    Only the most recent date's rows should be passed in - historical rows
    legitimately carry the pre-revision values.
    """
    drifts = []
    for r in rows:
        want = EXPECTED_CAPACITY_TMC.get(r["source_code"])
        got = r.get("capacity_at_ftl_tmc")
        if want is None or got is None:
            continue
        if abs(got - want) > CAPACITY_TOLERANCE_TMC:
            pct = (got - want) / want * 100 if want else float("nan")
            drifts.append(
                f"{r['source_code']}: capacity-at-FTL {want} -> {got} TMC "
                f"({pct:+.1f}%) on {r['date']}"
            )
    return drifts

# Column order in the report table, after the leading serial number.
COLS = [
    "reservoir",
    "ftl",
    "capacity_at_ftl_tmc",
    "level_prev_day",
    "level_today",
    "capacity_today_tmc",
    "drawl_mld",
    "inflow_tmc",
    "level_last_year",
    "capacity_last_year_tmc",
]

_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
           "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _fmt_date(d: date) -> str:
    """The ONLY accepted format. See gotcha 1 in the module docstring."""
    return f"{d.day:02d}-{_MONTHS[d.month - 1]}-{d.year}"


def _parse_iso(s: str) -> date:
    return datetime.strptime(s, "%Y-%m-%d").date()


def _num(s: str):
    """Parse a report cell to float. Handles thousands commas and blanks."""
    s = (s or "").strip().replace(",", "")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


class HmwssbSession:
    """Holds the cookie jar + the ASP.NET hidden fields across postbacks."""

    def __init__(self, timeout: int = 90):
        ctx = ssl.create_default_context()
        # The host's chain has been intermittently incomplete, same as Pravah.
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        self._opener = urllib.request.build_opener(
            urllib.request.HTTPSHandler(context=ctx),
            urllib.request.HTTPCookieProcessor(CookieJar()),
        )
        self._timeout = timeout
        self._fields = {}
        self._prime()

    def _get(self, url: str) -> str:
        req = urllib.request.Request(
            url, headers={"User-Agent": "Mozilla/5.0 neervazhvu-hmwssb"}
        )
        with self._opener.open(req, timeout=self._timeout) as resp:
            return resp.read().decode("utf8", "ignore")

    def _prime(self) -> None:
        self._harvest(self._get(REPORT_URL))

    def _harvest(self, page: str) -> None:
        found = dict(
            re.findall(
                r'<input[^>]*type="hidden"[^>]*name="([^"]+)"[^>]*value="([^"]*)"',
                page,
            )
        )
        if found:
            self._fields = found

    def fetch(self, d: date) -> str:
        body = dict(self._fields)
        body.update(
            {"txtdate": _fmt_date(d), "__EVENTTARGET": "txtdate", "__EVENTARGUMENT": ""}
        )
        req = urllib.request.Request(
            REPORT_URL,
            data=urllib.parse.urlencode(body).encode(),
            headers={
                "User-Agent": "Mozilla/5.0 neervazhvu-hmwssb",
                "Content-Type": "application/x-www-form-urlencoded",
                "Referer": REPORT_URL,
            },
        )
        with self._opener.open(req, timeout=self._timeout) as resp:
            page = resp.read().decode("utf8", "ignore")
        # Each postback rotates __VIEWSTATE; carry the new one forward.
        self._harvest(page)
        return page


def parse_report(page: str, d: date) -> list:
    """Return one dict per reservoir row. Empty list = 'No Records Found'."""
    rows = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", page, flags=re.S | re.I):
        cells = [
            html.unescape(re.sub(r"<[^>]+>", "", c)).strip()
            for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, flags=re.S | re.I)
        ]
        # Data rows lead with a serial number and carry all 11 columns.
        if len(cells) < 11 or not cells[0].strip().isdigit():
            continue
        vals = dict(zip(COLS, cells[1:11]))
        label = vals["reservoir"].strip()
        if label not in RESERVOIRS:
            # Unknown label = the feed changed. Surface it, never silently drop.
            print(
                f"  ! {_fmt_date(d)}: unrecognised reservoir label {label!r}",
                file=sys.stderr,
            )
            continue
        source_code, unit, is_city = RESERVOIRS[label]
        level_today = _num(vals["level_today"])
        ftl = _num(vals["ftl"])
        cap_today = _num(vals["capacity_today_tmc"])
        cap_ftl = _num(vals["capacity_at_ftl_tmc"])
        rows.append(
            {
                "source_code": source_code,
                "hmwssb_label": label,
                "date": d.isoformat(),
                "is_city_source": is_city,
                "level_unit": unit,
                "ftl": ftl,
                "level_today": level_today,
                "level_prev_day": _num(vals["level_prev_day"]),
                "capacity_at_ftl_tmc": cap_ftl,
                "capacity_today_tmc": cap_today,
                "storage_pct_ftl": round(cap_today / cap_ftl * 100, 2)
                if cap_today is not None and cap_ftl
                else None,
                "drawl_mld": _num(vals["drawl_mld"]),
                "inflow_tmc": _num(vals["inflow_tmc"]),
                "level_last_year": _num(vals["level_last_year"]),
                "capacity_last_year_tmc": _num(vals["capacity_last_year_tmc"]),
            }
        )
    return rows


# Physically defensible envelope for a level reading, as a fraction of that
# reservoir's own FTL. A reading outside it is not a low reservoir - it is a
# data-entry error upstream.
#
# WHY THIS EXISTS. The 12.5-year archive contains a small number of genuine
# HMWSSB typos - 23 rows in 35,975 (0.06%) at the 2026-07-26 backfill. They are
# NOT parse errors; the level_prev_day column proves it in every case:
#   - decimal-point slips: osman_sagar 2017-02-28 level 1780840.0 against a
#     previous day of 1780.86; himayat_sagar 2019-05-05 level 1745100.0 against
#     1745.2; akkampally 2018-01-20 level 243100.0 against 243.45.
#   - UNIT FLIPS: singur 2019-09-04 level 509.16 against a previous day of
#     1670.554 ft - and 1670.554 ft IS 509.18 m, so the source printed metres
#     in a feet column for a day.
#   - column duplication: on 2019-08-09 both srisailam and yellampally printed
#     level == capacity (181.83 and 19.31 respectively).
#   - cross-row contamination: nagarjuna_sagar 2021-11-09 level 862.9 and
#     2026-02-14 level 870.9, both Srisailam-scale values (FTL 885) sitting in
#     a reservoir whose FTL is 590.
#
# A single 1,787,150 ft reading destroys any chart axis, any max(), and any
# level-derived statistic. So these are QUARANTINED into `_excluded` and
# counted, never silently dropped and never silently kept. Same discipline as
# the India-WRIS depth envelope in the pan-India playbook.
LEVEL_ENVELOPE = (0.5, 1.05)


# The capacity column has the SAME family of typos as the level column, and
# they matter more: storage_tmc is the days-left NUMERATOR, so a bad capacity
# corrupts the runway directly, where a bad level only corrupts a chart.
#
# Observed in the 2014-2026 archive (16 rows above 1.05x capacity-at-FTL):
#   - cross-column contamination: osman_sagar 2023-10-30 capacity 485.588 TMC
#     against a capacity-at-FTL of 3.9 - 485.588 is YELLAMPALLY'S FTL value.
#     akkampally 2025-12-25 capacity 248.54 against 1.499 - 248.54 is an
#     Akkampally LEVEL (metres). yellampally 2017-12-09 capacity 484.51
#     against 20.175 - again a level, not a storage.
#   - decimal slips: srisailam 2017-07-16 capacity 20160.0 against 215.807.
#
# The threshold is deliberately loose at 2.0x. A reservoir CAN hold more than
# its live capacity-at-FTL during a flood surcharge - manjira 2024-09-07 at
# 1.3x and srisailam 2025-11-17 at 1.2x are physically possible and are
# RETAINED. Nothing physical explains 3.7x and above, and every rejected row
# sits at 3.7x or higher. This also keeps storage_pct_frl inside the DB's
# NUMERIC(5,2) ceiling of 999.99, which the raw data violates 8 times.
CAPACITY_MAX_FRAC_OF_FTL = 2.0


def capacity_is_plausible(row: dict) -> bool:
    cap, cap_ftl = row.get("capacity_today_tmc"), row.get("capacity_at_ftl_tmc")
    if cap is None or not cap_ftl:
        return True
    if cap < 0:
        return False
    return cap <= CAPACITY_MAX_FRAC_OF_FTL * cap_ftl


def dedupe_rows(rows: list) -> tuple:
    """
    Collapse duplicate (source_code, date) rows.

    On 16 dates in the archive HMWSSB renders the ENTIRE table twice - 16 rows
    instead of 8 - with identical values in both copies. Left alone this
    produces 91 primary-key collisions against reservoir_daily_v2's
    (city_id, source_code, date) key, which an upsert would silently absorb.
    We drop the duplicates explicitly and report any that DISAGREE, because a
    disagreeing pair would mean something quite different from a repeated render.
    """
    out, seen, conflicts = [], {}, []
    for r in rows:
        key = (r["source_code"], r["date"])
        if key in seen:
            prev = seen[key]
            for f in ("level_today", "capacity_today_tmc", "drawl_mld"):
                if prev.get(f) != r.get(f):
                    conflicts.append((key, f, prev.get(f), r.get(f)))
            continue
        seen[key] = r
        out.append(r)
    return out, conflicts


def level_is_plausible(row: dict) -> bool:
    lvl, ftl = row.get("level_today"), row.get("ftl")
    if lvl is None or not ftl:
        return True  # nothing to judge against
    if lvl == 0:
        return True  # 0.000 = not reported that day, handled downstream
    lo, hi = LEVEL_ENVELOPE
    return lo * ftl <= lvl <= hi * ftl


# Second-stage filter, for typos the envelope cannot see.
#
# The envelope above catches order-of-magnitude slips and unit flips. It does
# NOT catch a single-digit substitution that lands inside 0.5-1.05 x FTL - e.g.
# Osman Sagar's 1753.3 printed as 1453.3 on 2016-03-26, or Srisailam's 817.7 as
# 517.7 on 2017-03-13. Those are still wrong enough to wreck a chart and any
# min() over the series.
#
# Their signature is unmistakable once you look: the value spikes for exactly
# one day and reverts, and the gap is a ROUND number (300.0, 180.0, 100.0),
# because a single digit changed in a fixed decimal position. So the test is a
# classic spike filter: a reading is bad if it differs from BOTH neighbours by
# more than SPIKE_THRESHOLD_FRAC of FTL *in the same direction*. A genuine step
# change (gates opened, monsoon inflow) differs from only one neighbour, so it
# survives.
#
# Calibrated against the full 2014-2026 archive on 2026-07-26: catches 13 rows
# (0.036%), every one a verified single-day digit slip, and correctly leaves
# the correct reverting neighbours alone. Needs >= 3 consecutive days, so it is
# a backfill-mode check; single-day runs rely on the envelope alone.
SPIKE_THRESHOLD_FRAC = 0.03


def find_level_spikes(rows: list) -> list:
    """Return rows whose level is a one-day spike against both neighbours."""
    by_source = {}
    for r in rows:
        lvl, ftl = r.get("level_today"), r.get("ftl")
        if lvl and ftl and level_is_plausible(r):
            by_source.setdefault(r["source_code"], []).append(r)
    spikes = []
    for seq in by_source.values():
        seq.sort(key=lambda r: r["date"])
        for i in range(1, len(seq) - 1):
            prev, cur, nxt = seq[i - 1], seq[i], seq[i + 1]
            ftl = cur["ftl"]
            dp = cur["level_today"] - prev["level_today"]
            dn = cur["level_today"] - nxt["level_today"]
            t = SPIKE_THRESHOLD_FRAC * ftl
            if abs(dp) > t and abs(dn) > t and dp * dn > 0:
                spikes.append((cur, prev["level_today"], nxt["level_today"]))
    return spikes


def level_ft(row: dict):
    """Level normalised to feet, or None. See gotcha 3."""
    lvl = row.get("level_today")
    if lvl is None:
        return None
    if row["level_unit"] == "ft":
        return round(lvl, 2)
    if row["level_unit"] == "m":
        return round(lvl * FT_PER_M, 2)
    return None


def city_draw_mld(rows: list):
    """
    Total draw-off to the city, recomputed from the individual rows.

    We deliberately do NOT read the report's own "Total(1 to 5)" cell. With
    today's six city sources our sum happens to EQUAL it (2,659.493 MLD on
    25-Jul-2026) because that cell in fact totals rows 1-5 plus Yellampally
    despite its label. That coincidence is exactly why reading the cell would
    be dangerous: the label is stale, so the set it covers is undocumented and
    can drift again when HMWSSB adds a source.

    THE KRISHNA CHAIN NEEDS max(), NOT sum(). Akkampally is a balancing
    reservoir fed from Nagarjuna Sagar, which is fed from Srisailam - one
    physical draw on the Krishna, which HMWSSB books inconsistently. Normally
    Akkampally carries it and the parents read 0.000, which is why the parents
    are is_city_source=False. But on 15 of 4,514 days Nagarjuna Sagar carries
    the full ~1,254 MLD instead (and Srisailam on 7 days), and on 18 days BOTH
    report a figure - sometimes the IDENTICAL one (2016-05-07: Akkampally and
    Nagarjuna Sagar both 1,116.807).
    So:
      - summing only is_city_source UNDERSTATES by up to ~1,254 MLD (~47% of a
        day's total) on those days. This is what produced the implausible
        1,862 MLD minimum in the trailing-365 range against a 2,647 median.
      - summing everything DOUBLE-COUNTS on the days the parent mirrors
        Akkampally.
    Taking the max across the chain is right in both cases and conservative in
    the ambiguous ones (2016-06-15: Akkampally 1,203.12 vs Srisailam 378.76 ->
    1,203.12). Affected days are a small share - 21 of 4,589 (0.46%) - but they
    are exactly the days a runway chart would show as an inexplicable cliff.
    """
    KRISHNA_CHAIN = {"akkampally", "nagarjuna_sagar", "srisailam"}
    by_code = {
        r["source_code"]: r["drawl_mld"]
        for r in rows
        if r.get("drawl_mld") is not None
    }
    if not by_code:
        return None
    independent = sum(
        v
        for code, v in by_code.items()
        if code not in KRISHNA_CHAIN
        and next(
            (b for _, (c, _u, b) in RESERVOIRS.items() if c == code), False
        )
    )
    krishna = max((by_code.get(c, 0.0) for c in KRISHNA_CHAIN), default=0.0)
    return round(independent + krishna, 3)


def check_units(all_rows: list) -> int:
    """
    Validate that each reservoir's level column and FTL column share a scale.

    WHAT THIS PROVES: storage_pct_ftl and any level chart assume level and FTL
    are in the same unit. If they are, then across a long archive max(level)
    approaches FTL without wildly exceeding it. Verified 2026-07-26 over the
    2022-09-01..2022-10-10 monsoon window: all 8 reservoirs land at max/FTL
    0.997-1.000, and Osman Sagar, Himayat Sagar, Nagarjuna Sagar and Srisailam
    each touch FTL exactly. So the pct/storage maths is sound for every row.

    WHAT THIS DOES NOT PROVE: the ABSOLUTE unit. A consistent pair could both
    be feet or both be metres. That only matters for `level_ft`, which is a
    display normalisation. We take the absolute unit from the feed's own
    declarations - the header says "Today's Level in Feet", and the only row
    overriding it is `AkkamPally[Krishna](M)`. Yellampally's 485.560 reads as
    feet (= 148.0 m, a plausible Godavari barrage elevation) rather than
    485 m, but that inference is NOT independently confirmed; confirm against
    Telangana Irrigation's reservoir levels before publishing a level in feet
    for Yellampally. Storage and percentage figures are unaffected either way.

    Prints a table; returns non-zero if any reservoir looks mis-pinned.
    """
    by_source = {}
    for r in all_rows:
        if r["level_today"] is None or not r["ftl"]:
            continue
        by_source.setdefault(r["source_code"], {"ftl": r["ftl"], "levels": []})
        by_source[r["source_code"]]["levels"].append(r["level_today"])

    print("\nUnit / scale check (level column vs FTL column)", file=sys.stderr)
    print(
        f"{'source':<18}{'unit':>5}{'FTL':>12}{'p99 lvl':>12}{'min lvl':>12}"
        f"{'p99/FTL':>10}{'excl':>6}  verdict",
        file=sys.stderr,
    )
    bad = 0
    for sc, d in sorted(by_source.items()):
        lv = [x for x in d["levels"] if x > 0]  # 0.000 = not reported that day
        if not lv:
            continue
        lo, hi = LEVEL_ENVELOPE
        clean = sorted(x for x in lv if lo * d["ftl"] <= x <= hi * d["ftl"])
        excluded = len(lv) - len(clean)
        if not clean:
            print(f"{sc:<18} ALL {len(lv)} readings outside envelope", file=sys.stderr)
            bad += 1
            continue
        # Use a high percentile, NOT max: a handful of upstream typos (see
        # LEVEL_ENVELOPE) would otherwise mask the real verdict - which is
        # exactly what happened on the first full-archive run, where every
        # reservoir read "MIS-PINNED?" off 23 bad rows in 35,975.
        p99 = clean[min(len(clean) - 1, int(len(clean) * 0.99))]
        ratio = p99 / d["ftl"]
        ok = 0.5 <= ratio <= 1.02
        if not ok:
            bad += 1
        unit = next((u for _, (c, u, _b) in RESERVOIRS.items() if c == sc), "?")
        print(
            f"{sc:<18}{unit:>5}{d['ftl']:>12.3f}{p99:>12.3f}{clean[0]:>12.3f}"
            f"{ratio:>10.3f}{excluded:>6}  {'ok' if ok else 'MIS-PINNED?'}",
            file=sys.stderr,
        )
    return 1 if bad else 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--date",
        help="single date to fetch, as dd-MMM-yyyy or YYYY-MM-DD "
        "(default: most recent day with data, searching back up to 7 days)",
    )
    ap.add_argument(
        "--backfill",
        metavar="START:END",
        help="inclusive ISO date range, e.g. 2014-01-01:2026-07-26. "
        "The archive starts 01-Jan-2014; earlier dates return no records.",
    )
    ap.add_argument("--out", help="write JSON here instead of stdout")
    ap.add_argument(
        "--sleep",
        type=float,
        default=0.4,
        help="seconds between requests when backfilling (default 0.4; this is "
        "a government IIS box, do not hammer it)",
    )
    ap.add_argument(
        "--check-units",
        action="store_true",
        help="validate the per-reservoir level-unit pin against the fetched "
        "rows and exit non-zero if any look mis-pinned",
    )
    ap.add_argument(
        "--strict-capacity",
        action="store_true",
        help="exit non-zero if any reservoir's published capacity-at-FTL has "
        "drifted from EXPECTED_CAPACITY_TMC. Use this in the daily cron: the "
        "capacity is the days-left denominator, and HMWSSB has revised it "
        "silently before (01-Jul-2026).",
    )
    ap.add_argument(
        "--supabase",
        action="store_true",
        help="upsert city sources into reservoir_daily_v2 (city_id=hyderabad). "
        "Requires the Hyderabad water_sources rows to exist (FK). "
        "Needs SUPABASE_URL + SUPABASE_SERVICE_KEY.",
    )
    args = ap.parse_args()

    sess = HmwssbSession()
    days = []

    if args.backfill:
        start_s, _, end_s = args.backfill.partition(":")
        cur, end = _parse_iso(start_s), _parse_iso(end_s)
        while cur <= end:
            days.append(cur)
            cur += timedelta(days=1)
    elif args.date:
        if re.match(r"^\d{4}-\d{2}-\d{2}$", args.date):
            days = [_parse_iso(args.date)]
        else:
            days = [datetime.strptime(args.date, "%d-%b-%Y").date()]
    else:
        # Today's statement is often not filed yet; walk back until we hit data.
        days = [date.today() - timedelta(days=i) for i in range(0, 8)]

    all_rows, empty_days, fetched_days = [], [], []
    for i, d in enumerate(days):
        try:
            rows = parse_report(sess.fetch(d), d)
        except Exception as exc:  # noqa: BLE001 - one bad day must not kill a backfill
            print(f"  ! {_fmt_date(d)}: {exc}", file=sys.stderr)
            rows = []
        if rows:
            all_rows.extend(rows)
            fetched_days.append(d)
            if not args.backfill and not args.date:
                break  # latest-available mode: stop at the first day with data
        else:
            empty_days.append(d.isoformat())
        if args.sleep and i < len(days) - 1:
            time.sleep(args.sleep)
        if args.backfill and (i + 1) % 200 == 0:
            print(
                f"  ... {i + 1}/{len(days)} days, {len(all_rows)} rows",
                file=sys.stderr,
            )

    if not all_rows:
        print("HMWSSB: no rows parsed for any requested date", file=sys.stderr)
        return 1

    # Collapse repeated renders before anything else - otherwise every
    # downstream count, mean and upsert double-counts those 16 dates.
    all_rows, dup_conflicts = dedupe_rows(all_rows)
    if dup_conflicts:
        print(
            f"  !! {len(dup_conflicts)} duplicate (source,date) rows DISAGREE - "
            "this is not a repeated render, investigate before ingesting:",
            file=sys.stderr,
        )
        for key, field, a, b in dup_conflicts[:10]:
            print(f"     {key} {field}: {a} vs {b}", file=sys.stderr)

    # Quarantine implausible readings BEFORE anything downstream sees them. The
    # row is kept but the bad field is nulled and the original preserved, so a
    # chart cannot inherit a 1,787,150 ft axis, a runway cannot inherit a
    # 485 TMC Osman Sagar, and a reader can still audit what happened.
    excluded = []
    for r in all_rows:
        if not capacity_is_plausible(r):
            excluded.append(
                {
                    "date": r["date"],
                    "source_code": r["source_code"],
                    "rejected_capacity_tmc": r["capacity_today_tmc"],
                    "capacity_at_ftl_tmc": r["capacity_at_ftl_tmc"],
                    "reason": "capacity above "
                    f"{CAPACITY_MAX_FRAC_OF_FTL}x capacity-at-FTL",
                }
            )
            r["capacity_today_tmc_raw_rejected"] = r["capacity_today_tmc"]
            r["capacity_today_tmc"] = None
            r["storage_pct_ftl"] = None
    for r in all_rows:
        if not level_is_plausible(r):
            excluded.append(
                {
                    "date": r["date"],
                    "source_code": r["source_code"],
                    "rejected_level": r["level_today"],
                    "ftl": r["ftl"],
                    "level_prev_day": r["level_prev_day"],
                    "reason": "level outside "
                    f"{LEVEL_ENVELOPE[0]}-{LEVEL_ENVELOPE[1]} x FTL",
                }
            )
            r["level_today_raw_rejected"] = r["level_today"]
            r["level_today"] = None

    # Second stage: one-day spikes that survived the envelope.
    for row, prev_lvl, next_lvl in find_level_spikes(all_rows):
        excluded.append(
            {
                "date": row["date"],
                "source_code": row["source_code"],
                "rejected_level": row["level_today"],
                "ftl": row["ftl"],
                "neighbour_levels": [prev_lvl, next_lvl],
                "reason": "one-day spike vs both neighbours "
                f"(>{SPIKE_THRESHOLD_FRAC:.0%} of FTL)",
            }
        )
        row["level_today_raw_rejected"] = row["level_today"]
        row["level_today"] = None

    by_date = {}
    for r in all_rows:
        by_date.setdefault(r["date"], []).append(r)
    daily = [
        {
            "date": d,
            "city_draw_mld": city_draw_mld(rows),
            "reservoirs": sorted(rows, key=lambda r: r["source_code"]),
        }
        for d, rows in sorted(by_date.items())
    ]

    out = {
        "_source": "HMWSSB daily Statements of WaterLevels in Reservoirs",
        "_source_url": REPORT_URL,
        "_fetched": date.today().isoformat(),
        "_note": (
            "Levels are mixed-unit and declared per row by the source "
            "(AkkamPally is metres, the rest feet); level_unit records what the "
            "feed published and level_ft normalises. city_draw_mld is RECOMPUTED "
            "from the individual rows - the report's own 'Total(1 to 5)' cell is "
            "mislabelled and silently includes Yellampally."
        ),
        "_days_with_data": len(daily),
        "_days_empty": len(empty_days),
        "_excluded_levels": excluded,
        "_excluded_count": len(excluded),
        "days": daily,
    }
    payload = json.dumps(out, ensure_ascii=False, indent=2)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(payload)
    else:
        print(payload)

    latest = daily[-1]
    print(
        f"HMWSSB: {len(daily)} day(s) with data, {len(all_rows)} rows; "
        f"latest {latest['date']} draw={latest['city_draw_mld']} MLD "
        f"({len(latest['reservoirs'])} reservoirs)"
        + (
            f" | QUARANTINED {len(excluded)} implausible level reading(s)"
            if excluded
            else ""
        ),
        file=sys.stderr,
    )

    rc = 0
    if args.check_units:
        rc = check_units(all_rows)

    # Capacity guard, always evaluated, against the LATEST day only - older
    # rows legitimately carry pre-revision values.
    drifts = check_capacity_drift(latest["reservoirs"])
    if drifts:
        print(
            "\n  !! CAPACITY-AT-FTL DRIFT - the days-left denominator changed "
            "upstream:",
            file=sys.stderr,
        )
        for d in drifts:
            print(f"     {d}", file=sys.stderr)
        print(
            "     Confirm the cause against a GO before republishing runway "
            "figures, then update EXPECTED_CAPACITY_TMC, the water_sources "
            "migration and docs/cities/hyderabad/data-sources.md together.",
            file=sys.stderr,
        )
        if args.strict_capacity:
            rc = rc or 2

    if args.supabase:
        import os

        from supabase import create_client

        db_rows = [
            {
                "city_id": "hyderabad",
                "source_code": r["source_code"],
                "date": r["date"],
                "storage_tmc": r["capacity_today_tmc"],
                "storage_pct_frl": r["storage_pct_ftl"],
                "level_ft": level_ft(r),
                # HMWSSB publishes inflow in TMC/day and draw in MLD, neither of
                # which is cusecs. Converting would invent precision the feed
                # does not have, so these stay NULL and the real values live in
                # the JSON artifact until the schema carries native columns.
                "inflow_cusecs": None,
                "outflow_cusecs": None,
                "source": "HMWSSB daily reservoir statement",
                "scraped_from": REPORT_URL,
            }
            for r in all_rows
            if r["is_city_source"]
        ]
        sb = create_client(
            os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"]
        )
        for i in range(0, len(db_rows), 500):
            sb.table("reservoir_daily_v2").upsert(
                db_rows[i : i + 500], on_conflict="city_id,source_code,date"
            ).execute()
        print(
            f"Upserted {len(db_rows)} rows to reservoir_daily_v2", file=sys.stderr
        )

    return rc


if __name__ == "__main__":
    raise SystemExit(main())
