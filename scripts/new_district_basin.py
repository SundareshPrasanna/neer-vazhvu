#!/usr/bin/env python3
"""Scaffold a Tamil Nadu district map on the district basin engine (scripts/lib/tn_district_basin.py), so a new
district costs a config pass rather than mechanical edits.

Usage:
  python3 scripts/new_district_basin.py <slug>                       probe, and print what --write would write
  python3 scripts/new_district_basin.py <slug> --write               write the config, the manifest and the registrations
  python3 scripts/new_district_basin.py <slug> --register [--write]  after the first build and envelope: append every
                                                                     built public/data/basins/<slug>-rivers path to the
                                                                     source-registry ids its envelope cites

The district is read from the Atlas (src/lib/atlas/registry.ts, public/data/atlas/tn/<slug>/directory.json). The probes
ask for names and counts only, one request a second, cached under .cache/<slug>-rivers/probe-*.json (delete a file to
ask again). --write adds scripts/build_<slug>_rivers_basin.py (Krishnagiri-shaped), src/lib/basins/<slug>-rivers.ts,
the index.ts registration, the schemas/nvdm/scopes.json entry and the Atlas deepDive line. What needs reading rather
than probing is left as a TODO: river aliases, names and cards, canals, office names, unmatched reservoirs and taluks,
well sets the portal files under another district tag, the blurb and the credits.
"""
from __future__ import annotations

import json
import re
import sys
import textwrap
import time
from collections import Counter
from datetime import date, timedelta
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode

from shapely.geometry import Point, box, shape

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from lib.tn_district_basin import (  # noqa: E402
    BOUNDARY_RIVER_BUFFER_DEG, CWC_DISCHARGE, NWDP, NWDP_WELL_SETS, SHED_MIN_KM2, SIPCOT, TNGIS, TNPCB_RT, TNSMART,
    area_km2, artifact_text_from, fetch_json, name_key, wfs, wfs_props,
)
from nvdm_envelope_district_basin import load_config  # noqa: E402

TODAY = date.today().isoformat()
SECTORS = "pipeline-inputs/basins/tn-tnpcb-type-sectors.json"  # the statewide lookup every new district reads
SHARED_RED = {"tannery", "paper", "chemicals", "quarry-mining"}  # rows tnpcbIndustries already carries
RED_COLORS, PLANT_COLORS = ("#be123c", "#9f1239", "#881337", "#e11d48", "#fb7185"), ("#7e22ce", "#4f46e5", "#6b21a8")
DEEP_DIVE = "Rivers, groundwater and industry on one map"


def slow(fn, *args, **kw):
    time.sleep(1)  # public hosts: one request a second
    return fn(*args, **kw)


def py(v) -> str:
    """A literal in the configs' style: double quotes, a one-element tuple with its comma."""
    if isinstance(v, dict):
        return "{" + ", ".join(f"{py(k)}: {py(x)}" for k, x in v.items()) + "}"
    if isinstance(v, tuple):
        return "(" + ", ".join(map(py, v)) + ("," if len(v) == 1 else "") + ")"
    return json.dumps(v, ensure_ascii=False)


def wrap(text: str, indent: str, width: int = 150) -> str:
    return textwrap.fill(text, width, subsequent_indent=indent, break_long_words=False, break_on_hyphens=False)


def atlas(slug: str) -> dict:
    """Name and LGD code from the district's Atlas directory, scope id from the Atlas registry."""
    base = ROOT / "public/data/atlas/tn" / slug
    m = re.search(rf'\n    slug: "{re.escape(slug)}",\n    scopeId: "([^"]+)"', (ROOT / "src/lib/atlas/registry.ts").read_text())
    missing = [f for f in ("directory.json", "groundwater-taluks.json", "briefs", "census-2011") if not (base / f).exists()]
    if not m or missing:
        raise SystemExit(f"{slug}: not a Tamil Nadu Atlas district with its inputs (registry entry {'found' if m else 'missing'}; missing {missing})")
    d = json.loads((base / "directory.json").read_text())["district"]
    ingres = [r["locationName"] for r in json.loads((base / "groundwater-taluks.json").read_text())["records"]]
    return {"slug": slug, "name": d["name"], "lgd": d["lgdDistrictCode"], "scope": m.group(1), "id": f"{slug}-rivers", "py": slug.replace("-", "_"), "ingres": ingres}


