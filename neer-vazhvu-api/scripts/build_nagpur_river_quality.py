#!/usr/bin/env python3
"""
Nagpur's rivers for /nagpur/rivers, and NMC's sewage treatment plants.

Writes public/data/river-quality-nagpur.json and public/geojson/nagpur-stps.geojson
from the reviewed transcriptions in pipeline-inputs/nagpur/river-*.csv (see the
INVENTORY entry for each file's PDF, page and checksum).

TWO KINDS OF READING, NEVER MIXED IN ONE STATION:
  * Kanhan, Kolar, Wainganga: MPCB's monthly readings at the five NWMP stations
    in Nagpur district (2170, 2171, 1909, 1908, 1910), January 2017 to December
    2024, from the per-river PDFs on MPCB's polluted-stretch page (May 2025).
    A month MPCB records as "Dry" or "Stagnant water" is kept as a reading with
    no values and that condition, never as zero.
  * Nag, Pili, Pora: NMC's Environment Status Report 2023-24 (CSIR-NEERI),
    Tables 6.13-6.16: one monsoon-2023 round at 23 sites, with coordinates. No
    BOD column exists; coliforms are CFU/100 ml.

THE BUILD FAILS when a transcription stops agreeing with a published figure:
  * for 2021-2024, the yearly minimum and maximum of MPCB's monthly DO and BOD
    must equal CPCB's NWMP yearly table exactly, and faecal coliform must equal
    it after CPCB's rounding to whole numbers (2018-2019 do not agree, and are
    recorded, not asserted);
  * the 12 operating STPs must sum to the ESR's 403.5 MLD, and MPCB's January
    2026 rows for the same 12 plants must sum to the same figure.

The Nag, Pili and Pora have no CPCB station. MPCB's own index (WQI) for its
state stations 185-189 is carried in the river notes, not as readings.

Run:  python3 neer-vazhvu-api/scripts/build_nagpur_river_quality.py
      (--allow-missing-geometry writes before public/geojson/nagpur-rivers.geojson
      exists; length_km is then null and the run says so)
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

INPUTS = REPO_ROOT / "pipeline-inputs" / "nagpur"
RIVERS_GEOJSON = REPO_ROOT / "public" / "geojson" / "nagpur-rivers.geojson"
OUT_QUALITY = REPO_ROOT / "public" / "data" / "river-quality-nagpur.json"
OUT_STPS = REPO_ROOT / "public" / "geojson" / "nagpur-stps.geojson"

MPCB_MONTHLY_ID = "mpcb-prs-monthly-nagpur-rivers"
NMC_ESR_ID = "nmc-esr-river-stp-tables"
MPCB_WQR_ID = "mpcb-water-quality-reports"
MPCB_NWMP_LIST_ID = "mpcb-nwmp-station-list"
MPCB_MPR_ID = "mpcb-ngt-monthly-progress-reports"
CPCB_PRS_ID = "cpcb-prs-report"
CPCB_NWMP_ID = "cpcb-nwmp"
JICA_ID = "jica-nag-river-loan"

# Evidence dates, pinned: only produced_at moves on a rerun.
MPCB_MONTHLY_AS_OF = (
    "2025-05-05"  # PDFs created 2-5 May 2025; re-fetched 15 Oct 2026, same bytes
)
ESR_AS_OF = "2024-03-31"  # FY 2023-24; river round "during the monsoon" of 2023
WQR_AS_OF = "2024-03-31"
NWMP_LIST_AS_OF = "2025-05-06"
MPR_AS_OF = "2026-01-31"
PRS_AS_OF = "2025-10-28"
NWMP_AS_OF = "2024-12-31"
JICA_AS_OF = "2020-05-08"

MPCB_PAGE = "https://mpcb.gov.in/en/river-polluted-streches/water_quality_of_polluted_river_stretches"
ESR_URL = "https://nmcnagpur.gov.in/assets/300/2025/08/Public-Notices/ESR_Final_Report_2023-2024.pdf"
MPR_URL = "https://www.mpcb.gov.in/sites/default/files/MPR_Merged_Jan_2026.pdf"

ESR_STP_TOTAL_MLD = (
    403.5  # ESR 2023-24 printed p.136: "403.5 MLD sewage) is treated at 12 STP's"
)
ESR_SEWAGE_GENERATED_MLD = (
    520  # same sentence: "about 73% (520 MLD) is converted to sewage"
)

# river_id order is the page's order; nagpur-rivers.geojson must list nag first
# (rivers-client pre-selects the first feature when no mainstem id matches).
RIVERS = ["nag", "pili", "pora", "kanhan", "kolar", "wainganga"]
NAMES = {
    "nag": "Nag",
    "pili": "Pili",
    "pora": "Pora",
    "kanhan": "Kanhan",
    "kolar": "Kolar",
    "wainganga": "Wainganga",
}

# Upstream to downstream within each river: (code, display name, chip label).
NWMP_STATIONS = {
    "kanhan": [
        (
            "2170",
            "Sinora, upstream of Vidarbha Paper Mills (2170)",
            "Sinora U/S (2170)",
        ),
        (
            "2171",
            "Sinora, downstream of Vidarbha Paper Mills (2171)",
            "Sinora D/S (2171)",
        ),
        ("1909", "Agargaon, downstream of Nagpur (1909)", "Agargaon (1909)"),
    ],
    "kolar": [
        (
            "1908",
            "Waregaon bridge, before the Kanhan confluence (1908)",
            "Waregaon (1908)",
        )
    ],
    "wainganga": [
        ("1910", "Ambhora, after the Kanhan confluence (1910)", "Ambhora (1910)")
    ],
}

# NMC's site descriptions shortened for a chart title; place_as_printed keeps the original.
ESR_PLACES = {
    "Nag-1": "Ambazari lake, start of the river",
    "Nag-2": "NIT swimming pool",
    "Nag-3": "VNIT campus",
    "Nag-4": "NIT cover point",
    "Nag-5": "Drain mix behind Yashwant stadium, Sitabuldi bridge",
    "Nag-6": "Drain mix at Mokshdham, near the NMC STP",
    "Nag-7": "Ashirwad talkies, Great Nag Road",
    "Nag-8": "Jagnade chowk, Ganeshnagar",
    "Nag-9": "Wardhmannagar",
    "Nag-10": "End point in the city",
    "Pilli-1": "Gorewada, start of the river",
    "Pilli-2": "Drain mix, Jafarnagar",
    "Pilli-3": "Suflam seed company, Koradi",
    "Pilli-4": "Nara Road bridge",
    "Pilli-5": "Nari bridge 2",
    "Pilli-6": "Bhilgaon road",
    "Pilli-7": "Kalamnagao police chowki",
    "Pilli-8": "Pawangaon, where the Pili meets the Nag",
    "Pora-1": "place not named in the report",
    "Pora-2": "place not named in the report",
    "Pora-3": "place not named in the report",
    "Pora-4": "place not named in the report",
    "Pora-5": "End point in the city",
}

NULL_READING = {
    "conductivity_us": None,
    "cod_mgl": None,
    "tds_mgl": None,
    "nitrate_mgl": None,
    "chromium_mgl": None,
    "lead_mgl": None,
    "cadmium_mgl": None,
}

CONDITION_NOTES = {
    "Dry": "MPCB records the river as dry this month; no sample.",
    "Stagnant water": "MPCB records stagnant water this month; no sample.",
}


def rows(name: str) -> list[dict]:
    with open(INPUTS / name, encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def num(v: str | None) -> float | None:
    try:
        return float(v)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def clean(x: float | None) -> float | int | None:
    """7.0 -> 7, 7.25 -> 7.25: the value as printed, without a float tail."""
    if x is None:
        return None
    return int(x) if float(x).is_integer() else round(x, 4)


def half_up(x: float) -> int:
    """CPCB's yearly table rounds coliform counts half up (4.5 -> 5)."""
    return math.floor(x + 0.5)


