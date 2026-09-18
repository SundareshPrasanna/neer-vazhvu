#!/usr/bin/env python3
"""Assemble the erode-rivers Basin Atlas families: Erode district as the frame,
TN WRD sub-basin catchments clipped to it as the sheds, and the named rivers
and canals that cross it.

This file is Erode's configuration of the Tamil Nadu district basin engine
(scripts/lib/tn_district_basin.py): the district's codes and names as the
registers print them, the stations and resources to read, the reviewed
inputs, and the two steps only Erode has (the CPCB polluted stretch drawn on
the Cauvery, and the CEPI frame). The engine holds every shared step.

Sources (fetched once, cached under .cache/erode-rivers/, gitignored):
  TNGIS admin_master:administrative_boundary_district   boundary (LGD 573)
  TNGIS generic_viewer:sub_basin                        sub-hydrosheds (clipped)
  OpenStreetMap waterway=river|canal (Overpass)         rivers, canals
  TNGIS generic_viewer:reservoir / mines                reservoirs, quarries
  TNGIS generic_viewer:all_water_bodies                 waterbodies-major, waterbodies-minor
  TNGIS generic_viewer:microwatersheds                  watersheds, sub-watersheds, mini-watersheds, micro-watersheds
  TNGIS tnrd:panchayat_boundary                         admin-gp
  NWIC National Water Data Portal (CKAN datastore)      groundwater-wells (CGWB + state telemetry 2026, CGWB manual 2021-2025)
  NWDP, CWC 'Canal Network' + 'Water Resource Project'   canals, command-areas, and the two canals in rivers (needs ogr2ogr once)
  TNPCB real-time water quality dashboard (JSON)         realtime-stations + readings/<station>.json (monthly sensor means)
  NWDP, CWC river discharge + surface water quality      gauging-stations + readings/cwc-<station>.json

Transcribed, with page cites, in this file (PRS_* constants):
  CPCB Polluted River Stretches, October 2025           prs (stretch editions, drawn on the OSM Cauvery course)
  TNPCB Cauvery Action Plan 2019, pp.49-50              prs-drains (the five outfalls, at the plan's coordinates)
  TNPCB NWMP annual data 2024, station 1320             where the 2025 stretch starts
  TNGIS admin_master taluks + generic_viewer:block_boundary  admin-taluk, admin-block, groundwater-taluks
  TNGIS generic_viewer:industry_cad_matched             industries, treatment-plants
  SIPCOT GIS industrial_complex_boundary-Perundurai_*   industrial-estates

Inputs already in the repo:
  public/data/basins/cauvery-tn/{tanks,wq-stations}.geojson  tanks, monitoring-points
  public/data/atlas/tn/erode/groundwater-taluks.json    groundwater-taluks (IN-GRES stage by taluk)
  pipeline-inputs/basins/erode-rivers/tnpcb-type-sectors.json  reviewed TNPCB type code -> sector lookup

Writes public/data/basins/erode-rivers/<family>.geojson and inventory.json
through nvdm_write.write_artifact so envelopes survive a re-run. Run
scripts/nvdm_envelope_erode_rivers.py after the first build to stamp envelopes.

Usage:
  python3 scripts/build_erode_rivers_basin.py          full build (every family)
  python3 scripts/build_erode_rivers_basin.py --live   weekly refresh of the living feeds only: groundwater wells, CWC flow
                                                       and water quality, reservoir levels, TNPCB sensor stations. Touches no
                                                       other family, calls no TNGIS, SIPCOT, Overpass or ogr2ogr, and puts the
                                                       previous files back if a feed comes back thinner than last week.
"""
from __future__ import annotations

import sys
from pathlib import Path

from shapely.geometry import MultiLineString, Point, Polygon, mapping, shape
from shapely.ops import substring

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from lib.tn_district_basin import NWDP, TNGIS_LABEL, DistrictBasinBuild, area_km2, dms, feat, length_km  # noqa: E402

