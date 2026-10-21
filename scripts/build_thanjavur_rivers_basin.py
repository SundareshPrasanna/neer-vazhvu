#!/usr/bin/env python3
"""Assemble the thanjavur-rivers Basin Atlas families: Thanjavur district as the frame, TN WRD
sub-basin catchments clipped to it as the sheds, and the named rivers that cross it.

Thanjavur's configuration of the Tamil Nadu district basin engine
(scripts/lib/tn_district_basin.py), scaffolded by scripts/new_district_basin.py on 2026-10-21.
Thanjavur holds the head of the Cauvery delta: below the Grand Anicut the Cauvery and its branches (the
Vennar, Vettar, Kudamurutti and Arasalar) cross the district, with the Kollidam on its northern line. The
south (Pattukkottai, Peravurani) drains to the sea through the Agniyar basin: the Agniyar, Ambuliyar,
Nasuvunni, Pamani and Maharajasamudram rivers.

Sources (fetched once, cached under .cache/thanjavur-rivers/, gitignored):
  TNGIS admin_master:administrative_boundary_district   boundary (LGD 586)
  TNGIS generic_viewer:sub_basin                        sub-hydrosheds (clipped)
  OpenStreetMap waterway=river|canal (Overpass)         rivers
  TNGIS generic_viewer:reservoir / mines                quarries
  TNGIS generic_viewer:all_tanks                        tanks (named, centre points)
  TNGIS generic_viewer:all_water_bodies                 waterbodies-major, waterbodies-minor
  TNGIS generic_viewer:microwatersheds                  watersheds, sub-watersheds, mini-watersheds, micro-watersheds
  TNGIS tnrd:panchayat_boundary                         admin-gp
  NWIC National Water Data Portal (CKAN datastore)      groundwater-wells (CGWB + state telemetry 2026, CGWB manual 2021-2025)
  NWDP, CWC 'Canal Network' + 'Water Resource Project'  canals, command-areas (needs ogr2ogr once)
  NWDP, CWC river discharge + surface water quality     gauging-stations + readings/cwc-<station>.json
  TNGIS admin_master taluks + generic_viewer:block_boundary  admin-taluk, admin-block, groundwater-taluks
  TNGIS generic_viewer:industry_cad_matched             industries, treatment-plants

Inputs already in the repo:
  public/data/atlas/tn/thanjavur/groundwater-taluks.json  groundwater-taluks (IN-GRES stage by taluk)
  pipeline-inputs/basins/tn-tnpcb-type-sectors.json  reviewed TNPCB type code -> sector lookup (statewide)

Writes public/data/basins/thanjavur-rivers/<family>.geojson and inventory.json
through nvdm_write.write_artifact so envelopes survive a re-run. After the first build, run
scripts/nvdm_envelope_district_basin.py scripts/build_thanjavur_rivers_basin.py to stamp envelopes, then
scripts/new_district_basin.py thanjavur --register --write to list the files in the source registry.

Usage:
  python3 scripts/build_thanjavur_rivers_basin.py          full build (every family)
  python3 scripts/build_thanjavur_rivers_basin.py --live   weekly refresh of the living feeds only
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from lib.tn_district_basin import CAUVERY_PRS_2018, CAUVERY_PRS_2025, DistrictBasinBuild, NWDP, TNGIS, TN_ENVELOPE_READINGS, TN_ENVELOPE_SOURCES, tn_envelope  # noqa: E402

BASIN_ID = "thanjavur-rivers"
GENERATED_FROM = Path(__file__).name
DISTRICT_LGD = "586"
DISTRICT_NAME = "Thanjavur"
TNRD_DISTRICT_NAME = "Thanjavur"  # as tnrd:panchayat_boundary prints district_name
NWDP_DISTRICT = "Thanjavur"  # as the National Water Data Portal tags its stations
ATLAS_SLUG = "thanjavur"  # public/data/atlas/tn/<slug>, the district Atlas this map links to

# SIPCOT GIS: no layer centred in the district is an industrial estate that serves (probe 2026-10-21); left out: Thalaivaipalayam (tourism plot)
# CWC's national canal and command-area layers on NWDP (shapefile zips, Lambert conformal conic).
CWC_CANALS_FILE, CWC_COMMAND_FILE = "cwc-canals-thanjavur.geojson", "cwc-command-thanjavur.geojson"
CWC_LAYERS = {
    CWC_CANALS_FILE: (f"{NWDP}/dataset/dd11dfc1-6723-4603-9426-a03e4c8cf50c/resource/75e4b705-44b3-4b4a-a32f-060eeae7b907/download/canal_network.zip", "Canal_Network.shp"),
    CWC_COMMAND_FILE: (f"{NWDP}/dataset/a4fde712-4a1f-461b-897a-411ebb29a622/resource/19966957-ccfc-4341-ab11-ca72da5953f4/download/command_area.zip", "Command_Area.shp"),
}
CWC_CLIP = ("78.68", "10.03", "79.67", "11.28")  # the district extent plus a margin, lon/lat
CANAL_RIVERS = {"grand-anicut-canal": "Grand Anicut canal"}  # river_id -> the CWC canal line (can_name) a reader can select like a river
CANAL_NAMES = {"grand-anicut-canal": "Grand Anicut Canal"}
WATERWAYS_PROVENANCE = "Rivers: OpenStreetMap waterway courses (Overpass), clipped to the district plus 1.6 km so boundary rivers stay"
CANALS_PROVENANCE = "CWC canal network (National Water Data Portal, 2025), cut to the district"
# CWC's gauging stations NWDP tags Thanjavur (the portal's River column, daily rows): Pattukottai (Agniyar, 1,659)
CWC_STATIONS = {"PATTUKOTTAI": "maharajasamudram"}  # CWC gauges (NWDP tags them with the district); the river is checked against the mapped course
RESERVOIR_LEVELS = {}  # register name -> (CWC station, key, display name), where CWC_LEVEL_RESOURCES carries the dam
RESERVOIR_ALIASES = {}
SECTOR_LOOKUP = ROOT / "pipeline-inputs/basins/tn-tnpcb-type-sectors.json"
CETP_SCHEMES = None
REGISTER_YEARS = "2015 to 2024"
TNPCB_OFFICE = {"TNJ": "DEE Thanjavur"}  # the register's office codes (TNPCB's DEE offices)
SUB_BASIN_KEY = {}  # sheds keep TNGIS's object_id keys (SB<object_id>), listed in the manifest
TALUK_ALIASES = {}  # TNGIS taluk -> IN-GRES locationName; every taluk matches by name
RIVER_ALIASES = {"cauvery": ("kaveri", "cauvery"), "kollidam": ("kollidam", "coleroon"), "vennar": ("vennar",), "vettar": ("vettar",), "kudamurutti": ("kudamuruti", "kudamurutti"), "arasalar": ("arasalar",), "agniyar": ("agniar", "agniyar"), "nasuvunni": ("nasuvunni",), "pamani": ("pamani",), "maharajasamudram": ("maharajasamudram",)}  # OSM spellings folded to one river each (substring match, first hit wins)
RIVER_NAMES = {"cauvery": "Cauvery", "kollidam": "Kollidam", "vennar": "Vennar", "vettar": "Vettar", "kudamurutti": "Kudamurutti", "arasalar": "Arasalar", "agniyar": "Agniyar", "nasuvunni": "Nasuvunni", "pamani": "Pamani", "maharajasamudram": "Maharajasamudram"}  # river_id -> display name
REPO_FAMILIES = (
    ("monitoring-points", "public/data/basins/cauvery-tn/wq-stations.geojson", "near", "TNPCB stretch-wise monthly water-quality reports, January to December 2023 (the last year published); classes are the worst monthly use-based class of 2023; station points are town centres, as ingested for the Cauvery (Tamil Nadu) basin", "cauvery-tn/wq-stations.geojson"),
)

# Build order: the inventory lists families in this order.
# CPCB's Cauvery stretch: both editions run along this district (the 2025 one is trimmed where it starts, at station 1320).
PRS_EDITIONS = (CAUVERY_PRS_2018, CAUVERY_PRS_2025)
# TNPCB's 2019 Cauvery action plan, p.194: (name, lat DMS, lon DMS, river_id, page, the plan's description). A third outfall
# (behind the Government College Hostel, Padithurai, Thiruvaiyaru) is printed as 79º85'90.16''E 10º87'95''N, not a valid position.
PRS_OUTFALLS = (
    ("Thirukkattuppalli outfall", (10, 51, 30.86), (78, 57, 34.89), "cauvery", 194,
     "Domestic sewage from Thirukkattuppalli town panchayat into the Cauvery, upstream of the regulator at Padithurai, as TNPCB's 2019 Cauvery action plan records it."),
    ("Thiruvaiyaru outfall", (10, 52, 35.48), (79, 6, 36.40), "cauvery", 194,
     "Domestic sewage from Thiruvaiyaru town panchayat into the Cauvery behind the ARK Complex, 15th Madapam Street, as TNPCB's 2019 Cauvery action plan records it."),
)

STEPS = ("waterways", "cauvery-prs", "repo-families", "tanks", "industries", "quarries", "admin", "panchayats", "waterbodies", "watersheds", "groundwater-wells", "canals",
         "gauging-stations")

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
    "Thanjavur district's rivers, groundwater and industry (scope thanjavur-rivers; the district's own scope id is tn-thanjavur). "
    "The district boundary is the frame and TN WRD's sub-basins, clipped to it, are the catchments (shedId)."))
ENVELOPE_NOTE = ENVELOPE_NOTE.replace(f"basins/{BASIN_ID}/tnpcb-type-sectors.json", "basins/tn-tnpcb-type-sectors.json")  # SECTOR_LOOKUP is statewide
for _family in ("reservoirs", "industrial-estates", "realtime-stations"):  # nothing to serve here (probe 2026-10-21)
    del ENVELOPE_ARTIFACTS[_family]
    ENVELOPE_INPUTS.pop(_family, None)
ENVELOPE_ARTIFACTS["inventory"] = [s for s in ENVELOPE_ARTIFACTS["inventory"] if s not in ("sipcot", "tnpcb-rt")]
ENVELOPE_READINGS = TN_ENVELOPE_READINGS


if __name__ == "__main__":
    raise SystemExit(DistrictBasinBuild(sys.modules[__name__]).main(sys.argv[1:]))
