#!/usr/bin/env python3
"""
Pune river water quality, from CPCB's polluted-river-stretch assessments.

THE FINDING, and it is a self-contradiction inside a single CPCB document.
The October 2025 "Polluted River Stretches for Restoration of Water Quality
(Updated Version)" classifies the Mula as IMPROVED - Priority I in 2018 down
to Priority II now - on 2022-23 monitoring data. Annexure XIV of the same
report tabulates BOD at those same locations in 2024, and station 2194, "River
Mula at Harrison Bridge near Mula-Pawana Sangam, Village Bopodi, Taluka
Haveli, District Pune", reads **102.5 mg/L**.

That is the sixth-highest reading in the entire national annexure of 756
locations, and it is above the worst 2024 reading CPCB publishes for the
Yamuna in Delhi (85.0 at station 1812) and above the Mithi at Mahim (80.0).
Only six locations in India exceed 100 mg/L and one of them is in Pune.

THE SECOND FINDING IS THE GRADIENT, from the same table. The Mutha leaves
Khadakwasla dam at 4.1 mg/L - cleaner than the 3 mg/L bathing standard is
strict, but close to it - and by the time it has crossed the city it reads
32.5 at Deccan Bridge, 35.0 at Sangam and 50.2 at Veer Savarkar Bhavan. The
river does not arrive polluted. Pune pollutes it, over about fifteen
kilometres.

WHY BOTH VINTAGES ARE CARRIED. The PRIORITY CLASS is CPCB's formal
classification and rests on 2022-23 data; the 2024 BOD is a later measurement
published in an annexure and has NOT been used to re-classify anything. They
are not interchangeable and this artifact never averages them. The class is
what CPCB has decided; the 2024 number is what CPCB has measured since.

A TRAP IN THE OLDER EDITIONS, recorded so nobody repeats it: the 2015 edition's
numeric column is STRETCH LENGTH IN KILOMETRES, not BOD. It gives Indrayani
96, Mula-Mutha 15, Mutha 12, Pawana 12, Bhima 200. Read as BOD those are
catastrophic and wrong.

Run:  python3 neer-vazhvu-api/scripts/build_pune_river_quality.py
"""

import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

DATA_DIR = REPO_ROOT / "public" / "data"

CPCB_2025 = (
    "https://cpcb.gov.in/openpdffile.php?id="
    "UmVwb3J0RmlsZXMvMTc3N18xNzYwNjgxNDA4X21lZGlhcGhvdG80MzkyLnBkZg=="
)
CPCB_2018 = "https://cpcb.gov.in/wqm/PollutedStretches-2018.pdf"

# CPCB priority bands are constant across editions, in mg/L of BOD.
PRIORITY_BANDS = {
    "I": "above 30",
    "II": "20.1 to 30",
    "III": "10.1 to 20",
    "IV": "6.1 to 10",
    "V": "3.1 to 6",
}

# Stretch-level classification. `priority_2025` rests on 2022-23 monitoring.
STRETCHES = [
    {
        "river": "Mutha",
        "stretch": "Khadakwasla Dam to Sangam Bridge",
        "priority_2018": "I",
        "priority_2022": "I",
        "priority_2025": "II",
        "bod_2018_range": [5.0, 42.5],
        "bod_2022_max": 50.0,
        "bod_2022_23_max": 30,
    },
    {
        "river": "Mula",
        "stretch": "Bopodi (Harrison Bridge) to Aundh Gaon",
        "priority_2018": "I",
        "priority_2022": "II",
        "priority_2025": "II",
        "bod_2018_range": [33, 35],
        "bod_2022_max": 28.0,
        "bod_2022_23_max": 25,
    },
    {
        "river": "Mula-Mutha",
        "stretch": "Mundhawa Bridge to downstream of Theur",
        "priority_2018": "II",
        "priority_2022": "II",
        "priority_2025": "II",
        "bod_2018_range": [14, 22],
        "bod_2022_max": 22.0,
        "bod_2022_23_max": 21,
    },
    {
        "river": "Pawana",
        "stretch": "Sangavigaon to Dapodi Bridge",
        "priority_2018": "II",
        "priority_2022": "II",
        "priority_2025": "II",
        "bod_2018_range": [15.5, 24],
        "bod_2022_max": 26.0,
        "bod_2022_23_max": 27,
    },
    {
        "river": "Bhima",
        "stretch": "Upstream Vithalwadi to Takli",
        "priority_2018": "II",
        "priority_2022": "I",
        "priority_2025": "II",
        "bod_2018_range": [8.0, 22.0],
        "bod_2022_max": 38.0,
        "bod_2022_23_max": 27,
    },
    {
        "river": "Indrayani",
        "stretch": "Upstream Moshigaon to downstream Alandigaon",
        "priority_2018": "II",
        "priority_2022": "III",
        "priority_2025": "III",
        "bod_2018_range": [12.5, 22],
        "bod_2022_max": 15.5,
        "bod_2022_23_max": 11,
    },
    {
        "river": "Ghod",
        "stretch": "At Shirur",
        "priority_2018": "III",
        "priority_2022": "III",
        "priority_2025": "IV",
        "bod_2018_range": [10.2, 10.2],
        "bod_2022_max": 11.5,
        "bod_2022_23_max": 9.7,
    },
]

