#!/usr/bin/env python3
"""Assemble the mumbai-rivers Basin Atlas families from artifacts the Mumbai
dashboard already carries, plus the FABDEM river-catchment derivation.

Inputs (all in the repo; nothing is fetched here except OSM industrial
landuse, cached under .cache/mumbai-rivers/):
  public/geojson/mumbai-corporations-2024.geojson     boundary, admin-corporation
  pipeline-inputs/mumbai-river-catchments-fabdem.geojson  city sheds (derive_mumbai_subbasins_fabdem.py)
  public/data/cascade/mumbai-cascade-catchments.geojson  lake catchments (supply sheds)
  public/geojson/mumbai-rivers.geojson                rivers, PRS geometry
  public/geojson/mumbai-water-bodies-current.geojson  waterbodies-major/minor, lake centroids
  public/data/water-bodies-lost-mumbai.json           waterbodies-lost
  public/data/mmr-dam-storage.json + src/lib/cities/mumbai.ts  reservoirs (capacities)
  public/data/river-quality-mumbai.json               monitoring-points + readings packs
  pipeline-inputs/atlas/prs/cpcb-2025.json            prs-stretches (CPCB Oct 2025)
  public/data/mumbai-cgwb-stations.json               groundwater-wells
  public/data/industrial-sources-mumbai.json + commitments-mumbai.json  infrastructure
  public/data/mumbai-flood-hotspots.geojson           flood-hotspots
  public/geojson/mumbai-drainage.geojson              drainage (heavy, sliced per shed)

Writes public/data/basins/mumbai-rivers/<family>.geojson, readings/<station>.json,
per-shed shards for the heavy families, gaps.geojson and inventory.json - all
through nvdm_write.write_artifact so envelopes survive a re-run. gaps.json is
hand-authored and not touched here. Run scripts/nvdm_envelope_mumbai_rivers.py
after the first build to stamp envelopes.

Usage: python3 scripts/build_mumbai_rivers_basin.py
"""
from __future__ import annotations

import json
import math
import re
import sys
from datetime import date
from pathlib import Path

from shapely.geometry import LineString, Point, mapping, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402

BASIN_ID = "mumbai-rivers"
BASIN = ROOT / "public/data/basins" / BASIN_ID
CACHE = ROOT / ".cache" / BASIN_ID
TODAY = date.today().isoformat()

CPCB_PRS_URL = "https://cpcb.gov.in/polluted-river-stretches/"
CPCB_PRS_LABEL = "CPCB, Polluted River Stretches for Restoration of Water Quality, October 2025 (updated version)"
MPCB_WQR_URL = "https://mpcb.gov.in/focus-area/reports-documents/water"
PRAVAH_URL = "https://mwrdpravah.in/damsafety/control/main"
CGWB_URL = "https://cgwb.gov.in/cgwbpnm/"

# The seven lakes: OSM polygon (centroid + catchment join), Pravah code, BMC share.
# BMC shares are the city config's fullCapacityMcft (BMC's published live-storage
# figures / 28.317); WRD live capacities come from the Pravah bulletin.
LAKES = [
    {"name": "Bhatsa", "liveCode": "bhatsa", "osm_id": 7112404, "bmcShareMcft": 25321.9, "fallback": (73.45, 19.55),
     "supplyShare": "About 48% of BMC's supply (BMC Hydraulic Engineer's Department)"},
    {"name": "Upper Vaitarna", "liveCode": "upper_vaitarna", "osm_id": 11799235, "bmcShareMcft": 8018.1, "fallback": (73.47, 19.95)},
    {"name": "Middle Vaitarna", "liveCode": "middle_vaitarna", "osm_id": None, "bmcShareMcft": 6834.4, "fallback": (73.40, 19.83),
     "locationNote": "No OSM polygon for this reservoir in the water-bodies layer; point from the city config."},
    {"name": "Modak Sagar", "liveCode": "modak_sagar", "osm_id": 1609905, "bmcShareMcft": 4552.9, "fallback": (73.18, 19.78)},
    {"name": "Tansa", "liveCode": "tansa", "osm_id": 196507985, "bmcShareMcft": 5123.5, "fallback": (73.30, 19.63)},
    {"name": "Vihar", "liveCode": None, "osm_id": 311633, "bmcShareMcft": 978.2, "fallback": (72.91, 19.14)},
    {"name": "Tulsi", "liveCode": None, "osm_id": 6244817, "bmcShareMcft": 284.1, "fallback": (72.90, 19.16)},
]
# Supply sheds: union of the cascade catchments of the lakes on each river.
SUPPLY_SHEDS = {
    "VAITARNA": {"name": "Vaitarna supply catchment (Upper Vaitarna + Modak Sagar)", "river_id": "vaitarna", "osm_ids": [11799235, 1609905],
                 "note": "Middle Vaitarna has no polygon in the water-bodies layer, so its catchment is not part of this shed."},
    "TANSA": {"name": "Tansa catchment", "river_id": "tansa", "osm_ids": [196507985]},
    "BHATSA": {"name": "Bhatsa catchment", "river_id": "bhatsa", "osm_ids": [7112404]},
}
LAKE_RIVER = {7112404: "Bhatsa", 11799235: "Vaitarna", 1609905: "Vaitarna", 196507985: "Tansa", 311633: "Mithi", 6244817: "Dahisar"}

