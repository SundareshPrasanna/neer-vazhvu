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
scripts/nvdm_envelope_district_basin.py scripts/build_krishnagiri_rivers_basin.py
after the first build to stamp envelopes.

Usage:
  python3 scripts/build_krishnagiri_rivers_basin.py          full build (every family)
  python3 scripts/build_krishnagiri_rivers_basin.py --live   weekly refresh of the living feeds only
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from shapely.geometry import Point, mapping

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from lib.tn_district_basin import NWDP, TN_ENVELOPE_READINGS, TN_ENVELOPE_SOURCES, TNGIS, TNSMART, DistrictBasinBuild, feat, tn_envelope  # noqa: E402
from nvdm_write import write_artifact  # noqa: E402

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

# The Thenpennai's monitoring record (reviewed inputs under pipeline-inputs/basins/krishnagiri-rivers/): TNPCB's monthly
# laboratory samples at the interstate entry point, as filed before the NGT, and the two one-day surveys (the NGT joint
# committee's 12 points of September 2020, the CPCB-KSPCB-TNPCB six points of October 2024). The treatment and supply
# record comes from the urban local bodies' own sheets and SIPCOT's projects page.
INPUTS = ROOT / "pipeline-inputs/basins/krishnagiri-rivers"
SAMPLES_INPUT, SURVEY_INPUT, TREATMENT_INPUT = (INPUTS / f for f in ("thenpennai-interstate-samples.json", "thenpennai-survey-points.json", "treatment-and-supply.json"))
POINT_MAX_KM = 0.5  # a river point further than this from the mapped river is a transcription error (printed coordinates are not snapped)
NGT_PDFS = "https://www.greentribunal.gov.in/sites/default/files/news_updates/"
# Parameter -> (unit, criterion, criterion label): the outdoor-bathing criteria the engine draws, plus the drinking-water
# limit for fluoride (IS 10500:2012, permissible). Metals and nutrients carry no line.
SAMPLE_SERIES = (
    ("BOD", "mg/L", 3, "BOD ≤ 3 mg/L (outdoor bathing criterion)"), ("Dissolved oxygen", "mg/L", 5, "DO ≥ 5 mg/L (outdoor bathing criterion)"),
    ("Fecal coliform", "MPN/100ml", 2500, "FC ≤ 2500 MPN/100ml (outdoor bathing criterion)"), ("Total coliform", "MPN/100ml", None, None),
    ("COD", "mg/L", None, None), ("Ammoniacal nitrogen", "mg/L", None, None), ("Phosphate", "mg/L", None, None), ("Fluoride", "mg/L", 1.5, "Fluoride ≤ 1.5 mg/L (IS 10500 permissible limit)"),
    ("Total dissolved solids", "mg/L", None, None), ("Total suspended solids", "mg/L", None, None), ("Chloride", "mg/L", None, None), ("pH", "", None, None),
    ("Nickel", "mg/L", None, None), ("Lead", "mg/L", None, None), ("Iron", "mg/L", None, None), ("Zinc", "mg/L", None, None), ("Copper", "mg/L", None, None),
)
SAMPLE_EXPLAINER = "Each point is one laboratory sample on the date shown, as TNPCB's report of analysis prints it in its filing before the NGT; months with no filed sample are gaps, not zeros."


def sample_points(doc: dict, param: str) -> tuple[list, list, int, int]:
    """[date, value] across the tables in date order; dates below the detection limit (plotted at the limit); counts of
    '<MDL' cells (no limit printed, not plotted) and illegible cells."""
    pts, below, mdl, illegible = [], [], 0, 0
    for t in doc["tables"].values():
        for d, v in zip(t["dates"], t["rows"].get(param, [None] * len(t["dates"]))):
            if v is None:
                continue
            if v == "<MDL":
                mdl += 1
            elif v == "illegible":
                illegible += 1
            elif isinstance(v, str) and v.endswith("*"):
                pts.append([d, float(v[:-1])])
                below.append(d)
            else:
                pts.append([d, float(v)])
    pts.sort()
    return pts, below, mdl, illegible


def river_check(b: DistrictBasinBuild, river, name: str, pt: Point, inside_only: bool = True) -> None:
    if inside_only and not b.district.contains(pt):
        return
    if pt.distance(river) * 110 > POINT_MAX_KM:
        raise SystemExit(f"monitoring points: {name} plots {pt.distance(river) * 110:.2f} km from the mapped Thenpennai - check the position")


