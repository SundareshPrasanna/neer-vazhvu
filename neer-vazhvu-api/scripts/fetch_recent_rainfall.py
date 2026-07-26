#!/usr/bin/env python3
"""
Daily provisional rainfall for the months IMD's gridded product hasn't
covered yet.

The dashboard's rainfall backbone is IMD gridded (generate_imd_rainfall.py):
authoritative history + normals, but published weeks-to-a-year late and
refreshed quarterly - so in July the chart could end the previous December,
missing the entire current monsoon. This script fills the gap from the
Open-Meteo archive API (ERA5-family reanalysis, updated daily, CC BY 4.0):
daily precipitation for the city's coordinates from the month after IMD's
last covered month through yesterday, aggregated to calendar months and
written to public/data/rainfall-recent-{cityId}.json.

The chart merges these months in as PROVISIONAL (labelled as such) and they
are naturally superseded whenever the quarterly IMD refresh extends the
authoritative series - the merge in rainfall-trends.tsx always prefers IMD.

Run (from repo root):
  python3 neer-vazhvu-api/scripts/fetch_recent_rainfall.py --city mumbai
  python3 neer-vazhvu-api/scripts/fetch_recent_rainfall.py --all
"""

import argparse
import json
import sys
import urllib.request
from datetime import date, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "public" / "data"

# City centre coordinates - keep in lockstep with src/lib/cities/*.ts.
CITIES = {
    "chennai": (13.0827, 80.2707),
    "madurai": (9.9252, 78.1198),
    "bangalore": (12.9716, 77.5946),
    "mumbai": (19.0760, 72.8777),
    "delhi": (28.6100, 77.2100),
    # Matches the IMD gridded point in generate_imd_rainfall.py, not the city
    # centre: the provisional months must continue the same series they fill.
    "kolkata": (22.5000, 88.2500),
}

API = (
    "https://archive-api.open-meteo.com/v1/archive"
    "?latitude={lat}&longitude={lng}&start_date={start}&end_date={end}"
    "&daily=precipitation_sum&timezone=Asia%2FKolkata"
)


def imd_last_month(city: str):
    """(year, month) of the last row in the city's IMD gridded JSON."""
    name = (
        "imd-rainfall-monthly.json"
        if city == "chennai"
        else f"imd-rainfall-monthly-{city}.json"
    )
    path = DATA_DIR / name
    d = json.loads(path.read_text())
    last = max(d["monthly"], key=lambda m: (m["year"], m["month"]))
    return last["year"], last["month"]


def fetch_daily(lat: float, lng: float, start: date, end: date):
    url = API.format(lat=lat, lng=lng, start=start.isoformat(), end=end.isoformat())
    with urllib.request.urlopen(url, timeout=60) as resp:
        payload = json.load(resp)
    days = payload["daily"]["time"]
    mm = payload["daily"]["precipitation_sum"]
    return [{"date": d, "mm": round(v, 1)} for d, v in zip(days, mm) if v is not None]


def run_city(city: str) -> bool:
    lat, lng = CITIES[city]
    y, m = imd_last_month(city)
    start = date(y + (m == 12), (m % 12) + 1, 1)
    end = date.today() - timedelta(days=1)  # archive is complete through yesterday
    if start > end:
        print(
            f"{city}: IMD already covers through {y}-{m:02d}; nothing to fill",
            file=sys.stderr,
        )
        return False

    daily = fetch_daily(lat, lng, start, end)
    monthly = {}
    for row in daily:
        key = row["date"][:7]
        monthly[key] = round(monthly.get(key, 0.0) + row["mm"], 1)
    last_complete = f"{end.year}-{end.month:02d}" if end == _month_end(end) else None
    monthly_rows = [
        {
            "year": int(k[:4]),
            "month": int(k[5:7]),
            "rainfall_mm": v,
            # a month is complete once its final day is in the archive window
            "complete": k < f"{end.year}-{end.month:02d}" or last_complete == k,
        }
        for k, v in sorted(monthly.items())
    ]

    out = {
        "source": "Open-Meteo archive API (ERA5-family reanalysis), daily precipitation",
        "attribution": "Weather data by Open-Meteo.com (CC BY 4.0)",
        "url": "https://open-meteo.com/",
        "generated_at": date.today().isoformat(),
        "provisional_note": (
            "These months are provisional: reanalysis-grade daily rainfall filling the "
            "gap after IMD's last published gridded month. They are replaced by IMD's "
            "authoritative values as the quarterly refresh catches up."
        ),
        "imd_covers_through": f"{y}-{m:02d}",
        "through": end.isoformat(),
        "monthly": monthly_rows,
        "daily": daily,
    }
    path = DATA_DIR / f"rainfall-recent-{city}.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(
        f"{city}: filled {len(monthly_rows)} months ({start} .. {end}), "
        f"{len(daily)} daily rows -> {path.name}",
        file=sys.stderr,
    )
    return True


def _month_end(d: date) -> date:
    nxt = date(d.year + (d.month == 12), (d.month % 12) + 1, 1)
    return nxt - timedelta(days=1)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", choices=sorted(CITIES))
    ap.add_argument("--all", action="store_true")
    args = ap.parse_args()
    cities = sorted(CITIES) if args.all else [args.city or "mumbai"]
    ok = True
    for c in cities:
        try:
            run_city(c)
        except Exception as e:  # noqa: BLE001 - one city failing shouldn't kill the rest
            print(f"{c}: FAILED - {e}", file=sys.stderr)
            ok = False
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
