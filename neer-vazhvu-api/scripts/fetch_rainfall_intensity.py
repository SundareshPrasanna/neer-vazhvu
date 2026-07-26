#!/usr/bin/env python3
"""
Hourly rainfall intensity against a city's stated drainage design standard.

Every other rainfall product on the platform is a monthly or daily TOTAL, which
is the wrong unit for drainage. A drain does not fail because 120 mm fell in a
day; it fails because 30 mm fell in an hour. Kolkata's sewers carry a published
design standard - "designed to discharge a rainfall of 6 mm. per hour" (KMC,
Sewerage and Drainage, 2009) - so the honest question is how often the sky beats
that number, which needs SUB-DAILY rainfall we did not previously ingest.

This script fetches hourly precipitation from the Open-Meteo archive (ERA5-family
reanalysis, CC BY 4.0) and precomputes an exceedance ladder: for each year and
each candidate threshold, how many hours exceeded it and across how many distinct
days. The ladder is what lets the hero's threshold slider move without refetching,
and it keeps the payload at tens of KB instead of shipping ~100k hourly values.

IMPORTANT - the honest caveat, which the hero must render:
Reanalysis products smooth short convective bursts, so ERA5-family hourly rates
UNDER-represent exactly the extremes this hero is about. Every count here is a
LOWER BOUND on true exceedance. The number is directionally sound and reproducible;
it is not a rain-gauge measurement. Where a city has in-situ sub-daily gauges
(Hyderabad's 185 TGDPS stations, say), those supersede this.

Run (from repo root):
  python3 neer-vazhvu-api/scripts/fetch_rainfall_intensity.py --city kolkata
  python3 neer-vazhvu-api/scripts/fetch_rainfall_intensity.py --all
"""

import argparse
import json
import sys
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "public" / "data"

# City centre coordinates - keep in lockstep with src/lib/cities/*.ts.
# Only cities whose dashboard actually uses an intensity surface belong here.
CITIES = {
    "kolkata": (22.5726, 88.3639),
}

# Thresholds the hero's slider can select, in mm/hour. Spans Kolkata's 6 mm/h
# British-era standard through the 12-25 mm/h range modern Indian storm-water
# codes use, so the same ladder serves any city adopting this hero.
THRESHOLDS_MM_PER_HOUR = [2, 4, 6, 8, 10, 12, 15, 20, 25, 30]

DEFAULT_START_YEAR = 2000

API = (
    "https://archive-api.open-meteo.com/v1/archive"
    "?latitude={lat}&longitude={lng}&start_date={start}&end_date={end}"
    "&hourly=precipitation&timezone=Asia%2FKolkata"
)


def fetch_hourly(lat: float, lng: float, start: date, end: date):
    """(times, mm) for every hour in the window. One request; the archive
    happily serves multi-decade hourly windows in a single response."""
    url = API.format(lat=lat, lng=lng, start=start.isoformat(), end=end.isoformat())
    with urllib.request.urlopen(url, timeout=300) as resp:
        payload = json.load(resp)
    hourly = payload["hourly"]
    return payload, hourly["time"], hourly["precipitation"]


def build_ladder(times, mm):
    """Exceedance counts per (year, threshold).

    Hours and distinct days are both reported because they answer different
    questions: hours is the exposure, days is how many times the city had a bad
    day. A single 6-hour storm is 6 hours but 1 day.
    """
    per_year_hours = {t: defaultdict(int) for t in THRESHOLDS_MM_PER_HOUR}
    per_year_days = {t: defaultdict(set) for t in THRESHOLDS_MM_PER_HOUR}
    years = set()

    for ts, v in zip(times, mm):
        if v is None:
            continue
        year = int(ts[:4])
        years.add(year)
        for t in THRESHOLDS_MM_PER_HOUR:
            if v > t:
                per_year_hours[t][year] += 1
                per_year_days[t][year].add(ts[:10])

    rows = []
    for t in THRESHOLDS_MM_PER_HOUR:
        for year in sorted(years):
            rows.append(
                {
                    "threshold_mm_per_hour": t,
                    "year": year,
                    "hours": per_year_hours[t][year],
                    "days": len(per_year_days[t][year]),
                }
            )
    return rows, sorted(years)


