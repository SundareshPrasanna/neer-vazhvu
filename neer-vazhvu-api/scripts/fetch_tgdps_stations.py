#!/usr/bin/env python3
"""
Fetch the TGDPS automatic-weather-station network inside Greater Hyderabad.

WHY THIS IS A CAPABILITY STEP-CHANGE, NOT A PARITY ITEM
-------------------------------------------------------
Every other city on the platform interpolates rainfall from ONE IMD gridded
cell (0.25 degrees, ~28 km) plus an Open-Meteo daily fill. Hyderabad does not
have to. The Telangana Development Planning Society, a Planning Department
body, runs the state hydro-met network and exposes **185 automatic weather
stations inside GHMC_CMC_MMC**, each with its own coordinates and daily
cumulative rainfall.

That means Hyderabad can carry a MEASURED intra-city rainfall surface instead
of a single interpolated value - and, downstream, a per-lake catchment rainfall
input that is observed rather than modelled. For a city whose flooding is
famously localised (the 2020 events, the nala-encroachment cases), a single
grid cell is close to useless.

Source
------
  Station list : https://tgdps.telangana.gov.in/GHMC.jsp
                 an HTML image-map; each station is an <area> whose href is
                 values.jsp?s1=<awsId>. The map also carries non-station
                 chrome, so ids are deduped and validated by fetching.
  Station data : https://tgdps.telangana.gov.in/values.jsp?s1=<awsId>
                 plain HTML, no auth, returns AWS ID, location name, mandal,
                 LATITUDE, LONGITUDE, date, daily cumulative rainfall (mm),
                 temperature max/min, humidity max/min, wind speed max/min.

WHAT THIS SCRIPT DOES AND DOESN'T DO
------------------------------------
`values.jsp` returns only the LATEST reading per station - there is no date
parameter and no archive behind it. So this builds the station REGISTRY
(id, name, mandal, lat, lon) plus a snapshot of the most recent observation.
Running it daily is what accumulates a series; a historical backfill would
have to come from the annual bulk files on data.telangana.gov.in, which is a
separate job.

Politeness: ~185 sequential requests against a state government JSP box.
Default --sleep 0.3 and a hard cap on concurrency of one.

Run
---
    cd neer-vazhvu-api
    python3 scripts/fetch_tgdps_stations.py --out ../public/data/hyderabad-aws-stations.json
"""

import argparse
import html
import json
import re
import ssl
import sys
import time
import urllib.request
from datetime import date

MAP_URL = "https://tgdps.telangana.gov.in/GHMC.jsp"
STATION_URL = "https://tgdps.telangana.gov.in/values.jsp?s1={sid}"

CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

# Labels as printed in the values.jsp table, mapped to our field names. The
# page is a label/value table with no ids, so the label text IS the contract -
# if TGDPS relabels a row this parser must be updated, and an unmatched label
# is reported rather than silently dropped.
FIELDS = {
    "AWS ID": "aws_id",
    "AWS Location": "location",
    "Mandal Name": "mandal",
    "Latitude": "latitude",
    "Longitude": "longitude",
    "Date": "reading_date",
    "Rainfall* (mm)": "rainfall_mm",
    "Temperature(°C)(max/min)": "temperature_c",
    "Humidity(%)(max/min)": "humidity_pct",
    "Wind Speed(kmph)(max/min)": "wind_kmph",
}


def _get(url: str, timeout: int = 60) -> str:
    req = urllib.request.Request(
        url, headers={"User-Agent": "Mozilla/5.0 neervazhvu-tgdps"}
    )
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as resp:
        return resp.read().decode("utf8", "ignore")


def station_ids(page: str) -> list:
    ids = []
    for m in re.finditer(r'href="values\.jsp\?s1=(\d+)"', page):
        sid = m.group(1)
        if sid not in ids:
            ids.append(sid)
    return ids


def _clean(v: str) -> str:
    # values.jsp pads max/min cells with newlines and spaces around the slash.
    return re.sub(r"\s+", "", html.unescape(v)).strip()


