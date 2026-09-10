#!/usr/bin/env python3
"""Validate a basin overview's wq-stations against a partner-verified station
set: move every station matched by NWMP code to the verified point, re-derive
its sub-basin, append the river stations the source layer omits, and refresh
the scoreboard's per-sub-basin station count and worst class.

Why: KWRIS's KA:Surface_Water_Quality_Monitoring_Station layer places 20 of
the 35 Cauvery stations more than a kilometre from where they are - Sathegala
bridge 114 km away in the wrong sub-basin, three water-supply intakes 33-37 km
off - and omits ten river stations that report to the NWMP (all three at
Kushalnagar among them). Paani Earth's validated location set
(Cauvery_Basin_in_Karnataka_Monitoring_Locations.gpkg, September 2026) is the
record; the KWRIS offset is kept on each moved feature so the swap is visible.

Runs AFTER ingest_basin_overview.py (which regenerates wq-stations.geojson
from KWRIS). Order against build_basin_wq_readings.py does not matter: the
worst-class rollup is recomputed here from whatever classes the features carry.

Usage:
    python3 scripts/build_basin_wq_positions.py public/data/basins/cauvery-ka \\
        [--gpkg ~/Downloads/Cauvery_Basin_in_Karnataka_Monitoring_Locations.gpkg]
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from collections import Counter
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "scripts"))
from ingest_basin import _read_vector  # noqa: E402  (shared GDAL reader, 4326 output)
from nvdm_write import write_artifact  # noqa: E402

from shapely.geometry import Point, shape  # noqa: E402

GPKG = "Cauvery_Basin_in_Karnataka_Monitoring_Locations.gpkg"
LAYER = "Cauvery_Basin_in_Karnataka_Monitoring_Locations"
CODE_COL = "Water\nQuality Station Code"
NAME_COL = "Name or Location of Monitoring Station"
TYPE_COL = "Type of Water Body"
POSITION_SOURCE = ("Paani Earth Foundation, validated station locations "
                   "(Cauvery Basin in Karnataka monitoring locations, September 2026)")
MOVED_KM = 1.0
# Codes whose partner row does not describe the station the code denotes, so
# the partner point is NOT applied. Checked against CPCB's annual river table.
EXCLUDE = {
    "3580": "Paani Earth's set lists code 3580 as a Shimsha intake at Maddur; CPCB's 2024 "
            "river table names it 'Cauvery at water supply intake point at Shivanasamudra', "
            "as KWRIS does (Malavalli's intake). Position stays as KWRIS publishes it.",
}
CLASS_ORDER = "ABCDE"  # A best .. E worst
# The river a station name opens with, as the NWMP list writes it. A name
# that does not open with one ("D/S OF KUSHALANAGAR TOWN") gets no river.
RIVER_HEAD = {"CAUVERY": "Cauvery", "KABINI": "Kabini", "SHIMSHA": "Shimsha",
              "HEMAVATI": "Hemavathi", "LAKSHMANTIRTHA": "Lakshman Tirtha",
              "SUVARANVATHI": "Suvarnavathi", "YAGACHI": "Yagachi"}


def hav_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(a))


def river_of(name: str) -> str | None:
    m = re.match(r"^(?:D/S OF |U/S OF )?([A-Z]+)\b", name)
    return RIVER_HEAD.get(m.group(1)) if m else None


def tidy_name(raw: str) -> str:
    name = " ".join(str(raw).split()).rstrip(", ")
    return re.sub(r"^(\w+) \1\b", r"\1", name)  # one row doubles its first word


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("basin_dir")
    ap.add_argument("--gpkg", default=str(Path.home() / "Downloads" / GPKG),
                    help="Paani Earth's validated station file (partner data, not in repo)")
    args = ap.parse_args()
    basin_dir = REPO / args.basin_dir
    gpkg = Path(args.gpkg)
    if not gpkg.exists():
        sys.exit(f"Partner GeoPackage not found: {gpkg}")

    partner: dict[str, dict] = {}
    for f in _read_vector(gpkg, LAYER, None):
        p = f.get("properties") or {}
        code, g = p.get(CODE_COL), f.get("geometry")
        if code is None or not g:
            continue
        partner[str(int(code))] = {
            "name": tidy_name(p.get(NAME_COL) or ""),
            "type": str(p.get(TYPE_COL) or "").strip().upper(),
            "lon": round(g["coordinates"][0], 5), "lat": round(g["coordinates"][1], 5),
        }
    print(f"partner set: {len(partner)} coded stations")

    subs = [(f["properties"]["code"], shape(f["geometry"]))
            for f in json.loads((basin_dir / "sub-basins.geojson").read_text())["features"]]
    boundary = shape(json.loads((basin_dir / "boundary.geojson").read_text())["features"][0]["geometry"])

    def sub_of(lon: float, lat: float) -> str | None:
        pt = Point(lon, lat)
        return next((code for code, g in subs if g.contains(pt)), None)

    fp = basin_dir / "wq-stations.geojson"
    fc = json.loads(fp.read_text())
    matched: set[str] = set()
    moved = flipped = 0
    for f in fc["features"]:
        p = f["properties"]
        code = str(p.get("stationCode") or "")
        lon, lat = f["geometry"]["coordinates"]
        if code in EXCLUDE:
            p["positionNote"] = EXCLUDE[code]
            matched.add(code)  # the partner row is neither applied nor appended
            print(f"  kept  KWRIS     {code:5} {p['name']} (partner row excluded)")
        elif code in partner:
            q = partner[code]
            # Idempotent: a feature this step already placed keeps the KWRIS
            # offset it recorded; the offset is only measured against KWRIS.
            if p.get("positionSource") != POSITION_SOURCE:
                off = hav_km(lon, lat, q["lon"], q["lat"])
                p.pop("positionNote", None)
                if off >= MOVED_KM:
                    p["positionNote"] = (f"KWRIS places this station {off:.0f} km from here; "
                                         "the position shown is Paani Earth's validated location.")
                    print(f"  moved {off:6.1f} km  {code:5} {p['name']}")
            if p.get("positionNote"):
                moved += 1
            f["geometry"] = {"type": "Point", "coordinates": [q["lon"], q["lat"]]}
            p["positionSource"] = POSITION_SOURCE
            matched.add(code)
            lon, lat = q["lon"], q["lat"]
        new_sub = sub_of(lon, lat)
        if new_sub is None:
            print(f"  ! {code} {p['name']} falls in no sub-basin polygon; subBasin kept as {p.get('subBasin')}")
        elif new_sub != p.get("subBasin"):
            print(f"  sub-basin {p.get('subBasin')} -> {new_sub}  {code:5} {p['name']}")
            p["subBasin"] = new_sub
            flipped += 1

    added = []
    for code, q in partner.items():
        if code in matched or code in EXCLUDE or q["type"] != "RIVER" \
                or not boundary.contains(Point(q["lon"], q["lat"])):
            continue
        props: dict = {"name": q["name"]}
        river = river_of(q["name"])
        if river:
            props["river"] = river
        props.update({
            "stationCode": code,
            "subBasin": sub_of(q["lon"], q["lat"]),
            "positionSource": POSITION_SOURCE,
            "sourceNote": "Not in the KWRIS station layer; listed and located in Paani Earth's validated set.",
        })
        fc["features"].append({"type": "Feature",
                               "geometry": {"type": "Point", "coordinates": [q["lon"], q["lat"]]},
                               "properties": props})
        added.append(props)
        print(f"  added {code:5} {props['subBasin']}  {q['name']}")
    write_artifact(fp, fc, compact=True)
    print(f"\n{len(matched)} matched ({moved} moved >= {MOVED_KM:g} km, {flipped} changed sub-basin), "
          f"{len(added)} added -> {len(fc['features'])} stations")

    # Scoreboard: station count and worst class per sub-basin follow the features.
    sb_fp = basin_dir / "scoreboard.json"
    sb = json.loads(sb_fp.read_text())
    code_to_key = {code: next((f["properties"].get("scoreboardKey")
                               for f in json.loads((basin_dir / "sub-basins.geojson").read_text())["features"]
                               if f["properties"].get("code") == code), None) for code, _ in subs}
    counts = Counter(f["properties"].get("subBasin") for f in fc["features"])
    worst: dict[str, str] = {}
    class_source: dict[str, str] = {}
    for f in fc["features"]:
        p = f["properties"]
        w, sub = p.get("worstClass"), p.get("subBasin")
        if isinstance(w, str) and w in CLASS_ORDER and sub:
            if sub not in worst or CLASS_ORDER.index(w) > CLASS_ORDER.index(worst[sub]):
                worst[sub] = w
            class_source.setdefault(sub, p.get("readingsSource", ""))
    today = date.today().isoformat()
    for code, key in code_to_key.items():
        if not key or key not in sb["subBasins"]:
            continue
        m = sb["subBasins"][key]["metrics"]
        if counts.get(code, 0) == 0 and "wqStationCount" not in m:
            continue  # a sub-basin the board has never counted stays uncounted, not zeroed
        m["wqStationCount"] = {
            "value": counts.get(code, 0), "unit": "count", "asOf": today,
            "source": "KWRIS KA:Surface_Water_Quality_Monitoring_Station (KSPCB), positions "
                      "validated and the set extended by Paani Earth Foundation (September 2026)",
            "verified": True,
        }
        if code in worst:
            prev = m.get("wqWorstClass") or {}
            m["wqWorstClass"] = {
                "value": worst[code], "unit": "use-based class",
                "asOf": prev.get("asOf", sb.get("asOf")),
                "source": prev.get("source") or class_source.get(code, ""), "verified": True,
            }
        elif "wqWorstClass" in m:
            print(f"  scoreboard: {code} no longer holds a classified station; wqWorstClass dropped")
            del m["wqWorstClass"]
    write_artifact(sb_fp, sb, indent=1)
    print("scoreboard updated:", {c: counts.get(c, 0) for c, _ in subs})

    inv_fp = basin_dir / "inventory.json"
    inv = json.loads(inv_fp.read_text())
    fam = inv["families"]["wq-stations"]
    fam["featureCount"] = len(fc["features"])
    fam["sources"] = [s for s in fam["sources"] if s.get("file") != GPKG]
    fam["sources"].append({
        "file": GPKG, "kind": None,
        "count": sum(1 for f in fc["features"] if f["properties"].get("sourceNote")),
        "provenance": "Paani Earth Foundation's validated station locations (September 2026): every "
                      "KWRIS station matched by NWMP code is moved to the validated point, and the "
                      "river stations the KWRIS layer omits are added from the same set, location-only.",
    })
    fam["bytes"] = fp.stat().st_size
    write_artifact(inv_fp, inv, indent=1)
    print("inventory updated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
