#!/usr/bin/env python3
"""Assemble the dindigul-rivers Basin Atlas families: Dindigul district as the frame, TN WRD
sub-basin catchments clipped to it as the sheds, and the named rivers that cross it.

Dindigul's configuration of the Tamil Nadu district basin engine
(scripts/lib/tn_district_basin.py), scaffolded by scripts/new_district_basin.py on 2026-10-21.
Dindigul straddles two basins. The north and west drain to the Cauvery through the Amaravathi sub-basin: the
Kudaganar, Nanganji, Nallathangal Odai, Shanmuganadi, Palar and Porunthalar and Varadhamanadhi. The south and
east drain to the Vaigai through the Manjalar, Marudhanadhi, Varahanadhi and Sirumalaiyar sub-basins, and the
Vaigai itself runs along part of the southern line.

Sources (fetched once, cached under .cache/dindigul-rivers/, gitignored):
  TNGIS admin_master:administrative_boundary_district   boundary (LGD 572)
  TNGIS generic_viewer:sub_basin                        sub-hydrosheds (clipped)
  OpenStreetMap waterway=river|canal (Overpass)         rivers
  TNGIS generic_viewer:reservoir / mines                reservoirs, quarries
  TNGIS generic_viewer:all_tanks                        tanks (named, centre points)
  TNGIS generic_viewer:all_water_bodies                 waterbodies-major, waterbodies-minor
  TNGIS generic_viewer:microwatersheds                  watersheds, sub-watersheds, mini-watersheds, micro-watersheds
  TNGIS tnrd:panchayat_boundary                         admin-gp
  NWIC National Water Data Portal (CKAN datastore)      groundwater-wells (CGWB + state telemetry 2026, CGWB manual 2021-2025)
  NWDP, CWC 'Canal Network' + 'Water Resource Project'  canals, command-areas (needs ogr2ogr once)
  TN-SMART (RIMES) reservoir dashboard                  reservoirs: today's storage for Kodaganar, Kuthiraiyar, Manjalar, Marudhanadhi, Nanganjiar, Parappalar, Sothuparai, Varadhamanadhi
  NWDP, CWC river discharge + surface water quality     gauging-stations + readings/cwc-<station>.json
  TNGIS admin_master taluks + generic_viewer:block_boundary  admin-taluk, admin-block, groundwater-taluks
  TNGIS generic_viewer:industry_cad_matched             industries, treatment-plants
  SIPCOT GIS industrial_complex_boundary-*              industrial-estates

Inputs already in the repo:
  public/data/atlas/tn/dindigul/groundwater-taluks.json  groundwater-taluks (IN-GRES stage by taluk)
  pipeline-inputs/basins/tn-tnpcb-type-sectors.json  reviewed TNPCB type code -> sector lookup (statewide)

Writes public/data/basins/dindigul-rivers/<family>.geojson and inventory.json
through nvdm_write.write_artifact so envelopes survive a re-run. After the first build, run
scripts/nvdm_envelope_district_basin.py scripts/build_dindigul_rivers_basin.py to stamp envelopes, then
scripts/new_district_basin.py dindigul --register --write to list the files in the source registry.

Usage:
  python3 scripts/build_dindigul_rivers_basin.py          full build (every family)
  python3 scripts/build_dindigul_rivers_basin.py --live   weekly refresh of the living feeds only
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from lib.tn_district_basin import NWDP, TN_ENVELOPE_READINGS, TN_ENVELOPE_SOURCES, TNGIS, TNSMART, DistrictBasinBuild, tn_envelope  # noqa: E402

BASIN_ID = "dindigul-rivers"
GENERATED_FROM = Path(__file__).name
DISTRICT_LGD = "572"
DISTRICT_NAME = "Dindigul"
TNRD_DISTRICT_NAME = "Dindigul"  # as tnrd:panchayat_boundary prints district_name
NWDP_DISTRICT = "Dindigul"  # as the National Water Data Portal tags its stations
ATLAS_SLUG = "dindigul"  # public/data/atlas/tn/<slug>, the district Atlas this map links to

SIPCOT_PARKS = ("Nilakottai",)  # SIPCOT GIS layers whose extent centres in the district (probe 2026-10-21); left out: Vilpatty (tourism plot); Vilpatty_LargeTourism (tourism plot)
ESTATES_PROVENANCE = "SIPCOT GIS (sipcotgis.tn.gov.in): industrial complex outlines, Nilakottai; area as SIPCOT states it"
ESTATES_SOURCE_FILE = "cite:industrial_complex_boundary-*"
# CWC's national canal and command-area layers on NWDP (shapefile zips, Lambert conformal conic).
CWC_CANALS_FILE, CWC_COMMAND_FILE = "cwc-canals-dindigul.geojson", "cwc-command-dindigul.geojson"
CWC_LAYERS = {
    CWC_CANALS_FILE: (f"{NWDP}/dataset/dd11dfc1-6723-4603-9426-a03e4c8cf50c/resource/75e4b705-44b3-4b4a-a32f-060eeae7b907/download/canal_network.zip", "Canal_Network.shp"),
    CWC_COMMAND_FILE: (f"{NWDP}/dataset/a4fde712-4a1f-461b-897a-411ebb29a622/resource/19966957-ccfc-4341-ab11-ca72da5953f4/download/command_area.zip", "Command_Area.shp"),
}
CWC_CLIP = ("77.17", "9.92", "78.44", "10.94")  # the district extent plus a margin, lon/lat
CANAL_RIVERS = {}  # none selectable like a river yet
CANAL_NAMES = {}
WATERWAYS_PROVENANCE = "Rivers: OpenStreetMap waterway courses (Overpass), clipped to the district plus 1.6 km so boundary rivers stay"
CANALS_PROVENANCE = "CWC canal network (National Water Data Portal, 2025), cut to the district"
# CWC's gauging stations NWDP tags Dindigul (the portal's River column, daily rows): Balasamudram (Cauvery, 804); Kodaganar Dam (Cauvery, 31); Lakshmananpatti (Cauvery, 744); Sanarpatti (Cauvery, 1)
CWC_STATIONS = {"BALASAMUDRAM": "varadhamanadhi", "LAKSHMANANPATTI": "kudaganar"}  # CWC gauges (NWDP tags them with the district); Sanarpatti (one reading) and the Kodaganar dam level site are not flow gauges
RESERVOIR_LEVELS = {"Kodaganar": ("KODAGANAR DAM", "kodaganar", "Kodaganar")}  # CWC's daily level series for the dam (Cauvery manual-hourly resources)
RESERVOIR_ALIASES = {}
# TN WRD register name -> the name the state's daily reservoir dashboard prints, where the two plainly match, or by position
# where the names differ (Palar Perunthalar sits 0.7 km from the register's Palar Poranthalar, Sirumalaiyar 1.3 km from Sirumalaiyardam;
# the next reservoir is 7 km or more away). The dashboard's Nallathangal Odai is served on Tiruppur's map, where its outline lies.
RESERVOIR_STORAGE = {"Kodaganar": "Kodaganar", "Kuthiraiyar": "Kuthiraiyar", "Manjalar": "Manjalar", "Marudhanadhi": "Marudhanadhi", "Nanganjiar": "Nanganjiar", "Parappalar": "Parappalar", "Sothuparai": "Sothuparai", "Varadhamanadhi": "Varadhamanadhi",
                     "Palar Poranthalar": "Palar Perunthalar", "Sirumalaiyardam": "Sirumalaiyar"}
SECTOR_LOOKUP = ROOT / "pipeline-inputs/basins/tn-tnpcb-type-sectors.json"
CETP_SCHEMES = None
REGISTER_YEARS = "2015 to 2024"
TNPCB_OFFICE = {"DGL": "DEE Dindigul"}  # the register's office codes (TNPCB's DEE offices, as the OCMMS office list names them)
SUB_BASIN_KEY = {}  # sheds keep TNGIS's object_id keys (SB<object_id>), listed in the manifest
TALUK_ALIASES = {}  # TNGIS taluk -> IN-GRES locationName; every taluk matches by name
RIVER_ALIASES = {"kudaganar": ("kudakanar", "kudaganar", "kodaganar"), "nanganji": ("nanganji",), "amaravathi": ("amaravathi",), "shanmuganadi": ("shanmuganadi", "shanmuga nadi"), "nallathangal": ("nallathangal",), "porunthalar": ("porunthalar",), "palar": ("palar",), "varadhamanadhi": ("varadhamanadhi",), "manjalar": ("manjalar",), "marudhanadhi": ("marudhanadhi",), "varahanadhi": ("varaha nadhi", "varahanadhi"), "vaigai": ("vaigai",)}  # OSM spellings folded to one river each (substring match, first hit wins)
RIVER_NAMES = {"kudaganar": "Kudaganar", "nanganji": "Nanganji", "amaravathi": "Amaravathi", "shanmuganadi": "Shanmuganadi", "nallathangal": "Nallathangal Odai", "porunthalar": "Porunthalar", "palar": "Palar", "varadhamanadhi": "Varadhamanadhi", "manjalar": "Manjalar", "marudhanadhi": "Marudhanadhi", "varahanadhi": "Varahanadhi", "vaigai": "Vaigai"}  # river_id -> display name
# OSM way 203611432, unnamed, is the Amaravathi from Karatholuvu to Kongur, on the western line: it joins 'Amaravathi River' above and 'Amaravathi' below.
OSM_WAY_RIVERS = {203611432: "amaravathi"}
REPO_FAMILIES = ()

# Build order: the inventory lists families in this order.
STEPS = ("waterways", "reservoirs", "tanks", "industries", "estates", "quarries", "admin", "panchayats", "waterbodies", "watersheds",
         "groundwater-wells", "canals", "gauging-stations")

# Envelopes (scripts/nvdm_envelope_district_basin.py): the shared TN families.
ENVELOPE_SOURCES = {
    **TN_ENVELOPE_SOURCES,
    "tngis": ("tngis-open-geoserver", "TNGIS open GeoServer (WFS): district, taluk, block and village panchayat boundaries, TN WRD sub-basins and reservoirs, micro-watershed atlas, all-water-bodies and all-tanks registers, mine leases, industry register matched to land parcels",
              "Tamil Nadu e-Governance Agency (TNGIS)", {"url": TNGIS}),
    "sipcot": ("sipcot-gis-geoserver", "SIPCOT GIS (WFS): industrial complex outlines, Nilakottai",
               "State Industries Promotion Corporation of Tamil Nadu (SIPCOT)", {"url": "https://sipcotgis.tn.gov.in/"}),
    "osm": ("osm-overpass", "OpenStreetMap (Overpass API extract: named river courses)", "OpenStreetMap contributors", {}),
    "cwc-river": ("nwic-nwdp-cwc-river-data", "CWC river discharge (manual daily) and surface water quality for Tamil Nadu, National Water Data Portal",
                  "Central Water Commission, via the National Water Informatics Centre (NWIC)", {"url": f"{NWDP}/"}),
}
ENVELOPE_ARTIFACTS, ENVELOPE_INPUTS, ENVELOPE_NOTE = tn_envelope(BASIN_ID, ATLAS_SLUG, (
    "Dindigul district's rivers, groundwater and industry (scope dindigul-rivers; the district's own scope id is tn-dindigul). "
    "The district boundary is the frame and TN WRD's sub-basins, clipped to it, are the catchments (shedId)."))
ENVELOPE_NOTE = ENVELOPE_NOTE.replace(f"basins/{BASIN_ID}/tnpcb-type-sectors.json", "basins/tn-tnpcb-type-sectors.json")  # SECTOR_LOOKUP is statewide
for _family in ("realtime-stations",):  # nothing to serve here (probe 2026-10-21)
    del ENVELOPE_ARTIFACTS[_family]
    ENVELOPE_INPUTS.pop(_family, None)
ENVELOPE_ARTIFACTS["inventory"] = [s for s in ENVELOPE_ARTIFACTS["inventory"] if s not in ("tnpcb-rt",)]
if RESERVOIR_STORAGE:
    ENVELOPE_SOURCES["tnsmart"] = ("tnsmart-rimes-reservoirs", "Tamil Nadu reservoir dashboard (TN-SMART): the day's storage, depth and percentage of capacity per reservoir",
                                   "RIMES, relaying Tamil Nadu's daily reservoir storage", {"url": TNSMART})
    ENVELOPE_ARTIFACTS["reservoirs"] = ["tngis", "tnsmart"] + (["cwc-river"] if RESERVOIR_LEVELS else [])
    ENVELOPE_ARTIFACTS["inventory"] += ["tnsmart"]
ENVELOPE_READINGS = TN_ENVELOPE_READINGS


if __name__ == "__main__":
    raise SystemExit(DistrictBasinBuild(sys.modules[__name__]).main(sys.argv[1:]))
