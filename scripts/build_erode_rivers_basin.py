#!/usr/bin/env python3
"""Assemble the erode-rivers Basin Atlas families: Erode district as the frame,
TN WRD sub-basin catchments clipped to it as the sheds, and the named rivers
and canals that cross it.

Sources (fetched once, cached under .cache/erode-rivers/, gitignored):
  TNGIS admin_master:administrative_boundary_district   boundary (LGD 573)
  TNGIS generic_viewer:sub_basin                        sub-hydrosheds (clipped)
  OpenStreetMap waterway=river|canal (Overpass)         rivers, canals
  TNGIS generic_viewer:reservoir / mines                reservoirs, quarries
  TNGIS generic_viewer:all_water_bodies                 waterbodies-major, waterbodies-minor
  TNGIS generic_viewer:microwatersheds                  watersheds, sub-watersheds, mini-watersheds, micro-watersheds
  TNGIS tnrd:panchayat_boundary                         admin-gp
  NWIC National Water Data Portal (CKAN datastore)      groundwater-wells (CGWB + state telemetry 2026, CGWB manual 2021-2025)
  NWDP, CWC 'Canal Network' + 'Water Resource Project'   canals, command-areas, and the two canals in rivers (needs ogr2ogr once)
  TNPCB real-time water quality dashboard (JSON)         realtime-stations + readings/<station>.json (monthly sensor means)
  NWDP, CWC river discharge + surface water quality      gauging-stations + readings/cwc-<station>.json

Transcribed, with page cites, in this file (PRS_* constants):
  CPCB Polluted River Stretches, October 2025           prs (stretch editions, drawn on the OSM Cauvery course)
  TNPCB Cauvery Action Plan 2019, pp.49-50              prs-drains (the five outfalls, at the plan's coordinates)
  TNPCB NWMP annual data 2024, station 1320             where the 2025 stretch starts
  TNGIS admin_master taluks + generic_viewer:block_boundary  admin-taluk, admin-block, groundwater-taluks
  TNGIS generic_viewer:industry_cad_matched             industries, treatment-plants
  SIPCOT GIS industrial_complex_boundary-Perundurai_*   industrial-estates

Inputs already in the repo:
  public/data/basins/cauvery-tn/{tanks,wq-stations}.geojson  tanks, monitoring-points
  public/data/atlas/tn/erode/groundwater-taluks.json    groundwater-taluks (IN-GRES stage by taluk)
  pipeline-inputs/basins/erode-rivers/tnpcb-type-sectors.json  reviewed TNPCB type code -> sector lookup

Writes public/data/basins/erode-rivers/<family>.geojson and inventory.json
through nvdm_write.write_artifact so envelopes survive a re-run. Run
scripts/nvdm_envelope_erode_rivers.py after the first build to stamp envelopes.

Usage:
  python3 scripts/build_erode_rivers_basin.py          full build (every family)
  python3 scripts/build_erode_rivers_basin.py --live   weekly refresh of the living feeds only: groundwater wells, CWC flow
                                                       and water quality, reservoir levels, TNPCB sensor stations. Touches no
                                                       other family, calls no TNGIS, SIPCOT, Overpass or ogr2ogr, and puts the
                                                       previous files back if a feed comes back thinner than last week.
"""
from __future__ import annotations

import json
import math
import re
import ssl
import subprocess
import sys
import tempfile
import zipfile
import urllib.parse
import urllib.request
from datetime import date, datetime
from pathlib import Path

from shapely.geometry import LineString, MultiLineString, Point, Polygon, mapping, shape
from shapely.ops import linemerge, substring, unary_union

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402

BASIN_ID = "erode-rivers"
BASIN = ROOT / "public/data/basins" / BASIN_ID
CACHE = ROOT / ".cache" / BASIN_ID
TODAY = date.today().isoformat()

TNGIS = "https://tngis.tn.gov.in/tngismaps/ows"
TNGIS_LABEL = "TNGIS open GeoServer (tngis.tn.gov.in), Tamil Nadu e-Governance Agency / Survey & Settlement"
OVERPASS = ("https://overpass.kumi.systems/api/interpreter", "https://overpass-api.de/api/interpreter")
SIPCOT = "https://sipcotgis.tn.gov.in:8086/geoserver/cite/wfs"
SIPCOT_PARKS = ("Perundurai_DTA", "Perundurai_SEZ")
NWDP = "https://nwdp.nwic.gov.in"  # NWIC's National Water Data Portal: the station data India-WRIS serves, and up when WRIS is down
# CWC's national canal and command-area layers on NWDP (shapefile zips, Lambert conformal conic).
CWC_LAYERS = {
    "cwc-canals-erode.geojson": (f"{NWDP}/dataset/dd11dfc1-6723-4603-9426-a03e4c8cf50c/resource/75e4b705-44b3-4b4a-a32f-060eeae7b907/download/canal_network.zip", "Canal_Network.shp"),
    "cwc-command-erode.geojson": (f"{NWDP}/dataset/a4fde712-4a1f-461b-897a-411ebb29a622/resource/19966957-ccfc-4341-ab11-ca72da5953f4/download/command_area.zip", "Command_Area.shp"),
}
CWC_CLIP = ("76.78", "10.97", "77.99", "12.01")  # the district extent plus a margin, lon/lat
CANAL_CLASS = {"Main Canal": "main", "Branch Canal": "main", "Distributary": "distributary", "Minor": "minor", "Sub Minor": "minor"}
# The two canals a reader can select like a river: river_id -> the CWC line that carries it.
CANAL_RIVERS = {"lower-bhavani-project-canal": "Lower Bhavani Main Canal", "kalingarayan-canal": "Kalingarayan Channel"}
# TNPCB's real-time water quality monitoring dashboard: site ids of the three stations inside the district.
TNPCB_RT = "https://tnpcb.gov.in/rtwqmstnpcb"
TNPCB_RT_SITES = (3, 4, 9)  # Kalingarayan canal upstream and downstream of Erode; Noyyal below the Orathupalayam dam
TNPCB_RT_PARAMS = (  # key in the feed, label, unit, criterion, criterion label
    ("bod", "BOD", "mg/L", 3, "BOD of 3 mg/L or less (outdoor bathing criterion)"),
    ("cod", "COD", "mg/L", None, None),
    ("tds", "Total dissolved solids", "mg/L", None, None),
    ("dissolvedoxygen", "Dissolved oxygen", "mg/L", None, None),
    ("ph", "pH", "", None, None),
)
TNPCB_RT_EXPLAINER = "Each point is the month's mean of the station's sensor readings, as TNPCB's dashboard reports it. These are sensor readings, not laboratory results."
SENSOR_FLOOR = {"tds": 1.0, "conductivity": 1.0}  # a monthly mean below this is a dead sensor, not water
# CWC's four gauging stations on the district line (NWDP). The portal's River column prints the basin ("Cauvery")
# for all four, so the river is set here and checked against the mapped rivers.
CWC_STATIONS = {"KODUMUDI": "cauvery", "URACHIKOTTAI": "cauvery", "SAVANDAPUR": "bhavani", "ELUNUTHIMANGALAM": "noyyal"}
CWC_STATION_MAX_KM = 3.0
CWC_DISCHARGE = ("cba07162-d1da-4987-b52e-0c1e2173e287", "fca9df0b-47b1-4f1a-8e59-1b43a8c0ae73", "38543447-b022-4061-b246-d9c00d134639")
CWC_WQ_CHEMICAL = ("dcb05b97-1ad1-47db-9555-c39938e31309", "0d2370a6-3915-49f2-aa73-bc8bc3613499")
CWC_WQ_BIOLOGICAL = ("6a1e2838-95f2-4878-a1fd-325c618c5b40", "b729f83d-044c-43ab-a593-4d82d98b5365")
CWC_WQ_PARAMS = (  # NWDP field, label, unit, criterion, criterion label, (lowest, highest) plausible value
    ("Total Dissolved Solids (mg/L)", "Total dissolved solids", "mg/L", None, None, (1, 50000)),
    ("Chloride (mg/L)", "Chloride", "mg/L", None, None, (0.1, 30000)),
    ("Biochemical Oxygen Demand (mg/L)", "BOD", "mg/L", 3, "BOD of 3 mg/L or less (outdoor bathing criterion)", (0, 500)),
    ("Dissolved oxygen (mg/L)", "Dissolved oxygen", "mg/L", None, None, (0, 25)),
    ("Potential of Hydrogen (pH)", "pH", "", None, None, (2, 12)),
)
# CWC's daily 08:00 reservoir levels sit in the basin-wide "River Water Level CWC Cauvery, Manual Hourly" resources.
# Cross-check that held on 2026-09-17: the TN agriculture department printed Bhavanisagar at 53.29 ft of 105 ft
# (264.65 m with a full reservoir level of 920 ft) against 264.59 m here two days earlier; Mettur agreed within 0.3 m.
CWC_LEVEL_RESOURCES = ("3e9b3cde-9d04-4c58-af03-4d4a43cc661b", "5af1557b-bbd3-4551-990c-6bea414b702e", "37cba82e-f745-4004-80d2-b05cad65b8e4")
RESERVOIR_LEVELS = {"Bhavani": ("BHAVANI SAGAR DAM", "bhavanisagar"), "Mettur": ("METTUR RESERVOIR", "mettur")}  # register name -> (portal station, key)
RESERVOIR_LEVEL_BAND_M = 25
LEVEL_EXPLAINER = "Each point is the month's mean of CWC's daily 08:00 reservoir level, in metres above mean sea level."
CWC_WQ_EXPLAINER = "Each point is the mean of CWC's samples at this station in that year; hover shows how many samples it rests on."
# Rows the portal prints in the wrong unit are left out, never converted. Kodumudi sits below the other three gauges, and
# its flow is normally 0.9 times their sum (median). In five months it runs 18 to 34 times their sum, the cusec-to-cumec
# factor (35.3): September 2019 reads 8,000 to 113,000 "cumec" while Urachikottai upstream read 290 to 1,994.
_KODUMUDI_CUSEC_MONTHS = ("2019-04", "2019-09", "2019-11", "2019-12", "2020-01")
CWC_FLOW_EXCLUDED_MONTHS = {("KODUMUDI", m): "" for m in _KODUMUDI_CUSEC_MONTHS}
CWC_FLOW_EXCLUDED_NOTE = {"KODUMUDI": "April, September, November and December 2019 and January 2020 are left out: the portal prints those months in cusecs (the readings run about 35 times the combined flow of the three gauges upstream)."}
KODUMUDI_UPSTREAM = ("URACHIKOTTAI", "SAVANDAPUR", "ELUNUTHIMANGALAM")
MASS_BALANCE_FACTOR = 8  # a Kodumudi reading this many times the same day's upstream sum is a wrong-unit row
CWC_FLOW_CAP_CUMEC = 15000  # above the largest flood on record for this reach; a single value beyond it is an entry error
FLOW_DURATION_PCTS = (1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99)
NWDP_WELL_SETS = (  # kind, CKAN resource id, cache file, network label
    ("cgwb-telemetry", "3bd0c6d5-dd9b-4c07-9c60-6410c1c6bd56", "nwdp-cgwb-telemetry-2026.json", "CGWB telemetry, six-hourly, 2026"),
    ("state-telemetry", "6857c02f-c77e-4576-b349-3e45aacc1c21", "nwdp-state-telemetry-2026.json", "Tamil Nadu state telemetry, six-hourly, 2026"),
    ("cgwb-manual", "21cfbb8e-ac1b-4837-a463-317c05fb6f1b", "nwdp-cgwb-manual-2021-2025.json", "CGWB manual quarterly, 2021 to 2025"),
)
GWL_ENVELOPE_M = (-5.0, 200.0)  # physical envelope, metres below ground level; readings outside are dropped and counted
GWL_SENTINELS = (0.0, 1.0, -1.0)  # placeholder values in the telemetry feeds
DISTRICT_LGD = "573"
SECTOR_LOOKUP = ROOT / "pipeline-inputs/basins/erode-rivers/tnpcb-type-sectors.json"
CETP_SCHEMES = ROOT / "pipeline-inputs/basins/erode-rivers/cetp-schemes.json"
# TNPCB, CEPI action plan for the Erode industrial cluster (September 2020), Table 1.1 (PDF p.8): the eight reference
# points of the core zone, clockwise from the east. lat DMS, lon DMS, reference as printed.
CEPI_POINTS = (
    ((11, 21, 13.57), (77, 44, 29.68), "East (near SCM Textile Processing Mills, Karungalpalayam)"),
    ((11, 19, 58.87), (77, 44, 50.74), "South East (near Vignesh Process, Vendipalayam)"),
    ((11, 19, 43.01), (77, 44, 40.06), "South (near Railway Gate-II, Vendipalayam)"),
    ((11, 19, 15.71), (77, 43, 43.36), "South West (near Siva Narayana Printing Mills, Kollampalayam)"),
    ((11, 20, 12.28), (77, 40, 27.88), "West (near Villarasampatti Nall Road, Nasiyanoor Road)"),
    ((11, 23, 26.41), (77, 39, 31.07), "North West (near Madhan Dyeing, Chithode)"),
    ((11, 25, 5.32), (77, 40, 46.22), "North (near The Yahood Bleachers, Suriyampalayam)"),
    ((11, 23, 56.20), (77, 41, 38.55), "North East (near Pioneer Processing India)"),
)
CEPI_STATED_KM2 = 45.25
REGISTER_FIELDS = "industry_name,category,classification,industry_type,taluk,village,centroid,user_id"
TNPCB_OFFICE = {"PND": "DEE Perundurai", "EDL": "DEE Erode"}
# The WRD register prints Bhavanisagar as "Bhavani". NRSC's dam point for it (TNGIS
# generic_viewer:tn_reservoirs_point_nrsc, "LOWER BHAWANI") guards the alias.
BHAVANISAGAR_DAM = (77.09595, 11.46365)
# all_water_bodies prints a CLASS in water_body_name far more often than a name, and
# NRSC rows print the basin ("Cauvery") there. Only what is left is a name.
WB_CLASS = {"stream": "Stream", "streem": "Stream", "odai": "Odai", "odaii": "Odai", "oodai": "Odai", "vaikkal": "Vaikkal",
            "kuttai": "Kuttai", "kulam": "Kulam", "tank": "Tank", "eri": "Eri", "anaicut": "Anaicut"}
