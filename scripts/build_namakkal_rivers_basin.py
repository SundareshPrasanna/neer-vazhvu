#!/usr/bin/env python3
"""Assemble the namakkal-rivers Basin Atlas families: Namakkal district as the frame, TN WRD
sub-basin catchments clipped to it as the sheds, and the named rivers that cross it.

Namakkal's configuration of the Tamil Nadu district basin engine
(scripts/lib/tn_district_basin.py), scaffolded by scripts/new_district_basin.py on 2026-10-21.
Namakkal lies almost wholly in the Cauvery basin: the Tirumanimuttar sub-basin drains most of the
district, with Karaipottanar, Ayiaar and the Cauvery's own Mettur-to-Noyyal reach; the north-eastern corner
drains to the Vellar (Swethanadhi, Upper Vellar). The Cauvery is the district's south-western line, opposite
Erode; OpenStreetMap names no other river inside the district.

Sources (fetched once, cached under .cache/namakkal-rivers/, gitignored):
  TNGIS admin_master:administrative_boundary_district   boundary (LGD 580)
  TNGIS generic_viewer:sub_basin                        sub-hydrosheds (clipped)
  OpenStreetMap waterway=river|canal (Overpass)         rivers
  TNGIS generic_viewer:reservoir / mines                quarries
  TNGIS generic_viewer:all_tanks                        tanks (named, centre points)
  TNGIS generic_viewer:all_water_bodies                 waterbodies-major, waterbodies-minor
  TNGIS generic_viewer:microwatersheds                  watersheds, sub-watersheds, mini-watersheds, micro-watersheds
  TNGIS tnrd:panchayat_boundary                         admin-gp
  NWIC National Water Data Portal (CKAN datastore)      groundwater-wells (CGWB + state telemetry 2026, CGWB manual 2021-2025)
  NWDP, CWC 'Canal Network' + 'Water Resource Project'  canals, command-areas (needs ogr2ogr once)
  TNGIS admin_master taluks + generic_viewer:block_boundary  admin-taluk, admin-block, groundwater-taluks
  TNGIS generic_viewer:industry_cad_matched             industries, treatment-plants

Inputs already in the repo:
  public/data/atlas/tn/namakkal/groundwater-taluks.json  groundwater-taluks (IN-GRES stage by taluk)
  pipeline-inputs/basins/tn-tnpcb-type-sectors.json  reviewed TNPCB type code -> sector lookup (statewide)

Writes public/data/basins/namakkal-rivers/<family>.geojson and inventory.json
through nvdm_write.write_artifact so envelopes survive a re-run. After the first build, run
scripts/nvdm_envelope_district_basin.py scripts/build_namakkal_rivers_basin.py to stamp envelopes, then
scripts/new_district_basin.py namakkal --register --write to list the files in the source registry.

Usage:
  python3 scripts/build_namakkal_rivers_basin.py          full build (every family)
  python3 scripts/build_namakkal_rivers_basin.py --live   weekly refresh of the living feeds only
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from lib.tn_district_basin import CAUVERY_PRS_2018, CAUVERY_PRS_2025, CWC_RIVER_NETWORK, DistrictBasinBuild, NWDP, TNGIS, TN_ENVELOPE_READINGS, TN_ENVELOPE_SOURCES, tn_envelope  # noqa: E402

BASIN_ID = "namakkal-rivers"
GENERATED_FROM = Path(__file__).name
DISTRICT_LGD = "580"
DISTRICT_NAME = "Namakkal"
TNRD_DISTRICT_NAME = "Namakkal"  # as tnrd:panchayat_boundary prints district_name
NWDP_DISTRICT = "Namakkal"  # as the National Water Data Portal tags its stations
ATLAS_SLUG = "namakkal"  # public/data/atlas/tn/<slug>, the district Atlas this map links to

SIPCOT_PARKS = ()  # the one SIPCOT layer centred here, AriyurNadu, is a tourism complex in the Kolli Hills, not an industrial estate
ESTATES_PROVENANCE = "SIPCOT GIS (sipcotgis.tn.gov.in): industrial complex outlines, AriyurNadu; area as SIPCOT states it"
ESTATES_SOURCE_FILE = "cite:industrial_complex_boundary-*"
# CWC's national canal and command-area layers on NWDP (shapefile zips, Lambert conformal conic).
CWC_CANALS_FILE, CWC_COMMAND_FILE = "cwc-canals-namakkal.geojson", "cwc-command-namakkal.geojson"
CWC_RIVERS_FILE = "cwc-rivers-namakkal.geojson"
# OSM names no Thirumanimuthar here; CWC's river network does (rivname 'Tirumanimuttar').
CWC_RIVER_LINES = {"thirumanimuthar": "Tirumanimuttar"}
CWC_LAYERS = {
    CWC_RIVERS_FILE: CWC_RIVER_NETWORK,
    CWC_CANALS_FILE: (f"{NWDP}/dataset/dd11dfc1-6723-4603-9426-a03e4c8cf50c/resource/75e4b705-44b3-4b4a-a32f-060eeae7b907/download/canal_network.zip", "Canal_Network.shp"),
    CWC_COMMAND_FILE: (f"{NWDP}/dataset/a4fde712-4a1f-461b-897a-411ebb29a622/resource/19966957-ccfc-4341-ab11-ca72da5953f4/download/command_area.zip", "Command_Area.shp"),
}
CWC_CLIP = ("77.58", "10.91", "78.59", "11.70")  # the district extent plus a margin, lon/lat
CANAL_RIVERS = {"mettur-east-bank-canal": "Mettur East Bank Canal"}  # river_id -> the CWC canal line (can_name) a reader can select like a river
CANAL_NAMES = {"mettur-east-bank-canal": "Mettur East Bank Canal"}
WATERWAYS_PROVENANCE = "Rivers: OpenStreetMap waterway courses (Overpass), clipped to the district plus 1.6 km so boundary rivers stay. The Thirumanimuthar: CWC river network (National Water Data Portal), which OSM does not name inside the district"
CANALS_PROVENANCE = "CWC canal network (National Water Data Portal, 2025), cut to the district; lines CWC files under the Kalingarayan Anicut System, an Erode canal system, are left out until a source names them"
# CWC files unnamed lines here under Erode's Kalingarayan system (Erode leaves out the same lines as lying outside it).
CANAL_DROP = lambda p: p["prj_name"] == "Kalingarayan Anicut System"  # noqa: E731
RESERVOIR_LEVELS = {}  # register name -> (CWC station, key, display name), where CWC_LEVEL_RESOURCES carries the dam
RESERVOIR_ALIASES = {}
SECTOR_LOOKUP = ROOT / "pipeline-inputs/basins/tn-tnpcb-type-sectors.json"
CETP_SCHEMES = ROOT / "pipeline-inputs/basins/namakkal-rivers/cetp-schemes.json"  # the two Nadanthai Vaazhi Cauvery schemes (Department of Textiles, rows 8 and 9)
REGISTER_YEARS = "2015 to 2024"
TNPCB_OFFICE = {"NML": "DEE Namakkal", "KMP": "DEE Kumarapalayam"}  # the register's office codes (TNPCB's DEE offices)
SUB_BASIN_KEY = {}  # sheds keep TNGIS's object_id keys (SB<object_id>), listed in the manifest
TALUK_ALIASES = {}  # TNGIS taluk -> IN-GRES locationName; every taluk matches by name
RIVER_ALIASES = {"cauvery": ("kaveri", "cauvery")}  # OSM spellings folded to one river each (substring match, first hit wins)
RIVER_NAMES = {"cauvery": "Cauvery", "thirumanimuthar": "Thirumanimuthar"}  # river_id -> display name
REPO_FAMILIES = (
    ("monitoring-points", "public/data/basins/cauvery-tn/wq-stations.geojson", "near", "TNPCB stretch-wise monthly water-quality reports, January to December 2023 (the last year published); classes are the worst monthly use-based class of 2023; station points are town centres, as ingested for the Cauvery (Tamil Nadu) basin", "cauvery-tn/wq-stations.geojson"),
)

# Build order: the inventory lists families in this order.
# CPCB's Cauvery stretch: both editions run along this district (the 2025 one is trimmed where it starts, at station 1320).
PRS_EDITIONS = (CAUVERY_PRS_2018, CAUVERY_PRS_2025)
# TNPCB's 2019 Cauvery action plan, p.85: the 18 outfalls on the Namakkal bank (name, lat DMS, lon DMS, river_id, page, description).
# OF1 (Poolampatti) is in Salem district; OF13 ('near RS Road, Pallipalayam') plots 0.62 km from the mapped river in both of the
# plan's printings (pp.85, 91), a drain set back from the bank, so it is left out rather than moved.
PRS_OUTFALLS = (
    ("near Cauvery Nagar, Kumarapalayam", (11, 27, 9), (77, 41, 43), "cauvery", 85,
     "Outfall OF2, 'near Cauvery Nagar, Kumarapalayam': one of 19 outfalls TNPCB's 2019 Cauvery action plan identifies on the Kumarapalayam office's 60.4 km reach (p.84), where it records sewage drains reaching the River Cauvery (pp.74, 103). The plan gives no flow or BOD for it."),
    ("near Kalaimagal Street in Ward No.31, Kumarapalayam", (11, 26, 56), (77, 41, 37), "cauvery", 85,
     "Outfall OF3, 'near Kalaimagal Street in Ward No.31, Kumarapalayam': one of 19 outfalls TNPCB's 2019 Cauvery action plan identifies on the Kumarapalayam office's 60.4 km reach (p.84), where it records sewage drains reaching the River Cauvery (pp.74, 103). The plan gives no flow or BOD for it."),
    ("near Municipality Backside, Kumarapalayam", (11, 26, 7), (77, 41, 16), "cauvery", 85,
     "Outfall OF4, 'near Municipality Backside, Kumarapalayam': one of 19 outfalls TNPCB's 2019 Cauvery action plan identifies on the Kumarapalayam office's 60.4 km reach (p.84), where it records sewage drains reaching the River Cauvery (pp.74, 103). The plan gives no flow or BOD for it."),
    ("near Kandhan Rugs, Kumarapalayam", (11, 26, 8), (77, 41, 16), "cauvery", 85,
     "Outfall OF5, 'near Kandhan Rugs, Kumarapalayam': one of 19 outfalls TNPCB's 2019 Cauvery action plan identifies on the Kumarapalayam office's 60.4 km reach (p.84), where it records sewage drains reaching the River Cauvery (pp.74, 103). The plan gives no flow or BOD for it."),
    ("near Kumarapalayam Bridge, Kumarapalayam", (11, 25, 52), (77, 41, 15), "cauvery", 85,
     "Outfall OF6, 'near Kumarapalayam Bridge, Kumarapalayam': one of 19 outfalls TNPCB's 2019 Cauvery action plan identifies on the Kumarapalayam office's 60.4 km reach (p.84), where it records sewage drains reaching the River Cauvery (pp.74, 103). The plan gives no flow or BOD for it."),
    ("near Avathipalayam, Kaliayanur Panchayat", (11, 22, 22), (77, 44, 12), "cauvery", 85,
     "Outfall OF7, 'near Avathipalayam, Kaliayanur Panchayat': one of 19 outfalls TNPCB's 2019 Cauvery action plan identifies on the Kumarapalayam office's 60.4 km reach (p.84), where it records sewage drains reaching the River Cauvery (pp.74, 103). The plan gives no flow or BOD for it."),
    ("near Oilkarar Street, Pallipalayam Municipality", (11, 22, 5), (77, 44, 29), "cauvery", 85,
     "Outfall OF8, 'near Oilkarar Street, Pallipalayam Municipality': one of 19 outfalls TNPCB's 2019 Cauvery action plan identifies on the Kumarapalayam office's 60.4 km reach (p.84), where it records sewage drains reaching the River Cauvery (pp.74, 103). The plan gives no flow or BOD for it."),
    ("near PuthanSanthai, Pallipalayam Municipality", (11, 22, 0), (77, 44, 32), "cauvery", 85,
     "Outfall OF9, 'near PuthanSanthai, Pallipalayam Municipality': one of 19 outfalls TNPCB's 2019 Cauvery action plan identifies on the Kumarapalayam office's 60.4 km reach (p.84), where it records sewage drains reaching the River Cauvery (pp.74, 103). The plan gives no flow or BOD for it."),
    ("near Cauvery Thadam, Pallipalayam Municipality", (11, 21, 56), (77, 44, 35), "cauvery", 85,
     "Outfall OF10, 'near Cauvery Thadam, Pallipalayam Municipality': one of 19 outfalls TNPCB's 2019 Cauvery action plan identifies on the Kumarapalayam office's 60.4 km reach (p.84), where it records sewage drains reaching the River Cauvery (pp.74, 103). The plan gives no flow or BOD for it."),
    ("near Cauvery Bridge, Pallipalayam Municipality", (11, 21, 40), (77, 44, 44), "cauvery", 85,
     "Outfall OF11, 'near Cauvery Bridge, Pallipalayam Municipality': one of 19 outfalls TNPCB's 2019 Cauvery action plan identifies on the Kumarapalayam office's 60.4 km reach (p.84), where it records sewage drains reaching the River Cauvery (pp.74, 103). The plan gives no flow or BOD for it."),
    ("near Avarankadu, Pallipalayam Municipality", (11, 21, 36), (77, 44, 48), "cauvery", 85,
     "Outfall OF12, 'near Avarankadu, Pallipalayam Municipality': one of 19 outfalls TNPCB's 2019 Cauvery action plan identifies on the Kumarapalayam office's 60.4 km reach (p.84), where it records sewage drains reaching the River Cauvery (pp.74, 103). The plan gives no flow or BOD for it."),
    ("near Alampalayam Burial Ground, Pallipalayam Municipality", (11, 21, 21), (77, 45, 11), "cauvery", 85,
     "Outfall OF14, 'near Alampalayam Burial Ground, Pallipalayam Municipality': one of 19 outfalls TNPCB's 2019 Cauvery action plan identifies on the Kumarapalayam office's 60.4 km reach (p.84), where it records sewage drains reaching the River Cauvery (pp.74, 103). The plan gives no flow or BOD for it."),
    ("near Pudhupalayam Village", (11, 21, 16), (77, 45, 13), "cauvery", 85,
     "Outfall OF15, 'near Pudhupalayam Village': one of 19 outfalls TNPCB's 2019 Cauvery action plan identifies on the Kumarapalayam office's 60.4 km reach (p.84), where it records sewage drains reaching the River Cauvery (pp.74, 103). The plan gives no flow or BOD for it."),
    ("near Kokkarayanpettai bridge", (11, 18, 38), (77, 46, 45), "cauvery", 85,
     "Outfall OF16, 'near Kokkarayanpettai bridge': one of 19 outfalls TNPCB's 2019 Cauvery action plan identifies on the Kumarapalayam office's 60.4 km reach (p.84), where it records sewage drains reaching the River Cauvery (pp.74, 103). Near it the plan records a sample of the Kokkarayanpettai sewage drain with BOD 123 mg/l, marked 'Not complied' (p.82)."),
    ("near Patlur Village", (11, 16, 32), (77, 48, 19), "cauvery", 85,
     "Outfall OF17, 'near Patlur Village': one of 19 outfalls TNPCB's 2019 Cauvery action plan identifies on the Kumarapalayam office's 60.4 km reach (p.84), where it records sewage drains reaching the River Cauvery (pp.74, 103). The plan gives no flow or BOD for it."),
    ("near Irayamangalam Village", (11, 15, 45), (77, 50, 2), "cauvery", 85,
     "Outfall OF18, 'near Irayamangalam Village': one of 19 outfalls TNPCB's 2019 Cauvery action plan identifies on the Kumarapalayam office's 60.4 km reach (p.84), where it records sewage drains reaching the River Cauvery (pp.74, 103). The plan gives no flow or BOD for it."),
    ("near Molasi Village", (11, 15, 16), (77, 51, 11), "cauvery", 85,
     "Outfall OF19, 'near Molasi Village': one of 19 outfalls TNPCB's 2019 Cauvery action plan identifies on the Kumarapalayam office's 60.4 km reach (p.84), where it records sewage drains reaching the River Cauvery (pp.74, 103). The plan gives no flow or BOD for it."),
)

STEPS = ("waterways", "prs", "repo-families", "tanks", "industries", "quarries", "admin", "panchayats", "waterbodies", "watersheds", "groundwater-wells", "canals")

# Envelopes (scripts/nvdm_envelope_district_basin.py): the shared TN families.
ENVELOPE_SOURCES = {
    **TN_ENVELOPE_SOURCES,
    "tngis": ("tngis-open-geoserver", "TNGIS open GeoServer (WFS): district, taluk, block and village panchayat boundaries, TN WRD sub-basins and reservoirs, micro-watershed atlas, all-water-bodies and all-tanks registers, mine leases, industry register matched to land parcels",
              "Tamil Nadu e-Governance Agency (TNGIS)", {"url": TNGIS}),
    "osm": ("osm-overpass", "OpenStreetMap (Overpass API extract: named river courses)", "OpenStreetMap contributors", {}),
}
ENVELOPE_ARTIFACTS, ENVELOPE_INPUTS, ENVELOPE_NOTE = tn_envelope(BASIN_ID, ATLAS_SLUG, (
    "Namakkal district's rivers, groundwater and industry (scope namakkal-rivers; the district's own scope id is tn-namakkal). "
    "The district boundary is the frame and TN WRD's sub-basins, clipped to it, are the catchments (shedId)."))
ENVELOPE_NOTE = ENVELOPE_NOTE.replace(f"basins/{BASIN_ID}/tnpcb-type-sectors.json", "basins/tn-tnpcb-type-sectors.json")  # SECTOR_LOOKUP is statewide
for _family in ("reservoirs", "realtime-stations", "gauging-stations", "industrial-estates"):  # nothing to serve here (probe 2026-10-21; the one SIPCOT layer is a tourism complex)
    del ENVELOPE_ARTIFACTS[_family]
    ENVELOPE_INPUTS.pop(_family, None)
ENVELOPE_ARTIFACTS["inventory"] = [s for s in ENVELOPE_ARTIFACTS["inventory"] if s not in ("tnpcb-rt", "cwc-river", "sipcot")]
# The shared Cauvery stretch, TNPCB's 2023 stations and the action plan's outfalls.
ENVELOPE_SOURCES.update({
    "cpcb-prs": ("cpcb-prs-report", "CPCB, Polluted River Stretches for Restoration of Water Quality, 2018 and October 2025 (updated version)", "Central Pollution Control Board",
                 {"url": "https://cpcb.gov.in/polluted-river-stretches/", "as_of": "2025-10"}),
    "tnpcb-wq": ("tnpcb-prs-cauvery", "TNPCB stretch-wise monthly water-quality reports, January to December 2023 (the last year published)", "Tamil Nadu Pollution Control Board",
                 {"url": "https://tnpcb.gov.in/pollutedriverstretches.php", "as_of": "2023-12"}),
    "tnpcb-plan": ("tnpcb-prs-cauvery", "TNPCB, Action Plan on Rejuvenation of River Cauvery, Mettur to Mayiladuthurai stretch (Priority I), 2019", "Tamil Nadu Pollution Control Board",
                   {"url": "https://tnpcb.gov.in/PDF/About_Us/projects/PR-Stretches/Water-QA-MN-report/actionplan/PrsCauvery24919.pdf", "as_of": "2019"}),
    "cwc-rivers": ("nwic-nwdp-cwc-river-network", "CWC river network (River_Network), National Water Data Portal", "Central Water Commission, via the National Water Informatics Centre (NWIC)",
                   {"url": f"{NWDP}/", "as_of": "2025-11"}),
})
_SHEDS, _RIVERS = (f"public/data/basins/{BASIN_ID}/{f}.geojson" for f in ("sub-hydrosheds", "rivers"))
ENVELOPE_ARTIFACTS.update({"rivers": ["osm", "cwc-canals", "cwc-rivers", "tngis"], "prs": ["cpcb-prs", "osm", "tngis"], "monitoring-points": ["tnpcb-wq", "osm", "tngis"], "prs-drains": ["tnpcb-plan", "tngis"]})
ENVELOPE_INPUTS.update({"prs": [_RIVERS], "monitoring-points": ["public/data/basins/cauvery-tn/wq-stations.geojson", _SHEDS], "prs-drains": [_RIVERS, _SHEDS]})
ENVELOPE_ARTIFACTS["inventory"] += ["cpcb-prs", "tnpcb-wq", "tnpcb-plan", "cwc-rivers"]
ENVELOPE_READINGS = TN_ENVELOPE_READINGS


if __name__ == "__main__":
    raise SystemExit(DistrictBasinBuild(sys.modules[__name__]).main(sys.argv[1:]))
