#!/usr/bin/env python3
"""
Daily dam storage from the Gujarat Narmada, Water Resources, Water Supply and
Kalpsar Department's Reservoir Data Management System (wrd-dam.gujarat.gov.in).

The department publishes ONE PDF PER DAY, from 2019-06-07 to today, at

    https://wrd-dam.gujarat.gov.in/downloads/home_pdf.php?dt=<base64("YYYY-MM-DD")>

Each file is frozen as generated on its day (a re-fetch of 04-09-2026 is
byte-identical to the copy in the research drop), so the archive IS the
history: a backfill reads the same numbers the department printed that day.
There is no JSON or HTML table behind it.

What each report carries, and what this script reads:
  * the dam statement (pages ~4-11): per dam, OSL / FRL / present water level
    in metres, then DESIGN gross / live / dead and PRESENT gross / live / dead
    storage in MCM, then % filling, rainfall, warning band, inflow and outflow
    to river and canal in cusecs;
  * Sardar Sarovar's own block (page 1-2): level, inflow, gross storage and the
    releases, including "Flow @ HR" - the discharge at the Narmada Main
    Canal's head regulator, which is the canal that carries most of
    Ahmedabad's water.

SELF-CHECKING PARSE. A row is accepted only if its own arithmetic holds:
design gross = live + dead, present gross = live + dead (to 0.1 MCM) and the
printed % = present gross / design gross (to 0.1 point). The layout has
drifted since 2019 (SchemeId and Taluka columns added, region printed as a
word then a code, words wrapping across lines, rows re-ordered), and a
regex that silently mis-reads a column would write a wrong storage figure;
these identities make a mis-read fail loudly instead. Rows are found by dam
NAME, never by row number.

STORAGE IS LIVE STORAGE, the platform convention (Pune's Pravah feed): the
water above the lowest outlet, as a share of designed live capacity. The
department's headline % is GROSS; both are kept in the JSON artifact.

A missing or bad date returns HTTP 200 with zero bytes, not an error, so an
empty body is treated as "no report for that day".

Run:
  python3 neer-vazhvu-api/scripts/scrape_gujarat_wrd_dams.py --city ahmedabad \\
      --out public/data/ahmedabad-dam-storage.json [--supabase]
  python3 neer-vazhvu-api/scripts/scrape_gujarat_wrd_dams.py --city ahmedabad \\
      --backfill-from 2019-06-07 --supabase        # one-off history
"""

import argparse
import base64
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.request
from datetime import date, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

REPORT_URL = "https://wrd-dam.gujarat.gov.in/downloads/home_pdf.php?dt={}"
SOURCE_ID = "gujarat-wrd-dam-daily-report"
MCUM_PER_TMC = 28.3168
FT_PER_M = 3.28084

# source_code -> the name as printed in the dam statement. Sardar Sarovar is
# read from its own block, not the statement.
CITIES = {
    "ahmedabad": {
        "dams": {"kadana": "Kadana", "dharoi": "Dharoi"},
        "sardar_sarovar": "sardar_sarovar",
    },
}

_N = r"-?\d+(?:\.\d+)?"


def report_url(day: date) -> str:
    return REPORT_URL.format(base64.b64encode(day.isoformat().encode()).decode())


def fetch_text(day: date, tries: int = 3) -> str | None:
    """The report's text for `day`, or None when the department has none."""
    for attempt in range(tries):
        try:
            req = urllib.request.Request(
                report_url(day),
                headers={"User-Agent": "Mozilla/5.0 neervazhvu-gujarat-wrd"},
            )
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            break
        except Exception as exc:
            if attempt == tries - 1:
                raise
            print(f"  {day} retry {attempt + 1}: {exc}", file=sys.stderr)
            time.sleep(3 * (attempt + 1))
    if not data:
        return None
    if not data.startswith(b"%PDF"):
        raise RuntimeError(f"{day}: response is not a PDF")
    with tempfile.NamedTemporaryFile(suffix=".pdf") as fh:
        fh.write(data)
        fh.flush()
        out = subprocess.run(
            ["pdftotext", "-layout", fh.name, "-"],
            capture_output=True,
            text=True,
            check=True,
        )
    return out.stdout


def report_date(text: str) -> date | None:
    m = re.search(r"Date\s*:-\s*(\d{2})-(\d{2})-(\d{4})", text)
    return date(int(m.group(3)), int(m.group(2)), int(m.group(1))) if m else None


