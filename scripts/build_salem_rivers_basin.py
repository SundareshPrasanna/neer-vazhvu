#!/usr/bin/env python3
"""Assemble the salem-rivers Basin Atlas families: Salem district as the frame, TN WRD
sub-basin catchments clipped to it as the sheds, and the named rivers that cross it.

Salem's configuration of the Tamil Nadu district basin engine
(scripts/lib/tn_district_basin.py), scaffolded by scripts/new_district_basin.py on 2026-10-21.
Salem straddles three basins. The Cauvery side (Mettur-to-Noyyal reach, Tirumanimuttar sub-basin) holds Mettur dam
and the Sarabanga, Thoppaiyar and Thirumanimuthar, which rise in the Shevaroy and Kollimalai foothills and run south
to the Cauvery; the east drains to the Vellar through the Vasishta and Swetha Nadhi, with Anaimaduvu dam; the
north-east corner drains to the Pennaiyar through the Vaniyar. The Cauvery is the district's western line, opposite
Dharmapuri and Erode. OpenStreetMap names only the Cauvery in full here, so the other rivers are drawn on CWC's
river network.

Sources (fetched once, cached under .cache/salem-rivers/, gitignored):
  TNGIS admin_master:administrative_boundary_district   boundary (LGD 584)
  TNGIS generic_viewer:sub_basin                        sub-hydrosheds (clipped)
  OpenStreetMap waterway=river|canal (Overpass)         rivers: the Cauvery
  NWDP, CWC 'River Network'                             rivers: the other seven
  TNGIS generic_viewer:reservoir / mines                reservoirs, quarries
  TNGIS generic_viewer:all_tanks                        tanks (named, centre points)
  TNGIS generic_viewer:all_water_bodies                 waterbodies-major, waterbodies-minor
  TNGIS generic_viewer:microwatersheds                  watersheds, sub-watersheds, mini-watersheds, micro-watersheds
  TNGIS tnrd:panchayat_boundary                         admin-gp
  NWIC National Water Data Portal (CKAN datastore)      groundwater-wells (CGWB + state telemetry 2026, CGWB manual 2021-2025)
  NWDP, CWC 'Canal Network' + 'Water Resource Project'  canals, command-areas (needs ogr2ogr once)
  TN-SMART (RIMES) reservoir dashboard                  reservoirs: today's storage for Anaimadavu, Kariakovil, Mettur, Thoppaiyar
  NWDP, CWC river discharge + surface water quality     gauging-stations + readings/cwc-<station>.json
  TNGIS admin_master taluks + generic_viewer:block_boundary  admin-taluk, admin-block, groundwater-taluks
  TNGIS generic_viewer:industry_cad_matched             industries, treatment-plants
  SIPCOT GIS industrial_complex_boundary-*              industrial-estates

Inputs already in the repo:
  public/data/atlas/tn/salem/groundwater-taluks.json  groundwater-taluks (IN-GRES stage by taluk)
  pipeline-inputs/basins/tn-tnpcb-type-sectors.json  reviewed TNPCB type code -> sector lookup (statewide)

Writes public/data/basins/salem-rivers/<family>.geojson and inventory.json
through nvdm_write.write_artifact so envelopes survive a re-run. After the first build, run
scripts/nvdm_envelope_district_basin.py scripts/build_salem_rivers_basin.py to stamp envelopes, then
scripts/new_district_basin.py salem --register --write to list the files in the source registry.

Usage:
  python3 scripts/build_salem_rivers_basin.py          full build (every family)
  python3 scripts/build_salem_rivers_basin.py --live   weekly refresh of the living feeds only
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from lib.tn_district_basin import CWC_RIVER_NETWORK, NWDP, TN_ENVELOPE_READINGS, TN_ENVELOPE_SOURCES, TNGIS, TNSMART, DistrictBasinBuild, tn_envelope  # noqa: E402

BASIN_ID = "salem-rivers"
GENERATED_FROM = Path(__file__).name
DISTRICT_LGD = "584"
DISTRICT_NAME = "Salem"
TNRD_DISTRICT_NAME = "Salem"  # as tnrd:panchayat_boundary prints district_name
NWDP_DISTRICT = "Salem"  # as the National Water Data Portal tags its stations
ATLAS_SLUG = "salem"  # public/data/atlas/tn/<slug>, the district Atlas this map links to

SIPCOT_PARKS = ("Salem",)  # SIPCOT GIS layers whose extent centres in the district (probe 2026-10-21); left out: Chinnakalrayanmalai (tourism plot); Kolagur (tourism plot); Nagalur (tourism plot)
ESTATES_PROVENANCE = "SIPCOT GIS (sipcotgis.tn.gov.in): industrial complex outlines, Salem; area as SIPCOT states it"
ESTATES_SOURCE_FILE = "cite:industrial_complex_boundary-*"
# CWC's national canal and command-area layers on NWDP (shapefile zips, Lambert conformal conic).
CWC_CANALS_FILE, CWC_COMMAND_FILE = "cwc-canals-salem.geojson", "cwc-command-salem.geojson"
CWC_RIVERS_FILE = "cwc-rivers-salem.geojson"
# OSM names none of these in full inside the district; CWC's river network does (river_id -> rivname).
CWC_RIVER_LINES = {"sarabanga": "Sarabhanga", "thirumanimuthar": "Tirumanimuttar", "thoppaiyar": "Veppadi Or Toppai Ar", "vasishta": "Vellar/Vasista",
                   "swetha": "Sweta Nadi", "anaimaduvu": "Analmaduvu R", "vaniyar": "Vaniyar"}
CWC_LAYERS = {
    CWC_RIVERS_FILE: CWC_RIVER_NETWORK,
    CWC_CANALS_FILE: (f"{NWDP}/dataset/dd11dfc1-6723-4603-9426-a03e4c8cf50c/resource/75e4b705-44b3-4b4a-a32f-060eeae7b907/download/canal_network.zip", "Canal_Network.shp"),
    CWC_COMMAND_FILE: (f"{NWDP}/dataset/a4fde712-4a1f-461b-897a-411ebb29a622/resource/19966957-ccfc-4341-ab11-ca72da5953f4/download/command_area.zip", "Command_Area.shp"),
}
CWC_CLIP = ("77.55", "11.22", "78.94", "12.08")  # the district extent plus a margin, lon/lat
CANAL_RIVERS = {}  # none selectable like a river
CANAL_NAMES = {}
WATERWAYS_PROVENANCE = ("Rivers: the Cauvery from OpenStreetMap waterway courses (Overpass); the Sarabanga, Thirumanimuthar, Thoppaiyar, Vasishta, Swetha Nadhi, Anaimaduvu and Vaniyar "
                         "from CWC's river network (National Water Data Portal), which OSM does not name in full inside the district; all clipped to the district plus 1.6 km so boundary rivers stay")
CANALS_PROVENANCE = "CWC canal network (National Water Data Portal, 2025), cut to the district"
# CWC's gauging stations NWDP tags Salem (the portal's River column, daily rows): Sevanur (Cauvery, 7,284); Thevur (Cauvery, 7,138); Thoppur (Cauvery, 5,483); Mettur Reservoir (Cauvery, 1)
# Each checked against the mapped course: Thevur sits on the Sarabanga, Thoppur on the Thoppaiyar. Sevanur plots on the Cauvery's
# line, but its flow (monthly peak 9.1 cumec, no flow in 111 of 262 months) is no main stem below Mettur; which channel it gauges
# is unconfirmed, so it is left out. Mettur Reservoir has one discharge row; its levels come through RESERVOIR_LEVELS.
CWC_STATIONS = {"THEVUR": "sarabanga", "THOPPUR": "thoppaiyar"}
RESERVOIR_LEVELS = {"Mettur": ("METTUR RESERVOIR", "mettur", "Mettur")}  # register name -> (CWC station, key, display name)
RESERVOIR_ALIASES = {}
# TN WRD register name -> the name the state's daily reservoir dashboard prints, where the two plainly match, or by position
# where the names differ (Vaaniar sits 0.7 km from the register's Vaniar; the next reservoir is 7 km or more away).
RESERVOIR_STORAGE = {"Anaimadavu": "Anaimadavu", "Kariakovil": "Kariakovil", "Mettur": "Mettur", "Thoppaiyar": "Thoppaiyar", "Vaniar": "Vaaniar"}
SECTOR_LOOKUP = ROOT / "pipeline-inputs/basins/tn-tnpcb-type-sectors.json"
CETP_SCHEMES = None
REGISTER_YEARS = "2015 to 2024"
TNPCB_OFFICE = {"SLM": "DEE Salem", "KMP": "DEE Kumarapalayam"}  # the register's office codes (TNPCB's DEE offices, as the OCMMS office list names them)
SUB_BASIN_KEY = {}  # sheds keep TNGIS's object_id keys (SB<object_id>), listed in the manifest
TALUK_ALIASES = {}  # TNGIS taluk -> IN-GRES locationName; every taluk matches by name
RIVER_ALIASES = {"cauvery": ("kaveri", "cauvery")}  # OSM spellings folded to one river each (substring match, first hit wins)
RIVER_NAMES = {"cauvery": "Cauvery", "sarabanga": "Sarabanga", "thirumanimuthar": "Thirumanimuthar", "thoppaiyar": "Thoppaiyar", "vasishta": "Vasishta Nadhi",
               "swetha": "Swetha Nadhi", "anaimaduvu": "Anaimaduvu", "vaniyar": "Vaniyar"}  # river_id -> display name
# CPCB's 2018 stretches (Priority I), each cut between two points on the mapped course (lon, lat): the start and end the
# TNPCB 2019 action plans print, except where PRS_NOTES says otherwise. The 2022 and October 2025 entries for these rivers are
# single locations, not stretches, and are given on the river cards; the Cauvery's 2025 stretch starts in Erode, below this district.
PRS_EDITIONS = (
    (2018, "I", "Mettur to Mayiladuthurai", (77.806986, 11.79627), "cauvery"),  # TNPCB NWMP station 50, Mettur, below the dam
    (2018, "I", "Thathayampatti to T.Konagapadi", (78.050397, 11.788114), "sarabanga", (78.004583, 11.689)),
    (2018, "I", "Salem to Papparapatti", (78.182222, 11.673611), "thirumanimuthar", (78.068611, 11.525694)),
    (2018, "I", "Manivilundhan to Thiyaganur", (78.716028, 11.597694), "vasishta", (78.781937, 11.571941)),
)
PRS_NOTES = {
    (2018, "cauvery"): "The stretch is drawn from TNPCB's Mettur monitoring station (NWMP station 50), below the dam; the reservoir above it is not part of the stretch.",
    (2018, "sarabanga"): "Drawn from the plan's Thathiyampatti Bridge outfall (p.9) to its Konagapadi sample point, an open well in T.Konagapadi village panchayat (p.12); TNPCB gives the stretch as 15 km.",
    (2018, "thirumanimuthar"): "The plan prints no point named Salem, so this reach starts at the upstream-most of the eight Salem Corporation outfalls it prints (Nearby Sengal Anai, p.9) and ends at its Papparapatti downstream sample (p.12). Drawn that way it is longer than the 15 km TNPCB gives.",
    (2018, "vasishta"): "Drawn from the plan's Manivilundhan sample point (p.13). The plan prints no coordinate at Thiyaganur, so the reach ends where CWC's course leaves Thiyaganur village panchayat (TNGIS).",
}
# The outfalls the four 2019 action plans print for Salem district, as printed (lat DMS, lon DMS): the 18 within 0.5 km of the mapped
# course. Left out, further than that: seven Mettur outfalls into the Cauvery, 0.52 to 0.72 km from OSM's course, and OF1, whose
# printed longitude has 90 seconds; the five Omalur outfalls into the Sarabanga, 0.79 to 1.04 km from CWC's line.
PRS_OUTFALLS = (
    ('NH 544H, Mettur', (11, 47, 50), (77, 48, 56), 'cauvery', 17, "Outfall OF2, 'NH 544H, Mettur': one of the 11 sewage outfall points TNPCB's 2019 Cauvery action plan maps for Mettur Municipality (p.16; 11 locations, p.30); the plan records that the sewage not treated at the STPs 'is now being discharged into River Cauvery' (p.15)."),
    ('SH 158 near Mettur', (11, 46, 13), (77, 48, 12), 'cauvery', 17, "Outfall OF5, 'SH 158 near Mettur': one of the 11 sewage outfall points TNPCB's 2019 Cauvery action plan maps for Mettur Municipality (p.16; 11 locations, p.30); the plan records that the sewage not treated at the STPs 'is now being discharged into River Cauvery' (p.15)."),
    ('Union School St', (11, 46, 24), (77, 48, 24), 'cauvery', 17, "Outfall OF8, 'Union School St': one of the 11 sewage outfall points TNPCB's 2019 Cauvery action plan maps for Mettur Municipality (p.16; 11 locations, p.30); the plan records that the sewage not treated at the STPs 'is now being discharged into River Cauvery' (p.15)."),
    ('Poolampatti Town Panchayat', (11, 39, 28), (77, 45, 51), 'cauvery', 85, "Outfall OF1, 'Poolampatti Town Panchayat', captioned 'Outfalls near Slaughter House in Poolampatti' (p.87): the first of the 19 outfalls TNPCB's 2019 Cauvery action plan identifies on the Kumarapalayam office's 60.4 km reach, which begins at Poolampatti in Edapadi taluk (p.84). The plan's Salem table gives Poollampatty Town Panchayat 5 outfall locations, its sullage 'let out in to private Agriculture land' (pp.31-32)."),
    ('Thathiyampatti Bridge', (11, 47, 17.21), (78, 3, 1.43), 'sarabanga', 9, "Sewage outfall 1, 'Thathiyampatti Bridge' (Village Panchayat): one of the six sewage outfall points TNPCB's 2019 Sarabanga action plan prints (p.9), on the stretch where it finds 'only domestic sewage from Idappadi Municipality, Thathiampatti Village Panchayat and Omalur Town Panchayat area' (p.7)."),
    ('Nearby Sengal Anai', (11, 40, 25), (78, 10, 56), 'thirumanimuthar', 9, "Sewage outfall 1, 'Nearby Sengal Anai' (Salem Corporation): one of the eight sewage outfall points TNPCB's 2019 Thirumanimutharu action plan prints (p.9); the plan records that the Corporation's untreated sewage 'is now being discharged into the River Thriumanimutharu' (p.7)."),
    ('Nearby Balaji Nagar', (11, 40, 17), (78, 10, 35), 'thirumanimuthar', 9, "Sewage outfall 2, 'Nearby Balaji Nagar' (Salem Corporation): one of the eight sewage outfall points TNPCB's 2019 Thirumanimutharu action plan prints (p.9); the plan records that the Corporation's untreated sewage 'is now being discharged into the River Thriumanimutharu' (p.7)."),
    ('Gokul Nagar Jairam College Back side', (11, 39, 59), (78, 10, 20), 'thirumanimuthar', 9, "Sewage outfall 3, 'Gokul Nagar Jairam College Back side' (Salem Corporation): one of the eight sewage outfall points TNPCB's 2019 Thirumanimutharu action plan prints (p.9); the plan records that the Corporation's untreated sewage 'is now being discharged into the River Thriumanimutharu' (p.7)."),
    ('Anaimedu STP', (11, 39, 45), (78, 9, 58), 'thirumanimuthar', 9, "Sewage outfall 4, 'Anaimedu STP' (Salem Corporation): one of the eight sewage outfall points TNPCB's 2019 Thirumanimutharu action plan prints (p.9); the plan records that the Corporation's untreated sewage 'is now being discharged into the River Thriumanimutharu' (p.7)."),
    ('Bose Ground, Old Bus Stand back side', (11, 39, 4), (78, 9, 26), 'thirumanimuthar', 9, "Sewage outfall 5, 'Bose Ground, Old Bus Stand back side' (Salem Corporation): one of the eight sewage outfall points TNPCB's 2019 Thirumanimutharu action plan prints (p.9); the plan records that the Corporation's untreated sewage 'is now being discharged into the River Thriumanimutharu' (p.7)."),
    ('Shevapet Police Station Market', (11, 38, 58), (78, 8, 55), 'thirumanimuthar', 9, "Sewage outfall 6, 'Shevapet Police Station Market' (Salem Corporation): one of the eight sewage outfall points TNPCB's 2019 Thirumanimutharu action plan prints (p.9); the plan records that the Corporation's untreated sewage 'is now being discharged into the River Thriumanimutharu' (p.7)."),
    ('Pallapatti lake overflow', (11, 39, 4), (78, 7, 28), 'thirumanimuthar', 9, "Sewage outfall 7, 'Pallapatti lake overflow' (Salem Corporation): one of the eight sewage outfall points TNPCB's 2019 Thirumanimutharu action plan prints (p.9); the plan records that the Corporation's untreated sewage 'is now being discharged into the River Thriumanimutharu' (p.7)."),
    ('Uthamasolapuram', (11, 36, 49), (78, 6, 19), 'thirumanimuthar', 9, "Sewage outfall 8, 'Uthamasolapuram' (Salem Corporation): one of the eight sewage outfall points TNPCB's 2019 Thirumanimutharu action plan prints (p.9); the plan records that the Corporation's untreated sewage 'is now being discharged into the River Thriumanimutharu' (p.7)."),
    ('Vinayagapuram', (11, 36, 9), (78, 35, 10), 'vasishta', 10, "Sewage outfall 1, 'Vinayagapuram' (Attur Municipality): one of the five sewage outfall points TNPCB's 2019 Vasista action plan prints (p.10); the plan finds the river's pollution 'mainly due to the discharge of domestic sewage into the river' from these local bodies (p.6)."),
    ('Appamasamudram', (11, 36, 25), (78, 34, 25), 'vasishta', 10, "Sewage outfall 2, 'Appamasamudram' (Narasingapuram Municipality): one of the five sewage outfall points TNPCB's 2019 Vasista action plan prints (p.10); the plan finds the river's pollution 'mainly due to the discharge of domestic sewage into the river' from these local bodies (p.6)."),
    ('Pethanaickenpalayam', (11, 39, 3), (78, 30, 47), 'vasishta', 10, "Sewage outfall 3, 'Pethanaickenpalayam' (Pethanaickenpalayam Town Panchayat): one of the five sewage outfall points TNPCB's 2019 Vasista action plan prints (p.10); the plan finds the river's pollution 'mainly due to the discharge of domestic sewage into the river' from these local bodies (p.6)."),
    ('Yethapur', (11, 39, 38), (78, 28, 29), 'vasishta', 10, "Sewage outfall 4, 'Yethapur' (Yethapur Town Panchayat): one of the five sewage outfall points TNPCB's 2019 Vasista action plan prints (p.10); the plan finds the river's pollution 'mainly due to the discharge of domestic sewage into the river' from these local bodies (p.6)."),
    ('BelurBridge', (11, 42, 18.3), (78, 24, 47), 'anaimaduvu', 10, "Sewage outfall 5, 'BelurBridge' (Belur Town Panchayat): one of the five sewage outfall points TNPCB's 2019 Vasista action plan prints (p.10); the plan finds the river's pollution 'mainly due to the discharge of domestic sewage into the river' from these local bodies (p.6). Its printed position lies on CWC's Anaimaduvu line, which WRD describes as a tributary of the Vasista (TN WRD, Anaimaduvu Dam page), 5.8 km from CWC's Vasishta line."),
)
PRS_DRAINS_SOURCE = ("TNPCB, action plans for the Cauvery (Mettur to Mayiladuthurai), Sarabanga, Thirumanimutharu and Vasista stretches (2019): outfall names and GPS coordinates as printed",
                     "PrsCauvery24919.pdf + PrsSarabanga24919.pdf + PrsThirumanimru24919.pdf + PrsVasista24919.pdf")
# TNPCB's CEPI plan for Mettur (January 2020), section 1.1, PDF p.8: the four core-zone reference points (lat DMS, lon DMS), joined N, E, S, W.
CEPI = {
    "points": [((11, 49, 38.13), (77, 50, 29.88), "North"), ((11, 47, 38.7), (77, 51, 3.52), "East"),
               ((11, 45, 12.63), (77, 47, 45.89), "South"), ((11, 47, 58.91), (77, 48, 20.67), "West")],
    "name": "Mettur CEPI area, core zone: outer frame", "statedKm2": 38.5,
    "facts": {
        "latestScore": "19.658 on TNPCB's post-monsoon 2025 evaluation (TNPCB score sheet); 19.7 in TNPCB's policy note 2026-27 (p.94)",
        "cepiScore": "71.82 (Air 41.25, Water 19.38, Land 69.38), CPCB's 2017-18 assessment as the plan prints it (plan, p.5)",
        "earlierScore": "66.98 in CPCB's 2009 assessment (Comprehensive Environmental Assessment of Industrial Clusters, Table 8)",
        "unitsInThePlan": "92 units in the CEPI area, 67 red and 25 orange category (plan, p.12)",
        "source": "TNPCB, Evaluation of CEPI score and action plan for CEPI area of Mettur, Salem district, January 2020 (TNPCB and CPCB websites)",
    },
    "provenance": "TNPCB, Evaluation of CEPI score and action plan for CEPI area of Mettur, Salem district (January 2020), section 1.1: the four core-zone reference points, joined North, East, South, West",
    "sourceFile": "CEPI_MttrRpt4920.pdf",
}
REPO_FAMILIES = (
    ("monitoring-points", "public/data/basins/cauvery-tn/wq-stations.geojson", "near", "TNPCB stretch-wise monthly water-quality reports, January to December 2023 (the last year published); classes are the worst monthly use-based class of 2023; station points are town centres, as ingested for the Cauvery (Tamil Nadu) basin", "cauvery-tn/wq-stations.geojson"),
)

# Build order: the inventory lists families in this order.
STEPS = ("waterways", "prs", "repo-families", "reservoirs", "tanks", "industries", "estates", "quarries", "admin", "panchayats", "waterbodies", "watersheds",
         "groundwater-wells", "canals", "cepi", "gauging-stations")

# Envelopes (scripts/nvdm_envelope_district_basin.py): the shared TN families.
ENVELOPE_SOURCES = {
    **TN_ENVELOPE_SOURCES,
    "tngis": ("tngis-open-geoserver", "TNGIS open GeoServer (WFS): district, taluk, block and village panchayat boundaries, TN WRD sub-basins and reservoirs, micro-watershed atlas, all-water-bodies and all-tanks registers, mine leases, industry register matched to land parcels",
              "Tamil Nadu e-Governance Agency (TNGIS)", {"url": TNGIS}),
    "sipcot": ("sipcot-gis-geoserver", "SIPCOT GIS (WFS): industrial complex outlines, Salem",
               "State Industries Promotion Corporation of Tamil Nadu (SIPCOT)", {"url": "https://sipcotgis.tn.gov.in/"}),
    "osm": ("osm-overpass", "OpenStreetMap (Overpass API extract: named river courses)", "OpenStreetMap contributors", {}),
    "cwc-river": ("nwic-nwdp-cwc-river-data", "CWC river discharge (manual daily) and surface water quality for Tamil Nadu, National Water Data Portal",
                  "Central Water Commission, via the National Water Informatics Centre (NWIC)", {"url": f"{NWDP}/"}),
}
ENVELOPE_ARTIFACTS, ENVELOPE_INPUTS, ENVELOPE_NOTE = tn_envelope(BASIN_ID, ATLAS_SLUG, (
    "Salem district's rivers, groundwater and industry (scope salem-rivers; the district's own scope id is tn-salem). "
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
# CWC's river network for seven rivers; CPCB's stretches, TNPCB's 2019 plans and 2023 stations; the Mettur CEPI plan.
ENVELOPE_SOURCES.update({
    "cpcb-prs": ("cpcb-prs-report", "CPCB, Polluted River Stretches for Restoration of Water Quality, 2018 and October 2025 (updated version)", "Central Pollution Control Board",
                 {"url": "https://cpcb.gov.in/polluted-river-stretches/", "as_of": "2025-10"}),
    "tnpcb-plan": ("tnpcb-prs-cauvery", "TNPCB, action plans for the Cauvery (Mettur to Mayiladuthurai), Sarabanga, Thirumanimutharu and Vasista stretches (Priority I), 2019", "Tamil Nadu Pollution Control Board",
                   {"url": "https://tnpcb.gov.in/pollutedriverstretches.php", "as_of": "2019"}),
    "cepi-plan": {"title": "Evaluation of CEPI score and action plan for CEPI area of Mettur, Salem district (January 2020), section 1.1, with TNPCB's CEPI score sheets to 2025",
                  "publisher": "Tamil Nadu Pollution Control Board, also published by the Central Pollution Control Board", "license": "government plan document, cited with attribution",
                  "closed": True, "as_of": "2026-06", "role": "input"},
    "tnpcb-wq": ("tnpcb-prs-cauvery", "TNPCB stretch-wise monthly water-quality reports, January to December 2023 (the last year published)", "Tamil Nadu Pollution Control Board",
                 {"url": "https://tnpcb.gov.in/pollutedriverstretches.php", "as_of": "2023-12"}),
    "cwc-rivers": ("nwic-nwdp-cwc-river-network", "CWC river network (River_Network), National Water Data Portal", "Central Water Commission, via the National Water Informatics Centre (NWIC)",
                   {"url": f"{NWDP}/", "as_of": "2025-11"}),
})
_SHEDS, _RIVERS = (f"public/data/basins/{BASIN_ID}/{f}.geojson" for f in ("sub-hydrosheds", "rivers"))
ENVELOPE_ARTIFACTS.update({"rivers": ["osm", "cwc-canals", "cwc-rivers", "tngis"], "monitoring-points": ["tnpcb-wq", "osm", "tngis"],
                           "prs": ["cpcb-prs", "tnpcb-plan", "osm", "cwc-rivers", "tngis"], "prs-drains": ["tnpcb-plan", "tngis"], "cepi-area": ["cepi-plan", "tngis"]})
ENVELOPE_INPUTS.update({"monitoring-points": ["public/data/basins/cauvery-tn/wq-stations.geojson", _SHEDS], "prs": [_RIVERS], "prs-drains": [_RIVERS, _SHEDS],
                        "cepi-area": [_SHEDS]})
ENVELOPE_ARTIFACTS["inventory"] += ["tnpcb-wq", "cwc-rivers", "cpcb-prs", "tnpcb-plan"]
ENVELOPE_READINGS = TN_ENVELOPE_READINGS


if __name__ == "__main__":
    raise SystemExit(DistrictBasinBuild(sys.modules[__name__]).main(sys.argv[1:]))