def build_monitoring_record(b: DistrictBasinBuild) -> None:
    """One station with TNPCB's filed monthly samples (readings pack), plus the 2020 and 2024 survey points with their results."""
    river = b.rivers_by_id()["thenpennai"]
    doc = json.loads(SAMPLES_INPUT.read_text())
    st, series = doc["station"], []
    for param, unit, criterion, label in SAMPLE_SERIES:
        pts, below, mdl, illegible = sample_points(doc, param)
        if not pts:
            continue
        notes = []
        if below:
            notes.append(f"Below the laboratory's detection limit in {len(below)} of {len(pts)} samples; those are plotted at the limit, and the true value is lower.")
        if mdl:
            notes.append(f"{mdl} further sample{'s' if mdl > 1 else ''} printed as below the detection limit without the limit value; not plotted.")
        if illegible:
            notes.append(f"{illegible} cell{'s' if illegible > 1 else ''} unreadable on the filed page; not plotted.")
        series.append({"kind": "wq-param-series", "unit": unit, "verified": True, "label": f"{param} (laboratory sample)", "param": param, "note": " ".join(notes) or None,
                       **({"criterion": criterion, "criterionLabel": label} if criterion else {}), "explainer": SAMPLE_EXPLAINER, "points": pts, **({"belowDetection": below} if below else {})})
    dates = sorted({p[0] for s_ in series for p in s_["points"]})
    key = st["stationKey"]
    b.write_pack(key, {
        "schemaVersion": 1,
        "station": {"stationKey": key, "name": st["name"], "agency": st["agency"], "siteType": "Interstate river water-quality sampling point (monthly laboratory samples)", "river": st["river"]},
        "source": {"label": "TNPCB reports of analysis filed before the NGT (Southern Zone), O.A. 111 of 2020 and O.A. 14 of 2025", "url": NGT_PDFS, "fetched": doc["sources"][0]["retrieved"]},
        "period": {"from": dates[0], "to": dates[-1]},
        "series": series,
        "insights": [{"text": f"TNPCB reported the 2022-23 and 2023-24 monthly samples as ranges only: BOD {doc['rangesAsReported']['BOD']}, total coliform {doc['rangesAsReported']['Total coliform']}, fecal coliform {doc['rangesAsReported']['Fecal coliform']}; the sample of 26.12.2024 read BOD 134 mg/L.", "verified": True, "basis": "CPCB reply in O.A. 14 of 2025, paragraphs 8(e) and 8(f), quoting TNPCB's report of 04.03.2025"}],
    })
    pt = Point(st["position"])
    river_check(b, river, st["name"], pt)
    last = {s_["param"]: s_["points"][-1] for s_ in series}
    feats = [feat(mapping(pt), {
        "name": st["name"], "kind": "tnpcb-interstate", "stationKey": key, "hasReadings": True, "agency": st["agency"], "river": st["river"],
        "purpose": "TNPCB's monthly sampling of the river as it enters Tamil Nadu, ordered by the NGT joint committee (O.A. 111 of 2020); the Supreme Court's order of 7.7.2017 in O.S. No. 2 of 2015 set joint monthly sampling here from September 2017",
        "samplingBy": st["samplingBy"], "samplesFiled": f"{len(dates)} dated samples, {dates[0]} to {dates[-1]}; none filed for May 2021 to March 2025 (2022-23 and 2023-24 reported as ranges)",
        "latestBod": f"{last['BOD'][1]:g} mg/L ({last['BOD'][0]})", "latestDissolvedOxygen": f"{last['Dissolved oxygen'][1]:g} mg/L ({last['Dissolved oxygen'][0]})",
        "latestFecalColiform": f"{last['Fecal coliform'][1]:g} MPN/100ml ({last['Fecal coliform'][0]})",
        "positionNote": st["positionBasis"], "dataUrl": doc["sources"][1]["url"], "shedId": b.sheds.for_point(pt),
    })]
    sdoc = json.loads(SURVEY_INPUT.read_text())
    s20, s24 = sdoc["ngt2020"], sdoc["joint2024"]
    for p in s20["points"]:
        pos = p["position"]
        pt = Point(pos.get("snappedLon", pos["lon"]), pos.get("snappedLat", pos["lat"]))
        river_check(b, river, p["name"], pt)
        t = p["table1"]
        feats.append(feat(mapping(pt), {
            "name": f"{p['name']} (NGT joint committee, 9 to 10 September 2020)", "kind": "ngt-2020", "setting": p["setting"], "sampledOn": "9 and 10 September 2020", "sampledBy": s20["sampledBy"],
            "designatedBestUseClass": f"{t['class']}: {s20['classKey'][t['class']]}",
            "BOD (mg/L)": t["BOD"], "Dissolved oxygen (mg/L)": t["Dissolved oxygen"], "Fecal coliform (MPN/100ml)": t["Fecal coliform"], "Suspended solids (mg/L)": t["Suspended solids"],
            "Turbidity (NTU)": t["Turbidity"], "Conductivity (µS/cm)": t["Conductivity"], "pH": t["pH"], "SAR (meq/L)": t["SAR"], "Boron (mg/L)": t["Boron"], "Free ammonia": t["Free ammonia"],
            "reportFindings": " ".join(s20["reportFindings"]),
            "positionNote": f"{pos['ref']}; the printed table's coordinate column is blank, so the point is placed by name", "outsideDistrict": None if b.district.contains(pt) else "Yes: upstream, in Karnataka",
            "dataUrl": sdoc["sources"][0]["url"], "shedId": b.sheds.for_point(pt),
        }))
    units = s24["units"]
    for p in s24["points"]:
        pt = Point(p["lon"], p["lat"])
        river_check(b, river, p["name"], pt)
        t = p["table1"]
        props = {"name": f"{p['name']} (CPCB, KSPCB and TNPCB joint sampling, 28 October 2024)", "kind": "joint-2024", "sampledOn": "28 October 2024", "sampledBy": s24["sampledBy"],
                 "frothOn28Oct2024": p["frothOn28Oct2024"], "doObservedOnSite": p["doObservedOnSite"],
                 **({"distanceFromPreviousPointKm": p["distanceFromPreviousKm"]} if p["distanceFromPreviousKm"] else {})}
        for k, v in t.items():
            u = units.get(k, "mg/L")
            props[f"{k} ({u})" if u else k] = v
        props.update({"reportFindings": " ".join(s24["reportFindings"]), "positionNote": "Coordinates as the report's Table 2 prints them" + (" (longitude column paired in flow order, see the reviewed input)" if p["key"] in ("kelavarapalli-outfall", "mitteganahalli-bridge") else ""),
                      "outsideDistrict": None if b.district.contains(pt) else "Yes: upstream, in Karnataka", "dataUrl": sdoc["sources"][1]["url"], "shedId": b.sheds.for_point(pt)})
        feats.append(feat(mapping(pt), props))
    b.emit("monitoring-points", feats, "TNPCB's monthly laboratory samples at Chokkarasanapalli and the 2020 and 2024 joint surveys of the Thenpennai, transcribed from the reports filed before the NGT (Southern Zone) in O.A. 111 of 2020 and O.A. 14 of 2025; positions as the 2024 report prints them, the 2020 points placed by name (reviewed inputs thenpennai-interstate-samples.json and thenpennai-survey-points.json)", "greentribunal.gov.in filings", by_kind=True)
    print(f"    {key}: {len(dates)} samples, {len(series)} series; {len(s20['points'])} points of 2020, {len(s24['points'])} of 2024")