def probe(a: dict) -> dict:
    cache = ROOT / ".cache" / a["id"]

    def cached(name: str, fetch):
        fp = cache / f"probe-{name}.json"
        if not fp.exists():
            data = fetch()
            cache.mkdir(parents=True, exist_ok=True)
            fp.write_text(json.dumps(data, ensure_ascii=False))
        return json.loads(fp.read_text())

    raw = cached("district", lambda: slow(wfs, "admin_master:administrative_boundary_district", f"district_lgd_code='{a['lgd']}'"))
    if len(raw["features"]) != 1:
        raise SystemExit(f"boundary: expected 1 district for LGD {a['lgd']}, got {len(raw['features'])}")
    props, district = raw["features"][0]["properties"], shape(raw["features"][0]["geometry"]).buffer(0)
    near, bb = district.buffer(BOUNDARY_RIVER_BUFFER_DEG), district.bounds

    def sub_basins() -> list:
        out = []
        for f in slow(wfs, "generic_viewer:sub_basin", bbox=bb)["features"]:
            g = shape(f["geometry"]).buffer(0)
            if (km2 := round(area_km2(g.intersection(district)), 1) if g.intersects(district) else 0) > 0:
                p = f["properties"]
                out.append({"name": re.sub(r"^\d+\.\s*", "", str(p.get("subbasin", "")).strip()), "objectId": p.get("object_id"), "basin": p.get("basin"), "km2": km2})
        return sorted(out, key=lambda s: -s["km2"])

    sheds = cached("sub-basins", sub_basins)
    reservoirs = cached("reservoirs", lambda: sorted({str(f["properties"].get("reservoir_name") or "").strip().title()
                                                      for f in slow(wfs, "generic_viewer:reservoir", bbox=bb)["features"] if shape(f["geometry"]).buffer(0).intersects(near)}))
    dash = cached("tnsmart", lambda: [{k: r.get(k) for k in ("name", "longitude", "latitude")}
                                      for r in json.loads(re.search(r"\[\s*\{[^\[\]]*?depth_ft.*?\}\s*\]", slow(artifact_text_from, TNSMART), re.S).group(0))])

    def nk(name: str) -> str:  # the register also writes spaces as underscores (Uppar_Trichy); the engine's name_key stays as it is
        return name_key(name.replace("_", " "))

    by_key = {nk(str(r["name"])): str(r["name"]).strip() for r in dash}
    storage = {n: by_key[nk(n)] for n in reservoirs if nk(n) in by_key}
    dash_near = [str(r["name"]).strip() for r in dash if r.get("longitude") and near.contains(Point(float(r["longitude"]), float(r["latitude"])))]

    def nwdp(rid: str, fields: str = "", offset: int = 0) -> dict:
        q = urlencode({"resource_id": rid, "filters": json.dumps({"District": a["name"]}), "fields": fields or "_id", "limit": 5000 if fields else 0, "offset": offset})
        return slow(fetch_json, f"{NWDP}/api/3/action/datastore_search?{q}")["result"]

    def stations() -> dict:
        out = {}
        for rid in CWC_DISCHARGE:
            offset, recs = 0, None
            while recs is None or len(recs) == 5000:
                recs = nwdp(rid, "Station,Longitude,Latitude,River", offset)["records"]
                for r in recs:
                    out.setdefault(r["Station"].strip().upper(), [r["Longitude"], r["Latitude"], r["River"], 0])[3] += 1
                offset += 5000
        return out

    def site(n: int) -> dict:  # the dashboard's sites 3 to 10; a month's means carry the station's metadata
        q = urlencode({"site_id": n, "mean": "MO", "start_date": f"{date.today() - timedelta(days=31)} 00:00", "end_date": f"{TODAY} 00:00"})
        d = slow(fetch_json, f"{TNPCB_RT}/api/readings/graph/?{q}")
        return {k: d.get(k) for k in ("site_name", "station_code", "river_name", "longitude", "latitude")}

    wells = cached("nwdp-wells", lambda: {kind: nwdp(rid)["total"] for kind, rid, *_ in NWDP_WELL_SETS})
    cwc = cached("nwdp-cwc-stations", stations)
    rt = cached("tnpcb-rt", lambda: {n: site(n) for n in range(3, 11)})

    def parks() -> list:
        caps = slow(artifact_text_from, f"{SIPCOT}?service=WFS&version=1.0.0&request=GetCapabilities")
        return [[name, *map(float, re.search(r'minx="([^"]+)" miny="([^"]+)" maxx="([^"]+)" maxy="([^"]+)"', ft).groups())]
                for ft in re.findall(r"<FeatureType>(.*?)</FeatureType>", caps, re.S) for name in re.findall(r"<Name>cite:industrial_complex_boundary-([^<]+)</Name>", ft)]

    def outline(name: str) -> dict:  # one park's attributes; an error report (XML) or HTTP error is the server's answer, kept
        q = urlencode({"service": "WFS", "version": "1.0.0", "request": "GetFeature", "typeName": f"cite:industrial_complex_boundary-{name}",
                       "propertyName": "ind_cmplx_name,ind_cmplx_no,ind_cmplx_area_acre", "outputFormat": "application/json"})
        try:
            return {"names": [str(f["properties"].get("ind_cmplx_name") or "") for f in slow(fetch_json, f"{SIPCOT}?{q}")["features"]]}
        except HTTPError as e:
            if e.code >= 500:  # a passing outage: not cached, so the outer handler asks for a re-run
                raise
            return {"error": f"HTTP {e.code}"}
        except (ValueError, KeyError) as e:
            return {"error": type(e).__name__}

    try:  # best effort: the server lists layers it cannot serve, and tourism plots, and refuses connections some days
        found = {n: cached(f"sipcot-{n}", lambda n=n: outline(n)) for n, *ext in cached("sipcot", parks) if district.contains(box(*ext).centroid)}
        dropped = {n: why for n, r in found.items() if (why := f"server error ({r['error']})" if "error" in r else "no outline" if not r["names"]
                                                        else "tourism plot" if any("tourism" in x.lower() for x in r["names"]) else None)}
        estates, sipcot_error = [n for n in found if n not in dropped], None
    except (OSError, AttributeError) as e:
        estates, dropped, sipcot_error = None, {}, str(e)

    def industry_register() -> dict:
        ids = {str(f["properties"]["user_id"]) for f in slow(wfs_props, "generic_viewer:industry_cad_matched", f"lgd_district_code='{a['lgd']}'", "user_id")["features"]}
        m = [x for x in map(re.compile(r"^[A-Z](\d{2})([A-Z]{3})\d+$").match, ids) if x]
        return {"units": len(ids), "offices": dict(Counter(x.group(2) for x in m).most_common()), "years": sorted({x.group(1) for x in m})}

    def hits(name: str) -> int:
        q = urlencode({"service": "WFS", "version": "1.1.0", "request": "GetFeature", "typeName": "tnrd:panchayat_boundary", "resultType": "hits", "CQL_FILTER": f"district_name='{name}'"})
        return int(re.search(r'numberOfFeatures="(\d+)"', slow(artifact_text_from, f"{TNGIS}?{q}")).group(1))

    tnrd = cached("tnrd", lambda: {n: hits(n) for n in dict.fromkeys((a["name"], str(props["district_name"]).strip()))})
    taluks = cached("taluks", lambda: sorted({str(f["properties"]["taluk_name"]).strip() for f in slow(
        wfs_props, "admin_master:administrative_boundary_taluk", f"district_lgd_code='{a['lgd']}'", "taluk_name")["features"]}))
    tk, ik = {name_key(t) for t in taluks}, {name_key(n) for n in a["ingres"]}  # the engine's taluk join (build_admin)
    return {
        "district": district, "tamil": props.get("district_tamil_name"), "sheds": [s for s in sheds if s["km2"] >= SHED_MIN_KM2],
        "slivers": [s for s in sheds if s["km2"] < SHED_MIN_KM2], "reservoirs": reservoirs, "storage": storage,
        "unmatched": [n for n in reservoirs if n not in storage], "dash_near": [n for n in dash_near if n not in storage.values()],
        "wells": wells, "stations": {s: v for s, v in cwc.items() if near.contains(Point(float(v[0]), float(v[1])))},
        "stations_outside": [s for s, v in cwc.items() if not near.contains(Point(float(v[0]), float(v[1])))],
        "rt": {int(s): r for s, r in rt.items() if r.get("longitude") and district.contains(Point(float(r["longitude"]), float(r["latitude"])))},
        "estates": estates, "estates_dropped": dropped, "sipcot_error": sipcot_error, "register": cached("register", industry_register),
        "taluks_left": [t for t in taluks if name_key(t) not in ik], "ingres_left": [n for n in a["ingres"] if name_key(n) not in tk],
        "tnrd": next((n for n, c in tnrd.items() if c), None), "tnrd_hits": tnrd,
        "clip": tuple(f"{v:.2f}" for v in (bb[0] - 0.1, bb[1] - 0.1, bb[2] + 0.1, bb[3] + 0.1)),
    }


