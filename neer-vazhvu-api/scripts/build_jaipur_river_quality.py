#!/usr/bin/env python3
"""
Jaipur's measured river quality, for /jaipur/rivers.

INPUT is the reviewed transcription in pipeline-inputs/jaipur/: CPCB's annual
NWMP river tables (2018-2024) for the three river stations that bear on the city,
and CPCB's monitoring-station list (WQMN_list.pdf, October 2020) for coordinates.
Every value was read from the PDF text and from the page image.

THE FINDING IS A CONTRAST, not a gradient. The city's water comes from Bisalpur
dam on the Banas, about 120 km away, where CPCB's highest BOD in 2024 was
1.6 mg/L. The city's own river, the Dravyavati, has no published readings on its
channel at all. The nearest series is station 2952 at Newta dam, which takes
water diverted from the Dravyavati at Gular dam (RSPCB/MNIT action plan,
December 2018): its highest BOD was above 3 mg/L in every year from 2018 to 2024
and reached 36.5 mg/L in 2024.

WHERE EACH STATION GOES, and why:
  * 2952 sits under the Dravyavati as an INDIRECT signal, named as such. CPCB has
    filed it under the Banas (2018, 2022) and the "Vishwamitri" (2025) in its
    polluted-stretch reports; neither is the river the dam takes water from.
  * 2952 KEEPS its readings but not its coordinate. CPCB's list places it at
    Kanota dam on the Dhund (0.37 km from station 4781), while RSPCB maps Nevta
    dam south-west of the city. Unresolved until RSPCB or CPCB says where it is
    sampled.
  * 4781 Kanota dam is in CPCB's 2021 river tables only.
  * 2944 Jal Mahal (Man Sagar) is a lake on the Darbhawati, not on any river this
    page draws, and the river panel has no lake-station form. Its rows stay in the
    input CSV for the water-bodies page and are left out of this artifact.

Reading conventions (CPCB's): BDL means below the detection limit and is kept as
null with the cell named in `below_detection`; a "-" or a blank cell is null.

Length: the reach drawn on the map (public/geojson/jaipur-rivers.geojson, built by
scripts/fetch-osm-layers.ts), so the panel and the map agree. The Dravyavati is
the exception: OpenStreetMap maps it as a water outline, not a centre line, so the
drawn length is not a river length; JDA's corridor length (EIA 2017) is used.
If the geojson is missing, lengths are null and the script says so: re-run it
after the OSM rivers layer is built.

Run:  python3 neer-vazhvu-api/scripts/build_jaipur_river_quality.py
"""

import csv
import json
import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

INPUTS = REPO_ROOT / "pipeline-inputs" / "jaipur"
GEOJSON = REPO_ROOT / "public" / "geojson" / "jaipur-rivers.geojson"
OUT = REPO_ROOT / "public" / "data" / "river-quality-jaipur.json"
NWMP_ID = "cpcb-nwmp-annual"
PRS_ID = "cpcb-prs-report"

# ── Curated content (wording and citations), kept apart from the logic ──────

# Lengths published by the agency itself, used instead of the drawn length.
OFFICIAL_LENGTH_KM = {
    # JDA EIA/EMP Chapter 2 (2017), PDF p.2: "Total length of Nallah is 47.50 Km."
    "dravyavati": 47.5,
}

# Withheld coordinates: readings kept, no map marker.
UNRESOLVED_COORDS = {
    "2952": (
        "Not on the map. CPCB's station list (October 2020, PDF p.103) places it at "
        "26.919491 N, 75.930328 E, which is Kanota dam on the Dhund, 0.37 km from "
        "station 4781. RSPCB's 2018 action plan (PDF p.19, Fig. 2.10) maps Nevta dam "
        "south-west of the city. Where the station is sampled is unresolved."
    ),
}