def parse_station(page: str) -> dict:
    cells = [
        html.unescape(re.sub(r"<[^>]+>", "", c)).strip()
        for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", page, flags=re.S | re.I)
    ]
    out, unknown = {}, []
    i = 0
    while i < len(cells) - 1:
        label = re.sub(r"\s+", " ", cells[i]).strip().rstrip(":")
        if label in FIELDS:
            out[FIELDS[label]] = _clean(cells[i + 1])
            i += 2
            continue
        if label and re.match(r"^[A-Za-z].*\(", label) and label not in FIELDS:
            unknown.append(label)
        i += 1
    if unknown:
        out["_unrecognised_labels"] = sorted(set(unknown))
    return out


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _maxmin(v):
    """'32.1/24.4' -> (32.1, 24.4). Returns (None, None) when unparseable."""
    if not v or "/" not in v:
        return None, None
    a, _, b = v.partition("/")
    return _num(a), _num(b)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", help="write JSON here")
    ap.add_argument("--sleep", type=float, default=0.3)
    ap.add_argument("--limit", type=int, help="only fetch N stations (smoke test)")
    args = ap.parse_args()

    ids = station_ids(_get(MAP_URL, timeout=120))
    print(f"GHMC image-map lists {len(ids)} station ids", file=sys.stderr)
    if args.limit:
        ids = ids[: args.limit]

    stations, failed, unrecognised = [], [], set()
    for n, sid in enumerate(ids, 1):
        try:
            rec = parse_station(_get(STATION_URL.format(sid=sid)))
        except Exception as exc:  # noqa: BLE001 - one dead station must not kill the run
            failed.append({"aws_id": sid, "error": str(exc)[:80]})
            continue
        unrecognised.update(rec.pop("_unrecognised_labels", []))
        lat, lon = _num(rec.get("latitude")), _num(rec.get("longitude"))
        if lat is None or lon is None:
            failed.append({"aws_id": sid, "error": "no coordinates"})
            continue
        tmax, tmin = _maxmin(rec.get("temperature_c"))
        hmax, hmin = _maxmin(rec.get("humidity_pct"))
        wmax, wmin = _maxmin(rec.get("wind_kmph"))
        stations.append(
            {
                "aws_id": rec.get("aws_id") or sid,
                "location": rec.get("location", ""),
                "mandal": rec.get("mandal", ""),
                "latitude": lat,
                "longitude": lon,
                "reading_date": rec.get("reading_date", ""),
                "rainfall_mm": _num(rec.get("rainfall_mm")),
                "temp_max_c": tmax,
                "temp_min_c": tmin,
                "humidity_max_pct": hmax,
                "humidity_min_pct": hmin,
                "wind_max_kmph": wmax,
                "wind_min_kmph": wmin,
            }
        )
        if n % 40 == 0:
            print(f"  ... {n}/{len(ids)}", file=sys.stderr)
        time.sleep(args.sleep)

    if not stations:
        print("TGDPS: no stations parsed", file=sys.stderr)
        return 1

    lats = [s["latitude"] for s in stations]
    lons = [s["longitude"] for s in stations]
    rain = [s["rainfall_mm"] for s in stations if s["rainfall_mm"] is not None]
    dates = sorted({s["reading_date"] for s in stations if s["reading_date"]})

    out = {
        "_source": "Telangana Development Planning Society (TGDPS) automatic weather stations",
        "_source_url": MAP_URL,
        "_licence": "Telangana government publication, cited with attribution",
        "_fetched": date.today().isoformat(),
        "_note": (
            "185-odd AWS inside GHMC_CMC_MMC, each with coordinates and daily cumulative "
            "rainfall. This is a MEASURED intra-city rainfall surface - every other city on "
            "the platform interpolates from a single IMD 0.25-degree grid cell. "
            "values.jsp exposes only the LATEST reading per station with no date parameter, "
            "so this file is the station registry plus a snapshot; running it daily is what "
            "builds a series. Historical bulk lives on data.telangana.gov.in."
        ),
        "station_count": len(stations),
        "reading_dates": dates,
        "bbox": {
            "south": min(lats), "north": max(lats),
            "west": min(lons), "east": max(lons),
        },
        "snapshot": {
            "stations_reporting_rain": sum(1 for r in rain if r > 0),
            "max_rainfall_mm": max(rain) if rain else None,
            "mean_rainfall_mm": round(sum(rain) / len(rain), 2) if rain else None,
        },
        "stations": sorted(stations, key=lambda s: s["aws_id"]),
    }
    if failed:
        out["_failed"] = failed
    if unrecognised:
        out["_unrecognised_labels"] = sorted(unrecognised)

    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            json.dump(out, fh, ensure_ascii=False, indent=1)

    print(
        f"TGDPS: {len(stations)} stations with coordinates"
        + (f", {len(failed)} failed" if failed else ""),
        file=sys.stderr,
    )
    print(
        f"   bbox {out['bbox']['south']:.3f}-{out['bbox']['north']:.3f} N, "
        f"{out['bbox']['west']:.3f}-{out['bbox']['east']:.3f} E",
        file=sys.stderr,
    )
    print(f"   reading date(s): {', '.join(dates) or 'none'}", file=sys.stderr)
    if rain:
        print(
            f"   snapshot rainfall: {out['snapshot']['stations_reporting_rain']} of "
            f"{len(rain)} stations >0 mm, max {max(rain)} mm",
            file=sys.stderr,
        )
    if unrecognised:
        print(f"   !! unrecognised labels: {sorted(unrecognised)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