def wettest_hours(times, mm, n=10):
    pairs = [(ts, v) for ts, v in zip(times, mm) if v is not None]
    pairs.sort(key=lambda x: -x[1])
    return [{"hour": ts, "mm": round(v, 1)} for ts, v in pairs[:n]]


def monthly_share(times, mm, threshold):
    """Which months the exceedance hours land in. Kolkata's answer is 'the
    monsoon', but stating it from the data beats asserting it."""
    counts = defaultdict(int)
    for ts, v in zip(times, mm):
        if v is not None and v > threshold:
            counts[int(ts[5:7])] += 1
    return [{"month": m, "hours": counts.get(m, 0)} for m in range(1, 13)]


def run_city(city: str, start_year: int, anchor: int) -> bool:
    lat, lng = CITIES[city]
    start = date(start_year, 1, 1)
    # The archive lags a few days; ask to yesterday and take what comes back.
    end = date.today()

    payload, times, mm = fetch_hourly(lat, lng, start, end)
    if not times:
        print(f"{city}: archive returned no hours", file=sys.stderr)
        return False

    rows, years = build_ladder(times, mm)
    observed = [v for v in mm if v is not None]

    # Complete calendar years only: a part-year would read as a fall in
    # exceedance when it is really just an unfinished year.
    complete_years = [y for y in years if y < date.today().year]

    anchor_rows = [
        r for r in rows if r["threshold_mm_per_hour"] == anchor and r["year"] in complete_years
    ]
    mean_hours = (
        round(sum(r["hours"] for r in anchor_rows) / len(anchor_rows), 1)
        if anchor_rows
        else 0.0
    )
    mean_days = (
        round(sum(r["days"] for r in anchor_rows) / len(anchor_rows), 1)
        if anchor_rows
        else 0.0
    )

    out = {
        "city": city,
        "source": "Open-Meteo archive API (ERA5-family reanalysis), hourly precipitation",
        "attribution": "Weather data by Open-Meteo.com (CC BY 4.0)",
        "url": "https://open-meteo.com/",
        "generated_at": date.today().isoformat(),
        "grid_point": {
            "latitude": payload.get("latitude"),
            "longitude": payload.get("longitude"),
            "elevation_m": payload.get("elevation"),
        },
        "coverage": {
            "from": times[0],
            "to": times[-1],
            "hours": len(times),
            "complete_years": complete_years,
        },
        "limitation": (
            "Reanalysis smooths short convective bursts, so these hourly rates "
            "under-represent the extremes this measure is about. Every count is a "
            "LOWER BOUND on true exceedance, not a rain-gauge reading."
        ),
        "anchor_threshold_mm_per_hour": anchor,
        "summary": {
            "mean_hours_per_year": mean_hours,
            "mean_days_per_year": mean_days,
            "wettest_hour": wettest_hours(times, mm, 1)[0] if observed else None,
            "monthly_hours": monthly_share(times, mm, anchor),
        },
        "thresholds_mm_per_hour": THRESHOLDS_MM_PER_HOUR,
        "exceedance": rows,
        "wettest_hours": wettest_hours(times, mm, 10),
    }

    path = DATA_DIR / f"rainfall-intensity-{city}.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(
        f"{city}: {len(times)} hours {times[0][:10]}..{times[-1][:10]}; "
        f"at {anchor} mm/h mean {mean_hours} h/yr over {len(complete_years)} "
        f"complete years -> {path.name}",
        file=sys.stderr,
    )
    return True


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", choices=sorted(CITIES))
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--start-year", type=int, default=DEFAULT_START_YEAR)
    ap.add_argument(
        "--anchor",
        type=int,
        default=6,
        help="design standard in mm/hour used for the summary block",
    )
    args = ap.parse_args()
    if args.anchor not in THRESHOLDS_MM_PER_HOUR:
        print(
            f"--anchor {args.anchor} is not on the ladder {THRESHOLDS_MM_PER_HOUR}",
            file=sys.stderr,
        )
        return 2
    cities = sorted(CITIES) if args.all else [args.city or "kolkata"]
    ok = True
    for c in cities:
        try:
            run_city(c, args.start_year, args.anchor)
        except Exception as exc:  # noqa: BLE001 - one city must not sink the run
            print(f"{c}: FAILED {exc}", file=sys.stderr)
            ok = False
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