RIVERS = [
    {
        "id": "dravyavati",
        "name": "Dravyavati",
        "stations": [
            (
                "2952",
                "River near Newta dam (CPCB 2952): a dam fed by a diversion from the "
                "Dravyavati, not the channel itself",
                "Newta dam (indirect)",
            )
        ],
        "cpcb_class": (
            "Not listed by name; the Newta dam stretch was Priority III (2018), "
            "I (2022) and II (2025)"
        ),
        "description": (
            "Jaipur's own river. JDA's 2017 environmental report calls it 'the active "
            "river of Jaipur which, over the time turned into a Nallah (Amanisha "
            "Nallah)'. It rises in the Nahargarh hills, takes the storm and waste water "
            "of the walled city and Sanganer, and 'ultimately discharges into Dhund "
            "River'. JDA signed the rejuvenation contract on 18.03.2016: Rs 1,470.85 "
            "crore to design and build a 47.50 km corridor and Rs 206.08 crore for ten "
            "years of operation and maintenance (Rajasthan High Court, order of "
            "19.12.2024 in S.B. Civil Writ Petition 14997/2024)."
        ),
        "notes": (
            "No agency publishes water-quality readings on the Dravyavati channel. The "
            "readings here are CPCB's station 2952, 'River near Newta dam'. RSPCB's "
            "December 2018 action plan says Nevta dam 'is fed from Dravyavati River "
            "through a diversion channel' from Gular dam, so the readings show the "
            "water the river sends there, not the channel. CPCB has listed the stretch "
            "in each of its three polluted-stretch editions under other names: 'Banas, "
            "along Bisalpur Dam, Swaroopganj, Newta Dam', Priority III, BOD 13.2 mg/L "
            "(2018); 'Banas, Bassi to Bisalpur', Priority I, 35.7 mg/L, the same figure "
            "as Newta dam's 2019 maximum (November 2022); and 'Vishwamitri near Newta "
            "Dam, Jaipur to D/S Khalipur village', Priority II (2025). The 2025 report "
            "pairs Newta dam's 16 mg/L with 30 mg/L at Khalipur village, 'before "
            "meeting Jambuva river', a station the same report lists under Gujarat; "
            "Newta dam's own figure falls in CPCB's Priority III band (10.1 to 20 "
            "mg/L)."
        ),
    },
    {
        "id": "dhund",
        "name": "Dhund",
        "stations": [
            (
                "4781",
                "Kanota dam, village Sumel, tehsil Bassi (CPCB 4781)",
                "Kanota dam",
            )
        ],
        "cpcb_class": (
            "'Kanota, along Sumel': Priority IV (November 2022); not listed in 2018 or "
            "2025"
        ),
        "description": (
            "A seasonal river east and south of the city, into which the Dravyavati "
            "flows. Kanota dam, completed in 2001, stands on it (CWC National Register "
            "of Large Dams 2019, which spells it 'dhoond'); on 8 October 2026 the "
            "state's daily dam report showed Kanota full, at 14.13 million cubic "
            "metres."
        ),
        "notes": (
            "CPCB has published one year of readings at Kanota dam, in its 2021 river "
            "tables; station 4781 is not in the 2018-2020 or 2022-2024 tables. CPCB's "
            "November 2022 polluted-stretch list gives 'Kanota, along Sumel' a "
            "maximum BOD of 9.5 mg/L, Priority IV; the 2018 and 2025 lists do not "
            "include it."
        ),
    },
    {
        "id": "banas",
        "name": "Banas",
        "stations": [
            (
                "2951",
                "Bisalpur dam, Tonk district (CPCB 2951)",
                "Bisalpur dam",
            )
        ],
        "cpcb_class": (
            "Listed with Newta dam in 2018 (III) and 2022 (I); not listed at "
            "Bisalpur in 2025"
        ),
        "description": (
            "The river that carries most of Jaipur's water. Bisalpur dam on the Banas, "
            "completed in 1999 (CWC National Register of Large Dams 2019), is about "
            "120 km from the city (CGWB, 2023); PHED's annual report gives the city "
            "766.73 MLD on 31 December 2025, 590 MLD of it from Bisalpur."
        ),
        "notes": (
            "At Bisalpur, CPCB's highest BOD reading was 1.6 to 3.5 mg/L a year from "
            "2018 to 2024, within the 3 mg/L bathing limit in five of the seven years. "
            "CPCB's 2018 and 2022 Banas stretches ('along Bisalpur Dam, Swaroopganj, "
            "Newta Dam', III; 'Bassi to Bisalpur', I) take in Newta dam: the 2022 "
            "class rests on 35.7 mg/L, the same figure as Newta dam's highest in 2019, "
            "when Bisalpur's highest was 1.7. The 2025 edition lists the Banas only at "
            "Dhanari dam near Swaroopganj, Sirohi (Priority V), which RSPCB's 2018 "
            "plan places on the West Banas, the stretch that flows towards Gujarat."
        ),
    },
]

EXCLUDED = [
    "2944 Jalmahal (Man Sagar lake), 2021-2024: a lake on the Darbhawati, not on a "
    "river this page draws; rows kept in pipeline-inputs/jaipur/ for the "
    "water-bodies page.",
    "2952 coordinate: withheld, see the station's coordinate_note.",
]

PARAMS = {
    "do_mgl": ("do_min_mgl", "do_max_mgl"),
    "bod_mgl": ("bod_min_mgl", "bod_max_mgl"),
    "ph": ("ph_min", "ph_max"),
    "conductivity_us": ("cond_min_umho_cm", "cond_max_umho_cm"),
    "nitrate_mgl": ("nitrate_min_mgl", "nitrate_max_mgl"),
    "fecal_coliform_mpn": ("fc_min_mpn100ml", "fc_max_mpn100ml"),
}

# Figures the page copy quotes; the build stops if the transcription disagrees.
EXPECT_BOD_MAX = {("2952", 2024): 36.5, ("2952", 2019): 35.7, ("2951", 2024): 1.6}

# ── Logic ───────────────────────────────────────────────────────────────────


def num(v: str):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None  # BDL, '-', 'not reported', blank


def rng(row: dict, lo: str, hi: str):
    a, b = num(row[lo]), num(row[hi])
    return None if a is None and b is None else {"min": a, "max": b}


def reading(r: dict) -> dict:
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
    return rd