BASIN_ID = "erode-rivers"
GENERATED_FROM = Path(__file__).name
DISTRICT_LGD = "573"
DISTRICT_NAME = "Erode"
TNRD_DISTRICT_NAME = "Erode"  # as tnrd:panchayat_boundary prints district_name
NWDP_DISTRICT = "Erode"  # as the National Water Data Portal tags its stations
ATLAS_SLUG = "erode"  # public/data/atlas/tn/<slug>, the district Atlas this map links to

SIPCOT_PARKS = ("Perundurai_DTA", "Perundurai_SEZ")
ESTATES_PROVENANCE = "SIPCOT GIS (sipcotgis.tn.gov.in): industrial complex outlines, Perundurai DTA and SEZ; area as SIPCOT states it"
ESTATES_SOURCE_FILE = "cite:industrial_complex_boundary-Perundurai_*"
# CWC's national canal and command-area layers on NWDP (shapefile zips, Lambert conformal conic).
CWC_CANALS_FILE, CWC_COMMAND_FILE = "cwc-canals-erode.geojson", "cwc-command-erode.geojson"
CWC_LAYERS = {
    CWC_CANALS_FILE: (f"{NWDP}/dataset/dd11dfc1-6723-4603-9426-a03e4c8cf50c/resource/75e4b705-44b3-4b4a-a32f-060eeae7b907/download/canal_network.zip", "Canal_Network.shp"),
    CWC_COMMAND_FILE: (f"{NWDP}/dataset/a4fde712-4a1f-461b-897a-411ebb29a622/resource/19966957-ccfc-4341-ab11-ca72da5953f4/download/command_area.zip", "Command_Area.shp"),
}
CWC_CLIP = ("76.78", "10.97", "77.99", "12.01")  # the district extent plus a margin, lon/lat
# The two canals a reader can select like a river: river_id -> the CWC line that carries it.
CANAL_RIVERS = {"lower-bhavani-project-canal": "Lower Bhavani Main Canal", "kalingarayan-canal": "Kalingarayan Channel"}
CANAL_NAMES = {"lower-bhavani-project-canal": "Lower Bhavani Project Canal", "kalingarayan-canal": "Kalingarayan Canal"}
WATERWAYS_PROVENANCE = "Rivers: OpenStreetMap waterway courses (Overpass), clipped to the district plus 1.6 km so boundary rivers stay. The two canals: CWC canal network (National Water Data Portal)"
# CWC files three unnamed "Main Canal" lines under the Kalingarayan system that lie 20 km east of it,
# beyond the district; the named Kalingarayan Channel is the canal.
CANAL_DROP = lambda p: p["prj_name"] == "Kalingarayan Anicut System" and p["can_type"] == "Main Canal" and not p.get("can_name")  # noqa: E731
CANALS_PROVENANCE = "CWC canal network (National Water Data Portal, 2025), cut to the district; three unnamed lines filed under the Kalingarayan system but lying east of the district are left out"
# TNPCB's real-time water quality monitoring dashboard: site ids of the three stations inside the district.
TNPCB_RT_SITES = (3, 4, 9)  # Kalingarayan canal upstream and downstream of Erode; Noyyal below the Orathupalayam dam
# CWC's four gauging stations on the district line (NWDP). The portal's River column prints the basin ("Cauvery")
# for all four, so the river is set here and checked against the mapped rivers.
CWC_STATIONS = {"KODUMUDI": "cauvery", "URACHIKOTTAI": "cauvery", "SAVANDAPUR": "bhavani", "ELUNUTHIMANGALAM": "noyyal"}
# Cross-check that held on 2026-09-17: the TN agriculture department printed Bhavanisagar at 53.29 ft of 105 ft
# (264.65 m with a full reservoir level of 920 ft) against 264.59 m here two days earlier; Mettur agreed within 0.3 m.
RESERVOIR_LEVELS = {"Bhavani": ("BHAVANI SAGAR DAM", "bhavanisagar", "Bhavanisagar"), "Mettur": ("METTUR RESERVOIR", "mettur", "Mettur")}  # register name -> (portal station, key, display name)
# Rows the portal prints in the wrong unit are left out, never converted. Kodumudi sits below the other three gauges, and
# its flow is normally 0.9 times their sum (median). In five months it runs 18 to 34 times their sum, the cusec-to-cumec
# factor (35.3): September 2019 reads 8,000 to 113,000 "cumec" while Urachikottai upstream read 290 to 1,994.
_KODUMUDI_CUSEC_MONTHS = ("2019-04", "2019-09", "2019-11", "2019-12", "2020-01")
CWC_FLOW_EXCLUDED_MONTHS = {("KODUMUDI", m): "" for m in _KODUMUDI_CUSEC_MONTHS}
CWC_FLOW_EXCLUDED_NOTE = {"KODUMUDI": "April, September, November and December 2019 and January 2020 are left out: the portal prints those months in cusecs (the readings run about 35 times the combined flow of the three gauges upstream)."}
FLOW_MASS_BALANCE = {"KODUMUDI": {"upstream": ("URACHIKOTTAI", "SAVANDAPUR", "ELUNUTHIMANGALAM"), "mainstem": "URACHIKOTTAI"}}
SECTOR_LOOKUP = ROOT / "pipeline-inputs/basins/erode-rivers/tnpcb-type-sectors.json"
CETP_SCHEMES = ROOT / "pipeline-inputs/basins/erode-rivers/cetp-schemes.json"
REGISTER_YEARS = "2015 to 2024"
TNPCB_OFFICE = {"PND": "DEE Perundurai", "EDL": "DEE Erode"}
# The WRD register prints Bhavanisagar as "Bhavani". NRSC's dam point for it (TNGIS
# generic_viewer:tn_reservoirs_point_nrsc, "LOWER BHAWANI") guards the alias.
RESERVOIR_ALIASES = {"Bhavani": ("Bhavanisagar (Lower Bhavani dam)", (77.09595, 11.46365), "reservoirs: the register's 'Bhavani' waterspread is not at the Bhavanisagar dam")}
WB_NOT_A_NAME = {"", "none", "no", "cauvery"}
# TN WRD sub-basin name -> the key cauvery-tn already uses (scripts/basin-sources/cauvery-tn.json).
SUB_BASIN_KEY = {
    "Upperbhavani": "114", "Lower Bhavani": "120", "Mettur Reservoir To Noyel Confluence": "123",
    "Moyar": "124", "Noyel": "126", "Palar Dodda Halla": "127", "Amaravathi": "113", "Tirumanimuttar": "129",
    "Chinnar": "115", "Dodda Halla": "117",
}
# OSM spellings folded to one trunk river each; other named waterways are not drawn yet.
RIVER_ALIASES = {
    "cauvery": ("kaveri", "cauvery"),
    "bhavani": ("bhavani",),
    "noyyal": ("noyyal", "noyal"),
    "moyar": ("moyar",),
}
RIVER_NAMES = {"cauvery": "Cauvery", "bhavani": "Bhavani", "noyyal": "Noyyal", "moyar": "Moyar"}
# Families the Cauvery (Tamil Nadu) basin already serves, cut to the district: family, repo file, clip, provenance, source label.
REPO_FAMILIES = (
    ("tanks", "public/data/basins/cauvery-tn/tanks.geojson", "district", f"{TNGIS_LABEL}: named tanks as centre points (generic_viewer:all_tanks), as ingested for the Cauvery (Tamil Nadu) basin", "cauvery-tn/tanks.geojson"),
    ("monitoring-points", "public/data/basins/cauvery-tn/wq-stations.geojson", "near", "TNPCB stretch-wise monthly water-quality reports, January to December 2023 (the last year published); classes are the worst monthly use-based class of 2023; station points are town centres, as ingested for the Cauvery (Tamil Nadu) basin", "cauvery-tn/wq-stations.geojson"),
)
# TNGIS generic_viewer:raingauge is NOT used: it places Coonoor and Burliar (The Nilgiris)
# and Bhavanisagar tens of km from where they are, so no rain gauge layer is drawn.

