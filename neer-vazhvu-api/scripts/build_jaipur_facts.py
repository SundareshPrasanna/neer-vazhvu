#!/usr/bin/env python3
"""
Jaipur facts, derived from the shipped artifacts rather than typed again.

Every number on a card that has a page behind it is read out of a file in
public/data, so a card cannot disagree with the page it summarises (the Pune
pattern; see build_pune_facts.py). require() makes a renamed key stop the build
instead of writing a blank onto a quotable card. The few cards with no page of
their own (IMD's station records, the 2025 monsoon, JICA's evaluation, the
24x7 trial, the sewage gap) carry their figure and citation here.

Run after the artifacts it reads:
  python3 neer-vazhvu-api/scripts/build_jaipur_facts.py
"""

import json
import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

DATA = REPO_ROOT / "public" / "data"
APR_2026 = (
    "https://phedwater.rajasthan.gov.in/content/dam/doitassets/water/"
    "Public-Health-Engineering-Department/Pdf2026/PHED%20ALL%20page.pdf"
)
INGRES = "https://ingres.iith.ac.in/"
IMD_TABLES = (
    "https://www.imdpune.gov.in/library/public/Climatological%20Tables%201991-2020.pdf"
)
IMD_MONSOON = "https://mausam.imd.gov.in/jaipur/mcdata/monsoon2025.pdf"
JICA = "https://www2.jica.go.jp/en/evaluation/pdf/2015_ID-P157_4_f.pdf"
CPCB_STP = "https://cpcb.nic.in/openpdffile.php?id=UmVwb3J0RmlsZXMvMTIyOF8xNjE1MTk2MzIyX21lZGlhcGhvdG85NTY0LnBkZg=="
NWMP = "https://cpcb.gov.in/water-quality-data/"
GAZETTE = "https://jaipurmc.org/"


def load(path: Path) -> dict:
    return json.loads(path.read_text())


def require(obj, *keys):
    for k in keys:
        if isinstance(obj, dict) and k in obj:
            obj = obj[k]
        elif isinstance(obj, list) and isinstance(k, int) and k < len(obj):
            obj = obj[k]
        else:
            raise SystemExit(f"facts: missing {keys} - an artifact changed shape")
    if obj is None:
        raise SystemExit(f"facts: {keys} is null")
    return obj


def fmt(n: float) -> str:
    return f"{n:,.0f}" if float(n).is_integer() else f"{n:,}"


def long_date(iso: str) -> str:
    d = date.fromisoformat(iso)
    return f"{d.day} {d.strftime('%B %Y')}"


