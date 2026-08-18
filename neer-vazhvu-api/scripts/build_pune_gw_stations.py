#!/usr/bin/env python3
"""
Pune district groundwater telemetry stations, from the India-WRIS / NWDP
6-hourly export.

WHY THIS LAYER EXISTS, given the groundwater page draws a taluka choropleth:
the station points ARE the finding. Pune district has 120 telemetric
groundwater stations and 319,345 six-hourly readings, which is genuinely dense
- and exactly ONE of them stands inside the PMC ward boundary: Shivaji
Nagar_1. The other 119 are outside it, most of them in the eastern irrigation
belt around Baramati, Indapur, Purandhar and Daund. Drawn on the map, that is
immediately legible: Maharashtra instruments the farmland and not the city.
It is also why `groundwaterViews.depth` is off for Pune - one in-city station
cannot support a per-ward depth surface.

WHAT IS PUBLISHED HERE IS A DERIVED AGGREGATE, never the upstream rows. Per
station: identity, position, span, reading count, and monthly means of depth.
The 6-hourly series itself is not republished.

THE VALIDITY FILTER, and why a global rule is safe here when it was not for
Kolkata. `reference_wris_groundwater_levels_api` records that WRIS sign
convention is PER STATION - telemetric wells report depth-to-water negative
while manual wells report it positive - and that a global rule cost Kolkata
9,115 readings. That was checked here before assuming: across all 120 Pune
stations, 96.99% of readings are negative, 2.68% positive, 0.34% exactly zero,
and NOT ONE STATION is predominantly positive. This export is uniformly
negative-convention, so a global rule is defensible for it. The check is the
point, not the answer.

Rejected, with counts recorded on the artifact rather than silently dropped:

  * NaN
  * exactly 0.0, +1.0 and -1.0. These are sentinels, not measurements. +1.0
    occurs 3,465 times and -1.0 3,490 times - a symmetry no water table
    produces - and real readings carry two or three decimals (-7.371,
    -8.108). Whole stations sit at a constant 1.0 for months: Medad is 75.8%
    sentinel, Nazare Supe 48.9%.
  * every positive value. Depth below ground cannot be negative-depth under
    this convention, and the positive tail is visibly junk: clusters at +41,
    +43 and +50, and a single +162.37 m.

Run:  python3 neer-vazhvu-api/scripts/build_pune_gw_stations.py \
          --csv-dir "~/Downloads/Pune CSV/Groundwater"
"""

import argparse
import csv
import json
import sys
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

DATA_DIR = REPO_ROOT / "public" / "data"
GEO_DIR = REPO_ROOT / "public" / "geojson"
VALUE_COL = "Groundwater Level Telemetry 6 Hourly (meter)"
SENTINELS = {0.0, 1.0, -1.0}


def load_city_polygons() -> list:
    """Outer rings of the 41 PMC prabhags.

    A BOUNDING BOX IS NOT GOOD ENOUGH HERE, and getting this wrong changes the
    published finding. The PMC ward envelope is a rectangle roughly 18.386 to
    18.622 N by 73.732 to 74.018 E, and counting stations inside THAT returns
    nine - but Pune is nowhere near rectangular, and six of the nine (Bopgaon,
    Dive, Dive_1, Bhivari, Loni-Kand, Somtane Fata) are rural stations in
    Purandhar, Haveli and Maval that merely fall in the box. Tested against the
    actual polygons, exactly ONE station is inside the city: Shivaji Nagar_1.
    """
    fc = json.loads((GEO_DIR / "pune-wards-2025.geojson").read_text())
    out = []
    for f in fc["features"]:
        g = f["geometry"]
        polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        out.extend(p[0] for p in polys)  # outer rings only
    return out