def dms(deg: str, minutes: str, sec: str) -> float:
    return round(int(deg) + int(minutes) / 60 + float(sec) / 3600, 6)


# ── MPCB monthly ──────────────────────────────────────────────────────────


def mpcb_reading(r: dict) -> dict:
    cond = r["bathing_criteria_as_printed"]
    rd: dict = {"year": int(r["year"]), "month": r["month"]}
    fc_raw = r["fc_mpn100ml"].strip()
    below = fc_raw.startswith("<")
    rd.update(
        {
            "do_mgl": clean(num(r["do_mgl"])),
            "bod_mgl": clean(num(r["bod_mgl"])),
            "ph": clean(num(r["ph"])),
            "fecal_coliform_mpn": None if below else clean(num(fc_raw)),
            **NULL_READING,
            "total_coliform_mpn": clean(num(r["tc_mpn100ml"])),
        }
    )
    if below:
        rd["fecal_coliform_note"] = (
            f"MPCB prints {fc_raw} MPN/100 ml, below the lowest count the test reports."
        )
        rd["below_detection"] = ["fecal_coliform_mpn"]
    if cond in CONDITION_NOTES:
        rd["condition"] = cond
        rd["note"] = CONDITION_NOTES[cond]
    elif cond:
        rd["bathing_criteria"] = cond
    return rd