# TNPCB, CEPI action plan for the Erode industrial cluster (September 2020), Table 1.1 (PDF p.8): the eight reference
# points of the core zone, clockwise from the east. lat DMS, lon DMS, reference as printed.
CEPI_POINTS = (
    ((11, 21, 13.57), (77, 44, 29.68), "East (near SCM Textile Processing Mills, Karungalpalayam)"),
    ((11, 19, 58.87), (77, 44, 50.74), "South East (near Vignesh Process, Vendipalayam)"),
    ((11, 19, 43.01), (77, 44, 40.06), "South (near Railway Gate-II, Vendipalayam)"),
    ((11, 19, 15.71), (77, 43, 43.36), "South West (near Siva Narayana Printing Mills, Kollampalayam)"),
    ((11, 20, 12.28), (77, 40, 27.88), "West (near Villarasampatti Nall Road, Nasiyanoor Road)"),
    ((11, 23, 26.41), (77, 39, 31.07), "North West (near Madhan Dyeing, Chithode)"),
    ((11, 25, 5.32), (77, 40, 46.22), "North (near The Yahood Bleachers, Suriyampalayam)"),
    ((11, 23, 56.20), (77, 41, 38.55), "North East (near Pioneer Processing India)"),
)
CEPI_STATED_KM2 = 45.25
# CPCB editions of the Cauvery stretch (reviewed table: pipeline-inputs/atlas/prs/cpcb-2025.json, Annexures III A and X).
# 2018 ran from Mettur, so it covers the river's whole course on the district line; 2025 starts "at Erode near
# Virapalayam", which is TNPCB station 1320 (NWMP annual data 2024, p.3: 11.335724, 77.7538 - a scanned page, read twice).
PRS_STATION_1320 = (77.7538, 11.335724)
PRS_EDITIONS = (
    (2018, "I", "Mettur to Mayiladuthurai", None),
    (2025, "II", "Erode near Virapalayam to Pichavaram", PRS_STATION_1320),
)
# TNPCB, Action Plan on Rejuvenation of River Cauvery (2019), pp.49-50: outfall name, lat DMS, lon DMS, receiving water, page.
PRS_OUTFALLS = (
    ("Notchipallam Odai", (11, 24, 59.11), (77, 40, 55.60), "River Cauvery", 49),
    ("Sunnambu Odai", (11, 23, 39.26), (77, 42, 7.55), "River Cauvery", 49),
    ("Pitchaikaranpallam Odai", (11, 22, 18.97), (77, 43, 26.45), "River Cauvery", 50),
    ("Perumpallam Odai", (11, 20, 0.52), (77, 45, 13.38), "River Cauvery", 50),
    ("Kona Vaikkal", (11, 19, 58.95), (77, 44, 22.13), "Kalingarayan Canal", 50),
)
PRS_OUTFALL_MAX_KM = 0.5  # a transcribed point further than this from its receiving water is a transcription error


