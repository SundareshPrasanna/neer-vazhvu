#!/usr/bin/env python3
"""
Groundwater telemetry stations for a city's groundwater map, from the NWIC
National Water Data Portal (nwdp.nwic.gov.in, CKAN), as monthly means.

City-generic: a city is an entry in CITIES - which resources, which district
tags to ask for, and which assessment-unit polygons to place stations in.

PLACED BY COORDINATES, NEVER BY THE DISTRICT TAG. NWDP tags follow old
district lines: for Ahmedabad, eight CGWB stations tagged "Ahmedabad" sit in
today's Botad, and stations tagged Gandhinagar, Surendranagar and Sabarkantha
sit inside Ahmedabad's talukas. So the query asks for the neighbouring tags
too, and a station is kept only if it falls inside one of the city's IN-GRES
unit polygons (public/geojson/<city>-gwr-blocks.geojson), which also gives it
its `block`.

WHAT IS PUBLISHED IS A DERIVED AGGREGATE: per station, identity, position,
unit, and monthly means of depth below ground. The six-hourly rows are not
republished. Readings pass the platform's shared quality rules
(app/scrapers/well_levels.py): placeholders out, sign from the station's own
median, the physical envelope, single-day spikes and stuck sensors. Rejected
counts are recorded on each station rather than dropped silently.

Shallow and deep piezometers stand side by side in the same neighbourhoods
(Ahmedabad's in-city stations read anywhere from about 10 m to over 130 m), so
nothing here averages stations into one city level.

Run:  python3 neer-vazhvu-api/scripts/build_nwdp_gw_stations.py --city ahmedabad
"""

import argparse
import json
import sys
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path
from statistics import mean

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
sys.path.insert(0, str(REPO_ROOT / "neer-vazhvu-api"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402
from app.scrapers.well_levels import keep_mask, spike_mask, stuck_days  # noqa: E402

API = "https://nwdp.nwic.gov.in/api/3/action/datastore_search"
PAGE = 32000
# NWDP also writes -1.0 for a missed reading in the Gujarat state series
# (one Ahmedabad piezometer is -1.0 end to end), beside WIMS's 0.0 and 1.0.
PLACEHOLDERS = frozenset({0.0, 1.0, -1.0})

CITIES = {
    "ahmedabad": {
        "district_label": "Ahmedabad",
        "source_id": "nwic-nwdp-groundwater-gujarat",
        # Telemetry only: the manual quarterly series stop in 2020 (state) and
        # May 2023 (CGWB) for this district, and the 2026-2030 CGWB manual
        # resource is empty.
        "resources": {
            "Gujarat SW GW": [
                "8e630b14-b563-40c8-905f-b0ce28975a90",  # 2021-2025
                "9f8ca997-e764-4503-9253-872a2d692aec",  # 2026-2030
            ],
            "CGWB": [
                "6ea9ef6b-8a90-47d0-bd12-ac90272a2650",  # 2021-2025
                "b496e769-a678-4948-bd91-de3894fb9471",  # 2026-2030
            ],
        },
        "district_tags": ["Ahmedabad", "Gandhinagar", "Surendranagar", "Sabarkantha"],
        "units": "public/geojson/ahmedabad-gwr-blocks.geojson",
        "start": "2021-01-01",
    },
}


def _get(params: dict, tries: int = 4) -> dict:
    url = API + "?" + urllib.parse.urlencode(params)
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "neer-vazhvu"})
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.loads(r.read().decode())["result"]
        except Exception as exc:
            if attempt == tries - 1:
                raise
            print(f"  retry {attempt + 1}: {exc}", file=sys.stderr)
            time.sleep(5 * (attempt + 1))
    raise RuntimeError("unreachable")


def fetch(resource_id: str, district: str) -> list[dict]:
    rows, offset = [], 0
    while True:
        res = _get(
            {
                "resource_id": resource_id,
                "filters": json.dumps({"District": district}),
                "limit": PAGE,
                "offset": offset,
            }
        )
        rows.extend(res["records"])
        if len(res["records"]) < PAGE:
            return rows
        offset += PAGE


