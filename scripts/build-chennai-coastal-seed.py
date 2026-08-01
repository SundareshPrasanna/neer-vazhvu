#!/usr/bin/env python3
"""
Build the Chennai coastal-zone SEED layer for the /chennai/coastal page.

This produces a zone-level overview of shoreline change, keyed to:

  Anagha V.S., Alka Singh & Frederic Frappart (2026),
  "Shoreline and salinity shifts along the Chennai coast", Environmental
  Challenges (Elsevier). DOI 10.1016/j.envc.2026.101514.
  PII https://www.sciencedirect.com/science/article/pii/S2667010026001083

It is a SEED, not our own reproduction: the geometry is the live OpenStreetMap
coastline, and the erosion/accretion numbers are the study's published per-zone
figures. The independent transect-level reproduction (CoastSat + DSAS, 861
transects) is the GEE pipeline at neer-vazhvu-api/app/gee/coastline.py, which
replaces these files with computed rates once run. Properties carry
source = "study-reported" so the UI can label provenance honestly.

Method:
  1. Fetch natural=coastline ways for the Chennai bbox from Overpass.
  2. Stitch ways into one chain by shared endpoints.
  3. Extract the seaward shore (easternmost point per latitude bin) so lagoon
     inner shores don't pollute the line.
  4. Split the shore into the study's six zones by their published along-shore
     lengths (14, 10.3, 9.4, 12.2, 24.6, 15.6 km).
  5. Attach per-zone trend + rate metadata and named port hotspots.

Output (minified GeoJSON):
  public/geojson/chennai-coastal-zones.geojson      (6 LineString zones)
  public/geojson/chennai-coastal-hotspots.geojson   (named point hotspots)

Run:  python scripts/build-chennai-coastal-seed.py
"""

import collections
import sys
from pathlib import Path
import json

sys.path.insert(0, str(Path(__file__).resolve().parent))
from nvdm_write import write_artifact  # noqa: E402
import math
import os
import urllib.request

BBOX = (12.55, 80.1, 13.6, 80.45)  # south, west, north, east (south to Mahabalipuram)
OVERPASS_MIRRORS = [
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "geojson")
STUDY_URL = "https://www.sciencedirect.com/science/article/pii/S2667010026001083"
STUDY_CITE = "Anagha, Singh & Frappart 2026 (Environmental Challenges)"

# Per-zone metadata, all numbers from the study (results section 3.1-3.2 and
# the conclusions). mean_erosion_m_yr is the study's per-zone mean erosion rate;
# dominant_trend reflects which signal dominates the zone over 1990-2024.
ZONES = [
    {
        "zone_id": "S",
        "zone_name": "ECR: Mahabalipuram - Uthandi",
        "length_km": 22.0,
        "mean_erosion_m_yr": None,  # beyond the study area; no published rate
        "dominant_trend": "mixed",
        "summary": "Our southern extension along the East Coast Road, from "
        "Mahabalipuram up to Uthandi. This stretch sits south of the "
        "published study, so only our own transect measurement covers "
        "it - there is no study rate to validate against here.",
    },
    {
        "zone_id": "I",
        "zone_name": "Uthandi - Thiruvanmiyur",
        "length_km": 14.0,
        "mean_erosion_m_yr": 0.48,
        "dominant_trend": "stable",
        "summary": "Conservation sector and Olive Ridley turtle nesting ground. "
        "The most geomorphologically stable stretch: only ~16 m of "
        "retreat over 34 years.",
    },
    {
        "zone_id": "II",
        "zone_name": "Adyar & Cooum mouths",
        "length_km": 10.3,
        "mean_erosion_m_yr": 1.15,
        "dominant_trend": "accretion",
        "summary": "Accretion dominates 80.5% of transects (up to ~7.8 m/yr) as "
        "littoral drift traps urban silt at the Adyar and Cooum river "
        "mouths. Includes Besant Nagar and Marina beaches.",
    },
    {
        "zone_id": "III",
        "zone_name": "Chennai Port",
        "length_km": 9.4,
        "mean_erosion_m_yr": 0.76,
        "dominant_trend": "accretion",
        "summary": "Chennai Port breakwaters intercept northward drift, gaining "
        "~1.1 km of land to the south. Extensive seawalls suppressed "
        "the down-drift erosion seen at the newer northern ports.",
    },
    {
        "zone_id": "IV",
        "zone_name": "Kasimedu groyne field",
        "length_km": 12.2,
        "mean_erosion_m_yr": 1.66,
        "dominant_trend": "mixed",
        "summary": "Post-2004 seawalls and a ~5 km groyne field trap sediment "
        "locally (~0.96 m/yr accretion) but starve down-drift segments, "
        "with erosion intensifying after 2015.",
    },
    {
        "zone_id": "V",
        "zone_name": "Ennore - Kattupalli ports",
        "length_km": 24.6,
        "mean_erosion_m_yr": 4.34,
        "dominant_trend": "erosion",
        "summary": "The most volatile zone. Ennore and Kattupalli port breakwaters "
        "interrupt sand bypass, driving severe down-drift erosion on "
        "their northern flanks (21.3 and 16 m/yr); the north-Kattupalli "
        "sector retreated nearly 1 km.",
    },
    {
        "zone_id": "VI",
        "zone_name": "Pulicat lagoon",
        "length_km": 15.6,
        "mean_erosion_m_yr": 2.97,
        "dominant_trend": "mixed",
        "summary": "Ecologically sensitive lagoon and bird sanctuary. Highly "
        "variable: the south advanced over 2 km while the north eroded "
        "up to 5.7 m/yr, a net lagoon loss of ~0.92 km, with mangrove "
        "decline. A proposed Kattupalli expansion is a further risk.",
    },
]

