#!/usr/bin/env python3
"""
Base geography for Pune: PMC wards, water bodies, rivers and sewage treatment
plants. Four layers, three publishers, one script.

WARDS - THE VINTAGE IS THE WHOLE PROBLEM. OpenCity's `pune-wards-info` carries
SEVEN ward files and only one of them is current. PMC has two unrelated ward
systems, and conflating them is the obvious mistake:

  * 15 ADMINISTRATIVE ward offices, grouped into 5 DMC zones. This is what
    PMC's own operational records key to - the STP layer below has a
    `Ward_Offic` column, not a prabhag number.
  * ELECTORAL prabhags, redrawn every delimitation: 76 (2012), 41 (2017),
    58 (a 2022 draft that never went to poll), and 41 (2025).

We take the **2025 delimitation, 41 prabhags**, drafted 22 August 2025 on
Census 2011 per Supreme Court guidelines and used for the 2026 PMC election.
It is confirmed as current by OpenCity's own `pmc-election-results` CSV, which
holds 165 seat rows across exactly those 41 ward numbers (40 four-member wards
plus Ambegaon-Katraj with five).

THE JOIN THAT MAKES IT USABLE, and the one that must not be attempted. The
2025 KML has NO ward names - its only attribute is `qwr`, a float ward number.
Names come from the election-results CSV, joined `int(qwr)` -> `Ward No.`,
41 of 41. Do NOT instead join the 2025 polygons to the 2017 name list: both
files have exactly 41 features, so the join succeeds silently, and the first
two names even agree (2017 ward 1 Kalas-Dhanori, 2025 ward 1
Kalas-Dhanori-Lohegaon). It is a fresh delimitation with different boundaries
and different numbering, and it goes wrong from ward 3 onward.

DELIBERATELY NOT USED, having been examined: `PMC Electoral Wards 2012`
(76 features) and `PMC Prabhag Boundary` (72 features). Both carry the modern
15 ward-office names, which post-date the 2021 village mergers, alongside 2017
prabhag names; `ward_no` runs 1-75 across 76 features and `prabhag_id` 1-66
across 72. Neither matches any single delimitation and the counts disagree
with their own feature counts. No defensible vintage could be established, so
they are omitted rather than shipped with a guess.

WATER BODIES AND RIVERS COME FROM OSM, and that is a finding rather than a
shortcut. PMC publishes no lake or tank layer at all. Its only "water body"
file is `Pune River Map`, 12 polygons of river CHANNEL - three of them with a
null REMARK and one with AREA=0 - which is not a lake register and not a
routable network. Katraj, Pashan and Bund Garden are absent from every PMC
dataset probed and present in OSM.

NO PCMC WARD BOUNDARIES EXIST PUBLICLY. Pimpri-Chinchwad has no OpenCity
dataset, its GeoServer at gis.pcmcindia.gov.in is login-walled (WFS and WMS
GetCapabilities 403, REST 401; the open WMTS exposes five raster basemaps and
no vector layer), and OSM has no PCMC corporation polygon - a bbox query for
admin_level 7-10 returns one village relation and nothing else. So this city
ships PMC ward geometry only, and that is a named gap, not an oversight.

Run:  python3 neer-vazhvu-api/scripts/build_pune_geography.py
      python3 neer-vazhvu-api/scripts/build_pune_geography.py --layer wards
"""

import argparse
import csv
import io
import json
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

GEO_DIR = REPO_ROOT / "public" / "geojson"
KML_NS = {"k": "http://www.opengis.net/kml/2.2"}

OPENCITY = "https://data.opencity.in/dataset"
WARDS_KML = (
    f"{OPENCITY}/98f28dac-9158-46ee-a91e-a514d9af427c/resource/"
    "2badcc86-489c-4b7e-b7dd-a273ef01b798/download/"
    "b7a3f392-238c-4c55-a3ed-0c13fd4aaa0a.kml"
)
WARDS_NAMES_CSV = (
    f"{OPENCITY}/98f28dac-9158-46ee-a91e-a514d9af427c/resource/"
    "ac74e3a3-0fce-4ce5-bcdf-b3b6271ae722/download/pmc-election-results.csv"
)
STP_KML = (
    f"{OPENCITY}/eb12f642-e1bb-4475-840e-4c4746d98fe0/resource/"
    "8a81eb8d-de2b-4842-b3fd-c74cc44fdff4/download/"
    "9beb555b-b3b8-4f3b-947c-b33ba33615a5.kml"
)

