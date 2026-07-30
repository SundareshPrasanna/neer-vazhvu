#!/usr/bin/env python3
"""
Build the Mumbai coastal-zone SEED layer for the /mumbai/shoreline page.

Unlike Chennai - where a single peer-reviewed study (Anagha, Singh & Frappart
2026) published per-zone erosion RATES to anchor against - Mumbai's public
record is CLASSIFICATION-based: the Maharashtra Shoreline Management Plan 2017
(Maharashtra Maritime Board, ADB SCPMIP) grades named beaches by erosion risk
(major: Dadar, Mahim, Priyadarshini Park, Versova; minor: Girgaum Chowpatty,
Aksa, Gorai), the NCCR National Assessment of Shoreline Changes (Kankara et al. 2018,
1990-2016) puts 43.2% of Mumbai Suburban's 41 km coast in erosion against
Mumbai City's 93.5%-stable armoured front, naming Erangal, Manori and Gorai
as eroding beaches, and Kunte-style
remote-sensing classifications (Frontiers in Marine Science, 2025) grade
Bandra/Manori/Uttan/Versova as medium erosion with most of Greater Mumbai
stable. So the zones here carry those published classifications with
mean_erosion_m_yr = null (source = "assessment-reported"); the RATES come from
our own GEE transect measurement (neer-vazhvu-api/app/gee/coastline.py), the
same pipeline as Chennai's.

No hotspots file is emitted: no public source gives per-spot rates for Mumbai,
and we don't fabricate numbers. The documented episodes (Aksa promenade NGT
demolition, Versova cleanup, Juhu foreshore loss) live in the zone summaries.

Geometry: live OSM coastline, seaward (Arabian Sea) face only - the
westernmost point per latitude bin, which deliberately chords across the
Malad/Manori creek mouths and Back Bay so creek interiors and the harbour
side don't pollute the line. Mumbai is meso-to-macrotidal (~3-5 m spring
range), so shoreline positions carry more tidal noise than Chennai's
microtidal coast - the transect layer flags this via confidence.

Run:  python scripts/build-mumbai-coastal-seed.py
Writes:
  public/geojson/mumbai-coastal-zones.geojson
"""

import collections
import json
import math
import os
import urllib.request
from pathlib import Path

from nvdm_write import write_artifact

BBOX = (18.85, 72.70, 19.50, 73.00)  # south, west, north, east (Colaba -> Arnala)
OVERPASS_MIRRORS = [
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "geojson")

SMP_URL = "https://mahammb.maharashtra.gov.in/site/upload/pdf/MaharashtraSMP2017.pdf"
SOURCE_LABEL = (
    "MSMP 2017 (MMB) + NCCR National Assessment of Shoreline Changes "
    "(Kankara, Ramana Murthy & Rajeevan 2018; 1990-2016 district table)"
)

