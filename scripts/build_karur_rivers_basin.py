#!/usr/bin/env python3
"""Assemble the karur-rivers Basin Atlas families: Karur district as the frame, TN WRD
sub-basin catchments clipped to it as the sheds, and the named rivers that cross it.

Karur's configuration of the Tamil Nadu district basin engine
(scripts/lib/tn_district_basin.py), scaffolded by scripts/new_district_basin.py on 2026-10-21.
Karur lies in the Cauvery basin. The Amaravathi sub-basin covers the south and west and the river joins
the Cauvery in the district; Pungar (upper Coleroon) covers the north-east, the Noyyal enters from Tiruppur
in the north-west, and the Ponnaniyar sub-basin takes the south-eastern edge. The Cauvery runs along the
northern side.

Sources (fetched once, cached under .cache/karur-rivers/, gitignored):
  TNGIS admin_master:administrative_boundary_district   boundary (LGD 576)
  TNGIS generic_viewer:sub_basin                        sub-hydrosheds (clipped)
  OpenStreetMap waterway=river|canal (Overpass)         rivers
  TNGIS generic_viewer:reservoir / mines                reservoirs, quarries
  TNGIS generic_viewer:all_tanks                        tanks (named, centre points)
  TNGIS generic_viewer:all_water_bodies                 waterbodies-major, waterbodies-minor
  TNGIS generic_viewer:microwatersheds                  watersheds, sub-watersheds, mini-watersheds, micro-watersheds
  TNGIS tnrd:panchayat_boundary                         admin-gp
  NWIC National Water Data Portal (CKAN datastore)      groundwater-wells (CGWB + state telemetry 2026, CGWB manual 2021-2025)
  NWDP, CWC 'Canal Network' + 'Water Resource Project'  canals, command-areas (needs ogr2ogr once)
  TN-SMART (RIMES) reservoir dashboard                  reservoirs: today's storage for Noyyal Athupalayam
  NWDP, CWC river discharge + surface water quality     gauging-stations + readings/cwc-<station>.json
  TNGIS admin_master taluks + generic_viewer:block_boundary  admin-taluk, admin-block, groundwater-taluks
  TNGIS generic_viewer:industry_cad_matched             industries, treatment-plants

Inputs already in the repo:
  public/data/atlas/tn/karur/groundwater-taluks.json  groundwater-taluks (IN-GRES stage by taluk)
  pipeline-inputs/basins/tn-tnpcb-type-sectors.json  reviewed TNPCB type code -> sector lookup (statewide)

Writes public/data/basins/karur-rivers/<family>.geojson and inventory.json
through nvdm_write.write_artifact so envelopes survive a re-run. After the first build, run
scripts/nvdm_envelope_district_basin.py scripts/build_karur_rivers_basin.py to stamp envelopes, then
scripts/new_district_basin.py karur --register --write to list the files in the source registry.

Usage:
  python3 scripts/build_karur_rivers_basin.py          full build (every family)
  python3 scripts/build_karur_rivers_basin.py --live   weekly refresh of the living feeds only
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from lib.tn_district_basin import CAUVERY_PRS_2018, CAUVERY_PRS_2025, DistrictBasinBuild, NWDP, TNGIS, TNSMART, TN_ENVELOPE_READINGS, TN_ENVELOPE_SOURCES, tn_envelope  # noqa: E402

BASIN_ID = "karur-rivers"
GENERATED_FROM = Path(__file__).name
DISTRICT_LGD = "576"
DISTRICT_NAME = "Karur"
TNRD_DISTRICT_NAME = "Karur"  # as tnrd:panchayat_boundary prints district_name
NWDP_DISTRICT = "Karur"  # as the National Water Data Portal tags its stations
ATLAS_SLUG = "karur"  # public/data/atlas/tn/<slug>, the district Atlas this map links to

# CWC's national canal and command-area layers on NWDP (shapefile zips, Lambert conformal conic).
CWC_CANALS_FILE, CWC_COMMAND_FILE = "cwc-canals-karur.geojson", "cwc-command-karur.geojson"
CWC_LAYERS = {
    CWC_CANALS_FILE: (f"{NWDP}/dataset/dd11dfc1-6723-4603-9426-a03e4c8cf50c/resource/75e4b705-44b3-4b4a-a32f-060eeae7b907/download/canal_network.zip", "Canal_Network.shp"),
    CWC_COMMAND_FILE: (f"{NWDP}/dataset/a4fde712-4a1f-461b-897a-411ebb29a622/resource/19966957-ccfc-4341-ab11-ca72da5953f4/download/command_area.zip", "Command_Area.shp"),
}
CWC_CLIP = ("77.65", "10.45", "78.69", "11.20")  # the district extent plus a margin, lon/lat
CANAL_RIVERS = {"new-kattalai-canal": "New kattalai high level canal"}  # river_id -> the CWC canal line (can_name) a reader can select like a river
CANAL_NAMES = {"new-kattalai-canal": "New Kattalai High Level Canal"}
WATERWAYS_PROVENANCE = "Rivers: OpenStreetMap waterway courses (Overpass), clipped to the district plus 1.6 km so boundary rivers stay"
CANALS_PROVENANCE = "CWC canal network (National Water Data Portal, 2025), cut to the district; lines CWC files under the Kalingarayan Anicut System, an Erode canal system, are left out until a source names them"
# CWC files unnamed lines here under Erode's Kalingarayan system (Erode leaves out the same lines as lying outside it).
CANAL_DROP = lambda p: p["prj_name"] == "Kalingarayan Anicut System"  # noqa: E731
# CWC's gauging stations NWDP tags Karur (the portal's River column, daily rows): Nallamaranpatty (Cauvery, 15,356)
CWC_STATIONS = {"NALLAMARANPATTY": "amaravathi"}  # CWC gauges (NWDP tags them with the district); the river is checked against the mapped course
RESERVOIR_LEVELS = {}  # register name -> (CWC station, key, display name), where CWC_LEVEL_RESOURCES carries the dam
RESERVOIR_ALIASES = {}
# TN WRD register name -> the name the state's daily reservoir dashboard prints, where the two plainly match.
RESERVOIR_STORAGE = {"Noyyal Athupalayam": "Noyyal Athupalayam"}  # register name -> TN-SMART name; Ponnaniyar left out: the dashboard's 'Ponnaiyar' point lies 1.4 km outside the register waterspread and no capacity figure confirms the identity (checked 2026-10-21)
SECTOR_LOOKUP = ROOT / "pipeline-inputs/basins/tn-tnpcb-type-sectors.json"
CETP_SCHEMES = None
REGISTER_YEARS = "2015 to 2024"
TNPCB_OFFICE = {"KAR": "DEE Karur"}  # the register's office codes (TNPCB's DEE offices)
SUB_BASIN_KEY = {}  # sheds keep TNGIS's object_id keys (SB<object_id>), listed in the manifest
TALUK_ALIASES = {}  # TNGIS taluk -> IN-GRES locationName; every taluk matches by name
RIVER_ALIASES = {"amaravathi": ("amaravathi", "amaravati"), "cauvery": ("kaveri", "cauvery"), "kudaganar": ("kudakanar", "kudaganar"), "noyyal": ("noyyal",), "nanganji": ("nanganji",)}  # OSM spellings folded to one river each (substring match, first hit wins)
RIVER_NAMES = {"amaravathi": "Amaravathi", "cauvery": "Cauvery", "kudaganar": "Kudaganar", "noyyal": "Noyyal", "nanganji": "Nanganji"}  # river_id -> display name
REPO_FAMILIES = (
    ("monitoring-points", "public/data/basins/cauvery-tn/wq-stations.geojson", "near", "TNPCB stretch-wise monthly water-quality reports, January to December 2023 (the last year published); classes are the worst monthly use-based class of 2023; station points are town centres, as ingested for the Cauvery (Tamil Nadu) basin", "cauvery-tn/wq-stations.geojson"),
)

# Build order: the inventory lists families in this order.
# CPCB's Cauvery stretch: both editions run along this district (the 2025 one is trimmed where it starts, at station 1320).
PRS_EDITIONS = (CAUVERY_PRS_2018, CAUVERY_PRS_2025)
PRS_OUTFALLS = ()  # (name, lat, lon, river_id, page, the plan's description), from TNPCB's 2019 Cauvery action plan

STEPS = ("waterways", "cauvery-prs", "repo-families", "reservoirs", "tanks", "industries", "quarries", "admin", "panchayats", "waterbodies", "watersheds", "groundwater-wells",
         "canals", "gauging-stations")

# Envelopes (scripts/nvdm_envelope_district_basin.py): the shared TN families.
ENVELOPE_SOURCES = {
    **TN_ENVELOPE_SOURCES,
    "tngis": ("tngis-open-geoserver", "TNGIS open GeoServer (WFS): district, taluk, block and village panchayat boundaries, TN WRD sub-basins and reservoirs, micro-watershed atlas, all-water-bodies and all-tanks registers, mine leases, industry register matched to land parcels",
              "Tamil Nadu e-Governance Agency (TNGIS)", {"url": TNGIS}),
    "osm": ("osm-overpass", "OpenStreetMap (Overpass API extract: named river courses)", "OpenStreetMap contributors", {}),
    "cwc-river": ("nwic-nwdp-cwc-river-data", "CWC river discharge (manual daily) and surface water quality for Tamil Nadu, National Water Data Portal",
                  "Central Water Commission, via the National Water Informatics Centre (NWIC)", {"url": f"{NWDP}/"}),
}
ENVELOPE_ARTIFACTS, ENVELOPE_INPUTS, ENVELOPE_NOTE = tn_envelope(BASIN_ID, ATLAS_SLUG, (
    "Karur district's rivers, groundwater and industry (scope karur-rivers; the district's own scope id is tn-karur). "
    "The district boundary is the frame and TN WRD's sub-basins, clipped to it, are the catchments (shedId)."))
ENVELOPE_NOTE = ENVELOPE_NOTE.replace(f"basins/{BASIN_ID}/tnpcb-type-sectors.json", "basins/tn-tnpcb-type-sectors.json")  # SECTOR_LOOKUP is statewide
for _family in ("industrial-estates", "realtime-stations"):  # nothing to serve here (probe 2026-10-21)
    del ENVELOPE_ARTIFACTS[_family]
    ENVELOPE_INPUTS.pop(_family, None)
ENVELOPE_ARTIFACTS["inventory"] = [s for s in ENVELOPE_ARTIFACTS["inventory"] if s not in ("sipcot", "tnpcb-rt")]
if RESERVOIR_STORAGE:
    ENVELOPE_SOURCES["tnsmart"] = ("tnsmart-rimes-reservoirs", "Tamil Nadu reservoir dashboard (TN-SMART): the day's storage, depth and percentage of capacity per reservoir",
                                   "RIMES, relaying Tamil Nadu's daily reservoir storage", {"url": TNSMART})
    ENVELOPE_ARTIFACTS["reservoirs"] = ["tngis", "tnsmart"]
    ENVELOPE_ARTIFACTS["inventory"] += ["tnsmart"]
# The shared Cauvery stretch, TNPCB's 2023 stations.
ENVELOPE_SOURCES.update({
    "cpcb-prs": ("cpcb-prs-report", "CPCB, Polluted River Stretches for Restoration of Water Quality, 2018 and October 2025 (updated version)", "Central Pollution Control Board",
                 {"url": "https://cpcb.gov.in/polluted-river-stretches/", "as_of": "2025-10"}),
    "tnpcb-wq": ("tnpcb-prs-cauvery", "TNPCB stretch-wise monthly water-quality reports, January to December 2023 (the last year published)", "Tamil Nadu Pollution Control Board",
                 {"url": "https://tnpcb.gov.in/pollutedriverstretches.php", "as_of": "2023-12"}),
})
_SHEDS, _RIVERS = (f"public/data/basins/{BASIN_ID}/{f}.geojson" for f in ("sub-hydrosheds", "rivers"))
ENVELOPE_ARTIFACTS.update({"rivers": ["osm", "cwc-canals", "tngis"], "prs": ["cpcb-prs", "osm", "tngis"], "monitoring-points": ["tnpcb-wq", "osm", "tngis"]})
ENVELOPE_INPUTS.update({"prs": [_RIVERS], "monitoring-points": ["public/data/basins/cauvery-tn/wq-stations.geojson", _SHEDS]})
ENVELOPE_ARTIFACTS["inventory"] += ["cpcb-prs", "tnpcb-wq"]
ENVELOPE_READINGS = TN_ENVELOPE_READINGS


if __name__ == "__main__":
    raise SystemExit(DistrictBasinBuild(sys.modules[__name__]).main(sys.argv[1:]))