def cross_check(monthly: list[dict], annual: list[dict]) -> tuple[list[str], list[str]]:
    """(failures, recorded disagreements). 2021-2024 must agree; earlier years are recorded."""
    fails, recorded = [], []
    for a in annual:
        code, year = a["station_code"], a["year"]
        mine = [r for r in monthly if r["station_code"] == code and r["year"] == year]
        for key, mk in (("do", "do_mgl"), ("bod", "bod_mgl"), ("fc", "fc_mpn100ml")):
            vals = [num(r[mk].lstrip("<")) for r in mine]
            vals = [v for v in vals if v is not None]
            unit = "mpn100ml" if key == "fc" else "mgl"
            lo, hi = num(a[f"{key}_min_{unit}"]), num(a[f"{key}_max_{unit}"])
            got = (min(vals), max(vals)) if vals else (None, None)
            if key == "fc":
                ok = got[0] is not None and (half_up(got[0]), half_up(got[1])) == (
                    lo,
                    hi,
                )
            else:
                ok = got == (lo, hi)
            if not ok:
                msg = (
                    f"{code} {year} {key}: MPCB months {got[0]:g}-{got[1]:g}, "
                    f"CPCB year {a[f'{key}_min_{unit}']}-{a[f'{key}_max_{unit}']}"
                )
                (fails if int(year) >= 2021 else recorded).append(msg)
    return fails, recorded


def nwmp_stations(monthly: list[dict], coords: dict) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    for river, spec in NWMP_STATIONS.items():
        for code, name, chip in spec:
            mine = sorted(
                (r for r in monthly if r["station_code"] == code),
                key=lambda r: r["month"],
            )
            if len(mine) != 96:
                raise SystemExit(
                    f"{code}: {len(mine)} monthly rows, expected 96 (2017-2024)"
                )
            c = coords[code]
            lat, lng = num(c["lat"]), num(c["lon"])
            out.setdefault(river, []).append(
                {
                    "id": f"nwmp-{code}",
                    "nwmp_code": code,
                    "name": name,
                    "name_ta": "",
                    "lat": lat,
                    "lng": lng,
                    "stretch": chip,
                    "coord_source": (
                        f"CPCB WQMN_list.pdf (file dated October 2020), PDF p.{c['wqmn_pdf_page']}"
                        if lat is not None
                        else None
                    ),
                    "coord_note": None
                    if lat is not None
                    else c["coord_source_and_notes"],
                    "sampling": "monthly (MPCB)",
                    "pdf_pages": sorted(
                        {f"{r['pdf_file']} p.{r['pdf_page']}" for r in mine}
                    ),
                    "readings": [mpcb_reading(r) for r in mine],
                }
            )
    return out


# ── NMC ESR 2023-24 ────────────────────────────────────────────────────────


def esr_reading(r: dict) -> dict:
    fc, tc = num(r["fc_cfu100ml"]), num(r["tc_cfu100ml"])
    note = (
        "NMC reports this count in CFU per 100 ml, not MPN; one sample, monsoon 2023."
    )
    if fc is not None and tc is not None and fc > tc:
        note += (
            f" NMC's table prints more faecal coliforms than total coliforms"
            f" ({int(tc):,}) here; the two cannot both be right."
        )
    rd = {
        "year": 2023,
        "do_mgl": clean(num(r["do_mgl"])),
        "bod_mgl": None,
        "ph": clean(num(r["ph"])),
        "fecal_coliform_mpn": clean(fc),
        "fecal_coliform_note": note,
        "fecal_coliform_unit": "CFU",
        **NULL_READING,
        "tds_mgl": clean(num(r["tds_mgl"])),
        "cod_mgl": clean(num(r["cod_mgl"])),
        "total_coliform_cfu": clean(tc),
        "sample_round": "monsoon 2023, before the festive season",
    }
    if r["cod_mgl"].strip().upper() == "ND":
        rd["below_detection"] = ["cod_mgl"]
    return rd


def esr_stations(esr: list[dict]) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    for r in esr:
        code = r["site_code"]
        out.setdefault(r["river_id"], []).append(
            {
                "id": f"esr-{code.lower()}",
                "site_code": code,
                "name": f"{code}, {ESR_PLACES[code]}",
                "name_ta": "",
                "lat": dms(r["lat_deg"], r["lat_min"], r["lat_sec"]),
                "lng": dms(r["lng_deg"], r["lng_min"], r["lng_sec"]),
                "stretch": code,
                "place_as_printed": r["place_as_printed"],
                "coord_source": (
                    f"NMC ESR 2023-24 Table 6.13 (printed p.{r['coord_printed_page']}), "
                    "degrees-minutes-seconds converted"
                ),
                "sampling": "one round, monsoon 2023 (NMC)",
                "pdf_pages": [
                    f"ESR 2023-24 printed pp.{r['physchem_printed_page']}, "
                    f"{r['bact_printed_page']}, {r['organic_printed_page']}"
                ],
                "readings": [esr_reading(r)],
            }
        )
    return out


# ── status (fallback only; the panel recomputes it from the readings) ───────


