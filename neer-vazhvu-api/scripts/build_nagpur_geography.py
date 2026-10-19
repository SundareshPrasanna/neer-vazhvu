#!/usr/bin/env python3
"""
Nagpur's base geography from official layers: the NMC city outline, the water
bodies of the water-supply frame, and the six rivers.

OFFICIAL FIRST, with OpenStreetMap only where the official layer is silent.

  * CITY OUTLINE: NMC's own property-tax GIS, NMCAdminBoundaries/MapServer/3
    ("Nagapur", edited 13 Aug 2023), 222.33 km2 on a sphere (221.72 km2 on the
    WGS84 ellipsoid; NMC's own SHAPE.AREA is 221.76 km2). No
    page draws a city outline, so it is NOT served: it is frozen as a pipeline
    input (pipeline-inputs/nagpur/nmc-city-boundary.geojson) and every
    point-in-city test reads it. OSM relation 12969115 (211.36 km2, traced on
    imagery) leaves out Hudkeshwar (Bu) and Narsala, which the 4 Oct 2025 ward
    notification puts in ward 29; IoU 0.896, kept only as a cross-check.
  * WATER BODIES: MRSAC's 1:10,000 water-body survey of 2017-18 (Gati Shakti
    Water_Resources/MapServer/14; the same layer is titled
    "Waterbodies_10k_2017-2018_MRSAC" at Major_Medium_Minor_Projects/32),
    DISTCODE '505' = Nagpur district, clipped to the water-supply frame so
    Totladoh (Pench) and Kamthikhairy (Navegaon Khairi) are inside it. TWO
    TRAPS: the field called Area_ha holds km2 (Area_ha x 1e6 equals SHAPE_Area
    in m2 for every feature, asserted below), and WB_TYPE is a code whose
    labels live in the layer's own domain (decoded at run time; code 12 is
    spelt "Malgnzari Tank" there). Islands (WB_TYPE 99) are land and are
    dropped. MRSAC names 84 polygons in the frame but only Ambazari and Phutala
    inside the city, so OSM names are joined by overlap and every feature says
    where its name came from (name_source).
  * RIVERS: MRSAC's drainage network (Water_Resources/MapServer/12) as the
    official centrelines. It names the Pora, which OSM leaves unnamed. The
    frame runs east to 79.65 E so the Kanhan meets the Wainganga at Ambhora.
    Lines are clipped to that frame, so length_km is the length inside it.
    The Nag keeps only its main connected course: MRSAC also labels a separate
    10.9 km channel "Nag Nadi" (class Dry, stream order rising southward), which
    drains south toward Hingna and cannot be the east-flowing Nag. OSM is the
    fallback for a river MRSAC stops serving.

FEATURE IDENTITY. The water-bodies map keys its lookups on osm_id (river
labels for unnamed polygons, census and score joins); a feature without one
shares a single undefined key with every other, and one nearby river name
would then label them all. A polygon matched one-to-one to an OSM polygon
carries that OSM id and type; every other carries "mrsac:<WB_CODE>", MRSAC's
own stable code, so the key is unique and says plainly it is not OSM's.

HOSTS. geocivicnmcgis.nmcptax.com serves an incomplete certificate chain:
Python's TLS check fails there and curl's does not, so ArcGIS queries go
through curl. Overpass refuses requests without a User-Agent and sheds load
with 429/50x, so it is retried with backoff across mirrors.

Run:  python3 neer-vazhvu-api/scripts/build_nagpur_geography.py            # water + rivers
      python3 neer-vazhvu-api/scripts/build_nagpur_geography.py --layer boundary --live
      python3 neer-vazhvu-api/scripts/build_nagpur_geography.py --layer water \
          --osm-snapshot <old OSM extract> --osm-snapshot-date 2026-09-06   # Overpass down
"""

import argparse
import json
import math
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

from shapely.geometry import LineString, Polygon, box, mapping, shape
from shapely.ops import polygonize, unary_union

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

GEO_DIR = REPO_ROOT / "public" / "geojson"
CACHE = Path(__file__).resolve().parent / ".cache" / "nagpur-geo"
BOUNDARY_PATH = REPO_ROOT / "pipeline-inputs" / "nagpur" / "nmc-city-boundary.geojson"

