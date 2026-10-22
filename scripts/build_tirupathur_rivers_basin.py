#!/usr/bin/env python3
"""Assemble the tirupathur-rivers Basin Atlas families: Tirupathur district as the frame, TN WRD
sub-basin catchments clipped to it as the sheds, and the named rivers that cross it.

Tirupathur's configuration of the Tamil Nadu district basin engine
(scripts/lib/tn_district_basin.py), scaffolded by scripts/new_district_basin.py on 2026-10-22.
Tirupathur straddles two basins. The Palar enters from Andhra Pradesh and runs east past Vaniyambadi and Ambur, joined by the
Kal Ar, the Gorautakan Ar, the Malattar and the Kallaparai Ar; the Javadhu hills in the south-east feed the Cheyyar, and
the west drains to the Pennaiyar through the Pambar. OSM names the Palar and the Cheyyar; the other rivers are drawn on
CWC's river network. Tirupathur was carved from Vellore district in 2019.

Sources (fetched once, cached under .cache/tirupathur-rivers/, gitignored):
  TNGIS admin_master:administrative_boundary_district   boundary (LGD 732)
  TNGIS generic_viewer:sub_basin                        sub-hydrosheds (clipped)
  OpenStreetMap waterway=river|canal (Overpass)         rivers
  TNGIS generic_viewer:reservoir / mines                reservoirs, quarries
  TNGIS generic_viewer:all_tanks                        tanks (named, centre points)
  TNGIS generic_viewer:all_water_bodies                 waterbodies-major, waterbodies-minor
  TNGIS generic_viewer:microwatersheds                  watersheds, sub-watersheds, mini-watersheds, micro-watersheds
  TNGIS tnrd:panchayat_boundary                         admin-gp
  NWIC National Water Data Portal (CKAN datastore)      groundwater-wells (CGWB + state telemetry 2026, CGWB manual 2021-2025)
  NWDP, CWC 'Canal Network' + 'Water Resource Project'  canals, command-areas (needs ogr2ogr once)
  TN-SMART (RIMES) reservoir dashboard                  reservoirs: today's storage for Andiappanur Odai, Kuppanatham
  NWDP, CWC river discharge + surface water quality     gauging-stations + readings/cwc-<station>.json
  TNGIS admin_master taluks + generic_viewer:block_boundary  admin-taluk, admin-block, groundwater-taluks
  TNGIS generic_viewer:industry_cad_matched             industries, treatment-plants

Inputs already in the repo:
  public/data/atlas/tn/tirupathur/groundwater-taluks.json  groundwater-taluks (IN-GRES stage by taluk)
  pipeline-inputs/basins/tn-tnpcb-type-sectors.json  reviewed TNPCB type code -> sector lookup (statewide)

Writes public/data/basins/tirupathur-rivers/<family>.geojson and inventory.json
through nvdm_write.write_artifact so envelopes survive a re-run. After the first build, run
scripts/nvdm_envelope_district_basin.py scripts/build_tirupathur_rivers_basin.py to stamp envelopes, then
scripts/new_district_basin.py tirupathur --register --write to list the files in the source registry.

Usage:
  python3 scripts/build_tirupathur_rivers_basin.py          full build (every family)
  python3 scripts/build_tirupathur_rivers_basin.py --live   weekly refresh of the living feeds only
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from lib.tn_district_basin import CWC_RIVER_NETWORK, NWDP, WB_NOT_A_NAME as _WB, TN_ENVELOPE_READINGS, TN_ENVELOPE_SOURCES, TNGIS, TNSMART, DistrictBasinBuild, tn_envelope  # noqa: E402

BASIN_ID = "tirupathur-rivers"
GENERATED_FROM = Path(__file__).name
DISTRICT_LGD = "732"
DISTRICT_NAME = "Tirupathur"
TNRD_DISTRICT_NAME = "Tirupathur"  # as tnrd:panchayat_boundary prints district_name
NWDP_DISTRICT = "Tirupathur"  # as the National Water Data Portal tags its stations
NWDP_DISTRICT_ALIASES = ("Vellore",)  # CGWB's wells and CWC's Nariyampattu gauge keep the parent district's tag (Tirupathur was carved from Vellore in 2019)
ATLAS_SLUG = "tirupathur"  # public/data/atlas/tn/<slug>, the district Atlas this map links to

# SIPCOT GIS: no layer centred in the district is an industrial estate that serves (probe 2026-10-22); left out: Bheemakulam (tourism plot); Perumapattuu (tourism plot)
# CWC's national canal and command-area layers on NWDP (shapefile zips, Lambert conformal conic).
CWC_CANALS_FILE, CWC_COMMAND_FILE = "cwc-canals-tirupathur.geojson", "cwc-command-tirupathur.geojson"
CWC_RIVERS_FILE = "cwc-rivers-tirupathur.geojson"
# OSM names none of these in full inside the district; CWC's river network does (river_id -> rivname).
# Kal Ar and Gorautakan Ar by UID: CWC gives a second line the name Kal Ar (a Cheyyar feeder in Tiruppattur taluk).
CWC_RIVER_LINES = {"pambar": "Pambu Ar", "kal-ar": ("Kal Ar", "4146"), "kallaparai": "Kallaparai Ar", "malattar": "Malattar", "gorautakan": ("Gorautakan Ar", "4149")}
CWC_LAYERS = {
    CWC_RIVERS_FILE: CWC_RIVER_NETWORK,
    CWC_CANALS_FILE: (f"{NWDP}/dataset/dd11dfc1-6723-4603-9426-a03e4c8cf50c/resource/75e4b705-44b3-4b4a-a32f-060eeae7b907/download/canal_network.zip", "Canal_Network.shp"),
    CWC_COMMAND_FILE: (f"{NWDP}/dataset/a4fde712-4a1f-461b-897a-411ebb29a622/resource/19966957-ccfc-4341-ab11-ca72da5953f4/download/command_area.zip", "Command_Area.shp"),
}
CWC_CLIP = ("78.31", "12.16", "78.98", "12.98")  # the district extent plus a margin, lon/lat
CANAL_RIVERS = {}  # none selectable like a river
CANAL_NAMES = {}
WATERWAYS_PROVENANCE = ("Rivers: the Palar and Cheyyar from OpenStreetMap waterway courses (Overpass); the Pambar, Kal Ar, Kallaparai Ar, Malattar and Gorautakan Ar from CWC's river network (National Water Data Portal), "
                         "which OSM does not name in full inside the district; all clipped to the district plus 1.6 km so boundary rivers stay")
CANALS_PROVENANCE = "CWC canal network (National Water Data Portal, 2025), cut to the district"
# CWC's gauging stations NWDP tags Tirupathur (the portal's River column, daily rows): Avarankuppam (Duplicate-Palar, 15,593)
# Checked against the mapped course: Avarankuppam sits on the Palar; Nariyampattu, which the portal files under the Palar, on its tributary the Malattar.
CWC_STATIONS = {"AVARANKUPPAM": "palar", "NARIYAMPATTU": "malattar"}
RESERVOIR_LEVELS = {}  # register name -> (CWC station, key, display name), where CWC_LEVEL_RESOURCES carries the dam
RESERVOIR_ALIASES = {}
# TN WRD register name -> the name the state's daily reservoir dashboard prints, where the two plainly match.
RESERVOIR_STORAGE = {"Andiappanur Odai": "Andiappanur Odai", "Kuppanatham": "Kuppanatham"}
SECTOR_LOOKUP = ROOT / "pipeline-inputs/basins/tn-tnpcb-type-sectors.json"
CETP_SCHEMES = ROOT / "pipeline-inputs/basins/tirupathur-rivers/cetp-schemes.json"  # the Ambur and Vaniyambadi tannery CETPs (TNPCB 2020 list, the state's June 2026 report); 2 of 3 on the register
REGISTER_YEARS = "2015 to 2024"
TNPCB_OFFICE = {"VBD": "DEE Vaniyambadi"}  # the register's office codes: TNPCB's district offices, each code its office's e-mail id on tnpcb.gov.in/contact.php
SUB_BASIN_KEY = {}  # sheds keep TNGIS's object_id keys (SB<object_id>), listed in the manifest
TALUK_ALIASES = {"Tiruppattur": "TIRUPATTUR"}  # TNGIS taluk -> IN-GRES locationName where the spellings differ
RIVER_ALIASES = {"palar": ("palar",), "cheyyar": ("cheyyar", "cheyar")}  # OSM spellings folded to one river each (substring match, first hit wins)
RIVER_NAMES = {"palar": "Palar", "cheyyar": "Cheyyar", "pambar": "Pambar", "kal-ar": "Kal Ar", "kallaparai": "Kallaparai Ar", "malattar": "Malattar",
               "gorautakan": "Gorautakan Ar"}  # river_id -> display name
# The register's descriptors, not names: a name would lift the body into the named layer.
WB_NOT_A_NAME = _WB | {"railway track"}
REPO_FAMILIES = ()

# Build order: the inventory lists families in this order.
STEPS = ("waterways", "reservoirs", "tanks", "industries", "admin", "panchayats", "waterbodies", "watersheds", "groundwater-wells",
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
    "Tirupathur district's rivers, groundwater and industry (scope tirupathur-rivers; the district's own scope id is tn-tirupathur). "
    "The district boundary is the frame and TN WRD's sub-basins, clipped to it, are the catchments (shedId)."))
ENVELOPE_NOTE = ENVELOPE_NOTE.replace(f"basins/{BASIN_ID}/tnpcb-type-sectors.json", "basins/tn-tnpcb-type-sectors.json")  # SECTOR_LOOKUP is statewide
for _family in ("industrial-estates", "realtime-stations", "quarries", "canals", "command-areas"):  # nothing to serve here (probe 2026-10-22; first build: no mine lease on TNGIS, no CWC canal or command area in the district)
    del ENVELOPE_ARTIFACTS[_family]
    ENVELOPE_INPUTS.pop(_family, None)
ENVELOPE_ARTIFACTS["inventory"] = [s for s in ENVELOPE_ARTIFACTS["inventory"] if s not in ("sipcot", "tnpcb-rt", "cwc-canals")]
if RESERVOIR_STORAGE:
    ENVELOPE_SOURCES["tnsmart"] = ("tnsmart-rimes-reservoirs", "Tamil Nadu reservoir dashboard (TN-SMART): the day's storage, depth and percentage of capacity per reservoir",
                                   "RIMES, relaying Tamil Nadu's daily reservoir storage", {"url": TNSMART})
    ENVELOPE_ARTIFACTS["reservoirs"] = ["tngis", "tnsmart"] + (["cwc-river"] if RESERVOIR_LEVELS else [])
    ENVELOPE_ARTIFACTS["inventory"] += ["tnsmart"]
ENVELOPE_SOURCES["cwc-rivers"] = ("nwic-nwdp-cwc-river-network", "CWC river network (River_Network), National Water Data Portal",
                                  "Central Water Commission, via the National Water Informatics Centre (NWIC)", {"url": f"{NWDP}/", "as_of": "2025-11"})
ENVELOPE_ARTIFACTS["rivers"] = ["osm", "cwc-rivers", "tngis"]
ENVELOPE_ARTIFACTS["inventory"] += ["cwc-rivers"]
# The CETP record: TNPCB's 2020 lists (one-time, closed + dated) and the state's progress reports to NMCG.
ENVELOPE_SOURCES.update({
    "mpr": ("nmcg-ngt-mpr-listing", "Tamil Nadu monthly progress reports to NMCG under NGT O.A. 673/2018 (June 2026 edition)", "Government of Tamil Nadu, via the National Mission for Clean Ganga",
            {"url": "https://nmcg.nic.in/ngtprogressreport.aspx", "as_of": "2026-06"}),
    "tnpcb-cetp-lists": {"title": "Details of Common Effluent Treatment Plants pertaining to the Clusters of Tannery Industries in Tamil Nadu (2020), tnpcb.gov.in/cept.php",
                         "publisher": "Tamil Nadu Pollution Control Board", "license": "government register, cited with attribution", "closed": True, "as_of": "2020", "role": "input"},
})
ENVELOPE_ARTIFACTS["treatment-plants"] = ["tngis", "tnpcb-cetp-lists", "mpr"]
ENVELOPE_READINGS = TN_ENVELOPE_READINGS


if __name__ == "__main__":
    raise SystemExit(DistrictBasinBuild(sys.modules[__name__]).main(sys.argv[1:]))