def classify(rd: dict) -> str | None:
    do, bod = rd.get("do_mgl"), rd.get("bod_mgl")
    if do is None and bod is None:
        return None
    if (do is not None and do < 1) or (bod is not None and bod > 30):
        return "dead"
    if (do is not None and do < 4) or (bod is not None and bod > 6):
        return "severely_degraded"
    if (do is not None and do < 5) or (bod is not None and bod > 3):
        return "degraded"
    if (do is not None and do < 6) or (bod is not None and bod > 2):
        return "stressed"
    return "healthy"


SEVERITY = ["healthy", "stressed", "degraded", "severely_degraded", "dead"]


def river_status(stations: list[dict]) -> str:
    worst = 0
    for s in stations:
        latest = sorted(s["readings"], key=lambda r: -r["year"])[0]
        c = classify(latest)
        if c:
            worst = max(worst, SEVERITY.index(c))
    return SEVERITY[worst]


# ── narrative helpers (every number read from the inputs) ───────────────────


def year_max(st: dict, key: str, year: int) -> float:
    vals = [r[key] for r in st["readings"] if r["year"] == year and r[key] is not None]
    return max(vals)


def dry_months(st: dict) -> list[str]:
    return [r["month"] for r in st["readings"] if r.get("condition") == "Dry"]


def fmt(x: float) -> str:
    return f"{x:g}"


def prs_class(prs: list[dict], river: str) -> str:
    by = {r["edition"]: r["priority"] for r in prs if r["river_id"] == river}
    return f"Priority {by['2025']} in 2025 ({by['2022']} in 2022, {by['2018']} in 2018)"


def wqi(wq: list[dict], edition: str, code: str) -> str:
    return next(
        r["wqi_avg"]
        for r in wq
        if r["edition"] == edition and r["station_code"] == code
    )


