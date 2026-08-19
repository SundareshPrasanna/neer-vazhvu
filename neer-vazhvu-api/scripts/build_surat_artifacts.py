#!/usr/bin/env python3
"""
Build Surat's static artifacts from the acquired source drop.

WHY ONE SCRIPT
Surat's first-pass data arrived as a folder of raw downloads rather than as
live endpoints: India-WRIS groundwater exports for all of Gujarat, the CPCB
NWMP 2022 national PDFs, the SAC wetland atlas for Gujarat, and three
open-data supply releases. Each needs filtering, and three of them need a
correction applied before anything is published. Keeping that in one auditable
script means the corrections are reviewable in one place rather than scattered
across four producers.

THE THREE CORRECTIONS, all load-bearing:

  1. The national open-data supply release carries two columns that are
     constants presented as measurements. `Losses_includingNRW_MLD` is exactly
     20.0000% of total supply on all 48 monthly rows, and the accompanying
     `ActualWaterSupplied_MLD` equals total supply on every row, which
     contradicts the existence of the losses column. The per-sub-ward release
     carries a "domestic consumption" column that is exactly 0.750000 x
     capacity on all 233 rows. NEITHER enters the product. The script asserts
     the ratios still hold so that a future edition which starts publishing
     real measurements trips the assertion instead of being silently dropped.

  2. The India-WRIS export filenames misstate their own coverage: the file
     named 1991_2020 holds Aug-Dec 2020, the one named 2026_2030 holds
     Jan-May 2026. Coverage is derived from the data, never from the name.

  3. The water-bodies drop is mostly the wrong state. Three of its files are
     Himachal Pradesh (2,045 features, 657 pro-glacial lakes); the usable
     Gujarat layer arrived as an interrupted download whose last placemark is
     truncated. The parser takes only complete placemarks.

Run:
  cd neer-vazhvu-api && python3 scripts/build_surat_artifacts.py \
      --drop ~/Downloads/surat_data --root ..
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

# The platform's envelope-preserving writer. A bare write_text replaces the
# NVDM wrapper with a raw payload and silently drops the artifact off the
# conformance ladder, which is exactly what the generator-drift gate exists to
# catch. Root scripts/ is not importable by default from here.
REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from nvdm_write import write_artifact  # noqa: E402

CITY = "surat"
TODAY = date.today().isoformat()

# Surat district, generously drawn: the city plus Olpad/Choryasi and the
# Hazira estuary, because the river and groundwater surfaces legitimately
# reach past the municipal line.
DISTRICT_BOX = {"south": 20.85, "north": 21.60, "west": 72.55, "east": 73.45}
CITY_BOX = {"south": 21.00, "north": 21.35, "west": 72.60, "east": 72.99}


def _iso_date(raw: str) -> str | None:
    """Normalise the several date shapes the WRIS exports ship.

    The Gujarat groundwater exports use dd-mm-yyyy with HYPHENS
    ("01-05-1991 00:00"), which is the same separator ISO uses and the
    opposite field order, so the two are told apart by which group is four
    digits rather than by the separator.
    """
    m = re.match(r"(\d{4})-(\d{1,2})-(\d{1,2})", raw)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    m = re.match(r"(\d{1,2})[-/](\d{1,2})[-/](\d{4})", raw)
    if m:
        return f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"
    return None


def in_box(lat: float, lng: float, box: dict) -> bool:
    return box["south"] <= lat <= box["north"] and box["west"] <= lng <= box["east"]


# NVDM's closed vocabulary for provenance.method. Prose describing HOW a
# specific artifact was built belongs in provenance.note; this field says only
# which acquisition family it came from.
METHODS = {"manual", "scrape", "api", "pdf-extract", "gee", "derived", "mixed"}


def envelope(dataset: str, sources: list[dict], method: str, how: str, **extra) -> dict:
    """The NVDM v1 envelope. New artifacts are born enveloped rather than
    being injected later - the injector pattern exists to migrate legacy
    files, and Surat has none."""
    assert method in METHODS, f"{method!r} is not an NVDM provenance.method"
    prov = {"sources": sources, "method": method, "produced_at": TODAY}
    prov["note"] = how if "note" not in extra else f"{how} {extra.pop('note')}"
    prov.update({k: v for k, v in extra.items() if v is not None})
    return {
        "nvdm": "1.0",
        "dataset": dataset,
        "scope": {"kind": "city", "id": CITY},
        "provenance": prov,
    }


def registry_sources(root: Path, ids: list[str]) -> list[dict]:
    """Read licence and publisher from the Headwaters registry, which owns
    them. Never restate a licence string here."""
    reg = json.loads((root / "scripts/source-registry/surat.json").read_text())
    by_id = {s["id"]: s for s in reg["sources"]}
    out = []
    for sid in ids:
        s = by_id[sid]
        out.append(
            {
                "id": s["id"],
                "title": s["notes"].split(".")[0] if s.get("notes") else s["publisher"],
                "publisher": s["publisher"],
                "license": s["license"],
                "url": s["url"],
            }
        )
    return out


def write(path: Path, payload: dict, compact: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    write_artifact(path, payload, compact=compact)
    print(
        f"  wrote {path.relative_to(path.parents[2])} ({path.stat().st_size:,} bytes)"
    )


# ---------------------------------------------------------------- groundwater


# Sentinels and the plausibility ceiling, matching
# neer-vazhvu-api/scripts/build_cgwb_stations.py. Values that are placeholders
# rather than measurements, and a depth beyond which a reading is a data error.
GW_SENTINELS = {99.0, 999.0, 9999.0, -999.0}
MAX_PLAUSIBLE_DEPTH_M = 120.0


def build_groundwater(drop: Path, root: Path) -> int:
    """India-WRIS Gujarat exports -> Surat point stations, in the CANONICAL shape.

    The output must match what the shared groundwater map reads:
    `readings: [{year, month, depth_m_bgl}]` and `block` on the well. An
    earlier revision of this function invented `{date, level_m}` and the map
    crashed on `depth.toFixed(2)` with depth undefined - the second time on
    this branch that inventing a field name broke a page.

    SIGN CONVENTION IS PER STATION, and the rule here is lifted from
    build_cgwb_stations.py rather than re-derived: WRIS mixes conventions
    inside one district, with manual wells reporting depth below ground as
    POSITIVE and telemetric piezometers as NEGATIVE. A station whose readings
    are overwhelmingly negative (>90%) is flipped; mixed-sign stations are left
    alone and their out-of-range values fall away against the ceiling.

    The CSV drop is used rather than the live API on purpose: it reaches back
    to 1970 where the API window starts at 2010, and the API timed out when
    tried. Same publisher, more history.
    """
    gw = drop / "Groundwater"
    if not gw.is_dir():
        print("  SKIP groundwater: drop folder absent")
        return 0

    raw: dict[str, list] = defaultdict(list)
    meta: dict[str, dict] = {}
    files_meta = []

    for csv_path in sorted(gw.glob("*.csv")):
        kind = "telemetry" if "_tel_" in csv_path.name else "manual-quarterly"
        rows = 0
        dates: list[str] = []
        with csv_path.open(newline="", encoding="utf-8", errors="replace") as fh:
            reader = csv.DictReader(fh)
            value_col = next(
                (c for c in (reader.fieldnames or []) if "Groundwater Level" in c), None
            )
            if not value_col:
                continue
            for row in reader:
                if (row.get("District") or "").strip().upper() != "SURAT":
                    continue
                name = (row.get("Station") or "").strip()
                iso = _iso_date((row.get("Data Acquisition Time") or "").strip())
                if not name or not iso:
                    continue
                try:
                    value = float(row[value_col])
                    lat = float(row["Latitude"])
                    lng = float(row["Longitude"])
                except (TypeError, ValueError, KeyError):
                    continue
                if value in GW_SENTINELS:
                    continue
                raw[name].append((iso, value))
                meta.setdefault(
                    name,
                    {
                        "lat": round(lat, 5),
                        "lng": round(lng, 5),
                        # The WRIS export leaves Block as '-' for every Surat
                        # row, so tehsil is the finest real unit available and
                        # `block` carries it rather than a literal dash.
                        "block": (row.get("Tehsil") or "").strip() or None,
                        "tehsil": (row.get("Tehsil") or "").strip() or None,
                        "district": "Surat",
                        "agency": (row.get("Agency") or "").strip() or None,
                        "acquisition": kind,
                    },
                )
                rows += 1
                dates.append(iso)
        if rows:
            files_meta.append(
                {
                    "file": csv_path.name,
                    "series": kind,
                    "surat_rows": rows,
                    # Derived from the data. The filenames misstate their own
                    # coverage and must never be trusted for this.
                    "actual_coverage": {"from": min(dates), "to": max(dates)},
                }
            )

    if not raw:
        print("  SKIP groundwater: no Surat rows found")
        return 0

    flipped: list[str] = []
    wells = []
    for name, obs in raw.items():
        vals = [v for _, v in obs]
        flip = sum(1 for v in vals if v < 0) > 0.9 * len(vals)
        if flip:
            flipped.append(name)
        monthly: dict[tuple[int, int], list[float]] = defaultdict(list)
        for iso, v in obs:
            depth = -v if flip else v
            if depth < 0 or depth > MAX_PLAUSIBLE_DEPTH_M:
                continue
            y, m = int(iso[:4]), int(iso[5:7])
            monthly[(y, m)].append(depth)
        if not monthly:
            continue
        readings = [
            {
                "year": y,
                "month": m,
                "depth_m_bgl": round(sum(v) / len(v), 2),
                "n_obs": len(v),
            }
            for (y, m), v in sorted(monthly.items())
        ]
        depths = [r["depth_m_bgl"] for r in readings]
        wells.append(
            {
                "name": name,
                "station_code": name,
                **meta[name],
                "sign_convention": "negative-down (flipped)"
                if flip
                else "positive-down",
                "readings": readings,
                "depth_min_m_bgl": round(min(depths), 2),
                "depth_max_m_bgl": round(max(depths), 2),
                "depth_latest_m_bgl": depths[-1],
                "latest_reading": f"{readings[-1]['year']}-{readings[-1]['month']:02d}",
                "raw_observations": len(obs),
            }
        )
    wells.sort(key=lambda w: w["name"])

    total_readings = sum(len(w["readings"]) for w in wells)
    first = min(f["actual_coverage"]["from"] for f in files_meta)
    last = max(f["actual_coverage"]["to"] for f in files_meta)

    payload = {
        **envelope(
            "data-root/cgwb-stations",
            registry_sources(root, ["wris-groundwater-gujarat"]),
            "manual",
            "India-WRIS Gujarat groundwater-level exports filtered to District == SURAT, "
            "grouped by station and averaged per month into the canonical "
            "{year, month, depth_m_bgl} shape. Coverage is derived from the readings, not "
            "from the export filenames, which misstate their own ranges.",
            produced_by="neer-vazhvu-api/scripts/build_surat_artifacts.py",
            note=(
                f"{len(flipped)} of {len(wells)} stations report depth as negative and were "
                "flipped per the rule in build_cgwb_stations.py; the convention is recorded "
                "per well rather than applied globally."
            ),
        ),
        "_note": (
            "Point stations, not an interpolated surface. About 90 stations across the city "
            "and its district cannot support per-zone depth precision, so the groundwater "
            "page renders these as click-through markers and leaves the depth and risk "
            "choropleths off."
        ),
        "district": "Surat",
        "well_type": "Observation wells (manual quarterly and telemetry)",
        "depth_unit": "metres below ground level",
        "source_label": "India-WRIS (National Water Informatics Centre)",
        "source_url": "https://indiawris.gov.in/Dataset/Ground%20Water%20Level",
        "coverage": {
            "from": first,
            "to": last,
            "stations": len(wells),
            "readings": total_readings,
        },
        "_source_files": files_meta,
        "wells": wells,
    }
    write(root / "public/data/surat-cgwb-stations.json", payload)
    print(
        f"    {len(wells)} stations, {total_readings:,} monthly readings, "
        f"{len(flipped)} sign-flipped"
    )
    return len(wells)


# ---- SAC wetland code, decoded ---------------------------------------------
#
# The Gujarat wetland atlas leaves level_iii and l4type empty for every Surat
# feature, but `wetcode` is populated on all of them, and its structure is
# recoverable FROM THE DATA rather than from an external table: across all
# 18,279 Gujarat features the first digit maps one-to-one onto level_i
# (1 = Inland, 2 = Coastal) and the second onto level_ii (1 = Natural,
# 2 = Man-made), with 9999 reserved for unclassified. That mapping was tested
# for ambiguity and is exact - no code appears against two different pairs.
#
# The LEAF digits identify the specific wetland type in SAC's National Wetland
# Inventory scheme. We do NOT decode those here. The published code table was
# not obtained from a primary SAC document during this pass, and a secondary
# summary of it contradicted the data (it gives 1201 as a natural lake, while
# every 1201 feature in this file is flagged man-made). Asserting a leaf type
# on that basis would be exactly the kind of borrowed precision this project
# refuses. The raw code is carried so a reader with the table can decode it,
# and so the day someone verifies the table this becomes a data change rather
# than a re-extraction.
WETCODE_AXES = {"1": "Inland", "2": "Coastal"}
WETCODE_ORIGIN = {"1": "Natural", "2": "Man-made"}


def decode_wetcode(code: str) -> dict:
    """Return the two axes the code provably encodes, and nothing more."""
    if not code or code == "9999" or len(code) < 2:
        return {"setting": None, "origin": None, "classified": False}
    return {
        "setting": WETCODE_AXES.get(code[0]),
        "origin": WETCODE_ORIGIN.get(code[1]),
        "classified": True,
    }


def osm_polygons(path: Path) -> list[dict]:
    """Every OSM water polygon in the Surat box, as ring + tags.

    Used for two things: lending names to atlas polygons, and CONTRIBUTING
    bodies the atlas missed. The SAC atlas is mapped at a national scale with a
    minimum mapping unit, so small urban talavs can fall below it while being
    perfectly well known on the ground - which is exactly the kind of water body
    a city reader cares about.
    """
    if not path.exists():
        return []
    doc = json.loads(path.read_text())
    out = []
    for el in doc.get("elements", []):
        tags = el.get("tags") or {}
        geom = el.get("geometry") or []
        if len(geom) < 4:
            continue
        # Rivers are handled by the rivers layer, not here.
        if tags.get("water") == "river" or tags.get("waterway"):
            continue
        ring = [[round(p["lon"], 6), round(p["lat"], 6)] for p in geom]
        if ring[0] != ring[-1]:
            ring.append(ring[0])
        lons = [c[0] for c in ring]
        lats = [c[1] for c in ring]
        out.append(
            {
                "osm_id": el.get("id"),
                "name": tags.get("name"),
                "kind": tags.get("water") or tags.get("natural") or tags.get("landuse"),
                "ring": ring,
                "lon": sum(lons) / len(lons),
                "lat": sum(lats) / len(lats),
                "bbox": (min(lons), min(lats), max(lons), max(lats)),
            }
        )
    return out


def osm_names(path: Path) -> list[dict]:
    """Named water bodies from OpenStreetMap, as (name, centroid) points.

    OSM is thin here - about a hundred water features in the Surat box and ten
    with names - but those ten are the talavs a resident would actually name,
    and the atlas polygons carry no names at all for them.
    """
    if not path.exists():
        return []
    doc = json.loads(path.read_text())
    out = []
    for el in doc.get("elements", []):
        tags = el.get("tags") or {}
        name = tags.get("name")
        geom = el.get("geometry") or []
        if not name or not geom:
            continue
        lons = [p["lon"] for p in geom]
        lats = [p["lat"] for p in geom]
        out.append(
            {
                "name": name,
                "kind": tags.get("water") or tags.get("natural") or tags.get("landuse"),
                "lon": sum(lons) / len(lons),
                "lat": sum(lats) / len(lats),
            }
        )
    return out


# --------------------------------------------------------------- water bodies


def build_water_bodies(drop: Path, root: Path, osm_path: Path | None = None) -> int:
    """SAC Gujarat wetland atlas -> Surat water bodies.

    The source arrived as an interrupted Chrome download (`.crdownload`) whose
    final placemark is truncated mid-record, so only complete placemarks are
    taken. Three sibling files in the same folder are Himachal Pradesh and are
    ignored entirely.
    """
    wb_dir = drop / "Waterbodies"
    if not wb_dir.is_dir():
        print("  SKIP water bodies: drop folder absent")
        return 0

    kml = None
    for cand in sorted(wb_dir.iterdir()):
        if not cand.is_file() or cand.stat().st_size < 1_000_000:
            continue
        head = cand.open(encoding="utf-8", errors="replace").read(400_000)
        if "<kml" in head and "Gujarat" in head:
            kml = cand
            break
    if kml is None:
        print(
            "  SKIP water bodies: no Gujarat KML in drop (the wb_hp.* files are Himachal Pradesh)"
        )
        return 0

    # A NAMED-BUT-MISSING cache is an error, not an empty list. This ran once
    # with /tmp/surat_osm_wb.json already reaped and rebuilt the layer 17
    # polygons and 10 names smaller, with no warning and an exit code of 0 -
    # the diff was a single line because the GeoJSON is written minified. Fail
    # instead: re-fetch the drop, do not ship a quietly shorter layer.
    if osm_path is not None and not osm_path.is_file():
        raise SystemExit(
            f"  water bodies: OSM cache {osm_path} is missing. It carries the "
            f"OSM-only bodies and the recovered names, so rebuilding without it "
            f"SILENTLY SHRINKS the layer. Re-fetch it, or pass osm_path=None to "
            f"mean the atlas alone on purpose."
        )
    osm = osm_names(osm_path) if osm_path else []
    osm_polys = osm_polygons(osm_path) if osm_path else []
    raw = kml.open(encoding="utf-8", errors="replace").read()
    marks = [m for m in raw.split("<Placemark>")[1:] if "</Placemark>" in m]

    def field(mark: str, key: str) -> str:
        m = re.search(r'name="%s">([^<]*)<' % re.escape(key), mark)
        return m.group(1).strip() if m else ""

    features = []
    for mark in marks:
        try:
            lat = float(field(mark, "lat"))
            lng = float(field(mark, "long"))
        except ValueError:
            continue
        if not in_box(lat, lng, DISTRICT_BOX):
            continue
        coord_m = re.search(r"<coordinates>([^<]+)</coordinates>", mark)
        if not coord_m:
            continue
        ring = []
        for token in coord_m.group(1).split():
            parts = token.split(",")
            if len(parts) >= 2:
                try:
                    ring.append([round(float(parts[0]), 6), round(float(parts[1]), 6)])
                except ValueError:
                    continue
        if len(ring) < 4:
            continue
        try:
            area_ha = round(float(field(mark, "area_ha")), 3)
        except ValueError:
            area_ha = None
        name = field(mark, "wetname")
        wetcode = field(mark, "wetcode")
        axes = decode_wetcode(wetcode)
        # Nearest named OSM water body, if one sits inside this polygon's
        # bounding box. Deliberately conservative: a name is only borrowed when
        # the OSM centroid falls INSIDE the atlas polygon's extent, never by
        # nearest-neighbour, because a wrong name is worse than none.
        osm_name = None
        if osm:
            xs = [c[0] for c in ring]
            ys = [c[1] for c in ring]
            for cand in osm:
                if min(xs) <= cand["lon"] <= max(xs) and min(ys) <= cand["lat"] <= max(
                    ys
                ):
                    osm_name = cand
                    break
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": field(mark, "id") or None,
                    "name": name or (osm_name["name"] if osm_name else None),
                    "name_source": ("atlas" if name else ("osm" if osm_name else None)),
                    "category": field(mark, "level_i") or None,
                    "origin": field(mark, "level_ii") or None,
                    "wetcode": wetcode or None,
                    "setting": axes["setting"],
                    "wetcode_classified": axes["classified"],
                    "osm_kind": osm_name["kind"] if osm_name else None,
                    "area_ha": area_ha,
                    "turbidity": field(mark, "turbidity") or None,
                    "aquatic_vegetation": field(mark, "aqveg") or None,
                    "in_city_limits": in_box(lat, lng, CITY_BOX),
                },
                "geometry": {"type": "Polygon", "coordinates": [ring]},
            }
        )

    # Bodies the atlas missed. An OSM polygon whose centroid falls inside no
    # atlas polygon's extent is a body the national-scale atlas did not map,
    # so it is ADDED rather than discarded. Containment, not proximity: two
    # adjacent tanks must not collapse into one.
    atlas_boxes = [
        (
            min(c[0] for c in f["geometry"]["coordinates"][0]),
            min(c[1] for c in f["geometry"]["coordinates"][0]),
            max(c[0] for c in f["geometry"]["coordinates"][0]),
            max(c[1] for c in f["geometry"]["coordinates"][0]),
        )
        for f in features
    ]
    added = 0
    for poly in osm_polys:
        if not in_box(poly["lat"], poly["lon"], DISTRICT_BOX):
            continue
        inside = any(
            x0 <= poly["lon"] <= x1 and y0 <= poly["lat"] <= y1
            for (x0, y0, x1, y1) in atlas_boxes
        )
        if inside:
            continue
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": f"osm-{poly['osm_id']}",
                    "name": poly["name"],
                    "name_source": "osm" if poly["name"] else None,
                    "category": None,
                    "origin": None,
                    "wetcode": None,
                    "setting": None,
                    "wetcode_classified": False,
                    "osm_kind": poly["kind"],
                    "area_ha": None,
                    "turbidity": None,
                    "aquatic_vegetation": None,
                    "in_city_limits": in_box(poly["lat"], poly["lon"], CITY_BOX),
                    "source": "openstreetmap",
                },
                "geometry": {"type": "Polygon", "coordinates": [poly["ring"]]},
            }
        )
        added += 1

    named = sum(1 for f in features if f["properties"]["name"])
    from_atlas = sum(1 for f in features if f["properties"]["name_source"] == "atlas")
    from_osm = sum(1 for f in features if f["properties"]["name_source"] == "osm")
    classified = sum(1 for f in features if f["properties"]["wetcode_classified"])
    in_city = sum(1 for f in features if f["properties"]["in_city_limits"])

    payload = {
        **envelope(
            "geojson-layers/water-bodies-current",
            registry_sources(
                root, ["sac-wetland-atlas-gujarat", "osm-surat-waterways"]
            ),
            "mixed",
            "SAC National Wetland Atlas hydrological layer for Gujarat, clipped to a "
            "Surat district bounding box; complete placemarks only, because the source "
            "download was interrupted mid-record.",
            produced_by="neer-vazhvu-api/scripts/build_surat_artifacts.py",
            note=(
                f"{len(features)} polygons in the district box, {in_city} inside city "
                f"limits. Names: {from_atlas} from the atlas, {from_osm} recovered from "
                "OpenStreetMap by bounding-box containment (never nearest-neighbour, "
                f"because a wrong name is worse than none), {len(features) - named} still "
                "unnamed. The atlas's level_iii and l4type fields are empty for every "
                f"Surat feature; the wetcode is populated on {classified} and its first "
                "two digits are decoded here into setting and origin, a mapping verified "
                "as exact against level_i/level_ii across all 18,279 Gujarat features. "
                "The leaf digits are NOT decoded: no primary SAC code table was obtained, "
                "and a secondary summary of it contradicted the data."
            ),
        ),
        "type": "FeatureCollection",
        "features": features,
    }
    write(
        root / "public/geojson/surat-water-bodies-current.geojson",
        payload,
        compact=True,
    )
    print(
        f"    {len(features)} polygons ({added} added from OSM beyond the atlas; "
        f"{in_city} in city; {named} named = {from_atlas} atlas + {from_osm} OSM; "
        f"{classified} wetcode-classified)"
    )
    return len(features)


# -------------------------------------------------------------- river quality
#
# SUPERSEDED. River quality was hand-transcribed here from the single 2022
# edition; it is now extracted across every available annual edition by
# neer-vazhvu-api/scripts/extract_cpcb_nwmp_tapi.py, which reads six of them
# (2019-2024) and yields 45 station-years instead of 7. Kept out of this file
# rather than left dead in it.


# --------------------------------------------------------------------- supply


def build_supply(drop: Path, root: Path) -> None:
    """Open-data supply releases -> the supply overview.

    Asserts that the two derived columns are still exactly derived. If a future
    edition starts publishing real measurements the assertion fails loudly
    rather than the columns being silently discarded forever.
    """
    ws = drop / "Watersupply"
    monthly = []
    d53 = ws / "D53. Detailed Water Supply Distribution_0.csv"
    if d53.exists():
        loss_ratios = set()
        actual_equals_total = True
        with d53.open(newline="", encoding="utf-8", errors="replace") as fh:
            for row in csv.DictReader(fh):
                try:
                    total = float(row["TotalWaterSupply_MLD"])
                    loss = float(row["Losses_includingNRW_MLD"])
                    actual = float(row["ActualWaterSupplied_MLD"])
                except (TypeError, ValueError, KeyError):
                    continue
                loss_ratios.add(round(loss / total, 4))
                actual_equals_total &= abs(actual - total) < 1e-9
                monthly.append(
                    {"month": row["Month_Year"], "total_supply_mld": round(total, 2)}
                )
        if loss_ratios and loss_ratios != {0.2}:
            print(
                f"  NOTE: D53 loss ratio is no longer a flat 20% ({sorted(loss_ratios)[:5]}). "
                "Re-review whether it has become a real measurement."
            )
        if not actual_equals_total:
            print("  NOTE: D53 'actual supplied' no longer equals total. Re-review.")

    coverage = []
    d52 = ws / "D52. Coverage of Water Supply Connections_0.csv"
    if d52.exists():
        with d52.open(newline="", encoding="utf-8", errors="replace") as fh:
            for row in csv.DictReader(fh):

                def _i(key):
                    try:
                        return int(float(row[key]))
                    except (TypeError, ValueError, KeyError):
                        return None

                coverage.append(
                    {
                        "year": row["Year"],
                        "properties_total": _i("Total properties in city"),
                        "properties_connected": _i(
                            "Properties served through municpal water connection"
                        ),
                        "properties_unconnected": _i(
                            "Properties without municpal water connection"
                        ),
                    }
                )

    payload = {
        **envelope(
            "data-root/supply-overview",
            registry_sources(
                root, ["ogd-surat-water-supply", "smc-hydraulic-scenario"]
            ),
            "manual",
            "Monthly total supply and property-connection coverage from the Smart Cities "
            "Mission open-data releases for Surat, plus SMC's own infrastructure "
            "description. The releases' derived columns are excluded, not carried.",
            produced_by="neer-vazhvu-api/scripts/build_surat_artifacts.py",
        ),
        "_excluded_columns_note": (
            "Two columns in the source release are NOT published here because they are "
            "constants presented as measurements. 'Losses including NRW' is exactly "
            "20.0000% of total supply on all 48 monthly rows, and the accompanying "
            "'actual supplied' column equals total supply on every row, which "
            "contradicts it. The per-sub-ward release's 'domestic consumption' column is "
            "exactly 0.750000 x capacity on all 233 rows. Surat publishes no measured "
            "non-revenue water and no measured per-ward consumption."
        ),
        # WITHOUT THESE, the shared component falls back to i18n defaults that
        # are Madurai-specific ("Structural numbers from MMC and the ADB Tamil
        # Nadu Urban Flagship Investment Program", "Pannaipatty WTP capacity").
        # Any city that ships a supply overview without overrides inherits
        # Madurai's copy; that default is a cross-city leak worth fixing at the
        # source, and until it is, every city must override.
        "_view_overrides": {
            "subtitle": (
                "Structural numbers from SMC's Hydraulic Department and the Smart Cities "
                "Mission open-data releases. The corporation's own headline figures are "
                "dated 2015; the monthly series runs to December 2021."
            ),
            "wtp_label": "Installed works capacity",
        },
        "_sources": [
            {
                "name": "SMC Hydraulic Department, present scenario",
                "url": "https://www.suratmunicipal.gov.in/Departments/HydraulicPresentScenario",
                "date": "2015",
                "extracted": TODAY,
            },
            {
                "name": "Smart Cities Mission (Surat) water supply releases, data.gov.in",
                "url": "https://www.data.gov.in/resource/water-supply-surat",
                "date": "2018-2021",
                "extracted": TODAY,
            },
        ],
        # The shape UrbanSupplyOverview reads. Surat is a SINGLE-SOURCE city -
        # everything comes off the Tapi at one weir - so the "mix" has one
        # entry and reads 100%. That is the true picture, not a placeholder.
        "supply_chain": [
            "Ukai dam, released by the Gujarat Water Resources Department",
            "River Tapi, ~100 km downstream",
            "Weir-cum-causeway at Singanpor (the city's intake)",
            "Six water works, 1,300 MLD installed (SMC, 2015)",
            "Nine administrative zones",
        ],
        "current_supply_mix_mld": [
            {
                "source": "River Tapi at the Singanpor weir-cum-causeway",
                "scheme": "Run-of-river abstraction from the weir pond, fed by Ukai releases",
                "mld": 1249.81,
                "annual_mcft": None,
                "supplies": "All nine SMC zones",
                "note": (
                    "Surat has one raw-water source. The figure is the last MEASURED "
                    "month in the national open-data series (December 2021), not a "
                    "design capacity and not the corporation's 2015 headline of 980 MLD."
                ),
            }
        ],
        "current_supply_total_mld": 1250,
        "_supply_total_note": (
            "December 2021, the final month of the open-data series, rounded. Two other "
            "figures circulate and neither is used here as the headline: SMC's Hydraulic "
            "page gives 980 MLD gross daily average and 1,300 MLD installed works "
            "capacity, both explicitly for 2015."
        ),
        "wtps_summary": {
            "fresh_water_wtps_count": 6,
            "fresh_water_capacity_mld": 1300,
            "total_installed_capacity_mld": 1300,
            "average_supply_mld": 980,
        },
        "distribution": {
            "_note": (
                "Zone counts come from SMC's own Zones page. Note the vintage conflict "
                "the platform records elsewhere: that page lists nine zones (South split "
                "into A and B) while the live rainfall feed still reports eight."
            ),
            "administrative_zones": 9,
        },
        "infrastructure": {
            "source_river": "Tapi",
            "intake": "Weir-cum-causeway at Singanpor",
            "upstream_control": "Ukai dam, operated by the Gujarat Water Resources Department",
            "gross_daily_supply_mld_2015": 980,
            "installed_works_capacity_mld_2015": 1300,
            "piped_coverage_pct_2015": 95,
            "_vintage_note": (
                "These four figures are SMC's own and are explicitly dated 2015 on the "
                "Hydraulic department page. They describe the system, not today's output. "
                "The monthly series below runs to Dec 2021 and is the current record."
            ),
        },
        "monthly_supply": monthly,
        "connection_coverage": coverage,
        "_coverage_note": (
            "The 2020-21 jump to 157,392 unconnected properties is real signal rather "
            "than a data error: it is the June 2020 city-limit extension arriving, which "
            "took SMC from 326 km2 to 462.149 km2."
        ),
    }
    write(root / "public/data/surat-supply-overview.json", payload)
    print(f"    {len(monthly)} monthly points, {len(coverage)} coverage years")


# ---------------------------------------------------------------- rivers/OSM


OVERPASS = "https://overpass-api.de/api/interpreter"
OVERPASS_QUERY = """
[out:json][timeout:90];
(
  way["waterway"="river"]["name"~"Tapi|Tapti",i](20.95,72.55,21.40,73.10);
  way["waterway"~"river|stream"]["name"~"Khadi|khadi|Mindhola",i](21.00,72.60,21.35,73.00);
);
out geom;
"""


def build_rivers(root: Path, offline: Path | None = None) -> int:
    """OSM -> river geometry for the rivers map.

    OSM rather than SMC's GIS, deliberately: the SMC WMS carries tapi_river and
    creek layers but WFS is disabled there, so its geometry cannot be
    downloaded - only rendered. OSM is the licensed, redistributable option.

    NOTE what is missing. OSM names none of the five khadis that SMC monitors
    against danger levels, so the creeks that matter most for the flood chain
    have no geometry here. They are a named gap, not an oversight.
    """
    import urllib.parse
    import urllib.request

    if offline and offline.exists():
        doc = json.loads(offline.read_text())
    else:
        req = urllib.request.Request(
            OVERPASS,
            data=urllib.parse.urlencode({"data": OVERPASS_QUERY}).encode(),
            headers={"User-Agent": "neer-vazhvu/1.0 (water data platform)"},
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            doc = json.load(resp)

    by_name: dict[str, list] = defaultdict(list)
    for el in doc.get("elements", []):
        geom = el.get("geometry") or []
        if len(geom) < 2:
            continue
        name = (el.get("tags") or {}).get("name") or "Unnamed watercourse"
        by_name[name].append([[round(p["lon"], 6), round(p["lat"], 6)] for p in geom])

    def haversine_km(a, b):
        from math import asin, cos, radians, sin, sqrt

        lon1, lat1, lon2, lat2 = map(radians, (a[0], a[1], b[0], b[1]))
        h = (
            sin((lat2 - lat1) / 2) ** 2
            + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
        )
        return 2 * 6371.0088 * asin(sqrt(h))

    features = []
    for name, lines in sorted(by_name.items()):
        # MAPPED length, not the river's true length. OSM coverage in this box
        # is partial, so this is how much of the watercourse we hold, which is
        # the honest thing for a map legend to report.
        mapped_km = round(
            sum(
                haversine_km(ln[i], ln[i + 1])
                for ln in lines
                for i in range(len(ln) - 1)
            ),
            1,
        )
        features.append(
            {
                "type": "Feature",
                "properties": {
                    # river_id is the join key the rivers page uses to look up
                    # each river's narrative (RIVER_INFO_BY_CITY). Without it
                    # the map renders zero rivers even with geometry present.
                    "river_id": re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-"),
                    "name": name,
                    "waterway": "river",
                    "segments": len(lines),
                    "length_km": mapped_km,
                    "_length_note": "Length of the OSM geometry held here, not the river's full course.",
                },
                "geometry": {"type": "MultiLineString", "coordinates": lines},
            }
        )

    payload = {
        **envelope(
            "geojson-layers/rivers",
            registry_sources(root, ["osm-surat-waterways"]),
            "api",
            "Overpass API query for named river and stream ways in the Surat "
            "bounding box, grouped into one feature per named watercourse.",
            produced_by="neer-vazhvu-api/scripts/build_surat_artifacts.py",
            note=(
                "GAP: OpenStreetMap names none of the five khadis SMC monitors against "
                "published danger levels (Kakara, Bhedwad, Mithi, Bhatena, Simada), so "
                "the creeks central to the flood chain have no geometry in this layer. "
                "SMC's own GIS holds a creek layer but serves WMS only - WFS is "
                "disabled, so its geometry cannot be redistributed."
            ),
        ),
        "type": "FeatureCollection",
        "features": features,
    }
    write(root / "public/geojson/surat-rivers.geojson", payload, compact=True)
    print(f"    {len(features)} named watercourses: {', '.join(sorted(by_name))}")
    return len(features)


# --------------------------------------------------------- facts, commitments


def build_facts(root: Path) -> int:
    """The static fact snapshot.

    Every value here is primary-sourced and dated. Nothing from press coverage,
    nothing derived from the open-data release's two synthetic columns, and
    nothing from the 2006 flood until its figures are replaced from the
    committee reports.
    """
    facts = [
        {
            "id": "surat-treated-wastewater-reused",
            "tier": 1,
            "category": "Reuse",
            "title": "Treated wastewater reused",
            "value": "330",
            "unit": "MLD",
            "interpretation": (
                "SMC reuses 330 MLD of the roughly 1,018 MLD of sewage it collects and "
                "treats, about a third, itemised across eleven named uses from textile "
                "clusters (115 MLD) to lake rejuvenation (2 MLD). This is the number "
                "that makes Surat unusual: most utilities treat sewage as a cost, and "
                "this one runs it as a revenue line."
            ),
            "source_label": "Surat Municipal Corporation, 'Reuse of Treated Used Water: A Successful Model', 8 March 2024",
            "source_url": "https://cdn.cseindia.org/attachments/0.84371800_1709877539_surat-municipal-corporation.pdf",
        },
        {
            "id": "surat-reuse-revenue",
            "tier": 1,
            "category": "Reuse",
            "title": "Cumulative revenue from selling treated water to industry",
            "value": "496.23",
            "unit": "Rs crore to January 2024",
            "interpretation": (
                "Against a capital cost of Rs 314.39 crore for three tertiary treatment "
                "plants. The tariff started at Rs 18.20 per kilolitre in 2014 and is now "
                "Rs 36.2, indexed to RBI. Annual revenue runs about Rs 120 crore. Press "
                "coverage of this programme reports different figures (Rs 340 crore, "
                "Rs 140 crore annually); these are the corporation's own."
            ),
            "source_label": "Surat Municipal Corporation, 'Reuse of Treated Used Water: A Successful Model', 8 March 2024",
            "source_url": "https://cdn.cseindia.org/attachments/0.84371800_1709877539_surat-municipal-corporation.pdf",
        },
        {
            "id": "surat-industrial-buyers",
            "tier": 2,
            "category": "Reuse",
            "title": "Industrial units buying tertiary-treated sewage",
            "value": "249",
            "unit": "units across Pandesara and Sachin",
            "interpretation": (
                "178 units in Pandesara Industrial Estate and 71 in the Sachin Textile "
                "Process Industries association, taking 115 MLD of tertiary-treated "
                "water from three plants (Bamroli 40 and 35 MLD, Dindoli 40 MLD). Surat "
                "is a textile city; these are the dyeing and printing houses that would "
                "otherwise be drawing fresh water."
            ),
            "source_label": "Surat Municipal Corporation, 'Reuse of Treated Used Water: A Successful Model', 8 March 2024",
            "source_url": "https://cdn.cseindia.org/attachments/0.84371800_1709877539_surat-municipal-corporation.pdf",
        },
        {
            "id": "surat-no-measured-nrw",
            "tier": 1,
            "category": "Supply",
            "title": "Measured non-revenue water",
            "value": "Not published",
            "unit": "",
            "interpretation": (
                "The national open-data release for Surat contains a 'losses including "
                "NRW' column, but it is exactly 20.0000% of total supply on all 48 "
                "monthly rows, and the accompanying 'actual supplied' column equals "
                "total supply on every row, which contradicts it. It is an assumption "
                "carried in a measurement column. Surat publishes no measured NRW, and "
                "we will not republish a constant as though it were a meter reading."
            ),
            "source_label": "Smart Cities Mission (Surat) open-data release D53, via data.gov.in",
            "source_url": "https://www.data.gov.in/resource/water-supply-surat",
        },
        {
            "id": "surat-city-growth",
            "tier": 2,
            "category": "Governance",
            "title": "Municipal area, 1961 to today",
            "value": "8 to 462.149",
            "unit": "sq km",
            "interpretation": (
                "SMC's own wardwise table records the city growing from 8 sq km across "
                "12 wards to 462.149 sq km across 134, in six annexations, the most "
                "recent in June 2020. A city that grew fifty-fold onto an estuarine "
                "flood plain in sixty years is the precondition for everything on the "
                "flood page."
            ),
            "source_label": "Surat Municipal Corporation, wardwise area and population (1961-2011 census and after the 2020 extension)",
            "source_url": "https://www.suratmunicipal.gov.in/TheCity/City/Stml2",
        },
        {
            "id": "surat-tapi-salinity",
            "tier": 2,
            "category": "Rivers",
            "title": "Tapi conductivity, Ukai to the sea",
            "value": "513 to 49,720",
            "unit": "umhos/cm (2022 maxima)",
            "interpretation": (
                "The Tapi's problem at Surat is not sewage. CPCB's 2022 monitoring finds "
                "BOD at or below detection limit at most Surat stations, while "
                "conductivity climbs from 369-513 at Ukai to 1,537-49,720 at the ONGC "
                "bridge at Hazira, which is seawater. This is an estuary and a salinity "
                "story, not an organic pollution one."
            ),
            "source_label": "CPCB National Water Quality Monitoring Programme 2022, Table 9 (River Tapi)",
            "source_url": "https://cpcb.gov.in/nwmp-data-2022/",
        },
        {
            "id": "surat-groundwater-record",
            "tier": 3,
            "category": "Groundwater",
            "title": "Groundwater observation record",
            "value": "94 stations, 6,563 readings",
            "unit": "1970 to 2026",
            "interpretation": (
                "A 56-year record across Surat district, from manual quarterly "
                "observations starting in 1970 to six-hourly telemetry in 2026. Deep in "
                "time, thin in space: too few stations to interpolate a per-zone depth "
                "surface honestly, so the groundwater page renders the points "
                "themselves."
            ),
            "source_label": "India-WRIS groundwater level exports, District = Surat",
            "source_url": "https://indiawris.gov.in/Dataset/Ground%20Water%20Level",
        },
    ]

    payload = {
        **envelope(
            "data-root/facts",
            registry_sources(
                root,
                [
                    "smc-reuse-programme",
                    "ogd-surat-water-supply",
                    "cpcb-nwmp",
                    "smc-wardwise-area-population",
                    "wris-groundwater-gujarat",
                ],
            ),
            "manual",
            "Hand-compiled from primary sources, each fact carrying its own citation. "
            "No press figures and no values derived from the open-data release's two "
            "synthetic columns.",
            produced_by="neer-vazhvu-api/scripts/build_surat_artifacts.py",
        ),
        "place_id": CITY,
        "generated_at": TODAY,
        "note": (
            "A static snapshot rather than a live pipeline. Surat's one live feed is the "
            "flood chain, which has its own surface."
        ),
        "facts": facts,
    }
    write(root / "public/data/facts-surat.json", payload)
    print(f"    {len(facts)} facts")
    return len(facts)


def build_commitments(root: Path) -> int:
    """The commitments register, in the shape commitments-client.tsx reads.

    That contract is not optional and it is not guessable: every entry needs a
    `commitment_source` object with label/url/date (the client dereferences
    `.url` unconditionally), a `due`, a `status_history`, and a `status` drawn
    from a CLOSED vocabulary - delivered | on-track | slipped | overdue |
    stalled | unverified. An earlier revision here invented `status: "stated"`
    with `source_label`/`source_url` beside it, and the page threw
    "Cannot read properties of undefined (reading 'url')" the moment a card was
    clicked.

    Every one of these is `unverified`: publicly stated by the corporation with
    a date, and not independently checked by anyone. That is exactly what the
    status means, and it is the honest label for a promise whose progress
    nobody has audited.
    """
    SRC = {
        "label": (
            "Surat Municipal Corporation, 'Reuse of Treated Used Water: A Successful "
            "Model', presented 8 March 2024"
        ),
        "url": (
            "https://cdn.cseindia.org/attachments/0.84371800_1709877539_"
            "surat-municipal-corporation.pdf"
        ),
        "date": "2024-03-08",
    }

    def stated(note: str) -> list[dict]:
        return [
            {
                "date": "2024-03-08",
                "status": "unverified",
                "note": note,
                "source_label": SRC["label"],
                "source_url": SRC["url"],
            }
        ]

    commitments = [
        {
            "id": "surat-reuse-70-by-2030",
            "category": "Wastewater reuse",
            "title": "Reuse 70% of treated wastewater by 2030",
            "committed_by": "Surat Municipal Corporation",
            "what": (
                "SMC states a vision to raise reuse of treated wastewater from the "
                "present level, which it puts at more than 30%, to 70% by 2030. At the "
                "1,018 MLD it currently collects and treats, 70% is roughly 713 MLD "
                "against the 330 MLD reused today."
            ),
            "due": "2030",
            "commitment_source": SRC,
            "status": "unverified",
            "status_history": stated(
                "Target published on the 'Way Forward' slide, against a stated present "
                "level of more than 30% reuse. No independent verification of progress."
            ),
            "next_check": "2027-03-01",
            "revised_due": None,
        },
        {
            "id": "surat-reuse-100-by-2035",
            "category": "Wastewater reuse",
            "title": "Reuse 100% of treated wastewater by 2035, zero liquid discharge",
            "committed_by": "Surat Municipal Corporation",
            "what": (
                "The same document commits to 100% reuse and zero liquid discharge by "
                "2035. SMC names the projects it expects to get there: 340 MLD to "
                "Hazira-based industries from the Bhesan-Asarma-Variav-Kosad plants, and "
                "140 MLD to industries at Kadodara and Palsana from the "
                "Varachha-Valak-Kamrej plant."
            ),
            "due": "2035",
            "commitment_source": SRC,
            "status": "unverified",
            "status_history": stated(
                "Target published on the same slide, with 490 MLD of named projects "
                "listed as the route to it. None of those projects has a separately "
                "published commissioning date."
            ),
            "next_check": "2027-03-01",
            "revised_due": None,
        },
        {
            "id": "surat-sewerage-100-by-2033",
            "category": "Sewerage coverage",
            "title": "Comprehensive sewerage coverage of 100% of area and population by 2033",
            "committed_by": "Surat Municipal Corporation, Drainage Department",
            "what": (
                "The drainage department states a commitment to 100% coverage in terms "
                "of geographical area and population by 2033. Its stated position at the "
                "time was 202 sq km covered, which it put at 99% of the then-habitable "
                "area, and 99.5% of population - but explicitly 'before city limit "
                "extension in June 2020', which took the corporation to 462.149 sq km. "
                "The denominator moved after the percentage was calculated."
            ),
            "due": "2033",
            "commitment_source": SRC,
            "status": "unverified",
            "status_history": stated(
                "Commitment published on the 'Sewerage System' slide. The coverage "
                "percentages beside it are explicitly pre-June-2020 and so predate the "
                "extension that enlarged the area they are a percentage of."
            ),
            "next_check": "2027-03-01",
            "revised_due": None,
        },
    ]

    payload = {
        **envelope(
            "data-root/commitments",
            registry_sources(root, ["smc-reuse-programme"]),
            "manual",
            "Transcribed from the corporation's own dated presentation. Each entry names "
            "the institution, the target date and the slide it came from.",
            produced_by="neer-vazhvu-api/scripts/build_surat_artifacts.py",
        ),
        "place_id": CITY,
        "updated": TODAY,
        "headline": "What Surat has promised about its water, and by when",
        "intro": (
            "Three dated commitments, all from one document and all owned by the "
            "corporation itself. Surat's register is short because its promises are "
            "concentrated: the reuse programme is the thing SMC has publicly bound "
            "itself to, and it has bound itself twice, at 2030 and 2035."
        ),
        "status_legend": {
            "unverified": (
                "Publicly stated by the institution, with a date. Nobody has independently "
                "checked progress against it, and this site has not either."
            ),
        },
        "update_model": (
            "History is kept, never overwritten. A status changes only against a dated "
            "citation."
        ),
        "sources_note": (
            "All three are from Surat Municipal Corporation's own presentation of 8 March "
            "2024, hosted by CSE India. Where press coverage of this programme disagrees "
            "with the corporation about the corporation's figures, the document is used."
        ),
        "commitments": commitments,
    }
    write(root / "public/data/commitments-surat.json", payload)
    print(f"    {len(commitments)} commitments")
    return len(commitments)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--drop", required=True, help="path to the acquired source folder")
    ap.add_argument("--root", default="..", help="repo root")
    args = ap.parse_args()

    drop = Path(args.drop).expanduser()
    root = Path(args.root).resolve()

    print("Surat artifacts")
    print("  groundwater:")
    build_groundwater(drop, root)
    print("  water bodies:")
    build_water_bodies(drop, root, osm_path=Path("/tmp/surat_osm_wb.json"))
    # River quality: see extract_cpcb_nwmp_tapi.py (multi-edition).
    print("  supply:")
    build_supply(drop, root)
    print("  rivers:")
    build_rivers(root, offline=Path("/tmp/surat_osm.json"))
    print("  facts:")
    build_facts(root)
    print("  commitments:")
    build_commitments(root)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
