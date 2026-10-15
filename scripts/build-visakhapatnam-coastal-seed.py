#!/usr/bin/env python3
"""
Build the Visakhapatnam coastal-zone SEED layer for /visakhapatnam/shoreline.

The Mumbai pattern, not the Chennai one: we have found no study that publishes
per-zone erosion RATES for this coast. The official record is
classification-based:

  * NCCR, National Assessment of Shoreline Changes along Indian Coast
    1990-2016 (Kankara, Ramana Murthy & Rajeevan, July 2018), Table 16 (PDF
    p57, printed p46): the UNDIVIDED Visakhapatnam district, 136.98 km of
    coast, 102.74 km of it stable. Class bands are its Table 4 (PDF p25).
  * MoES reply to Lok Sabha unstarred question 2638 (11 December 2024): the
    present, smaller district (68.08 km; 26.9% erosion, 49.5% stable, 23.7%
    accretion) and four stretches classed "Low Erosion": Yarada, RK Beach,
    Mangamari Peta to Bheemili, Bheemunipatnam to Pedanagamayyapalem.

The two district figures cover different district boundaries and are never
put side by side as if comparable. Zones carry the stretch classes with
mean_erosion_m_yr = null (source "assessment-reported"); the RATES come from
our own GEE transect measurement (neer-vazhvu-api/app/gee/coastline.py). No
hotspots file: we have found no public source that gives per-spot rates here.

Geometry: live OSM natural=coastline, seaward face only. The coast bears about
50 degrees (SW -> NE), so the face is the most seaward vertex per 200 m bin
ALONG that axis, not per latitude bin. Two port zig-zags are chorded across,
the way Mumbai's seed chords its creek mouths: the Visakhapatnam Port inner
harbour (17.678-17.707 N) and Gangavaram port (17.619-17.634 N).

transect_masks (zone property, read by coastline.py; the page ignores it):
  drop  - the two harbour chords: a harbour basin has no beach to measure.
  low   - transects crossing an OSM breakwater/groyne/pier, on the shore the
          Gangavaram port built either side of its basin, at the Dolphin's Nose
          headland, or beside a river/stream mouth: the water edge there is set
          by a structure, rock or a moving river mouth. Also two transects
          (JUMP_LOW) whose measured waterline jumps 180 m or more between
          epochs up to 2015, which coastline.py's confidence test (2015 on)
          does not see.

Run:  python3 scripts/build-visakhapatnam-coastal-seed.py
Writes:
  public/geojson/visakhapatnam-coastal-zones.geojson
"""

import collections
import json
import math
import time
import urllib.request
from datetime import date
from pathlib import Path

from nvdm_write import write_artifact
from registry_license import registry_license

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "geojson" / "visakhapatnam-coastal-zones.geojson"