def build(lengths: dict[str, float | None]) -> tuple[dict, dict, list[str]]:
    monthly = rows("river-mpcb-monthly-2017-2024.csv")
    annual = rows("river-cpcb-nwmp-annual-2018-2024.csv")
    coords = {r["station_code"]: r for r in rows("river-wq-stations.csv")}
    esr = rows("river-nmc-esr-2023-24-sites.csv")
    prs = rows("river-cpcb-prs-classes.csv")
    wq = rows("river-mpcb-wqi-2022-2024.csv")

    fails, recorded = cross_check(monthly, annual)
    if fails:
        raise SystemExit(
            "MPCB monthly no longer reproduces CPCB's yearly table:\n  "
            + "\n  ".join(fails)
        )
    if len(esr) != 23:
        raise SystemExit(f"ESR Table 6.13-6.16 should have 23 sites, got {len(esr)}")

    stations = {**nwmp_stations(monthly, coords), **esr_stations(esr)}
    by_code = {
        s.get("nwmp_code") or s["site_code"]: s for v in stations.values() for s in v
    }

    nag_do = [s["readings"][0]["do_mgl"] for s in stations["nag"]]
    fc_all = [s["readings"][0]["fecal_coliform_mpn"] for s in stations["nag"]]
    pili_fc = [s["readings"][0]["fecal_coliform_mpn"] for s in stations["pili"]]
    pili_do = [s["readings"][0]["do_mgl"] for s in stations["pili"]]
    pora_do = [s["readings"][0]["do_mgl"] for s in stations["pora"]]
    pora_cod = [
        s["readings"][0]["cod_mgl"]
        for s in stations["pora"]
        if s["readings"][0]["cod_mgl"]
    ]
    swapped = [
        s["site_code"]
        for s in stations["pili"]
        if s["readings"][0]["fecal_coliform_mpn"]
        > s["readings"][0]["total_coliform_cfu"]
    ]
    ag, up = by_code["1909"], by_code["2170"]
    waregaon, ambhora = by_code["1908"], by_code["1910"]
    ag_dry_june = sorted(m[:4] for m in dry_months(ag) if m.endswith("-06"))
    if ag_dry_june != [str(y) for y in range(2019, 2025)]:
        raise SystemExit(f"1909 June dry years changed: {ag_dry_june}")
    kolar_dry = dry_months(waregaon)
    if kolar_dry != ["2019-05", "2019-06", "2019-07", "2019-08"]:
        raise SystemExit(f"1908 dry months changed: {kolar_dry}")

    up23, up24 = fmt(year_max(up, "bod_mgl", 2023)), fmt(year_max(up, "bod_mgl", 2024))
    sinora = f"{up23} in both years" if up23 == up24 else f"{up23} and {up24}"

    headline = (
        f"Inside the city, NMC's monsoon-2023 readings show dissolved oxygen on the Nag falling "
        f"from {fmt(nag_do[0])} mg/L at Ambazari to {fmt(nag_do[-1])} mg/L at its end point. "
        f"MPCB's 2023-24 index puts the Nag at {wqi(wq, '2023-24', '185')} near Ambazari lake and "
        f"{wqi(wq, '2023-24', '186')} at Bhandewadi bridge. Below the city, the highest BOD at "
        f"Agargaon on the Kanhan was {fmt(year_max(ag, 'bod_mgl', 2023))} mg/L in 2023 and "
        f"{fmt(year_max(ag, 'bod_mgl', 2024))} in 2024."
    )

    river_text = {
        "nag": dict(
            cpcb_class="Not assessed: no CPCB readings for the Nag's national-programme stations",
            description=(
                "The river the city is named after. It flows out of Ambazari lake in the west of "
                "the city; 17 km of its course to the Kanhan lie within the city (NMC Environment "
                "Status Report 2023-24). The length shown is the stretch drawn on this map. The "
                "readings here are NMC's own: one round at ten points during the 2023 monsoon."
            ),
            notes=(
                f"NMC measured dissolved oxygen of {fmt(nag_do[0])} mg/L at the Ambazari start and "
                f"{fmt(nag_do[-1])} mg/L at the end point, and faecal coliforms of "
                f"{int(min(fc_all)):,} to {int(max(fc_all)):,} per 100 ml at every site. The report "
                "has no BOD column. MPCB's water quality index for its own Nag stations in 2023-24: "
                f"{wqi(wq, '2023-24', '185')} near Ambazari lake (its Good to Excellent band; MPCB's "
                "2025 national list types this station, 5979, as a lake station), "
                f"{wqi(wq, '2023-24', '186')} at Bhandewadi bridge and {wqi(wq, '2023-24', '187')} "
                "at Asoli bridge (its Heavily Polluted band, 38 and below). MPCB has listed these "
                "stations for the national programme as 5979 to 5981; CPCB's river tables up to "
                "2024 carry no readings for them. JICA's appraisal of the Nag project gives a 2019 "
                "baseline BOD of 30 to 70 mg/L for river water in the north and central zones. "
                "NMC's previous round (ESR 2022-23, Table 6.15, printed p.188) measured BOD of 6 to "
                "49 mg/L at nine points along the Nag."
            ),
        ),
        "pili": dict(
            cpcb_class="Not assessed: no CPCB readings for the Pili's national-programme stations",
            description=(
                "Flows east from Gorewada in the city's north-west and meets the Nag near "
                "Pawangaon; 18 km of it lie within city limits (NMC Environment Status Report "
                "2023-24, which spells it Pilli). The length shown is the stretch drawn on this "
                "map. NMC sampled it at eight points during the 2023 monsoon."
            ),
            notes=(
                f"Dissolved oxygen {fmt(pili_do[0])} mg/L at Gorewada and between "
                f"{fmt(min(pili_do[1:]))} and {fmt(max(pili_do[1:]))} mg/L at the seven points below "
                f"it; faecal coliforms {int(min(pili_fc)):,} to {int(max(pili_fc)):,} per 100 ml. "
                f"At {' and '.join(swapped)} NMC's table prints more faecal coliforms than total "
                "coliforms, which cannot both be right; both are shown as printed. MPCB's index "
                f"for 2023-24: {wqi(wq, '2023-24', '188')} at Wanjra layout (its Polluted band, 38 "
                "to 50); its table shows NA for Mankapur that year "
                f"({wqi(wq, '2022-23', '189')} in 2022-23). MPCB lists the two stations for the "
                "national programme as 5982 and 5983."
            ),
        ),
        "pora": dict(
            cpcb_class="Not assessed: no CPCB station on the Pora",
            description=(
                "The city's third river. It rises near Hingna in the south-west of the city and "
                "flows to the south-east (NMC Environment Status Report 2023-24). The length shown "
                "is the stretch drawn on this map. NMC sampled it at five points during the 2023 "
                "monsoon; the report names only the last."
            ),
            notes=(
                f"Dissolved oxygen fell from {fmt(pora_do[0])} mg/L at the first point to "
                f"{fmt(pora_do[-1])} mg/L at the end point; COD reached {fmt(max(pora_cod))} mg/L "
                "there. Neither CPCB's station list (file dated 2020) nor MPCB's national-programme "
                "list (file dated May 2025) has a station on the Pora."
            ),
        ),
        "kanhan": dict(
            cpcb_class=prs_class(prs, "kanhan"),
            description=(
                "The river the Nag and the Pili drain into. The length shown is the stretch drawn "
                "on this map. MPCB samples it every month at three "
                "national-programme stations: two at Sinora in Parseoni taluka, either side of the "
                "Vidarbha Paper Mills, and one at Agargaon, which CPCB names 'Kanhan D/S of "
                "Nagpur'."
            ),
            notes=(
                f"Highest BOD at Agargaon: {fmt(year_max(ag, 'bod_mgl', 2023))} mg/L in 2023 and "
                f"{fmt(year_max(ag, 'bod_mgl', 2024))} in 2024, against {sinora} upstream at "
                "Sinora. MPCB recorded the river at Agargaon as dry in June of every "
                "year from 2019 to 2024. CPCB's 2025 report places the stretch from below the "
                "Vidarbha Paper Mills to below Nagpur in Priority IV and counts it improved from "
                "Priority III in 2018. For 2021 to 2024, MPCB's monthly figures reproduce CPCB's "
                "yearly minimum and maximum; for 2018 and 2019 they do not, and CPCB's yearly "
                "figures for those years are not shown."
            ),
        ),
        "kolar": dict(
            cpcb_class=prs_class(prs, "kolar"),
            description=(
                "A tributary that joins the Kanhan at Waregaon in Kamptee taluka, north of the "
                "city. The length shown is the stretch drawn on this map. MPCB samples it every "
                "month at Waregaon bridge."
            ),
            notes=(
                f"Highest BOD: {fmt(year_max(waregaon, 'bod_mgl', 2024))} mg/L in 2024. MPCB "
                "recorded the river as dry from May to August 2019. CPCB's 2025 report lists one polluted "
                "location here, at Waregaon bridge, in Priority IV (V in 2022) and counts it "
                "improved from Priority III in 2018. CPCB's 2018 yearly table prints a BOD maximum "
                "of 60 mg/L for this station; MPCB's twelve monthly readings for 2018 peak at "
                f"{fmt(year_max(waregaon, 'bod_mgl', 2018))} mg/L, so the 2018 yearly figure is not "
                "used."
            ),
        ),
        "wainganga": dict(
            cpcb_class=prs_class(prs, "wainganga"),
            description=(
                "The larger river the Kanhan joins east of the city. The length shown is the "
                "stretch drawn on this map. MPCB samples it every month at Ambhora, after the "
                "confluence."
            ),
            notes=(
                "No map marker: the official coordinates for station 1910 do not match Ambhora "
                "(CPCB's list places it about 145 km to the south, MPCB's about 53 km to the "
                "north-west). Highest BOD there: "
                f"{fmt(year_max(ambhora, 'bod_mgl', 2024))} mg/L in 2024. CPCB's 2025 report "
                "places the Wainganga from below the Ellora Paper Mills in Bhandara to Ashti in "
                "Chandrapur in Priority IV."
            ),
        ),
    }
    if fmt(year_max(waregaon, "bod_mgl", 2018)) != "18.1":
        raise SystemExit("Kolar 2018 MPCB maximum changed; revisit the 60 mg/L note")

    rivers = []
    for rid in RIVERS:
        st = stations[rid]
        rivers.append(
            {
                "id": rid,
                "name": NAMES[rid],
                "name_ta": "",
                "length_km": lengths.get(rid),
                "overall_status": river_status(st),
                **river_text[rid],
                "stations": st,
            }
        )

    quality = {
        "nvdm": "1.0",
        "dataset": "data-root/river-quality",
        "scope": {"kind": "city", "id": "nagpur"},
        "provenance": {
            "sources": [
                {
                    "id": MPCB_MONTHLY_ID,
                    "title": "MPCB, 'Latest Water Quality As per Assessment Targeted': Kanhan river, Kolar river and Wainganga River PDFs, monthly pH, DO, BOD, faecal and total coliform, 2017-2024",
                    "publisher": "Maharashtra Pollution Control Board",
                    "url": MPCB_PAGE,
                    "license": registry_license(MPCB_MONTHLY_ID),
                    "as_of": MPCB_MONTHLY_AS_OF,
                },
                {
                    "id": NMC_ESR_ID,
                    "title": "NMC Environment Status Report 2023-24 (CSIR-NEERI), Tables 6.13-6.16: river sampling sites and water quality, Nag, Pilli and Pora",
                    "publisher": "Nagpur Municipal Corporation",
                    "url": ESR_URL,
                    "license": registry_license(NMC_ESR_ID),
                    "as_of": ESR_AS_OF,
                },
                {
                    "id": MPCB_WQR_ID,
                    "title": "MPCB, Water Quality Status of Maharashtra 2022-23 (Table No. 39) and 2023-24 (Table No. 38): water quality index at Nagpur-RO stations",
                    "publisher": "Maharashtra Pollution Control Board",
                    "license": registry_license(MPCB_WQR_ID),
                    "as_of": WQR_AS_OF,
                },
                {
                    "id": MPCB_NWMP_LIST_ID,
                    "title": "MPCB, NWMP Locations in Maharashtra (New NWMP Stations), codes 5979-5983 on the Nag and Pili",
                    "publisher": "Maharashtra Pollution Control Board",
                    "license": registry_license(MPCB_NWMP_LIST_ID),
                    "as_of": NWMP_LIST_AS_OF,
                },
                {
                    "id": CPCB_PRS_ID,
                    "title": "CPCB Polluted River Stretches, 2018, 2022 and October 2025 editions (Kanhan, Kolar and Wainganga priority classes)",
                    "publisher": "Central Pollution Control Board",
                    "license": registry_license(CPCB_PRS_ID),
                    "as_of": PRS_AS_OF,
                },
                {
                    "id": CPCB_NWMP_ID,
                    "title": "CPCB NWMP yearly river tables 2018-2024 (cross-check of the MPCB months) and the NWMP station list WQMN_list.pdf (coordinates)",
                    "publisher": "Central Pollution Control Board",
                    "license": registry_license(CPCB_NWMP_ID),
                    "role": "input",
                    "as_of": NWMP_AS_OF,
                },
                {
                    "id": JICA_ID,
                    "title": "JICA ex-ante evaluation, Project for Pollution Abatement of Nag River in Nagpur (ID-P285), outcome indicators: river BOD 30-70 mg/L (2019)",
                    "publisher": "Japan International Cooperation Agency",
                    "license": registry_license(JICA_ID),
                    "as_of": JICA_AS_OF,
                },
            ],
            "method": "pdf-extract",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/build_nagpur_river_quality.py",
            "note": [
                "Kanhan, Kolar and Wainganga: MPCB's monthly values as printed, one reading per month; months MPCB records as Dry or Stagnant water carry that condition and no values. For 2021-2024 the yearly minimum and maximum of these months equal CPCB's NWMP yearly table (the build fails otherwise).",
                "CPCB yearly figures that MPCB's months do not reproduce (2018-2019): "
                + "; ".join(recorded)
                + ".",
                "Nag, Pili and Pora: NMC's single monsoon-2023 round at 23 sites, coordinates converted from Table 6.13. No BOD column exists; coliforms are CFU/100 ml; EC (unit printed as uS/cm, values in the mS/cm range) and nitrate as N are not carried.",
                "Pages: ESR printed pages (PDF page = printed + 1). Reading lengths come from nagpur-rivers.geojson so the panel and the map agree.",
            ],
            **(
                {"internal_inputs": ["public/geojson/nagpur-rivers.geojson"]}
                if lengths
                else {}
            ),
        },
        "place_id": "nagpur",
        "last_updated": max(r["month"] for r in monthly),
        "data_year_range": [
            min(int(r["year"]) for r in monthly),
            max(int(r["year"]) for r in monthly),
        ],
        "source": "MPCB monthly readings 2017-2024 (Kanhan, Kolar, Wainganga); NMC Environment Status Report 2023-24 (Nag, Pili, Pora)",
        "source_label": "MPCB polluted river stretches, monthly 2017-2024; NMC Environment Status Report 2023-24",
        "source_url": MPCB_PAGE,
        "_headline": headline,
        "_excluded": [
            "Wainganga stations outside Nagpur district in the same MPCB file (11, 2172, 2173, 2175, 2176).",
            "MPCB state stations 185-189 (national codes 5979-5983): MPCB publishes an index, not readings, and no coordinates; carried in the river notes.",
            "Station 1910 Ambhora: readings kept, coordinate withheld (both official positions are far from the village).",
        ],
        "rivers": rivers,
    }
    return quality, stps(), recorded


