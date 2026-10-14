#!/usr/bin/env python3
"""
The Sabarmati's measured quality, from Dharoi to Vautha, for /ahmedabad/rivers.

INPUT is the reviewed extraction in pipeline-inputs/ahmedabad/: CPCB's annual
NWMP river tables (Table 7, 2018-2024) for every Sabarmati station and the Khari
at Lali, transcribed row by row with the PDF page on each row, and CPCB's
monitoring-station list (WQMN_list.pdf) for coordinates. Ten rows had blank
cells and were assigned by column position; they carry that note.

THE FINDING IS THE GRADIENT, not any one number. Upstream at Hansol, where the
river enters the city, the highest BOD CPCB recorded was 1.2 to 5 mg/L in every
year from 2018 to 2024. At V.N. Bridge, below the city's outfalls, it was 82 to
358 mg/L, and the lowest dissolved oxygen sat at 0.3 mg/L - CPCB's detection
floor - in every year from 2019 to 2024. The river does not arrive polluted.

WHAT IS LEFT OUT, and why:
  * 10014 (Ahmedabad U/S, Hansol): the same values as 1866 in every year it
    shares; one site is shown once.
  * 2075 (river at Dharoi dam): a second Dharoi point; 1 has the longer series.
  * Meshwo at Samlaji and Shedhi at Kheda: outside the city's reach.
  * 1408 Miroli KEEPS its readings but not its coordinate: CPCB's list places it
    18.9 km north of the Miroli outfall GPCB located by drone survey, inside the
    city, which cannot be right for a downstream village station.

Two reading conventions to keep in mind (both from CPCB's own notes): BDL means
below the detection limit (DO 0.3 mg/L, BOD 1 mg/L), and a coliform count of
1600 is the top of CPCB's scale, so it means 1600 or more.

Run:  python3 neer-vazhvu-api/scripts/build_ahmedabad_river_quality.py
"""

import csv
import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

INPUTS = REPO_ROOT / "pipeline-inputs" / "ahmedabad"
NWMP_ID = "cpcb-nwmp"
PRS_ID = "cpcb-prs-report"

# Upstream to downstream. (code, display name, reach)
SABARMATI = [
    ("1221", "Kheroj Bridge (state entry)", "upstream, Gujarat entry"),
    ("1", "Dharoi dam", "upstream reservoir"),
    ("1482", "Mahudi", "upstream of Gandhinagar"),
    ("1407", "Chiloda bridge, Gandhinagar", "upstream of Ahmedabad"),
    ("1866", "Hansol bridge", "Ahmedabad entry"),
    ("1409", "Railway bridge, Ahmedabad", "riverfront reach"),
    ("2", "V.N. Bridge, Ahmedabad", "below the city's outfalls"),
    ("1408", "Miroli, Daskroi", "downstream of Ahmedabad"),
    ("10015", "Downstream of Miroli", "downstream of Ahmedabad"),
    ("1223", "Vautha, after the Meshwo confluence", "far downstream"),
]
KHARI = [("1437", "Lali village", "industrial east of the city")]
SUSPECT_COORDS = {"1408"}

PARAMS = {
    "do_mgl": ("do_min_mgl", "do_max_mgl"),
    "bod_mgl": ("bod_min_mgl", "bod_max_mgl"),
    "ph": ("ph_min", "ph_max"),
    "conductivity_us": ("cond_min_umho_cm", "cond_max_umho_cm"),
    "nitrate_mgl": ("nitrate_min_mgl", "nitrate_max_mgl"),
    "fecal_coliform_mpn": ("fc_min_mpn100ml", "fc_max_mpn100ml"),
}


def num(v: str):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None  # BDL, '-', 'not reported', blank


def rng(row: dict, lo: str, hi: str):
    a, b = num(row[lo]), num(row[hi])
    return None if a is None and b is None else {"min": a, "max": b}


def stations(spec, rows, coords):
    out = []
    for code, name, reach in spec:
        mine = sorted(
            (r for r in rows if r["station_code"] == code), key=lambda r: int(r["year"])
        )
        readings = []
        for r in mine:
            rd = {"year": int(r["year"])}
            rd.update({k: rng(r, lo, hi) for k, (lo, hi) in PARAMS.items()})
            bdl = [
                c
                for c in (x for pair in PARAMS.values() for x in pair)
                if r[c].strip().upper() == "BDL"
            ]
            if bdl:
                rd["below_detection"] = bdl
            if (num(r["fc_max_mpn100ml"]) or 0) >= 1600:
                rd["fecal_coliform_note"] = (
                    "1600 is the top of CPCB's scale: read as 1600 or more."
                )
            readings.append(rd)
        lat, lng = (
            (None, None) if code in SUSPECT_COORDS else coords.get(code, (None, None))
        )
        out.append(
            {
                "id": f"nwmp-{code}",
                "nwmp_code": code,
                "name": name,
                "name_ta": "",
                "lat": lat,
                "lng": lng,
                "stretch": reach,
                "readings": readings,
                "pdf_pages": sorted({f"{r['year']} p.{r['pdf_page']}" for r in mine}),
            }
        )
    return out