# Zones split by LATITUDE breakpoints (a north-south coast), Colaba -> Arnala.
# dominant_trend reflects the published classifications, not a measured rate.
ZONES = [
    {
        "zone_id": "I",
        "zone_name": "Colaba - Marine Drive - Malabar Hill",
        "lat_max": 18.955,
        "dominant_trend": "mixed",
        "summary": "The seawalled island-city front: Marine Drive's tetrapod line "
        "(13,000 replaced under the Coastal Road works), Girgaum Chowpatty "
        "(minor erosion risk, MSMP 2017) and Priyadarshini Park - one of the "
        "four spots the state plan grades a MAJOR erosion risk to "
        "infrastructure. The Coastal Road reclaimed 111 ha of this seafront; "
        "no public sediment-transport study accompanies it.",
    },
    {
        "zone_id": "II",
        "zone_name": "Worli - Dadar - Mahim",
        "lat_max": 19.045,
        "dominant_trend": "erosion",
        "summary": "Dadar beach and Mahim are two of the state plan's MAJOR "
        "erosion-risk sites (risk to infrastructure within ~5 years, MSMP "
        "2017). An ADB-funded nourishment/artificial-beach plan announced in "
        "2016 has no delivery record; a 2023 study proposed geotube "
        "protection for ~400 m of the Dadar shore. NOTE: our satellite "
        "measurement reads much of this stretch as ADVANCING - the Coastal "
        "Road's 111-ha reclamation moved the waterline seaward after 2018. A "
        "man-made advance is not beach recovery; the 2017 risk grades "
        "describe the natural beaches behind it.",
    },
    {
        "zone_id": "III",
        "zone_name": "Bandra - Khar - Juhu",
        "lat_max": 19.110,
        "dominant_trend": "mixed",
        "summary": "Bandra is graded medium erosion in remote-sensing "
        "classifications (Frontiers in Marine Science, 2025). Juhu runs a "
        "seasonal erosion-replenishment cycle; ~2,000 sq m of its foreshore "
        "was reported submerged amid reclamation works, per Koliwada "
        "fishers' accounts.",
    },
    {
        "zone_id": "IV",
        "zone_name": "Versova",
        "lat_max": 19.145,
        "dominant_trend": "erosion",
        "summary": "A MAJOR erosion-risk site in the state plan (MSMP 2017) and "
        "medium in the 2025 remote-sensing grading. Better known for the "
        "2015-18 volunteer cleanup (~4,000+ tonnes of debris removed; Olive "
        "Ridley hatchlings returned in 2018 after ~20 years) - though no "
        "measured sand-recovery study exists; the erosion classification "
        "stands.",
    },
    {
        "zone_id": "V",
        "zone_name": "Madh - Aksa",
        "lat_max": 19.218,
        "dominant_trend": "mixed",
        "summary": "Sources disagree here: NCCR (1990-2016) lists Aksa as "
        "naturally ACCRETING while the state plan grades it a minor erosion "
        "risk - and NCCR names Erangal, on the Madh peninsula, as eroding. "
        "Meanwhile the Maritime Board's own Rs 11.8 cr Aksa promenade (2023) "
        "was ordered demolished by the NGT in Sept 2025 as a CRZ violation, "
        "after it obstructed tidal flows and part of it collapsed to the sea "
        "in 2024.",
    },
    {
        "zone_id": "VI",
        "zone_name": "Gorai - Uttan",
        "lat_max": 19.302,
        "dominant_trend": "mixed",
        "summary": "NCCR (1990-2016) names both Gorai and Manori among the "
        "suburb's eroding beaches - the district table puts 43.2% of Mumbai "
        "Suburban's coast in erosion, most of it along this north-western "
        "barrier stretch; the state plan grades Gorai minor risk and the 2025 "
        "remote-sensing classification grades Manori and Uttan medium.",
    },
    {
        "zone_id": "VII",
        "zone_name": "Vasai - Arnala (VVCMC)",
        "lat_max": 19.475,
        "dominant_trend": "mixed",
        "summary": "The metropolitan extension along Vasai-Virar's seaboard, up "
        "to the Arnala spit. Not covered by the Mumbai-focused assessments; "
        "only our own transect measurement covers this stretch.",
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


def seaward_shore(ways, lat_min=18.885, lat_max=19.475, step=0.004):
    """Westernmost (Arabian Sea face) point per latitude bin, south -> north.

    Works directly off ALL fetched ways (no stitching): Mumbai's coastline is
    heavily broken by creeks, harbour and islands, so a single stitched chain
    isn't attainable the way it is on Chennai's straight coast. Binning by
    latitude and keeping the westernmost point extracts the outer face and
    chords across the creek mouths.
    """
    bins = collections.defaultdict(list)
    for way in ways:
        for lon, lat in way:
            if lat_min <= lat <= lat_max:
                bins[round(lat / step)].append((lon, lat))
    return [min(v, key=lambda p: p[0]) for _, v in sorted(bins.items())]


def split_zones_by_lat(shore):
    segments = [[] for _ in ZONES]
    zi = 0
    for pt in shore:
        while zi < len(ZONES) - 1 and pt[1] > ZONES[zi]["lat_max"]:
            zi += 1
            if segments[zi - 1]:
                segments[zi].append(segments[zi - 1][-1])  # share boundary vertex
        segments[zi].append(pt)
    return segments


def round_coords(line, ndigits=5):
    return [[round(lon, ndigits), round(lat, ndigits)] for lon, lat in line]


def main():
    print("Fetching OSM coastline...")
    ways = fetch_coastline()
    shore = seaward_shore(ways)
    print(f"  seaward face: {len(shore)} vertices, ~{line_len_km(shore):.1f} km")

    segments = split_zones_by_lat(shore)
    features = []
    for z, seg in zip(ZONES, segments):
        if len(seg) < 2:
            print(f"  WARN: zone {z['zone_id']} has no shore vertices")
            continue
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": round_coords(seg)},
                "properties": {
                    "zone_id": z["zone_id"],
                    "zone_name": z["zone_name"],
                    "length_km": round(line_len_km(seg), 1),
                    "mean_erosion_m_yr": None,
                    "dominant_trend": z["dominant_trend"],
                    "summary": z["summary"],
                    "source": "assessment-reported",
                    "source_label": SOURCE_LABEL,
                    "source_url": SMP_URL,
                    "period": "1990-2018",  # MSMP 2017 + NCCR 1990-2016 + parl. answers to 2018
                },
            }
        )
        print(f"  zone {z['zone_id']:>3} {z['zone_name']:<34} ~{line_len_km(seg):.1f} km")

    out = {
        "type": "FeatureCollection",
        "name": "mumbai-coastal-zones",
        "_provenance": (
            "Zone geometry: OpenStreetMap coastline (ODbL), seaward face only "
            "(westernmost point per latitude bin; creek mouths and Back Bay are "
            "chorded across). Classifications: MSMP 2017 (MMB) beach risk "
            "grades; NCCR National Assessment (Kankara et al. 2018, 1990-2016 "
            "district table: Mumbai City 41.02 km, 93.5% stable / Mumbai "
            "Suburban 41.15 km, 43.2% eroding; Erangal, Manori, Gorai named "
            "eroding, Aksa accreting); NCSCM 1975-2010 classification "
            "(Bandra/Manori/Uttan/Versova medium). No published per-zone RATES "
            "exist for Mumbai, so mean_erosion_m_yr is null by design - rates "
            "come from our own GEE transect measurement (same MNDWI pipeline "
            "as Chennai, with the caveat that Mumbai's ~3-5 m spring tide "
            "range adds positional noise Chennai's microtidal coast lacks)."
        ),
        "features": features,
    }
    path = os.path.join(OUT_DIR, "mumbai-coastal-zones.geojson")
    # Envelope-preserving write (scripts/nvdm_write.py): keeps the NVDM
    # envelope injected by the migration so a regeneration cannot strip it.
    write_artifact(Path(path), out, compact=True)
    print(f"Wrote {len(features)} zones -> {path}")


if __name__ == "__main__":
    main()