def render_config(a: dict, p: dict) -> str:
    n, bid, lgd, est, rt, st, stor = a["name"], a["id"], a["lgd"], p["estates"], p["rt"], p["stations"], p["storage"]
    reg, tagged = p["register"], any(p["wells"].values()) or p["stations"] or p["stations_outside"]
    gaps = [k for k, v in p["wells"].items() if not v] if any(p["wells"].values()) else []  # sets filed under another tag
    left_out = "; ".join(f"{k} ({v})" for k, v in p["estates_dropped"].items())
    sources = [
        ("TNGIS admin_master:administrative_boundary_district", f"boundary (LGD {lgd})"), ("TNGIS generic_viewer:sub_basin", "sub-hydrosheds (clipped)"),
        ("OpenStreetMap waterway=river|canal (Overpass)", "rivers"), ("TNGIS generic_viewer:reservoir / mines", "reservoirs, quarries" if p["reservoirs"] else "quarries"),
        ("TNGIS generic_viewer:all_tanks", "tanks (named, centre points)"), ("TNGIS generic_viewer:all_water_bodies", "waterbodies-major, waterbodies-minor"),
        ("TNGIS generic_viewer:microwatersheds", "watersheds, sub-watersheds, mini-watersheds, micro-watersheds"), ("TNGIS tnrd:panchayat_boundary", "admin-gp"),
        ("NWIC National Water Data Portal (CKAN datastore)", "groundwater-wells (CGWB + state telemetry 2026, CGWB manual 2021-2025)"),
        ("NWDP, CWC 'Canal Network' + 'Water Resource Project'", "canals, command-areas (needs ogr2ogr once)"),
        *([("TNPCB real-time water quality dashboard (JSON)", "realtime-stations + readings/<station>.json")] if rt else []),
        *([("TN-SMART (RIMES) reservoir dashboard", f"reservoirs: today's storage for {', '.join(stor.values()) or 'those RESERVOIR_STORAGE names'}")] if p["reservoirs"] else []),
        *([("NWDP, CWC river discharge + surface water quality", "gauging-stations + readings/cwc-<station>.json")] if st else []),
        ("TNGIS admin_master taluks + generic_viewer:block_boundary", "admin-taluk, admin-block, groundwater-taluks"),
        ("TNGIS generic_viewer:industry_cad_matched", "industries, treatment-plants"), *([("SIPCOT GIS industrial_complex_boundary-*", "industrial-estates")] if est else []),
    ]
    steps = ("waterways", *(("reservoirs",) if p["reservoirs"] else ()), "tanks", "industries", *(("estates",) if est else ()), "quarries", "admin", "panchayats",
             "waterbodies", "watersheds", "groundwater-wells", "canals", *(("realtime-stations",) if rt else ()), *(("gauging-stations",) if st else ()))
    unserved = {f: s for f, s, found in (("reservoirs", None, p["reservoirs"]), ("industrial-estates", "sipcot", est), ("realtime-stations", "tnpcb-rt", rt), ("gauging-stations", "cwc-river", st)) if not found}
    offices = ", ".join(f"{k} ({v:,} units)" for k, v in reg["offices"].items())
    lines = [
        "#!/usr/bin/env python3",
        f'"""Assemble the {bid} Basin Atlas families: {n} district as the frame, TN WRD',
        "sub-basin catchments clipped to it as the sheds, and the named rivers that cross it.", "",
        f"{n}'s configuration of the Tamil Nadu district basin engine",
        f"(scripts/lib/tn_district_basin.py), scaffolded by scripts/new_district_basin.py on {TODAY}.",
        "TODO: the district's basins and rivers in a few sentences, as Krishnagiri's config has them.", "",
        f"Sources (fetched once, cached under .cache/{bid}/, gitignored):", *(f"  {s:<52}  {f}" for s, f in sources), "",
        "Inputs already in the repo:", f"  public/data/atlas/tn/{a['slug']}/groundwater-taluks.json  groundwater-taluks (IN-GRES stage by taluk)",
        f"  {SECTORS}  reviewed TNPCB type code -> sector lookup (statewide)", "",
        f"Writes public/data/basins/{bid}/<family>.geojson and inventory.json",
        "through nvdm_write.write_artifact so envelopes survive a re-run. After the first build, run",
        f"scripts/nvdm_envelope_district_basin.py scripts/build_{a['py']}_rivers_basin.py to stamp envelopes, then",
        f"scripts/new_district_basin.py {a['slug']} --register --write to list the files in the source registry.", "",
        "Usage:", f"  python3 scripts/build_{a['py']}_rivers_basin.py          full build (every family)",
        f"  python3 scripts/build_{a['py']}_rivers_basin.py --live   weekly refresh of the living feeds only", '"""',
        "from __future__ import annotations", "", "import sys", "from pathlib import Path", "",
        "ROOT = Path(__file__).resolve().parent.parent", 'sys.path.insert(0, str(ROOT / "scripts"))',
        f"from lib.tn_district_basin import NWDP, TN_ENVELOPE_READINGS, TN_ENVELOPE_SOURCES, TNGIS, {'TNSMART, ' if p['reservoirs'] else ''}DistrictBasinBuild, tn_envelope  # noqa: E402", "",
        f"BASIN_ID = {py(bid)}", "GENERATED_FROM = Path(__file__).name", f"DISTRICT_LGD = {py(lgd)}", f"DISTRICT_NAME = {py(n)}",
        f"TNRD_DISTRICT_NAME = {py(p['tnrd'] or n)}  # " + ("as tnrd:panchayat_boundary prints district_name" if p["tnrd"] else f"TODO: tnrd:panchayat_boundary has no district_name in {list(p['tnrd_hits'])}: find its spelling"),
        f"NWDP_DISTRICT = {py(n)}  # " + ("as the National Water Data Portal tags its stations" if tagged else "TODO: the portal tags no station with this name: find its tag (NWDP_DISTRICT_ALIASES for older ones)"),
        *([f'NWDP_DISTRICT_ALIASES = ()  # TODO: no {", ".join(gaps)} rows carry this name while other sets do: CGWB may keep the older district\'s tag (Ranipet, Tirupathur: ("Vellore",)); then add any CWC station that tag places inside the district to CWC_STATIONS (Tirupathur: NARIYAMPATTU)'] if gaps else []),
        f"ATLAS_SLUG = {py(a['slug'])}  # public/data/atlas/tn/<slug>, the district Atlas this map links to", "",
    ]
    if est:
        lines += [f"SIPCOT_PARKS = {py(tuple(est))}  # SIPCOT GIS layers whose extent centres in the district (probe {TODAY})" + (f"; left out: {left_out}" if left_out else ""),
                  f'ESTATES_PROVENANCE = "SIPCOT GIS (sipcotgis.tn.gov.in): industrial complex outlines, {", ".join(e.replace("_", " ") for e in est)}; area as SIPCOT states it"',
                  'ESTATES_SOURCE_FILE = "cite:industrial_complex_boundary-*"']
    elif est is None:
        lines.append(f'# TODO: SIPCOT GIS refused the probe ({TODAY}): re-run it (the dry run), or name the parks here (SIPCOT_PARKS, ESTATES_PROVENANCE, ESTATES_SOURCE_FILE), in STEPS and in the envelope')
    elif left_out:
        lines.append(f"# SIPCOT GIS: no layer centred in the district is an industrial estate that serves (probe {TODAY}); left out: {left_out}")
    lines += [
        "# CWC's national canal and command-area layers on NWDP (shapefile zips, Lambert conformal conic).",
        f'CWC_CANALS_FILE, CWC_COMMAND_FILE = "cwc-canals-{a["slug"]}.geojson", "cwc-command-{a["slug"]}.geojson"', "CWC_LAYERS = {",
        '    CWC_CANALS_FILE: (f"{NWDP}/dataset/dd11dfc1-6723-4603-9426-a03e4c8cf50c/resource/75e4b705-44b3-4b4a-a32f-060eeae7b907/download/canal_network.zip", "Canal_Network.shp"),',
        '    CWC_COMMAND_FILE: (f"{NWDP}/dataset/a4fde712-4a1f-461b-897a-411ebb29a622/resource/19966957-ccfc-4341-ab11-ca72da5953f4/download/command_area.zip", "Command_Area.shp"),',
        "}", f"CWC_CLIP = {py(p['clip'])}  # the district extent plus a margin, lon/lat",
        "CANAL_RIVERS = {}  # TODO: river_id -> the CWC canal line a reader can select like a river (CWC's lines are read on the first build)",
        "CANAL_NAMES = {}",
        'WATERWAYS_PROVENANCE = "Rivers: OpenStreetMap waterway courses (Overpass), clipped to the district plus 1.6 km so boundary rivers stay"',
        'CANALS_PROVENANCE = "CWC canal network (National Water Data Portal, 2025), cut to the district"',
    ]
    if rt:
        lines += ["# TNPCB's real-time water quality monitoring dashboard: the stations inside the district.",
                  f"TNPCB_RT_SITES = {py(tuple(rt))}  # " + "; ".join(r["site_name"] for r in rt.values())]
    if st:
        lines += [f"# CWC's gauging stations NWDP tags {n} (the portal's River column, daily rows): " + "; ".join(f"{s.title()} ({v[2]}, {v[3]:,})" for s, v in st.items()),
                  f"CWC_STATIONS = {py(dict.fromkeys(st, 'TODO'))}  # TODO: the river id each is on (checked against the mapped course)"]
    lines += ["RESERVOIR_LEVELS = {}  # register name -> (CWC station, key, display name), where CWC_LEVEL_RESOURCES carries the dam", "RESERVOIR_ALIASES = {}"]
    if p["reservoirs"]:
        lines += ["# TN WRD register name -> the name the state's daily reservoir dashboard prints, where the two plainly match.",
                  f"RESERVOIR_STORAGE = {py(stor)}" + (f"  # TODO: {', '.join(p['unmatched'])} not on it by that name (dashboard names placed here: {', '.join(p['dash_near']) or 'none'})" if p["unmatched"] else "")]
    lines += [
        f"SECTOR_LOOKUP = ROOT / {py(SECTORS)}", "CETP_SCHEMES = None",
        *([f'REGISTER_YEARS = "20{reg["years"][0]} to 20{reg["years"][-1]}"'] if reg["years"] else []),
        f"TNPCB_OFFICE = {{}}  # TODO: the office name for each code the register prints: {offices or 'none'}",
        "SUB_BASIN_KEY = {}  # sheds keep TNGIS's object_id keys (SB<object_id>), listed in the manifest",
        "TALUK_ALIASES = {}  # " + (f"TODO: TNGIS taluk -> IN-GRES locationName for {', '.join(p['taluks_left']) or 'none'} (IN-GRES names left: {', '.join(p['ingres_left']) or 'none'})"
                                    if p["taluks_left"] or p["ingres_left"] else "TNGIS taluk -> IN-GRES locationName; every taluk matches by name"),
        "RIVER_ALIASES = {}  # TODO: river_id -> the OSM spellings folded to it; only aliased rivers are drawn",
        "RIVER_NAMES = {}  # TODO: river_id -> display name", "REPO_FAMILIES = ()", "",
        "# Build order: the inventory lists families in this order.", wrap(f"STEPS = {py(steps)}", " " * 9), "",
        "# Envelopes (scripts/nvdm_envelope_district_basin.py): the shared TN families.", "ENVELOPE_SOURCES = {", "    **TN_ENVELOPE_SOURCES,",
        '    "tngis": ("tngis-open-geoserver", "TNGIS open GeoServer (WFS): district, taluk, block and village panchayat boundaries, TN WRD sub-basins and reservoirs, micro-watershed atlas, all-water-bodies and all-tanks registers, mine leases, industry register matched to land parcels",',
        '              "Tamil Nadu e-Governance Agency (TNGIS)", {"url": TNGIS}),',
        *([f'    "sipcot": ("sipcot-gis-geoserver", "SIPCOT GIS (WFS): industrial complex outlines, {", ".join(e.replace("_", " ") for e in est)}",',
           '               "State Industries Promotion Corporation of Tamil Nadu (SIPCOT)", {"url": "https://sipcotgis.tn.gov.in/"}),'] if est else []),
        '    "osm": ("osm-overpass", "OpenStreetMap (Overpass API extract: named river courses)", "OpenStreetMap contributors", {}),',
        *(['    "cwc-river": ("nwic-nwdp-cwc-river-data", "CWC river discharge (manual daily) and surface water quality for Tamil Nadu, National Water Data Portal",',
           '                  "Central Water Commission, via the National Water Informatics Centre (NWIC)", {"url": f"{NWDP}/"}),'] if st else []),
        "}", "ENVELOPE_ARTIFACTS, ENVELOPE_INPUTS, ENVELOPE_NOTE = tn_envelope(BASIN_ID, ATLAS_SLUG, (",
        f"    \"{n} district's rivers, groundwater and industry (scope {bid}; the district's own scope id is {a['scope']}). \"",
        "    \"The district boundary is the frame and TN WRD's sub-basins, clipped to it, are the catchments (shedId).\"))",
        'ENVELOPE_NOTE = ENVELOPE_NOTE.replace(f"basins/{BASIN_ID}/tnpcb-type-sectors.json", "basins/tn-tnpcb-type-sectors.json")  # SECTOR_LOOKUP is statewide',
    ]
    if unserved:
        lines += [f"for _family in {py(tuple(unserved))}:  # nothing to serve here (probe {TODAY})", "    del ENVELOPE_ARTIFACTS[_family]", "    ENVELOPE_INPUTS.pop(_family, None)"]
        if gone := tuple(s for s in unserved.values() if s):
            lines.append(f'ENVELOPE_ARTIFACTS["inventory"] = [s for s in ENVELOPE_ARTIFACTS["inventory"] if s not in {py(gone)}]')
    if p["reservoirs"]:  # decided at build time, so a hand-filled RESERVOIR_STORAGE carries its citation and registration
        lines += ["if RESERVOIR_STORAGE:",
                  '    ENVELOPE_SOURCES["tnsmart"] = ("tnsmart-rimes-reservoirs", "Tamil Nadu reservoir dashboard (TN-SMART): the day\'s storage, depth and percentage of capacity per reservoir",',
                  '                                   "RIMES, relaying Tamil Nadu\'s daily reservoir storage", {"url": TNSMART})',
                  '    ENVELOPE_ARTIFACTS["reservoirs"] = ["tngis", "tnsmart"]', '    ENVELOPE_ARTIFACTS["inventory"] += ["tnsmart"]']
    lines += ["ENVELOPE_READINGS = TN_ENVELOPE_READINGS", "", "", 'if __name__ == "__main__":', "    raise SystemExit(DistrictBasinBuild(sys.modules[__name__]).main(sys.argv[1:]))", ""]
    return "\n".join(lines)