WB_STREAM_CLASSES = {"Stream", "Odai", "Vaikkal"}
WB_NOT_A_NAME = {"", "none", "no", "cauvery"}
WB_MAJOR_HA = 5.0
WATERSHED_LEVELS = (  # family, source column, level label, heavy (sliced per catchment)
    ("watersheds", "watershed", "watershed", False),
    ("sub-watersheds", "subwatersh", "sub-watershed", False),
    ("mini-watersheds", "mini", "mini-watershed", False),
    ("micro-watersheds", "microwater", "micro-watershed", True),
)
# CPCB editions of the Cauvery stretch (reviewed table: pipeline-inputs/atlas/prs/cpcb-2025.json, Annexures III A and X).
# 2018 ran from Mettur, so it covers the river's whole course on the district line; 2025 starts "at Erode near
# Virapalayam", which is TNPCB station 1320 (NWMP annual data 2024, p.3: 11.335724, 77.7538 - a scanned page, read twice).
PRS_STATION_1320 = (77.7538, 11.335724)
PRS_EDITIONS = (
    (2018, "I", "Mettur to Mayiladuthurai", None),
    (2025, "II", "Erode near Virapalayam to Pichavaram", PRS_STATION_1320),
)
# TNPCB, Action Plan on Rejuvenation of River Cauvery (2019), pp.49-50: outfall name, lat DMS, lon DMS, receiving water, page.
PRS_OUTFALLS = (
    ("Notchipallam Odai", (11, 24, 59.11), (77, 40, 55.60), "River Cauvery", 49),
    ("Sunnambu Odai", (11, 23, 39.26), (77, 42, 7.55), "River Cauvery", 49),
    ("Pitchaikaranpallam Odai", (11, 22, 18.97), (77, 43, 26.45), "River Cauvery", 50),
    ("Perumpallam Odai", (11, 20, 0.52), (77, 45, 13.38), "River Cauvery", 50),
    ("Kona Vaikkal", (11, 19, 58.95), (77, 44, 22.13), "Kalingarayan Canal", 50),
)
PRS_OUTFALL_MAX_KM = 0.5  # a transcribed point further than this from its receiving water is a transcription error
REGISTER_NOTE = "Units TNGIS matched to a land parcel only; the register is a subset of TNPCB's consent register"
UA = {"User-Agent": "neer-vazhvu/basin-build"}

CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE  # tngis chain is incomplete; data is public

# TN WRD sub-basin name -> the key cauvery-tn already uses (scripts/basin-sources/cauvery-tn.json).
SUB_BASIN_KEY = {
    "Upperbhavani": "114", "Lower Bhavani": "120", "Mettur Reservoir To Noyel Confluence": "123",
    "Moyar": "124", "Noyel": "126", "Palar Dodda Halla": "127", "Amaravathi": "113", "Tirumanimuttar": "129",
    "Chinnar": "115", "Dodda Halla": "117",
}
SHED_MIN_KM2 = 5.0  # boundary-mismatch slivers below this are dropped, and listed
BOUNDARY_RIVER_BUFFER_DEG = 0.015  # ~1.6 km: keeps a river that runs along the district line

# OSM spellings folded to one trunk river each; other named waterways are not drawn yet.
RIVER_ALIASES = {
    "cauvery": ("kaveri", "cauvery"),
    "bhavani": ("bhavani",),
    "noyyal": ("noyyal", "noyal"),
    "moyar": ("moyar",),
}
RIVER_NAMES = {"cauvery": "Cauvery", "bhavani": "Bhavani", "noyyal": "Noyyal", "moyar": "Moyar"}
CANAL_NAMES = {"lower-bhavani-project-canal": "Lower Bhavani Project Canal", "kalingarayan-canal": "Kalingarayan Canal"}

inventory: dict = {"basinId": BASIN_ID, "generatedFrom": "build_erode_rivers_basin.py", "generatedOn": TODAY, "families": {}}


# The frame every spatial test rests on is frozen in pipeline-inputs, so a weekly refresh places a well in the same
# catchment as the full build did and never depends on TNGIS being up.
FROZEN = {"district.json": "tngis-district-boundary.json", "sub-basins.json": "tngis-sub-basins.json"}
FROZEN_DIR = ROOT / "pipeline-inputs/basins/erode-rivers"
LIVE_PREFIXES = ("nwdp-", "tnpcb-rt-")  # caches a --live run always re-fetches
LIVE = False


def cached(name: str, fetch) -> dict:
    if name in FROZEN and (FROZEN_DIR / FROZEN[name]).exists():
        return json.loads((FROZEN_DIR / FROZEN[name]).read_text())
    fp = CACHE / name
    if fp.exists() and not (LIVE and name.startswith(LIVE_PREFIXES)):
        return json.loads(fp.read_text())
    raw = fetch()
    CACHE.mkdir(parents=True, exist_ok=True)
    fp.write_text(json.dumps(raw))
    return raw


def wfs(type_name: str, cql: str | None = None, bbox: tuple | None = None) -> dict:
    """WFS 1.0.0: lon,lat axis order, and the only version where bbox filters reliably here."""
    params = {"service": "WFS", "version": "1.0.0", "request": "GetFeature", "typeName": type_name,
              "outputFormat": "application/json", "srsName": "EPSG:4326"}
    if cql:
        params["CQL_FILTER"] = cql
    if bbox:
        params["bbox"] = ",".join(str(v) for v in bbox)
    req = urllib.request.Request(f"{TNGIS}?{urllib.parse.urlencode(params)}", headers=UA)
    with urllib.request.urlopen(req, timeout=240, context=CTX) as r:
        return json.load(r)


