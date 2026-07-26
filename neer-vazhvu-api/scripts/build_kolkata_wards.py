#!/usr/bin/env python3
"""
Kolkata ward geometry: OpenCity's "Kolkata Wards Map 2022" KML -> GeoJSON.

    https://data.opencity.in/dataset/e1c4f558-eff2-44c3-b703-d9d6ea45c577

THIS LAYER IS DELIBERATELY INCOMPLETE, AND SAYS SO.

HOW BIG THE GAP ACTUALLY IS (measured 2026-07-26, not assumed):
  141 mapped wards union .... 187.15 km2
  KMC's stated area ......... 206.08 km2  (District Environment Plan 2021)
  implied wards 142-144 ..... 18.93 km2 = 9.2% OF THE CITY
The mean mapped ward is 1.33 km2, so three average wards would be ~4 km2. The
gap is 4.7x that, consistent with 142-144 being the large peri-urban Joka
additions rather than typical inner wards. This is not a rounding error and not
a sliver: nearly a tenth of Kolkata has no public ward geometry.

WHAT WE NOW KNOW ABOUT THE MISSING WARDS (2026-07-26, KMC-SHARP IEE via ADB).
Still no polygons, but they are no longer a blank. From the Julpia/Kabardanga
Initial Environmental Examination (project 56287-001):
  - Wards 142 and 143 were CREATED IN 2012 and subsequently incorporated into
    KMC. (This corrects an earlier assumption here that they were 2015 Joka
    additions - the Joka framing was wrong.)
  - They sit in BOROUGH XVI, south-west Kolkata, not in a Joka annexure.
  - Partial areas, from the subprojects alone: ~360 ha of Ward 142 in the Julpia
    catchment, plus 213 ha of Ward 142 and 29.9 ha of Ward 143 in Kabardanga.
    Ward 142 is therefore at least ~573 ha before anything outside these two
    catchments is counted - consistent with the 18.93 km2 the three wards must
    account for.
  - Coordinates cited across the document span 22.430-22.464 N, 88.313-88.345 E,
    centroid about 22.4495, 88.3351.
  - Bounded on the north by M.G Road (west-east); Kabardanga-Julpia Road runs
    north-south through them.
  - Drained by the Keorapukur canal and the Western channel, which merge and
    discharge into Tolly Nullah - i.e. into the ADI GANGA, the zero-dissolved-
    oxygen channel on the rivers page. The missing wards drain into the city's
    worst water.
  - Julpia catchment projected population 34,235 by 2028.
So the honest state is "located, sized and characterised, but not mapped".

EVERY ROUTE TRIED AND EXHAUSTED (2026-07-26):
  - OpenCity: the 2022 KML is the only ward dataset, and it carries 1-141.
  - OSM: zero Kolkata ward relations at ANY admin_level.
  - KMC's own ward/borough pages: 404.
  - GitHub / DataMeet: no Kolkata municipal ward boundaries.
  - Derivation by subtraction: fetched OSM's KMC boundary (relation 9381363,
    admin_level 7) and differenced the 141 wards out of it. FAILED, and the
    failure is informative - OSM's KMC polygon is 184.4 km2, SMALLER than the
    141 wards themselves, so OSM's boundary predates the 2015 additions too.
    The residual was 9.83 km2 spread over 600 sliver artefacts whose largest
    part sits on the river, not in Joka. Deriving the wards this way would have
    produced a fabricated polygon, so it was abandoned rather than shipped.

KMC has **144 wards** (primary-confirmed from KMC's own District Environment
Plan 2021). The only public ward geometry carries **141**: wards 142, 143 and
144 are absent, verified by parsing every placemark in the file. They were
created in 2012 and lie in Borough XVI (see above); no public geometry for them
was found - not in OpenCity, and not in OSM, which has no
Kolkata ward boundaries at any admin_level (probed 2026-07-26, zero relations).

So this script emits 141 polygons AND a machine-readable `missing_wards`
declaration, rather than 141 polygons that quietly imply 141 is the whole city.
Ward surfaces (`my-ward`) stay OFF in routing until the three land: a ward map
that silently drops three wards is worse than no ward map, because a resident
of ward 143 gets "not found" rather than "we don't have your ward yet".

THE BOROUGH JOIN. The KML's only attribute is a bare `WARD` number - no name,
no borough. KMC's own borough pages 404. The one primary source that ties wards
to boroughs is KMC's weekly drainage register, which attributes every
waterlogging pocket as `Br./Wd` (e.g. `III/31 & 32`). That covers the wards KMC
happened to send machines to - 53 of 144 - so the borough field is populated
where it is EVIDENCED and null everywhere else. No interpolation, no guessing
from ward-number ranges: KMC's borough boundaries are not contiguous ranges.

Run:  python3 neer-vazhvu-api/scripts/build_kolkata_wards.py [--kml path]
"""

import argparse
import json
import sys
import urllib.request
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
GEO_DIR = REPO_ROOT / "public" / "geojson"
DATA_DIR = REPO_ROOT / "public" / "data"

