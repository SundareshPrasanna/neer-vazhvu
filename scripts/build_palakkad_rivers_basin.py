#!/usr/bin/env python3
"""Assemble the palakkad-rivers Basin Atlas families: Palakkad district as the
frame, the river basins inside it as the sheds, and the rivers, reservoirs,
wetlands, flood zones, wells and gauges that fall in it.

This file is Palakkad's configuration of the district basin engine
(scripts/lib/tn_district_basin.py): data only. The frame and the served
layers are KSREC's (FRAME, WFS_FAMILIES), the reservoirs are read from the
Kerala SDMA daily dam bulletins (KSDMA_RESERVOIRS), wells and river gauges
from the National Water Data Portal. No step here is Palakkad's own.

Sources (fetched once, cached under .cache/palakkad-rivers/, gitignored):
  KSREC GeoServer, Kerala:Kerala_Lsgd_Boundary_Lsgdcode   boundary (union of the district's local bodies), admin-gp, admin-block, admin-ulb
  KSREC GeoServer, Kerala:WATERSHED_KERALA                 sub-hydrosheds (river basins), watersheds
  KSREC GeoServer, wetland, paddy, quarry and flood layers wetlands, paddy, quarries, flood-zones
  OpenStreetMap waterway=river (Overpass)                  rivers
  NWDP, CWC 'Canal Network' + 'Command Area'               canals, command-areas (needs ogr2ogr once)
  Kerala SDMA daily dam bulletins (IRR-SITE PDFs)          reservoirs + readings/reservoir-<key>.json
  NWDP, KSGWD manual monthly + KSGWD and CGWB telemetry   groundwater-wells
  NWDP, CWC river discharge (Kerala)                       gauging-stations + readings/cwc-<station>.json
  KSPCB monthly NWMP data (PDF, kspcb.kerala.gov.in/nwmp)  monitoring-points + readings/wq-<code>.json

KSREC publishes no licence; its layers are served with attribution to KSREC.
Layers KSREC derived from OpenStreetMap (quarries) carry ODbL.

Usage:
  python3 scripts/build_palakkad_rivers_basin.py          full build (every family)
  python3 scripts/build_palakkad_rivers_basin.py --live   weekly refresh of the living feeds only
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from lib.tn_district_basin import NWDP, DistrictBasinBuild  # noqa: E402

BASIN_ID = "palakkad-rivers"
GENERATED_FROM = Path(__file__).name
DISTRICT_LGD = "563"  # as the NWDP telemetry prints Palakkad's District LGD Code
DISTRICT_NAME = "Palakkad"
NWDP_DISTRICT = "PALAKKAD"
ATLAS_SLUG = "palakkad"

KSREC = "http://ksrec.in:9090/geoserver/ows"
KSREC_LABEL = "KSREC GeoServer (ksrec.in), Kerala State Remote Sensing and Environment Centre"
LSG = "Kerala:Kerala_Lsgd_Boundary_Lsgdcode"
DISTRICT_CQL = "DISTRICT='Palakkad'"
# The layer types four Grama Panchayats as 'Block Panchayat' (Kongad, Pattithara, Vadakkancheri, Malampuzha).
PANCHAYAT_TYPES = ["Grama Panchayat", "Block Panchayat"]

FRAME = {
    "url": KSREC,
    "boundary": {
        "typeName": LSG, "cql": DISTRICT_CQL, "sourceFile": LSG,
        "provenance": f"{KSREC_LABEL}: the district as the union of its local bodies' boundaries",
    },
    "sheds": {
        "typeName": "Kerala:WATERSHED_KERALA", "cql": "DISTRICT_1='Palakkad'", "sourceFile": "Kerala:WATERSHED_KERALA",
        # The watershed atlas code opens with the river basin's number (20B13a: basin 20, Bharathapuzha).
        "keyField": "WSCODE", "keyPattern": r"^(\d+)", "nameField": "WSNAME", "idPrefix": "RB",
        "names": {"20": "Bharathapuzha", "22": "Bhavani", "16": "Chalakudy", "19": "Kanjiramukku", "23": "Kadalundi", "17": "Karuvannur", "18": "Keecheri", "24": "Chaliyar"},
        "provenance": f"{KSREC_LABEL}: river basins of the Kerala watershed atlas (Kerala:WATERSHED_KERALA), grouped on the basin number that opens each watershed code, cut to the district",
    },
}

WFS_FAMILIES = (
    {"family": "watersheds", "typeName": "Kerala:WATERSHED_KERALA", "cql": "DISTRICT_1='Palakkad'", "dissolveBy": "WSCODE",
     "properties": {"code": "WSCODE", "basin": "WSNAME"}, "simplify": 0.0004, "sliced": True, "sourceFile": "Kerala:WATERSHED_KERALA",
     "provenance": f"{KSREC_LABEL}: Kerala watershed atlas (Kerala:WATERSHED_KERALA), dissolved on the watershed code and cut to the district"},
    # The wetland layer also carries paddy as a class; paddy is served from its own layer below.
    {"family": "wetlands", "typeName": "Kerala:Wetland_Keralaupdated", "cql": "DISTRICT_1='Palakkad'", "kindField": "Level_3",
     "where": {"Level_3": ["Tanks/Ponds", "River/Stream", "Reservoir", "Waterlogged", "Mangroves"]},
     "properties": {"name": "Wetname", "system": "Level_1", "origin": "Level_2"}, "minAreaHa": 0.1, "simplify": 0.0001, "sliced": True,
     "sourceFile": "Kerala:Wetland_Keralaupdated",
     "provenance": f"{KSREC_LABEL}: wetlands of Kerala (Kerala:Wetland_Keralaupdated) other than paddy, by class as KSREC classifies them; parts under 0.1 ha left out"},
    {"family": "paddy", "typeName": "Kerala:Paddy_Kerala", "cql": "DISTRICT_1='Palakkad'", "kindField": "Level_4",
     "minAreaHa": 1.0, "simplify": 0.0002, "sliced": True, "sourceFile": "Kerala:Paddy_Kerala",
     "provenance": f"{KSREC_LABEL}: paddy wetlands of Kerala (Kerala:Paddy_Kerala), by the status KSREC records for each parcel (Paddy, Fallow, Reclaimed, Waterlogged and others, as KSREC prints them); parts under 1 ha left out"},
    {"family": "flood-zones", "typeName": "Kerala:Flood_Kerala_GCS", "cql": "District_1='Palakkad'", "kindField": "Year",
     "kindMap": {"10": "10-year", "25": "25-year", "50": "50-year", "100": "100-year", "200": "200-year", "500": "500-year"},
     "properties": {"localBody": "LB_NAME_EN"}, "simplify": 0.0002, "sliced": True, "sourceFile": "Kerala:Flood_Kerala_GCS",
     "provenance": f"{KSREC_LABEL}: flood extents by local body (Kerala:Flood_Kerala_GCS); the layer's 'Year' field carries 10, 25, 50, 100, 200 and 500, the return periods of the Kerala SDMA flood-hazard maps"},
    {"family": "quarries", "typeName": "Kerala:Quarry_Kerala", "kind": "quarry", "properties": {"name": "name"}, "sourceFile": "Kerala:Quarry_Kerala",
     "provenance": f"{KSREC_LABEL}: quarries (Kerala:Quarry_Kerala), as KSREC drew them from OpenStreetMap (landuse=quarry); ODbL 1.0, OpenStreetMap contributors"},
    {"family": "admin-gp", "typeName": LSG, "cql": DISTRICT_CQL, "where": {"type": PANCHAYAT_TYPES},
     "properties": {"name": "LB_NAME_EN", "block": "BLOCK"}, "simplify": 0.0002, "sourceFile": LSG,
     "provenance": f"{KSREC_LABEL}: Grama Panchayat boundaries (Kerala:Kerala_Lsgd_Boundary_Lsgdcode)"},
    {"family": "admin-block", "typeName": LSG, "cql": DISTRICT_CQL, "where": {"type": PANCHAYAT_TYPES}, "dissolveBy": "BLOCK",
     "properties": {"name": "BLOCK"}, "simplify": 0.0003, "sourceFile": LSG,
     "provenance": f"{KSREC_LABEL}: development blocks, each the union of its Grama Panchayats' boundaries (Kerala:Kerala_Lsgd_Boundary_Lsgdcode)"},
    {"family": "admin-ulb", "typeName": LSG, "cql": DISTRICT_CQL, "where": {"type": ["Municipality"]},
     "properties": {"name": "LB_NAME_EN"}, "simplify": 0.0002, "sourceFile": LSG,
     "provenance": f"{KSREC_LABEL}: municipality boundaries (Kerala:Kerala_Lsgd_Boundary_Lsgdcode)"},
)

# Reservoirs in the Kerala SDMA irrigation bulletin that lie in the district, anchored on every full reservoir level the
# bulletins have printed; positions are OpenStreetMap dam features. Moolathara regulator is in the bulletin but has no
# mapped position yet, so it is not drawn. The Parambikulam, Thunakkadavu and Peruvaripallam dams lie in the district
# but are not in the Kerala bulletin, so they carry no reading here.
OSM = "OpenStreetMap"
KSDMA_RESERVOIRS = (
    {"key": "malampuzha", "display": "Malampuzha", "names": ("Malampuzha",), "frls": (115.06,), "position": (76.68619, 10.82944), "positionSource": f"{OSM} way 39391396"},
    {"key": "walayar", "display": "Walayar", "names": ("Walayar",), "frls": (203.00,), "position": (76.85311, 10.83821), "positionSource": f"{OSM} node 9815272498"},
    {"key": "meenkara", "display": "Meenkara", "names": ("Meenkara",), "frls": (156.36,), "position": (76.79809, 10.62117), "positionSource": f"{OSM} way 203608649"},
    {"key": "chulliyar", "display": "Chulliyar", "names": ("Chulliyar", "Chulliar"), "frls": (154.08,), "position": (76.7679, 10.59376), "positionSource": f"{OSM} way 380188639"},
    {"key": "pothundy", "display": "Pothundy", "names": ("Pothundy",), "frls": (108.20,), "position": (76.62533, 10.54537), "positionSource": f"{OSM} way 1457500812"},
    {"key": "mangalam", "display": "Mangalam", "names": ("Mangalam",), "frls": (77.88,), "position": (76.53335, 10.51548), "positionSource": f"{OSM} way 369617400"},
    {"key": "kanjirappuzha", "display": "Kanjirappuzha", "names": ("Kanjirappuzha", "Kanjirapuzha"), "frls": (97.50, 97.23), "position": (76.53863, 10.98562), "positionSource": f"{OSM} way 489736951"},
    {"key": "siruvani", "display": "Siruvani", "names": ("Siruvani",), "frls": (878.50,), "position": (76.64212, 10.97681), "positionSource": f"{OSM} way 203608636",
     "note": "The bulletin prints Siruvani as 'Inter state waters'."},
    {"key": "parambikulam", "display": "Parambikulam", "names": ("Parambikulam",), "frls": (), "gauged": False, "position": (76.76906, 10.38747), "positionSource": f"{OSM} way 601199526",
     "note": "Not in the Kerala SDMA irrigation bulletin, so no reading is carried here."},
    {"key": "thunakkadavu", "display": "Thunakkadavu", "names": ("Thunakkadavu",), "frls": (), "gauged": False, "position": (76.78208, 10.43419), "positionSource": f"{OSM} way 601218420",
     "note": "Not in the Kerala SDMA irrigation bulletin, so no reading is carried here."},
    {"key": "peruvaripallam", "display": "Peruvaripallam", "names": ("Peruvaripallam",), "frls": (), "gauged": False, "position": (76.7666, 10.44767), "positionSource": f"{OSM} way 814092549",
     "note": "Not in the Kerala SDMA irrigation bulletin, so no reading is carried here."},
)

# Kerala's groundwater-level resources on NWDP. The manual set names its own columns ('Well No', 'Logitude'); its
# 'Water Level' is metres below ground (co-located telemetry agrees to within centimetres).
MANUAL_FIELDS = {"station": "Well No", "agency": "Agency", "tehsil": "Block", "lat": "Latitude", "lon": "Logitude", "time": "Monitoring Date", "value": "Water Level"}
NWDP_WELL_SETS = (
    ("state-manual", "085ff394-b78d-4502-895e-9c0c5e0b0842", "nwdp-ksgwd-manual.json", "Kerala Ground Water Department manual wells, monthly, 2000 to 2026", MANUAL_FIELDS),
    ("state-telemetry", "c471836e-83f8-4e02-a5a0-00c66c996843", "nwdp-ksgwd-telemetry-2026.json", "Kerala Ground Water Department telemetry, six-hourly, 2026"),
    ("cgwb-telemetry", "570f6e27-38e7-4cda-a855-ee63ed9c26bb", "nwdp-cgwb-telemetry-kl-2026.json", "CGWB telemetry, six-hourly, 2026"),
)
WELLS_PROVENANCE = "National Water Data Portal (NWIC, nwdp.nwic.gov.in): groundwater level datasets for Kerala, PALAKKAD-tagged stations placed by their coordinates; depth in metres below ground level, sign convention read per station from its own median, sentinel values, stuck sensors and readings outside the physical envelope dropped"

# KSPCB's monthly NWMP results: one sheet printed to PDF a month, the page listing the latest eight (the served series
# keeps every month read before). Station code: name and river as the report prints them, the use class KSPCB assigns,
# position (lon, lat) as the March 2026 report prints it. These are the nine monthly river stations the report places
# in Palakkad. Its groundwater stations (2327, 5219) are left to the wells layer, and the state programme's (SWMP)
# ten Palakkad stations print no coordinates, so they wait for reviewed positions.
WQ_REPORTS = {
    "listing": "https://kspcb.kerala.gov.in/nwmp", "title": r"NWMP DATA\s+([A-Za-z]+)\s+(\d{4})", "raw": "/0?raw=1",
    "agency": "KSPCB", "purpose": "National Water Quality Monitoring Programme (NWMP), monthly river sample",
    "label": "Kerala State Pollution Control Board, monthly NWMP water quality data",
    "positionNote": "Position as KSPCB's March 2026 NWMP report prints it.",
    "provenance": "Kerala State Pollution Control Board monthly NWMP water quality data (kspcb.kerala.gov.in/nwmp), read from the PDF each month: stations the report places in Palakkad, positions as printed, one laboratory sample a month in readings/",
}
WQ_REPORT_STATIONS = {
    "2332": ("Bharathapuzha at Pattambi", "Bharathapuzha", "C (drinking water source)", (76.185131, 10.799658)),
    "2328": ("Bharathapuzha reservoir at Malampuzha", "Bharathapuzha (Malampuzha)", "D (propagation of wildlife, fisheries)", (76.680693, 10.829122)),
    "2326": ("Korayar near Naragampally bridge, Kanjikode", "Korayar", "D (propagation of wildlife, fisheries)", (76.717475, 10.789783)),
    "3460": ("Kalpathi puzha at Kalpathi", "Kalpathi puzha", "D (propagation of wildlife, fisheries)", (76.651378, 10.791581)),
    "5215": ("Chitturpuzha at Chittur bridge", "Chitturpuzha", "D (propagation of wildlife, fisheries)", (76.718696, 10.690035)),
    "5216": ("Kannadippuzha at Thirunellayi bridge", "Kannadippuzha", "D (propagation of wildlife, fisheries)", (76.624268, 10.75357)),
    "1208": ("Bhavani at Elachivazhy", "Bhavani", "D (propagation of wildlife, fisheries)", (76.692725, 11.169886)),
    "5217": ("Nellipuzha at Nellipuzha bridge, Mannarkkad", "Nellipuzha", "E (irrigation, industrial cooling, controlled waste)", (76.469277, 10.992514)),
    "5218": ("Kunthipuzha at Mannarkkad", "Kunthipuzha", "D (propagation of wildlife, fisheries)", (76.44377778, 10.9911111)),
}

# CWC river discharge for Kerala on NWDP (1950-2000, 2001-2025, 2026-2030). No Kerala water-quality set is read yet.
CWC_DISCHARGE = ("7132d8ae-3174-408d-8ef3-37aa00752787", "c3cbe74d-2442-4496-aab2-21e8b5faa12e", "4c771ce1-6646-4dbc-9984-e40a3d5bd21f")
CWC_WQ_CHEMICAL = ()
CWC_WQ_BIOLOGICAL = ()
# Kottathara (Attappadi, tagged PALGHAT, River column 'Cauvery') plots 3.2 km from the mapped Bhavani and its river is
# not printed, so it is left out until its river is established.
CWC_STATIONS = {"KUMBIDI": "bharathapuzha", "MANKARA": "bharathapuzha", "PUDUR": "bharathapuzha", "PULAMANTHOLE": "kunthipuzha"}

CWC_CANALS_FILE, CWC_COMMAND_FILE = "cwc-canals-palakkad.geojson", "cwc-command-palakkad.geojson"
CWC_LAYERS = {
    CWC_CANALS_FILE: (f"{NWDP}/dataset/dd11dfc1-6723-4603-9426-a03e4c8cf50c/resource/75e4b705-44b3-4b4a-a32f-060eeae7b907/download/canal_network.zip", "Canal_Network.shp"),
    CWC_COMMAND_FILE: (f"{NWDP}/dataset/a4fde712-4a1f-461b-897a-411ebb29a622/resource/19966957-ccfc-4341-ab11-ca72da5953f4/download/command_area.zip", "Command_Area.shp"),
}
CWC_CLIP = ("75.95", "10.25", "77.05", "11.35")
CANALS_PROVENANCE = "CWC canal network (National Water Data Portal, 2025), cut to the district"

RIVER_ALIASES = {
    "bharathapuzha": ("bharathapuzha", "bharathappuzha", "nila"),
    "gayathri": ("gayathri",),
    "kannadipuzha": ("kannadipuzha", "kannadi"),
    "kunthipuzha": ("kunthipuzha", "kunthi"),
    "bhavani": ("bhavani",),
    "parambikulam": ("parambikkulam", "parambikulam"),
}
RIVER_NAMES = {"bharathapuzha": "Bharathapuzha", "gayathri": "Gayathripuzha", "kannadipuzha": "Kannadipuzha",
               "kunthipuzha": "Kunthipuzha", "bhavani": "Bhavani", "parambikulam": "Parambikulam"}
WATERWAYS_PROVENANCE = "Rivers: OpenStreetMap waterway courses (Overpass), clipped to the district plus 1.6 km so boundary rivers stay"

STEPS = ("waterways", "canals", "ksdma-reservoirs", "wfs-families", "groundwater-wells", "gauging-stations", "wq-report-stations")

# Envelopes (scripts/nvdm_envelope_district_basin.py): registry id, title, publisher, extra fields.
ENVELOPE_SOURCES = {
    "ksrec": ("ksrec-open-geoserver", "KSREC GeoServer (WFS): local-body boundaries, watershed atlas, wetlands, paddy, notified wetland parcels, flood extents and quarries of Kerala",
              "Kerala State Remote Sensing and Environment Centre (KSREC)", {"url": KSREC}),
    "osm": ("osm-overpass", "OpenStreetMap (Overpass API extract: named river courses; dam positions)", "OpenStreetMap contributors", {}),
    "cwc-canals": ("nwic-nwdp-cwc-canal-network", "CWC canal network and water resource project (command area) layers, National Water Data Portal",
                   "Central Water Commission, via the National Water Informatics Centre (NWIC)", {"url": NWDP, "as_of": "2025"}),
    "cwc-river": ("nwic-nwdp-cwc-river-data", "CWC river discharge (manual daily) for Kerala, National Water Data Portal", "Central Water Commission, via the National Water Informatics Centre (NWIC)", {"url": NWDP}),
    "nwdp-gw": ("nwic-nwdp-groundwater-level", "National Water Data Portal: groundwater level datasets for Kerala (KSGWD manual monthly 2000-2030, KSGWD telemetry 2026-2030, CGWB telemetry 2026-2030)",
                "National Water Informatics Centre (NWIC), Ministry of Jal Shakti", {"url": NWDP}),
    "kspcb": ("kspcb-nwmp-monthly", "Kerala State Pollution Control Board, monthly NWMP water quality data (PDF reports)", "Kerala State Pollution Control Board (KSPCB)",
              {"url": "https://kspcb.kerala.gov.in/nwmp"}),
    "ksdma": ("ksdma-dam-bulletins", "Kerala SDMA daily dam bulletins, irrigation reservoirs (IRR-SITE PDFs)", "Kerala State Disaster Management Authority", {"url": "https://sdma.kerala.gov.in/dam-water-level/"}),
}
ENVELOPE_ARTIFACTS = {
    "boundary": ["ksrec"], "sub-hydrosheds": ["ksrec"], "rivers": ["osm", "ksrec"], "canals": ["cwc-canals", "ksrec"], "command-areas": ["cwc-canals", "ksrec"],
    "reservoirs": ["ksdma", "osm", "ksrec"], "watersheds": ["ksrec"], "wetlands": ["ksrec"], "paddy": ["ksrec"],
    "flood-zones": ["ksrec"], "quarries": ["ksrec"], "admin-gp": ["ksrec"], "admin-block": ["ksrec"], "admin-ulb": ["ksrec"],
    "groundwater-wells": ["nwdp-gw", "ksrec"], "gauging-stations": ["cwc-river", "osm", "ksrec"], "monitoring-points": ["kspcb", "ksrec"],
    "inventory": ["ksrec", "osm", "cwc-canals", "cwc-river", "nwdp-gw", "ksdma", "kspcb"],
}
ENVELOPE_READINGS = {"reservoir-": ["ksdma"], "cwc-": ["cwc-river"], "wq-": ["kspcb"]}
ENVELOPE_NOTE = (
    "Palakkad district's rivers, reservoirs, wetlands and groundwater (scope palakkad-rivers; the district's own scope id is kl-palakkad). "
    "The district is the union of its local bodies in KSREC's layer and the catchments (shedId) are the river basins of KSREC's watershed atlas cut to it. "
    "KSREC publishes no licence and its layers are served with attribution; its quarry layer is OpenStreetMap's (ODbL)."
)

if __name__ == "__main__":
    raise SystemExit(DistrictBasinBuild(sys.modules[__name__]).main(sys.argv[1:]))