# Named hotspots with the study's specific rates. lon/lat are approximate and
# snapped to the nearest shore vertex at build time.
HOTSPOTS = [
    {
        "name": "Chennai Port",
        "lat": 13.10,
        "lon": 80.30,
        "zone_id": "III",
        "rate_m_yr": 34.8,
        "trend": "accretion",
        "note": "Port expansion (1995-2010) accreted up to 34.8 m/yr, gaining "
        "~1.1 km of land behind seawalls.",
    },
    {
        "name": "Adyar / Cooum mouths",
        "lat": 13.02,
        "lon": 80.28,
        "zone_id": "II",
        "rate_m_yr": 7.78,
        "trend": "accretion",
        "note": "River-mouth accretion up to 7.78 m/yr from trapped urban silt.",
    },
    {
        "name": "North of Ennore Port",
        "lat": 13.26,
        "lon": 80.345,
        "zone_id": "V",
        "rate_m_yr": -21.3,
        "trend": "erosion",
        "note": "Down-drift erosion of 21.3 m/yr immediately north of Ennore "
        "Port, where the breakwater starves the sand supply.",
    },
    {
        "name": "North of Kattupalli Port",
        "lat": 13.31,
        "lon": 80.34,
        "zone_id": "V",
        "rate_m_yr": -16.0,
        "trend": "erosion",
        "note": "Down-drift erosion of 16 m/yr; the north-Kattupalli sector "
        "retreated nearly 1 km (peak -71 m/yr, 2010-2024) as a second "
        "port compounded the sediment deficit.",
    },
    {
        "name": "North Pulicat",
        "lat": 13.50,
        "lon": 80.32,
        "zone_id": "VI",
        "rate_m_yr": -5.7,
        "trend": "erosion",
        "note": "Chronic erosion up to 5.7 m/yr on the northern lagoon shore; "
        "net lagoon loss of ~0.92 km with mangrove decline.",
    },
]


