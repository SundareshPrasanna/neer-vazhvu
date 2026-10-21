#!/usr/bin/env python3
"""Assemble the tiruppur-rivers Basin Atlas families: Tiruppur district as the frame, TN WRD
sub-basin catchments clipped to it as the sheds, and the named rivers that cross it.

Tiruppur's configuration of the Tamil Nadu district basin engine
(scripts/lib/tn_district_basin.py), scaffolded by scripts/new_district_basin.py on 2026-10-21.
Tiruppur lies in the Cauvery basin: the Amaravathi sub-basin covers the south and east, with the Amaravathi
reservoir and its Chinnar and Aliyar-side tributaries, and the Noyyal sub-basin the north, where the Noyyal
crosses Tiruppur city past the Orathupalayam dam. A strip of the Parambikulam-Aliyar (PAP) basin, with the
Thirumurthi reservoir, lies on the south-western edge.

Sources (fetched once, cached under .cache/tiruppur-rivers/, gitignored):
  TNGIS admin_master:administrative_boundary_district   boundary (LGD 634)
  TNGIS generic_viewer:sub_basin                        sub-hydrosheds (clipped)
  OpenStreetMap waterway=river|canal (Overpass)         rivers
  TNGIS generic_viewer:reservoir / mines                reservoirs, quarries
  TNGIS generic_viewer:all_tanks                        tanks (named, centre points)
  TNGIS generic_viewer:all_water_bodies                 waterbodies-major, waterbodies-minor
  TNGIS generic_viewer:microwatersheds                  watersheds, sub-watersheds, mini-watersheds, micro-watersheds
  TNGIS tnrd:panchayat_boundary                         admin-gp
  NWIC National Water Data Portal (CKAN datastore)      groundwater-wells (CGWB + state telemetry 2026, CGWB manual 2021-2025)
  NWDP, CWC 'Canal Network' + 'Water Resource Project'  canals, command-areas (needs ogr2ogr once)
  TNPCB real-time water quality dashboard (JSON)        realtime-stations + readings/<station>.json
  TN-SMART (RIMES) reservoir dashboard                  reservoirs: today's storage for Amaravathi, Nallathangal Odai, Noyyal Orathupalayam, Thirumurthi
  TNGIS admin_master taluks + generic_viewer:block_boundary  admin-taluk, admin-block, groundwater-taluks
  TNGIS generic_viewer:industry_cad_matched             industries, treatment-plants

Inputs already in the repo:
  public/data/atlas/tn/tiruppur/groundwater-taluks.json  groundwater-taluks (IN-GRES stage by taluk)
  pipeline-inputs/basins/tn-tnpcb-type-sectors.json  reviewed TNPCB type code -> sector lookup (statewide)

Writes public/data/basins/tiruppur-rivers/<family>.geojson and inventory.json
through nvdm_write.write_artifact so envelopes survive a re-run. After the first build, run
scripts/nvdm_envelope_district_basin.py scripts/build_tiruppur_rivers_basin.py to stamp envelopes, then
scripts/new_district_basin.py tiruppur --register --write to list the files in the source registry.

Usage:
  python3 scripts/build_tiruppur_rivers_basin.py          full build (every family)
  python3 scripts/build_tiruppur_rivers_basin.py --live   weekly refresh of the living feeds only
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from lib.tn_district_basin import NWDP, TN_ENVELOPE_READINGS, TN_ENVELOPE_SOURCES, TNGIS, TNSMART, DistrictBasinBuild, tn_envelope  # noqa: E402

BASIN_ID = "tiruppur-rivers"
GENERATED_FROM = Path(__file__).name
DISTRICT_LGD = "634"
DISTRICT_NAME = "Tiruppur"
TNRD_DISTRICT_NAME = "Tiruppur"  # as tnrd:panchayat_boundary prints district_name
NWDP_DISTRICT = "Tiruppur"  # as the National Water Data Portal tags its stations
ATLAS_SLUG = "tiruppur"  # public/data/atlas/tn/<slug>, the district Atlas this map links to

# CWC's national canal and command-area layers on NWDP (shapefile zips, Lambert conformal conic).
CWC_CANALS_FILE, CWC_COMMAND_FILE = "cwc-canals-tiruppur.geojson", "cwc-command-tiruppur.geojson"
CWC_LAYERS = {
    CWC_CANALS_FILE: (f"{NWDP}/dataset/dd11dfc1-6723-4603-9426-a03e4c8cf50c/resource/75e4b705-44b3-4b4a-a32f-060eeae7b907/download/canal_network.zip", "Canal_Network.shp"),
    CWC_COMMAND_FILE: (f"{NWDP}/dataset/a4fde712-4a1f-461b-897a-411ebb29a622/resource/19966957-ccfc-4341-ab11-ca72da5953f4/download/command_area.zip", "Command_Area.shp"),
}
CWC_CLIP = ("76.94", "10.13", "77.99", "11.45")  # the district extent plus a margin, lon/lat
CANAL_RIVERS = {}  # none selectable like a river yet
CANAL_NAMES = {}
WATERWAYS_PROVENANCE = "Rivers: OpenStreetMap waterway courses (Overpass), clipped to the district plus 1.6 km so boundary rivers stay"
CANALS_PROVENANCE = "CWC canal network (National Water Data Portal, 2025), cut to the district"
# TNPCB's real-time water quality monitoring dashboard: the stations inside the district.
TNPCB_RT_SITES = (7, 8)  # Noyyal - Mangalam Village Reach/Upstream; Noyyal - Kasipalayam Bridge
RESERVOIR_LEVELS = {}  # register name -> (CWC station, key, display name), where CWC_LEVEL_RESOURCES carries the dam
RESERVOIR_ALIASES = {}
# TN WRD register name -> the name the state's daily reservoir dashboard prints, where the two plainly match, or by position
# where the names differ (Uppar sits 1.0 km from the register's Uppar(Erode), Vattamalaikarai 0.5 km from Vattamalaikarai Odai; the next reservoir is 7 km or more away).
RESERVOIR_STORAGE = {"Amaravathi": "Amaravathi", "Nallathangal Odai": "Nallathangal Odai", "Noyyal Orathupalayam": "Noyyal Orathupalayam", "Thirumurthi": "Thirumurthi",
                     "Uppar(Erode)": "Uppar", "Vattamalaikarai Odai": "Vattamalaikarai"}
SECTOR_LOOKUP = ROOT / "pipeline-inputs/basins/tn-tnpcb-type-sectors.json"
CETP_SCHEMES = ROOT / "pipeline-inputs/basins/tiruppur-rivers/cetp-schemes.json"  # the 18 textile CETPs (TNPCB 2020 list, the state's June 2026 report); 14 on the register
REGISTER_YEARS = "2015 to 2024"
TNPCB_OFFICE = {"TPN": "DEE Tiruppur North", "TPS": "DEE Tiruppur South"}  # the register's office codes (TNPCB's DEE offices, as the OCMMS office list names them); CBS (one unit) is not on that list and keeps its code
SUB_BASIN_KEY = {}  # sheds keep TNGIS's object_id keys (SB<object_id>), listed in the manifest
TALUK_ALIASES = {}  # TNGIS taluk -> IN-GRES locationName; every taluk matches by name
# OSM's 'Nallar' near Thirumurthi is a different stream (Palar sub-basin, Parambikulam Aliyar basin): only 'Nallaru' is this one.
RIVER_ALIASES = {"amaravathi": ("amaravathi", "amaravati"), "noyyal": ("noyyal",), "nallar": ("nallaru",), "chinnar": ("chinnar",), "aliyar": ("aliyar",), "kousika": ("kousika", "kowsika"),
                 "nallathangal": ("nallathangal",)}  # OSM spellings folded to one river each (substring match, first hit wins)
RIVER_NAMES = {"amaravathi": "Amaravathi", "noyyal": "Noyyal", "nallar": "Nallar", "chinnar": "Chinnar", "aliyar": "Aliyar", "kousika": "Kousika", "nallathangal": "Nallathangal Odai"}  # river_id -> display name
# OSM way 203611432, unnamed, is the Amaravathi from Karatholuvu to Kongur: it joins 'Amaravathi River' above and 'Amaravathi' below.
OSM_WAY_RIVERS = {203611432: "amaravathi"}
REPO_FAMILIES = ()
# TNPCB's CEPI plan (January 2020), p.6: the core zone's eight boundary points C-1 to C-8, decimal degrees as printed, joined in printed order.
CEPI = {
    "points": [
        (11.118722, 77.402567, "C-1 East, M/s.Eastern CETP"), (11.115283, 77.402833, "C-2 South East, M/s.Colourlines Eastern CETP member unit"),
        (11.09585, 77.33406, "C-3 South, Palakudon Bus stop, Karuvampalayam"), (11.104586, 77.288778, "C-4 South West, Sulthanpettai"),
        (11.107708, 77.288656, "C-5 West, M/s.Mangalam CETP"), (11.112337, 77.288729, "C-6 North West, Mangalam scatting ground"),
        (11.104276, 77.334542, "C-7 North, Saradhanagar"), (11.124988, 77.402511, "C-8 North East, M/s.Kasipalayam CETP"),
    ],
    "name": "Tiruppur CEPI core zone, on the banks of the Noyyal", "statedKm2": 12,
    "facts": {
        "latestScore": "25.214 on TNPCB's post-monsoon 2025 evaluation (TNPCB score sheet, signed 23 June 2026)",
        "cepiScore": "72.39 (Air 33, Water 65, Land 64), CPCB's 2017-18 assessment as the plan prints it: a Critically Polluted Area (plan, p.10)",
        "earlierScore": "68.38 in CPCB's 2009 assessment (Comprehensive Environmental Assessment of Industrial Clusters, p.27)",
        "unitsInThePlan": "149 red and 6 orange category industries in the core zone, among them 7 CETPs and their 81 member units (plan, p.9)",
        "source": "TNPCB, Evaluation of CEPI score and action plan for CEPI area of Tiruppur, January 2020 (TNPCB and CPCB websites)",
    },
    "provenance": "TNPCB, Evaluation of CEPI score and action plan for CEPI area of Tiruppur (January 2020), p.6: the core zone's eight boundary points C-1 to C-8, joined in printed order",
    "sourceFile": "CEPI_TprRpt4920.pdf",
}

# Build order: the inventory lists families in this order.
STEPS = ("waterways", "reservoirs", "tanks", "industries", "quarries", "admin", "panchayats", "waterbodies", "watersheds", "groundwater-wells",
         "canals", "cepi", "realtime-stations")

# Envelopes (scripts/nvdm_envelope_district_basin.py): the shared TN families.
ENVELOPE_SOURCES = {
    **TN_ENVELOPE_SOURCES,
    "tngis": ("tngis-open-geoserver", "TNGIS open GeoServer (WFS): district, taluk, block and village panchayat boundaries, TN WRD sub-basins and reservoirs, micro-watershed atlas, all-water-bodies and all-tanks registers, mine leases, industry register matched to land parcels",
              "Tamil Nadu e-Governance Agency (TNGIS)", {"url": TNGIS}),
    "osm": ("osm-overpass", "OpenStreetMap (Overpass API extract: named river courses)", "OpenStreetMap contributors", {}),
}
ENVELOPE_ARTIFACTS, ENVELOPE_INPUTS, ENVELOPE_NOTE = tn_envelope(BASIN_ID, ATLAS_SLUG, (
    "Tiruppur district's rivers, groundwater and industry (scope tiruppur-rivers; the district's own scope id is tn-tiruppur). "
    "The district boundary is the frame and TN WRD's sub-basins, clipped to it, are the catchments (shedId)."))
ENVELOPE_NOTE = ENVELOPE_NOTE.replace(f"basins/{BASIN_ID}/tnpcb-type-sectors.json", "basins/tn-tnpcb-type-sectors.json")  # SECTOR_LOOKUP is statewide
for _family in ("industrial-estates", "gauging-stations"):  # nothing to serve here (probe 2026-10-21)
    del ENVELOPE_ARTIFACTS[_family]
    ENVELOPE_INPUTS.pop(_family, None)
ENVELOPE_ARTIFACTS["inventory"] = [s for s in ENVELOPE_ARTIFACTS["inventory"] if s not in ("sipcot", "cwc-river")]
if RESERVOIR_STORAGE:
    ENVELOPE_SOURCES["tnsmart"] = ("tnsmart-rimes-reservoirs", "Tamil Nadu reservoir dashboard (TN-SMART): the day's storage, depth and percentage of capacity per reservoir",
                                   "RIMES, relaying Tamil Nadu's daily reservoir storage", {"url": TNSMART})
    ENVELOPE_ARTIFACTS["reservoirs"] = ["tngis", "tnsmart"] + (["cwc-river"] if RESERVOIR_LEVELS else [])
    ENVELOPE_ARTIFACTS["inventory"] += ["tnsmart"]
# The CETP record and the CEPI plan: one-time documents (closed + dated), and the state's progress reports to NMCG.
ENVELOPE_SOURCES.update({
    "mpr": ("nmcg-ngt-mpr-listing", "Tamil Nadu monthly progress reports to NMCG under NGT O.A. 673/2018 (June 2026 edition)", "Government of Tamil Nadu, via the National Mission for Clean Ganga",
            {"url": "https://nmcg.nic.in/ngtprogressreport.aspx", "as_of": "2026-06"}),
    "tnpcb-cetp-lists": {"title": "Details of Common Effluent Treatment Plants pertaining to the Clusters of Textile Industries in Tamil Nadu (2020), tnpcb.gov.in/cept.php",
                         "publisher": "Tamil Nadu Pollution Control Board", "license": "government register, cited with attribution", "closed": True, "as_of": "2020", "role": "input"},
    "cepi-plan": {"title": "Evaluation of CEPI score and action plan for CEPI area of Tiruppur (January 2020), p.6, with TNPCB's CEPI score sheets to 2026",
                  "publisher": "Tamil Nadu Pollution Control Board, also published by the Central Pollution Control Board", "license": "government plan document, cited with attribution",
                  "closed": True, "as_of": "2026-06", "role": "input"},
})
ENVELOPE_ARTIFACTS.update({"treatment-plants": ["tngis", "tnpcb-cetp-lists", "mpr"], "cepi-area": ["cepi-plan", "tngis"]})
ENVELOPE_INPUTS.update({"cepi-area": [f"public/data/basins/{BASIN_ID}/sub-hydrosheds.geojson"]})
ENVELOPE_READINGS = TN_ENVELOPE_READINGS


if __name__ == "__main__":
    raise SystemExit(DistrictBasinBuild(sys.modules[__name__]).main(sys.argv[1:]))