# Annexure XIV of the October 2025 report: BOD measured in 2024 at the NWMP
# stations on those stretches. Every row below was read out of the PDF text,
# not transcribed from a summary.
STATIONS_2024 = [
    (2680, "Mutha", "Khadakwasla Dam", 4.1),
    (2679, "Mutha", "Deccan Bridge", 32.5),
    (2191, "Mutha", "Sangam Bridge / Ganapathyghat, Shivajinagar", 35.0),
    (2678, "Mutha", "Veer Savarkar Bhavan, Pune M.C.", 50.2),
    (2194, "Mula", "Harrison Bridge, Mula-Pawana Sangam, Bopodi", 102.5),
    (2193, "Mula", "Aundh Bridge, Aundhgaon", 25.6),
    (2192, "Mula-Mutha", "Mundhawa Bridge", 22.0),
    (2677, "Mula-Mutha", "Downstream of Theur", 18.4),
    (2692, "Pawana", "Ravet Weir", 7.4),
    (2693, "Pawana", "Chinchwadgaon", 17.6),
    (2694, "Pawana", "Pimprigaon", 28.3),
    (2196, "Pawana", "Sangavigaon", 30.0),
    (2691, "Pawana", "Dapodi Bridge, Pawana-Mula Sangam", 33.0),
    (2690, "Pawana", "Kasarwadi", 36.0),
    (2668, "Indrayani", "Downstream Moshi", 13.2),
    (2669, "Indrayani", "Upstream Moshigaon", 13.2),
    (2197, "Indrayani", "Alandigaon", 16.1),
    # CPCB files these two under BHIMA, and its own label for 1189 reads
    # "RIVER BHIMA AT PUNE (MUTHA RIVER)" - the board is itself flagging that
    # the water at Vithalwadi and Bundgarden is the Mutha/Mula-Mutha before it
    # becomes the Bhima. Kept under CPCB's river name so the row can be found
    # in the source, with the discrepancy recorded rather than silently fixed.
    (
        1189,
        "Bhima",
        "Upstream Vithalwadi, Shankar Mandir (labelled 'Mutha River')",
        32.0,
    ),
    (1190, "Bhima", "Downstream Bundgarden, Yerwada", 34.0),
    (2665, "Ghod", "Shirur", 14.4),
]

# river_id must match the geojson's `river_id` and the RIVER_INFO_BY_CITY key
# in src/app/[cityId]/rivers/page.tsx, or the panel finds no narrative.
RIVER_IDS = {
    "Mutha": "mutha",
    "Mula": "mula",
    "Mula-Mutha": "mula-mutha",
    "Pawana": "pavana",
    "Bhima": "bhima",
    "Indrayani": "indrayani",
    "Ghod": "ghod",
}

# Measured off the OSM centrelines in pune-rivers.geojson, summed per river_id.
LENGTH_KM = {
    "mutha": 34.9,
    "mula": 57.2,
    "mula-mutha": 36.0,
    "pavana": 58.1,
    "bhima": 73.6,
    "indrayani": 61.4,
    "ghod": 0.0,
}

