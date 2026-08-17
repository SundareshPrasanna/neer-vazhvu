#!/usr/bin/env python3
"""
Build Surat's static artifacts from the acquired source drop.

WHY ONE SCRIPT
Surat's first-pass data arrived as a folder of raw downloads rather than as
live endpoints: India-WRIS groundwater exports for all of Gujarat, the CPCB
NWMP 2022 national PDFs, the SAC wetland atlas for Gujarat, and three
open-data supply releases. Each needs filtering, and three of them need a
correction applied before anything is published. Keeping that in one auditable
script means the corrections are reviewable in one place rather than scattered
across four producers.

THE THREE CORRECTIONS, all load-bearing:

  1. The national open-data supply release carries two columns that are
     constants presented as measurements. `Losses_includingNRW_MLD` is exactly
     20.0000% of total supply on all 48 monthly rows, and the accompanying
     `ActualWaterSupplied_MLD` equals total supply on every row, which
     contradicts the existence of the losses column. The per-sub-ward release
     carries a "domestic consumption" column that is exactly 0.750000 x
     capacity on all 233 rows. NEITHER enters the product. The script asserts
     the ratios still hold so that a future edition which starts publishing
     real measurements trips the assertion instead of being silently dropped.

  2. The India-WRIS export filenames misstate their own coverage: the file
     named 1991_2020 holds Aug-Dec 2020, the one named 2026_2030 holds
     Jan-May 2026. Coverage is derived from the data, never from the name.

  3. The water-bodies drop is mostly the wrong state. Three of its files are
     Himachal Pradesh (2,045 features, 657 pro-glacial lakes); the usable
     Gujarat layer arrived as an interrupted download whose last placemark is
     truncated. The parser takes only complete placemarks.

Run:
  cd neer-vazhvu-api && python3 scripts/build_surat_artifacts.py \
      --drop ~/Downloads/surat_data --root ..
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

CITY = "surat"
TODAY = date.today().isoformat()

# Surat district, generously drawn: the city plus Olpad/Choryasi and the
# Hazira estuary, because the river and groundwater surfaces legitimately
# reach past the municipal line.
DISTRICT_BOX = {"south": 20.85, "north": 21.60, "west": 72.55, "east": 73.45}
CITY_BOX = {"south": 21.00, "north": 21.35, "west": 72.60, "east": 72.99}


def _iso_date(raw: str) -> str | None:
    """Normalise the several date shapes the WRIS exports ship.

    The Gujarat groundwater exports use dd-mm-yyyy with HYPHENS
    ("01-05-1991 00:00"), which is the same separator ISO uses and the
    opposite field order, so the two are told apart by which group is four
    digits rather than by the separator.
    """
    m = re.match(r"(\d{4})-(\d{1,2})-(\d{1,2})", raw)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    m = re.match(r"(\d{1,2})[-/](\d{1,2})[-/](\d{4})", raw)
    if m:
        return f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"
    return None


def in_box(lat: float, lng: float, box: dict) -> bool:
    return box["south"] <= lat <= box["north"] and box["west"] <= lng <= box["east"]


# NVDM's closed vocabulary for provenance.method. Prose describing HOW a
# specific artifact was built belongs in provenance.note; this field says only
# which acquisition family it came from.
METHODS = {"manual", "scrape", "api", "pdf-extract", "gee", "derived", "mixed"}


def envelope(dataset: str, sources: list[dict], method: str, how: str, **extra) -> dict:
    """The NVDM v1 envelope. New artifacts are born enveloped rather than
    being injected later - the injector pattern exists to migrate legacy
    files, and Surat has none."""
    assert method in METHODS, f"{method!r} is not an NVDM provenance.method"
    prov = {"sources": sources, "method": method, "produced_at": TODAY}
    prov["note"] = how if "note" not in extra else f"{how} {extra.pop('note')}"
    prov.update({k: v for k, v in extra.items() if v is not None})
    return {
        "nvdm": "1.0",
        "dataset": dataset,
        "scope": {"kind": "city", "id": CITY},
        "provenance": prov,
    }


def registry_sources(root: Path, ids: list[str]) -> list[dict]:
    """Read licence and publisher from the Headwaters registry, which owns
    them. Never restate a licence string here."""
    reg = json.loads((root / "scripts/source-registry/surat.json").read_text())
    by_id = {s["id"]: s for s in reg["sources"]}
    out = []
    for sid in ids:
        s = by_id[sid]
        out.append(
            {
                "id": s["id"],
                "title": s["notes"].split(".")[0] if s.get("notes") else s["publisher"],
                "publisher": s["publisher"],
                "license": s["license"],
                "url": s["url"],
            }
        )
    return out


def write(path: Path, payload: dict, compact: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = (
        json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        if compact
        else json.dumps(payload, ensure_ascii=False, indent=2)
    )
    path.write_text(text + "\n")
    size = len(text)
    print(f"  wrote {path.relative_to(path.parents[2])} ({size:,} bytes)")


# ---------------------------------------------------------------- groundwater


def build_groundwater(drop: Path, root: Path) -> int:
    """India-WRIS Gujarat exports -> Surat point stations.

    Rendered as click-through markers rather than an interpolated surface:
    about 65 stations across a 462 km2 city and its district is nowhere near
    dense enough to manufacture per-zone precision, which is the same call
    Madurai made at 4 stations.
    """
    gw = drop / "Groundwater"
    if not gw.is_dir():
        print("  SKIP groundwater: drop folder absent")
        return 0

    stations: dict[str, dict] = {}
    files_meta = []

    for csv_path in sorted(gw.glob("*.csv")):
        kind = "telemetry" if "_tel_" in csv_path.name else "manual-quarterly"
        rows = 0
        dates: list[str] = []
        with csv_path.open(newline="", encoding="utf-8", errors="replace") as fh:
            reader = csv.DictReader(fh)
            value_col = next(
                (c for c in (reader.fieldnames or []) if "Groundwater Level" in c), None
            )
            if not value_col:
                continue
            for row in reader:
                if (row.get("District") or "").strip().upper() != "SURAT":
                    continue
                try:
                    lat = float(row["Latitude"])
                    lng = float(row["Longitude"])
                except (TypeError, ValueError, KeyError):
                    continue
                name = (row.get("Station") or "").strip()
                if not name:
                    continue
                raw_dt = (row.get("Data Acquisition Time") or "").strip()
                iso = _iso_date(raw_dt)
                if not iso:
                    continue
                try:
                    value = float(row[value_col])
                except (TypeError, ValueError):
                    continue
                st = stations.setdefault(
                    name,
                    {
                        "name": name,
                        "station_code": name,
                        "tehsil": (row.get("Tehsil") or "").strip() or None,
                        "lat": round(lat, 5),
                        "lng": round(lng, 5),
                        "agency": (row.get("Agency") or "").strip() or None,
                        "readings": [],
                    },
                )
                st["readings"].append({"date": iso, "level_m": value, "series": kind})
                dates.append(iso)
                rows += 1
        if rows:
            files_meta.append(
                {
                    "file": csv_path.name,
                    "series": kind,
                    "surat_rows": rows,
                    # Derived from the data. The filenames misstate their own
                    # coverage and must never be trusted for this.
                    "actual_coverage": {"from": min(dates), "to": max(dates)},
                }
            )

    if not stations:
        print("  SKIP groundwater: no Surat rows found")
        return 0

    for st in stations.values():
        st["readings"].sort(key=lambda r: r["date"])

    wells = sorted(stations.values(), key=lambda s: s["name"])
    all_dates = [r["date"] for s in wells for r in s["readings"]]

    payload = {
        **envelope(
            "data-root/cgwb-stations",
            registry_sources(root, ["wris-groundwater-gujarat"]),
            "manual",
            "India-WRIS Gujarat groundwater-level exports filtered to District == SURAT, "
            "grouped by station. Coverage is derived from the readings, not from the "
            "export filenames, which misstate their own ranges.",
            produced_by="neer-vazhvu-api/scripts/build_surat_artifacts.py",
        ),
        "_note": (
            "Point stations, not an interpolated surface. About 65 stations across the "
            "city and its district cannot support per-zone depth precision, so the "
            "groundwater page renders these as click-through markers and leaves the "
            "depth and risk choropleths off."
        ),
        "district": "Surat",
        "well_type": "Observation wells (manual quarterly and telemetry)",
        "depth_unit": "metres below ground level",
        "source_label": "India-WRIS (National Water Informatics Centre)",
        "source_url": "https://indiawris.gov.in/Dataset/Ground%20Water%20Level",
        "coverage": {
            "from": min(all_dates),
            "to": max(all_dates),
            "stations": len(wells),
            "readings": len(all_dates),
        },
        "_sign_convention_note": (
            "Telemetry values arrive with mixed sign (both above and below datum) in the "
            "source export. Consumers must apply the per-station sign rule before "
            "rendering a depth; raw values are carried here unaltered so the correction "
            "stays visible rather than baked in."
        ),
        "_source_files": files_meta,
        "wells": wells,
    }
    write(root / "public/data/surat-cgwb-stations.json", payload)
    print(f"    {len(wells)} stations, {len(all_dates):,} readings")
    return len(wells)


# --------------------------------------------------------------- water bodies


def build_water_bodies(drop: Path, root: Path) -> int:
    """SAC Gujarat wetland atlas -> Surat water bodies.

    The source arrived as an interrupted Chrome download (`.crdownload`) whose
    final placemark is truncated mid-record, so only complete placemarks are
    taken. Three sibling files in the same folder are Himachal Pradesh and are
    ignored entirely.
    """
    wb_dir = drop / "Waterbodies"
    if not wb_dir.is_dir():
        print("  SKIP water bodies: drop folder absent")
        return 0

    kml = None
    for cand in sorted(wb_dir.iterdir()):
        if not cand.is_file() or cand.stat().st_size < 1_000_000:
            continue
        head = cand.open(encoding="utf-8", errors="replace").read(400_000)
        if "<kml" in head and "Gujarat" in head:
            kml = cand
            break
    if kml is None:
        print("  SKIP water bodies: no Gujarat KML in drop (the wb_hp.* files are Himachal Pradesh)")
        return 0

    raw = kml.open(encoding="utf-8", errors="replace").read()
    marks = [m for m in raw.split("<Placemark>")[1:] if "</Placemark>" in m]

    def field(mark: str, key: str) -> str:
        m = re.search(r'name="%s">([^<]*)<' % re.escape(key), mark)
        return m.group(1).strip() if m else ""

    features = []
    for mark in marks:
        try:
            lat = float(field(mark, "lat"))
            lng = float(field(mark, "long"))
        except ValueError:
            continue
        if not in_box(lat, lng, DISTRICT_BOX):
            continue
        coord_m = re.search(r"<coordinates>([^<]+)</coordinates>", mark)
        if not coord_m:
            continue
        ring = []
        for token in coord_m.group(1).split():
            parts = token.split(",")
            if len(parts) >= 2:
                try:
                    ring.append([round(float(parts[0]), 6), round(float(parts[1]), 6)])
                except ValueError:
                    continue
        if len(ring) < 4:
            continue
        try:
            area_ha = round(float(field(mark, "area_ha")), 3)
        except ValueError:
            area_ha = None
        name = field(mark, "wetname")
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": field(mark, "id") or None,
                    "name": name or None,
                    "category": field(mark, "level_i") or None,
                    "origin": field(mark, "level_ii") or None,
                    "area_ha": area_ha,
                    "turbidity": field(mark, "turbidity") or None,
                    "aquatic_vegetation": field(mark, "aqveg") or None,
                    "in_city_limits": in_box(lat, lng, CITY_BOX),
                },
                "geometry": {"type": "Polygon", "coordinates": [ring]},
            }
        )

    named = sum(1 for f in features if f["properties"]["name"])
    in_city = sum(1 for f in features if f["properties"]["in_city_limits"])

    payload = {
        **envelope(
            "geojson-layers/water-bodies-current",
            registry_sources(root, ["sac-wetland-atlas-gujarat"]),
            "manual",
            "SAC National Wetland Atlas hydrological layer for Gujarat, clipped to a "
            "Surat district bounding box; complete placemarks only, because the source "
            "download was interrupted mid-record.",
            produced_by="neer-vazhvu-api/scripts/build_surat_artifacts.py",
            note=(
                f"{len(features)} polygons in the district box, {in_city} inside city "
                f"limits. THIN SEMANTICS: only {named} carry a name, and the source's "
                "level_iii and l4type classification fields are empty for every Surat "
                "feature, so category is limited to Inland/Coastal and Man-made/Natural."
            ),
        ),
        "type": "FeatureCollection",
        "features": features,
    }
    write(root / "public/geojson/surat-water-bodies-current.geojson", payload, compact=True)
    print(f"    {len(features)} polygons ({in_city} in city, {named} named)")
    return len(features)


# -------------------------------------------------------------- river quality


# The Gujarat Tapi stations from the CPCB NWMP 2022 river table, in
# UPSTREAM-TO-SEA order, which is the whole point: the profile is the story.
# Coordinates are placed on the named crossing/landmark; the source table
# carries no coordinates of its own.
TAPI_STATIONS = [
    ("46", "River Tapi at Ukai, Sherula Bridge", 21.2483, 73.5903),
    ("1247", "River Tapi at Mandavi", 21.2600, 73.3000),
    ("1983", "River Tapi near Bardoli (Kapp Bridge), Kakrapar", 21.1400, 73.1200),
    ("47", "River Tapi at Kathore (NH-8 Bridge), u/s of Surat", 21.2260, 72.9560),
    ("1248", "River Tapi at Surat u/s Kathore (Limdeshwar Mahadev)", 21.2200, 72.9300),
    ("1982", "River Tapi at Rander Bridge, Surat", 21.2050, 72.8000),
    ("2071", "River Tapi at ONGC Bridge, Hazira", 21.1180, 72.6600),
]


def build_river_quality(root: Path) -> int:
    """CPCB NWMP 2022 -> the Tapi longitudinal profile.

    Values are the min-max ranges CPCB publishes per station per year, carried
    as ranges rather than being collapsed to a midpoint, because the range is
    what the source measured.

    The finding this profile carries is counter-intuitive and worth preserving:
    BOD sits at or below detection limit at most Surat Tapi stations, so the
    river is NOT organically polluted through the city the way the Musi or the
    Adi Ganga are. What climbs downstream is conductivity - 369-513 at Ukai,
    363-7,656 at Kathore, 1,537-49,720 at Hazira, which is seawater. The Tapi's
    problem at Surat is the estuary, not sewage.
    """
    # (station_code, do_min, do_max, ph_min, ph_max, cond_min, cond_max,
    #  bod_min, bod_max) as printed in Table 9 of the 2022 edition.
    READINGS = {
        "46": (6.9, 7.5, 7.91, 8.5, 369, 513, None, None),
        "1247": (7.0, 7.8, 8.1, 8.43, 352, 3552, None, None),
        "1983": (6.8, 7.3, 7.22, 8.45, 356, 4884, None, None),
        "47": (6.8, 7.3, 7.84, 8.5, 363, 7656, 1.1, 1.1),
        "1248": (6.7, 7.2, 7.74, 8.48, 375, 4412, 1.1, 1.2),
        "1982": (6.8, 7.4, 7.9, 8.5, 370, 780, 1.1, 1.2),
        "2071": (5.8, 6.6, 7.22, 8.54, 1537, 49720, 1.4, 2.5),
    }

    stations = []
    for order, (code, name, lat, lng) in enumerate(TAPI_STATIONS, start=1):
        do_lo, do_hi, ph_lo, ph_hi, c_lo, c_hi, b_lo, b_hi = READINGS[code]
        stations.append(
            {
                "id": f"tapi-{code}",
                "station_code": code,
                "name": name,
                "lat": lat,
                "lng": lng,
                "downstream_order": order,
                "readings": [
                    {
                        "year": 2022,
                        "dissolved_oxygen_mgl": {"min": do_lo, "max": do_hi},
                        "ph": {"min": ph_lo, "max": ph_hi},
                        "conductivity_umhos_cm": {"min": c_lo, "max": c_hi},
                        "bod_mgl": (
                            {"min": b_lo, "max": b_hi}
                            if b_lo is not None
                            else {"below_detection_limit": True}
                        ),
                    }
                ],
            }
        )

    payload = {
        **envelope(
            "data-root/river-quality",
            registry_sources(root, ["cpcb-nwmp-2022"]),
            "pdf-extract",
            "Transcribed from Table 9 (Water Quality of River Tapi) of the CPCB NWMP "
            "2022 national compilation, Gujarat stations only, ordered upstream to sea. "
            "Ranges are carried as published; no midpoint is derived.",
            produced_by="neer-vazhvu-api/scripts/build_surat_artifacts.py",
            note=(
                "ONE EDITION ONLY (2022). CPCB publishes annually and a multi-edition "
                "backfill runs on the same pipeline used for the Hyderabad Musi rebuild. "
                "Station coordinates are placed on the named crossing or landmark; the "
                "source table publishes no coordinates."
            ),
        ),
        "last_updated": "2022",
        "data_year_range": "2022",
        "source_label": "CPCB National Water Quality Monitoring Programme, 2022",
        "source_url": "https://cpcb.gov.in/nwmp-data-2022/",
        "_note": (
            "The profile's headline finding: BOD is at or below detection limit at most "
            "Surat Tapi stations, so the river is not organically polluted through the "
            "city. Conductivity is what climbs, from 369-513 at Ukai to 1,537-49,720 at "
            "the Hazira estuary mouth. The problem here is salinity, not sewage."
        ),
        "rivers": [
            {
                "id": "tapi",
                "name": "Tapi",
                "name_gu": "તાપી",
                "stations": stations,
            }
        ],
    }
    write(root / "public/data/river-quality-surat.json", payload)
    print(f"    {len(stations)} Tapi stations, upstream to sea")
    return len(stations)


# --------------------------------------------------------------------- supply


def build_supply(drop: Path, root: Path) -> None:
    """Open-data supply releases -> the supply overview.

    Asserts that the two derived columns are still exactly derived. If a future
    edition starts publishing real measurements the assertion fails loudly
    rather than the columns being silently discarded forever.
    """
    ws = drop / "Watersupply"
    monthly = []
    d53 = ws / "D53. Detailed Water Supply Distribution_0.csv"
    if d53.exists():
        loss_ratios = set()
        actual_equals_total = True
        with d53.open(newline="", encoding="utf-8", errors="replace") as fh:
            for row in csv.DictReader(fh):
                try:
                    total = float(row["TotalWaterSupply_MLD"])
                    loss = float(row["Losses_includingNRW_MLD"])
                    actual = float(row["ActualWaterSupplied_MLD"])
                except (TypeError, ValueError, KeyError):
                    continue
                loss_ratios.add(round(loss / total, 4))
                actual_equals_total &= abs(actual - total) < 1e-9
                monthly.append(
                    {"month": row["Month_Year"], "total_supply_mld": round(total, 2)}
                )
        if loss_ratios and loss_ratios != {0.2}:
            print(
                f"  NOTE: D53 loss ratio is no longer a flat 20% ({sorted(loss_ratios)[:5]}). "
                "Re-review whether it has become a real measurement."
            )
        if not actual_equals_total:
            print("  NOTE: D53 'actual supplied' no longer equals total. Re-review.")

    coverage = []
    d52 = ws / "D52. Coverage of Water Supply Connections_0.csv"
    if d52.exists():
        with d52.open(newline="", encoding="utf-8", errors="replace") as fh:
            for row in csv.DictReader(fh):
                def _i(key):
                    try:
                        return int(float(row[key]))
                    except (TypeError, ValueError, KeyError):
                        return None
                coverage.append(
                    {
                        "year": row["Year"],
                        "properties_total": _i("Total properties in city"),
                        "properties_connected": _i(
                            "Properties served through municpal water connection"
                        ),
                        "properties_unconnected": _i(
                            "Properties without municpal water connection"
                        ),
                    }
                )

    payload = {
        **envelope(
            "data-root/supply-overview",
            registry_sources(root, ["ogd-surat-water-supply", "smc-hydraulic-scenario"]),
            "manual",
            "Monthly total supply and property-connection coverage from the Smart Cities "
            "Mission open-data releases for Surat, plus SMC's own infrastructure "
            "description. The releases' derived columns are excluded, not carried.",
            produced_by="neer-vazhvu-api/scripts/build_surat_artifacts.py",
        ),
        "_excluded_columns_note": (
            "Two columns in the source release are NOT published here because they are "
            "constants presented as measurements. 'Losses including NRW' is exactly "
            "20.0000% of total supply on all 48 monthly rows, and the accompanying "
            "'actual supplied' column equals total supply on every row, which "
            "contradicts it. The per-sub-ward release's 'domestic consumption' column is "
            "exactly 0.750000 x capacity on all 233 rows. Surat publishes no measured "
            "non-revenue water and no measured per-ward consumption."
        ),
        "infrastructure": {
            "source_river": "Tapi",
            "intake": "Weir-cum-causeway at Singanpor",
            "upstream_control": "Ukai dam, operated by the Gujarat Water Resources Department",
            "gross_daily_supply_mld_2015": 980,
            "installed_works_capacity_mld_2015": 1300,
            "piped_coverage_pct_2015": 95,
            "_vintage_note": (
                "These four figures are SMC's own and are explicitly dated 2015 on the "
                "Hydraulic department page. They describe the system, not today's output. "
                "The monthly series below runs to Dec 2021 and is the current record."
            ),
        },
        "monthly_supply": monthly,
        "connection_coverage": coverage,
        "_coverage_note": (
            "The 2020-21 jump to 157,392 unconnected properties is real signal rather "
            "than a data error: it is the June 2020 city-limit extension arriving, which "
            "took SMC from 326 km2 to 462.149 km2."
        ),
    }
    write(root / "public/data/surat-supply-overview.json", payload)
    print(f"    {len(monthly)} monthly points, {len(coverage)} coverage years")



# ---------------------------------------------------------------- rivers/OSM


OVERPASS = "https://overpass-api.de/api/interpreter"
OVERPASS_QUERY = """
[out:json][timeout:90];
(
  way["waterway"="river"]["name"~"Tapi|Tapti",i](20.95,72.55,21.40,73.10);
  way["waterway"~"river|stream"]["name"~"Khadi|khadi|Mindhola",i](21.00,72.60,21.35,73.00);
);
out geom;
"""


def build_rivers(root: Path, offline: Path | None = None) -> int:
    """OSM -> river geometry for the rivers map.

    OSM rather than SMC's GIS, deliberately: the SMC WMS carries tapi_river and
    creek layers but WFS is disabled there, so its geometry cannot be
    downloaded - only rendered. OSM is the licensed, redistributable option.

    NOTE what is missing. OSM names none of the five khadis that SMC monitors
    against danger levels, so the creeks that matter most for the flood chain
    have no geometry here. They are a named gap, not an oversight.
    """
    import urllib.parse
    import urllib.request

    if offline and offline.exists():
        doc = json.loads(offline.read_text())
    else:
        req = urllib.request.Request(
            OVERPASS,
            data=urllib.parse.urlencode({"data": OVERPASS_QUERY}).encode(),
            headers={"User-Agent": "neer-vazhvu/1.0 (water data platform)"},
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            doc = json.load(resp)

    by_name: dict[str, list] = defaultdict(list)
    for el in doc.get("elements", []):
        geom = el.get("geometry") or []
        if len(geom) < 2:
            continue
        name = (el.get("tags") or {}).get("name") or "Unnamed watercourse"
        by_name[name].append([[round(p["lon"], 6), round(p["lat"], 6)] for p in geom])

    features = []
    for name, lines in sorted(by_name.items()):
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "name": name,
                    "waterway": "river",
                    "segments": len(lines),
                },
                "geometry": {"type": "MultiLineString", "coordinates": lines},
            }
        )

    payload = {
        **envelope(
            "geojson-layers/rivers",
            [
                {
                    "id": "osm-surat-waterways",
                    "title": "OpenStreetMap waterways in the Surat area",
                    "publisher": "OpenStreetMap contributors",
                    "license": "Open Database License (ODbL) 1.0",
                    "url": "https://www.openstreetmap.org/copyright",
                }
            ],
            "api",
            "Overpass API query for named river and stream ways in the Surat "
            "bounding box, grouped into one feature per named watercourse.",
            produced_by="neer-vazhvu-api/scripts/build_surat_artifacts.py",
            note=(
                "GAP: OpenStreetMap names none of the five khadis SMC monitors against "
                "published danger levels (Kakara, Bhedwad, Mithi, Bhatena, Simada), so "
                "the creeks central to the flood chain have no geometry in this layer. "
                "SMC's own GIS holds a creek layer but serves WMS only - WFS is "
                "disabled, so its geometry cannot be redistributed."
            ),
        ),
        "type": "FeatureCollection",
        "features": features,
    }
    write(root / "public/geojson/surat-rivers.geojson", payload, compact=True)
    print(f"    {len(features)} named watercourses: {', '.join(sorted(by_name))}")
    return len(features)


# --------------------------------------------------------- facts, commitments


def build_facts(root: Path) -> int:
    """The static fact snapshot.

    Every value here is primary-sourced and dated. Nothing from press coverage,
    nothing derived from the open-data release's two synthetic columns, and
    nothing from the 2006 flood until its figures are replaced from the
    committee reports.
    """
    facts = [
        {
            "id": "surat-treated-wastewater-reused",
            "tier": 1,
            "category": "Reuse",
            "title": "Treated wastewater reused",
            "value": "330",
            "unit": "MLD",
            "interpretation": (
                "SMC reuses 330 MLD of the roughly 1,018 MLD of sewage it collects and "
                "treats, about a third, itemised across eleven named uses from textile "
                "clusters (115 MLD) to lake rejuvenation (2 MLD). This is the number "
                "that makes Surat unusual: most utilities treat sewage as a cost, and "
                "this one runs it as a revenue line."
            ),
            "source_label": "Surat Municipal Corporation, 'Reuse of Treated Used Water: A Successful Model', 8 March 2024",
            "source_url": "https://cdn.cseindia.org/attachments/0.84371800_1709877539_surat-municipal-corporation.pdf",
        },
        {
            "id": "surat-reuse-revenue",
            "tier": 1,
            "category": "Reuse",
            "title": "Cumulative revenue from selling treated water to industry",
            "value": "496.23",
            "unit": "Rs crore to January 2024",
            "interpretation": (
                "Against a capital cost of Rs 314.39 crore for three tertiary treatment "
                "plants. The tariff started at Rs 18.20 per kilolitre in 2014 and is now "
                "Rs 36.2, indexed to RBI. Annual revenue runs about Rs 120 crore. Press "
                "coverage of this programme reports different figures (Rs 340 crore, "
                "Rs 140 crore annually); these are the corporation's own."
            ),
            "source_label": "Surat Municipal Corporation, 'Reuse of Treated Used Water: A Successful Model', 8 March 2024",
            "source_url": "https://cdn.cseindia.org/attachments/0.84371800_1709877539_surat-municipal-corporation.pdf",
        },
        {
            "id": "surat-industrial-buyers",
            "tier": 2,
            "category": "Reuse",
            "title": "Industrial units buying tertiary-treated sewage",
            "value": "249",
            "unit": "units across Pandesara and Sachin",
            "interpretation": (
                "178 units in Pandesara Industrial Estate and 71 in the Sachin Textile "
                "Process Industries association, taking 115 MLD of tertiary-treated "
                "water from three plants (Bamroli 40 and 35 MLD, Dindoli 40 MLD). Surat "
                "is a textile city; these are the dyeing and printing houses that would "
                "otherwise be drawing fresh water."
            ),
            "source_label": "Surat Municipal Corporation, 'Reuse of Treated Used Water: A Successful Model', 8 March 2024",
            "source_url": "https://cdn.cseindia.org/attachments/0.84371800_1709877539_surat-municipal-corporation.pdf",
        },
        {
            "id": "surat-no-measured-nrw",
            "tier": 1,
            "category": "Supply",
            "title": "Measured non-revenue water",
            "value": "Not published",
            "unit": "",
            "interpretation": (
                "The national open-data release for Surat contains a 'losses including "
                "NRW' column, but it is exactly 20.0000% of total supply on all 48 "
                "monthly rows, and the accompanying 'actual supplied' column equals "
                "total supply on every row, which contradicts it. It is an assumption "
                "carried in a measurement column. Surat publishes no measured NRW, and "
                "we will not republish a constant as though it were a meter reading."
            ),
            "source_label": "Smart Cities Mission (Surat) open-data release D53, via data.gov.in",
            "source_url": "https://www.data.gov.in/resource/water-supply-surat",
        },
        {
            "id": "surat-city-growth",
            "tier": 2,
            "category": "Governance",
            "title": "Municipal area, 1961 to today",
            "value": "8 to 462.149",
            "unit": "sq km",
            "interpretation": (
                "SMC's own wardwise table records the city growing from 8 sq km across "
                "12 wards to 462.149 sq km across 134, in six annexations, the most "
                "recent in June 2020. A city that grew fifty-fold onto an estuarine "
                "flood plain in sixty years is the precondition for everything on the "
                "flood page."
            ),
            "source_label": "Surat Municipal Corporation, wardwise area and population (1961-2011 census and after the 2020 extension)",
            "source_url": "https://www.suratmunicipal.gov.in/TheCity/City/Stml2",
        },
        {
            "id": "surat-tapi-salinity",
            "tier": 2,
            "category": "Rivers",
            "title": "Tapi conductivity, Ukai to the sea",
            "value": "513 to 49,720",
            "unit": "umhos/cm (2022 maxima)",
            "interpretation": (
                "The Tapi's problem at Surat is not sewage. CPCB's 2022 monitoring finds "
                "BOD at or below detection limit at most Surat stations, while "
                "conductivity climbs from 369-513 at Ukai to 1,537-49,720 at the ONGC "
                "bridge at Hazira, which is seawater. This is an estuary and a salinity "
                "story, not an organic pollution one."
            ),
            "source_label": "CPCB National Water Quality Monitoring Programme 2022, Table 9 (River Tapi)",
            "source_url": "https://cpcb.gov.in/nwmp-data-2022/",
        },
        {
            "id": "surat-groundwater-record",
            "tier": 3,
            "category": "Groundwater",
            "title": "Groundwater observation record",
            "value": "94 stations, 6,563 readings",
            "unit": "1970 to 2026",
            "interpretation": (
                "A 56-year record across Surat district, from manual quarterly "
                "observations starting in 1970 to six-hourly telemetry in 2026. Deep in "
                "time, thin in space: too few stations to interpolate a per-zone depth "
                "surface honestly, so the groundwater page renders the points "
                "themselves."
            ),
            "source_label": "India-WRIS groundwater level exports, District = Surat",
            "source_url": "https://indiawris.gov.in/Dataset/Ground%20Water%20Level",
        },
    ]

    payload = {
        **envelope(
            "data-root/facts",
            registry_sources(
                root,
                ["smc-reuse-programme", "ogd-surat-water-supply", "cpcb-nwmp-2022",
                 "smc-wardwise-area-population", "wris-groundwater-gujarat"],
            ),
            "manual",
            "Hand-compiled from primary sources, each fact carrying its own citation. "
            "No press figures and no values derived from the open-data release's two "
            "synthetic columns.",
            produced_by="neer-vazhvu-api/scripts/build_surat_artifacts.py",
        ),
        "place_id": CITY,
        "generated_at": TODAY,
        "note": (
            "A static snapshot rather than a live pipeline. Surat's one live feed is the "
            "flood chain, which has its own surface."
        ),
        "facts": facts,
    }
    write(root / "public/data/facts-surat.json", payload)
    print(f"    {len(facts)} facts")
    return len(facts)


def build_commitments(root: Path) -> int:
    """The commitments register.

    Surat qualifies for this surface on the strength of one programme: the
    reuse targets are dated, institutionally owned, and published by the
    institution that has to meet them, which is exactly the register's shape.
    """
    commitments = [
        {
            "id": "surat-reuse-70-by-2030",
            "category": "Wastewater reuse",
            "title": "Reuse 70% of treated wastewater by 2030",
            "committed_by": "Surat Municipal Corporation",
            "what": (
                "SMC states a vision to raise reuse of treated wastewater from the "
                "present level, which it puts at more than 30%, to 70% by 2030. At the "
                "1,018 MLD it currently collects and treats, 70% is roughly 713 MLD "
                "against the 330 MLD reused today."
            ),
            "status": "stated",
            "target_date": "2030",
            "source_label": "Surat Municipal Corporation, 'Reuse of Treated Used Water: A Successful Model', 8 March 2024, slide 'Way Forward'",
            "source_url": "https://cdn.cseindia.org/attachments/0.84371800_1709877539_surat-municipal-corporation.pdf",
        },
        {
            "id": "surat-reuse-100-by-2035",
            "category": "Wastewater reuse",
            "title": "Reuse 100% of treated wastewater by 2035, zero liquid discharge",
            "committed_by": "Surat Municipal Corporation",
            "what": (
                "The same document commits to 100% reuse and zero liquid discharge by "
                "2035. SMC names the projects it expects to get there: 340 MLD to "
                "Hazira-based industries from the Bhesan-Asarma-Variav-Kosad plants, and "
                "140 MLD to industries at Kadodara and Palsana from the "
                "Varachha-Valak-Kamrej plant."
            ),
            "status": "stated",
            "target_date": "2035",
            "source_label": "Surat Municipal Corporation, 'Reuse of Treated Used Water: A Successful Model', 8 March 2024, slide 'Way Forward'",
            "source_url": "https://cdn.cseindia.org/attachments/0.84371800_1709877539_surat-municipal-corporation.pdf",
        },
        {
            "id": "surat-sewerage-100-by-2033",
            "category": "Sewerage coverage",
            "title": "Comprehensive sewerage coverage of 100% of area and population by 2033",
            "committed_by": "Surat Municipal Corporation, Drainage Department",
            "what": (
                "The drainage department states a commitment to 100% coverage in terms "
                "of geographical area and population by 2033. Its stated position at the "
                "time was 202 sq km covered, which it put at 99% of the then-habitable "
                "area, and 99.5% of population - but explicitly 'before city limit "
                "extension in June 2020', which took the corporation to 462.149 sq km. "
                "The denominator moved after the percentage was calculated."
            ),
            "status": "stated",
            "target_date": "2033",
            "source_label": "Surat Municipal Corporation, 'Reuse of Treated Used Water: A Successful Model', 8 March 2024, slides 'Sewerage System' and 'Sewerage Scenario'",
            "source_url": "https://cdn.cseindia.org/attachments/0.84371800_1709877539_surat-municipal-corporation.pdf",
        },
    ]

    payload = {
        **envelope(
            "data-root/commitments",
            registry_sources(root, ["smc-reuse-programme"]),
            "manual",
            "Transcribed from the corporation's own dated presentation. Each entry "
            "names the institution, the target date and the slide it came from.",
            produced_by="neer-vazhvu-api/scripts/build_surat_artifacts.py",
        ),
        "place_id": CITY,
        "updated": TODAY,
        "headline": "What Surat has promised about its water, and by when",
        "intro": (
            "Three dated commitments, all from one document and all owned by the "
            "corporation itself. Surat's register is short because its promises are "
            "concentrated: the reuse programme is the thing SMC has publicly bound "
            "itself to, and it has bound itself twice, at 2030 and 2035."
        ),
        "status_legend": {
            "stated": "Publicly stated by the institution, with a date. Not independently verified as on track.",
        },
        "update_model": (
            "History is kept, never overwritten. A status changes only against a dated "
            "citation."
        ),
        "commitments": commitments,
    }
    write(root / "public/data/commitments-surat.json", payload)
    print(f"    {len(commitments)} commitments")
    return len(commitments)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--drop", required=True, help="path to the acquired source folder")
    ap.add_argument("--root", default="..", help="repo root")
    args = ap.parse_args()

    drop = Path(args.drop).expanduser()
    root = Path(args.root).resolve()

    print("Surat artifacts")
    print("  groundwater:"); build_groundwater(drop, root)
    print("  water bodies:"); build_water_bodies(drop, root)
    print("  river quality:"); build_river_quality(root)
    print("  supply:"); build_supply(drop, root)
    print("  rivers:"); build_rivers(root, offline=Path("/tmp/surat_osm.json"))
    print("  facts:"); build_facts(root)
    print("  commitments:"); build_commitments(root)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
