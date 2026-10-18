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
      python3 neer-vazhvu-api/scripts/build_nwdp_gw_stations.py --city nagpur
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
        # The state agency named in the provenance title, beside CGWB.
        "state_agency": "Gujarat Surface Water and Ground Water Department",
        "well_type": "Telemetric piezometers (state and CGWB)",
        "unit_label": "taluka",
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
    "nagpur": {
        "district_label": "Nagpur",
        "source_id": "nwic-nwdp-groundwater-maharashtra",
        "state_agency": "Maharashtra Groundwater Surveys and Development Agency (GSDA)",
        # GSDA's are digital recorders in dug wells and piezometers (National
        # Hydrology Project and Atal Bhujal; India-WRIS lists 12 of the NHP
        # stations as dug wells); CGWB's are semi-confined piezometers
        # 23.5-69.5 m deep (the ten in the district).
        "well_type": (
            "Telemetric recorders in GSDA dug wells and piezometers, and CGWB piezometers"
        ),
        "aquifer": (
            "Not published per station on this portal; India-WRIS lists the ten "
            "CGWB piezometers in the district as semi-confined, 23.5 to 69.5 m deep"
        ),
        "unit_label": "taluka",
        # Telemetry only: CGWB manual quarterly stops in May 2023 here and its
        # 2026-2030 resource is empty; GSDA's manual monthly resource has a
        # different row shape (positive-down, `Date of Monitoring`).
        "resources": {
            "Maharashtra GW": [
                "5b0a8a48-83cf-4ffd-8cf2-5e299e51dc60",  # 2021-2025
                "7a821ef4-b73b-4243-9a42-4f1a6f300230",  # 2026-2030
            ],
            "CGWB": [
                "2da4e849-2249-4e15-a609-a6166e30a300",  # 2021-2025
                "53d52a41-1853-449a-b54c-566054a5ad58",  # 2026-2030
            ],
        },
        # Wardha, Bhandara, Chandrapur, Gondia and Amravati tags were checked:
        # none places inside the district, so Nagpur's own tag is enough.
        "district_tags": ["Nagpur"],
        "units": "public/geojson/nagpur-gwr-blocks.geojson",
        "start": "2021-01-01",
        # Per-station notes shown on the station panel. Both series pass the
        # shared quality rules but carry features the portal does not explain.
        "quality_notes": {
            # Six negative monthly means: 2025-07 -0.14, 2026-05 -0.23,
            # 2026-06 -0.62, 2026-07 -0.55, 2026-08 -0.40, 2026-09 -0.40.
            "Paradsinga_1": (
                "From July 2025 this station's readings drift above ground level: six "
                "monthly means are below zero (July 2025, and May, June, July, August "
                "and September 2026). The portal gives no reason, so these months "
                "should not be read as water standing above the ground."
            ),
            # Monthly means 34.00 (Apr 2023) -> 23.08 (May) -> 9.45 (Jun 2023);
            # 9.53 (Jan 2024) -> 31.37 (Feb 2024).
            "Khairi (Kh)": (
                "The level steps from about 34 m to about 9 m below ground between "
                "April and June 2023, and back to about 31 m in February 2024. The "
                "portal does not explain either step, so compare readings only "
                "within each stretch."
            ),
        },
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
        note = cfg.get("quality_notes", {}).get(name)
        if note:
            wells[-1]["quality_note"] = note

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
                        f"Groundwater level telemetry, {label} district: "
                        f"{cfg['state_agency']} and CGWB six-hourly "
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
        "well_type": cfg["well_type"],
        "aquifer": cfg.get(
            "aquifer",
            "Not published per station; shallow and deep piezometers sit side by side",
        ),
        "depth_unit": "metres below ground level (monthly mean)",
        "series_label": "NWDP telemetry",
        "reading_kind": "monthly means",
        "unit_label": cfg["unit_label"],
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