# NWMP codes the city river file carries only in prose (CPCB Annexure III A no. 94 names 1094 at Badlapur).
STATION_CODES = {"ulhas-badlapur": "1094"}

INDUSTRY_MIN_HA = 2.0  # Mumbai's estates are small parcels; Chennai's 5 ha floor would drop most

inventory: dict = {"basinId": BASIN_ID, "generatedFrom": "scripts/build_mumbai_rivers_basin.py", "generatedOn": TODAY, "families": {}, "skipped": []}


def load(rel: str) -> dict:
    return json.loads((ROOT / rel).read_text())


def rnd(geom: dict, nd: int = 5) -> dict:
    def r(c):
        if isinstance(c[0], (int, float)):
            return [round(c[0], nd), round(c[1], nd)]
        return [r(x) for x in c]

    return {"type": geom["type"], "coordinates": r(geom["coordinates"])}


def feat(geom: dict, props: dict) -> dict:
    return {"type": "Feature", "properties": {k: v for k, v in props.items() if v not in (None, "", [])}, "geometry": rnd(geom)}


def area_ha(geom) -> float:
    """Equirectangular hectares - fine at city scale for a parcel label."""
    lat = geom.centroid.y
    kx, ky = 111.32 * math.cos(math.radians(lat)), 110.57
    return round(geom.area * kx * ky * 100, 2)


def emit(family: str, features: list, provenance: str, source_file: str, kind: str | None = None,
         shed_slices: dict[str, list] | None = None) -> None:
    fc = {"type": "FeatureCollection", "features": features}
    path = BASIN / f"{family}.geojson"
    write_artifact(path, fc, compact=True)
    entry = {
        "featureCount": len(features),
        "sources": [{"file": source_file, "kind": kind, "count": len(features), "provenance": provenance}],
        "bytes": path.stat().st_size,
        "sliced": bool(shed_slices),
    }
    if shed_slices:
        d = BASIN / family
        d.mkdir(exist_ok=True)
        for shed, feats in shed_slices.items():
            write_artifact(d / f"{shed}.geojson", {"type": "FeatureCollection", "features": feats}, compact=True)
        entry["shedKeys"] = sorted(shed_slices)
    inventory["families"][family] = entry
    print(f"  {family:22} {len(features):5} features" + (f", {len(shed_slices)} shards" if shed_slices else ""))


class ShedIndex:
    def __init__(self, sheds: list[dict]):
        self.geoms = [shape(f["geometry"]) for f in sheds]
        self.ids = [f["properties"]["shedId"] for f in sheds]
        self.tree = STRtree(self.geoms)

    def of(self, geom) -> str | None:
        pt = geom if geom.geom_type == "Point" else geom.representative_point()
        for i in self.tree.query(pt):
            if self.geoms[i].contains(pt):
                return self.ids[i]
        return None


def build_sheds() -> tuple[list, list]:
    city = load("pipeline-inputs/mumbai-river-catchments-fabdem.geojson")["features"]
    cascade = load("public/data/cascade/mumbai-cascade-catchments.geojson")["features"]
    by_osm = {f["properties"]["osm_id"]: f for f in cascade}
    sheds = []
    for f in city:
        p = f["properties"]
        sheds.append(feat(f["geometry"], {
            "shedId": p["shedId"], "name": f"{p['river_id'].title()} catchment", "river_id": p["river_id"],
            "areaKm2": p["area_km2"], "source_dataset": "FABDEM v1-2 30 m + WhiteboxTools D8",
            "derivation_method": "fabdem_wbt_watershed_v1 (scripts/derive_mumbai_subbasins_fabdem.py)",
            "note": "Tidal reach below the pour point not included; " + p["pour_point_basis"],
        }))
    for shed_id, spec in SUPPLY_SHEDS.items():
        parts = [shape(by_osm[o]["geometry"]) for o in spec["osm_ids"] if o in by_osm]
        if not parts:
            inventory["skipped"].append({"file": "mumbai-cascade-catchments.geojson", "family": "sub-hydrosheds", "kind": shed_id, "reason": "no cascade catchment for the lakes named"})
            continue
        geom = unary_union(parts).buffer(0).simplify(0.0003)
        area = round(sum(by_osm[o]["properties"]["catchment_area_sqkm"] for o in spec["osm_ids"] if o in by_osm), 1)
        sheds.append(feat(mapping(geom), {
            "shedId": shed_id, "name": spec["name"], "river_id": spec["river_id"], "areaKm2": area,
            "source_dataset": "FABDEM v1-2 30 m + WhiteboxTools D8 (regional lake-catchment atlas)",
            "derivation_method": "catchments_fabdem_wbt_v1 (neer-vazhvu-api/app/cascade)", "note": spec.get("note"),
        }))
    # Per-lake catchments for the reservoir-catchments layer.
    rc = []
    for lake in LAKES:
        f = by_osm.get(lake["osm_id"])
        if not f:
            continue
        p = f["properties"]
        rc.append(feat(f["geometry"], {
            "name": f"{lake['name']} catchment", "level": "reservoir-catchment", "feeds": LAKE_RIVER.get(lake["osm_id"]),
            "areaKm2": p["catchment_area_sqkm"], "lakeAreaKm2": p.get("lake_area_sqkm"),
            "source": "FABDEM 30 m + WhiteboxTools, regional lake-catchment atlas (neer-vazhvu-api/app/cascade)", "year": "2026",
        }))
    return sheds, rc