def build_treatment_and_supply(b: DistrictBasinBuild) -> None:
    """Treatment plants beyond the register (Hosur's two STPs under construction, the TSDF), the ULBs' supply and sewerage sheets, SIPCOT's TTRO plant on the estates it serves."""
    doc = json.loads(TREATMENT_INPUT.read_text())
    B = b.BASIN
    ugss, ws, km_ = doc["hosurUgss"], doc["hosurWaterSupply"], doc["krishnagiriMunicipality"]
    plants = json.loads((B / "treatment-plants.geojson").read_text())["features"]
    for f in plants:
        if f["properties"]["unitId"] == km_["registerStp"]["registerUnitId"]:
            f["properties"]["status"] = km_["registerStp"]["statusNote"]
        if f["properties"]["unitId"] == doc["tsdf"]["registerUnitId"]:
            f["properties"]["status"] = "Operating common facility for hazardous waste (register type 1072); not a sewage or effluent plant."
    scheme = f"{ugss['scheme']}: Rs.{ugss['costCrore']} crore sanctioned ({ugss['sanctions'][2]}); Rs.{ugss['expenditureCrore']} crore spent ({ugss['expenditureShare']}) as on {ugss['progressAsOn']}; " \
             f"sewage generated {ugss['sewageMld']['present']} MLD now, {ugss['sewageMld']['2054']} MLD by 2054; " + "; ".join(f"{p['name']} {p['physicalProgress']}" for p in ugss["packages"])
    for plant in ugss["plants"]:
        if "position" not in plant:
            continue
        pt = Point(plant["position"]["lon"], plant["position"]["lat"])
        plants.append(feat(mapping(pt), {
            "name": plant["name"], "kind": "stp-under-construction", "capacityMld": plant["capacityMld"], "process": plant["technology"], "status": f"Under construction: {plant['progressAsPrinted']} (corporation sheet, {ugss['progressAsOn']})",
            "scheme": scheme, "fundingAsReported": ugss["fundingAsReported"], "coverageAsReported": ugss["coverageAsReported"], "siteAsPrinted": plant["siteAsPrinted"],
            "locationNote": plant["position"]["ref"], "dataUrl": doc["sources"]["hosur-ugss"]["url"], "shedId": b.sheds.for_point(pt),
        }))
    prov = "TNGIS industry register (treatment-type units) with the urban local bodies' own sheets: Hosur Corporation's UGSS progress as on 17.06.2026 (the two STPs under construction) and Krishnagiri Municipality's sewerage page"
    b.emit("treatment-plants", plants, prov, "generic_viewer:industry_cad_matched + tnurbantree.tn.gov.in", by_kind=True)
    other = next(p for p in ugss["plants"] if "position" not in p)
    supply = [
        feat(mapping(Point(ws["position"]["lon"], ws["position"]["lat"])), {
            "name": "Hosur City Municipal Corporation: water supply and sewerage", "kind": "ulb-record", "asOn": ws["dated"], "population": ws["population"], "wards": ws["wards"], "areaSqKm": ws["areaSqKm"],
            "supplyMld": f"{ws['presentSupplyMld']} MLD: Hogenakkal scheme {ws['sourcesMld']['Hogenakkal scheme']}, local borewells {ws['sourcesMld']['Local borewells']}",
            "supplyLpcd": f"{ws['presentLpcd']} LPCD now against {ws['requirementLpcd']} LPCD ({ws['requirementMldForUgss']} MLD) required for the sewerage scheme",
            "houseServiceConnections": f"{ws['houseServiceConnections']['total']:,} ({ws['houseServiceConnections']['shareOfAssessments']} of {ws['houseServiceConnections']['propertyTaxAssessments']:,} property-tax assessments)",
            "overheadTanks": f"{ws['overheadTanks']} overhead tanks, {ws['sumps']} sumps, {ws['publicFountains']} public fountains", "boreWells2025_26": ws["boreWells2025_26"],
            "sewageTreatment": f"No operating sewage treatment plant. {scheme}. Second plant: {other['name']} at '{other['siteAsPrinted']}'; progress: {other['progressAsPrinted']}",
            "locationNote": ws["position"]["ref"], "dataUrl": doc["sources"]["hosur-ws"]["url"], "shedId": b.sheds.for_point(Point(ws["position"]["lon"], ws["position"]["lat"])),
        }),
        feat(mapping(Point(km_["position"]["lon"], km_["position"]["lat"])), {
            "name": "Krishnagiri Municipality: sewerage", "kind": "ulb-record", "asOn": doc["sources"]["krishnagiri-sewerage"]["as_of"],
            "sewerageAsPrinted": km_["sewerageAsPrinted"], "septicTanks": km_["septicTanks"], "lowCostSanitationUnits": km_["lowCostSanitationUnits"], "dryLatrines": km_["dryLatrines"],
            "publicConveniences": km_["publicConveniences"], "populationWithoutSafeDisposal": km_["populationWithoutSafeDisposal"], "registerStp": km_["registerStp"]["statusNote"],
            "locationNote": km_["position"]["ref"], "dataUrl": doc["sources"]["krishnagiri-sewerage"]["url"], "shedId": b.sheds.for_point(Point(km_["position"]["lon"], km_["position"]["lat"])),
        }),
    ]
    b.emit("water-supply", supply, "Urban water supply and sewerage as the urban local bodies' own pages print them: Hosur City Municipal Corporation's water supply sheet dated 17.06.2026 and UGSS progress as on 17.06.2026; Krishnagiri Municipality's sewerage page (read 2026-10-08)", "tnurbantree.tn.gov.in")
    ttro = doc["sipcotTtro"]
    estates = json.loads((B / "industrial-estates.geojson").read_text())
    tagged = 0
    for f in estates["features"]:
        if any(k.lower().replace("_", " ") in str(f["properties"].get("name", "")).lower().replace("_", " ") for k in ("hosur", "shoolagiri")):
            f["properties"]["industrialWaterSupply"] = f"{ttro['name']}: {ttro['asPrinted']} (SIPCOT projects page, read 2026-10-08). {ttro['note']}"
            tagged += 1
    write_artifact(B / "industrial-estates.geojson", estates, compact=True)
    print(f"    treatment plants {len(plants)}, ULB records {len(supply)}, TTRO fact on {tagged} estate outlines")