def build_prs(b: DistrictBasinBuild) -> None:
    """The CPCB stretch editions drawn on the Cauvery below Mettur, and the action plan's five outfalls."""
    rivers = b.rivers_by_id()
    canal = rivers["kalingarayan-canal"]
    # Both editions start at or below Mettur: the mapped course upstream of the Mettur reservoir is not part of either.
    mettur = next(shape(f["geometry"]).buffer(0) for f in b.cached("reservoirs.json", lambda: None)["features"]
                  if str(f["properties"].get("reservoir_name") or "").strip().title() == "Mettur")
    below = [g for g in rivers["cauvery"].geoms if max(c[1] for c in g.coords) < mettur.bounds[3] and g.centroid.y < mettur.centroid.y]
    dropped_km = round(length_km(rivers["cauvery"]) - sum(length_km(g) for g in below), 1)
    cauvery = MultiLineString(below)
    print(f"    {dropped_km} km of mapped course upstream of the Mettur reservoir left out of the stretch")
    feats = []
    for year, priority, wording, start in PRS_EDITIONS:
        reach = cauvery
        if start:
            pt = Point(start)
            if pt.distance(cauvery) * 110 > PRS_OUTFALL_MAX_KM:
                raise SystemExit("prs: the stretch start point is not on the mapped Cauvery")
            geoms = list(cauvery.geoms)
            nearest = min(range(len(geoms)), key=lambda i: geoms[i].distance(pt))
            parts = []
            for i, g in enumerate(geoms):
                if i == nearest:
                    d = g.project(pt)
                    a, c = substring(g, 0, d), substring(g, d, g.length)
                    parts.append(a if a.centroid.y < c.centroid.y else c)  # the river runs north to south here
                elif g.centroid.y < pt.y:
                    parts.append(g)
            reach = MultiLineString(parts)
        km = round(length_km(reach), 1)
        feats.append(feat(mapping(reach), {
            "kind": "prs", "year": year, "priority": priority, "length_km": km, "river": "Cauvery",
            "label": f"Polluted stretch {year}, inside the district ({km} km, Priority {priority})",
            "cpcbWording": wording, "source": "CPCB stretch wording, drawn on the OpenStreetMap course of the Cauvery inside the district; the stretch continues downstream of it",
            "shedId": "SB123",
        }))
        print(f"    {year}: {km} km inside the district, Priority {priority}")
    b.emit("prs", feats, "CPCB, Polluted River Stretches for Restoration of Water Quality, October 2025 (Annexures III A and X), drawn on the OpenStreetMap course of the Cauvery inside the district; the 2025 stretch starts at TNPCB station 1320 (Vairapalayam)", "cpcb-2025 + osm-waterways.json")

    drains = []
    for name, lat, lon, water, page in PRS_OUTFALLS:
        pt = Point(dms(lon), dms(lat))
        km = pt.distance(canal if water == "Kalingarayan Canal" else cauvery) * 110
        if km > PRS_OUTFALL_MAX_KM:
            raise SystemExit(f"prs-drains: {name} plots {km:.2f} km from the {water} - check the transcription")
        drains.append(feat(mapping(pt), {
            "name": name, "kind": "drain-inlet", "receivingWater": water,
            "description": f"Outfall named in TNPCB's 2019 Cauvery action plan as carrying untreated sewage from Erode Corporation wards into the {water}; position is the plan's own GPS coordinate (p.{page}). The plan gives no flow or BOD for it.",
            "shedId": b.sheds.for_point(pt),
        }))
    b.emit("prs-drains", drains, "TNPCB, Action Plan on Rejuvenation of River Cauvery, Mettur to Mayiladuthurai stretch (2019), pp.49-50: outfall names and GPS coordinates as printed", "PrsCauvery24919.pdf")