def render_manifest(a: dict, p: dict) -> str:
    n, bid, d, const = a["name"], a["id"], p["district"], f"{a['py'].upper()}_RIVERS"
    lookup = json.loads((ROOT / SECTORS).read_text())
    treat = sorted({r["sector"] for r in lookup["rules"] if r.get("treatment")})
    red = [s for s in lookup["sectors"] if s not in {*treat, *SHARED_RED}]
    def row(value: str, label: str, color: str) -> str:
        return f"{{ value: {json.dumps(value)}, label: {json.dumps(label, ensure_ascii=False)}, color: {json.dumps(color)} }}"

    reds = [row(f"red-{s}", f"Red: {lookup['sectors'][s][0].lower()}{lookup['sectors'][s][1:]}", RED_COLORS[i % len(RED_COLORS)]) for i, s in enumerate(red)]
    plants = [row(s, lookup["sectors"][s], PLANT_COLORS[i % len(PLANT_COLORS)]) for i, s in enumerate(treat)]
    gauges, sites = "CWC gauge" + "s" * (len(p["stations"]) > 1), "sensor station" + "s" * (len(p["rt"]) > 1)
    layers = [
        "    // Structural context", f'    ...districtFrame({json.dumps(n)}, TN_WRD_CATCHMENTS, "Rivers"),', "    CWC_CANALS,",
        *([f'    reservoirs("Reservoirs (TN WRD register)", "Reservoir with {"a storage reading from the state dashboard" if p["storage"] else "a public reading"}", "Reservoir with no public reading"),'
           + (f" // TODO: the storage wording once RESERVOIR_STORAGE names {', '.join(p['dash_near'])}" if p["dash_near"] and not p["storage"] else "")] if p["reservoirs"] else []),
        "    ...TNGIS_WATER_BODIES,", "    ...TNGIS_WATERSHEDS,", "", "    // Monitoring & evidence",
        *([f'    cwcGauges("River flow and water quality ({gauges})", "CWC gauge: river flow and water quality (tap for charts)"),'] if p["stations"] else []),
        *([f'    tnpcbRealtime("Real-time {sites} (TNPCB)"),'] if p["rt"] else []),
        "    TN_GROUNDWATER_WELLS,", "", "    // Pressures: one register, one toggle per TNPCB category and sector",
        "    // TODO: keep the red sectors the first build finds (the inventory's industries kinds).",
        "    tnpcbIndustries(", "      [", *(f"        {r}," for r in reds), "      ],", '      "Orange category",', "    ),",
        *(['    { family: "industrial-estates", label: "SIPCOT estates", floor: "pressures", geom: "fill", color: "#C62828", defaultOn: true },'] if p["estates"] else []),
        '    { family: "quarries", label: "Mine and quarry leases", floor: "pressures", geom: "fill", color: "#ea580c", defaultOn: true },', "",
        "    // Governance: groundwater category by taluk, treatment, admin", "    INGRES_TALUKS,",
        "    // TODO: keep the kinds the first build finds (the inventory's treatment-plants kinds).", "    treatmentPlants([", *(f"      {r}," for r in plants), "    ]),",
        "    cwcCommandAreas([]), // TODO: one row per command-areas kind the first build writes", "    ...TN_ADMIN,",
    ]
    used = [x for x in ("districtFrame", "TN_WRD_CATCHMENTS", "CWC_CANALS", "reservoirs", "TNGIS_WATER_BODIES", "TNGIS_WATERSHEDS", "cwcGauges", "tnpcbRealtime",
                        "TN_GROUNDWATER_WELLS", "tnpcbIndustries", "INGRES_TALUKS", "treatmentPlants", "cwcCommandAreas", "TN_ADMIN") if re.search(rf"\b{x}\b", "\n".join(layers))]
    sheds = "; ".join(f"SB{s['objectId']} {s['name']} {s['km2']:,.0f}" for s in p["sheds"])
    cauvery = any(s["basin"] == "Cauvery" for s in p["sheds"])
    return "\n".join([
        'import type { BasinManifest } from "./types";', "import {", wrap("  " + ", ".join(used) + ",", "  ", 120), '} from "./district-layers";', "",
        f"// {n} district's rivers, groundwater and industry on the Tamil Nadu district engine. The district boundary is",
        "// the frame; TN WRD's sub-basins, clipped to it, are the catchments a river selection scopes to. Data under",
        f"// public/data/basins/{bid}/, built by scripts/build_{a['py']}_rivers_basin.py. The basin id is \"{bid}\";",
        f"// the district's own scope is \"{a['scope']}\". Scaffolded by scripts/new_district_basin.py: each TODO is research.",
        f"export const {const}: BasinManifest = {{", f'  basinId: "{bid}",', "  cityIds: [],", '  stateCode: "TN",',
        f'  displayName: "{n} district: rivers, groundwater and industry",',
        *([f'  displayNameLocal: "{p["tamil"]} மாவட்டம்: ஆறுகள், நிலத்தடி நீர், தொழிற்சாலைகள்",'] if p["tamil"] else []),
        '  blurb: "TODO: the district in one map, from the first build\'s numbers (see krishnagiri-rivers.ts).",',
        f"  mapCenter: [{d.centroid.y:.2f}, {d.centroid.x:.2f}],", "  mapZoom: 10,", '  defaultFitFamilies: ["boundary"],', f"  areaKm2: {area_km2(d):.0f},",
        "  areaNote: \"Computed from the TNGIS district boundary. The catchments are TN WRD's sub-basins cut to that boundary; each continues outside the district.\",",
        *(['  relatedBasins: [{ basinId: "cauvery-tn", label: "The whole Cauvery basin in Tamil Nadu" }],'] if cauvery else []),
        wrap(f"  // TODO: a card per river in the config's RIVER_NAMES. The catchments its subHydroshedIds can name, sq km in the district: {sheds}.", "  // "),
        "  rivers: [],", "  layers: [", *layers, "  ],",
        '  credits: ["TODO: one line per source, with the first build\'s counts (see krishnagiri-rivers.ts)."],', "};", "",
    ])