def fetch_json(url: str) -> dict:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=240, context=CTX) as r:
        return json.load(r)


def wfs_props(type_name: str, cql: str, fields: str) -> dict:
    """Attribute-only pull: the register's parcel polygons are not needed, its centroid column is."""
    params = {"service": "WFS", "version": "1.1.0", "request": "GetFeature", "typeName": type_name,
              "propertyName": fields, "CQL_FILTER": cql, "outputFormat": "application/json"}
    return fetch_json(f"{TNGIS}?{urllib.parse.urlencode(params)}")


def overpass(query: str) -> dict:
    last = None
    for url in OVERPASS:
        try:
            req = urllib.request.Request(url, data=urllib.parse.urlencode({"data": query}).encode(), headers=UA)
            with urllib.request.urlopen(req, timeout=240) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001 - try the next mirror
            last = e
    raise SystemExit(f"Overpass fetch failed on every mirror: {last}")


def rnd(geom: dict, nd: int = 5) -> dict:
    def r(c):
        if isinstance(c[0], (int, float)):
            return [round(c[0], nd), round(c[1], nd)]
        return [r(x) for x in c]

    return {"type": geom["type"], "coordinates": r(geom["coordinates"])}


def feat(geom: dict, props: dict) -> dict:
    return {"type": "Feature", "properties": {k: v for k, v in props.items() if v not in (None, "", [])}, "geometry": rnd(geom)}


def area_km2(geom) -> float:
    """Equirectangular sq km - fine for a district-scale label."""
    lat = geom.centroid.y
    return geom.area * 111.32 * math.cos(math.radians(lat)) * 110.57


def length_km(geom) -> float:
    lat = geom.centroid.y
    kx, ky = 111.32 * math.cos(math.radians(lat)), 110.57
    lines = geom.geoms if geom.geom_type == "MultiLineString" else [geom]
    return sum(math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * ky) for ln in lines for a, b in zip(ln.coords, ln.coords[1:]))


def emit(family: str, features: list, provenance: str, source_file: str, by_kind: bool = False, sliced: bool = False) -> None:
    path = BASIN / f"{family}.geojson"
    write_artifact(path, {"type": "FeatureCollection", "features": features}, compact=True)
    sources = [{"file": source_file, "kind": None, "count": len(features), "provenance": provenance}]
    if by_kind:  # split-toggle families: the rail reads each toggle's count from its kind row
        kinds = sorted({f["properties"]["kind"] for f in features})
        sources = [{"file": source_file, "kind": k, "count": sum(1 for f in features if f["properties"]["kind"] == k), "provenance": provenance} for k in kinds]
    inventory["families"][family] = {
        "featureCount": len(features),
        "sources": sources,
        "bytes": path.stat().st_size,
        "sliced": sliced,
    }
    if sliced:  # heavy families: the map fetches <family>/<shedId>.geojson once a river is selected
        shard_dir = BASIN / family
        shard_dir.mkdir(exist_ok=True)
        by_shed: dict[str, list] = {}
        for f in features:
            by_shed.setdefault(f["properties"]["shedId"], []).append(f)
        # Overwrite in place: write_artifact keeps a shard's envelope only while the file exists.
        for stale in shard_dir.glob("*.geojson"):
            if stale.stem not in by_shed:
                stale.unlink()
        for shed, feats in by_shed.items():
            write_artifact(shard_dir / f"{shed}.geojson", {"type": "FeatureCollection", "features": feats}, compact=True)
        inventory["families"][family]["shedKeys"] = sorted(by_shed)
    print(f"  {family:16} {len(features):4} features, {path.stat().st_size // 1024} KB" + (f", {len(inventory['families'][family]['shedKeys'])} shards" if sliced else ""))


def build_boundary(write: bool = True):
    raw = cached("district.json", lambda: wfs("admin_master:administrative_boundary_district", f"district_lgd_code='{DISTRICT_LGD}'"))
    if len(raw["features"]) != 1:
        raise SystemExit(f"boundary: expected 1 district, got {len(raw['features'])}")
    district = shape(raw["features"][0]["geometry"]).buffer(0)
    if not write:
        return district
    emit("boundary", [feat(mapping(district.simplify(0.0005)), {"name": "Erode district", "areaKm2": round(area_km2(district), 1)})],
         f"{TNGIS_LABEL}: district boundary, LGD code {DISTRICT_LGD}", "admin_master:administrative_boundary_district")
    return district


def build_sheds(district, write: bool = True) -> dict:
    """Emits sub-hydrosheds; returns shedId -> unsimplified clipped geometry for tagging."""
    bb = district.bounds
    raw = cached("sub-basins.json", lambda: wfs("generic_viewer:sub_basin", bbox=bb))
    feats, dropped, geoms = [], [], {}
    for f in raw["features"]:
        name = re.sub(r"^\d+\.\s*", "", str(f["properties"].get("subbasin", "")).strip())
        part = shape(f["geometry"]).buffer(0).intersection(district)
        km2 = area_km2(part) if not part.is_empty else 0.0
        if km2 < SHED_MIN_KM2:
            if km2 > 0:
                dropped.append((name, round(km2, 2)))
            continue
        key = SUB_BASIN_KEY.get(name)
        if key is None:
            raise SystemExit(f"sub-basin {name!r} has no cauvery-tn key - add it to SUB_BASIN_KEY")
        whole = area_km2(shape(f["geometry"]))
        geoms[f"SB{key}"] = part
        feats.append(feat(mapping(part.simplify(0.0008)), {
            "shedId": f"SB{key}", "name": name, "subBasinKey": key, "wrdBasin": f["properties"].get("basin"),
            "areaKm2": round(km2, 1), "shareOfSubBasinPct": round(100 * km2 / whole, 1),
        }))
    feats.sort(key=lambda x: -x["properties"]["areaKm2"])
    if not write:
        return geoms
    emit("sub-hydrosheds", feats, f"{TNGIS_LABEL}: TN WRD sub-basins, clipped to the district boundary", "generic_viewer:sub_basin")
    covered = sum(x["properties"]["areaKm2"] for x in feats)
    print(f"    district {area_km2(district):.0f} sq km; sheds cover {covered:.0f} sq km; slivers dropped: {dropped}")
    return geoms


def polys_only(geom):
    """The polygon parts of an intersection result (a clip can also return lines and points)."""
    if geom.geom_type in ("Polygon", "MultiPolygon"):
        return geom
    return unary_union([g for g in getattr(geom, "geoms", []) if g.geom_type in ("Polygon", "MultiPolygon")])


def lines_only(geom) -> list:
    """The line parts of an intersection result (a clip can also return points)."""
    if geom.is_empty:
        return []
    if geom.geom_type == "LineString":
        return [geom]
    return [g for g in getattr(geom, "geoms", []) for g in lines_only(g)]


def fold(name: str, aliases: dict) -> str | None:
    n = name.lower()
    for rid, keys in aliases.items():
        if any(k in n for k in keys):
            return rid
    return None


def build_waterways(district) -> None:
    s, w, n, e = district.bounds[1], district.bounds[0], district.bounds[3], district.bounds[2]
    query = f'[out:json][timeout:180];way["waterway"~"^(river|canal)$"]({s},{w},{n},{e});out tags geom;'
    raw = cached("osm-waterways.json", lambda: overpass(query))
    # The Cauvery IS the eastern district line, so a strict clip drops it.
    clip = district.buffer(BOUNDARY_RIVER_BUFFER_DEG)
    groups: dict[tuple, list] = {}
    for el in raw["elements"]:
        tags = el.get("tags", {})
        name = tags.get("name:en") or tags.get("name")
        if not name or len(el.get("geometry", [])) < 2:
            continue
        kind = tags["waterway"]
        rid = fold(name, RIVER_ALIASES) if kind == "river" else None
        if rid is None:
            continue  # only the named trunk rivers come from OSM; canals come from CWC's canal network
        parts = lines_only(LineString([(p["lon"], p["lat"]) for p in el["geometry"]]).intersection(clip))
        if parts:
            groups.setdefault((kind, rid), []).append((parts, el["id"]))
    # Canals ride in the rivers family: a canal is selectable like a river, and with no
    # catchment of its own the map keeps every layer in view when one is picked.
    names = {**RIVER_NAMES, **CANAL_NAMES}
    feats = []
    for rid, cwc_name in CANAL_RIVERS.items():
        lines = [shape(f["geometry"]) for f in cwc_layer("cwc-canals-erode.geojson")["features"] if f["properties"].get("can_name") == cwc_name]
        if len(lines) != 1:
            raise SystemExit(f"canals: expected one CWC line named {cwc_name!r}, found {len(lines)}")
        part = lines[0].intersection(clip)
        merged = MultiLineString(lines_only(part))
        feats.append(feat(mapping(merged), {"river_id": rid, "name": names[rid], "waterway": "canal", "lengthInDistrictKm": round(length_km(merged), 1),
                                            "source": "CWC canal network (National Water Data Portal)"}))
    for (kind, rid), parts in sorted(groups.items()):
        merged = linemerge(MultiLineString([ln for ps, _ in parts for ln in ps]))
        if merged.geom_type == "LineString":
            merged = MultiLineString([merged])
        feats.append(feat(mapping(merged), {
            "river_id": rid, "name": names[rid], "waterway": kind,
            "lengthInDistrictKm": round(length_km(merged), 1), "osmWays": len(parts), "source": "OpenStreetMap",
        }))
    emit("rivers", feats, "Rivers: OpenStreetMap waterway courses (Overpass), clipped to the district plus 1.6 km so boundary rivers stay. The two canals: CWC canal network (National Water Data Portal)", "osm-waterways.json + cwc-canals-erode.geojson")
    for x in feats:
        print(f"    {x['properties']['name']:30} {x['properties']['lengthInDistrictKm']:6} km ({x['properties']['source']})")