KML_URL = (
    "https://data.opencity.in/dataset/e1c4f558-eff2-44c3-b703-d9d6ea45c577/"
    "resource/b3195f54-6c85-4cb4-afa0-06af482fe9df/download/"
    "10f7cc2f-5005-412f-861d-d5e085dd92fb.kml"
)
NS = {"k": "http://www.opengis.net/kml/2.2"}
OFFICIAL_WARD_COUNT = 144  # KMC District Environment Plan 2021


def fetch_kml(dest: Path):
    req = urllib.request.Request(KML_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        dest.write_bytes(r.read())


def parse_coords(text: str):
    pts = []
    for tok in (text or "").split():
        parts = tok.split(",")
        if len(parts) >= 2:
            try:
                pts.append([float(parts[0]), float(parts[1])])
            except ValueError:
                continue
    return pts


def borough_map_from_register() -> dict[int, str]:
    """Ward -> borough, from KMC's own weekly drainage register. Primary
    evidence, partial coverage: only the wards KMC sent machines to appear."""
    path = DATA_DIR / "kolkata-waterlogging-register.json"
    if not path.exists():
        print("  (no waterlogging register yet - borough field will be empty)", file=sys.stderr)
        return {}
    reg = json.loads(path.read_text())
    votes: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for row in reg.get("by_ward", []):
        if row.get("borough") and row.get("ward"):
            votes[int(row["ward"])][row["borough"]] += row.get("entries", 1)
    # A ward occasionally appears under two boroughs in the register (KMC's own
    # typos); take the better-attested one rather than dropping the ward.
    return {w: max(b.items(), key=lambda kv: kv[1])[0] for w, b in votes.items()}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--kml")
    args = ap.parse_args()

    kml = Path(args.kml) if args.kml else GEO_DIR / "_kmc_wards.kml"
    if not args.kml:
        fetch_kml(kml)

    root = ET.parse(kml).getroot()
    boroughs = borough_map_from_register()

    features, seen = [], set()
    for pm in root.findall(".//k:Placemark", NS):
        attrs = {
            sd.get("name"): (sd.text or "").strip()
            for sd in pm.findall(".//k:SimpleData", NS)
        }
        raw = attrs.get("WARD", "")
        if not raw.isdigit():
            continue
        ward = int(raw)
        rings = []
        for poly in pm.findall(".//k:Polygon", NS):
            outer = poly.find(".//k:outerBoundaryIs//k:coordinates", NS)
            if outer is None:
                continue
            pts = parse_coords(outer.text)
            if len(pts) >= 4:
                rings.append([pts])
        if not rings:
            continue
        seen.add(ward)
        geom = (
            {"type": "Polygon", "coordinates": rings[0]}
            if len(rings) == 1
            else {"type": "MultiPolygon", "coordinates": rings}
        )
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "ward_no": ward,
                    # Null, not a guess. KMC's borough boundaries are not
                    # contiguous ward ranges, so interpolation would invent
                    # administrative facts.
                    "borough": boroughs.get(ward),
                    "borough_source": "KMC weekly drainage register" if ward in boroughs else None,
                },
                "geometry": geom,
            }
        )

    features.sort(key=lambda f: f["properties"]["ward_no"])
    missing = [w for w in range(1, OFFICIAL_WARD_COUNT + 1) if w not in seen]

    out = {
        "type": "FeatureCollection",
        "_source": "OpenCity, 'Kolkata Wards Map 2022' KML",
        "_source_url": KML_URL,
        "_generated": date.today().isoformat(),
        "_official_ward_count": OFFICIAL_WARD_COUNT,
        "_official_ward_count_source": "KMC, District Environment Plan 2021",
        "_mapped_ward_count": len(features),
        "_missing_wards": missing,
        "_limitation": (
            f"KMC has {OFFICIAL_WARD_COUNT} wards; this file carries {len(features)}. "
            f"Wards {', '.join(map(str, missing))} have no public geometry - absent from "
            "OpenCity's KML and from OSM, which maps no Kolkata ward boundaries at all. "
            "Ward-level surfaces must treat this as partial coverage, not as the city."
        ),
        "_borough_coverage": {
            "wards_with_borough": sum(1 for f in features if f["properties"]["borough"]),
            "of": len(features),
            "source": "KMC weekly drainage activity chart (Br./Wd column)",
            "note": (
                "Borough is populated only where KMC's own register evidences it. The KML "
                "carries no borough attribute and KMC's borough pages return 404."
            ),
        },
        "features": features,
    }

    path = GEO_DIR / "kolkata-wards-2022.geojson"
    path.write_text(json.dumps(out, ensure_ascii=False))
    if not args.kml and kml.exists():
        kml.unlink()

    print(
        f"kolkata wards: {len(features)}/{OFFICIAL_WARD_COUNT} mapped "
        f"(missing {missing}), borough known for "
        f"{out['_borough_coverage']['wards_with_borough']} -> {path.name}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