DESCRIPTIONS = {
    "mutha": (
        "Pune's own river, and the one the city drinks. It leaves Khadakwasla "
        "at 4.1 mg/L of BOD and reads 50.2 mg/L about fifteen kilometres "
        "downstream at Veer Savarkar Bhavan."
    ),
    "mula": (
        "Comes down from Mulshi and takes the Pavana at Bopodi. CPCB measured "
        "102.5 mg/L there in 2024 - the sixth-highest of 756 locations in "
        "India - in a report that classifies this stretch as improved."
    ),
    "mula-mutha": (
        "The combined river below the Sangam, and the one the JICA "
        "pollution-abatement programme is named for. PMC generates 980 MLD of "
        "sewage against 477 MLD of operating treatment capacity."
    ),
    "pavana": (
        "Pimpri-Chinchwad's water supply and its effluent drain in one "
        "channel: 7.4 mg/L at the Ravet intake, 36.0 at Kasarwadi."
    ),
    "bhima": (
        "The Krishna tributary everything above drains into. CPCB's own label "
        "for its first Pune station reads 'River Bhima at Pune (Mutha River)'."
    ),
    "indrayani": (
        "The pilgrimage river past Dehu and Alandi, and the one that "
        "periodically runs under white foam at the ghats. MPCB blames "
        "detergent, PCMC blames industry, and neither has published a "
        "surfactant measurement."
    ),
    "ghod": "A Bhima tributary, monitored at Shirur - the district's one critical groundwater taluka.",
}


def status_for(bod):
    """Map worst measured 2024 BOD to the shared status vocabulary."""
    if bod is None:
        return "degraded"
    if bod > 50:
        return "dead"
    if bod > 30:
        return "severely_degraded"
    if bod > 10:
        return "degraded"
    if bod > 3:
        return "stressed"
    return "healthy"


# National context, from the same annexure, so the Pune number can be placed
# without reaching for a second document.
NATIONAL_2024 = {
    "locations_tabulated": 756,
    "locations_above_100_mg_l": 6,
    "worst_delhi_yamuna": {"station": 1812, "bod": 85.0, "name": "Yamuna, Delhi"},
    "mithi_at_mahim": {"station": 2168, "bod": 80.0, "name": "Mithi, Mumbai"},
    "_note": (
        "Counted from the annexure itself. The five readings above the Mula's "
        "102.5 are 160.0 and 120.0 (Tamil Nadu), 150.0 (Bhella), 142.0 "
        "(Ghaggar, Punjab) and 116.0 (Yamuna)."
    ),
}