NMC_GIS = "https://geocivicnmcgis.nmcptax.com/server/rest/services/NMC/NMCAdminBoundaries/MapServer"
MRSAC_WR = "https://gsc.mrsac.org.in/webadpgis1/rest/services/gatishakti/Water_Resources/MapServer"
OVERPASS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
)
UA = "neer-vazhvu (https://neervazhvu.org; civic water dashboard)"

# south, west, north, east. FRAME MUST STAY EQUAL TO nagpur.bbox in
# src/cities/nagpur/config.ts (the Pune lesson: a fetch box smaller than the map
# frame lost every source reservoir but one).
FRAME = (20.9, 78.75, 21.75, 79.45)
RIVER_FRAME = (20.9, 78.75, 21.75, 79.65)

# Rivers whose MRSAC name also covers a disconnected channel that is not the
# river: only the longest connected course is kept (see RIVERS in the docstring).
# Pinned 15 Oct 2026: the channel left out, in km (the envelope note names it).
MAIN_COURSE_ONLY = {"nag": [10.9]}

WB_ID = "mrsac-waterbodies-10k-2017-18"
DRAIN_ID = "mrsac-drainage-network"
OSM_ID = "osm-overpass"

# Evidence pinned at build time (15 Oct 2026): a re-run that disagrees fails.
NMC_AREA_KM2 = 222.33
NMC_EDITED = "2023-08-13"
DISTCODE = "505"  # Census-2011 code, verified by extent and neighbours 503/504/506/509
ISLAND = "99"
# MRSAC's own WB_NAME for the two Pench reservoirs NMC draws from, and the
# city lakes it names. A layer that loses one has changed underneath us.
REQUIRED_NAMES = (
    "Totladoh Reservoir",
    "Kamthikhairy (Pench Reservoir)",
    "Ambazari Lake",
    "Gorewada Lake",
    "Phutala Lake",
)
# The domain's label, lower-cased for the page's type labels; the misspelt
# code 12 is corrected here and kept as printed in mrsac_type.
TYPE_LABEL_FIX = {
    "Malgnzari Tank": "malguzari tank",
    "Lakes/Pond": "lake or pond",
    "Cooling pond/ Cooling reservoir": "cooling pond",
}
# WB_NAME spellings that are typing slips in the layer (the thermal plants'
# ash ponds), corrected on the page and kept as printed in mrsac_name.
NAME_FIX = {"Ash Pound": "Ash Pond"}

# river_id is the join key with river-quality-nagpur.json and
# src/cities/nagpur/rivers.ts. ORDER IS LOAD-BEARING: the rivers page opens
# the first feature when no mainstem id of its own matches, so the Nag leads.
RIVERS = (
    ("nag", "Nag", "Nag Nadi", ("nag river", "naag river", "nag nadi")),
    ("pili", "Pili", "Pili Nadi", ("pili", "pivli", "pilli", "piwli")),
    ("pora", "Pora", "Pora Nadi", ("pora", "pohra")),
    ("kanhan", "Kanhan", "Kanhan River", ("kanhan",)),
    ("kolar", "Kolar", "Kolar River", ("kolar",)),
    ("wainganga", "Wainganga", "Wainganga River", ("wainganga", "wainganga river")),
)

# OSM features that are water by tag and not a water body by any sense here
# (a swimming pool, a sump, a vendor's plot). TALAV/TALAO are real lakes.
OSM_NOT_A_BODY = (
    "swimming pool",
    "swiming pool",
    "water tank",
    "open well",
    "rainwater harvesting",
    "water solutions",
)


# ── fetching ────────────────────────────────────────────────────────────────


def curl_json(url: str, params: dict | None = None, timeout: int = 300) -> dict:
    """GET-or-POST through curl (see HOSTS in the docstring)."""
    cmd = ["curl", "-sS", "--fail", "-m", str(timeout), "--retry", "3"]
    cmd += ["--retry-delay", "15", "-A", UA]
    for k, v in (params or {}).items():
        cmd += ["--data-urlencode", f"{k}={v}"]
    out = subprocess.run([*cmd, url], capture_output=True, check=True).stdout
    doc = json.loads(out)
    if isinstance(doc, dict) and "error" in doc:
        raise RuntimeError(f"{url}: {doc['error']}")
    return doc