def build_cepi_frame(b: DistrictBasinBuild) -> None:
    frame = Polygon([(dms(lon), dms(lat)) for lat, lon, _ in CEPI_POINTS])
    if not frame.is_valid or not b.district.contains(frame):
        raise SystemExit("cepi: the eight reference points do not make a valid polygon inside the district - check the transcription")
    km2 = round(area_km2(frame), 1)
    b.emit("cepi-area", [feat(mapping(frame), {
        "name": "Erode CEPI core zone: outer frame", "kind": "cepi-frame",
        "whatThisIs": f"A polygon through the eight boundary reference points the plan prints (Table 1.1). It encloses {km2} sq km; the plan gives the core zone as {CEPI_STATED_KM2} sq km, so the true boundary lies inside this frame. The plan's own map is an image.",
        "cepiScore": "60.33 (Air 34.12, Water 47, Land 52.75), declared by CPCB for 2017-18: a Severely Polluted Area",
        "laterScore": "25.02 on TNPCB's post-monsoon 2019 recalculation (plan, printed p.57)",
        "unitsInThePlan": "849 Red and Orange category units in the CEPI area (plan, printed p.9)",
        "source": "TNPCB, CEPI action plan for the Erode industrial cluster, September 2020 (CPCB website)", "shedId": b.sheds.for_geom(frame),
    })], "TNPCB, Comprehensive Environmental Pollution Index (CEPI) action plan for the Erode industrial cluster (September 2020), Table 1.1: the eight reference points of the core zone, joined in order", "CEPI_Action Plan_ERODE.pdf")
    print(f"    frame {km2} sq km against the plan's {CEPI_STATED_KM2}")


# Build order: the inventory lists families in this order.
STEPS = ("waterways", "reservoirs", "repo-families", "industries", "estates", "quarries", "admin", "panchayats", "waterbodies",
         "watersheds", "groundwater-wells", build_prs, "canals", build_cepi_frame, "realtime-stations", "gauging-stations")


if __name__ == "__main__":
    raise SystemExit(DistrictBasinBuild(sys.modules[__name__]).main(sys.argv[1:]))
