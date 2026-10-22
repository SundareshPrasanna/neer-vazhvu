#!/usr/bin/env python3
"""Assemble the ranipet-rivers Basin Atlas families: Ranipet district as the frame, TN WRD
sub-basin catchments clipped to it as the sheds, and the named rivers that cross it.

Ranipet's configuration of the Tamil Nadu district basin engine
(scripts/lib/tn_district_basin.py), scaffolded by scripts/new_district_basin.py on 2026-10-22.
Ranipet straddles two basins. The Palar crosses it from west to east past Arcot and Ranipet, with the Ponnai joining from
the north and the Cheyyar catchment (the Kalavimaduvu) in the south; the north drains to the Chennai basin through the
Kosasthalaiyar and its tributary the Nandi, and through the Kallar, fed by the Kaveripakkam Ar, towards the Cooum. OSM
names the main rivers; the Kallar and Kalavimaduvu are drawn on CWC's river network. Ranipet was carved from Vellore
district in 2019.

Sources (fetched once, cached under .cache/ranipet-rivers/, gitignored):
  TNGIS admin_master:administrative_boundary_district   boundary (LGD 731)
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
  SIPCOT GIS industrial_complex_boundary-*              industrial-estates

Inputs already in the repo:
  public/data/atlas/tn/ranipet/groundwater-taluks.json  groundwater-taluks (IN-GRES stage by taluk)
  pipeline-inputs/basins/tn-tnpcb-type-sectors.json  reviewed TNPCB type code -> sector lookup (statewide)

Writes public/data/basins/ranipet-rivers/<family>.geojson and inventory.json
through nvdm_write.write_artifact so envelopes survive a re-run. After the first build, run
scripts/nvdm_envelope_district_basin.py scripts/build_ranipet_rivers_basin.py to stamp envelopes, then
scripts/new_district_basin.py ranipet --register --write to list the files in the source registry.

Usage:
  python3 scripts/build_ranipet_rivers_basin.py          full build (every family)
  python3 scripts/build_ranipet_rivers_basin.py --live   weekly refresh of the living feeds only
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from lib.tn_district_basin import CWC_RIVER_NETWORK, NWDP, WB_NOT_A_NAME as _WB, TN_ENVELOPE_READINGS, TN_ENVELOPE_SOURCES, TNGIS, DistrictBasinBuild, tn_envelope  # noqa: E402

BASIN_ID = "ranipet-rivers"
GENERATED_FROM = Path(__file__).name
DISTRICT_LGD = "731"
DISTRICT_NAME = "Ranipet"
TNRD_DISTRICT_NAME = "Ranipet"  # as tnrd:panchayat_boundary prints district_name
NWDP_DISTRICT = "Ranipet"  # as the National Water Data Portal tags its stations
NWDP_DISTRICT_ALIASES = ("Vellore",)  # CGWB's wells keep the parent district's tag (Ranipet was carved from Vellore in 2019)
ATLAS_SLUG = "ranipet"  # public/data/atlas/tn/<slug>, the district Atlas this map links to

SIPCOT_PARKS = ("Panapakkam", "Panapakkam_MLFAC", "Panapakkam_SEZ", "Ranipet1", "Ranipet2")  # SIPCOT GIS layers whose extent centres in the district (probe 2026-10-22)
ESTATES_PROVENANCE = "SIPCOT GIS (sipcotgis.tn.gov.in): industrial complex outlines, Panapakkam, Panapakkam MLFAC, Panapakkam SEZ, Ranipet1, Ranipet2; area as SIPCOT states it"
ESTATES_SOURCE_FILE = "cite:industrial_complex_boundary-*"
# CWC's national canal and command-area layers on NWDP (shapefile zips, Lambert conformal conic).
CWC_CANALS_FILE, CWC_COMMAND_FILE = "cwc-canals-ranipet.geojson", "cwc-command-ranipet.geojson"
CWC_RIVERS_FILE = "cwc-rivers-ranipet.geojson"
# OSM names no Kallar inside the district; CWC's river network does (river_id -> rivname).
# Kallar is drawn only where OSM's Kosasthalaiyar does not already run: the two sources draw one channel for 21.3 km.
CWC_RIVER_LINES = {"kallar": "Kallar", "kalavimaduvu": "Kalavimaduvu"}
CWC_LINE_TRIMS = {"kallar": "kosasthalaiyar"}
CWC_LAYERS = {
    CWC_RIVERS_FILE: CWC_RIVER_NETWORK,
    CWC_CANALS_FILE: (f"{NWDP}/dataset/dd11dfc1-6723-4603-9426-a03e4c8cf50c/resource/75e4b705-44b3-4b4a-a32f-060eeae7b907/download/canal_network.zip", "Canal_Network.shp"),
    CWC_COMMAND_FILE: (f"{NWDP}/dataset/a4fde712-4a1f-461b-897a-411ebb29a622/resource/19966957-ccfc-4341-ab11-ca72da5953f4/download/command_area.zip", "Command_Area.shp"),
}
CWC_CLIP = ("79.08", "12.53", "79.89", "13.31")  # the district extent plus a margin, lon/lat
CANAL_RIVERS = {}  # none selectable like a river
CANAL_NAMES = {}
WATERWAYS_PROVENANCE = ("Rivers: the Palar, Ponnai, Cheyyar, Kosasthalaiyar, Nandi Ar and Kaveripakkam Ar from OpenStreetMap waterway courses (Overpass); the Kallar and Kalavimaduvu from CWC's river network (National Water Data Portal), "
                         "which OSM does not name in full inside the district; all clipped to the district plus 1.6 km so boundary rivers stay")
CANALS_PROVENANCE = "CWC canal network (National Water Data Portal, 2025), cut to the district"
# CWC's gauging stations NWDP tags Ranipet (the portal's River column, daily rows): Arcot (Duplicate-Palar, 4,354); Ayalambedu (Kosasthalaiyar, 1,641)
# Checked against the mapped course: Arcot sits on the Palar; Ayalambedu, which the portal files under the Kosasthalaiyar's basin, on its tributary the Nandi.
CWC_STATIONS = {"ARCOT": "palar", "AYALAMBEDU": "nandi"}
RESERVOIR_LEVELS = {}  # register name -> (CWC station, key, display name), where CWC_LEVEL_RESOURCES carries the dam
RESERVOIR_ALIASES = {}
SECTOR_LOOKUP = ROOT / "pipeline-inputs/basins/tn-tnpcb-type-sectors.json"
CETP_SCHEMES = ROOT / "pipeline-inputs/basins/ranipet-rivers/cetp-schemes.json"  # the tannery CETPs (TNPCB 2020 list, the state's June 2026 report); 3 of 4 on the register
REGISTER_YEARS = "2015 to 2024"
TNPCB_OFFICE = {"VLR": "DEE Vellore", "RPT": "DEE Ranipet"}  # the register's office codes: TNPCB's district offices, each code its office's e-mail id on tnpcb.gov.in/contact.php
SUB_BASIN_KEY = {}  # sheds keep TNGIS's object_id keys (SB<object_id>), listed in the manifest
TALUK_ALIASES = {}  # TNGIS taluk -> IN-GRES locationName; every taluk matches by name
RIVER_ALIASES = {"palar": ("palar",), "ponnai": ("ponnai",), "cheyyar": ("cheyyar", "cheyar"), "kosasthalaiyar": ("kosasthal", "kosast", "kusasthal", "kortalai"),
                 "nandi": ("nandi",), "kaveripakkam": ("kaveripak",)}  # OSM spellings folded to one river each (substring match, first hit wins)
RIVER_NAMES = {"palar": "Palar", "ponnai": "Ponnai", "cheyyar": "Cheyyar", "kosasthalaiyar": "Kosasthalaiyar", "nandi": "Nandi Ar", "kaveripakkam": "Kaveripakkam Ar",
               "kallar": "Kallar", "kalavimaduvu": "Kalavimaduvu"}  # river_id -> display name
# The register's descriptors, not names: a name would lift the body into the named layer.
WB_NOT_A_NAME = _WB | {"water catchment", "water cachment", "neerpidippu"}
# TNPCB's CEPI plan for the SIPCOT Industrial Complex, Ranipet (January 2020), p.8: the core zone's four points C-1 to C-4, decimal
# degrees as printed, joined in printed order. They enclose about half the stated 3.40 sq km; SIPCOT's Phase I and II outlines hold all four.
CEPI = {
    "points": [
        (12.950881, 79.318435, "C-1 South-East (Malladi Drugs and Pharmaceuticals Ltd., Unit I)"),
        (12.953628, 79.320325, "C-2 North-East (Malladi Drugs and Pharmaceuticals Ltd., Unit II)"),
        (12.970441, 79.30354, "C-3 North-West (Kamar Chemicals Ltd.)"),
        (12.96591, 79.295675, "C-4 South-West (SVISS Lab. Ltd.)"),
    ],
    "name": "Ranipet SIPCOT CEPI area, core zone: frame through the plan's four reference points", "statedKm2": 3.4,
    "facts": {
        "latestScore": "21.792 on TNPCB's post-monsoon 2025 evaluation (TNPCB score sheet, signed 23 June 2026); 21.8 in TNPCB's 2026-27 policy note (p.94)",
        "cepiScore": "79.38 (Air 49.0, Water 75.0, Groundwater 35.75), CPCB's March 2018 assessment as the plan prints it: a Critically Polluted Area (plan, pp.4-5, 11-13)",
        "earlierScore": "81.79 in CPCB's 2009 assessment, as 'Vellore (North Arcot)' (Comprehensive Environmental Assessment of Industrial Clusters, p.26)",
        "unitsInThePlan": "349 industries in the CPA, 130 red, 193 orange and 26 green, and 2 tannery CETPs serving 99 member tanneries (plan, p.10)",
        "moratorium": "MoEFCC's moratorium on environmental clearance, imposed 13.01.2010, was to continue for Vellore till further orders (Office Memorandum of 20.05.2016, p.3)",
        "source": "TNPCB, Evaluation of CEPI score and action plan for CEPI area of SIPCOT Industrial Complex, Ranipet, January 2020 (TNPCB and CPCB websites)",
    },
    "provenance": "TNPCB, Evaluation of CEPI score and action plan for CEPI area of SIPCOT Industrial Complex, Ranipet (January 2020), p.8: the core zone's four boundary points C-1 to C-4, joined in printed order",
    "sourceFile": "CEPI_VeloreRpt4920.pdf",
}
REPO_FAMILIES = ()

# Build order: the inventory lists families in this order.
STEPS = ("waterways", "tanks", "industries", "estates", "admin", "panchayats", "waterbodies", "watersheds", "groundwater-wells", "canals",
         "cepi", "gauging-stations")

# Envelopes (scripts/nvdm_envelope_district_basin.py): the shared TN families.
ENVELOPE_SOURCES = {
    **TN_ENVELOPE_SOURCES,
    "tngis": ("tngis-open-geoserver", "TNGIS open GeoServer (WFS): district, taluk, block and village panchayat boundaries, TN WRD sub-basins and reservoirs, micro-watershed atlas, all-water-bodies and all-tanks registers, mine leases, industry register matched to land parcels",
              "Tamil Nadu e-Governance Agency (TNGIS)", {"url": TNGIS}),
    "sipcot": ("sipcot-gis-geoserver", "SIPCOT GIS (WFS): industrial complex outlines, Panapakkam, Panapakkam MLFAC, Panapakkam SEZ, Ranipet1, Ranipet2",
               "State Industries Promotion Corporation of Tamil Nadu (SIPCOT)", {"url": "https://sipcotgis.tn.gov.in/"}),
    "osm": ("osm-overpass", "OpenStreetMap (Overpass API extract: named river courses)", "OpenStreetMap contributors", {}),
    "cwc-river": ("nwic-nwdp-cwc-river-data", "CWC river discharge (manual daily) and surface water quality for Tamil Nadu, National Water Data Portal",
                  "Central Water Commission, via the National Water Informatics Centre (NWIC)", {"url": f"{NWDP}/"}),
}
ENVELOPE_ARTIFACTS, ENVELOPE_INPUTS, ENVELOPE_NOTE = tn_envelope(BASIN_ID, ATLAS_SLUG, (
    "Ranipet district's rivers, groundwater and industry (scope ranipet-rivers; the district's own scope id is tn-ranipet). "
    "The district boundary is the frame and TN WRD's sub-basins, clipped to it, are the catchments (shedId)."))
ENVELOPE_NOTE = ENVELOPE_NOTE.replace(f"basins/{BASIN_ID}/tnpcb-type-sectors.json", "basins/tn-tnpcb-type-sectors.json")  # SECTOR_LOOKUP is statewide
for _family in ("reservoirs", "realtime-stations", "quarries"):  # nothing to serve here (probe 2026-10-22; TNGIS's mine-lease layer holds no lease in the district, first build)
    del ENVELOPE_ARTIFACTS[_family]
    ENVELOPE_INPUTS.pop(_family, None)
ENVELOPE_ARTIFACTS["inventory"] = [s for s in ENVELOPE_ARTIFACTS["inventory"] if s not in ("tnpcb-rt",)]
ENVELOPE_SOURCES["cwc-rivers"] = ("nwic-nwdp-cwc-river-network", "CWC river network (River_Network), National Water Data Portal",
                                  "Central Water Commission, via the National Water Informatics Centre (NWIC)", {"url": f"{NWDP}/", "as_of": "2025-11"})
ENVELOPE_ARTIFACTS["rivers"] = ["osm", "cwc-canals", "cwc-rivers", "tngis"]
ENVELOPE_ARTIFACTS["inventory"] += ["cwc-rivers"]
# The CETP record: TNPCB's 2020 lists (one-time, closed + dated) and the state's progress reports to NMCG.
ENVELOPE_SOURCES.update({
    "mpr": ("nmcg-ngt-mpr-listing", "Tamil Nadu monthly progress reports to NMCG under NGT O.A. 673/2018 (June 2026 edition)", "Government of Tamil Nadu, via the National Mission for Clean Ganga",
            {"url": "https://nmcg.nic.in/ngtprogressreport.aspx", "as_of": "2026-06"}),
    "tnpcb-cetp-lists": {"title": "Details of Common Effluent Treatment Plants pertaining to the Clusters of Tannery Industries in Tamil Nadu (2020), tnpcb.gov.in/cept.php",
                         "publisher": "Tamil Nadu Pollution Control Board", "license": "government register, cited with attribution", "closed": True, "as_of": "2020", "role": "input"},
})
ENVELOPE_ARTIFACTS["treatment-plants"] = ["tngis", "tnpcb-cetp-lists", "mpr"]
ENVELOPE_SOURCES["cepi-plan"] = {"title": "Evaluation of CEPI score and action plan for CEPI area of SIPCOT Industrial Complex, Ranipet (January 2020), p.8, with TNPCB's CEPI score sheets to 2026",
                              "publisher": "Tamil Nadu Pollution Control Board, also published by the Central Pollution Control Board", "license": "government plan document, cited with attribution",
                              "closed": True, "as_of": "2026-06", "role": "input"}
ENVELOPE_ARTIFACTS["cepi-area"] = ["cepi-plan", "tngis"]
ENVELOPE_INPUTS["cepi-area"] = [f"public/data/basins/{BASIN_ID}/sub-hydrosheds.geojson"]
ENVELOPE_READINGS = TN_ENVELOPE_READINGS


if __name__ == "__main__":
    raise SystemExit(DistrictBasinBuild(sys.modules[__name__]).main(sys.argv[1:]))