def build_boundary(idx: ShedIndex) -> None:
    corps = load("public/geojson/mumbai-corporations-2024.geojson")["features"]
    bmc = next(f for f in corps if f["properties"]["name"] == "Greater Mumbai")
    emit("boundary", [feat(bmc["geometry"], {"name": "Greater Mumbai (BMC)", "areaKm2": bmc["properties"].get("area_sqkm")})],
         "OpenStreetMap municipal corporation boundary, via public/geojson/mumbai-corporations-2024.geojson", "mumbai-corporations-2024.geojson")
    emit("admin-corporation", [feat(f["geometry"], {"name": f["properties"]["name"], "level": "municipal corporation",
                                                    "acronym": f["properties"].get("acronym"), "district": f["properties"].get("district"),
                                                    "areaKm2": f["properties"].get("area_sqkm")}) for f in corps],
         "OpenStreetMap boundaries of the nine MMR municipal corporations (2024)", "mumbai-corporations-2024.geojson")


def build_rivers() -> dict:
    rivers = load("public/geojson/mumbai-rivers.geojson")["features"]
    feats = [feat(f["geometry"], {k: f["properties"].get(k) for k in ("river_id", "name", "name_mr", "waterway", "length_km", "osm_ids")}) for f in rivers]
    emit("rivers", feats, "OpenStreetMap river courses (Overpass), one MultiLineString per river; river_id joins the city river-quality file", "mumbai-rivers.geojson")
    return {f["properties"]["river_id"]: f["geometry"] for f in rivers}


def build_waterbodies(idx: ShedIndex) -> dict[int, Point]:
    wb = load("public/geojson/mumbai-water-bodies-current.geojson")["features"]
    major, minor, slices, centroids = [], [], {}, {}
    for f in wb:
        p, g = f["properties"], shape(f["geometry"])
        centroids[p["osm_id"]] = g.centroid
        props = {"name": p.get("name"), "name_mr": p.get("name_mr"), "water_type": p.get("water_type"), "area_ha": p.get("area_ha"),
                 "osm_id": p.get("osm_id"), "supply_reservoir": p.get("supply_reservoir"), "shedId": idx.of(g),
                 "source": "OpenStreetMap", "year": "2026"}
        ft = feat(f["geometry"], props)
        if p.get("name") or (p.get("area_ha") or 0) >= 5:
            major.append(ft)
        else:
            minor.append(ft)
            if props["shedId"]:
                slices.setdefault(props["shedId"], []).append(ft)
    emit("waterbodies-major", major, "OpenStreetMap water polygons across the urbanised MMR, named or at least 5 ha (public/geojson/mumbai-water-bodies-current.geojson)", "mumbai-water-bodies-current.geojson")
    emit("waterbodies-minor", minor, "OpenStreetMap water polygons under 5 ha and unnamed; sliced per catchment", "mumbai-water-bodies-current.geojson", shed_slices=slices)
    lost = load("public/data/water-bodies-lost-mumbai.json")
    feats = [feat({"type": "Point", "coordinates": [b["lng"], b["lat"]]}, {
        "name": b["name"], "kind": "lost-waterbody", "status": b.get("status"), "locality": b.get("side"), "details": b.get("note"),
        "locationBasis": b.get("location_basis"), "locationConfidence": b.get("location_confidence"),
        "shedId": idx.of(Point(b["lng"], b["lat"])),
        "source": "Dwivedi & Mehrotra, Bombay: The Cities Within (1995); Sahapedia; Tindall (1982)", "year": "historical",
    }) for b in lost["lost_bodies"]]
    emit("waterbodies-lost", feats, "Documented island-era tanks filled in after the piped supply arrived, at present-day locality positions (public/data/water-bodies-lost-mumbai.json)", "water-bodies-lost-mumbai.json")
    return centroids