BBOX = (17.53, 83.10, 17.96, 83.55)  # south, west, north, east
OVERPASS_MIRRORS = [
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

NCCR_URL = "https://www.nccr.gov.in/sites/default/files/schangenew.pdf"
# moes.gov.in now returns 404 for this file; the archived copy is byte-identical
# to the one read for this layer (sha256 c04b1c82...b3c308).
USQ2638_URL = (
    "https://web.archive.org/web/20250523084912/"
    "https://moes.gov.in/sites/default/files/2638English.pdf"
)
CWC_URL = "https://irrigation.kerala.gov.in/sites/default/files/2021-06/CWC_Guidelines_Coastal.pdf"
VPA_AR_URL = "https://shipmin.gov.in/sites/default/files/AR%2C_AA_and_%20Audit_Report%20English_2022-23.pdf"

LABEL_CLASSED = (
    "MoES reply to Lok Sabha USQ 2638 (11 Dec 2024), from NCCR's shoreline assessment"
)
LABEL_UNCLASSED = (
    "NCCR National Assessment of Shoreline Changes 1990-2016 (Kankara et al. 2018)"
)

# Along-shore frame: u along the coast axis (NE positive), v across it
# (SE = seaward positive). Bearing from the r6 coast analysis.
AXIS_DEG = 50.0
LON0, LAT0 = 83.3, 17.75
BIN_M = 200.0

# Port zig-zags to chord across: (name, lat_lo, lat_hi). Face vertices inside
# the band are dropped, so the baseline runs straight between the last vertex
# south of it and the first vertex north of it.
CHORDS = [
    ("Gangavaram port", 17.619, 17.634),
    ("Visakhapatnam Port inner harbour", 17.678, 17.707),
]
# Shore beside a chord that the port itself built (breakwater roots, reclaimed
# land): marked low within this radius of each chord end. Gangavaram's flank
# transects only find a waterline from the 2010 epoch on (2026 run), i.e. the
# shore there postdates the port. The Visakhapatnam Port's flanks are the
# Dolphin's Nose headland (own mask) and RK Beach (a real, managed beach).
CHORD_FLANK_M = {"Gangavaram port": 600}

# OSM anchors (lon, lat).
APPIKONDA = (83.1722, 17.5726)  # shore point nearest OSM node 11302704074
GOSTHANI_MOUTH = (83.45523, 17.89829)  # end of OSM way 244052580 (Gosthani)
PEDDA_NAGAMAYYAPALEM = (83.4619059, 17.9151335)  # OSM node 5594589856
DOLPHINS_NOSE = (83.2927403, 17.6784558)  # OSM node 784279368
HEADLAND_RADIUS_M = 400
STRUCTURE_NAMES = {
    90821567: "the Visakhapatnam Port outer breakwater",
    630150420: "the Rushikonda breakwater",
    593618996: "a Gangavaram port breakwater",
    1551953095: "a Gangavaram port pier",
    1551953096: "a Gangavaram port breakwater",
}
STRUCTURE_NEAR_M = 450  # transects reach 400 m seaward / 260 m landward
MOUTH_NEAR_M = 200
MOUTH_RADIUS_M = {"river": 400, "stream": 250}
# Transect origins (2026 run) whose series jumps 180 m or more between epochs
# up to 2015, likely a snap to another water edge: 256 (+10.0 m in 2005,
# -168.5 m in 2010) and 529 (0 in 1990, -390.6 m in 1995, -380.1 m in 2010,
# -136.3 m in 2015). The radius is half the 100 m transect spacing, so each
# mask catches one transect.
JUMP_RADIUS_M = 50
EDGE = "in its measured water edge"
CAUGHT = "most likely where the reading caught a different edge"
JUMP_LOW = [
    (
        "waterline jump, RK Beach",
        (83.33921, 17.7212),
        f"shows a single jump of about 180 m {EDGE} between 2005 and 2010, {CAUGHT}",
    ),
    (
        "waterline jump, north of the Gosthani mouth",
        (83.46329, 17.90802),
        f"shows jumps of about 390 m (1990 to 1995) and 240 m (2010 to 2015) {EDGE}, "
        f"{CAUGHT}",
    ),
]

CLASS_LOW = "Low Erosion (MoES 2024)"
# MoES names "Yarada" with no extent, so zone II's badge names the beach.
CLASS_LOW_YARADA = "Low Erosion at Yarada (MoES 2024)"
# Not "no class": NCCR classes the whole coast; USQ 2638 lists only the
# erosion-prone stretches.
CLASS_NONE = "Not on the erosion-prone list (MoES 2024)"
# Analysis window behind each zone's record. NCCR Table 16 is 1990-2016. USQ
# 2638 states none; it cites the updated NCCR atlas (25 Mar 2022), which MoES
# gives as 1990-2018 (PIB 1811914, 31 Mar 2022; Rajya Sabha USQ 498, 21 Jul
# 2022). So PERIOD_MOES is our inference, and the envelope note says so.
# 2024 is the reply's date, not a data period.
PERIOD_NCCR = "1990-2016"
PERIOD_MOES = "1990-2018"

# start = (lon, lat) projected onto the axis; "chord:<name>:start|end" = that
# chord's endpoint, so zone III is exactly the harbour chord.
ZONES = [
    {
        "zone_id": "I",
        "zone_name": "Appikonda - Gangavaram",
        "start": APPIKONDA,
        "class_label": CLASS_NONE,
        "dominant_trend": "mixed",
        "summary": "The southern beaches from Appikonda up to the Gangavaram "
        "port. NCCR's shoreline assessment covers the whole district coast, "
        "but this stretch is not among the erosion-prone ones the Ministry of "
        "Earth Sciences named in December 2024, and we have not found a "
        "published rate for it. Our transects give the only per-point rates "
        "here that we know of. Transects on the shore the port built beside "
        "its breakwaters, and beside a small river mouth just south of it, "
        "are marked low confidence.",
    },
    {
        "zone_id": "II",
        "zone_name": "Gangavaram port - Yarada - Dolphin's Nose",
        "start": "chord:Gangavaram port:start",
        "class_label": CLASS_LOW_YARADA,
        "dominant_trend": "erosion",
        "summary": "From the Gangavaram port north past Yarada beach to the "
        "Dolphin's Nose headland. Yarada is one of four Visakhapatnam "
        "stretches classed Low Erosion in the Ministry of Earth Sciences' "
        "reply in the Lok Sabha on 11 December 2024 (NCCR's assessment; Low "
        "Erosion means the shore moves back 0.5 to 3 m a year). The ministry "
        "gives no extent for Yarada, so we do not extend the class to the port "
        "flanks or the headland. NCCR's 2018 report credits the Kailasa and "
        "Yarada ranges with keeping Visakhapatnam district's coast the most "
        "stable in Andhra Pradesh; the Yarada hills rise behind this zone. The "
        "port basin has no beach to measure, so its transects are left out; "
        "those beside its breakwaters and at the headland are marked low "
        "confidence.",
    },
    {
        "zone_id": "III",
        "zone_name": "Visakhapatnam Port entrance and inner harbour",
        "start": "chord:Visakhapatnam Port inner harbour:start",
        "class_label": CLASS_NONE,
        "dominant_trend": "mixed",
        "summary": "Dolphin's Nose to the Naval Coastal Battery: the "
        "Visakhapatnam Port entrance and inner harbour. A harbour basin has no "
        "beach to measure, so the baseline is drawn straight across it and no "
        "transects are kept here. The port moves sand that builds up south of "
        "its south breakwater to the beach north of its north breakwater "
        "(sand bypassing, CWC/NIO coastal erosion guidelines 2020).",
    },
    {
        "zone_id": "IV",
        "zone_name": "RK Beach: Coastal Battery - Kursura - Pedda Waltair",
        "start": "chord:Visakhapatnam Port inner harbour:end",
        "class_label": CLASS_LOW,
        "dominant_trend": "erosion",
        "summary": "The city beach, classed Low Erosion in the Ministry of "
        "Earth Sciences' 2024 reply. RK Beach is a managed beach: the port "
        "moves sand from south of its harbour onto this shore (sand "
        "bypassing, CWC/NIO 2020), and a Rs 20 crore sand-trap dredging for "
        "beach nourishment was inaugurated on 12 February 2023 (VPA "
        "Administration Report 2022-23). A stable or advancing waterline here "
        "reflects that added sand, not only natural change.",
    },
    {
        "zone_id": "V",
        "zone_name": "Lawson's Bay - Tenneti - Jodugullapalem - Sagar Nagar",
        "start": (83.3400, 17.7270),
        "class_label": CLASS_NONE,
        "dominant_trend": "mixed",
        "summary": "The shore below the Kailasagiri hills: Lawson's Bay, "
        "Tenneti Park, Jodugullapalem and Sagar Nagar. NCCR's shoreline "
        "assessment covers the whole district coast, but this stretch is not "
        "among the erosion-prone ones the Ministry of Earth Sciences named in "
        "December 2024, and we have not found a published rate for it. Our "
        "transects give the only per-point rates here that we know of.",
    },
    {
        "zone_id": "VI",
        "zone_name": "Rushikonda - Thotlakonda",
        "start": (83.3700, 17.7700),
        "class_label": CLASS_NONE,
        "dominant_trend": "mixed",
        "summary": "Rushikonda beach and the Thotlakonda headland. The 2024 "
        "list of erosion-prone stretches names none here. Transects across "
        "the small Rushikonda breakwater and beside the Maddi Gedda outlet are "
        "marked low confidence.",
    },
    {
        "zone_id": "VII",
        "zone_name": "Mangamaripeta - Chepaluppada - Bheemunipatnam",
        "start": (83.4161, 17.8300),
        "class_label": CLASS_LOW,
        "dominant_trend": "erosion",
        "summary": "Classed Low Erosion in the Ministry of Earth Sciences' "
        "2024 reply ('Mangamari Peta to Bheemili'). Transects beside the "
        "Gosthani river "
        "mouth at the zone's northern end are marked low confidence: a river "
        "mouth's sand bar moves from season to season.",
    },
    {
        "zone_id": "VIII",
        "zone_name": "Bheemunipatnam - Pedanagamayyapalem",
        "start": GOSTHANI_MOUTH,
        "class_label": CLASS_LOW,
        "dominant_trend": "erosion",
        "summary": "North of the Gosthani mouth to Pedda Nagamayyapalem, "
        "classed Low Erosion in the Ministry of Earth Sciences' 2024 reply "
        "('Bheemunipatnam to Pedanagamayyapalem'). Transects beside the river "
        "mouth are marked low confidence.",
    },
]
END = PEDDA_NAGAMAYYAPALEM

_K = math.cos(math.radians(LAT0))
_TH = math.radians(AXIS_DEG)


def uv(p):
    x = (p[0] - LON0) * 111320.0 * _K
    y = (p[1] - LAT0) * 111320.0
    return x * math.sin(_TH) + y * math.cos(_TH), x * math.cos(_TH) - y * math.sin(_TH)


def haversine(a, b):
    R = 6371000.0
    la1, lo1, la2, lo2 = map(math.radians, [a[1], a[0], b[1], b[0]])
    dla, dlo = la2 - la1, lo2 - lo1
    h = math.sin(dla / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin(dlo / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def line_len_km(line):
    return sum(haversine(line[i], line[i + 1]) for i in range(len(line) - 1)) / 1000.0


def point_seg_m(p, a, b):
    """Distance (m) from p to segment ab, in the local along/across frame."""
    (px, py), (ax, ay), (bx, by) = uv(p), uv(a), uv(b)
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L2))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def fetch_osm():
    s, w, n, e = BBOX
    query = (
        "[out:json][timeout:120];\n("
        f'way["natural"="coastline"]({s},{w},{n},{e});'
        f'way["man_made"~"^(breakwater|groyne|pier)$"]({s},{w},{n},{e});'
        f'way["waterway"~"^(river|stream)$"]({s},{w},{n},{e});'
        ");\nout tags geom;"
    )
    last = None
    for mirror in OVERPASS_MIRRORS:
        try:
            req = urllib.request.Request(
                mirror,
                data=query.encode(),
                headers={"User-Agent": "neervazhvu-coastal/1.0"},
            )
            data = json.loads(urllib.request.urlopen(req, timeout=150).read())
            ways = [
                e
                for e in data["elements"]
                if e.get("type") == "way" and e.get("geometry")
            ]
            if any(w.get("tags", {}).get("natural") == "coastline" for w in ways):
                print(f"  fetched {len(ways)} ways from {mirror}")
                return ways
        except Exception as exc:  # noqa: BLE001 - mirror fallback
            last = exc
            print(f"  {mirror} failed: {exc!r}")
        time.sleep(2)
    raise RuntimeError(f"all Overpass mirrors failed: {last!r}")


def geom(way):
    return [(p["lon"], p["lat"]) for p in way["geometry"]]


def seaward_face(coast_ways):
    """Most seaward (max v) vertex per BIN_M bin along the coast axis, SW -> NE."""
    bins = collections.defaultdict(list)
    for way in coast_ways:
        for p in geom(way):
            u, v = uv(p)
            bins[math.floor(u / BIN_M)].append((v, p))
    return [max(bins[b])[1] for b in sorted(bins)]


def clip_and_chord(face):
    u0, u1 = uv(APPIKONDA)[0], uv(END)[0]
    face = [p for p in face if u0 <= uv(p)[0] <= u1]
    chords = {}
    for name, lo, hi in CHORDS:
        inside = [i for i, p in enumerate(face) if lo <= p[1] <= hi]
        if not inside:
            raise RuntimeError(f"chord {name}: no face vertices in {lo}-{hi} N")
        i0, i1 = inside[0] - 1, inside[-1] + 1
        chords[name] = (face[i0], face[i1])
        print(
            f"  chord {name}: dropped {len(inside)} vertices; "
            f"{face[i0][1]:.5f},{face[i0][0]:.5f} -> {face[i1][1]:.5f},{face[i1][0]:.5f} "
            f"({haversine(face[i0], face[i1]) / 1000:.2f} km)"
        )
        face = face[: i0 + 1] + face[i1:]
    return face, chords


def zone_breaks(chords):
    out = []
    for z in ZONES:
        st = z["start"]
        if isinstance(st, str):
            _, name, end = st.split(":")
            st = chords[name][0 if end == "start" else 1]
        out.append(uv(st)[0])
    return out


def split_zones(face, breaks):
    """Zone i takes the vertices with breaks[i] <= u < breaks[i+1], plus the
    next zone's first vertex so neighbours share a boundary vertex (and a chord
    zone is exactly its two endpoints)."""
    us = [uv(p)[0] for p in face]
    bounds = list(breaks) + [math.inf]
    segments = []
    for i in range(len(ZONES)):
        idx = [
            j for j, u in enumerate(us) if bounds[i] - 1e-6 <= u < bounds[i + 1] - 1e-6
        ]
        if idx and idx[-1] + 1 < len(face) and i + 1 < len(ZONES):
            idx.append(idx[-1] + 1)
        segments.append([face[j] for j in idx])
    return segments


def build_masks(ways, face, chords):
    chord_pairs = set(chords.values())
    kept_segs = [
        (face[i], face[i + 1])
        for i in range(len(face) - 1)
        if (face[i], face[i + 1]) not in chord_pairs
    ]

    def near_face(p, m):
        return any(point_seg_m(p, a, b) <= m for a, b in kept_segs)

    masks = []
    for name, (a, b) in chords.items():
        masks.append(
            {
                "name": name,
                "action": "drop",
                "reason": f"lies across the {name} basin, which has no beach",
                "geometry": {"type": "LineString", "coordinates": rc([a, b])},
            }
        )
        for side, end in (("south", a), ("north", b)):
            if name in CHORD_FLANK_M:
                masks.append(
                    {
                        "name": f"{name} {side} flank",
                        "action": "low",
                        "reason": f"sits on shore built by the {name}, next to its breakwaters",
                        "geometry": {"type": "Point", "coordinates": rc([end])[0]},
                        "radius_m": CHORD_FLANK_M[name],
                    }
                )
    for w in ways:
        mm = w.get("tags", {}).get("man_made")
        if mm not in ("breakwater", "groyne", "pier"):
            continue
        g = geom(w)
        if not any(near_face(p, STRUCTURE_NEAR_M) for p in g):
            continue
        label = STRUCTURE_NAMES.get(w["id"], f"a {mm} mapped in OpenStreetMap")
        closed = len(g) >= 4 and g[0] == g[-1]
        masks.append(
            {
                "name": f"OSM way {w['id']} ({mm})",
                "action": "low",
                "reason": f"crosses {label}",
                "geometry": {
                    "type": "Polygon" if closed else "LineString",
                    "coordinates": [rc(g)] if closed else rc(g),
                },
            }
        )
    hn = min(face, key=lambda p: haversine(p, DOLPHINS_NOSE))
    masks.append(
        {
            "name": "Dolphin's Nose",
            "action": "low",
            "reason": "sits at the Dolphin's Nose headland",
            "geometry": {"type": "Point", "coordinates": rc([hn])[0]},
            "radius_m": HEADLAND_RADIUS_M,
        }
    )
    mouths = []
    for w in ways:
        kind = w.get("tags", {}).get("waterway")
        if kind not in MOUTH_RADIUS_M:
            continue
        for end in (geom(w)[0], geom(w)[-1]):
            if not near_face(end, MOUTH_NEAR_M):
                continue
            if any(haversine(end, m[0]) < 150 for m in mouths):
                continue
            name = w.get("tags", {}).get("name")
            mouths.append((end, kind, name, w["id"]))
    for end, kind, name, wid in mouths:
        label = f"the {name} mouth" if name else f"an unnamed {kind} mouth"
        masks.append(
            {
                "name": f"{name or kind} mouth (OSM way {wid})",
                "action": "low",
                "reason": f"lies beside {label}",
                "geometry": {"type": "Point", "coordinates": rc([end])[0]},
                "radius_m": MOUTH_RADIUS_M[kind],
            }
        )
    return masks + jump_masks()


def jump_masks():
    """JUMP_LOW as masks (geometry-free: re-applicable without Overpass)."""
    return [
        {
            "name": name,
            "action": "low",
            "reason": reason,
            "geometry": {"type": "Point", "coordinates": list(pt)},
            "radius_m": JUMP_RADIUS_M,
        }
        for name, pt, reason in JUMP_LOW
    ]


def mask_anchor_u(m):
    g = m["geometry"]
    pts = (
        [g["coordinates"]]
        if g["type"] == "Point"
        else g["coordinates"][0]
        if g["type"] == "Polygon"
        else g["coordinates"]
    )
    return sum(uv(p)[0] for p in pts) / len(pts)


def rc(line, ndigits=5):
    return [[round(lon, ndigits), round(lat, ndigits)] for lon, lat in line]


NOTE = (
    "Seed layer for /visakhapatnam/shoreline: OSM coastline geometry, seaward "
    "face only (most seaward vertex per 200 m bin along the 50 degree coast "
    "axis; the Visakhapatnam Port inner harbour and the Gangavaram port are "
    "chorded across), carrying the official stretch classes. NCCR's national "
    "assessment (Kankara et al. 2018, Table 16) covers the undivided district "
    "(136.98 km, 1990-2016). The MoES reply to Lok Sabha USQ 2638 (11 Dec "
    "2024) covers the present district (68.08 km) and classes Yarada, RK "
    "Beach, Mangamari Peta to Bheemili and Bheemunipatnam to "
    "Pedanagamayyapalem as Low Erosion. The two district figures describe "
    "different boundaries and are not compared. Each zone's period is the "
    "analysis window of its record: 1990-2016 for the zones resting on NCCR's "
    "Table 16 (I, III, V, VI). USQ 2638 states no window, so the 1990-2018 on "
    "the four MoES-classed zones (II, IV, VII, VIII) is our inference: it is "
    "the window MoES gives for the same updated NCCR atlas of 25 March 2022 "
    "(PIB release, 31 Mar 2022; Rajya Sabha USQ 498, 21 Jul 2022). "
    "mean_erosion_m_yr is null by design: we have found no public source that "
    "gives per-zone rates; rates come from the computed transect layer. "
    "transect_masks tell the GEE stage which transects to drop (harbour "
    "chords) or mark low confidence (breakwaters, piers, the Gangavaram port's "
    "built flanks, the Dolphin's Nose headland, river mouths, and two "
    "transects, at RK Beach and north of the Gosthani mouth, whose measured "
    "waterline jumps 180 m or more between epochs up to 2015). Geometry is "
    "fetched live from Overpass, hence internal_inputs []."
)


def envelope():
    """The NVDM envelope main() writes ahead of the features."""
    return {
        "nvdm": "1.0",
        "dataset": "geojson-layers/coastal-zones",
        "scope": {"kind": "city", "id": "visakhapatnam"},
        "provenance": {
            "sources": [
                {
                    "id": "osm-overpass",
                    "title": "OpenStreetMap coastline, breakwater/pier and river-mouth geometry (Overpass extract)",
                    "publisher": "OpenStreetMap contributors",
                    "license": registry_license("osm-overpass"),
                    "role": "input",
                },
                {
                    "id": "nccr-shoreline-assessment",
                    "title": "NCCR National Assessment of Shoreline Changes 1990-2016 (Table 16), the "
                    "MoES reply to Lok Sabha USQ 2638 (11 Dec 2024) stretch classes, and the "
                    "1990-2018 window MoES gives for NCCR's updated atlas (PIB release 31 Mar "
                    "2022; Rajya Sabha USQ 498, 21 Jul 2022)",
                    "publisher": "National Centre for Coastal Research, Ministry of Earth Sciences",
                    "license": registry_license("nccr-shoreline-assessment"),
                    "role": "asserts",
                },
                {
                    "id": "cwc-coastal-erosion-guidelines-2020",
                    "title": "Guidelines for Protection and Control of Coastal Erosion in India "
                    "(sand bypassing at Visakhapatnam, printed p22)",
                    "publisher": "Central Water Commission (prepared by CSIR-National Institute of Oceanography)",
                    "url": CWC_URL,
                    "license": registry_license("cwc-coastal-erosion-guidelines-2020"),
                    "as_of": "2020-12",
                },
                {
                    "id": "vpa-administration-report-2022-23",
                    "title": "Visakhapatnam Port Authority Administration Report 2022-23 (sand-trap dredging "
                    "for beach nourishment, inaugurated 12.2.2023, Rs 20 crore; PDF p13)",
                    "publisher": "Visakhapatnam Port Authority, Ministry of Ports, Shipping and Waterways",
                    "url": VPA_AR_URL,
                    "license": registry_license("vpa-administration-report-2022-23"),
                    "as_of": "2023",
                },
            ],
            "method": "mixed",
            "produced_at": date.today().isoformat(),
            "produced_by": "scripts/build-visakhapatnam-coastal-seed.py",
            "internal_inputs": [],
            "note": NOTE,
        },
    }


def zone_props(z, length_km):
    """A zone's properties before its transect_masks (geometry-free, so an
    Overpass outage can still re-apply them to the committed features)."""
    classed = z["class_label"] != CLASS_NONE
    return {
        "zone_id": z["zone_id"],
        "zone_name": z["zone_name"],
        "length_km": length_km,
        "mean_erosion_m_yr": None,
        "dominant_trend": z["dominant_trend"],
        "class_label": z["class_label"],
        "summary": z["summary"],
        "source": "assessment-reported",
        "source_label": LABEL_CLASSED if classed else LABEL_UNCLASSED,
        "source_url": USQ2638_URL if classed else NCCR_URL,
        "period": PERIOD_MOES if classed else PERIOD_NCCR,
    }


def main():
    print("Fetching OSM coastline, structures and waterways...")
    ways = fetch_osm()
    coast = [w for w in ways if w.get("tags", {}).get("natural") == "coastline"]
    face, chords = clip_and_chord(seaward_face(coast))
    print(f"  seaward face: {len(face)} vertices, ~{line_len_km(face):.1f} km")
    breaks = zone_breaks(chords)
    segments = split_zones(face, breaks)
    masks = build_masks(ways, face, chords)

    by_zone = collections.defaultdict(list)
    for m in masks:
        u = mask_anchor_u(m)
        zi = max([i for i, b in enumerate(breaks) if b <= u + 1e-6] or [0])
        by_zone[zi].append(m)

    features = []
    for zi, (z, seg) in enumerate(zip(ZONES, segments)):
        if len(seg) < 2:
            raise RuntimeError(f"zone {z['zone_id']} has no shore vertices")
        props = zone_props(z, round(line_len_km(seg), 1))
        if by_zone.get(zi):
            props["transect_masks"] = by_zone[zi]
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": rc(seg)},
                "properties": props,
            }
        )
        print(
            f"  zone {z['zone_id']:>4} {z['zone_name']:<52} ~{line_len_km(seg):.1f} km"
            f" | masks {[m['action'] + ':' + m['reason'] for m in by_zone.get(zi, [])]}"
        )

    out = {
        **envelope(),
        "type": "FeatureCollection",
        "name": "visakhapatnam-coastal-zones",
        "features": features,
    }
    # Envelope-preserving write (scripts/nvdm_write.py): envelope() is the
    # first write's; a regeneration keeps the committed one, so a provenance
    # change ships only after the old file is deleted.
    write_artifact(OUT, out, compact=True)
    print(f"Wrote {len(features)} zones, {len(masks)} transect masks -> {OUT}")


if __name__ == "__main__":
    main()