def parse_dam(text: str, name: str) -> dict | None:
    """The dam-statement row for `name`, verified by its own arithmetic."""
    for line in text.splitlines():
        m = re.search(rf"(?<![A-Za-z]){re.escape(name)}(?![A-Za-z])(.*)$", line)
        if not m or "%" not in m.group(1):
            continue
        head, _, tail = m.group(1).partition("%")
        nums = [float(x) for x in re.findall(_N, head)]
        if len(nums) < 10:
            continue
        osl, frl, pwl, dg, dl, dd, pg, pl, pd, pct = nums[-10:]
        if not (
            abs(dg - dl - dd) <= 0.1
            and abs(pg - pl - pd) <= 0.1
            and dg > 0
            and abs(pg / dg * 100 - pct) <= 0.1
        ):
            continue
        flows = [float(x) for x in re.findall(_N, tail)]
        warning = re.search(r"\b(HIGH(?:\s+ALERT)?|ALERT|WARNI(?:NG)?|NIL)\b", tail)
        return {
            "frl_m": frl,
            "level_m": pwl,
            "design_gross_mcm": dg,
            "design_live_mcm": dl,
            "gross_mcm": pg,
            "live_mcm": pl,
            "gross_pct": pct,
            "live_pct": round(pl / dl * 100, 2) if dl else None,
            "warning": warning.group(1)
            .replace("WARNI", "WARNING")
            .replace("WARNINGNG", "WARNING")
            if warning
            else None,
            # Last three numbers on the row: inflow, outflow to river, to canal.
            "inflow_cusecs": flows[-3] if len(flows) >= 3 else None,
            "outflow_river_cusecs": flows[-2] if len(flows) >= 3 else None,
            "outflow_canal_cusecs": flows[-1] if len(flows) >= 3 else None,
        }
    return None


def parse_sardar_sarovar(text: str) -> dict | None:
    """Sardar Sarovar's storage line and its level / release line."""
    after = text.split("(NARMADA DAM)", 1)
    m = (
        re.search(
            rf"({_N})\s+({_N})\s+({_N})\s+({_N})\s+({_N})\s*%\s+({_N})\s*%", after[1]
        )
        if len(after) == 2
        else None
    )
    # Level, inflow, gross, then seven release columns ending in Flow @ HR.
    r = re.search(
        r"\(in\s*m[t.]*\)[^\n]*\n(?:[^\n]*\n)*?\s*(" + rf"{_N}(?:\s+{_N}){{9}})", text
    )
    if not m or not r:
        return None
    dg, dl, pg, pl, gp, lp = (float(x) for x in m.groups())
    if abs(pg / dg * 100 - gp) > 0.1 or abs(pl / dl * 100 - lp) > 0.1:
        return None
    vals = [float(x) for x in r.group(1).split()]
    level, inflow, gross, overflow, sluice, ibpt, chph, rbph, godbole, hr = vals
    if abs(gross - pg) > 0.1:
        return None
    return {
        "frl_m": 138.68,
        "level_m": level,
        "design_gross_mcm": dg,
        "design_live_mcm": dl,
        "gross_mcm": pg,
        "live_mcm": pl,
        "gross_pct": gp,
        "live_pct": lp,
        "warning": None,
        "inflow_cusecs": inflow,
        # To the river: overflow, river sluice, the irrigation by-pass tunnel,
        # the river-bed powerhouse and the Godbole gates. The canal-head
        # powerhouse discharges into the Narmada Main Canal, measured at the
        # head regulator as Flow @ HR.
        "outflow_river_cusecs": round(overflow + sluice + ibpt + rbph + godbole, 2),
        "outflow_canal_cusecs": hr,
    }


def parse_report(text: str, cfg: dict) -> dict[str, dict]:
    out = {}
    ssp = parse_sardar_sarovar(text)
    if ssp:
        out[cfg["sardar_sarovar"]] = ssp
    for code, name in cfg["dams"].items():
        row = parse_dam(text, name)
        if row:
            out[code] = row
    return out


def _cusecs(x: float | None) -> int | None:
    # reservoir_daily_v2's flow columns are integer; the report prints decimals.
    return None if x is None else round(x)