# ── STPs ───────────────────────────────────────────────────────────────────


def stps() -> dict:
    reg = rows("river-stps-esr-2023-24.csv")
    if len(reg) != 13:
        raise SystemExit(f"ESR Table 6.3 has 13 rows, got {len(reg)}")
    operating = [r for r in reg if r["status_as_printed"] == "Operational"]
    esr_sum = round(sum(float(r["installed_capacity_mld"]) for r in operating), 2)
    mpr_sum = round(sum(float(r["mpr_capacity_mld"]) for r in operating), 2)
    if (
        len(operating) != 12
        or esr_sum != ESR_STP_TOTAL_MLD
        or mpr_sum != ESR_STP_TOTAL_MLD
    ):
        raise SystemExit(
            f"STPs: {len(operating)} operating, ESR {esr_sum} / MPR {mpr_sum} MLD, "
            f"expected 12 and {ESR_STP_TOTAL_MLD}"
        )
    features = []
    for r in reg:
        on = r["status_as_printed"] == "Operational"
        comply = r["mpr_compliance_as_printed"]
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "stp_id": r["stp_id"],
                    "name": r["name_as_printed"].replace(", Nagpur", "")
                    + (
                        f" ({clean(float(r['installed_capacity_mld']))} MLD)"
                        if r["stp_id"].startswith("bhandewadi")
                        else ""
                    ),
                    "capacity_mld": clean(float(r["installed_capacity_mld"])),
                    "utilisation_mld_as_printed": clean(
                        float(r["utilisation_mld_as_printed"])
                    ),
                    "technology": r["technology_as_printed"],
                    "commissioned": int(r["commissioned_as_printed"]) if on else None,
                    "status": r["status_as_printed"],
                    "status_note": None
                    if on
                    else "ESR prints 'WIP' in the commissioning column",
                    "consent_to_operate_from": "2022-12-15" if on else None,
                    "consent_to_operate_until": "2027-04-30" if on else None,
                    "mpcb_status_jan_2026": r["mpr_status_as_printed"] or None,
                    "mpcb_compliance_jan_2026": comply.rsplit("-", 1)[0]
                    if comply
                    else None,
                    "mpcb_compliance_source": (
                        f"MPCB Monthly Progress Report to NMCG under NGT O.A. 673/2018, January "
                        f"2026, 'Details of 173 existing STP in the State', Sr. {r['mpr_sr_no']}"
                        if comply
                        else "Not in MPCB's January 2026 list of existing plants"
                    ),
                    "source": "NMC ESR 2023-24, Table 6.3 (printed p.137)",
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(r["lng"]), float(r["lat"])],
                },
            }
        )
    trial = [r for r in reg if not r["status_as_printed"] == "Operational"]
    return {
        "nvdm": "1.0",
        "dataset": "geojson-layers/stps",
        "scope": {"kind": "city", "id": "nagpur"},
        "provenance": {
            "sources": [
                {
                    "id": NMC_ESR_ID,
                    "title": "NMC Environment Status Report 2023-24 (CSIR-NEERI), Table 6.3 'Details of sewage treatment plants run by NMC' and section 6.2.2",
                    "publisher": "Nagpur Municipal Corporation",
                    "url": ESR_URL,
                    "license": registry_license(NMC_ESR_ID),
                    "as_of": ESR_AS_OF,
                },
                {
                    "id": MPCB_MPR_ID,
                    "title": "MPCB, Monthly Progress Report to NMCG under NGT O.A. 673/2018 (January 2026; cover line reads 'Jan -2025'), 'Details of 173 existing STP in the State', Sr. 151-162",
                    "publisher": "Maharashtra Pollution Control Board",
                    "url": MPR_URL,
                    "license": registry_license(MPCB_MPR_ID),
                    "as_of": MPR_AS_OF,
                },
            ],
            "method": "pdf-extract",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/build_nagpur_river_quality.py",
            "note": (
                f"13 plants as ESR Table 6.3 prints them, coordinates as printed (Narsala's to three "
                f"decimals). The 12 operating plants sum to {ESR_STP_TOTAL_MLD} MLD, the figure the "
                f"ESR's text gives against {ESR_SEWAGE_GENERATED_MLD} MLD of sewage, itself 73% of "
                "supply rather than a measured flow; the utilisation column equals capacity on every "
                "row. MPCB's January 2026 report lists all 12 operating plants as Operational and "
                "'Non-Comply' without naming a parameter; no plant-level outlet readings are "
                "published."
            ),
        },
        "type": "FeatureCollection",
        "summary": {
            "operational_count": len(operating),
            "operational_capacity_mld": ESR_STP_TOTAL_MLD,
            "trial_run_count": len(trial),
            "trial_run_capacity_mld": clean(
                sum(float(r["installed_capacity_mld"]) for r in trial)
            ),
            "sewage_generated_mld_esr": ESR_SEWAGE_GENERATED_MLD,
            "mpcb_non_comply_jan_2026": sum(
                1
                for f in features
                if f["properties"]["mpcb_compliance_jan_2026"] == "Non-Comply"
            ),
        },
        "features": features,
    }