def haversine(a, b):
    R = 6371000.0
    la1, lo1, la2, lo2 = map(math.radians, [a[1], a[0], b[1], b[0]])
    dla, dlo = la2 - la1, lo2 - lo1
    h = math.sin(dla / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin(dlo / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def line_len_km(line):
    return sum(haversine(line[i], line[i + 1]) for i in range(len(line) - 1)) / 1000.0


def fetch_coastline():
    query = (
        "[out:json][timeout:120];\n"
        f'way["natural"="coastline"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});\n'
        "out geom;"
    )
    last = None
    for mirror in OVERPASS_MIRRORS:
        try:
            req = urllib.request.Request(
                mirror,
                data=query.encode(),
                headers={"User-Agent": "neervazhvu-coastal/1.0"},
            )
            raw = urllib.request.urlopen(req, timeout=150).read()
            data = json.loads(raw)
            ways = [
                [(p["lon"], p["lat"]) for p in e["geometry"]]
                for e in data["elements"]
                if e.get("type") == "way" and e.get("geometry")
            ]
            if ways:
                print(f"  fetched {len(ways)} coastline ways from {mirror}")
                return ways
        except Exception as exc:  # noqa: BLE001 - mirror fallback
            last = exc
            print(f"  {mirror} failed: {exc!r}")
    raise RuntimeError(f"all Overpass mirrors failed: {last!r}")


def stitch(ways):
    def key(pt):
        return (round(pt[0], 6), round(pt[1], 6))

    segs = [list(w) for w in ways]
    used = [False] * len(segs)
    chains = []
    for i in range(len(segs)):
        if used[i]:
            continue
        chain = list(segs[i])
        used[i] = True
        extended = True
        while extended:
            extended = False
            for j in range(len(segs)):
                if used[j]:
                    continue
                s = segs[j]
                if key(chain[-1]) == key(s[0]):
                    chain += s[1:]
                elif key(chain[-1]) == key(s[-1]):
                    chain += s[::-1][1:]
                elif key(chain[0]) == key(s[-1]):
                    chain = s[:-1] + chain
                elif key(chain[0]) == key(s[0]):
                    chain = s[::-1][:-1] + chain
                else:
                    continue
                used[j] = True
                extended = True
        chains.append(chain)
    chains.sort(key=line_len_km, reverse=True)
    return chains[0]


def seaward_shore(chain, lat_min=12.60, lat_max=13.566, step=0.004):
    bins = collections.defaultdict(list)
    for lon, lat in chain:
        if lat_min <= lat <= lat_max:
            bins[round(lat / step)].append((lon, lat))
    # easternmost (max lon) point per latitude bin, ordered south -> north
    return [max(v, key=lambda p: p[0]) for _, v in sorted(bins.items())]


def split_zones(shore):
    zlens = [z["length_km"] for z in ZONES]
    scale = line_len_km(shore) / sum(zlens)
    bounds = [0.0]
    for z in zlens:
        bounds.append(bounds[-1] + z * scale)
    segments = [[] for _ in ZONES]
    segments[0].append(shore[0])
    dist, zi = 0.0, 0
    for i in range(1, len(shore)):
        dist += haversine(shore[i - 1], shore[i]) / 1000.0
        while zi < len(ZONES) - 1 and dist > bounds[zi + 1]:
            zi += 1
            segments[zi].append(shore[i - 1])  # share boundary vertex
        segments[zi].append(shore[i])
    return segments


def round_coords(line, ndigits=5):
    return [[round(lon, ndigits), round(lat, ndigits)] for lon, lat in line]


def nearest_on_shore(shore, lat, lon):
    return min(shore, key=lambda p: haversine(p, (lon, lat)))


def main():
    print("Fetching OSM coastline...")
    ways = fetch_coastline()
    chain = stitch(ways)
    shore = seaward_shore(chain)
    print(f"  seaward shore: {len(shore)} pts, {line_len_km(shore):.1f} km")
    segments = split_zones(shore)

    zone_features = []
    for zmeta, seg in zip(ZONES, segments):
        if len(seg) < 2:
            continue
        is_study = zmeta.get("mean_erosion_m_yr") is not None
        zone_features.append(
            {
                "type": "Feature",
                "properties": {
                    **zmeta,
                    "source": "study-reported" if is_study else "extension",
                    "source_label": STUDY_CITE
                    if is_study
                    else "Neer Vazhvu (beyond study)",
                    "source_url": STUDY_URL,
                    "period": "1990-2024" if is_study else "1990-2026",
                },
                "geometry": {"type": "LineString", "coordinates": round_coords(seg)},
            }
        )

    hotspot_features = []
    for h in HOTSPOTS:
        lon, lat = nearest_on_shore(shore, h["lat"], h["lon"])
        hotspot_features.append(
            {
                "type": "Feature",
                "properties": {
                    "name": h["name"],
                    "zone_id": h["zone_id"],
                    "rate_m_yr": h["rate_m_yr"],
                    "trend": h["trend"],
                    "note": h["note"],
                    "source": "study-reported",
                    "source_label": STUDY_CITE,
                    "source_url": STUDY_URL,
                    "period": "1990-2024",
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(lon, 5), round(lat, 5)],
                },
            }
        )

    os.makedirs(OUT_DIR, exist_ok=True)
    zones_fc = {
        "type": "FeatureCollection",
        "_note": "SEED layer: OSM coastline geometry + study-reported per-zone "
        "rates. Replaced by computed CoastSat+DSAS transects when the "
        "GEE pipeline is run. See docs/research/chennai-coast-paper/.",
        "_source": STUDY_CITE,
        "features": zone_features,
    }
    hotspots_fc = {
        "type": "FeatureCollection",
        "_note": "SEED layer: named shoreline-change hotspots from the study.",
        "_source": STUDY_CITE,
        "features": hotspot_features,
    }
    for name, fc in [
        ("chennai-coastal-zones", zones_fc),
        ("chennai-coastal-hotspots", hotspots_fc),
    ]:
        path = os.path.join(OUT_DIR, f"{name}.geojson")
        write_artifact(Path(path), fc, compact=True)
        print(f"  wrote {path} ({len(fc['features'])} features)")


if __name__ == "__main__":
    main()