def edits(a: dict) -> list:
    """(path, new text, added line) for the index.ts registration, the scope entry and the Atlas deepDive line."""
    const, bid = f"{a['py'].upper()}_RIVERS", a["id"]

    def sorted_insert(text: str, pattern: str, line: str, key: str) -> str:
        lines = text.split("\n")
        at = [(i, m.group(1)) for i, ln in enumerate(lines) if (m := re.fullmatch(pattern, ln))]
        lines.insert(next((i for i, k in at if k > key), at[-1][0] + 1), line)
        return "\n".join(lines)

    index = (ROOT / "src/lib/basins/index.ts").read_text()
    imp, ent = f'import {{ {const} }} from "./{bid}";', f'  "{bid}": {const},'
    index = sorted_insert(sorted_insert(index, r'import \{ \w+ \} from "\./([\w-]+)";', imp, bid), r'  "?([\w-]+)"?: [A-Z_]+,', ent, bid)
    scopes = (ROOT / "schemas/nvdm/scopes.json").read_text()
    if a["scope"] not in json.loads(scopes)["scopes"]:
        raise SystemExit(f"{a['scope']}: not in schemas/nvdm/scopes.json")
    scope = f'  "{bid}": ' + json.dumps({"kind": "basin", "name": f"{a['name']} district rivers", "relations": [
        {"type": "intersects", "target": a["scope"], "method": "geometry", "evidence": f"public/data/basins/{bid}/boundary.geojson"}]}, ensure_ascii=False) + ","
    lines = scopes.split("\n")
    lines.insert(max(i for i, ln in enumerate(lines) if re.match(r'  "[\w-]+-rivers": \{"kind": "basin"', ln)) + 1, scope)
    reg = (ROOT / "src/lib/atlas/registry.ts").read_text()
    start = reg.index(f'    slug: "{a["slug"]}",')
    block = reg[start:reg.index("\n  },", start)]
    anchor = start + re.search(r"\n    basin: .*" if "\n    basin: " in block else r"\n    hook: .*", block).end()
    deep = f'    deepDive: {{ basinId: "{bid}", label: "{DEEP_DIVE}" }},'
    return [("src/lib/basins/index.ts", index, f"{imp}\n{ent}"), ("schemas/nvdm/scopes.json", "\n".join(lines), scope),
            ("src/lib/atlas/registry.ts", reg[:anchor] + "\n" + deep + reg[anchor:], deep)]