# Build order: the inventory lists families in this order.
STEPS = ("waterways", "reservoirs", "tanks", "industries", "estates", build_treatment_and_supply, "quarries", "admin", "panchayats", "waterbodies",
         "watersheds", "groundwater-wells", "canals", "realtime-stations", "gauging-stations", build_monitoring_record)

# Envelopes (scripts/nvdm_envelope_district_basin.py): the shared TN families, plus TN-SMART on the reservoirs.
ENVELOPE_SOURCES = {
    **TN_ENVELOPE_SOURCES,
    "tngis": ("tngis-open-geoserver", "TNGIS open GeoServer (WFS): district, taluk, block and village panchayat boundaries, TN WRD sub-basins and reservoirs, micro-watershed atlas, all-water-bodies and all-tanks registers, mine leases, industry register matched to land parcels",
              "Tamil Nadu e-Governance Agency (TNGIS)", {"url": TNGIS}),
    "sipcot": ("sipcot-gis-geoserver", "SIPCOT GIS (WFS): industrial complex outlines, Hosur phases I to IV, Shoolagiri and Bargur parks",
               "State Industries Promotion Corporation of Tamil Nadu (SIPCOT)", {"url": "https://sipcotgis.tn.gov.in/"}),
    "osm": ("osm-overpass", "OpenStreetMap (Overpass API extract: named river courses)", "OpenStreetMap contributors", {}),
    "cwc-river": ("nwic-nwdp-cwc-river-data", "CWC river discharge (manual daily) and surface water quality for Tamil Nadu, National Water Data Portal",
                  "Central Water Commission, via the National Water Informatics Centre (NWIC)", {"url": f"{NWDP}/"}),
    "tnsmart": ("tnsmart-rimes-reservoirs", "Tamil Nadu reservoir dashboard (TN-SMART): the day's storage, depth and percentage of capacity per reservoir",
                "RIMES, relaying Tamil Nadu's daily reservoir storage", {"url": TNSMART}),
    # One-time documents (closed + dated; no registry id exists for them): the NGT filings and the local bodies' sheets.
    "ngt-jc-report": {"title": "Progress Report of the Joint Committee in O.A. No. 111 of 2020 (SZ), NGT Southern Zone, with Annexure VII (TNPCB reports of analysis, September 2017 to April 2021)",
                      "publisher": "National Green Tribunal (Southern Zone), joint committee of CPCB, KSPCB, TNPCB and the departments named in the order of 20.07.2020", "license": "public judicial record, cited with attribution",
                      "closed": True, "as_of": "2021-05", "role": "input", "url": f"{NGT_PDFS}Progress%20Report%20of%20the%20Joint%20Committee%20in%20OA%20No%20111%20of%202020(SZ).pdf"},
    "tnpcb-ngt-2026": {"title": "Report filed by TNPCB in O.A. 111 of 2020 and O.A. 14 of 2025 (SZ), dated 10.07.2026, Annexure III (reports of analysis, April 2025 to January 2026)",
                       "publisher": "Tamil Nadu Pollution Control Board", "license": "public judicial record, cited with attribution", "closed": True, "as_of": "2026-07", "role": "input",
                       "url": f"{NGT_PDFS}OA%20111%20of%202020%20Report%20filed%20by%20R5%20TNPCB.pdf"},
    "cpcb-ngt-2025": {"title": "Reply along with affidavit filed by the Central Pollution Control Board in O.A. No. 14 of 2025 (SZ), with the joint sampling report of 28.10.2024",
                      "publisher": "Central Pollution Control Board", "license": "public judicial record, cited with attribution", "closed": True, "as_of": "2025-03", "role": "input",
                      "url": f"{NGT_PDFS}OA%2014%20of%202025%20Reply%20along%20with%20Affidavit%20by%20R2.pdf"},
    "hosur-ulb": {"title": "Hosur City Municipal Corporation: water supply details dated 17.06.2026 and UGSS progress as on 17.06.2026 (tnurbantree.tn.gov.in/hosur)",
                  "publisher": "Hosur City Municipal Corporation, Commissionerate of Municipal Administration, Government of Tamil Nadu", "license": "government page, cited with attribution",
                  "closed": True, "as_of": "2026-06-17", "role": "input", "url": "https://www.tnurbantree.tn.gov.in/hosur/sewerage/"},
    "krishnagiri-ulb": {"title": "Krishnagiri Municipality: sewerage page (tnurbantree.tn.gov.in/krishnagiri), read 2026-10-08",
                        "publisher": "Krishnagiri Municipality, Commissionerate of Municipal Administration, Government of Tamil Nadu", "license": "government page, cited with attribution",
                        "closed": True, "as_of": "2026-10-08", "role": "input", "url": "https://www.tnurbantree.tn.gov.in/krishnagiri/sewerage/"},
    "sipcot-projects": {"title": "SIPCOT projects page: TTRO plant at Hosur (20 MLD, inaugurated 13.06.2023), read 2026-10-08", "publisher": "State Industries Promotion Corporation of Tamil Nadu (SIPCOT)",
                        "license": "government page, cited with attribution", "closed": True, "as_of": "2026-10-08", "role": "input", "url": "https://sipcotweb.tn.gov.in/Projects"},
    "trade-press-ugss": {"title": "Indian Infrastructure, 26 December 2024 and 16 April 2025: the Hosur UGSS STP sites, technology and funding as reported (secondary source, for the site names and funding only)",
                         "publisher": "India Infrastructure Publishing", "license": "trade press report, cited with attribution", "closed": True, "as_of": "2025-04", "role": "input",
                         "url": "https://indianinfrastructure.com/2024/12/26/tamil-nadu-government-lays-foundation-stone-for-underground-sewerage-scheme-in-hosur/"},
}
ENVELOPE_ARTIFACTS, ENVELOPE_INPUTS, ENVELOPE_NOTE = tn_envelope(BASIN_ID, ATLAS_SLUG, (
    "Krishnagiri district's rivers, groundwater and industry (scope krishnagiri-rivers; the district's own scope id is tn-krishnagiri). "
    "The district boundary is the frame and TN WRD's sub-basins, clipped to it, are the catchments (shedId): the Thenpennai's to the east, the Cauvery's Chinnar and Dodda Halla to the south-west."))