def arcgis_features(
    layer: str, where: str, *, bbox=None, fields="*", page=1000
) -> list:
    """Every feature of an ArcGIS REST layer query as GeoJSON (WGS84), paged."""
    params = {"where": where, "outFields": fields, "outSR": "4326", "f": "geojson"}
    params |= {"orderByFields": "OBJECTID", "returnGeometry": "true"}
    if bbox:
        s, w, n, e = bbox
        params |= {
            "geometry": f"{w},{s},{e},{n}",
            "geometryType": "esriGeometryEnvelope",
            "inSR": "4326",
            "spatialRel": "esriSpatialRelIntersects",
        }
    feats: list = []
    while True:
        chunk = curl_json(
            f"{layer}/query",
            params | {"resultOffset": str(len(feats)), "resultRecordCount": str(page)},
        )["features"]
        feats += chunk
        if len(chunk) < page:
            return feats


def overpass(query: str, rounds: int = 4, max_age_days: int = 14) -> dict:
    """Overpass with backoff across mirrors. A mirror can answer from a stale
    database (one served July data on 15 Oct 2026, missing ponds mapped since),
    so an answer older than max_age_days is kept only if nothing fresher comes."""
    data = urllib.parse.urlencode({"data": query}).encode()
    stale = None
    for r in range(1, rounds + 1):
        for url in OVERPASS:
            host = urllib.parse.urlsplit(url).netloc
            req = urllib.request.Request(url, data=data, headers={"User-Agent": UA})
            try:
                with urllib.request.urlopen(req, timeout=300) as resp:
                    doc = json.loads(resp.read())
            except Exception as e:  # noqa: BLE001 - every failure means "next mirror"
                print(f"  overpass {host}: {e}", file=sys.stderr)
                continue
            base = date.fromisoformat(doc["osm3s"]["timestamp_osm_base"][:10])
            if (date.today() - base).days <= max_age_days:
                return doc
            print(f"  overpass {host}: database as of {base}, stale", file=sys.stderr)
            if stale is None or base.isoformat() > stale["osm3s"]["timestamp_osm_base"]:
                stale = doc
        if r < rounds:
            time.sleep(45 * r)
    if stale is not None:
        print(
            "  overpass: no fresh mirror; using the freshest stale answer",
            file=sys.stderr,
        )
        return stale
    raise RuntimeError(f"Overpass unavailable after {rounds} rounds")


# ── geometry ────────────────────────────────────────────────────────────────


def ring_km2(ring) -> float:
    """Spherical area of a lon/lat ring (the Ahmedabad ward producer's formula)."""
    r = 6371.0088
    a = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        a += math.radians(x2 - x1) * (
            2 + math.sin(math.radians(y1)) + math.sin(math.radians(y2))
        )
    return abs(a * r * r / 2)


def area_km2(geom) -> float:
    """Spherical area (R 6371.0088 km) of a shapely (Multi)Polygon or GeoJSON
    dict; about 0.27% above the WGS84 ellipsoidal area at Nagpur."""
    g = shape(geom) if isinstance(geom, dict) else geom
    polys = list(getattr(g, "geoms", [g]))
    return sum(
        ring_km2(list(p.exterior.coords))
        - sum(ring_km2(list(i.coords)) for i in p.interiors)
        for p in polys
        if p.geom_type == "Polygon"
    )


def line_km(coords) -> float:
    t = 0.0
    for (x1, y1), (x2, y2) in zip(coords, coords[1:]):
        p = math.radians((y1 + y2) / 2)
        t += math.hypot((x2 - x1) * 111.32 * math.cos(p), (y2 - y1) * 110.57)
    return t


