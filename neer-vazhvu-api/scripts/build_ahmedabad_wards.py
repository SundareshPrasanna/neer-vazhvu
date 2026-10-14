#!/usr/bin/env python3
"""
Ahmedabad's 48 municipal wards, from AMC's own map.

THE GEOMETRY IS AMC'S. The corporation's "Know Your Ward" link opens its City
Map app (inhouse-amcmodules.ahmedabadcity.gov.in:8023), whose JavaScript
bundle carries the ward layer as an embedded GeoJSON literal named
`Ward_Boundary`: 48 wards in 7 zones. AMC publishes no WMS, WFS or REST ward
service, so this is the only official geometry, and the script reads it from
the live app rather than a saved copy.

It matches the State Election Commission's final delimitation of 3 Oct 2020
(48 wards, 192 councillors, used again for the 2026 polls), including the
areas added to AMC on 18 Jun 2020 - Bopal falls in wards 19 and 20, Ghuma in
33, Kathwada in 24. The OpenCity "2024" KML in the research drop predates that
extension (it has no Bopal, Ghuma, South Bopal or Kathwada) and is NOT used.

Two attribute faults in AMC's layer, both corrected rather than carried:
  * `area_ha` is the km2 figure, not hectares (off by 100);
  * Navrangpura's `area_sq_km` is copied from Jodhpur.
Areas are recomputed from the geometry (spherical equal-area).

POPULATION is Census 2011 per ward from Schedule 2 of the SEC's delimitation
order - the figures the wards were drawn to. They are checked against the
order's own printed total, 56,64,062, before anything is written.

Run:  python3 neer-vazhvu-api/scripts/build_ahmedabad_wards.py
"""

import json
import math
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

APP = "https://inhouse-amcmodules.ahmedabadcity.gov.in:8023/"
WARDS_ID = "amc-citymap-wards"
SEC_ID = "sec-gujarat-amc-delimitation-2020"
SEC_TOTAL = 5664062

# Schedule 2 of the SEC order (Census 2011 population by ward).
POPULATION = {
    1: 104676,
    2: 109411,
    3: 116324,
    4: 111227,
    5: 114655,
    6: 119798,
    7: 104697,
    8: 130044,
    9: 122616,
    10: 121853,
    11: 120485,
    12: 122117,
    13: 129616,
    14: 118156,
    15: 122464,
    16: 105102,
    17: 115078,
    18: 111256,
    19: 128201,
    20: 121359,
    21: 117314,
    22: 109205,
    23: 124349,
    24: 118119,
    25: 127525,
    26: 121562,
    27: 127630,
    28: 120690,
    29: 125923,
    30: 107774,
    31: 106520,
    32: 105159,
    33: 122548,
    34: 120281,
    35: 126978,
    36: 120944,
    37: 123027,
    38: 127578,
    39: 105671,
    40: 116372,
    41: 116202,
    42: 110451,
    43: 110818,
    44: 110880,
    45: 121171,
    46: 120641,
    47: 121894,
    48: 127701,
}