def scaffold(slug: str, write: bool) -> int:
    a = atlas(slug)
    cfg, ts = f"scripts/build_{a['py']}_rivers_basin.py", f"src/lib/basins/{a['id']}.ts"
    if write and (taken := [f for f in (cfg, ts) if (ROOT / f).exists()] + ([a["id"]] if f'"{a["id"]}"' in (ROOT / "src/lib/basins/index.ts").read_text() else [])):
        raise SystemExit(f"{slug}: already scaffolded ({', '.join(taken)})")
    p = probe(a)
    reg, sheds = p["register"], ", ".join(f"SB{s['objectId']} {s['name']} {s['km2']:,.0f}" for s in p["sheds"])
    sites = [f"{s} {r['site_name']}" for s, r in p["rt"].items()]
    print(f"{slug}: {a['name']}, LGD {a['lgd']}, scope {a['scope']}; {area_km2(p['district']):,.0f} sq km, CWC_CLIP {p['clip']}\n"
          f"  sub-basins (sq km in the district): {sheds}; slivers under {SHED_MIN_KM2:g}: {[s['name'] for s in p['slivers']]}\n"
          f"  reservoirs: {p['reservoirs'] or 'none'}; on the state dashboard: {p['storage'] or 'none'}; not matched: {p['unmatched'] or 'none'}\n"
          f"  NWDP '{a['name']}': well rows {p['wells']}; CWC stations {list(p['stations']) or 'none'}" + (f" (tagged but outside: {p['stations_outside']})" if p["stations_outside"] else "") + "\n"
          f"  TNPCB real-time sites inside: {sites or 'none'}\n"
          f"  SIPCOT parks: {p['estates'] if p['estates'] is not None else 'server refused: ' + p['sipcot_error']}" + (f"; left out: {p['estates_dropped']}" if p["estates_dropped"] else "") + "\n"
          f"  taluks not matched by name: TNGIS {p['taluks_left'] or 'none'}, IN-GRES {p['ingres_left'] or 'none'}\n"
          f"  register: {reg['units']:,} units, offices {reg['offices']}, years {reg['years'][:1] + reg['years'][-1:]}; TNRD panchayats {p['tnrd_hits']}")
    files = {cfg: render_config(a, p), ts: render_manifest(a, p)}
    for rel, text in files.items():
        print(f"\n{'writing' if write else 'would write'} {rel} ({text.count(chr(10))} lines)" + ("" if write else ":\n" + text))
        if write:
            (ROOT / rel).write_text(text)
    for rel, text, added in edits(a):
        print(f"\n{'editing' if write else 'would edit'} {rel}, adding:\n{added}")
        if write:
            (ROOT / rel).write_text(text)
    print(f"\nnext: fill the TODOs, run scripts/build_{a['py']}_rivers_basin.py, scripts/nvdm_envelope_district_basin.py scripts/build_{a['py']}_rivers_basin.py, "
          f"then scripts/new_district_basin.py {slug} --register --write")
    return 0