def build_reservoirs(idx: ShedIndex, centroids: dict[int, Point]) -> None:
    dams = {d["source_code"]: d for d in load("public/data/mmr-dam-storage.json")["dams"]}
    cascade = {f["properties"]["osm_id"]: f["properties"] for f in load("public/data/cascade/mumbai-cascade-catchments.geojson")["features"]}
    feats = []
    for lake in LAKES:
        c = centroids.get(lake["osm_id"]) if lake["osm_id"] else None
        lon, lat = (c.x, c.y) if c else lake["fallback"]
        dam = dams.get(lake["liveCode"]) if lake["liveCode"] else None
        props = {
            "name": lake["name"], "kind": "supply-reservoir", "liveCode": lake["liveCode"],
            "operator": "Brihanmumbai Municipal Corporation, Hydraulic Engineer's Department (supply)",
            "bmcShareMcft": lake["bmcShareMcft"],
            "liveCapacityMcum": dam["live_capacity_mcum"] if dam else None,
            "catchmentKm2": cascade.get(lake["osm_id"], {}).get("catchment_area_sqkm") if lake["osm_id"] else None,
            "supplyShare": lake.get("supplyShare"),
            "feed": "Maharashtra WRD Pravah daily bulletin (live storage shown when a reading is available)" if dam else
                    "No public daily feed: BMC publishes no machine-readable storage for Vihar and Tulsi",
            "shareNote": "BMC's share of the lake, from BMC's published live-storage figures, not the dam's total live capacity on the state's books",
            "locationNote": lake.get("locationNote"),
            "shedId": idx.of(Point(lon, lat)),
            "source": "WRD Pravah bulletin (capacity); BMC Hydraulic Engineer's Department (share); FABDEM lake-catchment atlas (catchment)",
            "dataUrl": PRAVAH_URL if dam else None,
        }
        feats.append(feat({"type": "Point", "coordinates": [lon, lat]}, props))
    emit("reservoirs", feats, "The seven BMC supply lakes as points (OSM polygon centroids; Middle Vaitarna from the city config), WRD live capacity from the Pravah bulletin, BMC share from BMC's published figures; liveCode joins the daily storage feed", "mmr-dam-storage.json + src/lib/cities/mumbai.ts")


def series(kind_label: str, param: str, unit: str, points: list, criterion: float, crit_label: str, note: str) -> dict:
    return {"kind": "wq-param-series", "unit": unit, "verified": True, "label": kind_label, "param": param,
            "criterion": criterion, "criterionLabel": crit_label, "note": note, "points": points}