def db_rows(city: str, day: date, dams: dict[str, dict]) -> list[dict]:
    return [
        {
            "city_id": city,
            "source_code": code,
            "date": day.isoformat(),
            "storage_tmc": round(d["live_mcm"] / MCUM_PER_TMC, 3),
            "storage_pct_frl": d["live_pct"],
            "level_ft": round(d["level_m"] * FT_PER_M, 2),
            "inflow_cusecs": _cusecs(d["inflow_cusecs"]),
            "outflow_cusecs": None
            if d["outflow_river_cusecs"] is None
            else _cusecs(d["outflow_river_cusecs"] + (d["outflow_canal_cusecs"] or 0)),
            "source": "Gujarat NWRWS&K daily dam report",
            "scraped_from": report_url(day),
        }
        for code, d in sorted(dams.items())
    ]


def upsert(rows: list[dict]) -> None:
    from supabase import create_client

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    for i in range(0, len(rows), 500):
        sb.table("reservoir_daily_v2").upsert(
            rows[i : i + 500], on_conflict="city_id,source_code,date"
        ).execute()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", required=True, choices=sorted(CITIES))
    ap.add_argument("--date", help="YYYY-MM-DD; default today, else yesterday")
    ap.add_argument("--out", help="write the latest report as a JSON artifact")
    ap.add_argument("--backfill-from", help="YYYY-MM-DD; walk the archive to --date")
    ap.add_argument("--supabase", action="store_true", help="upsert reservoir_daily_v2")
    args = ap.parse_args()
    cfg = CITIES[args.city]
    expected = set(cfg["dams"]) | {cfg["sardar_sarovar"]}

    if args.backfill_from:
        day = date.fromisoformat(args.backfill_from)
        end = date.fromisoformat(args.date) if args.date else date.today()
        rows, empty, short = [], 0, []
        while day <= end:
            text = fetch_text(day)
            if text is None or report_date(text) != day:
                empty += 1
            else:
                dams = parse_report(text, cfg)
                if set(dams) != expected:
                    short.append((day.isoformat(), sorted(expected - set(dams))))
                rows.extend(db_rows(args.city, day, dams))
            day += timedelta(days=1)
            time.sleep(0.3)
        print(
            f"backfill: {len(rows)} rows, {empty} days with no report, "
            f"{len(short)} days missing a dam",
            file=sys.stderr,
        )
        for d, miss in short[:20]:
            print(f"  {d}: missing {miss}", file=sys.stderr)
        if args.supabase and rows:
            upsert(rows)
            print(f"upserted {len(rows)} rows", file=sys.stderr)
        return 0

    day = date.fromisoformat(args.date) if args.date else date.today()
    text = fetch_text(day)
    if text is None and not args.date:
        day -= timedelta(days=1)
        text = fetch_text(day)
    if text is None:
        print(f"no report for {day}", file=sys.stderr)
        return 1
    if report_date(text) != day:
        print(f"report is dated {report_date(text)}, asked for {day}", file=sys.stderr)
        return 1
    dams = parse_report(text, cfg)
    missing = expected - set(dams)
    for code, d in sorted(dams.items()):
        print(
            f"  {code:15} level {d['level_m']:8.2f} m  live {d['live_mcm']:8.2f} MCM "
            f"({d['live_pct']}% of live)  gross {d['gross_pct']}%",
            file=sys.stderr,
        )
    if missing:
        print(
            f"MISSING: {sorted(missing)} - the layout may have changed", file=sys.stderr
        )

    if args.out:
        out = {
            "nvdm": "1.0",
            "dataset": "data-root/dam-storage",
            "scope": {"kind": "city", "id": args.city},
            "provenance": {
                "sources": [
                    {
                        "id": SOURCE_ID,
                        "title": f"Daily dam storage report, {day.strftime('%d-%m-%Y')}",
                        "publisher": "Narmada, Water Resources, Water Supply and Kalpsar Department, Government of Gujarat",
                        "license": registry_license(SOURCE_ID),
                    }
                ],
                "method": "pdf-extract",
                "produced_at": date.today().isoformat(),
                "produced_by": "neer-vazhvu-api/scripts/scrape_gujarat_wrd_dams.py",
                "note": "Parsed from the department's daily PDF; each row verified against its own storage arithmetic.",
            },
            "report_date": day.isoformat(),
            "report_url": report_url(day),
            "storage_note": (
                "live_mcm is storage above the lowest outlet; live_pct is it as a share of "
                "designed live capacity. gross_pct is the department's own headline figure."
            ),
            "dams": [{"source_code": c, **d} for c, d in sorted(dams.items())],
        }
        write_artifact(Path(args.out), out)
    if args.supabase:
        upsert(db_rows(args.city, day, dams))
        print(f"upserted {len(dams)} {args.city} rows for {day}", file=sys.stderr)
    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
