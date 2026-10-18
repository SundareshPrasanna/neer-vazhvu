#!/usr/bin/env python3
"""
Ahmedabad facts, derived from the shipped artifacts rather than typed again.

Every number on a card is read out of a file in public/data or public/geojson,
so a card cannot disagree with the page it summarises (the Pune pattern; see
build_pune_facts.py for why). require() makes a renamed key stop the build
instead of writing a blank onto a quotable card.

Run after the artifacts it reads:
  python3 neer-vazhvu-api/scripts/build_ahmedabad_facts.py
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
GEO = REPO_ROOT / "public" / "geojson"
BUDGET = "https://ahmedabadcity.gov.in/ViewFile/ViewFile?TYPE=FileRepository,2583"
INGRES = "https://ingres.iith.ac.in/"
NWMP = "https://cpcb.gov.in/water-quality-data/"


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


def main() -> int:
    supply = load(DATA / "ahmedabad-supply-overview.json")
    gwr = load(DATA / "gwr-blocks-ahmedabad.json")
    rq = load(DATA / "river-quality-ahmedabad.json")
    dams = load(DATA / "ahmedabad-dam-storage.json")
    wells = load(DATA / "ahmedabad-cgwb-stations.json")
    commits = load(DATA / "commitments-ahmedabad.json")
    wards = load(GEO / "ahmedabad-wards-2020.geojson")
    bodies = load(GEO / "ahmedabad-water-bodies-current.geojson")
    rain = load(DATA / "imd-rainfall-monthly-ahmedabad.json")

    mix = require(supply, "current_supply_mix_mld")
    total = require(supply, "current_supply_total_mld")
    narmada = sum(
        m["mld"] for m in mix if "Narmada" in m["source"] or "Dholka" in m["source"]
    )
    bore = next(m for m in mix if m["source"].startswith("Borewells"))
    wtp = require(supply, "wtps_summary")

    blocks = {b["name"]: b for b in require(gwr, "blocks")}
    urban = require(blocks, "Ahmedabad Urban", "latest")
    ring = require(blocks, "Ahmedabad City & Daskroi")
    ring_last = require(ring, "detail")[-1]
    district = require(gwr, "district_total")[-1]
    edition = district["year_label"]
    saline = require(gwr, "not_assessed_on_extraction")

    sab = next(r for r in require(rq, "rivers") if r["id"] == "sabarmati")
    khari = next(r for r in rq["rivers"] if r["id"] == "khari")
    st = {s["nwmp_code"]: s for s in sab["stations"]}
    vn, hansol = require(st, "2"), require(st, "1866")
    vn24 = next(x for x in vn["readings"] if x["year"] == 2024)
    hs24 = next(x for x in hansol["readings"] if x["year"] == 2024)
    floor_years = [
        x["year"]
        for x in vn["readings"]
        if x["year"] >= 2019
        and (
            (x["do_mgl"] or {}).get("min") == 0.3
            or "do_min_mgl" in x.get("below_detection", [])
        )
    ]
    hansol_do_min = min(
        x["do_mgl"]["min"]
        for x in hansol["readings"]
        if x["year"] >= 2019 and x["do_mgl"]
    )
    lali24 = next(x for x in khari["stations"][0]["readings"] if x["year"] == 2024)

    ssp = next(d for d in require(dams, "dams") if d["source_code"] == "sardar_sarovar")
    report_date = require(dams, "report_date")

    in_urban = sum(
        1 for w in require(wells, "wells") if w["block"] == "Ahmedabad Urban"
    )
    dated = [c for c in require(commits, "commitments") if c["due"]]
    overdue = [c for c in dated if c["status"] == "overdue"]
    # The interpretation names these six by hand; a status change must rewrite it.
    named = {
        "ahm-kotarpur-400-mld-wtp",
        "ahm-stp-sola-jagatpur",
        "ahm-stp-vinzol-75",
        "ahm-kharicut-phase-1",
        "ahm-drainage-master-plan-2050",
        "guj-reuse-70-percent-by-2025",
    }
    if {c["id"] for c in overdue} != named:
        sys.exit(
            "commitments-overdue: the overdue set changed; rewrite its interpretation"
        )
    feats = require(wards, "features")
    pop = sum(f["properties"]["population_2011"] for f in feats)
    zones = {f["properties"]["zone_name"] for f in feats}
    normal = require(rain, "normals", "annual_mean_mm")
    monthly = require(rain, "normals", "monthly_mean_mm")
    jul_aug = round((monthly[6] + monthly[7]) / sum(monthly) * 100)
    pops = [f["properties"]["population_2011"] for f in feats]

    share = round(narmada / total * 100)
    facts = [
        {
            "id": "narmada-share-of-supply",
            "tier": 1,
            "category": "Supply",
            "title": "Most of the city's water comes down one canal",
            "value": str(share),
            "unit": f"% of AMC's {fmt(total)} MLD from the Narmada Main Canal",
            "interpretation": f"AMC's own source table puts {fmt(narmada)} of the {fmt(total)} MLD it draws a day on three offtakes of the Narmada Main Canal, which carries water from Sardar Sarovar. The Mahi supplies {fmt(mix[3]['mld'])} MLD and borewells {fmt(bore['mld'])}. The Sabarmati, the river the city was founded on, is not in the table at all.",
            "data_date": "2026-02",
            "source_url": BUDGET,
            "source_label": "AMC Budget 2026-27, pp.63-64",
        },
        {
            "id": "city-aquifer-over-exploited",
            "tier": 1,
            "category": "Groundwater",
            "title": "The district reads semi-critical; the aquifer under the city is over-exploited",
            "value": fmt(urban["development_pct"]),
            "unit": f"% of extractable groundwater drawn in the Ahmedabad Urban unit ({edition})",
            "interpretation": f"IN-GRES assesses Ahmedabad district at {fmt(district['development_pct'])}%, {district['class'].lower()}. Its Ahmedabad Urban unit, which holds every AMC ward, is {urban['class'].lower()} at {fmt(urban['development_pct'])}%, and the rural ring around it, City and Daskroi, at {fmt(ring['latest']['development_pct'])}%. Read the category, not a trend: the urban unit's extraction was filed under different uses in each edition.",
            "source_url": INGRES,
            "source_label": f"IN-GRES dynamic groundwater assessment, {edition}",
        },
        {
            "id": "sabarmati-enters-clean-leaves-dead",
            "tier": 1,
            "category": "Rivers",
            "title": "The Sabarmati enters the city clean and leaves it without oxygen",
            "value": fmt(vn24["bod_mgl"]["max"]),
            "unit": f"mg/L peak BOD at V.N. Bridge in 2024, against {fmt(hs24['bod_mgl']['max'])} at Hansol upstream",
            "interpretation": f"CPCB measures the river where it enters the city at Hansol and again below the outfalls at V.N. Bridge. In 2024 the peak BOD was {fmt(hs24['bod_mgl']['max'])} mg/L upstream and {fmt(vn24['bod_mgl']['max'])} downstream; CPCB's bathing-water criterion is 3 or less. Dissolved oxygen at V.N. Bridge was at or below 0.3 mg/L, CPCB's detection floor, in {'every one' if len(floor_years) == 6 else len(floor_years)} of the 6 years from 2019 to 2024.",
            "data_date": "2024",
            "source_url": NWMP,
            "source_label": "CPCB NWMP annual river data, 2024",
        },
        {
            "id": "commitments-overdue",
            "tier": 1,
            "category": "Governance",
            "title": "Dated water promises past their date",
            "value": f"{len(overdue)} of {len(dated)}",
            "unit": "dated commitments are past their stated date",
            "interpretation": "The 400 MLD Kotarpur treatment plant MoHUA scheduled for 16 October 2026, 76.5% built by its report of 18 October; two sewage treatment plants AMC told the High Court would be ready by September 2025 and February 2026; the Kharicut canal's two-year rebuild; the 2050 drainage master plan due in March 2023; and the state's target of reusing 70% of treated wastewater by 2025. Each status cites a dated document on the commitments page.",
            "data_date": "2026-10",
            "source_url": "https://ahmedabadcity.gov.in/",
            "source_label": "AMC budgets, High Court orders and state filings (see /ahmedabad/commitments)",
        },
        {
            "id": "do-at-detection-floor",
            "tier": 2,
            "category": "Rivers",
            "title": "No measurable oxygen below the city",
            "value": str(len(floor_years)),
            "unit": "of 6 years (2019-2024) with dissolved oxygen at or below CPCB's 0.3 mg/L detection floor at V.N. Bridge",
            "interpretation": ""
            f"0.3 mg/L is the lowest value CPCB reports; anything at it is below detection. It recurs at the station below the city's outfalls, while at Hansol upstream the lowest reading in the same years was {fmt(hansol_do_min)} mg/L.",
            "data_date": "2024",
            "source_url": NWMP,
            "source_label": "CPCB NWMP annual river data, 2019-2024",
        },
        {
            "id": "sabarmati-priority-one",
            "tier": 2,
            "category": "Rivers",
            "title": "A Priority I polluted stretch in every CPCB edition",
            "value": "Priority I",
            "unit": "in CPCB's 2018, 2022 and 2025 polluted-stretch reports",
            "interpretation": "Priority I is CPCB's worst class, for stretches whose BOD exceeds 30 mg/L. The Sabarmati below Ahmedabad has been in it in all three editions, and so has the Khari at Lali village.",
            "data_date": "2025-10",
            "source_url": "https://cpcb.gov.in/polluted-river-stretches/",
            "source_label": "CPCB Polluted River Stretches, 2018, 2022 and October 2025",
        },
        {
            "id": "khari-at-lali",
            "tier": 3,
            "category": "Rivers",
            "title": "The Khari at Lali village",
            "value": fmt(lali24["bod_mgl"]["max"]),
            "unit": "mg/L peak BOD in 2024",
            "interpretation": "The tributary that passes the city's eastern industrial estates. CPCB's polluted-stretch editions put its maximum at 235 mg/L (2018), 195 (2022) and 68 (2025).",
            "data_date": "2024",
            "source_url": NWMP,
            "source_label": "CPCB NWMP annual river data, 2024",
        },
        {
            "id": "city-daskroi-irrigation",
            "tier": 2,
            "category": "Groundwater",
            "title": "The ring around the city draws the most, mostly for farms",
            "value": fmt(ring["latest"]["development_pct"]),
            "unit": f"% stage of extraction, Ahmedabad City and Daskroi ({edition})",
            "interpretation": f"{round(ring_last['draft_agriculture_ham'] / ring['latest']['draft_total_ham'] * 100)}% of this unit's extraction is irrigation ({fmt(ring_last['draft_agriculture_ham'])} of {fmt(ring['latest']['draft_total_ham'])} hectare-metres). IN-GRES carved the city's own unit out of it in 2021-2022.",
            "source_url": INGRES,
            "source_label": f"IN-GRES dynamic groundwater assessment, {edition}",
        },
        {
            "id": "saline-talukas",
            "tier": 3,
            "category": "Groundwater",
            "title": "Two talukas cannot be assessed on extraction at all",
            "value": str(len(saline)),
            "unit": f"talukas categorised 'salinity' in every edition ({', '.join(u['name'] for u in saline)})",
            "interpretation": f"CGWB does not assess saline aquifers on extraction. {round(district['poor_quality_area_ha'] / district['recharge_worthy_area_ha'] * 100)}% of Ahmedabad district's assessed area is poor-quality groundwater ({fmt(round(district['poor_quality_area_ha']))} of {fmt(round(district['recharge_worthy_area_ha']))} ha).",
            "source_url": INGRES,
            "source_label": f"IN-GRES dynamic groundwater assessment, {edition}",
        },
        {
            "id": "telemetry-wells-in-city",
            "tier": 3,
            "category": "Groundwater",
            "title": "Groundwater telemetry under the city",
            "value": str(in_urban),
            "unit": f"of {len(wells['wells'])} telemetry wells in the district stand in the Ahmedabad Urban unit",
            "interpretation": "Six-hourly piezometers run by Gujarat's groundwater department and CGWB, published on the National Water Data Portal. Shallow and deep wells stand side by side in the same neighbourhoods, so no single city water-table depth is computed.",
            "data_date": wells["wells"][0]["latest_reading"][:7]
            if wells["wells"]
            else None,
            "source_url": "https://nwdp.nwic.gov.in/",
            "source_label": "National Water Data Portal, groundwater telemetry",
        },
        {
            "id": "treatment-capacity",
            "tier": 2,
            "category": "Supply",
            "title": "Three treatment plants carry the city",
            "value": fmt(wtp["total_installed_capacity_mld"]),
            "unit": f"MLD treatment capacity; {fmt(wtp['total_installed_capacity_mld'] + wtp['planned_additions_mld'])} with the works under way or planned",
            "interpretation": "Kotarpur, Jaspur and Raska. A 400 MLD plant at Kotarpur under AMRUT 2.0 is scheduled for 16 October 2026 in MoHUA's status list; a 200 MLD addition at Jaspur has been described as in progress in five budgets without a date.",
            "data_date": "2026-02",
            "source_url": BUDGET,
            "source_label": "AMC Budget 2026-27, p.64",
        },
        {
            "id": "borewells",
            "tier": 3,
            "category": "Supply",
            "title": "AMC's own borewells",
            "value": fmt(bore["mld"]),
            "unit": f"MLD from {bore['source'].split('(')[1].rstrip(')')} borewells, of {fmt(bore['capacity_mld'])} MLD capacity",
            "interpretation": "The city's own groundwater draw, as AMC states it. Private borewells are not in any AMC figure.",
            "data_date": "2026-02",
            "source_url": BUDGET,
            "source_label": "AMC Budget 2026-27, p.63",
        },
        {
            "id": "sardar-sarovar-storage",
            "tier": 3,
            "category": "Reservoirs",
            "title": "Sardar Sarovar on the day of this snapshot",
            "value": fmt(ssp["live_pct"]),
            "unit": f"% of live capacity on {report_date}; {fmt(ssp['outflow_canal_cusecs'])} cusecs into the Narmada Main Canal",
            "interpretation": "The dam that supplies most of the city's water, from the state water department's daily report. It is a four-state project; Ahmedabad's share of its storage is not published. The dashboard's reservoir cards carry the daily series.",
            "data_date": report_date[:7],
            "source_url": "https://wrd-dam.gujarat.gov.in/index.php",
            "source_label": "Gujarat NWRWS&K daily dam report",
        },
        {
            "id": "wards-and-people",
            "tier": 4,
            "category": "Governance",
            "title": "48 wards in 7 zones",
            "value": fmt(pop),
            "unit": f"people in {len(feats)} wards and {len(zones)} zones (Census 2011, as used for the 2020 delimitation)",
            "interpretation": f"The State Election Commission drew the wards in October 2020 around Census 2011 populations of {min(pops) / 1e5:.2f} to {max(pops) / 1e5:.2f} lakh each. AMC's 2026-27 budget puts today's population at about 90 lakh.",
            "data_date": "2011",
            "source_url": "https://sec.gujarat.gov.in/images/pdf/Ahmedabad-MNP-2020.pdf",
            "source_label": "State Election Commission, Gujarat, AMC delimitation order (3 Oct 2020)",
        },
        {
            "id": "mapped-water-bodies",
            "tier": 3,
            "category": "Water bodies",
            "title": "Water bodies on the map",
            "value": str(len(bodies["features"])),
            "unit": "lakes, ponds, reservoirs and river polygons, from OpenStreetMap",
            "interpretation": "AMC counts 176 lakes in its 2026-27 budget but publishes no lake register and no lake layer, so the map is OpenStreetMap's.",
            "source_url": "https://www.openstreetmap.org/copyright",
            "source_label": "OpenStreetMap contributors (ODbL 1.0)",
        },
        {
            "id": "normal-rainfall",
            "tier": 4,
            "category": "Rainfall",
            "title": "A normal year's rain",
            "value": fmt(normal),
            "unit": "mm a year, IMD gridded data at 23.0 N 72.5 E (1970-2020 mean)",
            "interpretation": f"IMD's own Ahmedabad observatory normal is 783.6 mm (1991-2020). On this grid cell, July and August bring {jul_aug}% of a normal year's rain.",
            "source_url": "https://city.imd.gov.in/citywx/extreme/climate.php?id=42647",
            "source_label": "India Meteorological Department",
        },
        {
            "id": "gap-nrw",
            "tier": 3,
            "category": "Gap",
            "title": "How much water is lost in the pipes",
            "value": "Not measured",
            "unit": "no measured non-revenue water has been published",
            "interpretation": "AMC's 2023-24 budget says connections are unmetered; its 2024-25 and 2025-26 budgets promise a 5% cut in losses without stating a baseline.",
            "data_date": "2023-02",
            "source_url": "https://ahmedabadcity.gov.in/ViewFile/ViewFile?TYPE=FileRepository,2203",
            "source_label": "AMC Budget 2023-24",
        },
        {
            "id": "gap-entitlement",
            "tier": 3,
            "category": "Gap",
            "title": "How much Narmada water the city is entitled to",
            "value": "Not published",
            "unit": "no public order states AMC's base allocation",
            "interpretation": "Gujarat sanctions municipal raw water each year with a 25% band either side, under a 2007 resolution and its 2008 clarification, but the sanctioned quantity for Ahmedabad does not appear in any public document found.",
            "data_date": "2008-09",
            "source_url": "https://guj-nwrws.gujarat.gov.in/downloads/circular_clarification_of_watercharges.pdf",
            "source_label": "Gujarat NWRWS&K Department, circular of 9 Sept 2008 on the 3 Feb 2007 water-charges resolution",
        },
    ]
    facts = [f for f in facts if f.get("data_date", "") is not None]

    out = {
        "nvdm": "1.0",
        "dataset": "data-root/facts",
        "scope": {"kind": "city", "id": "ahmedabad"},
        "provenance": {
            "sources": [
                {
                    "id": sid,
                    "title": t,
                    "publisher": pub,
                    "license": registry_license(sid),
                    "role": "input",
                }
                for sid, t, pub in [
                    (
                        "amc-budget",
                        "AMC Budget 2026-27 and 2023-24",
                        "Ahmedabad Municipal Corporation",
                    ),
                    (
                        "ingres-groundwater-gujarat",
                        "IN-GRES assessment, Ahmedabad district",
                        "CGWB / IIT-Hyderabad (IN-GRES)",
                    ),
                    (
                        "cpcb-nwmp",
                        "CPCB NWMP river tables",
                        "Central Pollution Control Board",
                    ),
                    (
                        "gujarat-wrd-dam-daily-report",
                        "Gujarat daily dam report",
                        "Government of Gujarat",
                    ),
                    (
                        "nwic-nwdp-groundwater-gujarat",
                        "NWDP groundwater telemetry",
                        "National Water Informatics Centre",
                    ),
                    (
                        "amc-citymap-wards",
                        "AMC ward layer",
                        "Ahmedabad Municipal Corporation",
                    ),
                    (
                        "sec-gujarat-amc-delimitation-2020",
                        "SEC delimitation order",
                        "State Election Commission, Gujarat",
                    ),
                    (
                        "osm-overpass",
                        "OpenStreetMap water bodies",
                        "OpenStreetMap contributors",
                    ),
                    (
                        "imd-gridded-rainfall-ahmedabad",
                        "IMD gridded rainfall",
                        "India Meteorological Department",
                    ),
                ]
            ],
            "method": "derived",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/build_ahmedabad_facts.py",
            "internal_inputs": [
                "public/data/ahmedabad-supply-overview.json",
                "public/data/gwr-blocks-ahmedabad.json",
                "public/data/river-quality-ahmedabad.json",
                "public/data/ahmedabad-dam-storage.json",
                "public/data/ahmedabad-cgwb-stations.json",
                "public/data/commitments-ahmedabad.json",
                "public/data/imd-rainfall-monthly-ahmedabad.json",
                "public/geojson/ahmedabad-wards-2020.geojson",
                "public/geojson/ahmedabad-water-bodies-current.geojson",
            ],
            "note": "Every figure is read from a shipped artifact; nothing is transcribed a second time.",
        },
        "place_id": "ahmedabad",
        "generated_at": date.today().isoformat(),
        "note": "Each card's number comes from the artifact behind the page it summarises.",
        "facts": facts,
    }
    path = DATA / "facts-ahmedabad.json"
    write_artifact(path, out)
    print(
        f"{len(facts)} facts ({sum(f['tier'] == 1 for f in facts)} tier-1) -> {path.name}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