def build_monitoring(idx: ShedIndex, prs_entries: list) -> None:
    rq = load("public/data/river-quality-mumbai.json")
    prs_by_code = {s["code"]: (e, s) for e in prs_entries for s in e.get("stations", [])}
    feats, packs = [], {}
    for river in rq["rivers"]:
        for st in river.get("stations", []):
            code = (re.search(r"stn (\d+)", st["name"]) or [None, None])[1] or STATION_CODES.get(st["id"])
            readings = [r for r in st.get("readings", []) if r.get("year", 0) >= 2018]
            has = bool(readings)
            props = {
                "name": st["name"], "stationKey": st["id"], "hasReadings": has, "river": river["name"], "river_id": river["id"],
                "kind": "wq-station", "agency": "MPCB / CPCB NWMP" if code else "MPCB (sampling point)", "stationCode": code,
                "cpcbPriority": prs_by_code[code][0]["priority"] if code in prs_by_code else None,
                "bod2024": prs_by_code[code][1].get("bod2024") if code in prs_by_code else None,
                "readingsNote": None if has else "No published series for this point among the sources compiled here (MPCB annual reports, CPCB NWMP via Praja 2024)",
                "shedId": idx.of(Point(st["lng"], st["lat"])),
                "source": "MPCB Water Quality Status of Maharashtra annual reports; CPCB NWMP series via Praja Foundation 2024" if has else "public/data/river-quality-mumbai.json",
                "dataUrl": MPCB_WQR_URL,
            }
            if st["id"] == "mithi-kurla":
                props["locationNote"] = "Coordinates place station 2168 at the Kurla bridge; CPCB's own location text reads 'near road bridge, Mahim' and MPCB's annual reports call it 'Mithi at Mahim bridge'. Position approximate."
            feats.append(feat({"type": "Point", "coordinates": [st["lng"], st["lat"]]}, props))
            if not has:
                continue
            years = sorted(readings, key=lambda r: r["year"])
            ser = []
            bod = [[str(r["year"]), r["bod_mgl"]] for r in years if r.get("bod_mgl") is not None]
            if code and code in prs_by_code and prs_by_code[code][1].get("bod2024") is not None and not any(p[0] == "2024" for p in bod):
                bod.append(["2024", prs_by_code[code][1]["bod2024"]])
            if bod:
                ser.append(series("BOD (annual maximum)", "BOD", "mg/L", bod, 3, "BOD ≤ 3 mg/L (outdoor bathing criterion)",
                                  "Annual maxima at the station. 2018-2023: CPCB NWMP series as transcribed in Praja Foundation's 2024 report (RTI), except the Ulhas stations, which are MPCB's annual reports; 2024: CPCB Polluted River Stretches report, October 2025, Annexure XIV." if river["id"] == "mithi" else
                                  "Annual values from MPCB's Water Quality Status of Maharashtra reports; 2024 from CPCB's October 2025 report where the station is listed there."))
            do = [[str(r["year"]), r["do_mgl"]] for r in years if r.get("do_mgl") is not None]
            if do:
                ser.append(series("Dissolved oxygen (annual)", "Dissolved oxygen", "mg/L", do, 5, "DO ≥ 5 mg/L (outdoor bathing criterion)",
                                  "Annual values from the same reports as the BOD series."))
            fc_ = [[str(r["year"]), r["fecal_coliform_mpn"]] for r in years if r.get("fecal_coliform_mpn") is not None]
            if fc_:
                fc_note = next((r["fecal_coliform_note"] for r in years if r.get("fecal_coliform_note")), None)
                ser.append(series("Faecal coliform (annual maximum)", "Faecal coliform", "MPN/100ml", fc_, 2500, "FC ≤ 2500 MPN/100ml (outdoor bathing criterion)",
                                  fc_note or "CPCB NWMP series via Praja 2024."))
            wqr = river.get("mpcb_wqr_series") if st["id"] == "mithi-kurla" else None
            if wqr:
                yrs = wqr["years"]
                avg = [[k[:4], v["bod_avg"]] for k, v in sorted(yrs.items()) if v.get("bod_avg") is not None]
                doa = [[k[:4], v["do_avg"]] for k, v in sorted(yrs.items()) if v.get("do_avg") is not None]
                wnote = "MPCB annual AVERAGES for station 2168 from the Water Quality Status of Maharashtra reports, a different statistic from the annual maxima above. Reporting years run April to March and are plotted at their starting year; 2019-20 was never published. WQI 2023-24 = 32."
                ser.append(series("BOD (annual average, MPCB)", "BOD", "mg/L", avg, 3, "BOD ≤ 3 mg/L (outdoor bathing criterion)", wnote))
                ser.append(series("Dissolved oxygen (annual average, MPCB)", "Dissolved oxygen", "mg/L", doa, 5, "DO ≥ 5 mg/L (outdoor bathing criterion)", wnote))
            ser = [s for s in ser if len(s["points"]) >= 2]  # a one-point chart says nothing
            packs[st["id"]] = {
                "schemaVersion": 1,
                "station": {"stationKey": st["id"], "name": st["name"], "agency": "MPCB / CPCB NWMP", "siteType": "NWMP" if code else "sampling point", "river": river["name"]},
                "source": {"label": "MPCB Water Quality Status of Maharashtra (annual) + CPCB NWMP via Praja 2024 + CPCB PRS Oct 2025", "url": MPCB_WQR_URL, "fetched": rq["provenance"]["sources"][0].get("retrieved", "2026-07-05")},
                "period": {"from": bod[0][0] if bod else str(years[0]["year"]), "to": bod[-1][0] if bod else str(years[-1]["year"]), "waterYear": "calendar years (CPCB); April-March reporting years plotted at their start (MPCB averages)"},
                "series": ser,
            }
    emit("monitoring-points", feats, "MPCB / CPCB NWMP water-quality stations on the Mithi and Ulhas and MPCB sampling points on the other city rivers, from public/data/river-quality-mumbai.json; hasReadings marks the four with a published series", "river-quality-mumbai.json")
    for key, pack in packs.items():
        write_artifact(BASIN / "readings" / f"{key}.json", pack, compact=True)
    inventory["families"]["readings"] = {"featureCount": len(packs), "bytes": sum((BASIN / "readings" / f"{k}.json").stat().st_size for k in packs), "sliced": False,
                                         "sources": [{"file": "river-quality-mumbai.json", "kind": "wq-param-series", "count": len(packs), "provenance": "Station readings packs (contract v1) for the four stations with a published series"}]}
    print(f"  {'readings':22} {len(packs):5} packs")