OVERPASS = "https://overpass-api.de/api/interpreter"
# PMC + PCMC. Wider than the PMC ward envelope on purpose: the water system
# does not stop at the corporation boundary, and the dams the city drinks from
# sit well west of it.
#
# THIS MUST STAY EQUAL TO pune.bbox IN src/lib/cities/pune.ts. It did not, and
# that was a defect rather than a tuning choice: the fetch box was
# 18.38,73.65-18.72,74.05 while the map displays 18.3,73.4-18.95,74.05, so the
# producer covered about a third of the frame the reader can pan over.
# Everything west of 73.65 fell outside it, which meant PANSHET, WARASGAON,
# TEMGHAR, PAWANA, MULSHI AND BHAMA ASKHED were all absent - every reservoir
# Pune drinks from except Khadakwasla itself, missing from the city's own
# water-body map while the dashboard's reservoir cards named them.
BBOX = "18.3,73.4,18.95,74.05"

# Tagged as water in OSM, not a water body in any sense this platform means.
# Swimming pools are the clear case; the rest is plumbing - a service
# reservoir, a rainwater-harvesting sump - that happens to hold water.
#
# The name test is here because THE TAG TEST ALONE DOES NOT CATCH THEM. Three
# pools carry water=pool and are caught cheaply, but "Planet Millennium
# Swimming Pool" carries only natural=water, and "PCMC Water Tank",
# "water tank" and "Rainwater Harvesting" all carry water=reservoir - the same
# tag Khadakwasla and Panshet carry, so dropping that tag class is not an
# option. Kept deliberately narrow for one reason: TALAV IS A REAL WATER BODY.
# Ganesh Talav, Lakaki Talav and Macchi Garden Talav are lakes, and a broader
# "tank" match would delete them.
POOL_WATER_TAGS = {"pool", "swimming_pool"}
NOT_A_WATER_BODY_NAME = (
    "swimming pool",
    "jym",
    "gym",
    "rainwater harvesting",
    "water tank",
)

OSM_LICENSE = (
    "Open Database License (ODbL) v1.0, (c) OpenStreetMap contributors - share-alike"
)