def register(slug: str, write: bool) -> int:
    """Every built path, under each registry id its envelope cites, as Krishnagiri's are listed (the enveloper's rule)."""
    bid = f"{slug}-rivers"
    cfg, B, rel = load_config(f"scripts/build_{slug.replace('-', '_')}_rivers_basin.py"), ROOT / "public/data/basins" / bid, f"public/data/basins/{bid}"
    want: dict[str, list] = {}

    def add(path: str, names) -> None:
        for name in names:
            if not isinstance(src := cfg.ENVELOPE_SOURCES[name], dict):  # a closed document has no registry id
                want.setdefault(src[0], []).append(f"{rel}/{path}")

    try:
        for fam, row in json.loads((B / "inventory.json").read_text())["families"].items():
            for path in (f"{fam}.geojson", *((fam,) if row.get("sliced") else ())):
                add(path, cfg.ENVELOPE_ARTIFACTS[fam])
        for fp in sorted(B.glob("*.json")):
            add(fp.name, cfg.ENVELOPE_ARTIFACTS["inventory" if fp.name == "inventory.json" else fp.name])
    except KeyError as e:
        raise SystemExit(f"{bid}: no envelope rule for {e} (ENVELOPE_ARTIFACTS, ENVELOPE_SOURCES)") from None
    for pack in sorted((B / "readings").glob("*.json")):
        if (prefix := next((x for x in cfg.ENVELOPE_READINGS if pack.name.startswith(x)), None)) is None:
            raise SystemExit(f"{bid}: readings/{pack.name} has no ENVELOPE_READINGS rule")
        add("readings", cfg.ENVELOPE_READINGS[prefix])
    registry = {fp: json.loads(fp.read_text()) for fp in sorted((ROOT / "scripts/source-registry").glob("*.json"))}
    entries = {e["id"]: (fp, e) for fp, doc in registry.items() for e in doc["sources"]}
    changed = set()
    for rid, paths in want.items():
        if rid not in entries:
            raise SystemExit(f"{bid}: registry id {rid!r} is in no scripts/source-registry file")
        fp, e = entries[rid]
        new = [x for x in dict.fromkeys(paths) if x not in e.setdefault("dependsOn", [])]
        e["dependsOn"] += new
        changed |= {fp} if new else set()
        print(f"  {rid} ({fp.name}): " + (f"+{len(new)}" + "".join(f"\n    {x}" for x in new) if new else "lists every path already"))
    for fp in sorted(changed) if write else ():
        fp.write_text(json.dumps(registry[fp], indent=2, ensure_ascii=False) + "\n")
    print(f"{bid}: {len(changed)} registry files {'written' if write else 'to write (--write)'}")
    return 0


def main(argv: list[str]) -> int:
    args = [x for x in argv if not x.startswith("--")]
    if len(args) != 1 or set(argv) - {*args, "--write", "--register"}:
        raise SystemExit(__doc__)
    return (register if "--register" in argv else scaffold)(args[0], "--write" in argv)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