def clip_line(geom: dict, a: Point, b: Point) -> dict:
    """The part of a (Multi)LineString between the vertices nearest two points."""
    lines = [LineString(c) for c in (geom["coordinates"] if geom["type"] == "MultiLineString" else [geom["coordinates"]])]
    merged = max(lines, key=lambda ln: ln.length)  # the mainstem part
    da, db = merged.project(a), merged.project(b)
    lo, hi = sorted((da, db))
    coords = [c for c in merged.coords if lo <= merged.project(Point(c)) <= hi]
    return mapping(LineString([merged.interpolate(lo).coords[0]] + coords + [merged.interpolate(hi).coords[0]]))


def build_prs(rivers: dict) -> list:
    cpcb = load("pipeline-inputs/atlas/prs/cpcb-2025.json")
    entries = [e for e in cpcb["entries"] if e["stateSlug"] == "mh"]
    by_river = {e["river"].lower(): e for e in entries}
    feats = []
    mithi = by_river["mithi"]
    feats.append(feat(rivers["mithi"], {
        "stretchId": mithi["id"], "name": "Mithi: Powai to Mahim", "river": "Mithi", "stretch": mithi["text"], "priority": mithi["priority"], "kind": mithi["kind"],
        "maxBod2022_23": mithi["maxBod2022_23"], "bod2024": mithi["stations"][0].get("bod2024"), "stationCode": mithi["stations"][0]["code"],
        "since2018": f"{mithi['since2018']['class']} (2018: {mithi['since2018']['stretch2018'].title()}, Priority {mithi['since2018']['priority2018']})",
        "extentNote": "CPCB's October 2025 list names one monitoring location (station 2168, Mahim); the 2018 list gave the stretch as Powai to Dharavi. Drawn along the river's whole mapped course.",
        "vintage": CPCB_PRS_LABEL, "serial": f"Annexure {mithi['serial']['annexure']} no. {mithi['serial']['sno']}, PDF p. {mithi['serial']['pdfPage']}",
        "source": CPCB_PRS_LABEL, "dataUrl": CPCB_PRS_URL,
    }))
    ulhas = by_river["ulhas"]
    rq = {r["id"]: r for r in load("public/data/river-quality-mumbai.json")["rivers"]}
    st = {s["id"]: s for s in rq["ulhas"]["stations"]}
    a, b = st["ulhas-badlapur"], st["ulhas-nrc-mohane"]
    feats.append(feat(clip_line(rivers["ulhas"], Point(a["lng"], a["lat"]), Point(b["lng"], b["lat"])), {
        "stretchId": ulhas["id"], "name": "Ulhas: Badlapur water works to NRC bund, Mohane", "river": "Ulhas", "stretch": ulhas["text"], "priority": ulhas["priority"], "kind": ulhas["kind"],
        "maxBod2022_23": ulhas["maxBod2022_23"], "bod2024": ", ".join(f"{s['code']}: {s.get('bod2024')}" for s in ulhas["stations"]),
        "stationCode": ", ".join(s["code"] for s in ulhas["stations"]),
        "since2018": f"{ulhas['since2018']['class']} (2018: {ulhas['since2018']['stretch2018'].title()}, Priority {ulhas['since2018']['priority2018']})",
        "extentNote": "Clipped to the river's mapped course between the Badlapur water works and the NRC bund at Mohane, the two CPCB endpoints.",
        "vintage": CPCB_PRS_LABEL, "serial": f"Annexure {ulhas['serial']['annexure']} no. {ulhas['serial']['sno']}, PDF p. {ulhas['serial']['pdfPage']}",
        "source": CPCB_PRS_LABEL, "dataUrl": CPCB_PRS_URL,
    }))
    others = [e for e in entries if e["river"].lower() in ("bhatsa", "tansa", "vaitarna", "kalu", "surya", "waldhuni")]
    for e in others:
        inventory["skipped"].append({"file": "cpcb-2025.json", "family": "prs-stretches", "kind": e["river"],
                                     "reason": f"Priority {e['priority']} listing at a location the report does not georeference; carried in the river narrative, not drawn"})
    emit("prs-stretches", feats, "CPCB polluted river stretches, October 2025 (updated version), Annexures III A/B, XI and XIV, drawn along OpenStreetMap river courses; Greater Mumbai's Dahisar, Poisar and Oshiwara are not in the national list", "pipeline-inputs/atlas/prs/cpcb-2025.json")
    return entries