def main() -> int:
    by_river: dict[str, list] = {}
    for stn, river, place, bod in STATIONS_2024:
        by_river.setdefault(river, []).append((stn, place, bod))

    rivers = []
    for s in STRETCHES:
        rid = RIVER_IDS[s["river"]]
        raw = sorted(by_river.get(s["river"], []), key=lambda x: -x[2])
        stations = [
            {
                "id": str(stn),
                "name": place,
                # NOT GEOLOCATED, and published anyway. CPCB names these
                # stations but does not give coordinates in the report, and
                # `mpcb.ecmpcb.in/envtdata/<id>.php` geolocates only a partial
                # set frozen at 2019. The rivers map already guards a null
                # coordinate ("we would rather carry the readings than drop
                # them"), so the readings render in the panel and the station
                # simply gets no marker. Inventing a position would be worse.
                "lat": None,
                "lng": None,
                "stretch": s["stretch"],
                "readings": [
                    {
                        "year": 2024,
                        "do_mgl": None,
                        "bod_mgl": bod,
                        "ph": None,
                        "conductivity_us": None,
                        "cod_mgl": None,
                        "fecal_coliform_mpn": None,
                        "tds_mgl": None,
                        "nitrate_mgl": None,
                        "chromium_mgl": None,
                        "lead_mgl": None,
                        "cadmium_mgl": None,
                    }
                ],
            }
            for stn, place, bod in raw
        ]
        worst = raw[0][2] if raw else None
        rivers.append(
            {
                "id": rid,
                "name": s["river"],
                "name_ta": "",
                "length_km": LENGTH_KM[rid],
                "overall_status": status_for(worst),
                "cpcb_class": (
                    f"Priority {s['priority_2025']} "
                    f"(BOD {PRIORITY_BANDS[s['priority_2025']]} mg/L)"
                ),
                "description": DESCRIPTIONS[rid],
                "notes": (
                    f"CPCB priority history: {s['priority_2018']} (2018) -> "
                    f"{s['priority_2022']} (2022) -> {s['priority_2025']} (2025, on "
                    f"2022-23 monitoring). Worst measured BOD in 2024: "
                    f"{worst} mg/L. The class and the 2024 reading are different "
                    f"vintages from the same report and are not merged."
                ),
                "stations": stations,
                "cpcb_priority_history": {
                    "2018": s["priority_2018"],
                    "2022": s["priority_2022"],
                    "2025": s["priority_2025"],
                },
                "bod_2018_range_mg_l": s["bod_2018_range"],
                "bod_2022_max_mg_l": s["bod_2022_max"],
                "bod_2022_23_max_mg_l": s["bod_2022_23_max"],
            }
        )
    rivers.sort(
        key=lambda r: (
            -max((st["readings"][0]["bod_mgl"] for st in r["stations"]), default=0)
        )
    )

    mutha = next(r for r in rivers if r["name"] == "Mutha")
    mula = next(r for r in rivers if r["name"] == "Mula")
    mutha_bods = sorted(st["readings"][0]["bod_mgl"] for st in mutha["stations"])
    mula_worst = max(st["readings"][0]["bod_mgl"] for st in mula["stations"])

    out = {
        "nvdm": "1.0",
        "dataset": "data-root/river-quality",
        "scope": {"kind": "city", "id": "pune"},
        "provenance": {
            "sources": [
                {
                    "id": "cpcb-polluted-river-stretches",
                    "title": (
                        "CPCB, Polluted River Stretches for Restoration of Water "
                        "Quality (Updated Version), October 2025 - Table 3.17 and "
                        "Annexure XIV"
                    ),
                    "publisher": "Central Pollution Control Board",
                    "license": registry_license("cpcb-polluted-river-stretches"),
                }
            ],
            "method": "pdf-extract",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/build_pune_river_quality.py",
            "conventions": {
                "two_vintages": (
                    "PRIORITY CLASS rests on 2022-23 monitoring and is CPCB's formal "
                    "classification. The 2024 BOD figures come from Annexure XIV of "
                    "the same report and have NOT been used to re-classify anything. "
                    "The two are never averaged or presented as one series."
                ),
                "bod_units": "mg/L. CPCB's bathing-water criterion is 3 mg/L.",
                "ungeolocated_stations": (
                    "Every station carries lat/lng null: CPCB names them and does "
                    "not publish coordinates. Readings render; markers do not."
                ),
            },
        },
        "last_updated": "2025-10",
        "data_year_range": [2018, 2024],
        "source": (
            "CPCB Polluted River Stretches assessment, October 2025 (2022-23 "
            "monitoring), with 2024 BOD from the same report's Annexure XIV"
        ),
        "source_url": CPCB_2025,
        "source_label": "CPCB Polluted River Stretches (Updated Version), October 2025",
        "_headline": (
            "CPCB records the Mula as improved, from Priority I to Priority II. "
            f"In an annexure to the same report it records the Mula at Bopodi at "
            f"{mula_worst} mg/L of BOD in 2024 - the sixth-highest reading among "
            "756 locations nationally, higher than the worst Delhi Yamuna station "
            "(85.0) and higher than the Mithi at Mahim (80.0)."
        ),
        "_gradient": (
            f"The Mutha leaves Khadakwasla dam at {mutha_bods[0]} mg/L and reads "
            f"{mutha_bods[-1]} mg/L at Veer Savarkar Bhavan, about fifteen "
            f"kilometres downstream. The river does not arrive polluted."
        ),
        "priority_bands_mg_l": PRIORITY_BANDS,
        "rivers": rivers,
        "national_context_2024": NATIONAL_2024,
        "_edition_trap": (
            "The 2015 edition of this assessment carries STRETCH LENGTH IN KM in "
            "the column where later editions carry BOD (Indrayani 96, Mula-Mutha "
            "15, Mutha 12, Pawana 12, Bhima 200). Read as BOD those numbers are "
            "wrong and alarming. Only 2018 onward are comparable."
        ),
        "_not_included": (
            "Per-station COD is collected by MPCB and not published. No "
            "surfactant or detergent measurement exists for the Indrayani, which "
            "matters because MPCB's attribution of the Alandi foaming to "
            "detergent is a position rather than a measurement, and PCMC "
            "attributes it to Chakan/Dehu/Talegaon industry instead."
        ),
    }

    path = DATA_DIR / "river-quality-pune.json"
    write_artifact(path, out, indent=1)
    print(
        f"pune rivers: {len(rivers)} stretches, {len(STATIONS_2024)} stations; "
        f"worst {mula_worst} mg/L (Mula at Bopodi) -> {path.name}",
        file=sys.stderr,
    )
    for r in rivers:
        worst = max(
            (st["readings"][0]["bod_mgl"] for st in r["stations"]), default=None
        )
        where = next(
            (
                st["name"]
                for st in r["stations"]
                if st["readings"][0]["bod_mgl"] == worst
            ),
            "-",
        )
        print(
            f"  {r['name']:12} {r['cpcb_class']:34} "
            f"worst 2024 {str(worst):>6} mg/L  {where[:38]}  [{r['overall_status']}]",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