ENVELOPE_ARTIFACTS["reservoirs"] = ["tngis", "tnsmart"]
ENVELOPE_ARTIFACTS.update({
    "monitoring-points": ["ngt-jc-report", "tnpcb-ngt-2026", "cpcb-ngt-2025", "osm", "tngis"],
    "treatment-plants": ["tngis", "hosur-ulb", "krishnagiri-ulb", "trade-press-ugss"],
    "water-supply": ["hosur-ulb", "krishnagiri-ulb", "osm"],
    "industrial-estates": ["sipcot", "tngis", "sipcot-projects"],
})
ENVELOPE_ARTIFACTS["inventory"] += ["tnsmart", "ngt-jc-report", "tnpcb-ngt-2026", "cpcb-ngt-2025", "hosur-ulb", "krishnagiri-ulb", "sipcot-projects"]
_SHEDS, _RIVERS = (f"public/data/basins/{BASIN_ID}/{f}.geojson" for f in ("sub-hydrosheds", "rivers"))
ENVELOPE_INPUTS.update({"monitoring-points": [_RIVERS, _SHEDS], "water-supply": [_SHEDS]})
ENVELOPE_READINGS = {"tnpcb-chokkarasanapalli": ["ngt-jc-report", "tnpcb-ngt-2026", "cpcb-ngt-2025"], **TN_ENVELOPE_READINGS}


if __name__ == "__main__":
    raise SystemExit(DistrictBasinBuild(sys.modules[__name__]).main(sys.argv[1:]))