def river_lengths(allow_missing: bool) -> dict[str, float | None]:
    if not RIVERS_GEOJSON.exists():
        if not allow_missing:
            raise SystemExit(
                f"{RIVERS_GEOJSON.relative_to(REPO_ROOT)} is missing; build the geography first "
                "or pass --allow-missing-geometry"
            )
        print("WARNING: no nagpur-rivers.geojson; length_km left null", file=sys.stderr)
        return {}
    geo = json.loads(RIVERS_GEOJSON.read_text())
    out: dict[str, float | None] = {}
    for f in geo["features"]:
        p = f.get("properties") or {}
        if p.get("river_id") in RIVERS and p.get("length_km") is not None:
            out[p["river_id"]] = round(out.get(p["river_id"], 0) + p["length_km"], 1)
    missing = [r for r in RIVERS if r not in out]
    if missing and not allow_missing:
        raise SystemExit(
            f"nagpur-rivers.geojson has no length for: {', '.join(missing)}"
        )
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--allow-missing-geometry", action="store_true")
    args = ap.parse_args()
    quality, stp_doc, recorded = build(river_lengths(args.allow_missing_geometry))
    write_artifact(OUT_QUALITY, quality)
    write_artifact(OUT_STPS, stp_doc)
    n = sum(len(s["readings"]) for r in quality["rivers"] for s in r["stations"])
    ns = sum(len(r["stations"]) for r in quality["rivers"])
    print(f"{ns} stations, {n} readings -> {OUT_QUALITY.name}", file=sys.stderr)
    print(f"{len(stp_doc['features'])} STPs -> {OUT_STPS.name}", file=sys.stderr)
    print(
        f"{len(recorded)} 2018-2019 CPCB/MPCB disagreements recorded", file=sys.stderr
    )
    print(quality["_headline"], file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
