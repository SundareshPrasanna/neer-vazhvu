#!/usr/bin/env python3
"""
Visakhapatnam rivers page: water quality on the city's channels, the industrial
sources and CETPs beside them, and dated official events.

THE FRAMING. CPCB's National Water Quality Monitoring Programme has no river
station on any Visakhapatnam or Anakapalli river in its 2019-2024 tables. That
is an absence of stations, not evidence of clean rivers. The city's channels
are geddas (natural drainage channels), one river and a supply canal, and the
NWMP stations that do sit on them are a reservoir, a tidal creek and a canal:

  meghadrigedda  5160 Meghadrigedda Reservoir (2024)
                 5678 Sardar Vallabhai Patel Bridge, Naval Dockyard creek (2023-24)
  gosthani       4927 Tatipudi Reservoir (2021, 2022, 2024)
  yeleru-canal   4356 Eleru (Yeleru) Canal near Pharma City (2019-2024)

5678 is attached by geometry, not by name: it sits 49 m from the OSM Meghadri
Gedda line, where way 326365737 ends and way 882176107 carries the channel's
last 4.5 km into the port's inner harbour (read 2026-10-14). Every run
re-measures every station against the rivers geojson and stops if a station
drifts past its attachment limit.

NOT ATTACHED: CPCB 4372/4373 "Gostani" and the "Gostani along Vendra" polluted
stretch are in West Godavari (about 16.58 N, 81.57 E), a different river.
2353 Kondakarla Ava is a lake. 5155 River Yeleru at Yeleru reservoir
(Yeleswaram; East Godavari district as CPCB lists it) is the canal's source
reservoir, outside the city, and is listed rather than attached. The sea and beach stations belong to the shoreline and
facts pages. We have not found published coordinates for APPCB's COMAPS
outfall stations, so their figures appear as text, never as map points.

TRANSCRIPTION PATTERN. The station-year table is transcribed from CPCB's annual
PDFs, one row per station-year with its PDF and page, the pattern of
build_pune_river_quality.py. scripts/data-raw/ holds raw upstream files only
(KML, CSV exports, PDFs) and no city keeps a CPCB-derived CSV there. The 2024
split files print a row's values on a different text line from its station
name, so they were read by word bounding box, not plain text extraction.

TYPE CAUTIONS (src/types/river-quality.ts and the shared river panel):
  - nitrate_mgl is plotted as "NO3" and compared with 45 mg/L (BIS, as nitrate).
    CPCB's column is nitrogen measured as N (NO3-N + NO2-N in most editions,
    NO3-N alone in 2023 and the 2024 split files), so nitrate_mgl stays null and
    the value travels as nitrogen_n_mgl with its basis. No exceedance is implied.
  - cod_mgl, tds_mgl and conductivity_us are number|null and the panel prints
    them as single numbers. CPCB prints annual ranges, so those are carried as
    *_range keys and summarised in the river notes instead.

Outputs (all through nvdm_write.write_artifact, which keeps an existing
envelope; delete a file first to re-emit its provenance):
  public/data/river-quality-visakhapatnam.json
  public/data/industrial-sources-visakhapatnam.json
  public/data/cetp-compliance-visakhapatnam.json
  public/data/river-events-visakhapatnam.json

Run: neer-vazhvu-api/.venv/bin/python neer-vazhvu-api/scripts/build_visakhapatnam_water_quality.py
     [--rivers-geojson PATH]   (default public/geojson/visakhapatnam-rivers.geojson)
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

from pyproj import Geod, Transformer
from shapely.geometry import MultiLineString, Point, shape
from shapely.ops import transform

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

CITY = "visakhapatnam"
DATA = REPO / "public" / "data"
RIVERS_GEOJSON = REPO / "public" / "geojson" / "visakhapatnam-rivers.geojson"
PRODUCED_BY = "neer-vazhvu-api/scripts/build_visakhapatnam_water_quality.py"
REGISTRY = json.loads((REPO / "scripts/source-registry/visakhapatnam.json").read_text())

CPCB = "https://cpcb.gov.in/wqm/"
NGT = "https://www.greentribunal.gov.in/sites/default/files/news_updates/"
APPCB = "https://pcb.ap.gov.in/APPCBDOCS/Tenders_Noti/"
OA14 = NGT + "Report%20filed%20by%20AP-PCB%20in%20OA%20No%2014%20of%202021(SZ).pdf"
OA141_R3 = NGT + "OA.141%20of%202023%20Report%20by%20R3.pdf"
OA141_R1 = NGT + "OA%20141%20of%202023%20Reply%20Affidavit%20by%20R1.pdf"
OA130_R3 = NGT + "OA.130%20of%202024%20Report%20by%20R3_1.pdf"
OA240_CPCB = NGT + "OA%20240%20of%202025%20Reply%20filed%20by%20R3%20CPCB.pdf"
GVMC_SUPPLY_2021 = NGT + "1421_0.pdf"
ADB_IEE_NW = (
    "https://www.gvmc.gov.in/wss/image_uploads/24x7%20Water%20Supply%20in%20North-West%20sector%20"
    "(GVMC02)%20-%20IEE%20-%20Jan%202019.pdf"
)
COMAPS_AVG = (
    APPCB
    + "Pdf%27s/WQM//COMAPS%20Annual%20Averages%20-%202011%20-%2025(%20upto%20March%20).pdf"
)
APPCB_NWMP_2025_03 = APPCB + "MARCH%20-2025.pdf"
AETL_ORDER = (
    APPCB + "Meetings/AETL%20CETP%20VSP%20-%20Dir%20-%2014122023%20-%2006122023.pdf"
)
VPC_CTO_2025 = (
    APPCB
    + "Meetings/DS%20Visakha%20Pharmacity%20CTO%26HWA%20order%2007.04.2025_20250514_113727.pdf"
)
VPC_CTO_AGENDA_2025 = (
    APPCB + "Meetings/27%20Agenda%20-%20Visakha%20Pharmacity_20250514_113715.pdf"
)
# APPCB Consent Management (CTO) Committee minutes that carry the AETL items.
CTO_MINUTES = {
    "2025-02-14": APPCB
    + "Meetings/DS%20-%20CTO%20minutes%2014.02.2025_20250325_115430.pdf",
    "2025-10-29": APPCB
    + "Meetings/DS%20CTO%20Minutes%2029.10.2025_20251123_213928.pdf",
    "2025-12-08": APPCB
    + "Meetings/DS%20CTO%20Minutes%2008.12.2025_20260107_201112.pdf",
}
CEMS_2020 = (
    APPCB
    + "/Status%20of%20CETP%20connectivity%20status%20of%20CEMS%20on%2013-03-2020.pdf"
)
VPCL_SITE = "https://www.visakhapharmacity.com/cms/infrastructure"
RINL_CRZ_2014 = (
    "https://www.vizagsteel.com/upload_master/uploads/Others-Environment/EN/581.pdf"
)
RINL_EC_2025 = (
    "https://www.vizagsteel.com/upload_master/uploads/"
    "Environmental%20Clearences%20(6.3%20-%207.3%20MTPA)/EN/5565.pdf"
)
HPCL_FORM_V_2024 = (
    "https://www.hindustanpetroleum.com/documents/pdf/HPCL-VR-Form-V-2023-24.pdf"
)
HPC_2020 = "https://safteng.net/wp-content/uploads/2020/07/HPCR_on_Styrene_vapour_release_accident_at_LG_Polymers.pdf"

# ── CPCB NWMP station table ───────────────────────────────────────────────────
# Coordinates as CPCB prints them in the 2024 split files. max_offset_m is the
# attachment limit against the river line: tight for 5678, which is attached on
# geometry alone; looser for stations named for the reservoir or canal they sit on.
STATIONS = {
    "5160": dict(
        river="meghadrigedda",
        name="Meghadrigedda Reservoir, Visakhapatnam City",
        lat=17.757379,
        lng=83.184834,
        stretch="Reservoir",
        max_offset_m=3000,
    ),
    "5678": dict(
        river="meghadrigedda",
        name="Sardar Vallabhai Patel Bridge, Navel Dockyard",
        lat=17.710863,
        lng=83.262848,
        stretch="Dockyard creek",
        max_offset_m=500,
    ),
    "4927": dict(
        river="gosthani",
        name="Tatipudi Reservoir, Tatipudi (V), Gantyada (M)",
        lat=18.171722,
        lng=83.196667,
        stretch="Thatipudi reservoir",
        max_offset_m=3000,
    ),
    "4356": dict(
        river="yeleru-canal",
        name="Eleru Canal near Pharma City, Thadi (V), Paravada (M)",
        lat=17.680833,
        lng=83.079722,
        stretch="Near Pharma City",
        max_offset_m=3000,
    ),
}

# fmt: off
NN, N3 = "NO3-N + NO2-N", "NO3-N only"
# station, year, (combined annual PDF under CPCB, page) or None where only the
# 2024 split files carry the station, then (min, max) for temperature C, DO
# mg/L, pH, conductivity uS/cm, BOD mg/L, nitrogen as N mg/L, faecal coliform
# MPN/100 mL, total coliform MPN/100 mL, and the nitrogen basis.
READINGS = [
    ("5160", 2024, None, (26, 30), (5.5, 8.5), (7.46, 8.49), (508, 2092), (1.6, 2.8), (0.5, 1.16), (3, 7), (64, 210), N3),
    ("5678", 2023, ("2023/Water_creek_marine_seawater_beach_2023.pdf", 1), (24, 31), (1.0, 5.8), (6.2, 7.4), (17000, 48800), (1.8, 5.6), (0.5, 3.7), (3, 21), (43, 1100), N3),
    ("5678", 2024, ("2024/Water_creek_marine_seawater_beach_2024.pdf", 1), (26, 29), (2.4, 6.3), (6.1, 7.9), (562, 53900), (2.1, 4.4), (0.69, 6.66), (3, 11), (93, 460), NN),
    ("4927", 2021, ("2021/Water_pond_tanks_2021.pdf", 1), (25, 32), (4.1, 8.0), (7.0, 8.2), (216, 392), (1.2, 2.4), (0.34, 2.29), (3, 4), (39, 75), NN),
    ("4927", 2022, ("2022/Water_pond_tanks_2022.pdf", 3), (25, 29), (5.7, 8.0), (7.1, 8.5), (218, 444), (1.2, 2.8), (0.38, 1.75), (3, 21), (39, 2400), NN),
    ("4927", 2024, None, (23, 32), (6, 8.5), (7.34, 8.05), (144, 239), (1.1, 2.8), (0.3, 0.55), (3, 4), (43, 120), N3),
    ("4356", 2019, ("2019/Water_Quality_Canals_Sea_Water_Drains_STPs_2019.pdf", 1), (25, 32), (5.6, 7.5), (7.6, 8.4), (249, 634), (1.1, 2.5), (0.63, 2.09), (7, 20), (69, 150), NN),
    ("4356", 2020, ("2020/Water_Quality_Canals_2020.pdf", 1), (23, 28), (4.9, 6.6), (7.4, 8.1), (248, 398), (1.5, 2.5), (0.35, 3.47), (7, 11), (64, 210), NN),
    ("4356", 2021, ("2021/Water_Quality_Canals_2021.pdf", 1), (25, 29), (5.5, 8.0), (6.7, 7.9), (198, 390), (1.4, 2.2), (0.3, 1.6), (7, 9), (93, 120), NN),
    ("4356", 2022, ("2022/Water_Quality_Drains_STPs__WTPs_2022.pdf", 11), (26, 29), (5.1, 8.2), (7.35, 8.43), (260, 509), (1.7, 3.4), (0.39, 2.23), (3, 15), (93, 460), NN),
    ("4356", 2023, ("2023/Water_Quality_Canals_2023.pdf", 1), (25, 30), (4.5, 6.5), (7.3, 8.3), (275, 381), (1.1, 2.8), (0.3, 0.9), (3, 21), (75, 460), N3),
    ("4356", 2024, ("2024/Water_Quality_Canals_2024.pdf", 1), (26, 28), (5, 6.8), (6.45, 8.46), (241, 479), (1.8, 2.5), (0.48, 1.59), (3, 7), (75, 210), NN),
]

# 2024 split files (physico-chemical, nitrogen, bacteriological): their pages,
# then samples, BOD mean, COD (min, max, mean) and TDS (min, max), mg/L.
# File names as CPCB's nwmp-data-2024 page links them: some contain spaces (%20).
_CANAL = ("CanalDrainSTPWTP%20Reservoir-PhysicoChemical.pdf", "CanalDrainSTPWTPReservoir-Nitorgen%20Indicator.pdf", "CanalsDrainSTPWTP%20Reservoir-Bectological.pdf")
_COAST = ("Coastal-PhysicoChemical.pdf", "Coastal-Nitorgen%20Indicator.pdf", "Coastal-Bectological.pdf")
_LPT = ("LPT-PhysicoChemical.pdf", "LPT-Nitorgen%20Indicator.pdf", "LPT-Bectological.pdf")
SPLIT_2024 = {
    "5160": (zip(_CANAL, (1, 2, 1)), 12, 2.3, (16, 25, 20.0), (304, 1364)),
    "5678": (zip(_COAST, (1, 1, 1)), 12, 3.3, (14, 28, 21.8), (364, 36836)),
    "4927": (zip(_LPT, (2, 1, 2)), 12, 2.2, (11, 20, 14.5), (128, 168)),
    "4356": (zip(_CANAL, (1, 1, 1)), 12, 2.1, (11, 21, 15.6), (172, 316)),
}
SPLIT_2024 = {k: ([(f"{CPCB}2024/{f}", p) for f, p in v[0]], *v[1:]) for k, v in SPLIT_2024.items()}

RIVERS = {
    "meghadrigedda": dict(
        name="Meghadri Gedda",
        name_te="మేఘాద్రి గెడ్డ",
        description=(
            "CPCB's 2019-2024 tables list no river station on the Meghadri Gedda, or on any other river in "
            "Visakhapatnam. The readings here come from two other kinds of station on this channel: the "
            "Meghadrigedda reservoir, and a tidal creek at the Sardar Vallabhai Patel bridge by the Naval "
            "Dockyard, close to where the channel enters the port's inner harbour. Below the reservoir the "
            "channel runs to the sea as the reservoir's surplus course."
        ),
    ),
    "gosthani": dict(
        name="Gosthani",
        name_te="గోస్తని",
        description=(
            "CPCB's 2019-2024 tables list no river station on the Gosthani in Visakhapatnam. The readings here "
            "are from Thatipudi reservoir on the Gosthani, upstream in Vizianagaram district. CPCB stations named "
            "'Gostani' (4372 and 4373) are on a different river in West Godavari district and are not used here."
        ),
    ),
    "yeleru-canal": dict(
        name="Yeleru Left Main Canal",
        name_te="",
        description=(
            "A supply canal, not a river; CPCB's 2019-2024 tables list no river station in Visakhapatnam. "
            "The readings here are from CPCB's station on the canal near Jawaharlal Nehru Pharma City at "
            "Parawada, which CPCB lists as 'Eleru Canal'. The length shown is the stretch drawn on this map "
            "from OpenStreetMap."
        ),
    ),
}

# APPCB COMAPS annual averages for the Meghadrigedda surplus course where it
# meets the sea (station 22, pdf p9 label, p10 rows). DO, BOD, NH3-N mg/L.
COMAPS_MEGHADRIGEDDA = {"2023-24": (2.7, 4.3, 2.66), "2024-25": (4.4, 3.1, 0.31)}
# Station 16, "Confluence point of Gosthani river joining the sea near Bheemili
# municipal office" (pdf p7): FY2024-25 DO, BOD mg/L.
COMAPS_GOSTHANI_MOUTH = (6.1, 2.2)
# APPCB monthly NWMP, March 2025, pdf p1: (date, DO, BOD) per station.
APPCB_2025_03 = {"5160": ("5 March 2025", 7.6, 1.8), "4927": ("6 March 2025", 7.8, 1.9), "4356": ("6 March 2025", 6.2, 1.9)}
# Lowest DO floor of any coastal class (SW-III, SW-IV harbour waters, SW-V): COMAPS annual averages pdf p19.
SW_LOWEST_DO_FLOOR = 3.0
# fmt: on


def rng(t):
    return {"min": t[0], "max": t[1]}


def fmt(x) -> str:
    """As printed: thousands separators on integers, floats keep their decimal (1.0, not 1)."""
    return f"{x:,}" if isinstance(x, int) else str(x)


def source(sid: str, title: str, **extra) -> dict:
    """A provenance source whose publisher, URL and licence the registry owns."""
    entry = next(s for s in REGISTRY["sources"] if s["id"] == sid)
    out = {
        "id": sid,
        "title": title,
        "publisher": entry["publisher"],
        "license": registry_license(sid),
    }
    return {**out, "url": entry["url"], **extra}


def envelope(dataset: str, sources: list, method: str, note: str, **prov) -> dict:
    return {
        "nvdm": "1.0",
        "dataset": f"data-root/{dataset}",
        "scope": {"kind": "city", "id": CITY},
        "provenance": {
            "sources": sources,
            "method": method,
            "produced_at": date.today().isoformat(),
            "produced_by": PRODUCED_BY,
            "note": note,
            **prov,
        },
    }


def dms(d: int, m: int, s: float) -> float:
    return d + m / 60 + s / 3600


# ── geometry ──────────────────────────────────────────────────────────────────
GEOD = Geod(ellps="WGS84")
TO_UTM = Transformer.from_crs(
    "EPSG:4326", "EPSG:32644", always_xy=True
).transform  # UTM 44N spans 78-84 E


def load_rivers(path: Path) -> dict:
    fc = json.loads(path.read_text())
    out = {}
    for f in fc["features"]:
        rid = (f.get("properties") or {}).get("river_id")
        if rid in RIVERS:
            g = shape(f["geometry"])
            lines = list(g.geoms) if isinstance(g, MultiLineString) else [g]
            km = f["properties"].get("length_km")
            if km is None:
                km = sum(GEOD.line_length(*zip(*ln.coords)) for ln in lines) / 1000
            out[rid] = {
                "geom_m": transform(TO_UTM, g),
                "length_km": round(float(km), 1),
            }
    missing = set(RIVERS) - set(out)
    if missing:
        sys.exit(f"{path}: no feature for river_id {sorted(missing)}")
    return out


# ── status, mirroring src/lib/utils/river-classification.ts ──────────────────
SEVERITY = ["healthy", "stressed", "degraded", "severely_degraded", "dead"]


def classify(do_min, bod_max) -> str | None:
    if do_min is None and bod_max is None:
        return None
    for status, do_floor, bod_ceiling in (
        ("dead", 1, 30),
        ("severely_degraded", 4, 6),
        ("degraded", 5, 3),
        ("stressed", 6, 2),
    ):
        if (do_min is not None and do_min < do_floor) or (
            bod_max is not None and bod_max > bod_ceiling
        ):
            return status
    return "healthy"


def reading(row) -> dict:
    code, year, combined, temp, do, ph, cond, bod, nitro, fc, tc, basis = row
    split = SPLIT_2024.get(code) if year == 2024 else None
    src = [{"url": CPCB + combined[0], "page": combined[1]}] if combined else []
    if split:
        src += [{"url": u, "page": p} for u, p in split[0]]
    out = {
        "year": year,
        "do_mgl": rng(do),
        "bod_mgl": rng(bod),
        "ph": rng(ph),
        "conductivity_us": None,
        "cod_mgl": None,
        "fecal_coliform_mpn": rng(fc),
        "tds_mgl": None,
        "nitrate_mgl": None,
        "chromium_mgl": None,
        "lead_mgl": None,
        "cadmium_mgl": None,
        "temperature_c": rng(temp),
        "conductivity_us_range": rng(cond),
        "nitrogen_n_mgl": rng(nitro),
        "nitrogen_basis": basis,
        "total_coliform_mpn": rng(tc),
    }
    if split:
        _, n, bod_mean, cod, tds = split
        out |= {
            "n_samples": n,
            "bod_mean_mgl": bod_mean,
            "cod_mgl_range": {**rng(cod), "mean": cod[2]},
            "tds_mgl_range": rng(tds),
        }
    return out | {"source": src}


def river_notes(rid: str, stations: list[dict]) -> str:
    rows = {s["id"]: s["readings"] for s in stations}
    if rid == "meghadrigedda":
        creek = {r["year"]: r for r in rows["nwmp-5678"]}
        res = rows["nwmp-5160"][-1]
        c23, c24 = (COMAPS_MEGHADRIGEDDA[k] for k in ("2023-24", "2024-25"))
        d5160, do5160, bod5160 = APPCB_2025_03["5160"]
        if max(creek[y]["do_mgl"]["min"] for y in (2023, 2024)) >= SW_LOWEST_DO_FLOOR:
            sys.exit(
                "dockyard creek DO minimum no longer below every coastal class floor: re-word the note"
            )
        return (
            f"Lowest dissolved oxygen at the dockyard creek: {fmt(creek[2023]['do_mgl']['min'])} mg/L in 2023 and "
            f"{fmt(creek[2024]['do_mgl']['min'])} mg/L in 2024, against the 4.0 mg/L minimum CPCB prints for Class SW-II "
            f"coastal water, and below {fmt(SW_LOWEST_DO_FLOOR)} mg/L, the lowest oxygen floor APPCB lists for any coastal "
            f"class, harbour waters (SW-IV) included. APPCB samples the surplus course where, in its words, it joins "
            f"the sea 'along with all the industrial effluents' at the parallel bridge near the dockyard: annual average DO {fmt(c23[0])} mg/L and BOD "
            f"{fmt(c23[1])} mg/L in 2023-24, DO {fmt(c24[0])} mg/L and BOD {fmt(c24[1])} mg/L in 2024-25. In the reservoir, "
            f"CPCB's {res['n_samples']} samples in 2024 ranged from {fmt(res['tds_mgl_range']['min'])} to "
            f"{fmt(res['tds_mgl_range']['max'])} mg/L of dissolved solids; APPCB's sample of {d5160} read DO "
            f"{fmt(do5160)} mg/L and BOD {fmt(bod5160)} mg/L."
        )
    rs = next(iter(rows.values()))
    do_lo = min(r["do_mgl"]["min"] for r in rs)
    bod_hi = max(r["bod_mgl"]["max"] for r in rs)

    def when(key, end, v):
        return ", ".join(str(r["year"]) for r in rs if r[key][end] == v)

    years = [str(r["year"]) for r in rs]
    d, do25, bod25 = APPCB_2025_03[stations[0]["nwmp_code"]]
    return (
        f"CPCB published readings for {', '.join(years[:-1])} and {years[-1]}. Lowest dissolved oxygen: "
        f"{fmt(do_lo)} mg/L ({when('do_mgl', 'min', do_lo)}). Highest BOD: {fmt(bod_hi)} mg/L "
        f"({when('bod_mgl', 'max', bod_hi)}). APPCB's monthly sample of {d} read DO {fmt(do25)} mg/L and BOD "
        f"{fmt(bod25)} mg/L."
    ) + (
        f" APPCB's 2024-25 annual average where the Gosthani joins the sea near Bheemili: DO "
        f"{fmt(COMAPS_GOSTHANI_MOUTH[0])} mg/L, BOD {fmt(COMAPS_GOSTHANI_MOUTH[1])} mg/L."
        if rid == "gosthani"
        else ""
    )


def build_river_quality(geo: dict) -> dict:
    by_station: dict[str, list] = {}
    for row in READINGS:
        by_station.setdefault(row[0], []).append(reading(row))
    rivers, checks = [], {}
    for rid, meta in RIVERS.items():
        stations, worst = [], None
        for code, st in STATIONS.items():
            if st["river"] != rid:
                continue
            offset = round(
                geo[rid]["geom_m"].distance(Point(TO_UTM(st["lng"], st["lat"])))
            )
            if offset > st["max_offset_m"]:
                sys.exit(
                    f"station {code} is {offset} m from the {rid} line (limit {st['max_offset_m']} m): re-check the attachment"
                )
            checks[code] = {
                "river_id": rid,
                "offset_m": offset,
                "limit_m": st["max_offset_m"],
            }
            readings = sorted(by_station[code], key=lambda r: r["year"])
            latest = readings[-1]
            status = classify(latest["do_mgl"]["min"], latest["bod_mgl"]["max"])
            worst = (
                status
                if worst is None or SEVERITY.index(status) > SEVERITY.index(worst)
                else worst
            )
            stations.append(
                {
                    "id": f"nwmp-{code}",
                    "nwmp_code": code,
                    "name": st["name"],
                    "lat": st["lat"],
                    "lng": st["lng"],
                    "stretch": st["stretch"],
                    "position_method": "coordinates as printed in CPCB's 2024 NWMP split files",
                    "osm_river_offset_m_before": offset,
                    "off_osm_river_polyline": offset > 2000,
                    "readings": readings,
                }
            )
        rivers.append(
            {
                "id": rid,
                "name": meta["name"],
                "name_ta": "",
                **({"name_te": meta["name_te"]} if meta["name_te"] else {}),
                "length_km": geo[rid]["length_km"],
                "length_basis": "drawn line in public/geojson/visakhapatnam-rivers.geojson (OpenStreetMap)",
                "overall_status": worst,
                "cpcb_class": "Not assessed (no river station in CPCB's 2019-2024 tables)",
                "description": meta["description"],
                "notes": river_notes(rid, stations),
                "stations": stations,
            }
        )
    years = [r[1] for r in READINGS]
    sources = [
        source(
            "cpcb-nwmp-visakhapatnam",
            "CPCB NWMP annual water-quality tables, 2019-2024 editions (canal, pond/tank, creek/coastal tables and the 2024 split files)",
        ),
        source(
            "appcb-coastal-monitoring",
            "APPCB COMAPS annual averages FY2010-11 to FY2024-25 (pdf pp. 7, 9-10, 19) and APPCB NWMP data for March 2025 (pdf p. 1)",
            documents=[COMAPS_AVG, APPCB_NWMP_2025_03],
        ),
    ]
    note = (
        "Annual MIN-MAX per station as CPCB prints it; no midpoint is derived. CPCB's 2019-2024 tables list no "
        "river station in Visakhapatnam: these are the reservoir, creek and canal stations on the three channels. "
        "Station 5678 is attached to the Meghadri Gedda by measured distance to the OSM line (geometry_check)."
    )
    conventions = {
        "reading_shape": "{min, max} for the calendar year, as published. Blank, '-' and BDL cells are null.",
        "nitrogen": (
            "CPCB's nitrogen column is nitrogen as N (NO3-N + NO2-N in most editions, NO3-N alone in 2023 and the "
            "2024 split files; nitrogen_basis per reading). It is not nitrate as NO3, so nitrate_mgl is null and "
            "nothing here is compared with the 45 mg/L BIS nitrate limit."
        ),
        "typed_single_value_fields": (
            "conductivity_us, cod_mgl and tds_mgl are typed as single numbers and the shared panel renders them so; "
            "CPCB prints ranges, carried as conductivity_us_range, cod_mgl_range and tds_mgl_range."
        ),
        "split_2024": (
            "2024 values come from the combined annual table where CPCB published one (4356, 5678), with samples, "
            "BOD mean, COD and TDS from the split files. 5160 and 4927 appear only in the split files. The one "
            "disagreement: 5678 pH minimum is 6.1 in the combined creek table and 6.05 in the split file; 6.1 is used."
        ),
        "geometry_check": checks,
    }
    return {
        **envelope(
            "river-quality",
            sources,
            "pdf-extract",
            note,
            conventions=conventions,
            internal_inputs=["public/geojson/visakhapatnam-rivers.geojson"],
        ),
        "last_updated": "2024",
        "data_year_range": [min(years), max(years)],
        "source": "CPCB National Water Quality Monitoring Programme (NWMP), annual tables for canals, reservoirs and coastal water, 2019-2024",
        "source_url": "https://cpcb.gov.in/nwmp-data-2024/",
        "source_label": "CPCB NWMP annual data, 2019-2024 (canal, reservoir and creek tables)",
        "_framing": "CPCB's NWMP has no river station on any Visakhapatnam or Anakapalli river in its 2019-2024 tables. That is a gap in stations, not a finding about the rivers.",
        "_not_attached": {
            "4372, 4373 and the 'Gostani along Vendra' stretch": "West Godavari district (about 16.58 N, 81.57 E), a different river from Visakhapatnam's Gosthani",
            "2353 Kondakarla Ava": "a lake, not one of these channels",
            "5155 River Yeleru at Yeleru reservoir, Yeleswaram": "on the Yeleru river at the reservoir the canal draws from (17.30 N, 82.08 E, East Godavari district as CPCB lists it), outside the city; not a station on the canal itself",
            "4357, 5673-5677, 4349, 4352": "beach and sea stations, for the shoreline and facts pages",
            "APPCB COMAPS outfall stations": "no published coordinates found; figures are quoted in river notes, never placed on the map",
        },
        "rivers": rivers,
    }


# ── industrial sources and CETPs ─────────────────────────────────────────────
RINL_LAT, RINL_LNG = round(dms(17, 35, 39), 6), round(dms(83, 13, 50), 6)
# CETP bounding coordinates, Andhra University report annexed to APPCB's NGT report (OA 141/2023 (SZ), pdf p112).
JNPC_LAT = round((dms(17, 38, 58.7) + dms(17, 38, 48.40)) / 2, 6)
JNPC_LNG = round((dms(83, 4, 39.80) + dms(83, 5, 2.00)) / 2, 6)
# (high-TDS, low-TDS) KLD: CFO orders of 12.08.2021 and 02.09.2021 (OA 141/2023 (SZ) R3 pdf p12; total 9553 KLD
# in APPCB's CTO committee agenda of 17.03.2025), and the consent order of 07.04.2025 (pdf p1; total on p2).
# capacity_mld follows the latest order.
JNPC_CONSENT_2021, JNPC_CONSENT_2025 = (2500, 7053), (3000, 7053)
JNPC_CAPACITY_MLD = sum(JNPC_CONSENT_2025) / 1000
JNPC_RELEASES = [
    {
        "from": "2022-01",
        "to": "2023-09",
        "samples": 506,
        "not_meeting": 26,
        "pct_as_published": 5,
        "source": {
            "url": OA141_R3,
            "page": 15,
            "document": "APPCB report dated 14.12.2023, Annexure-II to its 06.07.2024 report to the NGT in OA 141/2023 (SZ)",
        },
    },
    {
        "from": "2023-04",
        "to": "2024-03",
        "samples": 358,
        "not_meeting": 24,
        "pct_as_published": 6.7,
        "source": {
            "url": OA130_R3,
            "page": 5,
            "document": "APPCB report to the NGT in OA 130/2024 (SZ), 06.07.2024",
        },
    },
    {
        "from": "2023-06",
        "to": "2024-05",
        "samples": 305,
        "not_meeting": 16,
        "pct_as_published": 5.25,
        "parameters_named": ["TSS", "COD", "NH3-N"],
        "source": {
            "url": OA141_R3,
            "page": 4,
            "document": "APPCB report to the NGT in OA 141/2023 (SZ), 06.07.2024 (counts and release rule on pdf p4; parameters on Annexure-VII, pdf p177)",
        },
        "parameters_source": {
            "url": OA141_R3,
            "page": 177,
            "document": "Annexure-VII (printed p175): APPCB Zonal Laboratory, Visakhapatnam, consolidated report of marine outfall discharges, June 2023 to May 2024; scanned page with no text layer",
        },
    },
]


def build_industrial_sources() -> dict:
    r305 = JNPC_RELEASES[2]
    r506 = JNPC_RELEASES[0]
    rows = [
        {
            "id": "rinl-vsp-outfall",
            "name": "Visakhapatnam Steel Plant: recommended marine outfall point",
            "type": "discharge_zone",
            "lat": RINL_LAT,
            "lng": RINL_LNG,
            "operator": "Rashtriya Ispat Nigam Ltd (RINL)",
            "rivers_affected": [],
            "pollutants": ["cod", "tss", "ammonia", "phenol"],
            "position_basis": "the outfall point NIO recommended, as recorded in the 2014 CRZ clearance (2014 document, history vintage); RINL's 2025 compliance report says the outfall follows NIO's recommended route but gives no as-built coordinates",
            "description": (
                "Marker: the marine outfall point NIO recommended, as the steel plant's 2014 CRZ clearance records it, at "
                "20 m depth and 1.12 km from the landfall point. RINL's compliance report for April to September 2025 "
                "says the outfall was built on the route NIO recommended, but gives no coordinates for it. The same "
                "report, against a clearance condition that overflow from the pond be discharged to the sea through "
                "the marine outfall, says four guard ponds with cameras have been built and RINL is awaiting APPCB's "
                "clearance to start operating them. It lists coke-oven effluent treatment plant "
                "discharge of 3,482.1 to 4,243.5 KLD against 4,800 KLD in the plant's latest consent to operate (the "
                "same report also lists a condition of the 2005 expansion clearance capping coke-oven effluent at "
                "2,880 cum/day), and COD of 262 mg/L in June 2025 against a 250 mg/L limit. It reaches this page "
                "through the Yeleru canal: GVMC's daily supply statement of 11 March 2021, filed with the NGT in OA 14/2021 (SZ), lists "
                "the steel plant among the canal's users. Its effluent goes to the sea, not into the canal."
            ),
            "documents": [
                {
                    "url": RINL_CRZ_2014,
                    "page": 1,
                    "title": "MoEF CRZ clearance F.No. 11-121/2010-IA.III, 12.02.2014 (hosted by RINL)",
                },
                {
                    "url": RINL_EC_2025,
                    "page": 14,
                    "title": "RINL six-monthly EC compliance report, Apr-Sep 2025, Part D: coke-oven effluent condition of the 2005 expansion clearance (2,880 cum/day) and the consent's 4,800",
                },
                {
                    "url": RINL_EC_2025,
                    "page": 15,
                    "title": "same report: outfall route and guard ponds",
                },
                {
                    "url": RINL_EC_2025,
                    "page": 38,
                    "title": "same report, Annexure-2: monthly effluent discharge and quality, Apr-Sep 2025",
                },
                {
                    "url": GVMC_SUPPLY_2021,
                    "page": 20,
                    "title": "GVMC daily water supply statement, 11.03.2021, in NGT OA 14/2021 (SZ)",
                },
            ],
            "source": RINL_CRZ_2014,
        },
        {
            "id": "jnpc-cetp",
            "name": "JN Pharma City CETP (Visakha Pharmacity Ltd)",
            "type": "cetp",
            "lat": JNPC_LAT,
            "lng": JNPC_LNG,
            "operator": "Visakha Pharmacity Ltd (formerly Ramky Pharma City (India) Ltd)",
            "rivers_affected": [],
            # parameters exceeded in rejected samples, June 2023 to May 2024 (Annexure-VII, pdf p177)
            "pollutants": ["tss", "cod", "ammonia"],
            "capacity_mld": JNPC_CAPACITY_MLD,
            "discharges_to": "Bay of Bengal, through a marine outfall (16 km onshore and 1.75 km offshore pipeline, 18 m depth)",
            "position_basis": "centre of the CETP's bounding coordinates in the Andhra University report annexed to APPCB's NGT report (OA 141/2023 (SZ), pdf p112); the plant, not the outfall",
            "description": (
                "Treats effluent from the pharma city's bulk-drug, pharmaceutical and chemical units (94 of 104 "
                "established units in operation, APPCB, December 2023). The pharma city draws its water from the Yeleru "
                "canal, supplied by APIIC; the treated effluent goes to the sea through a marine outfall, not into "
                "the canal. Treated effluent is held in guard ponds and released only after it meets marine "
                "discharge standards, in the presence of APPCB officials. "
                f"{r305['not_meeting']} of "
                f"{r305['samples']} samples did not meet marine discharge standards from June 2023 to May 2024, and "
                f"{r506['not_meeting']} of {r506['samples']} from January 2022 to September 2023. A batch that does "
                "not meet them is sent back to the CETP for re-treatment. Marker: the plant, not the outfall."
            ),
            "documents": [
                {
                    "url": OA141_R3,
                    "page": 12,
                    "title": "APPCB report dated 14.12.2023, Annexure-II to its 06.07.2024 report to the NGT, OA 141/2023 (SZ)",
                },
                {
                    "url": OA141_R3,
                    "page": 15,
                    "title": "same report of 14.12.2023: marine outfall rejections, January 2022 to September 2023, and releases in the presence of APPCB officials",
                },
                {
                    "url": OA141_R3,
                    "page": 4,
                    "title": "APPCB report to the NGT, OA 141/2023 (SZ), 06.07.2024: marine outfall monitoring",
                },
                {
                    "url": OA141_R3,
                    "page": 177,
                    "title": "the 06.07.2024 report's Annexure-VII: samples rejected and parameters exceeded (TSS, COD, NH3-N), June 2023 to May 2024",
                },
                {
                    "url": VPC_CTO_2025,
                    "page": 2,
                    "title": "APPCB consent order APPCB/VSP/VSP/285/HO/CTO/2025 of 07.04.2025: total 10,053 KLD (capacity_mld)",
                },
            ],
            "source": OA141_R3,
        },
    ]
    sources = [
        source(
            "industry-ec-compliance-visakhapatnam",
            "RINL CRZ clearance (2014, hosted by RINL) and six-monthly EC compliance report (Apr-Sep 2025)",
        ),
        source(
            "appcb-consents-directions-visakhapatnam",
            "APPCB consent order for the Visakha Pharmacity CETP (07.04.2025)",
        ),
        source(
            "ngt-andhra-filings",
            "APPCB report of 06.07.2024 to the NGT in OA 141/2023 (SZ) and its annexed report of 14.12.2023; GVMC daily water supply statement in NGT OA 14/2021 (SZ)",
        ),
    ]
    note = (
        "Only units with a published coordinate are mapped, and each marker states what it marks. The 2023 joint "
        "committee's list of discharges into the Meghadrigedda surplus course (HPCL, Coromandel, The Andhra "
        "Petrochemicals; ArcelorMittal Nippon Steel appears in the committee's per-plant table, but its conclusions "
        "say that plant discharges once-through cooling sea water to the sea) has no coordinates and is carried as a "
        "dated event in river-events-visakhapatnam.json. Both CETPs and the steel plant's outfall discharge to the "
        "sea, not into these channels, so rivers_affected is empty for the two mapped units. Their link to the "
        "Yeleru canal, which supplies their water, is stated in each description."
    )
    return {
        **envelope("industrial-sources", sources, "manual", note),
        "last_updated": "2025-09",
        "_not_mapped": {
            "Coromandel International": "the only published point we have found is CPCB's 2013 air-monitoring station at the plant, not a discharge point",
            "HPCL Visakh Refinery, The Andhra Petrochemicals, ArcelorMittal Nippon Steel India": "no published coordinate found; in the Meghadrigedda events",
            "Atchutapuram Effluent Treatment Ltd CETP": "no published coordinate found; in cetp-compliance-visakhapatnam.json",
        },
        "_cetp_join": "No cetp_id: the shared panel's compliance card is written for Surat's per-sample record (it prints 'GPCB consent' and 'monthly samples'). Join only after that card is generalised.",
        "sources": rows,
    }


def build_cetp_compliance() -> dict:
    jnpc = {
        "id": "jnpc",
        "name": "JN Pharma City CETP (Visakha Pharmacity Ltd)",
        "short": "JN Pharma City",
        "operator": "Visakha Pharmacity Ltd (formerly Ramky Pharma City (India) Ltd)",
        "estate": "Jawaharlal Nehru Pharma City, Parawada",
        "lat": JNPC_LAT,
        "lng": JNPC_LNG,
        "member_units": {
            "established": 104,
            "in_operation": 94,
            "source": {
                "url": OA141_R3,
                "page": 12,
                "document": "APPCB report dated 14.12.2023, Annexure-II to its 06.07.2024 report to the NGT in OA 141/2023 (SZ)",
            },
        },
        "capacity_mld": JNPC_CAPACITY_MLD,
        "capacity_basis": "consented treatment volume in APPCB order APPCB/VSP/VSP/285/HO/CTO/2025 of 07.04.2025 (high-TDS 3,000 KLD plus low-TDS 7,053 KLD)",
        "consents": [
            {
                "order": "APPCB CFO orders of 12.08.2021 and 02.09.2021",
                "htds_kld": JNPC_CONSENT_2021[0],
                "ltds_kld": JNPC_CONSENT_2021[1],
                "valid_to": "2026-05-31",
                "source": {"url": OA141_R3, "page": 12},
            },
            {
                "order": "APPCB/VSP/VSP/285/HO/CTO/2025 of 07.04.2025",
                "htds_kld": JNPC_CONSENT_2025[0],
                "ltds_kld": JNPC_CONSENT_2025[1],
                "disposal": "low-TDS effluent treated in the biological ETP, then to sea through the marine outfall after meeting marine discharge standards",
                "source": {"url": VPC_CTO_2025, "page": 1},
            },
        ],
        "receiving_water": "Bay of Bengal, through a marine outfall",
        "outfall": {
            "onshore_km": 16,
            "offshore_km": 1.75,
            "depth_m": 18.0,
            "source": {"url": OA141_R3, "page": 12},
            "nio_suggested": {
                "distance_from_coast_km": 1.44,
                "depth_m": 18,
                "source": {"url": OA141_R3, "page": 181},
            },
        },
        "effluent_flow": {
            "received_ltds_kl_month": 78273,
            "received_htds_kl_month": 55170,
            "treated_total_kl_month": 133443,
            "basis": "MoEFCC prints the low-TDS and high-TDS figures as received at the CETP, and the total as treated effluent (LTDS+HTDS)",
            "period": "average of March to July 2024",
            "source": {
                "url": OA141_R1,
                "page": 33,
                "document": "MoEFCC Sub-Office, Vijayawada inspection (30.08.2024), in its reply in OA 141/2023 (SZ)",
            },
        },
        "release_compliance": JNPC_RELEASES,
        "release_rule": "Treated water that does not meet marine discharge standards is not allowed into the sea and is sent back to the CETP for re-treatment (APPCB's report in OA 141/2023 (SZ), pdf p4).",
        "release_compliance_note": "The 358-sample count (April 2023 to March 2024) and the 305-sample count (June 2023 to May 2024) cover overlapping months and come from APPCB reports in two different NGT cases, OA 130/2024 (SZ) and OA 141/2023 (SZ). They are listed as published, not reconciled.",
        "capacity_claims": [
            {
                "value_mld": 12,
                "basis": "design capacity, operator's website (undated)",
                "source": {"url": VPCL_SITE},
            },
            {
                "value_mld": 5.0,
                "basis": "consented capacity (4.8 MLD operating, 84 units), APPCB CETP status of 13.03.2020",
                "source": {"url": CEMS_2020, "page": 1},
            },
            {
                "value_mld": sum(JNPC_CONSENT_2021) / 1000,
                "basis": "'9553 KLD (High TDS - 2500 KLD + Low TDS effluents - 7053 KLD)', CTO & HWA order of 12.08.2021 with amendments of 02.09.2021 and 13.06.2023, as stated in APPCB CTO committee agenda of 17.03.2025",
                "source": {"url": VPC_CTO_AGENDA_2025, "page": 1},
                "split_source": {
                    "url": OA141_R3,
                    "page": 12,
                    "document": "APPCB report dated 14.12.2023 (Annexure-II, OA 141/2023 (SZ)): high-TDS 2,500 KLD and low-TDS 7,053 KLD, no total printed",
                },
            },
            {
                "value_mld": 9.5,
                "basis": "'established CETP of 9.5 MLD' (high-TDS 2.5 plus low-TDS 7.0), MoEFCC inspection of 30.08.2024",
                "source": {"url": OA141_R1, "page": 33},
            },
            {
                "value_mld": JNPC_CAPACITY_MLD,
                "basis": "consent order of 07.04.2025: high-TDS 3,000 KLD plus low-TDS 7,053 KLD, 'Total 10,053 KLD'",
                "source": {"url": VPC_CTO_2025, "page": 2},
            },
            {
                "value_mld": 50,
                "basis": "'CETP - 50 MLD' in the list of the pharma city's common infrastructure, APPCB report dated 14.12.2023 (Annexure-II to its NGT report in OA 141/2023 (SZ))",
                "source": {"url": OA141_R3, "page": 11},
            },
        ],
        "capacity_note": "Six capacity figures are published for this plant. They are listed as printed, with their sources; capacity_mld uses the latest consent order.",
        "sample_dates": [],
        "parameters": [],
    }
    aetl = {
        "id": "aetl",
        "name": "Atchutapuram Effluent Treatment Ltd CETP",
        "short": "Atchutapuram",
        "operator": "Atchutapuram Effluent Treatment Ltd (AETL)",
        "estate": "APIIC Industrial Estate, Atchutapuram",
        "lat": None,
        "lng": None,
        "position_basis": "no published coordinate found",
        "capacity_mld": 1.5,
        "capacity_basis": (
            "CTO & HWA order of 03.03.2025, valid to 31.07.2025: low-TDS 1,050 KLD plus high-TDS 450 KLD, as recited "
            "in APPCB Consent Management (CTO) Committee minutes of 29.10.2025 (pdf p18) and 08.12.2025 (pdf p38). On "
            "08.12.2025 the committee recommended renewal for one year (pdf p40); the renewal order itself has not "
            "been found online. The earlier CTO & HWA of 06.09.2019, valid to 31.07.2024, set the same volumes (APPCB "
            "Directions Order No. 692 of 14.12.2023)."
        ),
        "consents": [
            {
                "order": "CTO & HWA of 06.09.2019",
                "htds_kld": 450,
                "ltds_kld": 1050,
                "valid_to": "2024-07-31",
                "source": {"url": AETL_ORDER, "page": 1},
            },
            {
                "order": "CTO & HWA of 03.03.2025",
                "htds_kld": 450,
                "ltds_kld": 1050,
                "valid_to": "2025-07-31",
                "source": {
                    "url": CTO_MINUTES["2025-10-29"],
                    "page": 18,
                    "document": "APPCB Consent Management (CTO) Committee minutes, meeting of 29.10.2025",
                },
            },
            {
                "order": "renewal for one year, recommended by the CTO committee on 08.12.2025 (order not found online)",
                "conditions_noted": "APIIC to raise the plant's high-TDS treatment capacity from 450 KLD to 1,125 KLD within one year (pdf p41)",
                "source": {
                    "url": CTO_MINUTES["2025-12-08"],
                    "page": 40,
                    "document": "APPCB Consent Management (CTO) Committee minutes, meeting of 08.12.2025",
                },
            },
        ],
        "receiving_water": "Bay of Bengal (marine discharge)",
        "marine_standard_compliance": [
            {
                "from": "2023-04",
                "to": "2023-09",
                "samples": 31,
                "not_meeting": 12,
                "pct_as_published": 38,
                "period": "April to September 2023",
                "quote": "Not meeting the Board standards for marine deposal (12 times out of 31 monitorings) in last six months (38%).",
                "source": {
                    "url": AETL_ORDER,
                    "page": 1,
                    "document": "APPCB Directions Order No. 692/APPCB/HO/ECS/VSP/2023, 14.12.2023 (Task Force meeting of 06.12.2023)",
                },
                "period_source": {
                    "url": AETL_ORDER,
                    "page": 3,
                    "quote": "Twelve samples out of thirty one samples collected from Apr to Sep'2023 are not meeting the marine discharge standards (38%).",
                },
            },
            {
                "from": "2024-01",
                "to": "2024-12",
                "samples": 60,
                "not_meeting": 9,
                "period": "January to December 2024",
                "source": {
                    "url": CTO_MINUTES["2025-02-14"],
                    "page": 48,
                    "document": "APPCB Consent Management (CTO) Committee minutes, meeting of 14.02.2025",
                },
            },
            {
                "from": "2025-03",
                "to": "2025-08",
                "samples": 32,
                "not_meeting": 10,
                "period": "March to August 2025",
                "source": {
                    "url": CTO_MINUTES["2025-10-29"],
                    "page": 20,
                    "document": "APPCB Consent Management (CTO) Committee minutes, meeting of 29.10.2025",
                },
            },
        ],
        "marine_standard_compliance_note": "Counts of samples not meeting APPCB's marine discharge standards, from three APPCB documents, listed as published, not reconciled.",
        "load_vs_capacity_kld": {
            "treatment_capacity": {"htds": 450, "ltds": 1050},
            "permitted_to_member_units_cfe": {"htds": 2721, "ltds": 1749},
            "permitted_to_member_units_cfo": {"htds": 2622, "ltds": 1648},
            "received_average_per_day": {"htds": 204, "ltds": 295},
            "source": {"url": AETL_ORDER, "page": 2},
        },
        "sample_dates": [],
        "parameters": [],
    }
    sources = [
        source(
            "ngt-andhra-filings",
            "APPCB reports of 06.07.2024 to the NGT in OA 141/2023 (SZ), with its annexed report of 14.12.2023, and in OA 130/2024 (SZ); MoEFCC reply in OA 141/2023 (SZ), with its Sub-Office Vijayawada inspection of 30.08.2024",
        ),
        source(
            "appcb-consents-directions-visakhapatnam",
            "APPCB consent order (07.04.2025) and CTO committee agenda (17.03.2025) for the Visakha Pharmacity CETP; APPCB Directions Order 692 for AETL (14.12.2023); APPCB CTO committee minutes of 14.02.2025, 29.10.2025 and 08.12.2025; APPCB CETP status (13.03.2020)",
        ),
        source(
            "industry-ec-compliance-visakhapatnam",
            "Visakha Pharmacity Ltd website, infrastructure page (undated)",
            url=VPCL_SITE,
        ),
    ]
    note = (
        "Both CETPs discharge to the sea, not to a river. We have not found a regulator's monthly per-sample record "
        "like Surat's GEMI series for either plant. For JN Pharma City, APPCB's report to the NGT in OA 141/2023 (SZ) "
        "annexes CSIR-NIO analyses of treated effluent from the CETP's MBR outlet tank, commissioned by the "
        "operator, for samples of 14.09.2023, 12.10.2023 and 21.11.2023 (DO, BOD3, pH, nutrients and suspended "
        "matter against CPCB standards, pdf pp. 228, 245, 262), plus bio-assay-only reports for January to May "
        "2024; these are not yet carried here. APPCB publishes counts of release samples that did not meet marine "
        "discharge standards, carried here as published with overlapping periods kept separate. sample_dates and "
        "parameters are empty because no regulator per-sample series has been found."
    )
    return {
        **envelope("cetp-compliance", sources, "pdf-extract", note),
        "_note": "Every norm here is APPCB's marine discharge standard for the plant's consented outfall. For the JN Pharma City CETP, APPCB states that a release which does not meet it is held back and re-treated, so those counts are of samples, not of discharges to the sea.",
        "monitoring_period": {"from": "2022-01", "to": "2025-08"},
        "cetps": [jnpc, aetl],
    }


# ── dated events ──────────────────────────────────────────────────────────────
def build_river_events() -> dict:
    ngt = ["ngt-andhra-filings"]
    hpc = "Government of Andhra Pradesh, High-Power Committee report on the styrene vapour release at LG Polymers (July 2020); the copy cited is hosted on safteng.net"
    events = [
        {
            "id": "hpc-2020-mgr-releases-stopped",
            "river_id": "meghadrigedda",
            "category": "milestone",
            "date": "2020-05-08",
            "title": "GVMC stops releases from the Meghadrigedda reservoir after the LG Polymers styrene release",
            "actors": ["GVMC", "District Collector, Visakhapatnam"],
            "summary": (
                "After the styrene vapour release at LG Polymers on 7 May 2020, GVMC stopped releases from the "
                "Meghadrigedda reservoir on 8 May on the District Collector's orders, on the suspicion that styrene "
                "might have dissolved in the reservoir, about 1.5 km north-west of the plant. Supply to Malkapuram, "
                "Scindia, Mindi and nearby areas was arranged from other sources."
            ),
            "url": HPC_2020,
            "url_label": "High-Power Committee report, pdf p. 284",
            "source": hpc,
        },
        {
            "id": "hpc-2020-styrene-samples",
            "river_id": "meghadrigedda",
            "category": "audit",
            "date": "2020-05-09",
            "title": "Two sets of reservoir samples, two results",
            "actors": ["CSIR-NEERI", "NDRF", "GVMC", "APPCB"],
            "summary": (
                "Samples taken by CSIR-NEERI and the NDRF's CBRN team on 9 and 10 May 2020 found 1.74 mg/L of "
                "styrene in the Meghadrigedda reservoir, against guideline values of 0.02 mg/L (WHO) and 0.1 mg/L "
                "(US EPA). GVMC's own samples from the reservoir found no styrene, in analysis reports of 9, 10 "
                "and 11 May 2020 from the Regional Laboratory and APPCB. The High-Power Committee report records both."
            ),
            "url": HPC_2020,
            "url_label": "High-Power Committee report, pdf pp. 151 and 284",
            "source": hpc,
        },
        {
            "id": "oa14-2021-mgr-drinking",
            "river_id": "meghadrigedda",
            "category": "audit",
            "date": "2021-07-22",
            "title": "APPCB reports the reservoir fit for drinking after disinfection",
            "actors": ["APPCB", "National Green Tribunal (Southern Zone)"],
            "summary": (
                "In its report to the NGT in the suo motu case OA 14/2021 (SZ), APPCB said samples from across the Meghadrigedda "
                "reservoir met IS 10500 drinking-water limits for physico-chemical parameters and heavy metals, with "
                "no pesticides detected, and that the water 'is fit for drinking purpose after disinfection'. Drains "
                "entering the reservoir read BOD of 4.2 to 4.8 mg/L, slightly above drinking-water standards, which the "
                "board said may be due to sewage from residential areas of Pendurthi. The report gives the city's drawal "
                "from the reservoir as 41.0 MLD, the same figure as Table 4 of GVMC's January 2019 environmental "
                "examination for the Asian Development Bank; GVMC's daily supply sheet for 11 March 2021 gives 8.44 MGD "
                "supplied from the reservoir that day, 3.04 MGD of it raw water to the Naval Dockyard (DGNP) and MES. "
                "The report states: 'There are no polluted river stretches in GVMC area.'"
            ),
            "url": OA14,
            "url_label": "APPCB report to the NGT in OA 14/2021 (SZ), 22.07.2021, pdf pp. 1, 3, 10, 19",
            "source_ids": ngt,
        },
        {
            "id": "oa14-2021-thatipudi",
            "river_id": "gosthani",
            "category": "audit",
            "date": "2021-07-22",
            "title": "APPCB describes Thatipudi reservoir to the NGT",
            "actors": ["APPCB", "National Green Tribunal (Southern Zone)"],
            "summary": (
                "APPCB described Thatipudi reservoir as built across the Gosthani near Thatipudi village, Gantyada "
                "mandal, Vizianagaram district, to stabilise an irrigated area of 13,861 acres and to supply drinking "
                "water to Visakhapatnam, with a drawal of 26.05 MLD for the city, the same figure as Table 4 of GVMC's "
                "January 2019 environmental examination for the Asian Development Bank; GVMC's daily supply sheet for "
                "11 March 2021 gives 9.87 MGD supplied from Thatipudi that day. APPCB reported no industries located "
                "near the reservoir."
            ),
            "url": OA14,
            "url_label": "APPCB report to the NGT in OA 14/2021 (SZ), 22.07.2021, pdf pp. 1-3, 10",
            "source_ids": ngt,
        },
        {
            "id": "jc-2023-surplus-course-discharges",
            "river_id": "meghadrigedda",
            "category": "audit",
            "date": "2023-12-04",
            "title": "Joint committee lists industrial discharges into the Meghadrigedda surplus course",
            "actors": ["Joint committee, AP High Court WP(PIL) 248/2020", "CPCB"],
            "summary": (
                "A joint committee report of 4 December 2023, filed by CPCB with the NGT in OA 240/2025 (SZ), records "
                "these discharges into the Meghadrigedda surplus course that joins the sea: HPCL Visakh Refinery, "
                "process and washings effluent of 11,820 KLD (kilolitres a day), treated in its effluent plants, and "
                "cooling blowdown of 3,59,400 KLD; Coromandel International, cooling-tower blowdown of 91,600 KLD, "
                "with its 1,800 KLD of process "
                "effluent recycled inside the factory except in the rainy season; The Andhra Petrochemicals, 3,434 KLD "
                "treated in its effluent plant and discharged into the Meghadrigedda channel, of which 3,119 KLD is "
                "seawater used for cooling and 45 KLD is process effluent; ArcelorMittal Nippon Steel India: the "
                "per-plant table says any surplus left after recycling blowdown and slurry-pipeline water goes to the "
                "surplus course, but the committee's conclusions count only the first three as discharging into the "
                "channel and say ArcelorMittal discharges once-through cooling sea water to the sea. HPCL's own "
                "Environmental Statement (Form V) for 2023-24 (pdf pp. 2 and 6) gives 1,26,081 KLD of sea water "
                "consumed for cooling and an average of 174 cubic metres an hour of process effluent generated, which "
                "is 4,176 KLD (a cubic metre is a kilolitre). Form V labels these as water consumed and effluent "
                "generated, where the committee lists discharges, so the two sets of figures are carried as "
                "published, not compared."
            ),
            "url": OA240_CPCB,
            "url_label": "CPCB reply in NGT OA 240/2025 (SZ), annexed report, pdf pp. 24-27",
            "source_ids": [*ngt, "industry-ec-compliance-visakhapatnam"],
            "documents": [
                {
                    "url": HPCL_FORM_V_2024,
                    "page": 2,
                    "title": "HPCL Visakh Refinery Environmental Statement (Form V) 2023-24, Part B: water consumption in m3 per calendar day (sea water for cooling, 126081)",
                },
                {
                    "url": HPCL_FORM_V_2024,
                    "page": 6,
                    "title": "same statement, Part G: average process effluent generated in 2023-24, 174 m3/hr",
                },
            ],
        },
        {
            "id": "oa141-2023-pharma-city-water",
            "river_id": "yeleru-canal",
            "category": "audit",
            "date": "2023-12-14",
            "title": "APPCB records the Yeleru canal as the pharma city's water source",
            "actors": ["APPCB", "APIIC", "National Green Tribunal (Southern Zone)"],
            "summary": (
                "APPCB's report of 14.12.2023 to the NGT in OA 141/2023 (SZ) states that the source of water for Jawaharlal Nehru "
                "Pharma City is the Yeleru canal, supplied by APIIC, and that 94 of the 104 established bulk-drug, "
                "pharmaceutical and chemical units are in operation. The pharma city's treated effluent goes to the "
                "sea through a marine outfall."
            ),
            "url": OA141_R3,
            "url_label": "APPCB report of 14.12.2023, annexed to its 06.07.2024 report to the NGT in OA 141/2023 (SZ), pdf pp. 11-12",
            "source_ids": ngt,
        },
    ]
    sources = [
        source(
            "ngt-andhra-filings",
            "APPCB report of 22.07.2021 in NGT OA 14/2021 (SZ); GVMC's daily water supply statement of 11.03.2021 in "
            "the same case (1421_0.pdf p20); APPCB report of 14.12.2023, annexed to its 06.07.2024 report in OA 141/2023 "
            "(SZ); CPCB reply in OA 240/2025 (SZ) with the joint committee report of 04.12.2023",
        ),
        # One-time 2019 GVMC document, registered as its own closed source.
        {
            "id": "gvmc-adb-iee-24x7-nw-2019",
            "as_of": "2019-01",
            "title": (
                "GVMC's IEE for the Asian Development Bank, 24x7 Water Supply in North-West sector (GVMC/02), "
                "Jan 2019: Table 4, Water Source and Availability in GVMC Area, 'Drawl' column (pdf p20)"
            ),
            "publisher": "Greater Visakhapatnam Municipal Corporation (ADB project)",
            "url": ADB_IEE_NW,
            "license": registry_license("gvmc-adb-iee-24x7-nw-2019"),
        },
        source(
            "industry-ec-compliance-visakhapatnam",
            "HPCL Visakh Refinery Environmental Statement (Form V) 2023-24 (pdf pp. 2, 6)",
            url=HPCL_FORM_V_2024,
        ),
    ]
    note = (
        "Curated dated events on the three channels, facts and dates only. Records with source_ids cite NGT filings "
        "(the joint committee record also cites HPCL's Environmental Statement); the two NGT OA 14/2021 (SZ) records also "
        "compare APPCB's drawal figures with Table 4 of GVMC's January 2019 IEE for the Asian Development Bank, which "
        "holds the same figures, and with GVMC's daily supply statement of 11.03.2021; "
        "the two May 2020 records cite the Government of Andhra Pradesh High-Power Committee report by URL, whose only "
        "copy found online is on a third-party host (safteng.net). The joint committee's discharge volumes were read "
        "from the text layer of a scanned copy (OCR)."
    )
    return {**envelope("river-events", sources, "manual", note), "events": events}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--rivers-geojson", type=Path, default=RIVERS_GEOJSON)
    args = ap.parse_args()
    geo = load_rivers(args.rivers_geojson)
    outputs = {
        "river-quality-visakhapatnam.json": build_river_quality(geo),
        "industrial-sources-visakhapatnam.json": build_industrial_sources(),
        "cetp-compliance-visakhapatnam.json": build_cetp_compliance(),
        "river-events-visakhapatnam.json": build_river_events(),
    }
    for name, payload in outputs.items():
        write_artifact(DATA / name, payload)
    rq = outputs["river-quality-visakhapatnam.json"]
    for r in rq["rivers"]:
        offs = ", ".join(
            f"{s['nwmp_code']} {s['osm_river_offset_m_before']} m"
            for s in r["stations"]
        )
        print(f"{r['id']}: {r['length_km']} km, {r['overall_status']}, stations {offs}")
    print(f"wrote {len(outputs)} artifacts to {DATA.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