def station(code, name, stretch, rows, coords) -> dict:
    mine = sorted(
        (r for r in rows if r["station_code"] == code), key=lambda r: int(r["year"])
    )
    if not mine:
        raise SystemExit(f"no rows for station {code} in the input CSV")
    lat, lng = coords.get(code, (None, None))
    out = {
        "id": f"nwmp-{code}",
        "nwmp_code": code,
        "name": name,
        "name_ta": "",
        "lat": lat,
        "lng": lng,
        "stretch": stretch,
        "readings": [reading(r) for r in mine],
        "pdf_pages": sorted({f"{r['year']} p.{r['pdf_page']}" for r in mine}),
    }
    if code in UNRESOLVED_COORDS:
        out["coordinate_status"] = "unresolved"
        out["coordinate_note"] = UNRESOLVED_COORDS[code]
    return out


def drawn_lengths() -> dict:
    if not GEOJSON.exists():
        print(
            f"WARNING: {GEOJSON.relative_to(REPO_ROOT)} not found; drawn lengths are "
            "null. Build the OSM rivers layer, then re-run this script.",
            file=sys.stderr,
        )
        return {}
    geo = json.loads(GEOJSON.read_text())
    return {
        f["properties"]["river_id"]: f["properties"].get("length_km")
        for f in geo["features"]
    }


def bod_max(st: dict, year: int):
    r = next((x for x in st["readings"] if x["year"] == year), None)
    return r and r["bod_mgl"] and r["bod_mgl"]["max"]


def main() -> int:
    rows = list(csv.DictReader(open(INPUTS / "cpcb-nwmp-jaipur-2018-2024.csv")))
    coords = {
        r["station_code"]: (float(r["lat"]), float(r["lon"]))
        for r in csv.DictReader(open(INPUTS / "jaipur-wq-stations.csv"))
        if r["lat"] and r["lon"]
    }
    lengths = drawn_lengths()

    rivers = []
    for spec in RIVERS:
        sts = [station(c, n, s, rows, coords) for c, n, s in spec["stations"]]
        rivers.append(
            {
                "id": spec["id"],
                "name": spec["name"],
                "name_ta": "",
                "length_km": OFFICIAL_LENGTH_KM.get(
                    spec["id"], lengths.get(spec["id"])
                ),
                "cpcb_class": spec["cpcb_class"],
                "description": spec["description"],
                "notes": spec["notes"],
                "stations": sts,
            }
        )
    by_code = {s["nwmp_code"]: s for r in rivers for s in r["stations"]}
    for (code, year), want in EXPECT_BOD_MAX.items():
        got = bod_max(by_code[code], year)
        if got != want:
            raise SystemExit(f"{code} {year}: BOD max {got}, page copy says {want}")

    years = sorted({rd["year"] for s in by_code.values() for rd in s["readings"]})
    newta, bis = by_code["2952"], by_code["2951"]
    out = {
        "nvdm": "1.0",
        "dataset": "data-root/river-quality",
        "scope": {"kind": "city", "id": "jaipur"},
        "provenance": {
            "sources": [
                {
                    "id": NWMP_ID,
                    "title": "CPCB NWMP annual river water quality tables, 2018-2024, and the NWMP station list (October 2020)",
                    "publisher": "Central Pollution Control Board",
                    "license": registry_license(NWMP_ID),
                    "role": "input",
                },
                {
                    "id": PRS_ID,
                    "title": "CPCB Polluted River Stretches: 2018 (as listed in CPCB's 2025 report and RSPCB's 2018 action plan), November 2022 (Lok Sabha USQ 1734, 05.12.2024) and 2025 (copy hosted by the Puducherry Pollution Control Committee) editions",
                    "publisher": "Central Pollution Control Board",
                    "license": registry_license(PRS_ID),
                },
            ],
            "method": "pdf-extract",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/build_jaipur_river_quality.py",
            "note": "Per-station yearly min and max as CPCB prints them; nothing averaged or interpolated. Read from the reviewed transcription in pipeline-inputs/jaipur/.",
        },
        "place_id": "jaipur",
        "last_updated": str(years[-1]),
        "data_year_range": [years[0], years[-1]],
        "source": "CPCB NWMP",
        "source_label": f"CPCB NWMP annual river data, {years[0]}-{years[-1]}",
        "source_url": "https://cpcb.gov.in/nwmp-data/",
        "_headline": (
            f"Highest BOD at Bisalpur dam, where Jaipur's water comes from: "
            f"{bod_max(bis, years[-1]):g} mg/L in {years[-1]}. At Newta dam, fed from "
            f"the city's Dravyavati: {bod_max(newta, years[-1]):g} mg/L. No agency "
            "publishes readings on the Dravyavati channel itself."
        ),
        "rivers": rivers,
        "_excluded": EXCLUDED,
    }
    write_artifact(OUT, out)
    n = sum(len(s["readings"]) for s in by_code.values())
    print(f"{len(by_code)} stations, {n} station-years -> {OUT.name}", file=sys.stderr)
    print(out["_headline"], file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