def point_in_ring(lon: float, lat: float, ring: list) -> bool:
    """Standard ray casting."""
    inside = False
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % n]
        if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def parse_ts(s: str):
    try:
        return datetime.strptime(s.strip(), "%d-%m-%Y %H:%M")
    except Exception:
        return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--csv-dir",
        required=True,
        help="directory of India-WRIS gwl_tel_6_hourly_maharashtra*.csv exports",
    )
    ap.add_argument("--district", default="Pune")
    args = ap.parse_args()

    src = Path(args.csv_dir).expanduser()
    files = sorted(src.glob("gwl_tel_*.csv"))
    if not files:
        print(f"no gwl_tel_*.csv under {src}", file=sys.stderr)
        return 1

    st = defaultdict(
        lambda: {
            "lat": None,
            "lng": None,
            "tehsil": None,
            "rl_msl": None,
            "n_raw": 0,
            "n_valid": 0,
            "n_nan": 0,
            "n_sentinel": 0,
            "n_positive": 0,
            "first": None,
            "last": None,
            "monthly": defaultdict(list),
        }
    )
    scanned = 0
    for f in files:
        with f.open(newline="", encoding="utf-8", errors="replace") as fh:
            for row in csv.DictReader(fh):
                scanned += 1
                if (row.get("District") or "").strip().lower() != args.district.lower():
                    continue
                name = (row.get("Station") or "").strip()
                if not name:
                    continue
                d = st[name]
                d["n_raw"] += 1
                try:
                    d["lat"] = float(row["Latitude"])
                    d["lng"] = float(row["Longitude"])
                except Exception:
                    pass
                teh = (row.get("Tehsil") or "").strip()
                if teh and teh != "-":
                    d["tehsil"] = teh.title()
                rl = (row.get("RL_MSL") or "").strip()
                if rl and rl != "-":
                    try:
                        d["rl_msl"] = float(rl)
                    except ValueError:
                        pass

                raw = (row.get(VALUE_COL) or "").strip()
                if raw.lower() in ("", "nan"):
                    d["n_nan"] += 1
                    continue
                try:
                    v = float(raw)
                except ValueError:
                    d["n_nan"] += 1
                    continue
                if v in SENTINELS:
                    d["n_sentinel"] += 1
                    continue
                if v > 0:
                    d["n_positive"] += 1
                    continue

                t = parse_ts(row.get("Data Acquisition Time") or "")
                if t is None:
                    continue
                d["n_valid"] += 1
                d["first"] = min(d["first"], t) if d["first"] else t
                d["last"] = max(d["last"], t) if d["last"] else t
                # Stored as POSITIVE metres below ground level, which is how
                # the map labels it. The raw export is negative.
                d["monthly"][f"{t.year}-{t.month:02d}"].append(-v)

    city_rings = load_city_polygons()
    stations, in_city = [], []
    tot = defaultdict(int)
    for name, d in sorted(st.items()):
        for k in ("n_raw", "n_valid", "n_nan", "n_sentinel", "n_positive"):
            tot[k] += d[k]
        if not d["n_valid"] or d["lat"] is None:
            print(f"  ~ {name}: no valid readings, dropped", file=sys.stderr)
            continue
        inb = any(point_in_ring(d["lng"], d["lat"], r) for r in city_rings)
        if inb:
            in_city.append(name)
        monthly = {
            m: round(sum(v) / len(v), 2) for m, v in sorted(d["monthly"].items())
        }
        depths = [v for vs in d["monthly"].values() for v in vs]
        stations.append(
            {
                "name": name,
                "lat": round(d["lat"], 6),
                "lng": round(d["lng"], 6),
                "agency": "Maharashtra GW",
                "block": d["tehsil"],
                # MUST BE UNIQUE AND NON-NULL. The shared groundwater map keys
                # its station markers on `station_code`, so emitting null for
                # every station made React collide all 120 into one key and log
                # a duplicate-key error per marker. The WRIS 6-hourly CSV
                # export carries no station id column - only the name, which is
                # unique across the district - so the code is derived from it
                # and prefixed to make its provenance obvious.
                "station_code": "MHGW-"
                + "".join(
                    ch if ch.isalnum() else "-" for ch in name.strip().upper()
                ).strip("-"),
                "data_types": "GWLTEL6H",
                "rl_msl_m": d["rl_msl"],
                "in_city_limits": inb,
                "readings": d["n_valid"],
                "rejected": {
                    "nan": d["n_nan"],
                    "sentinel": d["n_sentinel"],
                    "positive": d["n_positive"],
                },
                "from": d["first"].date().isoformat(),
                "to": d["last"].date().isoformat(),
                "depth_min_m_bgl": round(min(depths), 2),
                "depth_max_m_bgl": round(max(depths), 2),
                "monthly_mean_m_bgl": monthly,
            }
        )

    spans = [s["from"] for s in stations] + [s["to"] for s in stations]
    out = {
        "nvdm": "1.0",
        "dataset": "data-root/gw-stations",
        "scope": {"kind": "city", "id": "pune"},
        "provenance": {
            "sources": [
                {
                    "id": "wris-telemetry-pune",
                    "title": (
                        "India-WRIS / National Water Data Portal, Groundwater Level "
                        "Telemetry (6-hourly), Maharashtra GW - Pune district cut"
                    ),
                    "publisher": (
                        "Maharashtra Groundwater Surveys and Development Agency, "
                        "via India-WRIS / NWDP"
                    ),
                    "license": registry_license("wris-telemetry-pune"),
                    # Required at L2 for a `derived` artifact (spec 5.2): a
                    # derived file must name what it was derived FROM.
                    "role": "input",
                }
            ],
            "method": "derived",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/build_pune_gw_stations.py",
            "conventions": {
                "depth_sign": (
                    "The export is negative (depth below ground); this artifact "
                    "publishes POSITIVE metres below ground level. A global rule is "
                    "used here only because it was checked: 96.99% of readings are "
                    "negative and no station of the 120 is predominantly positive, "
                    "unlike Kolkata's mixed per-station convention."
                ),
                "aggregation": (
                    "Monthly means of 6-hourly readings. The 6-hourly series is not "
                    "republished."
                ),
            },
        },
        "source": "India-WRIS / NWDP telemetry (Maharashtra GW)",
        "place_id": "pune",
        "fetched_at": date.today().isoformat(),
        "coverage": {
            "district": args.district,
            "from": min(spans) if spans else None,
            "to": max(spans) if spans else None,
            "cadence_raw": "6-hourly telemetric",
            "cadence_published_here": "monthly mean",
        },
        "summary": {
            "stations": len(stations),
            "stations_in_city_limits": len(in_city),
            "in_city_station_names": sorted(in_city),
            "valid_readings": tot["n_valid"],
            "rejected_nan": tot["n_nan"],
            "rejected_sentinel": tot["n_sentinel"],
            "rejected_positive": tot["n_positive"],
        },
        "_finding": (
            f"{len(stations)} telemetric groundwater stations across {args.district} "
            f"district, and only {len(in_city)} inside the PMC/PCMC envelope. The "
            f"rest instrument the eastern irrigation belt. This is why no per-ward "
            f"urban depth surface is drawn for Pune: the density is real, and it is "
            f"somewhere else."
        ),
        "stations": stations,
    }

    path = DATA_DIR / "gw-stations-pune.json"
    write_artifact(path, out, indent=1)
    print(
        f"pune gw stations: {len(stations)} of {len(st)} kept, "
        f"{len(in_city)} in city ({', '.join(sorted(in_city))}); "
        f"{tot['n_valid']:,} valid, rejected {tot['n_sentinel']:,} sentinel / "
        f"{tot['n_positive']:,} positive / {tot['n_nan']:,} NaN "
        f"-> {path.name}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