def main() -> int:
    supply = load(DATA / "jaipur-supply-overview.json")
    dams = load(DATA / "jaipur-dam-storage.json")
    gwr = load(DATA / "gwr-blocks-jaipur.json")
    rq = load(DATA / "river-quality-jaipur.json")
    wards = load(DATA / "jaipur-ward-profiles.json")

    total = require(supply, "current_supply_total_mld")
    mix = require(supply, "current_supply_mix_mld")
    bisalpur_mld = next(m["mld"] for m in mix if m["source"].startswith("Bisalpur"))
    tube_mld = next(m["mld"] for m in mix if "tube wells" in m["source"])
    connections = require(supply, "distribution", "connections", "total")
    tankers = require(supply, "tankers")

    by_code = {d["source_code"]: d for d in require(dams, "dams")}
    bis = require(by_code, "bisalpur")
    ram = require(by_code, "ramgarh")
    report_date = require(dams, "report_date")

    blocks = {b["name"]: b for b in require(gwr, "blocks")}
    urban = require(blocks, "Jaipur Urban", "latest")
    district = require(gwr, "district_total")[-1]
    edition = district["year_label"]
    oe = sum(1 for b in blocks.values() if b["latest"]["class"] == "Over Exploited")

    def station(code: str) -> dict:
        for r in require(rq, "rivers"):
            for s in r.get("stations", []):
                if s.get("nwmp_code") == code:
                    return s
        raise SystemExit(f"facts: river-quality station {code} missing")

    newta = station("2952")["readings"][-1]
    bis_wq = station("2951")["readings"][-1]

    ward_rows = wards.get("wards") or wards.get("profiles") or []
    n_wards = len(ward_rows) if isinstance(ward_rows, list) else len(ward_rows.keys())
    if n_wards != 150:
        raise SystemExit(f"facts: expected 150 wards, found {n_wards}")

    share = round(bisalpur_mld / total * 100)
    facts = [
        {
            "id": "bisalpur-on-snapshot-day",
            "tier": 1,
            "category": "Reservoirs",
            "title": "Bisalpur on the latest report",
            "value": f"{bis['pct_designed']}",
            "unit": (
                f"% of Bisalpur's designed capacity on {long_date(report_date)} "
                f"({fmt(bis['gross_mcum'])} of {fmt(bis['designed_mcum'])} million cubic metres)"
            ),
            "interpretation": (
                f"The Rajasthan Water Resources Department's dam report of {long_date(report_date)} "
                f"puts Bisalpur at {bis['level_m']} m and {fmt(bis['gross_mcum'])} million cubic metres, "
                f"{bis['pct_designed']}% of what it was built to hold; on the same date a year earlier it "
                f"held {fmt(bis['last_year_mcum'])}. The dam is shared by Jaipur, Ajmer, Tonk and "
                "irrigation, so this is the whole dam, not the city's share."
            ),
            "data_date": report_date,
            "source_url": require(dams, "report_url"),
            "source_label": f"WRD Rajasthan, {require(dams, 'report_title')}",
        },
        {
            "id": "bisalpur-share-of-supply",
            "tier": 2,
            "featured": True,
            "category": "Supply",
            "title": "Three quarters of the city's water comes from one dam",
            "value": f"{share}",
            "unit": f"% of PHED's {fmt(total)} MLD for Jaipur city from Bisalpur dam (31 Dec 2025)",
            "interpretation": (
                "The Public Health Engineering Department, not the municipal corporation, supplies "
                f"Jaipur's water. Its table for 31 December 2025 puts the city's production at "
                f"{fmt(total)} MLD: {fmt(bisalpur_mld)} MLD from Bisalpur dam and {fmt(tube_mld)} MLD "
                "from its tube wells. A year earlier Bisalpur gave 492.08 MLD; the tube-well figure "
                "is the same in both years' tables, so the rise is the dam's."
            ),
            "data_date": "2025-12",
            "source_url": APR_2026,
            "source_label": "PHED Annual Progress Report 2025-26, urban schemes table, printed p.85",
        },
        {
            "id": "groundwater-city-unit",
            "tier": 2,
            "featured": True,
            "category": "Groundwater",
            "title": "The city pumps three and a half times what can safely be drawn",
            "value": f"{urban['development_pct']}",
            "unit": f"% of extractable groundwater drawn in the Jaipur Urban unit ({edition})",
            "interpretation": (
                "IN-GRES assesses the city as its own unit, Jaipur Urban, since 2021-2022. In "
                f"{edition} it draws {urban['development_pct']}% of what can be extracted each year "
                "without depleting the aquifer, the highest of the district's units. Almost all of "
                "the city's draw is domestic. Several inputs are carried forward between editions, so "
                "read the category, not a trend."
            ),
            "data_date": edition[:4],
            "source_url": INGRES,
            "source_label": f"IN-GRES dynamic groundwater assessment, {edition}",
        },
        {
            "id": "district-units-all-over-exploited",
            "tier": 2,
            "category": "Groundwater",
            "title": "Every assessment unit in the district draws more than can safely be drawn",
            "value": f"{oe} of {len(blocks)}",
            "unit": (
                f"IN-GRES units of Jaipur district over-exploited in {edition}; "
                f"district at {district['development_pct']}%"
            ),
            "interpretation": (
                f"All {len(blocks)} units IN-GRES assesses in Jaipur district are over-exploited in "
                f"{edition}. IN-GRES still draws the district as it was before 2023, so the total "
                "includes Kotputli, Viratnagar, Paota and Dudu."
            ),
            "data_date": edition[:4],
            "source_url": INGRES,
            "source_label": f"IN-GRES dynamic groundwater assessment, {edition}",
        },
        {
            "id": "ramgarh-empty",
            "tier": 2,
            "category": "Reservoirs",
            "title": "The city's old reservoir stands empty",
            "value": f"{fmt(ram['gross_mcum'])}",
            "unit": (
                f"million cubic metres in Ramgarh of its {fmt(ram['designed_mcum'])} on "
                f"{long_date(ram['date'])}, and {fmt(ram['last_year_mcum'])} on the same date a year earlier"
            ),
            "interpretation": (
                "Ramgarh dam on the Banganga was a source of the city's drinking water from 1978 "
                "(Supreme Court, 2017). The Water Resources Department reported it empty on every date "
                "read from June 2023, including October 2025, when the state's dams were 90% full. "
                "The Rajasthan High Court has heard a case on its catchment since 2011."
            ),
            "data_date": ram["date"],
            "source_url": require(dams, "report_url"),
            "source_label": f"WRD Rajasthan, {require(dams, 'report_title')}",
        },
        {
            "id": "tankers-summer-2025",
            "tier": 2,
            "featured": True,
            "category": "Supply",
            "title": "About a third of the state's urban water tankers ran in Jaipur",
            "value": f"{tankers['peak_tankers_per_day']}",
            "unit": (
                f"tankers a day making {fmt(tankers['peak_trips_per_day'])} trips in Jaipur city at "
                "the 2025 summer peak (24 Jun 2025)"
            ),
            "interpretation": (
                "PHED's summer table for urban areas lists the most water carried by road on 24 June "
                f"2025: {tankers['peak_tankers_per_day']} tankers a day and "
                f"{fmt(tankers['peak_trips_per_day'])} trips in Jaipur city, out of 714 tankers and "
                "4,435 trips across every listed town in Rajasthan."
            ),
            "data_date": "2025-06",
            "source_url": APR_2026,
            "source_label": "PHED Annual Progress Report 2025-26, Appendix 7, printed pp.41-42",
        },
        {
            "id": "dravyavati-newta-bod",
            "tier": 2,
            "category": "Rivers",
            "title": "Clean at the source, polluted where the city's river collects",
            "value": f"{newta['bod_mgl']['max']}",
            "unit": (
                f"mg/L BOD, highest reading at Newta dam (fed from the Dravyavati) in {newta['year']}, "
                f"against {bis_wq['bod_mgl']['max']} at Bisalpur"
            ),
            "interpretation": (
                "CPCB's national monitoring has no station on the Dravyavati channel. Its nearest "
                "station, at Newta dam, takes water diverted from the river and has failed the 3 mg/L "
                f"bathing criterion every year since 2018; Bisalpur, where Jaipur's water comes from, "
                f"stays under it ({bis_wq['bod_mgl']['max']} mg/L in {bis_wq['year']})."
            ),
            "data_date": str(newta["year"]),
            "source_url": NWMP,
            "source_label": f"CPCB NWMP river data, {newta['year']}",
        },
        {
            "id": "monsoon-2025",
            "tier": 2,
            "category": "Rainfall",
            "title": "Last monsoon: three quarters more rain than normal",
            "value": "918.5",
            "unit": "mm in Jaipur district, 1 June to 30 September 2025, against a normal of 524.3 (+75%)",
            "interpretation": (
                "IMD's Jaipur centre classes Jaipur district's 2025 monsoon as large excess: 918.5 mm "
                "against 524.3. The State as a whole had 164% of its long-period average."
            ),
            "data_date": "2025-09",
            "source_url": IMD_MONSOON,
            "source_label": "IMD Meteorological Centre Jaipur, Rajasthan Monsoon Report 2025, Table 1, p.5",
        },
        {
            "id": "trial-24x7-three-areas",
            "tier": 2,
            "category": "Supply",
            "title": "Round-the-clock water on trial in three neighbourhoods",
            "value": "3 of 5",
            "unit": "identified areas (Bajaj Nagar, Bani Park, Chitrakoot) on trial 24x7 supply since November 2024",
            "interpretation": (
                "Under a 19 May 2023 memorandum with Denmark, PHED picked five areas of Jaipur for "
                "district-metered 24x7 supply to cut non-revenue water. Bajaj Nagar, Bani Park and "
                "Chitrakoot have had trial 24x7 supply since November 2024, with a target of 20% "
                "non-revenue water there; surveys were under way in the other two."
            ),
            "data_date": "2026-01",
            "source_url": APR_2026,
            "source_label": "PHED Annual Progress Report 2025-26, non-revenue water, printed p.13",
        },
        {
            "id": "water-connections",
            "tier": 2,
            "category": "Supply",
            "title": "Seventy thousand more connections in a year",
            "value": fmt(connections),
            "unit": "water connections in Jaipur city on 31 Dec 2025, against 519,165 a year earlier",
            "interpretation": (
                f"PHED counts {fmt(connections)} water connections in the city at the end of 2025, "
                "up from 519,165 a year earlier."
            ),
            "data_date": "2025-12",
            "source_url": APR_2026,
            "source_label": "PHED Annual Progress Reports 2025-26 (printed p.85) and 2024-25 (printed p.84)",
        },
        {
            "id": "groundwater-share-before-bisalpur",
            "tier": 3,
            "category": "Supply",
            "title": "Before Bisalpur, almost all of the city's water came from the ground",
            "value": "97",
            "unit": "% of supply from groundwater in 2003, before the Bisalpur transfer; 18.8% in 2015",
            "interpretation": (
                "JICA's ex-post evaluation of the Bisalpur Jaipur project, on PHED's figures, gives "
                "the city's dependence on groundwater as 97% at appraisal in 2003 and 18.8% in 2015. "
                f"PHED's own table for 31 December 2025 puts tube wells at {fmt(tube_mld)} of "
                f"{fmt(total)} MLD; the two are different documents, so they are not a trend."
            ),
            "data_date": "2015",
            "source_url": JICA,
            "source_label": "JICA FY2015 ex-post evaluation, Bisalpur Jaipur Water Supply Project (Transfer System), p.19",
        },
        {
            "id": "water-lost-last-figure",
            "tier": 3,
            "category": "Supply",
            "title": "Water lost between source and tap: the last published figure is from 2015",
            "value": "37",
            "unit": "% non-revenue water in 2015, on PHED's figures, when 45-81% of consumer meters in the study zones were out of order",
            "interpretation": (
                "JICA's evaluation reports PHED's non-revenue water as 37% in 2015 and warns the figure "
                "is likely unreliable, because a 2014-15 study found 45 to 81% of consumer meters out "
                "of order in four zones. PHED's 2025-26 report sets a 20% target for its 24x7 trial "
                "areas but prints no current city figure."
            ),
            "data_date": "2015",
            "source_url": JICA,
            "source_label": "JICA FY2015 ex-post evaluation, Table 6, p.18",
        },
        {
            "id": "heaviest-day-1981",
            "tier": 3,
            "category": "Flood",
            "title": "The heaviest day on record: 19 July 1981",
            "value": "326.0",
            "unit": "mm in 24 hours at the Jaipur observatory on 19 July 1981",
            "interpretation": (
                "IMD's tables record 326.0 mm on 19 July 1981, more than half the city's normal year "
                "in one day. July 1981 is the wettest month on record at the observatory, 956.9 mm."
            ),
            "data_date": "1981-07-19",
            "source_url": IMD_TABLES,
            "source_label": "IMD Climatological Tables 1991-2020, JAIPUR 42348, printed p.166",
        },
        {
            "id": "normal-rainfall",
            "tier": 4,
            "category": "Rainfall",
            "title": "A normal year's rain, nearly all of it in four months",
            "value": "600.3",
            "unit": "mm a year at IMD's Jaipur observatory (1991-2020 normal); 89% falls June to September",
            "interpretation": (
                "IMD's 1991-2020 tables give the Jaipur observatory (index 42348) a normal of 600.3 mm "
                "on 34.3 rainy days. June to September bring 61.9, 190.5, 203.4 and 79.6 mm, 535.4 mm "
                "together."
            ),
            "data_date": "2020",
            "source_url": IMD_TABLES,
            "source_label": "IMD Climatological Tables 1991-2020, JAIPUR 42348, printed p.166",
        },
        {
            "id": "wards-150",
            "tier": 4,
            "category": "Governance",
            "title": "150 wards in one municipal corporation",
            "value": f"{n_wards}",
            "unit": "wards of Nagar Nigam Jaipur in the ward formation approved on 16 Sep 2025",
            "interpretation": (
                "Jaipur's Greater and Heritage corporations were merged back into one, Nagar Nigam "
                "Jaipur, with 150 wards in 13 zones; its council was elected in September 2026. Water "
                "is supplied by the state's PHED, not the corporation."
            ),
            "data_date": "2025-09-16",
            "source_url": GAZETTE,
            "source_label": "Rajasthan Gazette Extraordinary, 20 Sep 2025, LSG notification No. P.10(N.Pa.)(Gathan)(Chunav)DLB/25/19631",
        },
        {
            "id": "gap-sewage-generated",
            "tier": 3,
            "category": "Gap",
            "title": "How much sewage the city makes",
            "value": "Not published",
            "unit": "no city figure for sewage generated found; CPCB's 2020 inventory lists Jaipur's plants but no city total",
            "interpretation": (
                "CPCB's national inventory (data of June 2020) lists Jaipur's sewage plants one by one, "
                "with several marked under construction or proposed, and gives a state figure, but no "
                "Jaipur total; nothing newer was found."
            ),
            "data_date": "2020-06",
            "source_url": CPCB_STP,
            "source_label": "CPCB National Inventory of Sewage Treatment Plants (March 2021), Rajasthan pages",
        },
    ]

    sources = [
        {
            "id": sid,
            "title": t,
            "publisher": pub,
            "license": registry_license(sid),
            "role": "input",
        }
        for sid, t, pub in [
            (
                "phed-rajasthan-progress-reports",
                "PHED Annual Progress Reports 2024-25 and 2025-26",
                "Public Health Engineering Department, Government of Rajasthan",
            ),
            (
                "rajasthan-wrd-dam-storage",
                "WRD Rajasthan daily dam storage report",
                "Water Resources Department, Government of Rajasthan",
            ),
            (
                "ingres-groundwater-rajasthan",
                "IN-GRES assessment, Jaipur district",
                "CGWB / IIT-Hyderabad (IN-GRES)",
            ),
            (
                "cpcb-nwmp-annual",
                "CPCB NWMP river tables",
                "Central Pollution Control Board",
            ),
            (
                "imd-climatological-tables-1991-2020",
                "IMD Climatological Tables 1991-2020 (Jaipur, 42348)",
                "India Meteorological Department",
            ),
            (
                "jica-bisalpur-evaluation",
                "JICA ex-post evaluation, Bisalpur-Jaipur Water Supply Project (2016)",
                "Japan International Cooperation Agency",
            ),
            (
                "lsg-rajasthan-ward-gazette-2025",
                "LSG ward formation notification, 16 Sep 2025",
                "Local Self Government Department, Government of Rajasthan",
            ),
        ]
    ]
    sources += [
        {
            "title": "CPCB National Inventory of Sewage Treatment Plants (March 2021)",
            "publisher": "Central Pollution Control Board",
            "closed": True,
            "as_of": "2021-03",
            "url": CPCB_STP,
            "license": registry_license("cpcb-nwmp-annual"),
        },
    ]
    out = {
        "nvdm": "1.0",
        "dataset": "data-root/facts",
        "scope": {"kind": "city", "id": "jaipur"},
        "provenance": {
            "sources": sources,
            "method": "derived",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/build_jaipur_facts.py",
            "internal_inputs": [
                "public/data/jaipur-supply-overview.json",
                "public/data/jaipur-dam-storage.json",
                "public/data/gwr-blocks-jaipur.json",
                "public/data/river-quality-jaipur.json",
                "public/data/jaipur-ward-profiles.json",
            ],
            "note": "Every figure with a page behind it is read from that page's artifact; the rest carry their own citation.",
        },
        "place_id": "jaipur",
        "generated_at": date.today().isoformat(),
        "note": "Each card's number comes from the artifact behind the page it summarises, or from the document it cites.",
        "facts": facts,
    }
    path = DATA / "facts-jaipur.json"
    write_artifact(path, out)
    print(
        f"{len(facts)} facts ({sum(f['tier'] == 1 for f in facts)} tier-1) -> {path.name}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