def main() -> int:
    rows = list(csv.DictReader(open(INPUTS / "cpcb-nwmp-sabarmati-2018-2024.csv")))
    coords = {
        r["station_code"]: (float(r["lat"]), float(r["lon"]))
        for r in csv.DictReader(open(INPUTS / "sabarmati-wq-stations.csv"))
        if r["lat"] and r["lon"]
    }
    sab = stations(SABARMATI, rows, coords)
    khari = stations(KHARI, rows, coords)

    def bod_max(st, year):
        r = next((x for x in st["readings"] if x["year"] == year), None)
        return r and r["bod_mgl"] and r["bod_mgl"]["max"]

    hansol = next(s for s in sab if s["nwmp_code"] == "1866")
    vn = next(s for s in sab if s["nwmp_code"] == "2")
    years = range(2018, 2025)
    hansol_range = (
        min(bod_max(hansol, y) for y in years),
        max(bod_max(hansol, y) for y in years),
    )
    vn_range = (min(bod_max(vn, y) for y in years), max(bod_max(vn, y) for y in years))

    out = {
        "nvdm": "1.0",
        "dataset": "data-root/river-quality",
        "scope": {"kind": "city", "id": "ahmedabad"},
        "provenance": {
            "sources": [
                {
                    "id": NWMP_ID,
                    "title": "CPCB NWMP annual river water quality, Table 7 (Sabarmati), 2018-2024, and the NWMP station list",
                    "publisher": "Central Pollution Control Board",
                    "license": registry_license(NWMP_ID),
                    "role": "input",
                },
                {
                    "id": PRS_ID,
                    "title": "CPCB Polluted River Stretches, 2018, 2022 and October 2025 editions (priority classes)",
                    "publisher": "Central Pollution Control Board",
                    "license": registry_license(PRS_ID),
                },
            ],
            "method": "pdf-extract",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/build_ahmedabad_river_quality.py",
            "internal_inputs": [
                "pipeline-inputs/ahmedabad/cpcb-nwmp-sabarmati-2018-2024.csv",
                "pipeline-inputs/ahmedabad/sabarmati-wq-stations.csv",
            ],
            "note": "Per-station yearly min and max as CPCB prints them; nothing averaged or interpolated.",
        },
        "place_id": "ahmedabad",
        "last_updated": "2024",
        "source_label": "CPCB NWMP annual river data, 2018-2024",
        "source_url": "https://cpcb.gov.in/water-quality-data/",
        "_headline": (
            f"Highest BOD at Hansol, where the Sabarmati enters the city: {hansol_range[0]:g} to "
            f"{hansol_range[1]:g} mg/L across 2018-2024. At V.N. Bridge, below the city's outfalls: "
            f"{vn_range[0]:g} to {vn_range[1]:g} mg/L."
        ),
        "rivers": [
            {
                "id": "sabarmati",
                "name": "Sabarmati",
                "name_ta": "",
                "cpcb_class": "Priority I in the 2018, 2022 and 2025 editions (BOD above 30 mg/L)",
                "description": (
                    "Clean where it enters Ahmedabad and among India's most polluted stretches where it "
                    "leaves. Through the city the river is a 15 km reach held by the Vasna barrage and "
                    "topped up from the Narmada canal; below the barrage it carries the city's treated and "
                    "untreated sewage and the industrial effluent of the Mega pipeline and the Narol CETP."
                ),
                "notes": (
                    "CPCB's polluted-stretch definition has narrowed in each edition: Kheroj to Vautha "
                    "(2018, BOD 4 to 147 mg/L), Raysan to Vautha (2022, maximum 292 mg/L at V.N. Bridge), "
                    "V.N. Bridge to the confluence at Vautha (October 2025, maximum 105 mg/L). Readings at "
                    "0.3 mg/L dissolved oxygen are CPCB's detection floor, i.e. effectively none."
                ),
                "stations": sab,
            },
            {
                "id": "khari",
                "name": "Khari",
                "name_ta": "",
                "cpcb_class": "Priority I in the 2018, 2022 and 2025 editions",
                "description": (
                    "A tributary that runs past the industrial estates on the city's eastern edge and joins "
                    "the Sabarmati downstream. CPCB monitors it at one point, Lali village."
                ),
                "notes": (
                    "Maximum BOD in CPCB's polluted-stretch editions: 235 mg/L (2018), 195 (2022), 68 "
                    "(2025)."
                ),
                "stations": khari,
            },
        ],
        "_excluded": [
            "10014 Ahmedabad U/S (Hansol): duplicates 1866 in every shared year.",
            "2075 River at Dharoi dam: a second Dharoi point; code 1 has the longer series.",
            "1224 Meshwo at Samlaji and 1222 Shedhi at Kheda: outside the city's reach.",
            "1408 Miroli: readings kept, coordinate withheld (CPCB's list places it 18.9 km north-north-east of the Miroli outfall GPCB located by drone survey, inside the city).",
        ],
    }
    path = REPO_ROOT / "public" / "data" / "river-quality-ahmedabad.json"
    write_artifact(path, out)
    n = sum(len(s["readings"]) for s in sab + khari)
    print(
        f"{len(sab) + len(khari)} stations, {n} station-years -> {path.name}",
        file=sys.stderr,
    )
    print(out["_headline"], file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