def build_groundwater(idx: ShedIndex) -> None:
    g = load("public/data/mumbai-cgwb-stations.json")
    feats = []
    for w in g["wells"]:
        rd = sorted(w.get("readings", []), key=lambda r: (r["year"], r["month"]))
        latest = rd[-1] if rd else None
        feats.append(feat({"type": "Point", "coordinates": [w["lng"], w["lat"]]}, {
            "name": w["name"], "kind": "cgwb-well", "stationCode": w.get("station_code"), "district": w.get("district"), "block": w.get("block"),
            "wellType": w.get("well_type"), "aquifer": w.get("aquifer"),
            "latestDepthMbgl": latest["depth_m_bgl"] if latest else None,
            "latestReading": f"{latest['year']}-{latest['month']:02d} (Year Book {latest['year_book']})" if latest else None,
            "readingsCount": len(rd), "shedId": idx.of(Point(w["lng"], w["lat"])),
            "source": g.get("source_label"), "dataUrl": g.get("source_url") or CGWB_URL,
        }))
    emit("groundwater-wells", feats, "CGWB National Hydrograph Network dug wells across the MMR (Ground Water Year Book of Maharashtra), latest seasonal depth per well", "mumbai-cgwb-stations.json")


def build_infrastructure(idx: ShedIndex) -> None:
    ind = load("public/data/industrial-sources-mumbai.json")
    commits = {c["id"]: c for c in load("public/data/commitments-mumbai.json")["commitments"]}
    feats = []
    for s in ind["sources"]:
        slug = s["id"].split("-")[-1]
        cm = commits.get(f"{slug}-wwtf")
        cap = re.search(r"(\d[\d,]*)\s*MLD", s.get("description", ""))
        feats.append(feat({"type": "Point", "coordinates": [s["lng"], s["lat"]]}, {
            "name": s["name"], "kind": "stp", "agency": s.get("operator"),
            "capacityMld": float(cap.group(1).replace(",", "")) if cap else None,
            "details": s.get("description"), "riversAffected": ", ".join(s.get("rivers_affected") or []) or None,
            "replacement": f"{cm['title']} - due {cm['due']}, status {cm['status']} (BMC ESR 2024-25)" if cm else None,
            "shedId": idx.of(Point(s["lng"], s["lat"])), "source": s.get("source"), "year": "2024", "dataUrl": MPCB_WQR_URL,
        }))
    emit("infrastructure", feats, "Sewage treatment plants across the MMR: MPCB per-STP inventory, inlet/outlet BOD from Praja 2024 (RTI), eastern-corridor locations from OSM; MSDP-2 replacement dates from BMC's ESR 2024-25 via the commitments register", "industrial-sources-mumbai.json + commitments-mumbai.json")


def build_flood(idx: ShedIndex) -> None:
    fh = load("public/data/mumbai-flood-hotspots.geojson")
    feats = [feat(f["geometry"], {
        "name": f["properties"].get("name"), "kind": "flood-spot", "category": f["properties"].get("category_label"), "ward": f["properties"].get("ward"),
        "locationName": f["properties"].get("location"), "awsStationId": f["properties"].get("aws_station_id"),
        "shedId": idx.of(shape(f["geometry"])), "source": "BMC Disaster Management flood-spot register", "year": fh["provenance"].get("produced_at", "")[:4],
    }) for f in fh["features"]]
    emit("flood-hotspots", feats, "BMC Disaster Management flood-spot register, the officially mapped chronic/monitored subset (the full pre-monsoon list is not published with locations)", "mumbai-flood-hotspots.geojson")


OVERPASS = ("https://overpass.kumi.systems/api/interpreter", "https://overpass-api.de/api/interpreter")
OSM_INDUSTRIAL_QUERY = """[out:json][timeout:120];
(
  way["landuse"="industrial"](18.88,72.77,19.30,73.05);
  relation["landuse"="industrial"]["type"="multipolygon"](18.88,72.77,19.30,73.05);
);
out body;
>;
out skel qt;"""


def osm_industrial_raw() -> dict:
    """Greater Mumbai's landuse=industrial parcels from Overpass, cached (gitignored)."""
    cache = CACHE / "osm-industrial-raw.json"
    if cache.exists():
        return json.loads(cache.read_text())
    import urllib.parse
    import urllib.request

    last = None
    for url in OVERPASS:
        try:
            req = urllib.request.Request(url, data=urllib.parse.urlencode({"data": OSM_INDUSTRIAL_QUERY}).encode(), headers={"User-Agent": "neer-vazhvu/basin-build"})
            with urllib.request.urlopen(req, timeout=240) as r:
                raw = json.load(r)
            CACHE.mkdir(parents=True, exist_ok=True)
            cache.write_text(json.dumps(raw))
            return raw
        except Exception as e:  # noqa: BLE001 - try the next mirror
            last = e
    raise SystemExit(f"Overpass fetch failed on every mirror: {last}")


