#!/usr/bin/env python3
"""Verify Chennai ward -> zone assignments against Greater Chennai Corporation.

Checks public/data/ward-names.json (the mapping) and the Zone_No/Zone_Name
joined onto public/geojson/chennai-wards-2022.geojson against GCC's own
GCC_AdminBoundary service: layer 4 Ward_Boundary (200 wards) and layer 5
Zone_Boundary (15 zones).

The join is AREAL CONTAINMENT, not centroid-in-polygon. Centroids are what
made commit ebdce3b2 move wards 168/169 into the wrong zone; the fraction of
each ward's area falling in its best-matching zone is reported so a partial
match can never be read as a clean one.

The predecessor of this script read its zone polygons from an uncommitted
/tmp path, so its run could not be reproduced. This one fetches both layers
from the service itself.

    python3 scripts/qc/verify-ward-zones.py             # fetch from GCC
    python3 scripts/qc/verify-ward-zones.py --from DIR  # replay saved layers

--from DIR reads gcc_ward.geojson + gcc_zone.geojson from DIR instead of
fetching (offline audit of a captured pair). Exits non-zero on any
disagreement, so it doubles as a spot check after a delimitation.

NOT wired into CI: it needs the network, and GCC's boundaries change only
when the Corporation re-delimits.
"""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

from shapely.geometry import shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[2]
SERVICE = (
    "https://gisgcc.chennaicorporation.gov.in/server/rest/services/GCCPublic/"
    "GCC_AdminBoundary/MapServer"
)
QUERY = "/query?where=1=1&outFields=*&returnGeometry=true&outSR=4326&f=geojson"
LAYERS = {"gcc_ward": 4, "gcc_zone": 5}

ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
         "XI", "XII", "XIII", "XIV", "XV"]
# Zone NAMES are not in the service. They are GCC's own roster at
# https://chennaicorporation.gov.in/gcc/delimited_ward/ (dropdown "01 -
# Thiruvottyur" ... "15 - Sholinganallur"), carried in the corpus's existing
# uppercase transliteration - GCC spells zone I "Thiruvottyur".
ZONE_NAMES = ["THIRUVOTTIYUR", "MANALI", "MADHAVARAM", "TONDIARPET", "ROYAPURAM",
              "THIRU-VI-KA NAGAR", "AMBATTUR", "ANNA NAGAR", "TEYNAMPET",
              "KODAMBAKKAM", "VALASARAVAKKAM", "ALANDUR", "ADYAR", "PERUNGUDI",
              "SHOLINGANALLUR"]


def layer(name: str, src: Path | None) -> list[dict]:
    if src is not None:
        raw = (src / f"{name}.geojson").read_text()
    else:
        url = f"{SERVICE}/{LAYERS[name]}{QUERY}"
        print(f"fetching {url}")
        req = urllib.request.Request(url, headers={"User-Agent": "NeerVazhvu/1.0"})
        with urllib.request.urlopen(req, timeout=180) as r:  # noqa: S310 - fixed https URL
            raw = r.read().decode()
    return json.loads(raw)["features"]


def geom(feature: dict):
    g = shape(feature["geometry"])
    return g if g.is_valid else g.buffer(0)


def main() -> int:
    src = None
    if "--from" in sys.argv:
        src = Path(sys.argv[sys.argv.index("--from") + 1])

    zones = {}
    for f in layer("gcc_zone", src):
        zones.setdefault(f["properties"]["zone"], []).append(geom(f))
    zones = {k: unary_union(v) for k, v in zones.items()}
    wards = layer("gcc_ward", src)
    print(f"GCC: {len(wards)} wards, {len(zones)} zones")

    # ward -> (zone_no roman, zone_name, containment fraction, ambiguous?)
    gcc: dict[int, tuple[str, str, float, bool]] = {}
    for f in wards:
        w = int(f["properties"]["ward"])
        g = geom(f)
        frac = {z: g.intersection(zg).area / g.area for z, zg in zones.items()}
        best = max(frac, key=frac.get)
        idx = int(best) - 1
        split = sum(1 for v in frac.values() if v > 0.001) > 1
        gcc[w] = (ROMAN[idx], ZONE_NAMES[idx], frac[best], split)

    worst = min(gcc.items(), key=lambda kv: kv[1][2])
    print(f"minimum containment fraction: ward {worst[0]} at {worst[1][2]:.6f}")
    ambiguous = sorted(w for w, v in gcc.items() if v[3])
    print(f"wards split across zones (>0.1% in a second zone): {ambiguous or 'none'}")

    names = json.loads((ROOT / "public/data/ward-names.json").read_text())["wards"]
    geo = json.loads((ROOT / "public/geojson/chennai-wards-2022.geojson").read_text())
    ours = {
        "public/data/ward-names.json":
            [(r["ward_number"], r["zone_no"], r["zone_name"]) for r in names],
        "public/geojson/chennai-wards-2022.geojson":
            [(f["properties"]["ward_number"], f["properties"]["Zone_No"],
              f["properties"]["Zone_Name"]) for f in geo["features"]],
    }

    bad = 0
    for path, rows in ours.items():
        wrong = [(w, no, nm) for w, no, nm in rows
                 if w not in gcc or (no, nm) != gcc[w][:2]]
        print(f"\n{path}: {len(rows)} rows, {len(rows) - len(wrong)} agree with GCC, "
              f"{len(wrong)} disagree")
        for w, no, nm in wrong:
            exp = gcc.get(w)
            print(f"  ward {w}: file {nm} ({no}) | GCC "
                  f"{exp[1] + ' (' + exp[0] + ')' if exp else 'NOT IN SERVICE'}"
                  f"{f' containment {exp[2]:.6f}' if exp else ''}")
        bad += len(wrong)

    print("\nOK - every ward matches GCC" if not bad else f"\nFAIL - {bad} disagreements")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