def _get(url: str, timeout: int = 180) -> bytes:
    # OpenCity's CDN answers 406 Not Acceptable to a request with no Accept
    # header, which reads as "this file is gone" rather than "send an Accept".
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
            ),
            "Accept": "*/*",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def _overpass(query: str, tries: int = 4) -> dict:
    # Overpass wants the query form-encoded as `data=`. Posting the raw QL as
    # the body with no Content-Type gets a 406, which looks like a rejected
    # query rather than a malformed request.
    #
    # The public instance also 504s under load often enough that a single
    # attempt is not reliable, and a 504 mid-run leaves one layer rebuilt and
    # the other stale - which is worse than failing outright.
    for attempt in range(tries):
        try:
            req = urllib.request.Request(
                OVERPASS,
                data=urllib.parse.urlencode({"data": query}).encode(),
                headers={
                    "User-Agent": "neervazhvu/1.0 (https://neervazhvu.org)",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )
            with urllib.request.urlopen(req, timeout=300) as r:
                return json.loads(r.read().decode())
        except Exception as exc:
            if attempt == tries - 1:
                raise
            wait = 10 * (attempt + 1)
            print(f"  ~ overpass {exc}; retry in {wait}s", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError("unreachable")


def _coords(el) -> list:
    out = []
    for tok in (el.text or "").split():
        p = tok.split(",")
        if len(p) >= 2:
            out.append([round(float(p[0]), 6), round(float(p[1]), 6)])
    return out


def _kml_polygons(pm) -> dict | None:
    """A Placemark's geometry as Polygon or MultiPolygon."""
    polys = []
    for poly in pm.findall(".//k:Polygon", KML_NS):
        outer = poly.find(".//k:outerBoundaryIs//k:coordinates", KML_NS)
        if outer is None:
            continue
        rings = [_coords(outer)]
        for inner in poly.findall(".//k:innerBoundaryIs//k:coordinates", KML_NS):
            rings.append(_coords(inner))
        polys.append(rings)
    if not polys:
        return None
    if len(polys) == 1:
        return {"type": "Polygon", "coordinates": polys[0]}
    return {"type": "MultiPolygon", "coordinates": polys}


def _centroid(geom) -> tuple[float, float]:
    polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
    pts = [pt for poly in polys for pt in poly[0]]
    return (
        round(sum(p[0] for p in pts) / len(pts), 6),
        round(sum(p[1] for p in pts) / len(pts), 6),
    )


def _envelope(dataset: str, source_id: str, title: str, publisher: str, note: str):
    return {
        "nvdm": "1.0",
        "dataset": f"geojson-layers/{dataset}",
        "scope": {"kind": "city", "id": "pune"},
        "provenance": {
            "sources": [
                {
                    "id": source_id,
                    "title": title,
                    "publisher": publisher,
                    "license": registry_license(source_id),
                }
            ],
            "method": "api",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/build_pune_geography.py",
            "note": note,
        },
    }


def build_wards() -> int:
    root = ET.fromstring(_get(WARDS_KML))
    names: dict[int, str] = {}
    rows = list(csv.DictReader(io.StringIO(_get(WARDS_NAMES_CSV).decode("utf-8-sig"))))
    for row in rows:
        num, nm = (
            (row.get("Ward No.") or "").strip(),
            (row.get("Ward Name") or "").strip(),
        )
        if num and nm:
            names[int(num)] = nm

    feats = []
    for pm in root.findall(".//k:Placemark", KML_NS):
        sd = {s.get("name"): s.text for s in pm.findall(".//k:SimpleData", KML_NS)}
        if sd.get("qwr") is None:
            continue
        ward = int(round(float(sd["qwr"])))
        geom = _kml_polygons(pm)
        if geom is None:
            continue
        feats.append(
            {
                "type": "Feature",
                "properties": {"ward_no": ward, "ward_name": names.get(ward)},
                "geometry": geom,
            }
        )
    feats.sort(key=lambda f: f["properties"]["ward_no"])

    unnamed = [
        f["properties"]["ward_no"] for f in feats if not f["properties"]["ward_name"]
    ]
    if unnamed:
        # Fail loudly. A silently unnamed ward renders as a blank polygon that
        # nobody can search for, which reads as a map bug rather than a join
        # failure.
        print(f"  ! wards with no name after join: {unnamed}", file=sys.stderr)

    out = {
        **_envelope(
            # Path-derived: the file is pune-wards-2025.geojson, so the dataset
            # id carries the vintage too (same as kolkata-wards-2022).
            "wards-2025",
            "opencity-pune-wards",
            "PMC electoral ward (prabhag) boundaries, 2025 delimitation",
            "Pune Municipal Corporation, via OpenCity",
            "41 prabhags of the 2025 delimitation used for the 2026 PMC "
            "election. Ward names are NOT in the boundary file - its only "
            "attribute is a float ward number - and are joined from PMC's "
            "2026 election results, 41 of 41. PMC's separate 15 ADMINISTRATIVE "
            "ward offices are a different geography and are not this layer.",
        ),
        "type": "FeatureCollection",
        "_source": "OpenCity `pune-wards-info` (PMC Electoral Wards 2025) + PMC 2026 election results",
        "_note": (
            "Vintage matters here: OpenCity carries seven PMC ward files "
            "spanning four delimitations (2012, 2017, 2022 draft, 2025). This "
            "is the 2025 one. The 2022 file is a 58-ward draft that never went "
            "to poll."
        ),
        "features": feats,
    }
    write_artifact(GEO_DIR / "pune-wards-2025.geojson", out, indent=None)
    print(
        f"wards: {len(feats)} prabhags, {len(feats) - len(unnamed)} named "
        f"-> pune-wards-2025.geojson",
        file=sys.stderr,
    )
    return 0


def build_water_bodies_and_rivers() -> int:
    # water=* is queried alongside natural=water because the two are not
    # coextensive in OSM: a tank tagged only water=pond and no natural=water
    # is invisible to the natural-only query. At the old narrow bbox this
    # clause added nothing (487 elements either way, so the earlier 484 was
    # not losing features to the tag set) - it is the bbox that was losing
    # them. Kept anyway so the query stops depending on that coincidence.
    q = f"""[out:json][timeout:280];
(
  way["natural"="water"]({BBOX});
  relation["natural"="water"]({BBOX});
  way["water"]({BBOX});
  relation["water"]({BBOX});
  way["landuse"="reservoir"]({BBOX});
  relation["landuse"="reservoir"]({BBOX});
);
out geom;"""
    data = _overpass(q)
    feats = []
    seen: set[str] = set()
    dropped_pool = 0
    dropped_plumbing = 0
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        # The union query can return the same way from two clauses.
        key = f"{el['type']}/{el['id']}"
        if key in seen:
            continue
        seen.add(key)
        water_tag = (tags.get("water") or "").strip().lower()
        name = (tags.get("name") or "").strip()
        if water_tag in POOL_WATER_TAGS:
            dropped_pool += 1
            continue
        if any(bad in name.lower() for bad in NOT_A_WATER_BODY_NAME):
            dropped_plumbing += 1
            continue
        if el["type"] == "way":
            geom = el.get("geometry") or []
            if len(geom) < 4:
                continue
            ring = [[round(p["lon"], 6), round(p["lat"], 6)] for p in geom]
            if ring[0] != ring[-1]:
                ring.append(ring[0])
            g = {"type": "Polygon", "coordinates": [ring]}
        else:
            # Multipolygon relation: keep outer rings only. Inner rings
            # (islands) are cosmetic at city zoom and their members are not
            # always closed in the `out geom` response.
            rings = []
            for m in el.get("members", []):
                if m.get("role") != "outer" or not m.get("geometry"):
                    continue
                ring = [[round(p["lon"], 6), round(p["lat"], 6)] for p in m["geometry"]]
                if len(ring) < 4:
                    continue
                if ring[0] != ring[-1]:
                    ring.append(ring[0])
                rings.append([ring])
            if not rings:
                continue
            g = (
                {"type": "Polygon", "coordinates": rings[0]}
                if len(rings) == 1
                else {"type": "MultiPolygon", "coordinates": rings}
            )
        feats.append(
            {
                "type": "Feature",
                "properties": {
                    "osm_id": f"{el['type']}/{el['id']}",
                    "name": tags.get("name"),
                    "name_mr": tags.get("name:mr"),
                    "water": tags.get("water") or tags.get("landuse"),
                    "natural": tags.get("natural"),
                },
                "geometry": g,
            }
        )
    named = sum(1 for f in feats if f["properties"]["name"])
    # The city's own sources must be present. They were not: at the old bbox
    # only Khadakwasla was in the layer. Asserted rather than trusted, because
    # a bbox is exactly the kind of parameter that gets narrowed by accident
    # and produces a plausible-looking map with the reservoirs cut off.
    # Each entry is the set of spellings that count as present. OSM spells two
    # of these differently from the WRD bulletin the reservoir cards use -
    # VARASGAON for Warasgaon and PAVANA for Pawana - so a single-spelling
    # check reports a false gap. Same trap as MAVAL/Mawal in IN-GRES.
    have = " | ".join((f["properties"].get("name") or "").lower() for f in feats)
    required = (
        ("khadakwasla",),
        ("panshet",),
        ("warasgaon", "varasgaon"),
        ("temghar",),
        ("pawana", "pavana"),
        ("mulshi",),
        ("bhama",),
    )
    missing = [alts[0] for alts in required if not any(a in have for a in alts)]
    if missing:
        print(
            f"WARNING water bodies: Khadakwasla chain dams absent from the layer: "
            f"{', '.join(missing)}. Check BBOX against pune.bbox.",
            file=sys.stderr,
        )
    out = {
        **_envelope(
            "water-bodies-current",
            "osm-pune-water",
            "OpenStreetMap water bodies, Pune (PMC + PCMC bbox)",
            "OpenStreetMap contributors",
            "Lake, tank and reservoir polygons. OSM is the source because PMC "
            "publishes no lake or tank layer at all - its only water-body file "
            "is 12 river-channel polygons. Katraj, Pashan and Bund Garden are "
            "in OSM and in no PMC dataset probed.",
        ),
        "type": "FeatureCollection",
        "_source": f"OpenStreetMap via Overpass, bbox {BBOX}",
        "_excluded": {
            "swimming_pools_by_tag": dropped_pool,
            "plumbing_by_name": dropped_plumbing,
            "_note": (
                "Counted, not silently dropped. water=pool is a swimming pool; "
                "the name-matched set is a service reservoir, a rainwater "
                "harvesting sump and pools tagged only natural=water. The "
                "match is narrow on purpose - talav is a real water body here, "
                "so Ganesh Talav and Lakaki Talav must survive it."
            ),
        },
        "_coverage_note": (
            "OSM is not a register. It is the only machine-readable lake layer "
            "that exists for this city, and it under-counts small rural tanks "
            "outside the built-up area. The Government of India's First Census "
            "of Water Bodies enumerates 3,680 in Pune DISTRICT, but only 10 "
            "inside PMC and 45 urban statewide-district-wide, and its attribute "
            "columns are near-uniformly unfilled defaults (3,679 of 3,680 "
            "'not encroached'), so it is not a substitute for this layer. "
            "Maharashtra publishes no open vector lake register: MRSAC does not "
            "resolve publicly and Bhuvan answers 'Service WFS is disabled'."
        ),
        "features": feats,
    }
    write_artifact(GEO_DIR / "pune-water-bodies-current.geojson", out, indent=None)
    print(
        f"water bodies: {len(feats)} polygons, {named} named, "
        f"dropped {dropped_pool} pools + {dropped_plumbing} plumbing "
        f"-> pune-water-bodies-current.geojson",
        file=sys.stderr,
    )

    q2 = f"""[out:json][timeout:280];
(
  way["waterway"="river"]({BBOX});
  way["waterway"="canal"]({BBOX});
);
out geom;"""
    data2 = _overpass(q2)
    # river_id is the join key the rivers page uses to attach its per-river
    # narrative (RIVER_INFO_BY_CITY in src/app/[cityId]/rivers/page.tsx).
    # OSM's `name` is not stable enough on its own: the Pavana appears as both
    # "Pavana" and "Pavana River", and the Mula-Mutha needs to stay distinct
    # from the Mula and the Mutha, so it is matched before them.
    # ORDER IS LOAD-BEARING. Every entry is a substring test, so the most
    # specific name must be tested first: "Mutha Right Bank Canal" contains
    # "mutha" and would otherwise be drawn as the RIVER Mutha, and
    # "Mula-Mutha" contains both "mula" and "mutha".
    RIVER_IDS = [
        ("mutha-canal", ("right bank canal", "mutha canal", "left bank canal")),
        ("mula-mutha", ("mula-mutha", "mula mutha")),
        ("mutha", ("mutha",)),
        ("mula", ("mula",)),
        ("pavana", ("pavana", "pawana")),
        ("indrayani", ("indrayani",)),
        ("bhima", ("bhima",)),
        ("ramnadi", ("ramnadi", "ram nadi")),
    ]

    def river_id_for(name: str | None) -> str | None:
        if not name:
            return None
        low = name.strip().lower()
        for rid, keys in RIVER_IDS:
            if any(k in low for k in keys):
                return rid
        return None

    lines = []
    for el in data2.get("elements", []):
        geom = el.get("geometry") or []
        if len(geom) < 2:
            continue
        tags = el.get("tags", {})
        lines.append(
            {
                "type": "Feature",
                "properties": {
                    "osm_id": f"way/{el['id']}",
                    "river_id": river_id_for(tags.get("name")),
                    "name": tags.get("name"),
                    "name_mr": tags.get("name:mr"),
                    "waterway": tags.get("waterway"),
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [round(p["lon"], 6), round(p["lat"], 6)] for p in geom
                    ],
                },
            }
        )
    # MERGE SEGMENTS INTO ONE FEATURE PER RIVER. OSM traces a river as many
    # separate ways - the Mutha Right Bank Canal alone comes back as 20 - and
    # the rivers page keys its polylines and its narrative panel on river_id.
    # Shipping 38 features that share 8 ids made React log a duplicate-key
    # error for every collision and made the page header count "38 rivers".
    # A river is one feature with a MultiLineString geometry.
    merged: dict[str, dict] = {}
    unnamed = []
    for f in lines:
        rid = f["properties"].get("river_id")
        if not rid:
            unnamed.append(f)
            continue
        m = merged.get(rid)
        if m is None:
            merged[rid] = {
                "type": "Feature",
                "properties": {
                    "river_id": rid,
                    "name": f["properties"]["name"],
                    "name_mr": f["properties"].get("name_mr"),
                    "waterway": f["properties"].get("waterway"),
                    "osm_segments": 1,
                },
                "geometry": {
                    "type": "MultiLineString",
                    "coordinates": [f["geometry"]["coordinates"]],
                },
            }
        else:
            m["geometry"]["coordinates"].append(f["geometry"]["coordinates"])
            m["properties"]["osm_segments"] += 1
            if not m["properties"].get("name_mr") and f["properties"].get("name_mr"):
                m["properties"]["name_mr"] = f["properties"]["name_mr"]

    def _length_km(multi):
        import math

        def hav(a, b):
            R = 6371.0088
            p1, p2 = math.radians(a[1]), math.radians(b[1])
            dp, dl = p2 - p1, math.radians(b[0] - a[0])
            h = (
                math.sin(dp / 2) ** 2
                + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
            )
            return 2 * R * math.asin(math.sqrt(h))

        return round(
            sum(
                hav(c[i], c[i + 1])
                for c in multi["coordinates"]
                for i in range(len(c) - 1)
            ),
            1,
        )

    for m in merged.values():
        m["properties"]["length_km"] = _length_km(m["geometry"])
    lines = sorted(merged.values(), key=lambda f: f["properties"]["river_id"])
    print(
        f"  merged {sum(f['properties']['osm_segments'] for f in lines)} OSM segments "
        f"into {len(lines)} rivers; dropped {len(unnamed)} unnamed segments",
        file=sys.stderr,
    )

    out2 = {
        **_envelope(
            "rivers",
            "osm-pune-water",
            "OpenStreetMap river and canal centrelines, Pune",
            "OpenStreetMap contributors",
            "Centrelines for the Mula, Mutha, Mula-Mutha, Pavana and Indrayani "
            "plus the Mutha canals. PMC's own river file is 12 channel "
            "POLYGONS, not centrelines, so it cannot carry a river network.",
        ),
        "type": "FeatureCollection",
        "_source": f"OpenStreetMap via Overpass, bbox {BBOX}",
        "features": lines,
    }
    write_artifact(GEO_DIR / "pune-rivers.geojson", out2, indent=None)
    named2 = sorted({f["properties"]["name"] for f in lines if f["properties"]["name"]})
    print(
        f"rivers: {len(lines)} segments, named: {named2} -> pune-rivers.geojson",
        file=sys.stderr,
    )
    return 0


def build_gwr_blocks() -> int:
    """Taluka polygons for the groundwater choropleth, joined to the assessment.

    Geometry comes from IN-GRES's OWN GeoServer, which is the right source
    because it is the same publisher as the numbers - its features carry
    `parent_uuid` = 471dff0a-9b41-46f2-890d-179b2408ca4d, exactly the Pune
    district uuid the assessment API is queried with.

    TWO JOIN HAZARDS, both real and both found by testing rather than reasoning:

    1. WITHOUT `year=2021` THE LAYER RETURNS 27 FEATURES, not 14 - it holds two
       vintages (2019 with 13 talukas, 2021 with 14). The 2019 vintage predates
       Pune City becoming its own assessment unit. Taking all 27 would double
       most talukas and draw them twice.
    2. THE WFS `uuid` IS A DIFFERENT NAMESPACE from the assessment API's
       `locationUUID` and matches nothing. The join has to be on NAME, which
       means normalising: the API title-cases from 2023-2024 onward and
       upper-cases before, and spells MAVAL as "Mawal" in 2025-2026 only.
    """
    url = (
        "https://ingres.iith.ac.in/geoserver/gec/ows?service=WFS&version=1.0.0"
        "&request=GetFeature&typeName=gec:indgec_ver_mahar"
        "&outputFormat=application/json"
        "&CQL_FILTER=" + urllib.parse.quote("parent_name='PUNE' AND year=2021")
    )
    fc = json.loads(_get(url, timeout=300))
    assessment = json.loads(
        (REPO_ROOT / "public" / "data" / "gwr-blocks-pune.json").read_text()
    )
    by_name = {
        b["name"].strip().upper().replace("MAWAL", "MAVAL"): b
        for b in assessment["blocks"]
    }

    feats, unmatched = [], []
    for f in fc.get("features", []):
        p = f.get("properties") or {}
        raw = (p.get("name") or "").strip()
        key = raw.upper().replace("MAWAL", "MAVAL")
        blk = by_name.get(key)
        if blk is None:
            unmatched.append(raw)
            continue
        latest = blk["latest"]
        feats.append(
            {
                "type": "Feature",
                "properties": {
                    # Property names match the shape the shared ward/block map
                    # already reads for Chennai, Madurai and Hyderabad.
                    "block": blk["name"],
                    "class": latest["class"],
                    "sgw_dev_pe": latest["development_pct"],
                    "na_gwa": latest["availability_ham"],
                    "agwd_tot": latest["draft_total_ham"],
                    "ext_id": p.get("ext_id"),
                    "editions": len(blk["history"]),
                },
                "geometry": f["geometry"],
            }
        )
    feats.sort(key=lambda f: f["properties"]["block"])
    missing = sorted(set(by_name) - {f["properties"]["block"].upper() for f in feats})
    if unmatched or missing:
        print(
            f"  ! geometry with no assessment: {unmatched}; "
            f"assessment with no geometry: {missing}",
            file=sys.stderr,
        )

    out = {
        **_envelope(
            "gwr-blocks",
            "ingres-groundwater-maharashtra",
            "IN-GRES taluka boundaries for Pune district, joined to the dynamic groundwater assessment",
            "IN-GRES (CGWB + State groundwater departments), IIT Hyderabad",
            "Geometry from IN-GRES's own GeoServer (gec:indgec_ver_mahar, "
            "year=2021, the vintage that carries Pune City as a separate unit); "
            "attributes are the latest published assessment edition from "
            "gwr-blocks-pune.json. Joined on normalised name - the WFS uuid is a "
            "different namespace from the assessment API's and matches nothing.",
        ),
        "type": "FeatureCollection",
        "_source": "IN-GRES GeoServer WFS + IN-GRES assessment API",
        "_note": (
            "The district reads 63.73% and SAFE in aggregate while Shirur inside "
            "it is CRITICAL at 95.71%. This layer exists so the map shows the "
            "taluka, not the aggregate."
        ),
        "features": feats,
    }
    write_artifact(GEO_DIR / "pune-gwr-blocks.geojson", out, indent=None)
    worst = max(feats, key=lambda f: f["properties"]["sgw_dev_pe"])
    print(
        f"gwr blocks: {len(feats)} talukas joined, worst "
        f"{worst['properties']['block']} {worst['properties']['sgw_dev_pe']}% "
        f"({worst['properties']['class']}) -> pune-gwr-blocks.geojson",
        file=sys.stderr,
    )
    return 1 if (unmatched or missing) else 0


def build_stps() -> int:
    root = ET.fromstring(_get(STP_KML))
    feats = []
    for pm in root.findall(".//k:Placemark", KML_NS):
        sd = {s.get("name"): s.text for s in pm.findall(".//k:SimpleData", KML_NS)}
        geom = _kml_polygons(pm)
        if geom is None:
            continue
        lon, lat = _centroid(geom)
        cap = sd.get("STP_Capaci")

        # "-" is this file's null. 19 of 20 rows have it in Year_of_Co and
        # Utilized_C, so those columns are carried only where real.
        def clean(v):
            v = (v or "").strip()
            return None if v in ("", "-") else v

        feats.append(
            {
                "type": "Feature",
                "properties": {
                    "name": clean(sd.get("STP_Name")),
                    "capacity_mld": float(cap) if cap and cap.strip() != "-" else None,
                    "technology": clean(sd.get("Technology")),
                    "status": clean(sd.get("Category")),
                    "ward_office": clean(sd.get("Ward_Offic")),
                    "commissioned": clean(sd.get("Year_of_Co")),
                },
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
            }
        )
    feats.sort(key=lambda f: -(f["properties"]["capacity_mld"] or 0))
    existing = [
        f for f in feats if (f["properties"]["status"] or "").startswith("Existing")
    ]
    proposed = [
        f for f in feats if (f["properties"]["status"] or "").startswith("Proposed")
    ]
    sum_e = sum(f["properties"]["capacity_mld"] or 0 for f in existing)
    sum_p = sum(f["properties"]["capacity_mld"] or 0 for f in proposed)
    out = {
        **_envelope(
            "stps",
            "opencity-pune-stps",
            "PMC sewage treatment plants, existing and proposed",
            "Pune Municipal Corporation, via OpenCity",
            f"{len(existing)} existing plants totalling {sum_e:.0f} MLD and "
            f"{len(proposed)} proposed totalling {sum_p:.0f} MLD. The proposed "
            "set IS the JICA Mula-Mutha programme: its capacities sum to the "
            "396 MLD that PMC and JICA both publish, which is an independent "
            "check on the layer. Polygons are reduced to centroids for point "
            "rendering; capacities are the file's own STP_Capaci column.",
        ),
        "type": "FeatureCollection",
        "_source": "OpenCity `pune-sewage-treatment-plants` (PMC)",
        "_note": (
            "Year_of_Co and Utilized_C are '-' on 19 of 20 rows and are "
            "emitted as null rather than as a false zero. The single populated "
            "row attaches the 1988 Old Naidu commissioning date to New Naidu."
        ),
        "summary": {
            "existing_count": len(existing),
            "existing_capacity_mld": round(sum_e, 1),
            "proposed_count": len(proposed),
            "proposed_capacity_mld": round(sum_p, 1),
        },
        "features": feats,
    }
    write_artifact(GEO_DIR / "pune-stps.geojson", out, indent=None)
    print(
        f"stps: {len(feats)} plants ({len(existing)} existing {sum_e:.0f} MLD, "
        f"{len(proposed)} proposed {sum_p:.0f} MLD) -> pune-stps.geojson",
        file=sys.stderr,
    )
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--layer",
        default="all",
        choices=["all", "wards", "water", "stps", "gwr"],
    )
    args = ap.parse_args()
    rc = 0
    if args.layer in ("all", "wards"):
        rc |= build_wards()
    if args.layer in ("all", "water"):
        rc |= build_water_bodies_and_rivers()
    if args.layer in ("all", "stps"):
        rc |= build_stps()
    if args.layer in ("all", "gwr"):
        # Depends on public/data/gwr-blocks-pune.json, so run
        # build_ingres_gwr.py --city pune first.
        rc |= build_gwr_blocks()
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