def build_industries(idx: ShedIndex) -> None:
    raw = osm_industrial_raw()
    nodes = {e["id"]: (e["lon"], e["lat"]) for e in raw["elements"] if e["type"] == "node"}
    ways = {e["id"]: e for e in raw["elements"] if e["type"] == "way"}
    feats = []

    def ring(way):
        pts = [nodes[n] for n in way["nodes"] if n in nodes]
        return pts if len(pts) >= 4 and pts[0] == pts[-1] else None

    used = set()
    for e in raw["elements"]:
        if e["type"] != "relation":
            continue
        outers = [ring(ways[m["ref"]]) for m in e.get("members", []) if m["type"] == "way" and m.get("role") in ("outer", "") and m["ref"] in ways]
        outers = [o for o in outers if o]
        if not outers:
            continue
        used.update(m["ref"] for m in e.get("members", []) if m["type"] == "way")
        g = unary_union([shape({"type": "Polygon", "coordinates": [o]}) for o in outers]).buffer(0)
        ha = area_ha(g)
        if ha >= INDUSTRY_MIN_HA:
            feats.append(feat(mapping(g), {"name": e.get("tags", {}).get("name"), "area_ha": ha, "shedId": idx.of(g), "osm_id": e["id"], "source": "OpenStreetMap (industrial landuse)", "year": "2026"}))
    for wid, w in ways.items():
        if wid in used or w.get("tags", {}).get("landuse") != "industrial":
            continue
        r = ring(w)
        if not r:
            continue
        g = shape({"type": "Polygon", "coordinates": [r]}).buffer(0)
        ha = area_ha(g)
        if ha >= INDUSTRY_MIN_HA:
            feats.append(feat(mapping(g), {"name": w.get("tags", {}).get("name"), "area_ha": ha, "shedId": idx.of(g), "osm_id": wid, "source": "OpenStreetMap (industrial landuse)", "year": "2026"}))
    emit("industries", feats, f"OpenStreetMap landuse=industrial parcels of at least {INDUSTRY_MIN_HA:g} ha within Greater Mumbai (Overpass, fetched 2026-09-06)", "osm-industrial-raw.json")


def build_drainage(idx: ShedIndex) -> None:
    dr = load("public/geojson/mumbai-drainage.geojson")["features"]
    feats, slices = [], {}
    for f in dr:
        g = shape(f["geometry"])
        p = f["properties"]
        ft = feat(f["geometry"], {"name": p.get("name"), "waterway": p.get("waterway"), "covered": p.get("covered"), "length_km": p.get("length_km"),
                                  "osm_id": p.get("osm_id"), "shedId": idx.of(g), "source": "OpenStreetMap", "year": "2026"})
        feats.append(ft)
        if ft["properties"].get("shedId"):
            slices.setdefault(ft["properties"]["shedId"], []).append(ft)
    emit("drainage", feats, "OpenStreetMap drain / ditch / nullah network across the urbanised MMR; sliced per catchment", "mumbai-drainage.geojson", shed_slices=slices)


def build_gaps_geojson(sheds: list) -> None:
    severity = {"MITHI": "high", "OSHIWARA": "high", "DAHISAR": "medium", "POISAR": "medium"}
    feats = [feat(s["geometry"], {"gapUnit": s["properties"]["river_id"], "name": s["properties"]["name"].replace(" catchment", ""), "severity": severity[s["properties"]["shedId"]]})
             for s in sheds if s["properties"]["shedId"] in severity]
    emit("gaps", feats, "Treatment-gap units = the four city-river catchments (FABDEM); severity is the reading of gaps.json's evidence: high where a CPCB Priority I station or a failing plant discharges, medium where the river is sewage-fed but unmonitored", "sub-hydrosheds.geojson")


def main() -> int:
    BASIN.mkdir(parents=True, exist_ok=True)
    (BASIN / "readings").mkdir(exist_ok=True)
    sheds, rc = build_sheds()
    idx = ShedIndex(sheds)
    emit("sub-hydrosheds", sheds, "City-river catchments delineated on FABDEM 30 m (scripts/derive_mumbai_subbasins_fabdem.py) plus the supply-lake catchments from the regional FABDEM lake-catchment atlas", "mumbai-river-catchments-fabdem.geojson + mumbai-cascade-catchments.geojson")
    emit("reservoir-catchments", [feat(f["geometry"], {**f["properties"], "shedId": idx.of(shape(f["geometry"]))}) for f in rc],
         "Per-lake catchments of the supply lakes from the regional FABDEM lake-catchment atlas (neer-vazhvu-api/app/cascade)", "mumbai-cascade-catchments.geojson")
    build_boundary(idx)
    rivers = build_rivers()
    centroids = build_waterbodies(idx)
    build_reservoirs(idx, centroids)
    prs_entries = build_prs(rivers)
    build_monitoring(idx, prs_entries)
    build_groundwater(idx)
    build_infrastructure(idx)
    build_flood(idx)
    build_industries(idx)
    build_drainage(idx)
    build_gaps_geojson(sheds)
    write_artifact(BASIN / "inventory.json", inventory)
    print(f"wrote inventory.json: {len(inventory['families'])} families, {len(inventory['skipped'])} skipped notes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