def _get(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 neervazhvu"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read().decode("utf-8", "replace")


def extract(js: str, name: str) -> dict:
    """The `{type:"FeatureCollection",name:"<name>",...}` literal, as JSON."""
    start = js.index(f'{{type:"FeatureCollection",name:"{name}"')
    depth, i, in_str = 0, start, False
    while True:
        c = js[i]
        if in_str:
            if c == "\\":
                i += 1
            elif c == '"':
                in_str = False
        elif c == '"':
            in_str = True
        elif c in "{[":
            depth += 1
        elif c in "}]":
            depth -= 1
            if depth == 0:
                break
        i += 1
    lit = js[start : i + 1]
    # Minified JS object -> JSON: quote bare keys, restore leading zeros and booleans.
    parts = re.split(r'("(?:\\.|[^"\\])*")', lit)
    for k in range(0, len(parts), 2):
        s = re.sub(r"([{,])([A-Za-z_$][\w$]*):", r'\1"\2":', parts[k])
        s = re.sub(r"(?<=[:\[,])(-?)\.(\d)", r"\g<1>0.\2", s)
        parts[k] = s.replace("!0", "true").replace("!1", "false")
    return json.loads("".join(parts))


def ring_km2(ring: list) -> float:
    r = 6371.0088
    a = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        a += math.radians(x2 - x1) * (
            2 + math.sin(math.radians(y1)) + math.sin(math.radians(y2))
        )
    return abs(a * r * r / 2)


def area_km2(geom: dict) -> float:
    polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
    return sum(
        ring_km2([p[:2] for p in poly[0]])
        - sum(ring_km2([p[:2] for p in h]) for h in poly[1:])
        for poly in polys
    )


def strip_z(c):
    return [strip_z(x) for x in c] if isinstance(c[0], list) else c[:2]


def main() -> int:
    assert sum(POPULATION.values()) == SEC_TOTAL, (
        "population table does not sum to the SEC total"
    )
    html = _get(APP)
    bundles = re.findall(r'src="((?:main|chunk|scripts)-[A-Z0-9]+\.js)"', html)
    fc = None
    for b in bundles:
        js = _get(APP + b)
        if 'name:"Ward_Boundary"' in js:
            fc = extract(js, "Ward_Boundary")
            break
    if fc is None:
        print(
            f"Ward_Boundary not found in {bundles} - the app was rebuilt",
            file=sys.stderr,
        )
        return 1

    feats = []
    for f in fc["features"]:
        p = f["properties"]
        no = int(p["Ward_No"])
        geom = {
            "type": f["geometry"]["type"],
            "coordinates": strip_z(f["geometry"]["coordinates"]),
        }
        feats.append(
            {
                "type": "Feature",
                "properties": {
                    "ward_number": no,
                    "ward_name": p["WARD"].strip().title(),
                    "zone_name": p["Zone_Name"].strip().title(),
                    "zone_no": int(p["Zone_No"]),
                    "population_2011": POPULATION[no],
                    "area_sq_km": round(area_km2(geom), 3),
                },
                "geometry": geom,
            }
        )
    feats.sort(key=lambda f: f["properties"]["ward_number"])
    numbers = [f["properties"]["ward_number"] for f in feats]
    if numbers != list(range(1, 49)):
        print(f"expected wards 1-48, got {numbers}", file=sys.stderr)
        return 1

    out = {
        "nvdm": "1.0",
        "dataset": "geojson-layers/wards-2020",
        "scope": {"kind": "city", "id": "ahmedabad"},
        "provenance": {
            "sources": [
                {
                    "id": WARDS_ID,
                    "title": "AMC City Map, Ward_Boundary layer (48 wards, 7 zones)",
                    "publisher": "Ahmedabad Municipal Corporation",
                    "license": registry_license(WARDS_ID),
                },
                {
                    "id": SEC_ID,
                    "title": "Final ward delimitation of Ahmedabad Municipal Corporation, 3 Oct 2020, Schedule 2 (Census 2011 population)",
                    "publisher": "State Election Commission, Gujarat",
                    "license": registry_license(SEC_ID),
                },
            ],
            "method": "scrape",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/build_ahmedabad_wards.py",
            "note": (
                "Geometry read from the GeoJSON embedded in AMC's City Map app bundle; areas "
                "recomputed from it because two of AMC's area attributes are wrong."
            ),
        },
        "type": "FeatureCollection",
        "features": feats,
    }
    path = REPO_ROOT / "public" / "geojson" / "ahmedabad-wards-2020.geojson"
    write_artifact(path, out, compact=True)
    total = sum(f["properties"]["area_sq_km"] for f in feats)
    zones = sorted({f["properties"]["zone_name"] for f in feats})
    print(
        f"48 wards, {len(zones)} zones, {total:.2f} km2 -> {path.name}", file=sys.stderr
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