def _in_ring(x: float, y: float, ring: list) -> bool:
    inside = False
    for i in range(len(ring) - 1):
        x1, y1 = ring[i][:2]
        x2, y2 = ring[i + 1][:2]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def unit_of(lon: float, lat: float, units: list) -> str | None:
    for name, polys in units:
        for poly in polys:
            if _in_ring(lon, lat, poly[0]) and not any(
                _in_ring(lon, lat, h) for h in poly[1:]
            ):
                return name
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", required=True, choices=sorted(CITIES))
    city = ap.parse_args().city
    cfg = CITIES[city]
    start = date.fromisoformat(cfg["start"])

    fc = json.loads((REPO_ROOT / cfg["units"]).read_text())
    units = [
        (
            f["properties"]["block"],
            [f["geometry"]["coordinates"]]
            if f["geometry"]["type"] == "Polygon"
            else f["geometry"]["coordinates"],
        )
        for f in fc["features"]
    ]

    series: dict[tuple, dict] = {}
    fetched = 0
    for agency, resource_ids in cfg["resources"].items():
        for rid in resource_ids:
            for tag in cfg["district_tags"]:
                rows = fetch(rid, tag)
                fetched += len(rows)
                print(f"  {agency} {rid[:8]} {tag}: {len(rows)} rows", file=sys.stderr)
                for r in rows:
                    try:
                        lat, lon = float(r["Latitude"]), float(r["Longitude"])
                        ts = datetime.strptime(
                            r["Data Acquisition Time"], "%d-%m-%Y %H:%M"
                        )
                        field = next(k for k in reversed(list(r)) if "Level" in k)
                        value = float(r[field])
                    except (KeyError, TypeError, ValueError, StopIteration):
                        continue
                    if ts.date() < start:
                        continue
                    # Names repeat across districts (Gunjala, Kerala_1), so the
                    # key carries the position as well as the name.
                    key = (
                        r["Station"].strip(),
                        r["Agency"],
                        round(lat, 5),
                        round(lon, 5),
                    )
                    s = series.setdefault(key, {"tag": r["District"], "obs": {}})
                    s["obs"][ts] = value  # resources overlap at their seams

    wells, outside = [], 0
    for (name, agency, lat, lon), s in sorted(series.items()):
        block = unit_of(lon, lat, units)
        if block is None:
            outside += 1
            continue
        stamps = sorted(s["obs"])
        values = [s["obs"][t] for t in stamps]
        ok = keep_mask(values, PLACEHOLDERS)
        kept = [(t, v) for t, v, k in zip(stamps, values, ok) if k]
        sign = -1.0 if kept and sorted(v for _, v in kept)[len(kept) // 2] < 0 else 1.0
        depths = [(t, sign * v) for t, v in kept]
        spikes = spike_mask([t.date() for t, _ in depths], [d for _, d in depths])
        depths = [p for p, k in zip(depths, spikes) if k]
        daily: dict[date, list] = defaultdict(list)
        for t, d in depths:
            daily[t.date()].append(d)
        stuck = stuck_days({day: mean(v) for day, v in daily.items()})
        monthly: dict[tuple, list] = defaultdict(list)
        for day, v in daily.items():
            if day not in stuck:
                monthly[(day.year, day.month)].extend(v)
        if not monthly:
            continue
        readings = [
            {"year": y, "month": m, "depth_m_bgl": round(mean(v), 2), "n_obs": len(v)}
            for (y, m), v in sorted(monthly.items())
        ]
        latest = readings[-1]
        wells.append(
            {
                "name": name,
                "station_code": f"{agency}:{name}",
                "lat": lat,
                "lng": lon,
                "block": block,
                "agency": agency,
                "district_tag": s["tag"],
                "acquisition": "telemetry",
                "readings": readings,
                "depth_latest_m_bgl": latest["depth_m_bgl"],
                "latest_reading": f"{latest['year']}-{latest['month']:02d}",
                "raw_observations": len(values),
                "rejected_observations": len(values)
                - sum(r["n_obs"] for r in readings),
            }
        )

    if not wells:
        print("no stations placed - check the unit polygons", file=sys.stderr)
        return 1
    produced = date.today().isoformat()
    label = cfg["district_label"]
    out = {
        "nvdm": "1.0",
        "dataset": "data-root/cgwb-stations",
        "scope": {"kind": "city", "id": city},
        "provenance": {
            "sources": [
                {
                    "id": cfg["source_id"],
                    "title": (
                        f"Groundwater level telemetry, {label} district: Gujarat "
                        "Surface Water and Ground Water Department and CGWB six-hourly "
                        "resources on the National Water Data Portal"
                    ),
                    "publisher": "National Water Informatics Centre (NWIC), Ministry of Jal Shakti",
                    "license": registry_license(cfg["source_id"]),
                }
            ],
            "method": "api",
            "produced_at": produced,
            "produced_by": "neer-vazhvu-api/scripts/build_nwdp_gw_stations.py",
            "note": (
                "Monthly means of six-hourly telemetry per station, after the shared "
                "quality rules; stations placed by coordinates in the IN-GRES unit "
                "polygons, not by their district tag."
            ),
        },
        "district": label,
        "well_type": "Telemetric piezometers (state and CGWB)",
        "aquifer": "Not published per station; shallow and deep piezometers sit side by side",
        "depth_unit": "metres below ground level (monthly mean)",
        "series_label": "NWDP telemetry",
        "reading_kind": "monthly means",
        "unit_label": "taluka",
        "cadence_note": (
            "Telemetric recorders reading every six hours; shown as monthly means. "
            "Months with no reading that passed the quality rules are absent, not zero."
        ),
        "source_label": "National Water Data Portal (NWIC)",
        "source_url": "https://nwdp.nwic.gov.in/",
        "ext": {
            "coverage": {
                "from": cfg["start"],
                "stations": len(wells),
                "raw_rows_fetched": fetched,
                "stations_outside_district": outside,
            }
        },
        "wells": wells,
    }
    path = REPO_ROOT / "public" / "data" / f"{city}-cgwb-stations.json"
    write_artifact(path, out, compact=True)
    by_unit = defaultdict(int)
    for w in wells:
        by_unit[w["block"]] += 1
    print(
        f"{city}: {len(wells)} stations placed ({outside} outside), "
        f"latest {max(w['latest_reading'] for w in wells)} -> {path.name}",
        file=sys.stderr,
    )
    for u, n in sorted(by_unit.items()):
        print(f"  {u:26} {n}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