def main_course(lines: list) -> tuple[list, list[float]]:
    """The connected group of segments with the greatest length, and the
    lengths (km) of the groups left out. Segments connect where they touch."""
    from shapely.strtree import STRtree

    geoms = [LineString(c) for c in lines]
    tree = STRtree(geoms)
    parent = list(range(len(geoms)))

    def root(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i, g in enumerate(geoms):
        for j in tree.query(g):
            if int(j) != i and g.distance(geoms[int(j)]) < 1e-9:
                parent[root(i)] = root(int(j))
    groups: dict[int, list[int]] = {}
    for i in range(len(geoms)):
        groups.setdefault(root(i), []).append(i)
    ranked = sorted(groups.values(), key=lambda g: -sum(line_km(lines[i]) for i in g))
    dropped = [round(sum(line_km(lines[i]) for i in g), 1) for g in ranked[1:]]
    return [lines[i] for i in sorted(ranked[0])], dropped


def clip_to(lines: list, frame) -> list:
    """Each line cut to the frame; a line already inside is kept as it is."""
    out = []
    for c in lines:
        g = LineString(c)
        if frame.contains(g):
            out.append(c)
            continue
        part = g.intersection(frame)
        for p in getattr(part, "geoms", [part]):
            if p.geom_type == "LineString" and not p.is_empty and len(p.coords) > 1:
                out.append(list(p.coords))
    return out


def rounded(c, dp: int = 6):
    return (
        [rounded(x, dp) for x in c]
        if isinstance(c[0], list | tuple)
        else [round(v, dp) for v in c[:2]]
    )


def gj(g) -> dict:
    m = mapping(g)
    return {"type": m["type"], "coordinates": rounded(m["coordinates"])}


def osm_polygons(doc: dict) -> list[dict]:
    """Water polygons from an Overpass `out body geom` response: closed ways,
    and multipolygon relations stitched from their member ways."""
    out = []
    for e in doc.get("elements", []):
        tags = e.get("tags") or {}
        if e["type"] == "way" and e.get("geometry"):
            pts = [(p["lon"], p["lat"]) for p in e["geometry"]]
            if len(pts) < 4 or pts[0] != pts[-1]:
                continue
            g = Polygon(pts)
        elif e["type"] == "relation":
            rings = {"outer": [], "inner": []}
            for m in e.get("members", []):
                if (
                    m.get("type") == "way"
                    and m.get("geometry")
                    and m.get("role") in rings
                ):
                    rings[m["role"]].append(
                        LineString([(p["lon"], p["lat"]) for p in m["geometry"]])
                    )
            outer = unary_union(list(polygonize(rings["outer"])))
            if outer.is_empty:
                continue
            inner = unary_union(list(polygonize(rings["inner"])))
            g = outer.difference(inner) if not inner.is_empty else outer
        else:
            continue
        if not g.is_valid:
            g = g.buffer(0)
        if g.is_empty:
            continue
        out.append({"type": e["type"], "id": e["id"], "tags": tags, "geom": g})
    return out


def osm_from_snapshot(path: Path) -> list[dict]:
    """The 6 Sep 2026 OSM extract of the earlier build (osm_id 'way/123')."""
    fc = json.loads(path.read_text())
    out = []
    for f in fc["features"]:
        kind, _, num = str(f["properties"]["osm_id"]).partition("/")
        p = f["properties"]
        tags = {"name": p.get("name") or "", "name:mr": p.get("name_mr") or ""}
        if p.get("name_source", "osm") != "osm":
            tags["name"] = ""  # names the old build assigned, not OSM's
        tags["water"] = p.get("water") or ""
        out.append(
            {
                "type": kind,
                "id": int(num),
                "tags": tags,
                "geom": shape(f["geometry"]).buffer(0),
            }
        )
    return out


def is_osm_water_body(o: dict) -> bool:
    t = o["tags"]
    name = (t.get("name") or "").lower()
    if t.get("water") in ("river", "pool", "swimming_pool", "wastewater"):
        return False
    return not any(bad in name for bad in OSM_NOT_A_BODY)


def match_osm(bodies: list[dict], osm: list[dict]) -> tuple[dict, dict]:
    """Mutual-best overlap between MRSAC polygons and OSM polygons.

    A pair counts when the shared area is at least half the smaller polygon
    and each is the other's largest overlap: a big OSM lake drawn over several
    MRSAC pieces names only its main piece, not the ponds beside it. Returns
    the pairs ({body: (osm, iou)}) and, for bodies whose pair is unnamed or
    missing, the named OSM polygon whose own best body it is ({body: osm})."""
    from shapely.strtree import STRtree

    osm = [o for o in osm if is_osm_water_body(o)]
    tree = STRtree([o["geom"] for o in osm])
    best_for_body: dict[int, tuple[int, float]] = {}
    best_for_osm: dict[int, tuple[int, float]] = {}
    for bi, b in enumerate(bodies):
        for oi in tree.query(b["geom"]):
            o = osm[int(oi)]
            inter = b["geom"].intersection(o["geom"]).area
            if inter <= 0 or inter < 0.5 * min(b["geom"].area, o["geom"].area):
                continue
            if inter > best_for_body.get(bi, (None, 0.0))[1]:
                best_for_body[bi] = (int(oi), inter)
            if inter > best_for_osm.get(int(oi), (None, 0.0))[1]:
                best_for_osm[int(oi)] = (bi, inter)
    pairs = {}
    for bi, (oi, inter) in best_for_body.items():
        if best_for_osm[oi][0] == bi:
            union = bodies[bi]["geom"].union(osm[oi]["geom"]).area
            pairs[bi] = (osm[oi], round(inter / union, 3))
    named: dict[int, tuple[dict, float]] = {}
    for oi, (bi, inter) in best_for_osm.items():
        if osm_name(osm[oi]) and inter > named.get(bi, (None, 0.0))[1]:
            named[bi] = (osm[oi], inter)
    return pairs, {bi: o for bi, (o, _) in named.items()}


def osm_name(o: dict | None) -> str:
    return (
        (o["tags"].get("name") or o["tags"].get("name:en") or "").strip() if o else ""
    )


# ── layers ──────────────────────────────────────────────────────────────────


def build_boundary(live: bool):
    """NMC's outline, frozen as a pipeline input; returns the shapely polygon."""
    if live or not BOUNDARY_PATH.exists():
        feats = arcgis_features(
            f"{NMC_GIS}/3", "1=1", fields="OBJECTID,NAME,LASTUPDATE"
        )
        assert len(feats) == 1, (
            f"NMC city boundary: expected 1 feature, got {len(feats)}"
        )
        ms = feats[0]["properties"]["LASTUPDATE"]
        edited = datetime.fromtimestamp(ms / 1000, tz=timezone.utc).date().isoformat()
        assert edited == NMC_EDITED, (
            f"NMC boundary edited {edited}, pinned {NMC_EDITED}: re-check"
        )
        BOUNDARY_PATH.parent.mkdir(parents=True, exist_ok=True)
        # A pipeline input carries no envelope; write_artifact writes it as given.
        fc = {"type": "FeatureCollection", "features": feats}
        write_artifact(BOUNDARY_PATH, fc, compact=True)
    g = shape(json.loads(BOUNDARY_PATH.read_text())["features"][0]["geometry"])
    a = area_km2(g)
    assert abs(a - NMC_AREA_KM2) < 0.05, (
        f"NMC outline {a:.2f} km2, pinned {NMC_AREA_KM2}"
    )
    print(
        f"boundary: {a:.2f} km2 ({BOUNDARY_PATH.relative_to(REPO_ROOT)})",
        file=sys.stderr,
    )
    return g


def type_domain() -> dict[str, str]:
    meta = curl_json(f"{MRSAC_WR}/14", {"f": "json"})
    field = next(f for f in meta["fields"] if f["name"] == "WB_TYPE")
    return {c["code"]: c["name"] for c in field["domain"]["codedValues"]}


def build_water(
    city, osm_doc: dict | None, osm_snapshot: tuple[Path, str] | None
) -> None:
    domain = type_domain()
    raw = arcgis_features(
        f"{MRSAC_WR}/14",
        f"DISTCODE='{DISTCODE}'",
        bbox=FRAME,
        fields="OBJECTID,WB_CODE,WB_NAME,WB_TYPE,PROJ_NAME,Area_ha,SHAPE_Area",
    )
    for f in raw:
        p = f["properties"]
        # Area_ha IS km2: the publisher's own planar area in m2 is exactly 1e6 x it.
        assert abs(p["Area_ha"] * 1e6 - p["SHAPE_Area"]) < 1.0, (
            f"Area_ha unit changed: {p}"
        )
    islands = [f for f in raw if f["properties"]["WB_TYPE"] == ISLAND]
    bodies = []
    for f in raw:
        p = f["properties"]
        if p["WB_TYPE"] == ISLAND:
            continue
        g = shape(f["geometry"])
        bodies.append({"p": p, "geom": g if g.is_valid else g.buffer(0)})
    named = {b["p"]["WB_NAME"] for b in bodies if b["p"]["WB_NAME"]}
    missing = [n for n in REQUIRED_NAMES if n not in named]
    assert not missing, f"MRSAC layer no longer names {missing}"
    codes = [b["p"]["WB_CODE"] for b in bodies]
    assert len(set(codes)) == len(codes) and all(codes), (
        "WB_CODE is no longer a unique key"
    )

    if osm_snapshot:
        osm = osm_from_snapshot(osm_snapshot[0])
        osm_note, osm_date = (
            f"the {osm_snapshot[1]} OSM extract (Overpass unavailable)",
            osm_snapshot[1],
        )
    else:
        osm = osm_polygons(osm_doc)
        osm_date = osm_doc["osm3s"]["timestamp_osm_base"][:10]
        osm_note = f"OSM as of {osm_date}"
    matches, named_osm = match_osm(bodies, osm)
    boundary = shape(json.loads(BOUNDARY_PATH.read_text())["features"][0]["geometry"])

    feats = []
    for bi, b in enumerate(bodies):
        p = b["p"]
        label = domain[p["WB_TYPE"]]
        o, iou = matches.get(bi, (None, None))
        printed = (p["WB_NAME"] or "").strip()
        name, source = NAME_FIX.get(printed, printed), "mrsac"
        name_from = o if osm_name(o) else named_osm.get(bi)
        alt = osm_name(name_from)
        if not name and alt:
            name, source = alt, "osm"
        props = {
            "osm_id": o["id"] if o else f"mrsac:{p['WB_CODE']}",
            "osm_type": o["type"] if o else "",
            "name": name,
            "name_mr": (name_from["tags"].get("name:mr") or "") if name_from else "",
            "name_source": source if name else None,
            "water_type": TYPE_LABEL_FIX.get(label, label.lower()),
            "area_ha": round(p["Area_ha"] * 100, 2),
            "wb_code": p["WB_CODE"],
            "mrsac_type": label,
        }
        if printed != name and source == "mrsac":
            props["mrsac_name"] = printed
        if p.get("PROJ_NAME"):
            props["project"] = p["PROJ_NAME"].strip()
        if alt and alt != name:
            props["name_osm"] = alt
        if alt and name_from is not o:
            props["name_osm_id"] = f"{name_from['type']}/{name_from['id']}"
        if iou is not None:
            props["osm_match_iou"] = iou
        feats.append(
            {"type": "Feature", "properties": props, "geometry": gj(b["geom"])}
        )
    feats.sort(key=lambda f: (-f["properties"]["area_ha"], f["properties"]["wb_code"]))

    by_type: dict[str, int] = {}
    for f in feats:
        by_type[f["properties"]["mrsac_type"]] = (
            by_type.get(f["properties"]["mrsac_type"], 0) + 1
        )
    # Inside NMC's own outline: for the log and for copy, not a field on the page.
    in_city = [b for b in bodies if boundary.contains(b["geom"].representative_point())]
    sources = [
        {
            "id": WB_ID,
            "title": "MRSAC 1:10,000 water-body layer, 2017-18 (Gati Shakti Water_Resources/MapServer/14), Nagpur district (DISTCODE 505)",
            "publisher": "Maharashtra Remote Sensing Applications Centre (MRSAC), water bodies mapped 2017-18",
            "license": registry_license(WB_ID),
            "url": f"{MRSAC_WR}/14",
        },
        {
            "id": OSM_ID,
            "title": f"OpenStreetMap water polygons, names joined by overlap ({osm_note})",
            "publisher": "OpenStreetMap contributors",
            "license": registry_license(OSM_ID),
            "role": "input",
            "as_of": osm_date,
        },
    ]
    out = {
        "nvdm": "1.0",
        "dataset": "geojson-layers/water-bodies-current",
        "scope": {"kind": "city", "id": city},
        "provenance": {
            "sources": sources,
            "method": "mixed",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/build_nagpur_geography.py",
            "internal_inputs": [],
            "note": (
                "Geometry and type are MRSAC's 1:10,000 survey of 2017-18 for Nagpur district, inside the "
                "water-supply frame 20.9-21.75 N, 78.75-79.45 E (Totladoh and Kamthikhairy included). "
                "MRSAC's Area_ha field holds km2; area_ha here is that value x 100. Islands are dropped. "
                "Names are MRSAC's where it gives one, otherwise OpenStreetMap's for the OSM polygon "
                "paired with it (name_source says which); osm_id is the OpenStreetMap polygon paired with "
                "it by largest mutual overlap, or 'mrsac:<WB_CODE>' where none pairs, and osm_match_iou "
                "says how closely the outlines agree. The survey describes 2017-18: ponds dug since are "
                "not in it, and ponds filled since are shown as they were then. The layer is not a lake "
                "register."
            ),
        },
        # ext rides with the envelope, which write_artifact keeps from the first
        # write: only facts that cannot change on a re-run belong here.
        "ext": {
            "vintage": "2017-18",
            "frame": {
                "south": FRAME[0],
                "west": FRAME[1],
                "north": FRAME[2],
                "east": FRAME[3],
            },
        },
        "type": "FeatureCollection",
        "features": feats,
    }
    path = GEO_DIR / f"{city}-water-bodies-current.geojson"
    write_artifact(path, out, compact=True)
    named = [f for f in feats if f["properties"]["name"]]
    print(
        f"water: {len(feats)} bodies ({len(in_city)} in NMC), {len(named)} named "
        f"({sum(1 for f in named if f['properties']['name_source'] == 'mrsac')} MRSAC), "
        f"{len(matches)} OSM-matched, {len(islands)} islands dropped, {by_type} -> {path.name}",
        file=sys.stderr,
    )


def build_rivers(city) -> None:
    names = ",".join(f"'{r[2]}'" for r in RIVERS)
    segs = arcgis_features(
        f"{MRSAC_WR}/12",
        f"River_Name IN ({names})",
        bbox=RIVER_FRAME,
        fields="OBJECTID,River_Name,Description,Drainage_Order",
    )
    s, w, n, e = RIVER_FRAME
    frame = box(w, s, e, n)
    feats, fell_back = [], []
    for rid, label, mrsac_name, variants in RIVERS:
        lines = [
            s["geometry"]["coordinates"]
            for s in segs
            if s["properties"]["River_Name"] == mrsac_name and s["geometry"]
        ]
        source = "mrsac"
        if not lines:
            lines = osm_river_lines(variants)
            source = "osm"
            fell_back.append(rid)
        assert lines, f"{rid}: neither MRSAC nor OSM has a centreline"
        if rid in MAIN_COURSE_ONLY and source == "mrsac":
            lines, dropped = main_course(lines)
            assert dropped == MAIN_COURSE_ONLY[rid], (
                f"{rid}: left-out channels {dropped} km, pinned {MAIN_COURSE_ONLY[rid]}"
            )
            print(f"  {rid}: main course kept, {dropped} km left out", file=sys.stderr)
        coords = [rounded(line) for line in clip_to(lines, frame)]
        feats.append(
            {
                "type": "Feature",
                "properties": {
                    "river_id": rid,
                    "name": label,
                    "waterway": "river",
                    "length_km": round(sum(line_km(c) for c in coords), 1),
                    "segments": len(coords),
                    "source": source,
                    "source_name": mrsac_name if source == "mrsac" else label,
                },
                "geometry": {"type": "MultiLineString", "coordinates": coords},
            }
        )
    sources = [
        {
            "id": DRAIN_ID,
            "title": "MRSAC drainage network (Gati Shakti Water_Resources/MapServer/12), named segments",
            "publisher": "Maharashtra Remote Sensing Applications Centre (MRSAC)",
            "license": registry_license(DRAIN_ID),
            "url": f"{MRSAC_WR}/12",
        }
    ]
    if fell_back:
        sources.append(
            {
                "id": OSM_ID,
                "title": f"OpenStreetMap waterways, fallback for {', '.join(fell_back)}",
                "publisher": "OpenStreetMap contributors",
                "license": registry_license(OSM_ID),
            }
        )
    out = {
        "nvdm": "1.0",
        "dataset": "geojson-layers/rivers",
        "scope": {"kind": "city", "id": city},
        "provenance": {
            "sources": sources,
            "method": "api",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/build_nagpur_geography.py",
            "note": (
                f"MRSAC's named drainage segments for the Nag, Pili, Pora, Kanhan, Kolar and Wainganga, "
                f"clipped to the frame {s}-{n} N, {w}-{e} E, one MultiLineString per river; the Nag is "
                f"first because the rivers page opens the first river, and is its main connected course "
                f"only (a separate 10.9 km channel MRSAC also names Nag Nadi drains south toward Hingna "
                f"and is left out). length_km is the mapped length inside that frame, not the river's "
                f"full course."
            ),
        },
        "type": "FeatureCollection",
        "features": feats,
    }
    path = GEO_DIR / f"{city}-rivers.geojson"
    write_artifact(path, out, compact=True)
    print(
        "rivers: "
        + ", ".join(
            f"{f['properties']['river_id']} {f['properties']['length_km']} km"
            for f in feats
        )
        + f" -> {path.name}",
        file=sys.stderr,
    )


def osm_river_lines(variants) -> list:
    s, w, n, e = RIVER_FRAME
    rx = "|".join(variants)
    q = f'[out:json][timeout:180];way["waterway"="river"]["name"~"{rx}",i]({s},{w},{n},{e});out geom;'
    doc = overpass(q)
    return [
        [(p["lon"], p["lat"]) for p in el["geometry"]]
        for el in doc["elements"]
        if el.get("geometry")
    ]


def osm_water_doc() -> dict:
    s, w, n, e = FRAME
    box = f"({s},{w},{n},{e})"
    q = (
        f'[out:json][timeout:240];(way["natural"="water"]{box};'
        f'relation["natural"="water"]["type"="multipolygon"]{box};'
        f'way["water"~"lake|reservoir|pond|tank"]{box};way["landuse"="reservoir"]{box};'
        f'relation["landuse"="reservoir"]["type"="multipolygon"]{box};);out body geom;'
    )
    doc = overpass(q)
    CACHE.mkdir(parents=True, exist_ok=True)
    (CACHE / "osm-water.json").write_text(json.dumps(doc))
    return doc


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--layer", choices=["boundary", "water", "rivers", "all"], default="all"
    )
    ap.add_argument(
        "--live", action="store_true", help="re-fetch the frozen NMC outline"
    )
    ap.add_argument(
        "--osm-snapshot",
        type=Path,
        help="an earlier OSM water extract, if Overpass is down",
    )
    ap.add_argument("--osm-snapshot-date", help="YYYY-MM-DD the snapshot was fetched")
    ap.add_argument(
        "--osm-cache", action="store_true", help="reuse the last Overpass response"
    )
    a = ap.parse_args()
    city = "nagpur"
    if a.layer in ("boundary", "all") or not BOUNDARY_PATH.exists():
        build_boundary(a.live)
    if a.layer in ("water", "all"):
        snap = None
        if a.osm_snapshot:
            assert a.osm_snapshot_date, "--osm-snapshot needs --osm-snapshot-date"
            snap = (a.osm_snapshot, a.osm_snapshot_date)
        cached = CACHE / "osm-water.json"
        doc = (
            None
            if snap
            else json.loads(cached.read_text())
            if a.osm_cache
            else osm_water_doc()
        )
        build_water(city, doc, snap)
    if a.layer in ("rivers", "all"):
        build_rivers(city)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