class Sheds:
    """Tags a feature with the catchment it sits in, so a river selection scopes it."""

    def __init__(self, geoms: dict):
        self.geoms = geoms

    def for_point(self, pt) -> str:
        for sid, g in self.geoms.items():
            if g.contains(pt):
                return sid
        return min(self.geoms, key=lambda sid: self.geoms[sid].distance(pt))  # boundary-river features

    def for_geom(self, geom) -> str:
        best = max(self.geoms, key=lambda sid: self.geoms[sid].intersection(geom).area)
        return best if self.geoms[best].intersects(geom) else self.for_point(geom.representative_point())


def repo_points(rel: str, clip) -> list:
    """Point features of a repo artifact that fall inside the clip area."""
    fc = json.loads((ROOT / rel).read_text())
    return [f for f in fc["features"] if f.get("geometry") and f["geometry"]["type"] == "Point" and clip.contains(Point(f["geometry"]["coordinates"][:2]))]


def reservoir_level_pack(register_name: str) -> dict | None:
    """Monthly mean level for the two large reservoirs CWC reports; writes the chart pack, returns map properties."""
    if register_name not in RESERVOIR_LEVELS:
        return None
    station, key = RESERVOIR_LEVELS[register_name]
    rows = [r for rid in CWC_LEVEL_RESOURCES for variant in (station.title(), station.title() + " ")
            for r in nwdp_records(rid, {"Station": variant}, cache_tag=f"-{key}-{'sp' if variant.endswith(' ') else 'ns'}")]
    daily = sorted({(datetime.strptime(r["Data Acquisition Time"], "%d-%m-%Y %H:%M"), v) for r in rows
                    for v in [num(next(v for k, v in r.items() if "Water Level" in k))] if v is not None and v > 0})
    if not daily:
        return None
    # Entry errors (0.92 m, 860 m, 3,190 m) and the gauge-zero placeholder sit far from any real level: a reservoir
    # 30 to 40 m deep cannot read more than 25 m from its own median.
    median = sorted(v for _, v in daily)[len(daily) // 2]
    kept = [(t, v) for t, v in daily if abs(v - median) <= RESERVOIR_LEVEL_BAND_M]
    dropped, daily = len(daily) - len(kept), kept
    months: dict[str, list] = {}
    for t, v in daily:
        months.setdefault(t.strftime("%Y-%m"), []).append(v)
    write_pack(f"reservoir-{key}", {
        "schemaVersion": 1,
        "station": {"stationKey": f"reservoir-{key}", "name": f"{'Bhavanisagar' if key == 'bhavanisagar' else 'Mettur'} reservoir level (CWC)", "agency": "CWC", "siteType": "Reservoir level"},
        "source": {"label": "Central Water Commission daily reservoir level, from the National Water Data Portal (NWIC)", "url": NWDP, "fetched": TODAY},
        "period": {"from": daily[0][0].strftime("%Y-%m"), "to": daily[-1][0].strftime("%Y-%m")},
        "series": [{"kind": "gauge-level-monthly", "unit": "m", "verified": True, "label": "Reservoir level (monthly mean)", "explainer": LEVEL_EXPLAINER,
                    "note": f"{dropped} readings the portal prints more than {RESERVOIR_LEVEL_BAND_M} m from the reservoir's usual level (entry errors and gauge-zero placeholders) are left out." if dropped else None,
                    "points": [[m, round(sum(v) / len(v), 2), len(v)] for m, v in sorted(months.items())]}],
    })
    print(f"    {register_name:10} levels {daily[0][0].date()} to {daily[-1][0].date()} ({len(daily)} days); range {min(v for _, v in daily):.2f} to {max(v for _, v in daily):.2f} m")
    return {"stationKey": f"reservoir-{key}", "hasReadings": True, "latestLevel": f"{daily[-1][1]:.2f} m above sea level ({daily[-1][0].strftime('%Y-%m-%d')}, CWC)"}


def build_reservoirs(district, sheds: Sheds) -> None:
    raw = cached("reservoirs.json", lambda: wfs("generic_viewer:reservoir", bbox=district.bounds))
    near = district.buffer(BOUNDARY_RIVER_BUFFER_DEG)
    feats = []
    for f in raw["features"]:
        g = shape(f["geometry"]).buffer(0)
        if not g.intersects(near):
            continue
        pt, p = g.representative_point(), f["properties"]
        name = str(p.get("reservoir_name") or "").strip().title()
        alias = None
        if name == "Bhavani":
            if g.distance(Point(BHAVANISAGAR_DAM)) > 0.02:
                raise SystemExit("reservoirs: the register's 'Bhavani' waterspread is not at the Bhavanisagar dam")
            alias = "Bhavanisagar (Lower Bhavani dam)"
        levels = reservoir_level_pack(name) or {"hasReadings": False}
        feats.append(feat(mapping(pt), {
            "name": name, "alsoKnownAs": alias, "kind": "reservoir", "district": p.get("district_name"), **levels,
            "wrdBasin": p.get("basin_name"), "waterspreadHa": round(area_km2(g) * 100, 1), "shedId": sheds.for_point(pt),
        }))
    emit("reservoirs", feats, f"{TNGIS_LABEL}: TN WRD reservoir register, waterspread polygons shown at a point inside each; waterspread area computed from the polygon", "generic_viewer:reservoir")


def build_from_cauvery_tn(district, sheds: Sheds) -> None:
    """Families the Cauvery (Tamil Nadu) basin already serves, cut to the district."""
    near = district.buffer(BOUNDARY_RIVER_BUFFER_DEG)
    base = "public/data/basins/cauvery-tn"
    for family, src, clip, prov in (
        ("tanks", "tanks.geojson", district, f"{TNGIS_LABEL}: named tanks as centre points (generic_viewer:all_tanks), as ingested for the Cauvery (Tamil Nadu) basin"),
        ("monitoring-points", "wq-stations.geojson", near, "TNPCB stretch-wise monthly water-quality reports, January to December 2023 (the last year published); classes are the worst monthly use-based class of 2023; station points are town centres, as ingested for the Cauvery (Tamil Nadu) basin"),
    ):
        feats = []
        for f in repo_points(f"{base}/{src}", clip):
            props = {k: v for k, v in f["properties"].items() if k != "subBasin"}
            feats.append(feat(f["geometry"], {**props, "shedId": sheds.for_point(Point(f["geometry"]["coordinates"][:2]))}))
        emit(family, feats, prov, f"cauvery-tn/{src}")


# TNGIS generic_viewer:raingauge is NOT used: it places Coonoor and Burliar (The Nilgiris)
# and Bhavanisagar tens of km from where they are, so no rain gauge layer is drawn.


def sector_for(code: str, desc: str, rules: list) -> dict | None:
    for r in rules:
        if r["code"] == code and r.get("descriptionHas", "").lower() in desc.lower():
            return r
    return None


def plant_facts(unit_id: str, sector: str) -> dict:
    """Operating or proposed, with the figures the scheme documents print (reviewed input cetp-schemes.json)."""
    doc = json.loads(CETP_SCHEMES.read_text())
    if sector == "stp":
        return {"kind": "stp"}
    for r in doc["schemes"]:
        if r["registerUnitId"] == unit_id:
            return {"kind": "cetp-proposed", "status": "Proposed. The proposal for central funding was submitted on 13.03.2023 (TN Department of Textiles); the state's June 2026 progress report says funding for the ten schemes is awaited.",
                    "schemeAsPrinted": r["nameAsPrinted"].rstrip(" *"), "proposedCapacityMld": r["capacityMld"], "memberDyeingUnits": r["dyeingUnits"],
                    "totalCostRsCrore": r["totalCostCrore"], "centralShare75RsCrore": r["centralShare75Crore"], "stateOrUnitsShare25RsCrore": r["stateOrSpvShare25Crore"]}
    for r in doc["existingPlants"]:
        if r["registerUnitId"] == unit_id:
            return {"kind": "cetp-operating", "status": f"Operating: consent issued {r['consentIssuedOn']}, renewal valid to {r['renewalValidTo']} (TNPCB list, 2020)",
                    "consentedKld": r["consentedKld"], "memberUnits": r["totalMembers"], "participatingMembers": r["participatingMembers"], "permittedKld": r.get("permittedKld")}
    raise SystemExit(f"treatment plants: register unit {unit_id} is a common treatment plant with no row in {CETP_SCHEMES.name}")


def build_cepi_frame(district, sheds: Sheds) -> None:
    dd = lambda t: t[0] + t[1] / 60 + t[2] / 3600  # noqa: E731
    frame = Polygon([(dd(lon), dd(lat)) for lat, lon, _ in CEPI_POINTS])
    if not frame.is_valid or not district.contains(frame):
        raise SystemExit("cepi: the eight reference points do not make a valid polygon inside the district - check the transcription")
    km2 = round(area_km2(frame), 1)
    emit("cepi-area", [feat(mapping(frame), {
        "name": "Erode CEPI core zone: outer frame", "kind": "cepi-frame",
        "whatThisIs": f"A polygon through the eight boundary reference points the plan prints (Table 1.1). It encloses {km2} sq km; the plan gives the core zone as {CEPI_STATED_KM2} sq km, so the true boundary lies inside this frame. The plan's own map is an image.",
        "cepiScore": "60.33 (Air 34.12, Water 47, Land 52.75), declared by CPCB for 2017-18: a Severely Polluted Area",
        "laterScore": "25.02 on TNPCB's post-monsoon 2019 recalculation (plan, printed p.57)",
        "unitsInThePlan": "849 Red and Orange category units in the CEPI area (plan, printed p.9)",
        "source": "TNPCB, CEPI action plan for the Erode industrial cluster, September 2020 (CPCB website)", "shedId": sheds.for_geom(frame),
    })], "TNPCB, Comprehensive Environmental Pollution Index (CEPI) action plan for the Erode industrial cluster (September 2020), Table 1.1: the eight reference points of the core zone, joined in order", "CEPI_Action Plan_ERODE.pdf")
    print(f"    frame {km2} sq km against the plan's {CEPI_STATED_KM2}")


def build_industries(district, sheds: Sheds) -> None:
    lookup = json.loads(SECTOR_LOOKUP.read_text())
    raw = cached("industry-register.json", lambda: wfs_props("generic_viewer:industry_cad_matched", f"lgd_district_code='{DISTRICT_LGD}'", REGISTER_FIELDS))
    units: dict[str, dict] = {}
    for f in raw["features"]:
        p = f["properties"]
        lat, lon = (float(v) for v in str(p["centroid"]).split(","))
        u = units.setdefault(p["user_id"], {"p": p, "pts": []})
        u["pts"].append((lon, lat))
    industries, plants, outside = [], [], 0
    for uid, u in sorted(units.items()):
        p = u["p"]
        pt = Point(sum(x for x, _ in u["pts"]) / len(u["pts"]), sum(y for _, y in u["pts"]) / len(u["pts"]))
        if not district.buffer(0.005).contains(pt):
            outside += 1
            continue
        m = re.match(r"^(\d{4})\s*/\s*(.*)$", str(p["industry_type"]).strip())
        if not m:
            raise SystemExit(f"register: unreadable industry_type {p['industry_type']!r} for {uid}")
        code, desc = m.group(1), re.sub(r"\s+", " ", m.group(2)).strip()
        idm = re.match(r"^[A-Z](\d{2})([A-Z]{3})\d+$", uid)
        if not idm:
            raise SystemExit(f"register: unit id {uid!r} does not follow the TNPCB pattern")
        category = str(p["category"]).strip().title()
        rule = sector_for(code, desc, lookup["rules"])
        props = {
            "name": str(p["industry_name"]).strip(), "category": f"{category} (TNPCB)", "typeCode": code, "typeDescription": desc,
            "size": p.get("classification"), "taluk": str(p.get("taluk") or "").title(), "village": str(p.get("village") or "").title(),
            "unitId": uid, "registeredYear": f"20{idm.group(1)}", "office": TNPCB_OFFICE.get(idm.group(2), idm.group(2)),
            "parcels": len(u["pts"]), "note": REGISTER_NOTE, "shedId": sheds.for_point(pt),
        }
        if rule and rule.get("treatment"):
            plants.append(feat(mapping(pt), {**props, **plant_facts(uid, rule["sector"]), "sector": lookup["sectors"][rule["sector"]]}))
            continue
        if category == "Red":
            kind = f"red-{rule['sector']}" if rule else "red-other"
        else:
            kind = "orange" if category == "Orange" else "green-white"
        if rule:
            props["sector"] = lookup["sectors"][rule["sector"]]
        industries.append(feat(mapping(pt), {**props, "kind": kind}))
    prov = f"{TNGIS_LABEL}: industry register matched to land parcels (generic_viewer:industry_cad_matched), Erode district; unit ids follow TNPCB's consent-register format, registrations 2015 to 2024; one point per unit at the mean of its parcel centres; sector from the reviewed TNPCB type-code lookup"
    emit("industries", industries, prov, "generic_viewer:industry_cad_matched", by_kind=True)
    emit("treatment-plants", plants, prov, "generic_viewer:industry_cad_matched", by_kind=True)
    print(f"    {len(units)} units in the register; {outside} fall outside the district polygon and are left out")


def build_estates(sheds: Sheds) -> None:
    feats = []
    for park in SIPCOT_PARKS:
        raw = cached(f"sipcot-outline-{park}.json", lambda park=park: fetch_json(
            f"{SIPCOT}?{urllib.parse.urlencode({'service': 'WFS', 'version': '1.0.0', 'request': 'GetFeature', 'typeName': f'cite:industrial_complex_boundary-{park}', 'outputFormat': 'application/json', 'srsName': 'EPSG:4326'})}"))
        for f in raw["features"]:
            g, p = shape(f["geometry"]).buffer(0), f["properties"]
            feats.append(feat(mapping(g.simplify(0.0002)), {
                "name": p.get("ind_cmplx_name"), "kind": "sipcot-estate", "complexNo": p.get("ind_cmplx_no"),
                "areaAcres": round(float(p["ind_cmplx_area_acre"]), 1), "agency": "SIPCOT", "shedId": sheds.for_geom(g),
            }))
    emit("industrial-estates", feats, "SIPCOT GIS (sipcotgis.tn.gov.in): industrial complex outlines, Perundurai DTA and SEZ; area as SIPCOT states it", "cite:industrial_complex_boundary-Perundurai_*")


def build_quarries(district, sheds: Sheds) -> None:
    raw = cached("mines.json", lambda: wfs("generic_viewer:mines", bbox=district.bounds))
    feats = []
    for f in raw["features"]:
        g = shape(f["geometry"]).buffer(0)
        if district.contains(g.representative_point()):
            feats.append(feat(mapping(g), {"name": f["properties"].get("mineral_le"), "kind": "mine-lease", "areaHa": round(area_km2(g) * 100, 2), "shedId": sheds.for_geom(g)}))
    emit("quarries", feats, f"{TNGIS_LABEL}: mines and quarry lease areas", "generic_viewer:mines")


def build_admin(district, sheds: Sheds) -> None:
    taluks = cached("taluks.json", lambda: wfs("admin_master:administrative_boundary_taluk", f"district_lgd_code='{DISTRICT_LGD}'"))
    gw = json.loads((ROOT / "public/data/atlas/tn/erode/groundwater-taluks.json").read_text())
    by_name = {r["locationName"].strip().lower(): r for r in gw["records"]}
    admin, stage = [], []
    for f in taluks["features"]:
        g, name = shape(f["geometry"]).buffer(0), f["properties"]["taluk_name"].strip()
        sid = sheds.for_geom(g)
        admin.append(feat(mapping(g.simplify(0.0008)), {"name": name, "level": "taluk", "parentDistrict": "Erode", "shedId": sid}))
        r = by_name.pop(name.lower(), None)
        if r is None:
            raise SystemExit(f"groundwater: no IN-GRES record for taluk {name!r}")
        stage.append(feat(mapping(g.simplify(0.0008)), {
            "name": f"{name} taluk", "kind": r["category"].replace("_", "-"), "category": r["category"].replace("_", " ").title(),
            "stageOfExtractionPct": round(r["stageOfExtractionPercent"], 1), "annualRechargeHam": round(r["annualRechargeHam"], 1),
            "availableForFutureUseHam": round(r["availabilityForFutureUseHam"], 1), "assessmentYear": gw["assessmentYear"], "shedId": sid,
        }))
    if by_name:
        raise SystemExit(f"groundwater: IN-GRES taluks with no TNGIS polygon: {sorted(by_name)}")
    emit("admin-taluk", admin, f"{TNGIS_LABEL}: taluk boundaries, LGD district {DISTRICT_LGD}", "admin_master:administrative_boundary_taluk")
    emit("groundwater-taluks", stage, f"IN-GRES (CGWB / IIT Hyderabad) dynamic groundwater assessment {gw['assessmentYear']}, stage of extraction by taluk, as served on the Erode district page; taluk polygons from TNGIS", "atlas/tn/erode/groundwater-taluks.json", by_kind=True)

    blocks = cached("blocks.json", lambda: wfs("generic_viewer:block_boundary", f"district_lgd_code='{DISTRICT_LGD}'"))
    feats = []
    for f in blocks["features"]:
        g, p = shape(f["geometry"]).buffer(0), f["properties"]
        feats.append(feat(mapping(g.simplify(0.0008)), {"name": p["block_name"], "level": "block", "lgdBlockCode": p.get("block_lgd_code"), "parentDistrict": "Erode",
                                                        "pagePath": f"/atlas/tn/erode/blocks/{p.get('block_lgd_code')}", "pageLabel": "Open this block's page", "shedId": sheds.for_geom(g)}))
    emit("admin-block", feats, f"{TNGIS_LABEL}: rural development block boundaries", "generic_viewer:block_boundary")


def build_waterbodies(district, sheds: Sheds) -> None:
    raw = cached("water-bodies.json", lambda: wfs("generic_viewer:all_water_bodies", f"lgddcode='{DISTRICT_LGD}'"))
    reservoirs = [(str(f["properties"].get("reservoir_name") or "").strip().title(), shape(f["geometry"]).buffer(0))
                  for f in cached("reservoirs.json", lambda: wfs("generic_viewer:reservoir", bbox=district.bounds))["features"]]
    major, minor, empty = [], [], 0
    for f in raw["features"]:
        g = shape(f["geometry"]).buffer(0) if f.get("geometry") else None
        if g is None or g.is_empty:
            empty += 1
            continue
        p = f["properties"]
        printed = str(p.get("water_body_name") or "").strip().strip("'\"")
        recorded_as = WB_CLASS.get(printed.lower())
        name = None if recorded_as or printed.lower() in WB_NOT_A_NAME else printed
        if name is None:  # the largest waterspreads are unnamed here; the WRD reservoir register names them
            pt = g.representative_point()
            name = next((f"{n} reservoir" for n, rg in reservoirs if rg.contains(pt)), None)
        ha = round(area_km2(g) * 100, 2)
        props = {
            "name": name, "recordedAs": recorded_as, "kind": "stream-parcel" if recorded_as in WB_STREAM_CLASSES else "water-body",
            "areaHa": ha, "sourceDepartment": p.get("source_department"), "ownerDepartment": p.get("owner_department"),
            "panchayatOrTown": str(p.get("panchayat_village") or "").strip() or None, "shedId": sheds.for_geom(g),
        }
        props = {k: v for k, v in props.items() if v not in (None, "None")}
        is_major = props["kind"] == "water-body" and (ha >= WB_MAJOR_HA or name)
        (major if is_major else minor).append(feat(mapping(g.simplify(0.00005)), props))
    prov = f"{TNGIS_LABEL}: all water bodies register (generic_viewer:all_water_bodies), Erode district; area computed from the polygon; a name is kept only where the register prints one rather than a class (Kuttai, Kulam, Odai, Stream) or the basin"
    emit("waterbodies-major", major, prov, "generic_viewer:all_water_bodies")
    emit("waterbodies-minor", minor, prov, "generic_viewer:all_water_bodies", sliced=True)
    print(f"    {len(raw['features'])} register rows; {empty} with no geometry left out; named {sum(1 for x in major + minor if x['properties'].get('name'))}")


def build_watersheds(district, sheds: Sheds) -> None:
    raw = cached("microwatersheds.json", lambda: wfs("generic_viewer:microwatersheds", bbox=district.bounds))
    micro = [(f["properties"], shape(f["geometry"]).buffer(0)) for f in raw["features"]]
    micro = [(p, g) for p, g in micro if g.intersects(district)]
    for family, col, level, heavy in WATERSHED_LEVELS:
        groups: dict[str, list] = {}
        for p, g in micro:
            groups.setdefault(str(p[col]).strip(), []).append((p, g))
        feats = []
        for code, members in sorted(groups.items()):
            part = polys_only(unary_union([g for _, g in members]).intersection(district))
            if part.is_empty or area_km2(part) < 0.05:
                continue
            p0 = members[0][0]
            feats.append(feat(mapping(part.simplify(0.0004)), {
                "name": code, "level": level, "watershedCode": str(p0["watershed"]).strip(), "subCatchmentCode": str(p0["subcatchme"]).strip(),
                "areaKm2InDistrict": round(area_km2(part), 1), "shedId": sheds.for_geom(part),
            }))
        emit(family, feats, f"{TNGIS_LABEL}: micro-watershed atlas (generic_viewer:microwatersheds), dissolved on its '{col}' code column and cut to the district", "generic_viewer:microwatersheds", sliced=heavy)


def atlas_panchayat_facts() -> dict:
    """What the district Atlas already serves per panchayat: the tap-connection headline and Census 2011 totals."""
    base, facts = ROOT / "public/data/atlas/tn/erode", {}
    for fp in sorted((base / "briefs").glob("*.json")):
        for b in json.loads(fp.read_text())["briefs"]:
            tap = next((h for h in b.get("headlineFacts", []) if h.get("label") == "Households with a tap connection"), None)
            if tap:
                facts.setdefault(str(b["placeId"]), {})["householdsWithTapConnection"] = f"{tap['value']} ({str(tap.get('note') or '').rstrip('.')}; Jal Jeevan Mission)"
    for fp in sorted((base / "census-2011").glob("*.json")):
        for r in json.loads(fp.read_text())["records"]:
            m = r.get("measures") or {}
            if m.get("totalPopulation"):
                facts.setdefault(str(r["lgdGramPanchayatCode"]), {}).update({"populationCensus2011": m["totalPopulation"], "householdsCensus2011": m.get("totalHouseholds")})
    return facts


def build_panchayats(district, sheds: Sheds) -> None:
    raw = cached("panchayats.json", lambda: wfs("tnrd:panchayat_boundary", "district_name='Erode'"))
    facts, feats = atlas_panchayat_facts(), []
    for f in raw["features"]:
        g, p = shape(f["geometry"]).buffer(0), f["properties"]
        code = str(p.get("village_lgd_code"))
        feats.append(feat(mapping(g.simplify(0.0003)), {
            "name": str(p["village_name"]).strip(), "level": "village panchayat", "parentBlock": p.get("block_name"), "parentDistrict": "Erode",
            "lgdGramPanchayatCode": code, **facts.get(code, {}),
            "pagePath": f"/atlas/tn/erode/panchayats/{code}", "pageLabel": "Open this panchayat's water page",
            "shedId": sheds.for_geom(g),
        }))
    print(f"    {sum(1 for x in feats if 'householdsWithTapConnection' in x['properties'])} of {len(feats)} carry the tap-connection figure; {sum(1 for x in feats if 'populationCensus2011' in x['properties'])} carry Census 2011 totals")
    emit("admin-gp", feats, f"{TNGIS_LABEL}: village panchayat boundaries (tnrd:panchayat_boundary). Town panchayats, municipalities, the corporation and reserve forest are not village panchayats and are not in this layer", "tnrd:panchayat_boundary", sliced=True)


def nwdp_rows(resource_id: str, cache_name: str) -> list:
    """Erode-tagged rows of one NWDP (CKAN) groundwater-level resource, cached. The portal carries the same
    station data India-WRIS serves; datastore_search pages at 5,000 rows and needs no key."""
    def fetch() -> dict:
        rows, offset, value_field = [], 0, None
        while True:
            q = urllib.parse.urlencode({"resource_id": resource_id, "filters": json.dumps({"District": "Erode"}), "limit": 5000, "offset": offset})
            res = fetch_json(f"{NWDP}/api/3/action/datastore_search?{q}")["result"]
            value_field = value_field or next(f["id"] for f in reversed(res["fields"]) if "Level" in f["id"])
            for r in res["records"]:
                rows.append({"station": r["Station"], "agency": r["Agency"], "tehsil": r.get("Tehsil"), "lat": r["Latitude"], "lon": r["Longitude"],
                             "time": r["Data Acquisition Time"], "value": r[value_field]})
            offset += 5000
            if len(res["records"]) < 5000:
                return {"resource_id": resource_id, "valueField": value_field, "rows": rows}
    return cached(cache_name, fetch)["rows"]


def build_groundwater_wells(district, sheds: Sheds) -> None:
    feats, dropped, outside = [], 0, 0
    for kind, resource_id, cache_name, label in NWDP_WELL_SETS:
        by_station: dict[tuple, list] = {}
        for r in nwdp_rows(resource_id, cache_name):
            by_station.setdefault((r["station"], r["lat"], r["lon"]), []).append(r)
        for (name, lat, lon), rs in sorted(by_station.items()):
            pt = Point(float(lon), float(lat))
            if not district.contains(pt):  # the portal's district tag follows older district lines: place by coordinates
                outside += 1
                continue
            readings = []
            for r in rs:
                try:
                    v, t = float(r["value"]), datetime.strptime(r["time"], "%d-%m-%Y %H:%M")
                except (TypeError, ValueError):
                    continue
                if v not in GWL_SENTINELS:
                    readings.append((t, v))
            if not readings:
                continue
            vals = sorted(v for _, v in readings)
            sign = -1.0 if vals[len(vals) // 2] < 0 else 1.0  # per-station convention from its own median; never abs()
            ok = sorted((t, sign * v) for t, v in readings if GWL_ENVELOPE_M[0] <= sign * v <= GWL_ENVELOPE_M[1])
            if ok and sorted(d for _, d in ok)[len(ok) // 2] > 2:  # a reading above ground in a well that sits metres deep is a sign-flipped record, not artesian flow
                ok = [(t, d) for t, d in ok if d >= 0]
            dropped += len(rs) - len(ok)
            if not ok:
                continue
            depths = [d for _, d in ok]
            feats.append(feat(mapping(pt), {
                "name": name.replace("_", " ").strip(), "kind": kind, "network": label, "agency": rs[0]["agency"],
                "tehsil": (rs[0].get("tehsil") or "").strip("- ").title() or None,
                "latestDepthMbgl": round(ok[-1][1], 2), "latestReading": ok[-1][0].strftime("%Y-%m-%d"),
                "shallowestMbgl": round(min(depths), 2), "deepestMbgl": round(max(depths), 2),
                "firstReading": ok[0][0].strftime("%Y-%m-%d"), "readingsCount": len(ok), "shedId": sheds.for_point(pt),
            }))
    emit("groundwater-wells", feats, "National Water Data Portal (NWIC, nwdp.nwic.gov.in): groundwater level datasets for Tamil Nadu, Erode-tagged stations placed by their coordinates; depth in metres below ground level, sign convention read per station from its own median, sentinel values and readings outside the physical envelope dropped", "nwdp.nwic.gov.in datastore", by_kind=True)
    print(f"    {outside} Erode-tagged stations fall outside the district polygon and are left out; {dropped} readings dropped as sentinel, sign-flipped or outside {GWL_ENVELOPE_M}")


def build_prs(sheds: Sheds) -> None:
    rivers = {f["properties"]["river_id"]: shape(f["geometry"]) for f in json.loads((BASIN / "rivers.geojson").read_text())["features"]}
    canal = rivers["kalingarayan-canal"]
    # Both editions start at or below Mettur: the mapped course upstream of the Mettur reservoir is not part of either.
    mettur = next(shape(f["geometry"]).buffer(0) for f in cached("reservoirs.json", lambda: None)["features"]
                  if str(f["properties"].get("reservoir_name") or "").strip().title() == "Mettur")
    below = [g for g in rivers["cauvery"].geoms if max(c[1] for c in g.coords) < mettur.bounds[3] and g.centroid.y < mettur.centroid.y]
    dropped_km = round(length_km(rivers["cauvery"]) - sum(length_km(g) for g in below), 1)
    cauvery = MultiLineString(below)
    print(f"    {dropped_km} km of mapped course upstream of the Mettur reservoir left out of the stretch")
    feats = []
    for year, priority, wording, start in PRS_EDITIONS:
        reach = cauvery
        if start:
            pt = Point(start)
            if pt.distance(cauvery) * 110 > PRS_OUTFALL_MAX_KM:
                raise SystemExit("prs: the stretch start point is not on the mapped Cauvery")
            geoms = list(cauvery.geoms)
            nearest = min(range(len(geoms)), key=lambda i: geoms[i].distance(pt))
            parts = []
            for i, g in enumerate(geoms):
                if i == nearest:
                    d = g.project(pt)
                    a, b = substring(g, 0, d), substring(g, d, g.length)
                    parts.append(a if a.centroid.y < b.centroid.y else b)  # the river runs north to south here
                elif g.centroid.y < pt.y:
                    parts.append(g)
            reach = MultiLineString(parts)
        km = round(length_km(reach), 1)
        feats.append(feat(mapping(reach), {
            "kind": "prs", "year": year, "priority": priority, "length_km": km, "river": "Cauvery",
            "label": f"Polluted stretch {year}, inside the district ({km} km, Priority {priority})",
            "cpcbWording": wording, "source": "CPCB stretch wording, drawn on the OpenStreetMap course of the Cauvery inside the district; the stretch continues downstream of it",
            "shedId": "SB123",
        }))
        print(f"    {year}: {km} km inside the district, Priority {priority}")
    emit("prs", feats, "CPCB, Polluted River Stretches for Restoration of Water Quality, October 2025 (Annexures III A and X), drawn on the OpenStreetMap course of the Cauvery inside the district; the 2025 stretch starts at TNPCB station 1320 (Vairapalayam)", "cpcb-2025 + osm-waterways.json")

    drains = []
    for name, lat, lon, water, page in PRS_OUTFALLS:
        pt = Point(lon[0] + lon[1] / 60 + lon[2] / 3600, lat[0] + lat[1] / 60 + lat[2] / 3600)
        km = pt.distance(canal if water == "Kalingarayan Canal" else cauvery) * 110
        if km > PRS_OUTFALL_MAX_KM:
            raise SystemExit(f"prs-drains: {name} plots {km:.2f} km from the {water} - check the transcription")
        drains.append(feat(mapping(pt), {
            "name": name, "kind": "drain-inlet", "receivingWater": water,
            "description": f"Outfall named in TNPCB's 2019 Cauvery action plan as carrying untreated sewage from Erode Corporation wards into the {water}; position is the plan's own GPS coordinate (p.{page}). The plan gives no flow or BOD for it.",
            "shedId": sheds.for_point(pt),
        }))
    emit("prs-drains", drains, "TNPCB, Action Plan on Rejuvenation of River Cauvery, Mettur to Mayiladuthurai stretch (2019), pp.49-50: outfall names and GPS coordinates as printed", "PrsCauvery24919.pdf")


def cwc_layer(cache_name: str) -> dict:
    """One of CWC's national layers, cut to the district extent and reprojected to WGS84 (cached)."""
    fp = CACHE / cache_name
    if not fp.exists():
        url, shp = CWC_LAYERS[cache_name]
        CACHE.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory() as tmp:
            zp = Path(tmp) / "layer.zip"
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600, context=CTX) as r:
                zp.write_bytes(r.read())
            zipfile.ZipFile(zp).extractall(tmp)
            src = next(Path(tmp).rglob(shp))
            try:
                subprocess.run(["ogr2ogr", "-f", "GeoJSON", "-t_srs", "EPSG:4326", "-spat", *CWC_CLIP, "-spat_srs", "EPSG:4326",
                                "-lco", "COORDINATE_PRECISION=5", str(fp), str(src)], check=True)
            except FileNotFoundError:
                raise SystemExit("canals: ogr2ogr (GDAL) is needed once, to reproject CWC's shapefile") from None
    return json.loads(fp.read_text())


def shed_for_line(sheds: Sheds, geom) -> str:
    return max(sheds.geoms, key=lambda sid: sheds.geoms[sid].intersection(geom).length)


def build_canals(district, sheds: Sheds) -> None:
    feats, dropped = [], 0
    for f in cwc_layer("cwc-canals-erode.geojson")["features"]:
        p = f["properties"]
        # CWC files three unnamed "Main Canal" lines under the Kalingarayan system that lie 20 km east of it,
        # beyond the district; the named Kalingarayan Channel is the canal.
        if p["prj_name"] == "Kalingarayan Anicut System" and p["can_type"] == "Main Canal" and not p.get("can_name"):
            dropped += 1
            continue
        parts = lines_only(shape(f["geometry"]).intersection(district))
        if not parts or p["can_type"] not in CANAL_CLASS:
            continue
        g = MultiLineString(parts)
        km = length_km(g)
        if km < 0.05:
            continue
        feats.append(feat(mapping(g), {
            "name": p.get("can_name") or f"{p['prj_name']}: {p['can_type'].lower()}", "kind": CANAL_CLASS[p["can_type"]], "canalType": p["can_type"],
            "project": p["prj_name"], "lengthInDistrictKm": round(km, 1), "shedId": shed_for_line(sheds, g),
        }))
    emit("canals", feats, "CWC canal network (National Water Data Portal, 2025), cut to the district; three unnamed lines filed under the Kalingarayan system but lying east of the district are left out", "canal_network.zip", by_kind=True)
    by_project: dict[str, float] = {}
    for x in feats:
        by_project[x["properties"]["project"]] = by_project.get(x["properties"]["project"], 0) + x["properties"]["lengthInDistrictKm"]
    print("    " + "; ".join(f"{k} {v:.0f} km" for k, v in sorted(by_project.items())) + f"; {dropped} mis-filed lines left out")

    areas = []
    for f in cwc_layer("cwc-command-erode.geojson")["features"]:
        p, whole = f["properties"], shape(f["geometry"]).buffer(0)
        part = polys_only(whole.intersection(district))
        if part.is_empty or area_km2(part) < 1:
            continue
        areas.append(feat(mapping(part.simplify(0.0003)), {
            "name": f"{p['prj_name']} command area", "kind": re.sub(r"[^a-z]+", "-", p["prj_name"].lower()).strip("-"), "project": p["prj_name"], "river": p.get("river"),
            "projectType": p.get("type"), "status": p.get("status"), "yearApproved": (str(p.get("org_yr_ap") or "").split() or [None])[0],
            "districtsBenefited": p.get("dist_benf"), "culturableCommandAreaThousandHa": p.get("cca"), "potentialCreatedThousandHa": p.get("pot_crted"),
            "mappedAreaHa": round(area_km2(whole) * 100), "mappedAreaInDistrictHa": round(area_km2(part) * 100), "shedId": sheds.for_geom(part),
        }))
    emit("command-areas", areas, "CWC 'Water Resource Project' command areas (National Water Data Portal, 2025), cut to the district; culturable command area and potential created are CWC's figures in thousand hectares, mapped areas are computed from the polygons", "command_area.zip", by_kind=True)
    for x in areas:
        q = x["properties"]
        print(f"    {q['project']:28} {q['mappedAreaInDistrictHa']:7} ha mapped in the district; CCA {q['culturableCommandAreaThousandHa']} th ha")


def write_pack(station_key: str, pack: dict) -> None:
    (BASIN / "readings").mkdir(exist_ok=True)
    write_artifact(BASIN / "readings" / f"{station_key}.json", pack, compact=True)


def build_realtime_stations(sheds: Sheds) -> None:
    feats = []
    for site in TNPCB_RT_SITES:
        q = urllib.parse.urlencode({"site_id": site, "mean": "MO", "start_date": "2024-01-01 00:00", "end_date": f"{TODAY} 00:00"})
        d = cached(f"tnpcb-rt-site-{site}.json", lambda q=q: fetch_json(f"{TNPCB_RT}/api/readings/graph/?{q}"))
        rows = [r for r in d["data"] if r.get("row_type") == "data"]
        key, series, dropped = d["station_code"].lower(), [], 0
        for param, label, unit, criterion, crit_label in TNPCB_RT_PARAMS:
            pts = []
            for r in rows:
                v = r.get(param)
                if not isinstance(v, (int, float)):
                    continue
                if v < SENSOR_FLOOR.get(param, float("-inf")):
                    dropped += 1
                    continue
                pts.append([r["period_raw"][:7], round(float(v), 2)])
            if pts:
                part = " The latest month is a part-month." if pts[-1][0] == TODAY[:7] else ""
                series.append({"kind": "wq-param-series", "unit": unit, "verified": True, "label": f"{label} (monthly mean, sensor)", "param": label, "note": part.strip() or None,
                               **({"criterion": criterion, "criterionLabel": crit_label} if criterion else {}),
                               "explainer": TNPCB_RT_EXPLAINER, "points": pts})
        months = sorted({p[0] for s_ in series for p in s_["points"]})
        write_pack(key, {
            "schemaVersion": 1,
            "station": {"stationKey": key, "name": d["site_name"], "agency": "TNPCB", "siteType": "Real-time sensor station", "river": d["river_name"]},
            "source": {"label": "TNPCB real-time water quality monitoring dashboard, monthly means", "url": TNPCB_RT, "fetched": TODAY},
            "period": {"from": months[0], "to": months[-1]},
            "series": series,
        })
        pt = Point(float(d["longitude"]), float(d["latitude"]))
        latest = {s_["param"]: s_["points"][-1] for s_ in series}
        feats.append(feat(mapping(pt), {
            "name": d["site_name"], "kind": "realtime-station", "stationKey": key, "hasReadings": True, "stationCode": d["station_code"], "river": d["river_name"],
            "agency": "TNPCB", "location": d.get("location_name"), "monthsWithReadings": f"{months[0]} to {months[-1]}",
            "latestMonthlyMeanBod": f"{latest['BOD'][1]} mg/L ({latest['BOD'][0]})" if "BOD" in latest else None,
            "latestMonthlyMeanTds": f"{latest['Total dissolved solids'][1]} mg/L ({latest['Total dissolved solids'][0]})" if "Total dissolved solids" in latest else None,
            "note": "Sensor readings as TNPCB's dashboard publishes them; not laboratory results.", "dataUrl": TNPCB_RT, "shedId": sheds.for_point(pt),
        }))
        print(f"    {d['station_code']:14} {months[0]} to {months[-1]}, {len(series)} series; {dropped} dead-sensor values dropped")
    emit("realtime-stations", feats, "TNPCB real-time water quality monitoring dashboard (tnpcb.gov.in/rtwqmstnpcb): station positions and monthly means of the sensor readings; values a dead sensor reports (dissolved solids below 1 mg/L) are dropped", "rtwqmstnpcb api/readings/graph")


def nwdp_records(resource_id: str, filters: dict, cache_tag: str = "") -> list:
    """Every row of one NWDP resource matching the filters, cached, meta columns dropped.
    cache_tag keeps two filters on the same resource apart."""
    def fetch() -> dict:
        rows, offset = [], 0
        while True:
            q = urllib.parse.urlencode({"resource_id": resource_id, "filters": json.dumps(filters), "limit": 5000, "offset": offset})
            res = fetch_json(f"{NWDP}/api/3/action/datastore_search?{q}")["result"]
            fields = [f["id"] for f in res["fields"]]
            values = fields[fields.index("Data Acquisition Time"):]
            rows += [{"Station": r["Station"].strip().upper(), "Latitude": r["Latitude"], "Longitude": r["Longitude"], **{k: r[k] for k in values}} for r in res["records"]]
            offset += 5000
            if len(res["records"]) < 5000:
                return {"resource_id": resource_id, "rows": rows}
    return cached(f"nwdp-{resource_id[:8]}{cache_tag}.json", fetch)["rows"]


def num(v) -> float | None:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def build_gauging_stations(sheds: Sheds) -> None:
    rivers = {f["properties"]["river_id"]: shape(f["geometry"]) for f in json.loads((BASIN / "rivers.geojson").read_text())["features"]}
    erode = {"District": "Erode"}
    flow = [r for rid in CWC_DISCHARGE for r in nwdp_records(rid, erode)]
    chem = [r for rid in CWC_WQ_CHEMICAL for r in nwdp_records(rid, erode)]
    bio = [r for rid in CWC_WQ_BIOLOGICAL for r in nwdp_records(rid, erode)]
    feats = []
    for station, river_id in CWC_STATIONS.items():
        mine = [r for r in flow if r["Station"] == station]
        pt = Point(float(mine[-1]["Longitude"]), float(mine[-1]["Latitude"]))
        km = pt.distance(rivers[river_id]) * 110
        if km > CWC_STATION_MAX_KM:
            raise SystemExit(f"gauging stations: {station} plots {km:.1f} km from the {river_id} - check the river assignment")
        every = sorted((datetime.strptime(r["Data Acquisition Time"], "%d-%m-%Y %H:%M"), v) for r in mine
                       for v in [num(next(v for k, v in r.items() if "Discharge" in k))] if v is not None and v >= 0)
        daily = [(t, v) for t, v in every if (station, t.strftime("%Y-%m")) not in CWC_FLOW_EXCLUDED_MONTHS and v <= CWC_FLOW_CAP_CUMEC]
        if station == "KODUMUDI":  # stray wrong-unit days outside the five months, caught against the gauges upstream
            upstream: dict[str, float] = {}
            mainstem_days = set()  # the test needs the Cauvery gauge upstream that day; before June 1979 there is none
            for r in flow:
                if r["Station"] in KODUMUDI_UPSTREAM:
                    v = num(next(v for k, v in r.items() if "Discharge" in k))
                    if v is not None and 0 <= v <= CWC_FLOW_CAP_CUMEC:
                        upstream[r["Data Acquisition Time"][:10]] = upstream.get(r["Data Acquisition Time"][:10], 0) + v
                        if r["Station"] == "URACHIKOTTAI":
                            mainstem_days.add(r["Data Acquisition Time"][:10])
            before = len(daily)
            daily = [(t, v) for t, v in daily if not (v > 500 and t.strftime("%d-%m-%Y") in mainstem_days and v > MASS_BALANCE_FACTOR * (upstream[t.strftime("%d-%m-%Y")] + 10))]
            stray = before - len(daily)
        left_out = [f"{t.strftime('%Y-%m-%d')} ({v:,.0f})" for t, v in every if v > CWC_FLOW_CAP_CUMEC and (station, t.strftime("%Y-%m")) not in CWC_FLOW_EXCLUDED_MONTHS]
        flow_note = "CWC manual daily discharge in cubic metres a second. Months with few readings are averages of those days only."
        flow_note += f" {CWC_FLOW_EXCLUDED_NOTE[station]}" if station in CWC_FLOW_EXCLUDED_NOTE else ""
        if station == "KODUMUDI" and stray:
            flow_note += f" {stray} further days that read more than {MASS_BALANCE_FACTOR} times the gauges upstream are left out for the same reason."
        if left_out:
            flow_note += f" Left out as entry errors: {', '.join(left_out)}."
        months: dict[str, list] = {}
        for t, v in daily:
            months.setdefault(t.strftime("%Y-%m"), []).append(v)
        ranked = sorted((v for _, v in daily), reverse=True)
        series = [
            {"kind": "discharge-monthly", "unit": "cumec", "verified": True, "label": "River flow (monthly mean of daily readings)",
             "note": flow_note,
             "points": [[m, round(sum(v) / len(v), 2), len(v)] for m, v in sorted(months.items())]},
            {"kind": "flow-duration", "unit": "cumec", "verified": True, "label": f"Flow duration, {daily[0][0].year} to {daily[-1][0].year}",
             "exceedance": [[pct, round(ranked[min(len(ranked) - 1, int(len(ranked) * pct / 100))], 2)] for pct in FLOW_DURATION_PCTS]},
        ]
        wq_years = set()
        for field, label, unit, criterion, crit_label, (lo, hi) in CWC_WQ_PARAMS:
            by_year: dict[str, list] = {}
            for r in (bio if "Oxygen Demand" in field else chem):
                v = num(r.get(field)) if r["Station"] == station else None
                if v is not None and lo <= v <= hi:
                    by_year.setdefault(r["Data Acquisition Time"][6:10], []).append(v)
            if by_year:
                wq_years |= set(by_year)
                series.append({"kind": "wq-param-series", "unit": unit, "verified": True, "label": f"{label} (annual mean of samples)", "param": label,
                               **({"criterion": criterion, "criterionLabel": crit_label} if criterion else {}), "explainer": CWC_WQ_EXPLAINER,
                               "points": [[y, round(sum(v) / len(v), 2), len(v)] for y, v in sorted(by_year.items())]})
        key = f"cwc-{station.lower()}"
        write_pack(key, {
            "schemaVersion": 1,
            "station": {"stationKey": key, "name": f"{station.title()} (CWC)", "agency": "CWC", "siteType": "Gauge, discharge and water quality site", "river": RIVER_NAMES[river_id]},
            "source": {"label": "Central Water Commission river discharge and surface water quality, from the National Water Data Portal (NWIC)", "url": NWDP, "fetched": TODAY},
            "period": {"from": daily[0][0].strftime("%Y-%m"), "to": daily[-1][0].strftime("%Y-%m")},
            "series": series,
        })
        feats.append(feat(mapping(pt), {
            "name": f"{station.title()} (CWC)", "kind": "cwc-gauge", "stationKey": key, "hasReadings": True, "river": RIVER_NAMES[river_id], "agency": "CWC",
            "flowRecord": f"{daily[0][0].strftime('%Y-%m-%d')} to {daily[-1][0].strftime('%Y-%m-%d')}, {len(daily)} daily readings",
            "latestFlow": f"{round(daily[-1][1], 1)} cumec ({daily[-1][0].strftime('%Y-%m-%d')})",
            "waterQualityRecord": f"{min(wq_years)} to {max(wq_years)} (CWC samples)" if wq_years else None,
            "positionNote": f"Position as the portal prints it; it plots {km:.1f} km from the mapped river.",
            "dataUrl": NWDP, "shedId": sheds.for_point(pt),
        }))
        print(f"    {station:18} {RIVER_NAMES[river_id]:8} flow {daily[0][0].date()} to {daily[-1][0].date()} ({len(daily)} days); quality {min(wq_years) if wq_years else '-'} to {max(wq_years) if wq_years else '-'}; {km:.1f} km from the river line")
    emit("gauging-stations", feats, "Central Water Commission gauge, discharge and water quality sites, from the National Water Data Portal (NWIC): positions as printed; flow and water quality series in readings/", "nwdp.nwic.gov.in datastore")


LIVE_FILES = ("groundwater-wells.geojson", "gauging-stations.geojson", "realtime-stations.geojson", "reservoirs.geojson", "inventory.json")
LIVE_MIN_SHARE = 0.8  # a feed returning under this share of last week's features is a partial response, not news


def refresh_live() -> int:
    """The weekly job: living feeds only, previous files restored if a feed comes back thin."""
    global LIVE
    LIVE = True
    before = {p: p.read_bytes() for p in [BASIN / f for f in LIVE_FILES] + sorted((BASIN / "readings").glob("*.json"))}
    counts = {f: len(json.loads((BASIN / f).read_text())["features"]) for f in LIVE_FILES if f.endswith(".geojson")}
    inventory["families"] = json.loads((BASIN / "inventory.json").read_text())["families"]
    try:
        district = build_boundary(write=False)
        sheds = Sheds(build_sheds(district, write=False))
        build_groundwater_wells(district, sheds)
        build_realtime_stations(sheds)
        build_gauging_stations(sheds)
        res = json.loads((BASIN / "reservoirs.geojson").read_text())
        for f in res["features"]:
            f["properties"].update({k: v for k, v in (reservoir_level_pack(f["properties"]["name"]) or {}).items()})
        write_artifact(BASIN / "reservoirs.geojson", {"type": "FeatureCollection", "features": res["features"]}, compact=True)
        for f, n in counts.items():
            now = len(json.loads((BASIN / f).read_text())["features"])
            if now < LIVE_MIN_SHARE * n:
                raise SystemExit(f"{f}: {now} features against {n} last week - a partial response, keeping last week's files")
        write_artifact(BASIN / "inventory.json", inventory, indent=1)
    except BaseException:
        for p, b in before.items():
            p.write_bytes(b)
        raise
    return 0


def main() -> int:
    BASIN.mkdir(parents=True, exist_ok=True)
    if "--live" in sys.argv[1:]:
        return refresh_live()
    district = build_boundary()
    sheds = Sheds(build_sheds(district))
    build_waterways(district)
    build_reservoirs(district, sheds)
    build_from_cauvery_tn(district, sheds)
    build_industries(district, sheds)
    build_estates(sheds)
    build_quarries(district, sheds)
    build_admin(district, sheds)
    build_panchayats(district, sheds)
    build_waterbodies(district, sheds)
    build_watersheds(district, sheds)
    build_groundwater_wells(district, sheds)
    build_prs(sheds)
    build_canals(district, sheds)
    build_cepi_frame(district, sheds)
    build_realtime_stations(sheds)
    build_gauging_stations(sheds)
    write_artifact(BASIN / "inventory.json", inventory, indent=1)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
