#!/usr/bin/env python3
"""Assemble the krishnagiri-rivers Basin Atlas families: Krishnagiri district
(Hosur's district) as the frame, TN WRD sub-basin catchments clipped to it as
the sheds, and the named rivers that cross it.

Krishnagiri's configuration of the Tamil Nadu district basin engine
(scripts/lib/tn_district_basin.py). The district straddles two basins: the
Thenpennai (Ponnaiyar) with its Markandeya and Pambar tributaries drains the
Hosur, Krishnagiri and Bargur side to the east, and the Chinnar and Dodda Halla
drain the Anchetty and Denkanikottai side south to the Cauvery, which is the
district's south-western line. Nothing here is a polluted stretch on CPCB's
list, so there is no stretch step; the pollution record comes through the
station families and the river cards in the manifest.

Sources (fetched once, cached under .cache/krishnagiri-rivers/, gitignored):
  TNGIS admin_master:administrative_boundary_district   boundary (LGD 577)
  TNGIS generic_viewer:sub_basin                        sub-hydrosheds (clipped)
  OpenStreetMap waterway=river|canal (Overpass)         rivers
  TNGIS generic_viewer:reservoir / mines                reservoirs, quarries
  TNGIS generic_viewer:all_tanks                        tanks (named, centre points)
  TNGIS generic_viewer:all_water_bodies                 waterbodies-major, waterbodies-minor
  TNGIS generic_viewer:microwatersheds                  watersheds, sub-watersheds, mini-watersheds, micro-watersheds
  TNGIS tnrd:panchayat_boundary                         admin-gp
  NWIC National Water Data Portal (CKAN datastore)      groundwater-wells (CGWB + state telemetry 2026, CGWB manual 2021-2025)
  NWDP, CWC 'Canal Network' + 'Water Resource Project'   canals, command-areas (needs ogr2ogr once)
  TNPCB real-time water quality dashboard (JSON)         realtime-stations + readings/<station>.json (Kelavarapalli dam, site 10)
  TN-SMART (RIMES) reservoir dashboard                   reservoirs: today's storage for Kelavarapalli, Krishnagiri and Pambar
  NWDP, CWC river discharge + surface water quality      gauging-stations + readings/cwc-<station>.json (Gummanur)
  TNGIS admin_master taluks + generic_viewer:block_boundary  admin-taluk, admin-block, groundwater-taluks
  TNGIS generic_viewer:industry_cad_matched             industries, treatment-plants
  SIPCOT GIS industrial_complex_boundary-*              industrial-estates (Hosur phases, Shoolagiri, Bargur)

Inputs already in the repo:
  public/data/atlas/tn/krishnagiri/groundwater-taluks.json  groundwater-taluks (IN-GRES stage by taluk)
  pipeline-inputs/basins/krishnagiri-rivers/tnpcb-type-sectors.json  reviewed TNPCB type code -> sector lookup

Not served in this round, and why: CWC publishes no level series for the
district's dams, which are state dams, so no reservoir carries a chart; the
state dashboard's reading is a daily snapshot and is served as a current fact
only. The Thenpennai's NWMP stations are not yet placed.

Writes public/data/basins/krishnagiri-rivers/<family>.geojson and inventory.json
through nvdm_write.write_artifact so envelopes survive a re-run. Run
scripts/nvdm_envelope_krishnagiri_rivers.py after the first build to stamp envelopes.

Usage:
  python3 scripts/build_krishnagiri_rivers_basin.py          full build (every family)
  python3 scripts/build_krishnagiri_rivers_basin.py --live   weekly refresh of the living feeds only
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from lib.tn_district_basin import NWDP, DistrictBasinBuild  # noqa: E402

BASIN_ID = "krishnagiri-rivers"
GENERATED_FROM = Path(__file__).name
DISTRICT_LGD = "577"
DISTRICT_NAME = "Krishnagiri"
TNRD_DISTRICT_NAME = "Krishnagiri"  # as tnrd:panchayat_boundary prints district_name
NWDP_DISTRICT = "Krishnagiri"  # as the National Water Data Portal tags its stations
ATLAS_SLUG = "krishnagiri"  # public/data/atlas/tn/<slug>, the district Atlas this map links to

# SIPCOT GIS layer names, as the WFS lists them (mixed case is the server's own). The capabilities also list
# Hosur_Phase3, Shoolagiri_Hosur_Phase_IV and Bargur, but the server answers each with "database 'Bargur' does not
# exist" (checked 2026-09-18), so those three outlines cannot be read by anyone until SIPCOT repairs the store.
SIPCOT_PARKS = ("hosur_phase1", "hosur_phase2", "Shoolagiri_Future_Mobility_Park", "Shoolagiri_General_Engineering",
                "Bargur_DTA", "Bargur_SEZ", "Kurubarapalli2")
ESTATES_PROVENANCE = "SIPCOT GIS (sipcotgis.tn.gov.in): industrial complex outlines, Hosur phases I and II, Shoolagiri (Future Mobility Park, General Engineering), Bargur (DTA, SEZ) and Kurubarapalli; area as SIPCOT states it. Hosur phase III, Shoolagiri Hosur phase IV and the Bargur complex are listed by the server but it returns a database error for each (2026-09-18), so they are not drawn"
ESTATES_SOURCE_FILE = "cite:industrial_complex_boundary-*"
# CWC's national canal and command-area layers on NWDP (shapefile zips, Lambert conformal conic).
CWC_CANALS_FILE, CWC_COMMAND_FILE = "cwc-canals-krishnagiri.geojson", "cwc-command-krishnagiri.geojson"
CWC_LAYERS = {
    CWC_CANALS_FILE: (f"{NWDP}/dataset/dd11dfc1-6723-4603-9426-a03e4c8cf50c/resource/75e4b705-44b3-4b4a-a32f-060eeae7b907/download/canal_network.zip", "Canal_Network.shp"),
    CWC_COMMAND_FILE: (f"{NWDP}/dataset/a4fde712-4a1f-461b-897a-411ebb29a622/resource/19966957-ccfc-4341-ab11-ca72da5953f4/download/command_area.zip", "Command_Area.shp"),
}
CWC_CLIP = ("77.37", "12.04", "78.77", "12.99")  # the district extent plus a margin, lon/lat
CANAL_RIVERS = {}  # no canal is selectable like a river yet: CWC's lines here are read on the first build
CANAL_NAMES = {}
WATERWAYS_PROVENANCE = "Rivers: OpenStreetMap waterway courses (Overpass), clipped to the district plus 1.6 km so boundary rivers stay"
CANALS_PROVENANCE = "CWC canal network (National Water Data Portal, 2025), cut to the district"
# TNPCB's real-time water quality monitoring dashboard: the one station inside the district.
TNPCB_RT_SITES = (10,)  # Thenpennai at the Kelavarapalli dam
# CWC's gauging station on the Thenpennai (NWDP tags it Krishnagiri); the river is set here and checked against the mapped course.
CWC_STATIONS = {"GUMMANUR": "thenpennai"}
RESERVOIR_LEVELS = {}  # CWC's level resources carry none of the district's dams (state dams)
RESERVOIR_ALIASES = {}
# TN WRD register name -> the name the state's daily reservoir dashboard prints. Its full-capacity
# figures agree with the district's own agriculture page (KRP 52.0 ft, Pambar 19.6 ft), which is the
# check that these are the same dams. Shoolagiri Chinnar is not on the dashboard.
RESERVOIR_STORAGE = {"Kelavarapalli": "Kelavarapalli", "Krishnagiri": "Krishnagiri", "Pambar": "Pambar"}
SECTOR_LOOKUP = ROOT / "pipeline-inputs/basins/krishnagiri-rivers/tnpcb-type-sectors.json"
CETP_SCHEMES = None  # no common effluent treatment plant in the register; the one treatment unit is a sewage plant
REGISTER_YEARS = "2015 to 2024"
TNPCB_OFFICE = {"HSR": "DEE Hosur"}
# all_water_bodies prints the basin in water_body_name on NRSC rows; both basins here.
WB_NOT_A_NAME = {"", "none", "no", "cauvery", "pennaiyar"}
# TN WRD sub-basin name -> shed key. The Cauvery-basin pair keep the keys cauvery-tn uses
# (scripts/basin-sources/cauvery-tn.json); the Pennaiyar and Palar sub-basins take the WRD's own
# numbering under a basin prefix, since no Pennaiyar basin build exists yet.
SUB_BASIN_KEY = {
    "Chinnar": "115", "Dodda Halla": "117",
    "Chinnar - West": "P01", "Chinnar - East": "P02", "Markandanadhi": "P03", "Kambainallur": "P04", "Pambar": "P05",
    "Vaniyar": "P06", "Matturar": "P07", "Upto Krishnagiri Reservoir": "P16", "Krishnagiri To Pambar": "P17",
    "Pambar To Thirukovilur": "P18", "Upper Palar": "PL01",
}
# OSM spellings folded to one trunk river each: the Thenpennai is mapped under four names between the
# Karnataka line and Krishnagiri; the Cauvery-basin Chinnar is the only OSM river named Chinnar here.
RIVER_ALIASES = {
    "thenpennai": ("ponnaiyar", "thenpennai", "then pennai", "dakshina pinakini", "pennaiyar", "south pennar"),
    "cauvery": ("kaveri", "cauvery"),
    "chinnar": ("chinnar",),
    "markandeya": ("markandeya", "markandanadhi"),
    "pambar": ("pambar",),
    "dodda-halla": ("dodda halla", "podda halla"),
}
RIVER_NAMES = {"thenpennai": "Thenpennai (Ponnaiyar)", "cauvery": "Cauvery", "chinnar": "Chinnar", "markandeya": "Markandeya", "pambar": "Pambar", "dodda-halla": "Dodda Halla"}
REPO_FAMILIES = ()

# Build order: the inventory lists families in this order.
STEPS = ("waterways", "reservoirs", "tanks", "industries", "estates", "quarries", "admin", "panchayats", "waterbodies",
         "watersheds", "groundwater-wells", "canals", "realtime-stations", "gauging-stations")


if __name__ == "__main__":
    raise SystemExit(DistrictBasinBuild(sys.modules[__name__]).main(sys.argv[1:]))
